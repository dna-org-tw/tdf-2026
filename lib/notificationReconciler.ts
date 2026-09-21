import { supabaseServer } from '@/lib/supabaseServer';
import { processAllPending } from '@/lib/notificationEmail';

/**
 * A notification whose row hasn't been touched for this long is assumed to
 * have lost its sender process. Sized above the max Mailgun 429 backoff
 * (5 min, see notificationEmail.RATE_LIMIT_BACKOFF_MAX_MS) so a drainer
 * legitimately sleeping through a rate-limit never gets false-positive'd
 * and racing a second drainer.
 *
 * Also covers rolling-deploy overlap by a wide margin (Zeabur SIGTERM grace
 * is ~30s). If old and new workers ran concurrently on the same pending
 * rows they would double-send.
 */
const STALE_THRESHOLD_MS = 6 * 60_000;

interface StalledNotification {
  id: string;
  pending: number;
  processing: number;
}

async function findStalledNotifications(): Promise<StalledNotification[]> {
  if (!supabaseServer) return [];
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString();

  const { data: rows, error } = await supabaseServer
    .from('notification_logs')
    .select('id')
    .eq('status', 'sending')
    .lt('updated_at', cutoff);
  if (error || !rows || rows.length === 0) return [];

  // Parallel count of pending/processing per candidate. Small N (admins don't
  // typically have many stuck notifications) so N round-trips is fine.
  const results: StalledNotification[] = [];
  for (const row of rows) {
    const { count: pending } = await supabaseServer
      .from('email_logs')
      .select('id', { count: 'exact', head: true })
      .eq('notification_id', row.id)
      .eq('status', 'pending');
    const { count: processing } = await supabaseServer
      .from('email_logs')
      .select('id', { count: 'exact', head: true })
      .eq('notification_id', row.id)
      .eq('status', 'processing');
    if ((pending ?? 0) + (processing ?? 0) > 0) {
      results.push({ id: row.id, pending: pending ?? 0, processing: processing ?? 0 });
    }
  }
  return results;
}

/**
 * Re-kick the drainer for any batch-send whose sender went away mid-flight.
 * Called on process boot (instrumentation.ts) and from the /api/cron/notification-resume
 * endpoint as a periodic safety net.
 *
 * Processing rows from the abandoned run are reset to pending so the drainer
 * picks them up. Any still-alive sender will already have moved its rows to
 * 'sent' or 'failed' — we only revert rows that are older than the stale
 * threshold, so an active batch won't be disturbed.
 */
export async function resumeStalledNotifications(): Promise<number> {
  if (!supabaseServer) return 0;
  const stalled = await findStalledNotifications();
  if (stalled.length === 0) return 0;

  for (const notif of stalled) {
    try {
      if (notif.processing > 0) {
        await supabaseServer
          .from('email_logs')
          .update({ status: 'pending' })
          .eq('notification_id', notif.id)
          .eq('status', 'processing');
      }
      // Bump notification updated_at so a concurrent reconciler (another
      // instance booting in parallel) skips this one via the staleness check.
      await supabaseServer
        .from('notification_logs')
        .update({ status: 'sending', error_message: null })
        .eq('id', notif.id);
      console.warn(
        `[notification-reconciler] resuming ${notif.id} (pending=${notif.pending}, processing=${notif.processing})`,
      );
      // Fire-and-forget. If the process dies again, the next reconciler run
      // will pick it up.
      processAllPending(notif.id).catch((err) =>
        console.error(`[notification-reconciler] drainer crashed for ${notif.id}:`, err),
      );
    } catch (err) {
      console.error(`[notification-reconciler] failed to resume ${notif.id}:`, err);
    }
  }
  return stalled.length;
}
