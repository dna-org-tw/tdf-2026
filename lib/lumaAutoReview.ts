import { supabaseServer } from '@/lib/supabaseServer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GuestForDecision {
  email: string;
  event_api_id: string;
  ticket_type_name: string | null;
  current_ticket_type_api_id: string | null;
}

export interface EventTicketType {
  api_id: string;
  name: string;
  weight: number;
}

interface MemberInfo {
  member_id: number | null;
  status: string;
  highest_ticket_tier: string | null;
}

export interface ReviewDecision {
  status: 'approved' | 'waitlist';
  reason: string;
  consumedNoShowEventApiId?: string;
  /**
   * When status === 'approved' AND the guest currently holds a lower-tier
   * ticket than they are entitled to, this is the api_id of the ticket type
   * we should reassign them to on Luma.
   */
  targetTicketTypeApiId?: string;
  targetTicketTypeName?: string;
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

/** Higher weight = processed first (worker uses this to sort guests). */
export function guestSortWeight(ticketTypeName: string | null): number {
  return LUMA_TICKET_WEIGHTS[ticketTypeName ?? ''] ?? 0;
}

/** Weight for a Luma ticket type name. Unknown names → 0 (lowest). */
export function ticketWeight(ticketTypeName: string | null): number {
  return LUMA_TICKET_WEIGHTS[ticketTypeName ?? ''] ?? 0;
}

function memberWeight(tier: string | null, status: string): number {
  if (tier && TIER_WEIGHTS[tier] !== undefined) return TIER_WEIGHTS[tier];
  // Any recognised member (paid order without a known tier, or newsletter
  // subscriber) is treated as a follower → eligible for TDF Follower events.
  if (status === 'paid' || status === 'subscriber') return 1;
  return 0;
}

/**
 * Pick the highest-tier TDF ticket the member is entitled to *within this
 * event*. Non-TDF tickets (weight 0 — Standard/VIP/Free etc.) are never an
 * upgrade target; they are the problem we redirect away from. Returns null
 * if no TDF ticket in the event has weight ≤ memberWeight.
 */
function pickBestTdfTicket(
  eventTickets: EventTicketType[],
  memberWeightValue: number,
): EventTicketType | null {
  return (
    eventTickets
      .filter((t) => t.weight > 0 && t.weight <= memberWeightValue)
      .sort((a, b) => b.weight - a.weight)[0] ?? null
  );
}

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------

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

async function getNoShowData(
  email: string,
  currentEventApiId: string,
): Promise<NoShowData> {
  if (!supabaseServer) throw new Error('supabase not initialised');

  // "Missed" = approved + no check-in for an event whose end_at was at least
  // 4 hours ago. Two guards prevent self-referential penalties:
  //   • end_at + 4h grace: an event still in progress (or just finished) is
  //     not counted; on-site check-ins may still be flowing in.
  //   • neq currentEventApiId: even after end_at + 4h, the event currently
  //     being reviewed must never appear as its own no-show source — that
  //     would close-loop waitlist the very guests we're processing for it.
  const NO_SHOW_GRACE_MS = 4 * 60 * 60 * 1000;
  const noShowCutoff = new Date(Date.now() - NO_SHOW_GRACE_MS).toISOString();

  const { data: noShows, error: nsErr } = await supabaseServer
    .from('luma_guests')
    .select('event_api_id, luma_events!inner(end_at)')
    .eq('email', email.toLowerCase().trim())
    .eq('activity_status', 'approved')
    .is('checked_in_at', null)
    .neq('event_api_id', currentEventApiId)
    .lt('luma_events.end_at', noShowCutoff);

  if (nsErr) throw new Error(`no_show_query: ${nsErr.message}`);

  const noShowEventApiIds = (noShows ?? []).map(
    (r: { event_api_id: string }) => r.event_api_id,
  );

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

export async function makeDecision(
  guest: GuestForDecision,
  eventTickets: EventTicketType[],
  noShowConsumedExtra: Map<string, number>,
): Promise<ReviewDecision> {
  const email = guest.email.toLowerCase().trim();

  // 1. Membership check — no identity in our system → waitlist
  const member = await lookupMember(email);
  if (!member || (member.status !== 'paid' && member.status !== 'subscriber')) {
    return { status: 'waitlist', reason: 'waitlist:no_membership' };
  }

  const mWeight = memberWeight(member.highest_ticket_tier, member.status);
  const currentTicketWeight = LUMA_TICKET_WEIGHTS[guest.ticket_type_name ?? ''] ?? 0;
  const bestTdfTicket = pickBestTdfTicket(eventTickets, mWeight);

  // 2. Eligibility gate based on the guest's *current* ticket selection.
  //    - Non-TDF tickets (weight 0) → redirect to the best TDF ticket the
  //      member qualifies for, or waitlist if none exist on this event.
  //    - TDF tickets above the member's tier → downgrade to the best TDF
  //      ticket the member qualifies for, or waitlist if none exist.
  //    - TDF tickets at-or-below the member's tier → fall through to step 5
  //      (which may upgrade to a higher tier if the member is entitled).
  if (currentTicketWeight === 0) {
    if (!bestTdfTicket) {
      return { status: 'waitlist', reason: 'waitlist:non_tdf_ticket' };
    }
    // fall through — bestTdfTicket will be the forced upgrade target.
  } else if (mWeight < currentTicketWeight) {
    if (!bestTdfTicket) {
      return { status: 'waitlist', reason: 'waitlist:tier_mismatch' };
    }
    // fall through — bestTdfTicket will be the forced downgrade target.
  }

  // 3. Weekly backer validity — no paid order covering event date → waitlist
  if (member.highest_ticket_tier === 'weekly_backer') {
    const eventStartAt = await getEventStartDate(guest.event_api_id);
    if (eventStartAt) {
      const valid = await isWeeklyBackerValid(email, eventStartAt);
      if (!valid) {
        return { status: 'waitlist', reason: 'waitlist:weekly_out_of_range' };
      }
    }
  }

  // 4. No-show penalty
  const noShowData = await getNoShowData(email, guest.event_api_id);
  const extraConsumed = noShowConsumedExtra.get(email) ?? 0;
  const effectiveConsumed = noShowData.consumedCount + extraConsumed;
  const pendingNoShows = noShowData.noShowEventApiIds.length - effectiveConsumed;

  if (pendingNoShows > 0) {
    const consumedEventApiId = noShowData.noShowEventApiIds[effectiveConsumed] ?? undefined;
    noShowConsumedExtra.set(email, extraConsumed + 1);
    return {
      status: 'waitlist',
      reason: 'waitlist:no_show_penalty',
      consumedNoShowEventApiId: consumedEventApiId,
    };
  }

  // 5. Approve — if the best available TDF ticket for this member differs from
  // what they currently hold, reassign them. Covers (a) non-TDF redirect to a
  // TDF ticket, (b) upgrade to a higher-tier TDF ticket the member is entitled
  // to, and (c) downgrade from a too-high TDF tier to the member's entitled
  // tier (so subscriber-on-Explorer falls back to Follower instead of waitlist).
  if (bestTdfTicket && bestTdfTicket.api_id !== guest.current_ticket_type_api_id) {
    const reason =
      currentTicketWeight > 0 && bestTdfTicket.weight < currentTicketWeight
        ? 'approved:downgraded'
        : 'approved:upgraded';
    return {
      status: 'approved',
      reason,
      targetTicketTypeApiId: bestTdfTicket.api_id,
      targetTicketTypeName: bestTdfTicket.name,
    };
  }
  return { status: 'approved', reason: 'approved:eligible' };
}
