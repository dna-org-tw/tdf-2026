import formData from 'form-data';
import Mailgun from 'mailgun.js';
import { logEmail } from './emailLog';
import {
  buildComplianceFooterHtml,
  buildComplianceFooterText,
  buildMailgunComplianceOptions,
} from './emailCompliance';

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

/**
 * Send an unsubscribe confirmation email containing a tokenized link.
 * The user must click the link to actually unsubscribe.
 */
export async function sendUnsubscribeConfirmationEmail(
  email: string,
  token: string
): Promise<boolean> {
  if (!mailgunClient || !mailgunDomain) {
    console.warn('[Email] Mailgun is not configured. Unsubscribe confirmation email will not be sent.');
    return false;
  }

  const subject = 'Confirm Your Unsubscription - Taiwan Digital Fest 2026';
  const unsubscribeUrl = `${baseUrl}/newsletter/unsubscribe?token=${token}`;

  try {
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
    <h2 style="color: #10B8D9; margin-top: 0;">Confirm Your Unsubscription</h2>

    <p>Dear ${email},</p>

    <p>
      We received a request to unsubscribe this email from the Taiwan Digital Nomad Community newsletter.
      If you made this request, please click the button below to confirm.
    </p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${unsubscribeUrl}" style="display: inline-block; background-color: #10B8D9; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
        Confirm Unsubscription
      </a>
    </div>

    <p style="color: #666; font-size: 14px;">
      If the button doesn't work, you can copy and paste this link into your browser:
    </p>
    <p style="color: #10B8D9; font-size: 12px; word-break: break-all;">
      ${unsubscribeUrl}
    </p>

    <p style="color: #666; font-size: 14px; margin-top: 30px;">
      If you did not request this, you can safely ignore this email and your subscription will remain active.
    </p>

    <p style="color: #666; font-size: 14px;">
      Thank you,<br>
      Taiwan Digital Fest 2026 Team
    </p>
  </div>

  ${buildComplianceFooterHtml({ includeUnsubscribe: false })}
</body>
</html>
    `;

    const textContent = `
Taiwan Digital Fest 2026

Confirm Your Unsubscription

Dear ${email},

We received a request to unsubscribe this email from the Taiwan Digital Nomad Community newsletter.
If you made this request, please click the link below to confirm:

${unsubscribeUrl}

If you did not request this, you can safely ignore this email and your subscription will remain active.

Thank you,
Taiwan Digital Fest 2026 Team

${buildComplianceFooterText({ includeUnsubscribe: false })}
    `;

    const messageData = {
      from: fromEmail,
      to: email,
      subject,
      html: htmlContent,
      text: textContent,
      ...buildMailgunComplianceOptions({ tag: 'unsubscribe_confirmation' }),
    };

    const response = await mailgunClient.messages.create(mailgunDomain, messageData);

    if (!response || !response.id) {
      console.error('[Email] Failed to send unsubscribe confirmation email', response);
      logEmail({
        to_email: email,
        from_email: fromEmail,
        subject,
        email_type: 'unsubscribe_confirmation',
        status: 'failed',
        error_message: 'Mailgun returned no message ID',
      }).catch(() => {});
      return false;
    }

    logEmail({
      to_email: email,
      from_email: fromEmail,
      subject,
      email_type: 'unsubscribe_confirmation',
      status: 'sent',
      mailgun_message_id: response.id,
    }).catch(() => {});

    return true;
  } catch (error) {
    console.error('[Email] Error sending unsubscribe confirmation email', error);
    logEmail({
      to_email: email,
      from_email: fromEmail,
      subject,
      email_type: 'unsubscribe_confirmation',
      status: 'failed',
      error_message: error instanceof Error ? error.message : String(error),
    }).catch(() => {});
    return false;
  }
}
