import formData from 'form-data';
import Mailgun from 'mailgun.js';
import { logEmail } from '@/lib/emailLog';
import {
  buildComplianceFooterHtml,
  buildComplianceFooterText,
  buildMailgunComplianceOptions,
} from '@/lib/emailCompliance';

const mailgunApiKey = process.env.MAILGUN_API_KEY;
const mailgunDomain = process.env.MAILGUN_DOMAIN;
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const fromRaw = process.env.EMAIL_FROM || `noreply@${mailgunDomain || 'example.com'}`;
const fromEmail = fromRaw.includes('<') ? fromRaw : `Taiwan Digital Fest <${fromRaw}>`;

const mailgunClient = mailgunApiKey && mailgunDomain
  ? new Mailgun(formData).client({ username: 'api', key: mailgunApiKey })
  : null;

export interface TransferEmailOrder {
  id: string;
  ticket_tier: string | null;
  amount_total: number | null;
  currency: string | null;
  customer_name: string | null;
}

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

function formatAmount(amountCents: number | null, currency: string | null): string {
  if (amountCents == null || !currency) return '-';
  return `${(amountCents / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

function tierLabel(tier: string | null): string {
  if (!tier) return '-';
  return tier.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function renderLayout(bodyHtml: string, subject: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #1E1F1C; padding: 30px; border-radius: 8px; margin-bottom: 20px;">
    <h1 style="color: #10B8D9; margin: 0; font-size: 24px;">Taiwan Digital Fest 2026</h1>
  </div>
  <div style="background-color: #f9f9f9; padding: 30px; border-radius: 8px; margin-bottom: 20px;">
    ${bodyHtml}
  </div>
  ${buildComplianceFooterHtml({ includeUnsubscribe: false })}
</body>
</html>`;
}

/**
 * Notify the ORIGINAL ticket owner that their order has been transferred away.
 */
