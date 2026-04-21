import { supabaseServer } from '@/lib/supabaseServer';
import { updateGuestStatus, LumaAuthError } from '@/lib/lumaApi';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PendingGuest {
  id: number;
  event_api_id: string;
  email: string;
  member_id: number | null;
  luma_guest_api_id: string;
  ticket_type_name: string | null;
  activity_status: string;
}

interface MemberInfo {
  member_id: number | null;
  status: string; // 'paid' | 'subscriber' | 'other' | ...
  highest_ticket_tier: string | null;
}

interface ReviewDecision {
  status: 'approved' | 'declined' | 'waitlist';
  reason: string;
  consumedNoShowEventApiId?: string;
}

// ---------------------------------------------------------------------------
// Weight helpers
// ---------------------------------------------------------------------------

const LUMA_TICKET_WEIGHTS: Record<string, number> = {
  'TDF Follower': 1,
  'TDF Explorer': 2,
  'TDF Contributor': 3,
  'TDF Backer': 4,
};

const TIER_WEIGHTS: Record<string, number> = {
  explore: 2,
  contribute: 3,
  weekly_backer: 4,
  backer: 4,
};

/** Higher weight = processed first */
function guestSortWeight(ticketTypeName: string | null): number {
  return LUMA_TICKET_WEIGHTS[ticketTypeName ?? ''] ?? 0;
}

function memberWeight(tier: string | null, status: string): number {
  if (tier && TIER_WEIGHTS[tier] !== undefined) return TIER_WEIGHTS[tier];
  // Subscribers with no paid order → follower weight
  if (status === 'subscriber') return 1;
  return 0;
}

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------

async function fetchPendingGuests(jobId: number): Promise<PendingGuest[]> {
  if (!supabaseServer) throw new Error('supabase not initialised');

  // Get event_api_ids that belong to this job
  const { data: eventResults } = await supabaseServer
    .from('luma_sync_event_results')
    .select('event_api_id')
    .eq('job_id', jobId);

  const eventApiIds = (eventResults ?? []).map((r: { event_api_id: string }) => r.event_api_id);
  if (eventApiIds.length === 0) return [];

  const { data, error } = await supabaseServer
    .from('luma_guests')
    .select('id, event_api_id, email, member_id, luma_guest_api_id, ticket_type_name, activity_status')
    .in('event_api_id', eventApiIds)
    .in('activity_status', ['pending_approval', 'going', 'approved']);

  if (error) throw new Error(`fetch_pending_guests: ${error.message}`);
  return (data ?? []) as PendingGuest[];
}

async function lookupMember(email: string): Promise<MemberInfo | null> {
  if (!supabaseServer) throw new Error('supabase not initialised');

  const { data, error } = await supabaseServer
    .from('members_enriched')
    .select('member_id, status, highest_ticket_tier')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle();

  if (error) throw new Error(`lookup_member: ${error.message}`);
  return data as MemberInfo | null;
}

/** Check if any weekly_backer or backer order covers eventDate */
async function isWeeklyBackerValid(email: string, eventDate: string): Promise<boolean> {
  if (!supabaseServer) throw new Error('supabase not initialised');

  const { data, error } = await supabaseServer
    .from('orders')
    .select('id')
    .eq('status', 'paid')
    .ilike('customer_email', email.toLowerCase().trim())
    .in('ticket_tier', ['weekly_backer', 'backer'])
    .lte('valid_from', eventDate)
    .gte('valid_until', eventDate)
    .limit(1);

  if (error) throw new Error(`weekly_backer_check: ${error.message}`);
  return (data ?? []).length > 0;
}

async function getEventStartDate(eventApiId: string): Promise<string | null> {
  if (!supabaseServer) throw new Error('supabase not initialised');

  const { data, error } = await supabaseServer
    .from('luma_events')
    .select('start_at')
    .eq('event_api_id', eventApiId)
    .maybeSingle();

  if (error) throw new Error(`get_event_start: ${error.message}`);
  return data?.start_at ?? null;
}

interface NoShowData {
  noShowEventApiIds: string[];
  consumedCount: number;
}

