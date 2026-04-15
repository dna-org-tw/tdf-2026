import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseServer } from '@/lib/supabaseServer';
import { addSuppression } from '@/lib/emailCompliance';

export const runtime = 'nodejs';

const signingKey =
  process.env.MAILGUN_WEBHOOK_SIGNING_KEY?.trim() ||
  process.env.MAILGUN_SIGNING_KEY?.trim() ||
  '';

/**
 * Mailgun webhook signature verification (HMAC-SHA256 of `timestamp+token`).
 * Uses timingSafeEqual to avoid leaking info via comparison timing.
 * Also rejects events older than 5 minutes to prevent replay attacks.
 */
function verifySignature(timestamp: string, token: string, signature: string): boolean {
  if (!signingKey || !timestamp || !token || !signature) return false;

  const tsInt = parseInt(timestamp, 10);
  if (!Number.isFinite(tsInt)) return false;
  const ageSec = Math.abs(Date.now() / 1000 - tsInt);
  if (ageSec > 300) return false; // 5 min replay window

  const expected = crypto
    .createHmac('sha256', signingKey)
    .update(timestamp + token)
    .digest('hex');

  const a = Buffer.from(signature, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

interface MailgunEventData {
  event?: string;
  severity?: string;
  reason?: string;
  recipient?: string;
  message?: { headers?: { 'message-id'?: string } };
  'user-variables'?: Record<string, unknown>;
  timestamp?: number;
  'delivery-status'?: { code?: number; description?: string; message?: string };
  tags?: string[];
}

interface MailgunPayload {
  signature?: { timestamp: string; token: string; signature: string };
  'event-data'?: MailgunEventData;
}

/**
 * Update the matching email_logs row by mailgun_message_id.
 */
async function updateLogRow(
  messageId: string | undefined,
  patch: Record<string, unknown>,
): Promise<void> {
  if (!supabaseServer || !messageId) return;
  const cleanId = messageId.replace(/^<|>$/g, '');
  const { error } = await supabaseServer
    .from('email_logs')
    .update(patch)
    .eq('mailgun_message_id', cleanId);
  if (error) {
    console.error('[MailgunWebhook] Failed to update email_logs:', error);
  }
}

/**
 * Mark the recipient's newsletter row as inactive so `members_enriched.status`
 * and `subscribed_newsletter` reflect reality — keeps the suppression list and
 * the subscription table in sync.
 */
async function syncNewsletterUnsubscribe(email: string): Promise<void> {
  if (!supabaseServer || !email) return;
  const { error } = await supabaseServer
    .from('newsletter_subscriptions')
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq('email', email)
    .is('unsubscribed_at', null);
  if (error) {
    console.error('[MailgunWebhook] Failed to sync newsletter_subscriptions:', error);
  }
}

async function incrementCounter(
  messageId: string | undefined,
  column: 'open_count' | 'click_count',
  timestampColumn: 'opened_at' | 'clicked_at',
): Promise<void> {
  if (!supabaseServer || !messageId) return;
  const cleanId = messageId.replace(/^<|>$/g, '');

  const { data, error: selErr } = await supabaseServer
    .from('email_logs')
    .select(`id, ${column}`)
    .eq('mailgun_message_id', cleanId)
    .limit(1);

  if (selErr || !data || data.length === 0) {
    if (selErr) console.error('[MailgunWebhook] Counter lookup failed:', selErr);
    return;
  }

  const row = data[0] as { id: string } & Record<string, number>;
  const current = (row[column] as number) ?? 0;
  const { error } = await supabaseServer
    .from('email_logs')
    .update({
      [column]: current + 1,
      [timestampColumn]: new Date().toISOString(),
    })
    .eq('id', row.id);
  if (error) console.error('[MailgunWebhook] Counter update failed:', error);
}

export async function POST(req: NextRequest) {
  if (!signingKey) {
    console.error('[MailgunWebhook] MAILGUN_WEBHOOK_SIGNING_KEY not configured');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  let payload: MailgunPayload;
  try {
    payload = (await req.json()) as MailgunPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const sig = payload.signature;
  if (!sig || !verifySignature(sig.timestamp, sig.token, sig.signature)) {
    console.warn('[MailgunWebhook] Invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const data = payload['event-data'];
  if (!data) {
    return NextResponse.json({ ok: true, skipped: 'no event-data' });
  }

  const event = data.event;
  const recipient = data.recipient?.trim().toLowerCase() ?? '';
  const messageId = data.message?.headers?.['message-id'];
  const eventTs = data.timestamp
    ? new Date(data.timestamp * 1000).toISOString()
    : new Date().toISOString();

  try {
    switch (event) {
      case 'delivered':
        await updateLogRow(messageId, { delivered_at: eventTs });
        break;

      case 'opened':
        await incrementCounter(messageId, 'open_count', 'opened_at');
        break;

      case 'clicked':
        await incrementCounter(messageId, 'click_count', 'clicked_at');
        break;

      case 'complained':
        // Spam complaint — hardest signal to hit; suppress immediately and
        // mark the newsletter row inactive too.
        if (recipient) {
          await addSuppression(recipient, 'complained', 'mailgun_webhook', {
            message_id: messageId,
            tags: data.tags,
          });
          await syncNewsletterUnsubscribe(recipient);
        }
        await updateLogRow(messageId, { complained_at: eventTs });
        break;

      case 'unsubscribed':
        // User clicked a Mailgun-tracked unsubscribe link — mirror the opt-out
        // into newsletter_subscriptions so the admin UI status matches reality.
        if (recipient) {
          await addSuppression(recipient, 'unsubscribed', 'mailgun_webhook', {
            message_id: messageId,
          });
          await syncNewsletterUnsubscribe(recipient);
        }
        await updateLogRow(messageId, { unsubscribed_at: eventTs });
        break;

      case 'failed': {
        // `severity: permanent` = hard bounce → suppress.
        // `severity: temporary` = soft bounce → log but keep sending.
        const severity = data.severity ?? 'temporary';
        const bounceType = severity === 'permanent' ? 'hard' : 'soft';
        await updateLogRow(messageId, {
          status: 'failed',
          bounced_at: eventTs,
          bounce_type: bounceType,
          error_message:
            data['delivery-status']?.message ||
            data['delivery-status']?.description ||
            data.reason ||
            null,
        });
        if (severity === 'permanent' && recipient) {
          // Hard bounce: address is dead. Suppress AND deactivate the
          // newsletter row so we stop counting it as an active subscriber.
          await addSuppression(recipient, 'bounced', 'mailgun_webhook', {
            message_id: messageId,
            reason: data.reason,
            delivery_status: data['delivery-status'],
          });
          await syncNewsletterUnsubscribe(recipient);
        }
        break;
      }

      case 'rejected':
        await updateLogRow(messageId, {
          status: 'failed',
          error_message: data.reason ?? 'rejected',
        });
        break;

      default:
        // Other events (accepted, stored, etc.) — no-op.
        break;
    }
  } catch (err) {
    console.error(`[MailgunWebhook] Handler error for event=${event}:`, err);
    // Return 200 anyway — Mailgun retries on non-2xx and a DB blip shouldn't
    // cause endless replays. We've already logged the error.
  }

  return NextResponse.json({ ok: true });
}
