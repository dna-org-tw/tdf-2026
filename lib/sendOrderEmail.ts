import formData from 'form-data';
import Mailgun from 'mailgun.js';
import { logEmail, type EmailType } from '@/lib/emailLog';
import { supabaseServer } from '@/lib/supabaseServer';

const mailgunApiKey = process.env.MAILGUN_API_KEY;
const mailgunDomain = process.env.MAILGUN_DOMAIN;
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const fromRaw = process.env.EMAIL_FROM || `noreply@${mailgunDomain || 'example.com'}`;
const fromEmail = fromRaw.includes('<') ? fromRaw : `Taiwan Digital Fest <${fromRaw}>`;

const mailgunClient = mailgunApiKey && mailgunDomain
  ? new Mailgun(formData).client({
      username: 'api',
      key: mailgunApiKey,
    })
  : null;

export interface OrderEmailData {
  id: string;
  payment_status: string;
  amount_total: number | null;
  currency: string | null;
  customer_email: string | null;
  customer_name: string | null;
  ticket_tier?: string | null;
  created: number | null;
}

export type OrderEmailType = 'success' | 'cancelled';

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  skipped?: boolean;
}

/**
 * Check if an order confirmation email has already been sent for a given order.
 * Used for idempotency — prevents duplicate emails when both webhook and client trigger.
 */