export async function sendOrderTransferredFromEmail(
  toEmail: string,
  order: TransferEmailOrder,
  newOwnerEmail: string,
): Promise<SendResult> {
  if (!mailgunClient || !mailgunDomain) {
    return { success: false, error: 'Email service is not configured' };
  }

  const subject = `訂單已轉讓 / Order Transferred — ${order.id.slice(0, 8)}`;
  const orderDetailUrl = `${baseUrl}/order/${order.id}`;
  const amount = formatAmount(order.amount_total, order.currency);

  const bodyHtml = `
    <h2 style="color: #10B8D9; margin-top: 0;">訂單已轉讓 · Order Transferred</h2>
    <p>您好 ${order.customer_name || ''}，</p>
    <p>您已將以下訂單轉讓給 <strong>${newOwnerEmail}</strong>，此訂單不再屬於您。</p>
    <p>You have transferred the order below to <strong>${newOwnerEmail}</strong>. This order no longer belongs to you.</p>
    <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10B8D9;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr><td style="padding: 6px 0; color: #666;">Order ID</td><td style="padding: 6px 0; font-family: monospace;">${order.id}</td></tr>
        <tr><td style="padding: 6px 0; color: #666;">Ticket Tier</td><td style="padding: 6px 0;">${tierLabel(order.ticket_tier)}</td></tr>
        <tr><td style="padding: 6px 0; color: #666;">Amount</td><td style="padding: 6px 0;">${amount}</td></tr>
        <tr><td style="padding: 6px 0; color: #666;">Transferred To</td><td style="padding: 6px 0; font-family: monospace;">${newOwnerEmail}</td></tr>
      </table>
    </div>
    <p style="color: #666; font-size: 14px;">如果這不是您本人執行的操作，請立即聯絡我們。</p>
    <p style="color: #666; font-size: 14px;">If you did not perform this action, please contact us immediately.</p>
    <p style="color: #666; font-size: 14px; margin-top: 30px;">Taiwan Digital Fest 2026 Team</p>
  `;

  const textContent = `訂單已轉讓 / Order Transferred

您已將訂單 ${order.id} 轉讓給 ${newOwnerEmail}。
You have transferred order ${order.id} to ${newOwnerEmail}.

Order ID: ${order.id}
Ticket Tier: ${tierLabel(order.ticket_tier)}
Amount: ${amount}
Transferred To: ${newOwnerEmail}

如果這不是您本人執行的操作，請立即聯絡我們。
If you did not perform this action, please contact us immediately.

View order: ${orderDetailUrl}

Taiwan Digital Fest 2026 Team

${buildComplianceFooterText({ includeUnsubscribe: false })}`;

  const logMeta = {
    order_id: order.id,
    direction: 'from',
    counterparty_email: newOwnerEmail,
  };

  try {
    const response = await mailgunClient.messages.create(mailgunDomain, {
      from: fromEmail,
      to: toEmail,
      subject,
      html: renderLayout(bodyHtml, subject),
      text: textContent,
      ...buildMailgunComplianceOptions({ tag: 'order_transferred_from' }),
    });

    if (!response || !response.id) {
      await logEmail({
        to_email: toEmail,
        from_email: fromEmail,
        subject,
        email_type: 'order_transferred_from',
        status: 'failed',
        error_message: 'Mailgun returned no message ID',
        metadata: logMeta,
      });
      return { success: false, error: 'Mailgun returned no message ID' };
    }

    await logEmail({
      to_email: toEmail,
      from_email: fromEmail,
      subject,
      email_type: 'order_transferred_from',
      status: 'sent',
      mailgun_message_id: response.id,
      metadata: logMeta,
    });

    return { success: true, messageId: response.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logEmail({
      to_email: toEmail,
      from_email: fromEmail,
      subject,
      email_type: 'order_transferred_from',
      status: 'failed',
      error_message: message,
      metadata: logMeta,
    });
    return { success: false, error: message };
  }
}

/**
 * Notify the NEW ticket owner that an order has been transferred to them.
 */
export async function sendOrderTransferredToEmail(
  toEmail: string,
  order: TransferEmailOrder,
  oldOwnerEmail: string,
): Promise<SendResult> {
  if (!mailgunClient || !mailgunDomain) {
    return { success: false, error: 'Email service is not configured' };
  }

  const subject = `您收到一張 TDF 2026 門票 / A TDF 2026 ticket has been transferred to you`;
  const memberUrl = `${baseUrl}/me`;
  const amount = formatAmount(order.amount_total, order.currency);

  const bodyHtml = `
    <h2 style="color: #10B8D9; margin-top: 0;">您收到一張門票 · Ticket Received</h2>
    <p><strong>${oldOwnerEmail}</strong> 已將下列訂單轉讓給您。</p>
    <p><strong>${oldOwnerEmail}</strong> has transferred the order below to you.</p>
    <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10B8D9;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr><td style="padding: 6px 0; color: #666;">Order ID</td><td style="padding: 6px 0; font-family: monospace;">${order.id}</td></tr>
        <tr><td style="padding: 6px 0; color: #666;">Ticket Tier</td><td style="padding: 6px 0;">${tierLabel(order.ticket_tier)}</td></tr>
        <tr><td style="padding: 6px 0; color: #666;">Amount</td><td style="padding: 6px 0;">${amount}</td></tr>
        <tr><td style="padding: 6px 0; color: #666;">From</td><td style="padding: 6px 0; font-family: monospace;">${oldOwnerEmail}</td></tr>
      </table>
    </div>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${memberUrl}"
         style="display: inline-block; background-color: #10B8D9; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600;">
        登入會員頁 / Sign in to view
      </a>
    </div>
    <p style="color: #666; font-size: 14px;">使用此信箱登入 <a href="${memberUrl}">${memberUrl}</a>，即可看到這張訂單。</p>
    <p style="color: #666; font-size: 14px;">Sign in at <a href="${memberUrl}">${memberUrl}</a> with this email to view the order.</p>
    <p style="color: #666; font-size: 14px;">如果您並不認識轉讓者，請回信通知我們。</p>
    <p style="color: #666; font-size: 14px;">If you don't recognize the sender, please reply to let us know.</p>
    <p style="color: #666; font-size: 14px; margin-top: 30px;">Taiwan Digital Fest 2026 Team</p>
  `;

  const textContent = `您收到一張門票 / Ticket Received

${oldOwnerEmail} 已將訂單 ${order.id} 轉讓給您。
${oldOwnerEmail} has transferred order ${order.id} to you.

Order ID: ${order.id}
Ticket Tier: ${tierLabel(order.ticket_tier)}
Amount: ${amount}
From: ${oldOwnerEmail}

使用此信箱登入 ${memberUrl}，即可看到這張訂單。
Sign in at ${memberUrl} with this email to view the order.

如果您並不認識轉讓者，請回信通知我們。
If you don't recognize the sender, please reply to let us know.

Taiwan Digital Fest 2026 Team

${buildComplianceFooterText({ includeUnsubscribe: false })}`;

  const logMeta = {
    order_id: order.id,
    direction: 'to',
    counterparty_email: oldOwnerEmail,
  };

  try {
    const response = await mailgunClient.messages.create(mailgunDomain, {
      from: fromEmail,
      to: toEmail,
      subject,
      html: renderLayout(bodyHtml, subject),
      text: textContent,
      ...buildMailgunComplianceOptions({ tag: 'order_transferred_to' }),
    });

    if (!response || !response.id) {
      await logEmail({
        to_email: toEmail,
        from_email: fromEmail,
        subject,
        email_type: 'order_transferred_to',
        status: 'failed',
        error_message: 'Mailgun returned no message ID',
        metadata: logMeta,
      });
      return { success: false, error: 'Mailgun returned no message ID' };
    }

    await logEmail({
      to_email: toEmail,
      from_email: fromEmail,
      subject,
      email_type: 'order_transferred_to',
      status: 'sent',
      mailgun_message_id: response.id,
      metadata: logMeta,
    });

    return { success: true, messageId: response.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logEmail({
      to_email: toEmail,
      from_email: fromEmail,
      subject,
      email_type: 'order_transferred_to',
      status: 'failed',
      error_message: message,
      metadata: logMeta,
    });
    return { success: false, error: message };
  }
}
