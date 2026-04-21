import { supabaseServer } from '@/lib/supabaseServer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GuestForDecision {
  email: string;
  event_api_id: string;
  ticket_type_name: string | null;
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

function memberWeight(tier: string | null, status: string): number {
  if (tier && TIER_WEIGHTS[tier] !== undefined) return TIER_WEIGHTS[tier];
  // Any recognised member (paid order without a known tier, or newsletter
  // subscriber) is treated as a follower → eligible for TDF Follower events.
  if (status === 'paid' || status === 'subscriber') return 1;
  return 0;
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
  noShowConsumedExtra: Map<string, number>,
): Promise<ReviewDecision> {
  const email = guest.email.toLowerCase().trim();

  // 1. Membership check — no identity in our system → waitlist
  const member = await lookupMember(email);
  if (!member || (member.status !== 'paid' && member.status !== 'subscriber')) {
    return { status: 'waitlist', reason: 'waitlist:no_membership' };
  }

  // 2. Tier mismatch — member exists but tier insufficient → waitlist
  const requiredWeight = LUMA_TICKET_WEIGHTS[guest.ticket_type_name ?? ''] ?? 0;
  const mWeight = memberWeight(member.highest_ticket_tier, member.status);
  if (mWeight < requiredWeight) {
    return { status: 'waitlist', reason: 'waitlist:tier_mismatch' };
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
  const noShowData = await getNoShowData(email);
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

  // 5. All checks pass
  return { status: 'approved', reason: 'approved:eligible' };
}