async function hasEmailBeenSent(orderId: string, emailType: EmailType): Promise<boolean> {
  if (!supabaseServer) return false;

  try {
    const { data, error } = await supabaseServer
      .from('email_logs')
      .select('id')
      .eq('email_type', emailType)
      .eq('status', 'sent')
      .contains('metadata', { order_id: orderId })
      .limit(1);

    if (error) {
      console.error('[SendOrderEmail] Error checking email logs:', error);
      return false;
    }

    return (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

/**
 * Send an order confirmation or cancellation email via Mailgun.
 * Includes idempotency check — will skip if the same email type was already sent for this order.
 */
export async function sendOrderEmail(
  order: OrderEmailData,
  type: OrderEmailType
): Promise<SendResult> {
  if (!order.customer_email) {
    return { success: false, error: 'No customer email' };
  }

  if (!mailgunClient || !mailgunDomain) {
    console.warn('[SendOrderEmail] Mailgun is not configured.');
    return { success: false, error: 'Email service is not configured' };
  }

  const isSuccess = type === 'success' && order.payment_status === 'paid';
  const emailType: EmailType = isSuccess ? 'order_success' : 'order_cancelled';

  // Idempotency check
  const alreadySent = await hasEmailBeenSent(order.id, emailType);
  if (alreadySent) {
    console.log(`[SendOrderEmail] Email ${emailType} already sent for order ${order.id}, skipping.`);
    return { success: true, skipped: true };
  }

  const orderDetailUrl = `${baseUrl}/order/${order.id}`;

  // Format amount
  const amountFormatted =
    order.amount_total && order.currency
      ? `${(order.amount_total / 100).toFixed(2)} ${order.currency.toUpperCase()}`
      : 'N/A';

  // Format date
  const orderDate = order.created
    ? new Date(order.created * 1000).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Taipei',
        timeZoneName: 'short',
      })
    : 'N/A';

  const subject = isSuccess
    ? `Payment Confirmation - Order ${order.id}`
    : `Payment Status - Order ${order.id}`;

  const htmlContent = `
<!DOCTYPE html>
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
    <h2 style="color: ${isSuccess ? '#10B8D9' : '#FFD028'}; margin-top: 0;">
      ${isSuccess ? '&#10003; Payment Successful' : '&#9888; Payment Status'}
    </h2>

    <p>Dear ${order.customer_name || 'Customer'},</p>

    <p>
      ${isSuccess
        ? `Your payment has been successfully processed. Thank you for your purchase!`
        : `Your payment was not completed. No charges have been made to your account.`}
    </p>

    <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${isSuccess ? '#10B8D9' : '#FFD028'};">
      <h3 style="margin-top: 0;">Order Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #666;"><strong>Order ID:</strong></td>
          <td style="padding: 8px 0; font-family: monospace;">${order.id}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;"><strong>Status:</strong></td>
          <td style="padding: 8px 0; color: ${isSuccess ? '#10B8D9' : '#FFD028'};">
            ${isSuccess ? 'Paid' : order.payment_status || 'Unpaid'}
          </td>
        </tr>
        ${order.ticket_tier
          ? `<tr>
              <td style="padding: 8px 0; color: #666;"><strong>Ticket Tier:</strong></td>
              <td style="padding: 8px 0;">${order.ticket_tier.toUpperCase()}</td>
            </tr>`
          : ''}
        <tr>
          <td style="padding: 8px 0; color: #666;"><strong>Amount:</strong></td>
          <td style="padding: 8px 0;">${amountFormatted}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;"><strong>Date:</strong></td>
          <td style="padding: 8px 0;">${orderDate}</td>
        </tr>
      </table>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${orderDetailUrl}"
         style="display: inline-block; background-color: #10B8D9; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600;">
        View Order Details
      </a>
    </div>

    <p style="color: #666; font-size: 14px;">
      ${isSuccess
        ? `You can view your order details anytime by clicking the button above or visiting: <a href="${orderDetailUrl}">${orderDetailUrl}</a>`
        : `If you'd like to complete your purchase, you can view your order details and try again: <a href="${orderDetailUrl}">${orderDetailUrl}</a>`}
    </p>

    <p style="color: #666; font-size: 14px; margin-top: 30px;">
      If you have any questions, please don't hesitate to contact us.
    </p>

    <p style="color: #666; font-size: 14px;">
      Best regards,<br>
      Taiwan Digital Fest 2026 Team
    </p>
  </div>

  <div style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
    <p>This is an automated email. Please do not reply to this message.</p>
  </div>
</body>
</html>
  `;

  const textContent = `
Taiwan Digital Fest 2026

${isSuccess ? 'Payment Successful' : 'Payment Status'}

Dear ${order.customer_name || 'Customer'},

${isSuccess
  ? `Your payment has been successfully processed. Thank you for your purchase!`
  : `Your payment was not completed. No charges have been made to your account.`}

Order Details:
- Order ID: ${order.id}
- Status: ${isSuccess ? 'Paid' : order.payment_status || 'Unpaid'}
${order.ticket_tier ? `- Ticket Tier: ${order.ticket_tier.toUpperCase()}` : ''}
- Amount: ${amountFormatted}
- Date: ${orderDate}

View your order details: ${orderDetailUrl}

${isSuccess
  ? `You can view your order details anytime by visiting: ${orderDetailUrl}`
  : `If you'd like to complete your purchase, you can view your order details and try again: ${orderDetailUrl}`}

If you have any questions, please don't hesitate to contact us.

Best regards,
Taiwan Digital Fest 2026 Team
  `;

  const logMeta = {
    order_id: order.id,
    ticket_tier: order.ticket_tier,
    amount_total: order.amount_total,
    currency: order.currency,
  };

  try {
    const response = await mailgunClient.messages.create(mailgunDomain, {
      from: fromEmail,
      to: order.customer_email,
      subject,
      html: htmlContent,
      text: textContent,
    });

    if (!response || !response.id) {
      console.error('[SendOrderEmail] Mailgun returned no message ID', response);
      logEmail({
        to_email: order.customer_email,
        from_email: fromEmail,
        subject,
        email_type: emailType,
        status: 'failed',
        error_message: 'Mailgun returned no message ID',
        metadata: logMeta,
      }).catch(() => {});
      return { success: false, error: 'Mailgun returned no message ID' };
    }

    logEmail({
      to_email: order.customer_email,
      from_email: fromEmail,
      subject,
      email_type: emailType,
      status: 'sent',
      mailgun_message_id: response.id,
      metadata: logMeta,
    }).catch(() => {});

    console.log(`[SendOrderEmail] Email sent for order ${order.id}: ${response.id}`);
    return { success: true, messageId: response.id };
  } catch (error) {
    console.error('[SendOrderEmail] Error sending email:', error);
    logEmail({
      to_email: order.customer_email,
      from_email: fromEmail,
      email_type: emailType,
      status: 'failed',
      error_message: error instanceof Error ? error.message : String(error),
      metadata: logMeta,
    }).catch(() => {});
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
