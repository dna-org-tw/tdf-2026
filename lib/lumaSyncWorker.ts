import { supabaseServer } from '@/lib/supabaseServer';
import {
  fetchCalendarItems,
  fetchEventGuests,
  updateGuestStatus,
  LumaAuthError,
  type LumaCalendarItem,
  type LumaGuest,
} from '@/lib/lumaApi';
import { getDecryptedCookie, markCookieInvalid } from '@/lib/lumaSyncConfig';
import { sendCookieExpiredAlert } from '@/lib/luma-alert-email';
import {
  makeDecision,
  guestSortWeight,
  ticketWeight,
  type EventTicketType,
} from '@/lib/lumaAutoReview';

const SLEEP_MS_BETWEEN_EVENTS = 500;
const SLEEP_MS_BETWEEN_LUMA_WRITES = 300;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function db() {
  if (!supabaseServer) throw new Error('db_not_configured');
  return supabaseServer;
}

function mapCalendarItem(item: LumaCalendarItem) {
  const ev = item.event;
  return {
    event_api_id: ev.api_id,
    name: ev.name,
    start_at: ev.start_at,
    end_at: ev.end_at,
    url: ev.url,
    cover_url: ev.cover_url,
    location_text: ev.geo_address_json?.full_address ?? null,
    last_synced_at: new Date().toISOString(),
  };
}

interface MappedGuest {
  event_api_id: string;
  email: string;
  luma_guest_api_id: string | null;
  activity_status: string | null;
  paid: boolean;
  checked_in_at: string | null;
  registered_at: string | null;
  ticket_type_name: string | null;
  event_ticket_type_api_id: string | null;
  amount_cents: number | null;
  currency: string | null;
  last_synced_at: string;
}

function mapGuest(g: LumaGuest, eventApiId: string): MappedGuest | null {
  const email = (g.email ?? '').trim().toLowerCase();
  if (!email) return null;
  const ticket = g.event_tickets?.[0];
  const amountCents = typeof ticket?.amount === 'number' ? Math.round(ticket.amount) : null;
  const isFree = ticket?.event_ticket_type_info?.type === 'free' || amountCents === 0;
  return {
    event_api_id: eventApiId,
    email,
    luma_guest_api_id: g.api_id ?? null,
    activity_status: g.approval_status ?? g.registration_status ?? null,
    paid: ticket?.is_captured === true || (isFree && g.approval_status === 'approved'),
    checked_in_at: g.checked_in_at ?? null,
    registered_at: g.registered_at ?? null,
    ticket_type_name: ticket?.event_ticket_type_info?.name ?? null,
    event_ticket_type_api_id: ticket?.event_ticket_type_info?.api_id ?? null,
    amount_cents: amountCents,
    currency: ticket?.currency ?? null,
    last_synced_at: new Date().toISOString(),
  };
}

/**
 * Distinct ticket types in an event, derived from the guests we just fetched.
 * Ticket types with no existing guest cannot be the target of an upgrade this
 * run; they will become available once someone RSVPs for them.
 */
function collectEventTicketTypes(guests: MappedGuest[]): EventTicketType[] {
  const byApiId = new Map<string, EventTicketType>();
  for (const g of guests) {
    if (!g.event_ticket_type_api_id || !g.ticket_type_name) continue;
    if (byApiId.has(g.event_ticket_type_api_id)) continue;
    byApiId.set(g.event_ticket_type_api_id, {
      api_id: g.event_ticket_type_api_id,
      name: g.ticket_type_name,
      weight: ticketWeight(g.ticket_type_name),
    });
  }
  return [...byApiId.values()];
}

async function failJob(jobId: number, reason: string) {
  await db()
    .from('luma_sync_jobs')
    .update({
      status: 'failed',
      phase: 'done',
      finished_at: new Date().toISOString(),
      error_summary: reason,
    })
    .eq('id', jobId);
}

interface ReviewCounters {
  approved: number;
  waitlisted: number;
  skipped: number;
}

interface ProcessEventResult {
  guestsUpserted: number;
  guestsRemoved: number;
  reviewApproved: number;
  reviewWaitlisted: number;
  reviewSkipped: number;
}

/**
 * Fetch guests for an event from Luma, run the auto-review decision on every
 * guest (regardless of current status), push status changes back to Luma, and
 * upsert the (decided) row to the local mirror. Also reverse-syncs guests that
 * Luma no longer shows for this event.
 */
