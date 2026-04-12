import formData from 'form-data';
import Mailgun from 'mailgun.js';
import { supabaseServer } from '@/lib/supabaseServer';

const mailgunApiKey = process.env.MAILGUN_API_KEY;
const mailgunDomain = process.env.MAILGUN_DOMAIN;
const fromRaw = process.env.EMAIL_FROM || `noreply@${mailgunDomain || 'example.com'}`;
const fromEmail = fromRaw.includes('<') ? fromRaw : `Taiwan Digital Fest <${fromRaw}>`;
const replyToEmail = process.env.EMAIL_REPLY_TO || 'fest@dna.org.tw';

const mailgunClient = mailgunApiKey && mailgunDomain
  ? new Mailgun(formData).client({ username: 'api', key: mailgunApiKey })
  : null;

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

// Mailgun Basic 10k plan: ~1 msg/sec is safe; back off on 429
const SEND_INTERVAL_MS = 1000;
const RATE_LIMIT_BACKOFF_MS = 60_000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function formatMailgunError(error: unknown): string {
  const mgError = error as { status?: number; message?: string; details?: string; type?: string };
  const parts = [
    mgError.status ? `HTTP ${mgError.status}` : null,
    mgError.message || null,
    mgError.details && mgError.details !== mgError.message ? `details: ${mgError.details}` : null,
    mgError.type ? `(${mgError.type})` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' — ') : String(error);
}

// ---------------------------------------------------------------------------
// Enqueue: insert all recipients as 'pending' into email_logs
// ---------------------------------------------------------------------------
export async function enqueueEmails(
  emails: string[],
  subject: string,
  notificationId: string,
): Promise<{ queued: number }> {
  if (!supabaseServer) throw new Error('Database not configured');

  const rows = emails.map((email) => ({
    to_email: email,
    from_email: fromEmail,
    subject,
    email_type: 'notification' as const,
    status: 'pending' as const,
    notification_id: notificationId,
  }));

  const { error } = await supabaseServer.from('email_logs').insert(rows);
  if (error) throw error;

  return { queued: rows.length };
}

// ---------------------------------------------------------------------------
// Process queue: pick up pending emails and send them one by one
// ---------------------------------------------------------------------------
export interface ProcessResult {
  processed: number;
  sent: number;
  failed: number;
  remaining: number;
}

