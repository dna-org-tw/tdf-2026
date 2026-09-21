import formData from 'form-data';
import Mailgun from 'mailgun.js';

const apiKey = process.env.MAILGUN_API_KEY;
const domain = process.env.MAILGUN_DOMAIN;
const fromRaw = process.env.EMAIL_FROM || `noreply@${domain || 'example.com'}`;
const from = fromRaw.includes('<') ? fromRaw : `Taiwan Digital Fest <${fromRaw}>`;
const alertTo = process.env.ADMIN_ALERT_EMAIL;

const client = apiKey && domain
  ? new Mailgun(formData).client({ username: 'api', key: apiKey })
  : null;

export async function sendCookieExpiredAlert(detail: string): Promise<void> {
  if (!client || !domain || !alertTo) {
    console.warn('[luma-sync] cookie alert email skipped: mailgun or ADMIN_ALERT_EMAIL not configured');
    return;
  }
  try {
    await client.messages.create(domain, {
      from,
      to: alertTo,
      subject: '[TDF Admin] Luma session cookie expired',
      text:
        `Luma sync failed because the stored session cookie is no longer valid.\n\n` +
        `Detail: ${detail}\n\n` +
        `Please update the cookie at /admin/luma-sync.`,
    });
  } catch (e) {
    console.error('[luma-sync] failed to send cookie alert email', e);
  }
}
