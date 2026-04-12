import formData from 'form-data';
import Mailgun from 'mailgun.js';
import { supabaseServer } from '@/lib/supabaseServer';

const mailgunApiKey = process.env.MAILGUN_API_KEY;
const mailgunDomain = process.env.MAILGUN_DOMAIN;
const fromEmail = process.env.EMAIL_FROM || `noreply@${mailgunDomain || 'example.com'}`;

const mailgunClient = mailgunApiKey && mailgunDomain
  ? new Mailgun(formData).client({ username: 'api', key: mailgunApiKey })
  : null;

const BATCH_SIZE = 1000;

function buildHtml(body: string, subject: string): string {
  const bodyHtml = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

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
    <h2 style="color: #10B8D9; margin-top: 0;">${subject}</h2>
    <div style="color: #333; font-size: 16px;">${bodyHtml}</div>
    <p style="color: #666; font-size: 14px; margin-top: 30px;">
      Best regards,<br>
      Taiwan Digital Fest 2026 Team
    </p>
  </div>
  <div style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
    <p>This is an automated email from Taiwan Digital Fest 2026.</p>
  </div>
</body>
</html>`;
}

function buildPlainText(body: string): string {
  return `Taiwan Digital Fest 2026\n\n${body}\n\nBest regards,\nTaiwan Digital Fest 2026 Team`;
}

interface BatchSendResult {
  success: boolean;
  totalSent: number;
  error?: string;
}

export async function sendBatchNotification(
  emails: string[],
  subject: string,
  body: string,
  notificationId: string
): Promise<BatchSendResult> {
  if (!mailgunClient || !mailgunDomain) {
    return { success: false, totalSent: 0, error: 'Mailgun not configured' };
  }

  const html = buildHtml(body, subject);
  const text = buildPlainText(body);
  let totalSent = 0;

  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE);

    try {
      await mailgunClient.messages.create(mailgunDomain, {
        from: fromEmail,
        to: batch,
        subject,
        html,
        text,
      });
      totalSent += batch.length;
    } catch (error) {
      console.error(`[NotificationEmail] Batch ${i / BATCH_SIZE + 1} failed:`, error);

      if (supabaseServer) {
        await supabaseServer
          .from('notification_logs')
          .update({
            status: 'partial_failure',
            error_message: error instanceof Error ? error.message : String(error),
          })
          .eq('id', notificationId);
      }

      return {
        success: false,
        totalSent,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return { success: true, totalSent };
}