async function getNoShowData(email: string): Promise<NoShowData> {
  if (!supabaseServer) throw new Error('supabase not initialised');

  // Past events where guest was approved but never checked in
  const { data: noShows, error: nsErr } = await supabaseServer
    .from('luma_guests')
    .select('event_api_id, luma_events!inner(start_at)')
    .eq('email', email.toLowerCase().trim())
    .eq('activity_status', 'approved')
    .is('checked_in_at', null)
    .lt('luma_events.start_at', new Date().toISOString());

  if (nsErr) throw new Error(`no_show_query: ${nsErr.message}`);

  const noShowEventApiIds = (noShows ?? []).map(
    (r: { event_api_id: string }) => r.event_api_id,
  );

  // Count previously consumed no-show penalties
  const { count, error: cErr } = await supabaseServer
    .from('luma_review_log')
    .select('id', { count: 'exact', head: true })
    .eq('email', email.toLowerCase().trim())
    .eq('reason', 'waitlist:no_show_penalty');

  if (cErr) throw new Error(`consumed_count_query: ${cErr.message}`);

  return {
    noShowEventApiIds,
    consumedCount: count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Decision logic
// ---------------------------------------------------------------------------

async function makeDecision(
  guest: PendingGuest,
  noShowConsumedExtra: Map<string, number>,
): Promise<ReviewDecision> {
  const email = guest.email.toLowerCase().trim();

  // 1. Membership check — no identity in our system → waitlist (per spec)
  const member = await lookupMember(email);
  if (!member || (member.status !== 'paid' && member.status !== 'subscriber')) {
    return { status: 'waitlist', reason: 'waitlist:no_membership' };
  }

  // 2. Tier mismatch check
  const requiredWeight = LUMA_TICKET_WEIGHTS[guest.ticket_type_name ?? ''] ?? 0;
  const mWeight = memberWeight(member.highest_ticket_tier, member.status);
  if (mWeight < requiredWeight) {
    return { status: 'declined', reason: 'declined:tier_mismatch' };
  }

  // 3. Weekly backer validity
  if (member.highest_ticket_tier === 'weekly_backer') {
    const eventStartAt = await getEventStartDate(guest.event_api_id);
    if (eventStartAt) {
      const valid = await isWeeklyBackerValid(email, eventStartAt);
      if (!valid) {
        return { status: 'declined', reason: 'declined:weekly_out_of_range' };
      }
    }
  }

  // 4. No-show penalty
  const noShowData = await getNoShowData(email);
  const extraConsumed = noShowConsumedExtra.get(email) ?? 0;
  const effectiveConsumed = noShowData.consumedCount + extraConsumed;
  const pendingNoShows = noShowData.noShowEventApiIds.length - effectiveConsumed;

  if (pendingNoShows > 0) {
    // Pick the first unconsumed no-show event
    const consumedEventApiId = noShowData.noShowEventApiIds[effectiveConsumed] ?? undefined;
    // Increment in-memory consumed count for this email
    noShowConsumedExtra.set(email, extraConsumed + 1);
    return {
      status: 'waitlist',
      reason: 'waitlist:no_show_penalty',
      consumedNoShowEventApiId: consumedEventApiId,
    };
  }

  // 5. All checks pass
  return { status: 'approved', reason: 'approved:eligible' };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

const DELAY_MS = 300;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runAutoReview(jobId: number, cookie: string): Promise<void> {
  if (!supabaseServer) throw new Error('supabase not initialised');

  const guests = await fetchPendingGuests(jobId);

  // Sort by tier weight descending (higher tier processed first)
  guests.sort((a, b) => guestSortWeight(b.ticket_type_name) - guestSortWeight(a.ticket_type_name));

  let approved = 0;
  let declined = 0;
  let waitlisted = 0;
  let skipped = 0;

  // Track extra consumed no-show penalties within this batch
  const noShowConsumedExtra = new Map<string, number>();

  for (let i = 0; i < guests.length; i++) {
    const guest = guests[i];

    try {
      const decision = await makeDecision(guest, noShowConsumedExtra);

      // Skip Luma API + log when desired status matches current — avoids
      // hammering Luma on every sync for already-correct guests, and prevents
      // double-counting of no_show_penalty consumption logs.
      const noChange = decision.status === guest.activity_status;

      if (!noChange) {
        // Call Luma API to update status
        await updateGuestStatus(cookie, guest.event_api_id, guest.luma_guest_api_id, decision.status);

        // Update local guest status
        await supabaseServer
          .from('luma_guests')
          .update({ activity_status: decision.status })
          .eq('id', guest.id);

        // Insert review log
        await supabaseServer.from('luma_review_log').insert({
          job_id: jobId,
          event_api_id: guest.event_api_id,
          email: guest.email.toLowerCase().trim(),
          member_id: guest.member_id,
          luma_guest_api_id: guest.luma_guest_api_id,
          previous_status: guest.activity_status,
          new_status: decision.status,
          reason: decision.reason,
          consumed_no_show_event_api_id: decision.consumedNoShowEventApiId ?? null,
        });
      }

      // Tally (count what the decision was, regardless of API call)
      if (decision.status === 'approved') approved++;
      else if (decision.status === 'declined') declined++;
      else if (decision.status === 'waitlist') waitlisted++;

      // Rate-limit between Luma API calls (only when we actually called)
      if (!noChange && i < guests.length - 1) {
        await sleep(DELAY_MS);
      }
    } catch (err) {
      // Bubble up auth errors immediately
      if (err instanceof LumaAuthError) {
        // Save partial stats before throwing
        await supabaseServer
          .from('luma_sync_jobs')
          .update({
            review_approved: approved,
            review_declined: declined,
            review_waitlisted: waitlisted,
            review_skipped: skipped,
          })
          .eq('id', jobId);
        throw err;
      }

      // Skip individual guest on other errors
      console.error(`[auto-review] skipping guest ${guest.luma_guest_api_id}:`, err);
      skipped++;
    }
  }

  // Update sync job with final review stats
  await supabaseServer
    .from('luma_sync_jobs')
    .update({
      review_approved: approved,
      review_declined: declined,
      review_waitlisted: waitlisted,
      review_skipped: skipped,
    })
    .eq('id', jobId);
}
