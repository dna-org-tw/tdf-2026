import { supabaseServer } from '@/lib/supabaseServer';
import {
  fetchCalendarItems,
  fetchEventDetail,
  fetchEventGuests,
  updateGuestStatus,
  updateGuestTicketType,
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
  skipped: boolean;
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
  logRawDetail: boolean,
): Promise<ProcessEventResult> {
  const eventCounters: ReviewCounters = { approved: 0, waitlisted: 0, skipped: 0 };
  const supa = db();
  const guests = await fetchEventGuests(eventApiId, cookie);
  const mapped = guests
    .map((g) => mapGuest(g, eventApiId))
    .filter((r): r is MappedGuest => r !== null);

  const eventTicketTypes = collectEventTicketTypes(mapped);

  // If the event has no TDF ticket type among the fetched guests, skip it
  // entirely: no upsert, no review, no reverse-sync. These are events outside
  // the TDF flow (or with latent-only TDF tickets that no one has RSVP'd yet)
  // and should not be mirrored locally.
  const hasTdfTicket = eventTicketTypes.some((t) => t.weight > 0);
  if (!hasTdfTicket) {
    return {
      guestsUpserted: 0,
      guestsRemoved: 0,
      reviewApproved: 0,
      reviewWaitlisted: 0,
      reviewSkipped: 0,
      skipped: true,
    };
  }

  // Capacity check: fetch event detail to obtain max attendee cap. Failure
  // here downgrades to "no capacity enforcement" rather than failing the
  // event — partial protection is better than blocking a whole sync run.
  let eventCapacity: number | null = null;
  try {
    const detail = await fetchEventDetail(eventApiId, cookie);
    eventCapacity = detail.capacity;
    if (logRawDetail) {
      const rawKeys =
        detail.raw && typeof detail.raw === 'object' && !Array.isArray(detail.raw)
          ? Object.keys(detail.raw as Record<string, unknown>).join(',')
          : 'non-object';
      const eventKeys =
        detail.raw &&
        typeof detail.raw === 'object' &&
        'event' in (detail.raw as Record<string, unknown>) &&
        typeof (detail.raw as { event?: unknown }).event === 'object' &&
        (detail.raw as { event?: unknown }).event !== null
          ? Object.keys((detail.raw as { event: Record<string, unknown> }).event).join(',')
          : 'no-event-object';
      console.info(
        `[luma-sync] event-detail probe ${eventApiId}: capacity=${eventCapacity ?? 'null'} via=${detail.capacityField ?? 'no-field'} top=[${rawKeys}] event=[${eventKeys}]`,
      );
    } else {
      console.info(
        `[luma-sync] capacity ${eventApiId} = ${eventCapacity ?? 'null'} (${detail.capacityField ?? 'no-field'})`,
      );
    }
    const { error: capUpdErr } = await supa
      .from('luma_events')
      .update({ capacity: eventCapacity, last_capacity_synced_at: new Date().toISOString() })
      .eq('event_api_id', eventApiId);
    if (capUpdErr) {
      // Most likely cause: add_luma_event_capacity.sql migration not applied
      // yet. Capacity enforcement still works in-memory for this run.
      console.warn(
        `[luma-sync] persist capacity failed ${eventApiId}: ${capUpdErr.message} (in-memory enforcement still active)`,
      );
    }
  } catch (err) {
    if (err instanceof LumaAuthError) throw err;
    console.warn(
      `[luma-sync] event-detail fetch failed ${eventApiId} (${(err as Error).message}); proceeding without capacity enforcement`,
    );
  }

  // Sort: already-approved first (they hold their slot), then higher-tier
  // tickets (so high-tier members claim remaining capacity ahead of lower
  // tiers among the not-yet-approved).
  mapped.sort((a, b) => {
    const aApproved = a.activity_status === 'approved' ? 1 : 0;
    const bApproved = b.activity_status === 'approved' ? 1 : 0;
    if (aApproved !== bApproved) return bApproved - aApproved;
    return guestSortWeight(b.ticket_type_name) - guestSortWeight(a.ticket_type_name);
  });

  let approvedCount = 0;

  // Allowlist: only these statuses are subject to auto-review. Anything else
  // (declined/invited/not_going/cancelled/unknown) is preserved untouched —
  // we never push 'approved' or 'waitlist' to Luma for guests already in a
  // terminal/external-decision state. null is allowed (newly-added rows with
  // no Luma-reported status yet behave like fresh applications).
  const REVIEWABLE_STATUSES: ReadonlySet<string> = new Set([
    'approved',
    'waitlist',
    'pending_approval',
  ]);
  // Statuses we skip silently (frequent, expected). Anything else triggers
  // a one-line warn so we notice if Luma adds a new state we should handle.
  const SILENT_SKIP_STATUSES: ReadonlySet<string> = new Set(['declined', 'invited']);

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
    // Allowlist gate: never re-evaluate guests outside reviewable states.
    // Covers 'declined' (admin manual / member self-cancel), 'invited' (Luma
    // admin invite pending response), and any unknown future state Luma may
    // introduce (e.g. 'not_going' via registration_status fallback). These
    // do not run makeDecision, do not write to Luma, do not write a log
    // entry, and do not consume capacity.
    if (row.activity_status !== null && !REVIEWABLE_STATUSES.has(row.activity_status)) {
      if (!SILENT_SKIP_STATUSES.has(row.activity_status)) {
        console.warn(
          `[luma-sync] preserving non-reviewable status '${row.activity_status}' for ${row.email} @${eventApiId}`,
        );
      }
      continue;
    }

    try {
      let decision = await makeDecision(
        {
          email: row.email,
          event_api_id: eventApiId,
          ticket_type_name: row.ticket_type_name,
          current_ticket_type_api_id: row.event_ticket_type_api_id,
        },
        eventTicketTypes,
        noShowConsumedExtra,
      );

      // Capacity gate: cap NEW approvals at eventCapacity. Existing approvals
      // keep their slot (they were already in) but still count toward the cap;
      // we never demote already-approved guests purely because the cap is full.
      if (decision.status === 'approved') {
        const wasApproved = row.activity_status === 'approved';
        if (eventCapacity !== null && approvedCount >= eventCapacity && !wasApproved) {
          decision = { status: 'waitlist', reason: 'waitlist:capacity_full' };
        } else {
          approvedCount += 1;
        }
      }

      const statusChanged = decision.status !== row.activity_status;
      const ticketUpgraded = !!decision.targetTicketTypeApiId;
      const mutated = statusChanged || ticketUpgraded;

      if (mutated) {
        if (row.luma_guest_api_id) {
          // Status and ticket type live on two separate Luma endpoints.
          // Update status first (admins expect status-first semantics), then
          // reassign ticket type. Either can be skipped independently.
          if (statusChanged) {
            await updateGuestStatus(cookie, eventApiId, row.luma_guest_api_id, decision.status);
            await sleep(SLEEP_MS_BETWEEN_LUMA_WRITES);
          }
          if (ticketUpgraded && decision.targetTicketTypeApiId) {
            await updateGuestTicketType(
              cookie,
              eventApiId,
              row.luma_guest_api_id,
              decision.targetTicketTypeApiId,
            );
            await sleep(SLEEP_MS_BETWEEN_LUMA_WRITES);
          }
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
    skipped: false,
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
  let cancelled = false;
  let abandoned = false;

  const counters: ReviewCounters = { approved: 0, waitlisted: 0, skipped: 0 };
  const noShowConsumedExtra = new Map<string, number>();
  let rawDetailLogged = false;

  for (const item of items) {
    const eventApiId = item.event.api_id;

    // Poll for external state changes at each event boundary:
    //   - cancel_requested_at: admin pressed "取消" → finalize as cancelled
    //   - status !== 'running': another process (reconciler, parallel worker)
    //     already finalized this job; exit silently to avoid overwriting.
    const { data: checkRow } = await supa
      .from('luma_sync_jobs')
      .select('cancel_requested_at, status')
      .eq('id', jobId)
      .single();
    if (checkRow && checkRow.status !== 'running') {
      abandoned = true;
      break;
    }
    if (checkRow?.cancel_requested_at) {
      cancelled = true;
      break;
    }

    await supa
      .from('luma_sync_event_results')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('job_id', jobId)
      .eq('event_api_id', eventApiId);

    try {
      // First event of the run that actually probes the detail endpoint logs
      // the raw payload shape so we can verify which Luma field carries
      // capacity. processEvent flips the flag on success.
      const result = await processEvent(
        jobId,
        eventApiId,
        cookie,
        noShowConsumedExtra,
        !rawDetailLogged,
      );
      if (!result.skipped) rawDetailLogged = true;
      totalGuestsUpserted += result.guestsUpserted;
      totalGuestsRemoved += result.guestsRemoved;
      counters.approved += result.reviewApproved;
      counters.waitlisted += result.reviewWaitlisted;
      counters.skipped += result.reviewSkipped;
      processed += 1;

      await supa
        .from('luma_sync_event_results')
        .update({
          status: result.skipped ? 'skipped' : 'done',
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

  if (abandoned) {
    console.warn(`[luma-sync] job ${jobId} was finalized externally; worker exiting without overwriting status`);
    return;
  }

  if (cancelled) {
    await supa
      .from('luma_sync_jobs')
      .update({
        status: 'cancelled',
        phase: 'done',
        finished_at: new Date().toISOString(),
        error_summary: 'cancelled_by_admin',
        processed_events: processed,
        failed_events: failed,
        total_guests_upserted: totalGuestsUpserted,
        total_guests_removed: totalGuestsRemoved,
        review_approved: counters.approved,
        review_waitlisted: counters.waitlisted,
        review_skipped: counters.skipped,
      })
      .eq('id', jobId);
    return;
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