export async function processQueueBatch(
  notificationId: string,
  batchSize = 5,
): Promise<ProcessResult> {
  if (!supabaseServer) throw new Error('Database not configured');
  if (!mailgunClient || !mailgunDomain) throw new Error('Mailgun not configured');

  // Fetch pending emails
  const { data: pending, error: fetchErr } = await supabaseServer
    .from('email_logs')
    .select('id, to_email, subject')
    .eq('notification_id', notificationId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(batchSize);

  if (fetchErr) throw fetchErr;
  if (!pending || pending.length === 0) {
    // Count remaining to confirm
    const { count } = await supabaseServer
      .from('email_logs')
      .select('id', { count: 'exact', head: true })
      .eq('notification_id', notificationId)
      .eq('status', 'pending');
    return { processed: 0, sent: 0, failed: 0, remaining: count ?? 0 };
  }

  // Mark as processing
  const ids = pending.map((e) => e.id);
  await supabaseServer
    .from('email_logs')
    .update({ status: 'processing' })
    .in('id', ids);

  // Get notification body for HTML building
  const { data: notif } = await supabaseServer
    .from('notification_logs')
    .select('subject, body')
    .eq('id', notificationId)
    .single();

  const subject = notif?.subject ?? pending[0].subject ?? '';
  const html = buildHtml(notif?.body ?? '', subject);
  const text = buildPlainText(notif?.body ?? '');

  let sent = 0;
  let failed = 0;

  for (let idx = 0; idx < pending.length; idx++) {
    const email = pending[idx];

    // Throttle: wait between sends to respect Mailgun rate limits
    if (idx > 0) await sleep(SEND_INTERVAL_MS);

    try {
      const response = await mailgunClient.messages.create(mailgunDomain, {
        from: fromEmail,
        to: [email.to_email],
        subject,
        html,
        text,
        'h:Reply-To': replyToEmail,
      });

      await supabaseServer
        .from('email_logs')
        .update({
          status: 'sent',
          mailgun_message_id: response.id || null,
          error_message: null,
        })
        .eq('id', email.id);

      sent++;
    } catch (error) {
      const mgError = error as { status?: number };

      // Back off on 429 rate limit — revert to pending so it gets retried next batch
      if (mgError.status === 429) {
        console.warn(`[NotificationEmail] Rate limited, backing off ${RATE_LIMIT_BACKOFF_MS}ms`);
        await supabaseServer
          .from('email_logs')
          .update({ status: 'pending' })
          .eq('id', email.id);
        // Also revert any remaining in this batch
        for (let j = idx + 1; j < pending.length; j++) {
          await supabaseServer
            .from('email_logs')
            .update({ status: 'pending' })
            .eq('id', pending[j].id);
        }
        await sleep(RATE_LIMIT_BACKOFF_MS);
        break;
      }

      const errMsg = formatMailgunError(error);

      await supabaseServer
        .from('email_logs')
        .update({
          status: 'failed',
          error_message: errMsg,
        })
        .eq('id', email.id);

      console.error(`[NotificationEmail] Failed to send to ${email.to_email}:`, error);
      failed++;
    }
  }

  // Update notification_logs counts
  const { data: counts } = await supabaseServer
    .from('email_logs')
    .select('status')
    .eq('notification_id', notificationId);

  if (counts) {
    const successCount = counts.filter((c) => c.status === 'sent').length;
    const failureCount = counts.filter((c) => c.status === 'failed').length;
    const pendingCount = counts.filter((c) => c.status === 'pending' || c.status === 'processing').length;

    await supabaseServer
      .from('notification_logs')
      .update({
        success_count: successCount,
        failure_count: failureCount,
        status: pendingCount > 0 ? 'sending' : (failureCount > 0 ? 'partial_failure' : 'sent'),
      })
      .eq('id', notificationId);

    return { processed: pending.length, sent, failed, remaining: pendingCount };
  }

  return { processed: pending.length, sent, failed, remaining: 0 };
}

// ---------------------------------------------------------------------------
// Process all: loop through entire queue until no pending emails remain
// Fire-and-forget from API routes — runs independently of the HTTP response
// ---------------------------------------------------------------------------
export async function processAllPending(notificationId: string): Promise<void> {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const result = await processQueueBatch(notificationId, 5);
      if (result.remaining === 0) break;
    } catch (error) {
      console.error(`[NotificationEmail] processAllPending error for ${notificationId}:`, error);
      // Wait a bit before retrying on unexpected errors
      await new Promise((r) => setTimeout(r, 2000));

      // Check if there are still pending — if not, stop
      if (!supabaseServer) break;
      const { count } = await supabaseServer
        .from('email_logs')
        .select('id', { count: 'exact', head: true })
        .eq('notification_id', notificationId)
        .in('status', ['pending', 'processing']);
      if (!count || count === 0) break;
    }
  }
}

// ---------------------------------------------------------------------------
// Retry: reset failed emails back to pending
// ---------------------------------------------------------------------------
export async function retryFailedEmails(
  notificationId: string,
): Promise<{ retried: number }> {
  if (!supabaseServer) throw new Error('Database not configured');

  const { data, error } = await supabaseServer
    .from('email_logs')
    .update({ status: 'pending', error_message: null })
    .eq('notification_id', notificationId)
    .eq('status', 'failed')
    .select('id');

  if (error) throw error;

  const retried = data?.length ?? 0;

  if (retried > 0) {
    // Reset notification status back to sending
    await supabaseServer
      .from('notification_logs')
      .update({ status: 'sending', error_message: null })
      .eq('id', notificationId);
  }

  return { retried };
}