async function processEvent(
  jobId: number,
  eventApiId: string,
  cookie: string,
  noShowConsumedExtra: Map<string, number>,
): Promise<ProcessEventResult> {
  const eventCounters: ReviewCounters = { approved: 0, waitlisted: 0, skipped: 0 };
  const supa = db();
  const guests = await fetchEventGuests(eventApiId, cookie);
  const mapped = guests
    .map((g) => mapGuest(g, eventApiId))
    .filter((r): r is MappedGuest => r !== null);

  const eventTicketTypes = collectEventTicketTypes(mapped);

  // Process higher-tier tickets first so they claim capacity ahead of lower ones.
  mapped.sort(
    (a, b) => guestSortWeight(b.ticket_type_name) - guestSortWeight(a.ticket_type_name),
  );

  const reviewLogs: Array<{
    job_id: number;
    event_api_id: string;
    email: string;
    member_id: number | null;
    luma_guest_api_id: string | null;
    previous_status: string;
    new_status: string;
    reason: string;
    consumed_no_show_event_api_id: string | null;
  }> = [];

  for (const row of mapped) {
    try {
      const decision = await makeDecision(
        {
          email: row.email,
          event_api_id: eventApiId,
          ticket_type_name: row.ticket_type_name,
          current_ticket_type_api_id: row.event_ticket_type_api_id,
        },
        eventTicketTypes,
        noShowConsumedExtra,
      );

      const statusChanged = decision.status !== row.activity_status;
      const ticketUpgraded = !!decision.targetTicketTypeApiId;
      const mutated = statusChanged || ticketUpgraded;

      if (mutated) {
        if (row.luma_guest_api_id) {
          await updateGuestStatus(
            cookie,
            eventApiId,
            row.luma_guest_api_id,
            decision.status,
            decision.targetTicketTypeApiId ?? null,
          );
        }
        reviewLogs.push({
          job_id: jobId,
          event_api_id: eventApiId,
          email: row.email,
          member_id: null,
          luma_guest_api_id: row.luma_guest_api_id,
          previous_status: row.activity_status ?? 'unknown',
          new_status: decision.status,
          reason: decision.reason,
          consumed_no_show_event_api_id: decision.consumedNoShowEventApiId ?? null,
        });
        row.activity_status = decision.status;
        if (ticketUpgraded && decision.targetTicketTypeApiId) {
          row.event_ticket_type_api_id = decision.targetTicketTypeApiId;
          row.ticket_type_name = decision.targetTicketTypeName ?? row.ticket_type_name;
        }
        await sleep(SLEEP_MS_BETWEEN_LUMA_WRITES);
      }

      if (decision.status === 'approved') eventCounters.approved += 1;
      else eventCounters.waitlisted += 1;
    } catch (err) {
      if (err instanceof LumaAuthError) throw err;
      console.error(`[luma-sync] review skip ${row.email} @ ${eventApiId}:`, err);
      eventCounters.skipped += 1;
      // Fall through: row still gets upserted with its Luma-reported status.
    }
  }

  if (mapped.length > 0) {
    for (let i = 0; i < mapped.length; i += 200) {
      const slice = mapped.slice(i, i + 200);
      const { error } = await supa
        .from('luma_guests')
        .upsert(slice, { onConflict: 'event_api_id,email' });
      if (error) throw error;
    }
  }

  if (reviewLogs.length > 0) {
    const { error: logErr } = await supa.from('luma_review_log').insert(reviewLogs);
    if (logErr) throw logErr;
  }

  // Per-event reverse-sync: Luma is the source of truth. Any local guest for
  // this event whose email is not in the freshly-fetched Luma roster is a
  // ghost (cancelled/deleted on Luma side) — remove locally and audit.
  const lumaEmails = new Set(mapped.map((r) => r.email));
  const { data: localGuests, error: localErr } = await supa
    .from('luma_guests')
    .select('id, email, activity_status, luma_guest_api_id, member_id')
    .eq('event_api_id', eventApiId);
  if (localErr) throw localErr;

  const ghosts = (localGuests ?? []).filter(
    (g: { email: string }) => !lumaEmails.has(g.email),
  );

  if (ghosts.length > 0) {
    const ghostIds = ghosts.map((g: { id: number }) => g.id);
    const { error: logErr } = await supa.from('luma_review_log').insert(
      ghosts.map(
        (g: {
          email: string;
          activity_status: string | null;
          luma_guest_api_id: string | null;
          member_id: number | null;
        }) => ({
          job_id: jobId,
          event_api_id: eventApiId,
          email: g.email,
          member_id: g.member_id ?? null,
          luma_guest_api_id: g.luma_guest_api_id,
          previous_status: g.activity_status ?? 'unknown',
          new_status: 'removed',
          reason: 'removed:not_in_luma',
          consumed_no_show_event_api_id: null,
        }),
      ),
    );
    if (logErr) throw logErr;

    const { error: delErr } = await supa.from('luma_guests').delete().in('id', ghostIds);
    if (delErr) throw delErr;
  }

  return {
    guestsUpserted: mapped.length,
    guestsRemoved: ghosts.length,
    reviewApproved: eventCounters.approved,
    reviewWaitlisted: eventCounters.waitlisted,
    reviewSkipped: eventCounters.skipped,
  };
}

