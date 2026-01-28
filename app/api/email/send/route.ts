import { NextRequest, NextResponse } from 'next/server';
import formData from 'form-data';
import Mailgun from 'mailgun.js';

const mailgunApiKey = process.env.MAILGUN_API_KEY;
const mailgunDomain = process.env.MAILGUN_DOMAIN;
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const fromEmail = process.env.EMAIL_FROM || `noreply@${mailgunDomain || 'example.com'}`;

const mailgunClient = mailgunApiKey && mailgunDomain
  ? new Mailgun(formData).client({
      username: 'api',
      key: mailgunApiKey,
    })
  : null;

interface OrderData {
  id: string;
  payment_status: string;
  amount_total: number | null;
  currency: string | null;
  customer_email: string | null;
  customer_name: string | null;
  ticket_tier?: string | null;
  created: number | null;
}

export async function POST(req: NextRequest) {
  try {
    if (!mailgunClient || !mailgunDomain) {
      console.warn('[Email] Mailgun is not configured. Email sending is disabled.');
      return NextResponse.json(
        { error: 'Email service is not configured.' },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const { order, type } = body as { order: OrderData; type: 'success' | 'cancelled' };

    if (!order || !order.customer_email) {
      return NextResponse.json(
        { error: 'Order data and customer email are required.' },
        { status: 400 }
      );
    }

    const orderDetailUrl = `${baseUrl}/order/${order.id}`;
    const isSuccess = type === 'success' && order.payment_status === 'paid';

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
      ${isSuccess ? '✓ Payment Successful' : '⚠ Payment Status'}
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

${isSuccess ? '✓ Payment Successful' : '⚠ Payment Status'}

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

    const messageData = {
      from: fromEmail,
      to: order.customer_email,
      subject,
      html: htmlContent,
      text: textContent,
    };

    const response = await mailgunClient.messages.create(mailgunDomain, messageData);

    if (!response || !response.id) {
      console.error('[Email] Failed to send email', response);
      return NextResponse.json(
        { error: 'Failed to send email.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, messageId: response.id });
  } catch (error) {
    console.error('[Email] Error sending email', error);
    return NextResponse.json(
      { error: 'Failed to send email.' },
      { status: 500 }
    );
  }
}
