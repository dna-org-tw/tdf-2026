import formData from 'form-data';
import Mailgun from 'mailgun.js';
import { marked } from 'marked';
import { supabaseServer } from '@/lib/supabaseServer';
import {
  buildComplianceFooterHtml,
  buildComplianceFooterText,
  buildMailgunComplianceOptions,
  filterSuppressed,
} from '@/lib/emailCompliance';

// GFM + single-newline → <br> matches what admins expect when composing in
// the /admin/send textarea. Sync mode so buildHtml can stay non-async.
const MARKED_OPTIONS = { gfm: true, breaks: true, async: false } as const;

const mailgunApiKey = process.env.MAILGUN_API_KEY;
const mailgunDomain = process.env.MAILGUN_DOMAIN;
const fromRaw = process.env.EMAIL_FROM || `noreply@${mailgunDomain || 'example.com'}`;
const fromEmail = fromRaw.includes('<') ? fromRaw : `Taiwan Digital Fest <${fromRaw}>`;
const replyToEmail = process.env.EMAIL_REPLY_TO || 'fest@dna.org.tw';

const mailgunClient = mailgunApiKey && mailgunDomain
  ? new Mailgun(formData).client({ username: 'api', key: mailgunApiKey })
  : null;

export type BodyFormat = 'plain' | 'html';

function buildHtml(
  body: string,
  subject: string,
  recipientEmail: string,
  criticalNotice: boolean,
): string {
  // Markdown → HTML. Admin-authored content, so raw HTML passthrough is OK
  // (they can already switch body_format='html' for full control).
  const bodyHtml = marked.parse(body, MARKED_OPTIONS) as string;

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
  ${buildComplianceFooterHtml({ email: recipientEmail, criticalNotice })}
</body>
</html>`;
}

/**
 * For raw-HTML sends: append the compliance footer (unsubscribe + physical
 * address — required by Gmail/Yahoo bulk-sender rules + CAN-SPAM) immediately
 * before the closing </body> tag. Falls back to bare append if the body has
 * no </body> (still produces a deliverable email).
 */
function injectComplianceFooter(
  rawHtml: string,
  recipientEmail: string,
  criticalNotice: boolean,
): string {
  const footer = buildComplianceFooterHtml({ email: recipientEmail, criticalNotice });
  const closingBody = /<\/body\s*>/i;
  if (closingBody.test(rawHtml)) {
    return rawHtml.replace(closingBody, `${footer}\n</body>`);
  }
  return `${rawHtml}\n${footer}`;
}

/**
 * Best-effort HTML → plain-text conversion for the multipart `text/plain`
 * fallback. Mailgun deliverability scoring rewards multipart messages, so we
 * always include some plain text even for HTML sends. This is intentionally
 * simple — admins shouldn't rely on this for content fidelity.
 */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(br|hr)\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article|header|footer)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildPlainText(body: string, recipientEmail: string, criticalNotice: boolean): string {
  return `Taiwan Digital Fest 2026\n\n${body}\n\nBest regards,\nTaiwan Digital Fest 2026 Team\n\n${buildComplianceFooterText({ email: recipientEmail, criticalNotice })}`;
}

function buildPlainTextFromHtml(
  rawHtml: string,
  recipientEmail: string,
  criticalNotice: boolean,
): string {
  const stripped = htmlToPlainText(rawHtml);
  return `${stripped}\n\n${buildComplianceFooterText({ email: recipientEmail, criticalNotice })}`;
}

// Mailgun Basic 10k plan: ~1 msg/sec is safe; back off on 429 with exponential retry.
const SEND_INTERVAL_MS = 1000;
const RATE_LIMIT_BACKOFF_BASE_MS = 30_000;
const RATE_LIMIT_BACKOFF_MAX_MS = 300_000; // cap at 5 minutes

/** Exponential backoff: 30s, 60s, 120s, 240s, 300s (capped). */
function computeBackoff(attempt: number): number {
  return Math.min(RATE_LIMIT_BACKOFF_BASE_MS * 2 ** attempt, RATE_LIMIT_BACKOFF_MAX_MS);
}

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
  opts: { category?: 'newsletter' | 'events' | 'award' | 'critical' } = {},
): Promise<{ queued: number; suppressed: number }> {
  if (!supabaseServer) throw new Error('Database not configured');

  // Remove addresses on the suppression list before enqueueing — never send to
  // bounced/complained recipients. For `critical` (履約必要通知) we still honor
  // hard deliverability suppressions but allow `unsubscribed` addresses through.
  const { allowed, suppressed } = await filterSuppressed(emails, {
    allowUnsubscribed: opts.category === 'critical',
  });

  if (allowed.length === 0) {
    return { queued: 0, suppressed: suppressed.length };
  }

  const rows = allowed.map((email) => ({
    to_email: email,
    from_email: fromEmail,
    subject,
    email_type: 'notification' as const,
    status: 'pending' as const,
    notification_id: notificationId,
  }));

  const { error } = await supabaseServer.from('email_logs').insert(rows);
  if (error) throw error;

  return { queued: rows.length, suppressed: suppressed.length };
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

  // Get notification body + format + category for HTML building
  const { data: notif } = await supabaseServer
    .from('notification_logs')
    .select('subject, body, body_format, category')
    .eq('id', notificationId)
    .single();

  const subject = notif?.subject ?? pending[0].subject ?? '';
  const body = notif?.body ?? '';
  const bodyFormat: BodyFormat = notif?.body_format === 'html' ? 'html' : 'plain';
  const isCritical = notif?.category === 'critical';

  let sent = 0;
  let failed = 0;
  let rateLimitAttempt = 0;

  for (let idx = 0; idx < pending.length; idx++) {
    const email = pending[idx];

    // Throttle: wait between sends to respect Mailgun rate limits
    if (idx > 0) await sleep(SEND_INTERVAL_MS);

    // Per-recipient body so each email gets its own unsubscribe link (or,
    // for critical, the fixed "履約必要通知" footer with no unsubscribe).
    const html = bodyFormat === 'html'
      ? injectComplianceFooter(body, email.to_email, isCritical)
      : buildHtml(body, subject, email.to_email, isCritical);
    const text = bodyFormat === 'html'
      ? buildPlainTextFromHtml(body, email.to_email, isCritical)
      : buildPlainText(body, email.to_email, isCritical);

    try {
      const response = await mailgunClient.messages.create(mailgunDomain, {
        from: fromEmail,
        to: [email.to_email],
        subject,
        html,
        text,
        ...buildMailgunComplianceOptions({
          // Critical sends omit List-Unsubscribe so Gmail/Yahoo clients don't
          // render their built-in one-click unsubscribe button — that would
          // contradict the "無法取消訂閱" semantic of履約必要通知.
          unsubscribeEmail: isCritical ? undefined : email.to_email,
          replyTo: replyToEmail,
          tag: isCritical ? 'notification-critical' : 'notification',
        }),
      });
      rateLimitAttempt = 0; // reset on success

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

      // Back off on 429 rate limit — revert to pending so it gets retried next batch.
      // Use exponential backoff (30s, 60s, 120s, 240s, 300s cap) per consecutive rate-limit hit.
      if (mgError.status === 429) {
        const backoff = computeBackoff(rateLimitAttempt);
        rateLimitAttempt += 1;
        console.warn(`[NotificationEmail] Rate limited (attempt ${rateLimitAttempt}), backing off ${backoff}ms`);
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
        await sleep(backoff);
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