/**
 * Global orphan cleanup: after all events in the calendar have been processed,
 * any local guest whose event_api_id is no longer in the calendar is an orphan
 * (its event was deleted from Luma altogether). Delete + audit.
 */
async function cleanupOrphanEventGuests(
  jobId: number,
  validEventApiIds: string[],
): Promise<number> {
  if (validEventApiIds.length === 0) return 0;

  const supa = db();
  const { data: distinctRows, error: distinctErr } = await supa
    .from('luma_guests')
    .select('event_api_id');
  if (distinctErr) throw distinctErr;

  const localEventIds = new Set(
    (distinctRows ?? []).map((r: { event_api_id: string }) => r.event_api_id),
  );
  const validSet = new Set(validEventApiIds);
  const orphanEventIds = [...localEventIds].filter((id) => !validSet.has(id));
  if (orphanEventIds.length === 0) return 0;

  const { data: orphans, error: orphErr } = await supa
    .from('luma_guests')
    .select('id, email, event_api_id, activity_status, luma_guest_api_id, member_id')
    .in('event_api_id', orphanEventIds);
  if (orphErr) throw orphErr;

  if (!orphans || orphans.length === 0) return 0;

  const { error: logErr } = await supa.from('luma_review_log').insert(
    orphans.map(
      (g: {
        email: string;
        event_api_id: string;
        activity_status: string | null;
        luma_guest_api_id: string | null;
        member_id: number | null;
      }) => ({
        job_id: jobId,
        event_api_id: g.event_api_id,
        email: g.email,
        member_id: g.member_id ?? null,
        luma_guest_api_id: g.luma_guest_api_id,
        previous_status: g.activity_status ?? 'unknown',
        new_status: 'removed',
        reason: 'removed:event_not_in_luma',
        consumed_no_show_event_api_id: null,
      }),
    ),
  );
  if (logErr) throw logErr;

  const { error: delErr } = await supa
    .from('luma_guests')
    .delete()
    .in('event_api_id', orphanEventIds);
  if (delErr) throw delErr;

  return orphans.length;
}

export async function runSyncJob(jobId: number): Promise<void> {
  const supa = db();
  const startedAt = new Date().toISOString();
  await supa
    .from('luma_sync_jobs')
    .update({ status: 'running', phase: 'syncing', started_at: startedAt })
    .eq('id', jobId);

  let cookie: string | null = null;
  try {
    cookie = await getDecryptedCookie();
  } catch (err) {
    await failJob(jobId, `cookie_decrypt_failed: ${(err as Error).message}`);
    await sendCookieExpiredAlert('decryption failed');
    return;
  }
  if (!cookie) {
    await failJob(jobId, 'no_cookie_configured');
    return;
  }

  let items: LumaCalendarItem[];
  try {
    items = await fetchCalendarItems(cookie);
  } catch (err) {
    if (err instanceof LumaAuthError) {
      await markCookieInvalid();
      await sendCookieExpiredAlert(`get-items returned ${err.statusCode}`);
      await failJob(jobId, `cookie_invalid_${err.statusCode}`);
    } else {
      await failJob(jobId, `calendar_fetch_failed: ${(err as Error).message}`);
    }
    return;
  }

  if (items.length > 0) {
    const eventRows = items.map(mapCalendarItem);
    const { error } = await supa.from('luma_events').upsert(eventRows, { onConflict: 'event_api_id' });
    if (error) {
      await failJob(jobId, `events_upsert_failed: ${error.message}`);
      return;
    }
  }

  const totalEvents = items.length;
  await supa.from('luma_sync_jobs').update({ total_events: totalEvents }).eq('id', jobId);

  if (totalEvents > 0) {
    await supa.from('luma_sync_event_results').insert(
      items.map((it) => ({
        job_id: jobId,
        event_api_id: it.event.api_id,
        event_name: it.event.name,
        status: 'pending' as const,
      })),
    );
  }

  let processed = 0;
  let failed = 0;
  let totalGuestsUpserted = 0;
  let totalGuestsRemoved = 0;
  let cookieAuthFailure = false;

  const counters: ReviewCounters = { approved: 0, waitlisted: 0, skipped: 0 };
  const noShowConsumedExtra = new Map<string, number>();

  for (const item of items) {
    const eventApiId = item.event.api_id;

    await supa
      .from('luma_sync_event_results')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('job_id', jobId)
      .eq('event_api_id', eventApiId);

    try {
      const result = await processEvent(jobId, eventApiId, cookie, noShowConsumedExtra);
      totalGuestsUpserted += result.guestsUpserted;
      totalGuestsRemoved += result.guestsRemoved;
      counters.approved += result.reviewApproved;
      counters.waitlisted += result.reviewWaitlisted;
      counters.skipped += result.reviewSkipped;
      processed += 1;

      await supa
        .from('luma_sync_event_results')
        .update({
          status: 'done',
          guests_count: result.guestsUpserted,
          guests_removed: result.guestsRemoved,
          review_approved: result.reviewApproved,
          review_waitlisted: result.reviewWaitlisted,
          review_skipped: result.reviewSkipped,
          finished_at: new Date().toISOString(),
        })
        .eq('job_id', jobId)
        .eq('event_api_id', eventApiId);
    } catch (err) {
      failed += 1;
      const message = (err as Error).message ?? 'unknown';
      await supa
        .from('luma_sync_event_results')
        .update({
          status: 'failed',
          error_message: message,
          finished_at: new Date().toISOString(),
        })
        .eq('job_id', jobId)
        .eq('event_api_id', eventApiId);
      if (err instanceof LumaAuthError) {
        cookieAuthFailure = true;
        break;
      }
    }

    await supa
      .from('luma_sync_jobs')
      .update({
        processed_events: processed,
        failed_events: failed,
        total_guests_upserted: totalGuestsUpserted,
        total_guests_removed: totalGuestsRemoved,
        review_approved: counters.approved,
        review_waitlisted: counters.waitlisted,
        review_skipped: counters.skipped,
      })
      .eq('id', jobId);

    await sleep(SLEEP_MS_BETWEEN_EVENTS);
  }

  if (cookieAuthFailure) {
    await markCookieInvalid();
    await sendCookieExpiredAlert('Luma API returned 401/403 mid-job');
    await supa
      .from('luma_sync_jobs')
      .update({
        status: 'failed',
        phase: 'done',
        finished_at: new Date().toISOString(),
        error_summary: 'cookie_invalid_during_run',
        review_approved: counters.approved,
        review_waitlisted: counters.waitlisted,
        review_skipped: counters.skipped,
      })
      .eq('id', jobId);
    return;
  }

  // Global orphan cleanup: guests whose event no longer exists in Luma calendar.
  let orphanRemoved = 0;
  if (processed > 0 || failed === 0) {
    try {
      orphanRemoved = await cleanupOrphanEventGuests(
        jobId,
        items.map((it) => it.event.api_id),
      );
      totalGuestsRemoved += orphanRemoved;
    } catch (err) {
      const msg = (err as Error).message ?? 'unknown';
      console.error('[luma-sync] orphan cleanup failed:', msg);
      await supa
        .from('luma_sync_jobs')
        .update({ error_summary: `orphan_cleanup_failed: ${msg}` })
        .eq('id', jobId);
    }
  }

  const finalStatus = failed === 0 ? 'succeeded' : processed > 0 ? 'partial' : 'failed';

  await supa
    .from('luma_sync_jobs')
    .update({
      status: finalStatus,
      phase: 'done',
      finished_at: new Date().toISOString(),
      processed_events: processed,
      failed_events: failed,
      total_guests_upserted: totalGuestsUpserted,
      total_guests_removed: totalGuestsRemoved,
      review_approved: counters.approved,
      review_waitlisted: counters.waitlisted,
      review_skipped: counters.skipped,
    })
    .eq('id', jobId);
}
