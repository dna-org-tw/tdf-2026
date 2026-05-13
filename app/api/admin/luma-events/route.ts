import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';
import { toLumaEventUrl } from '@/lib/lumaUrl';

export const dynamic = 'force-dynamic';

interface EventRow {
  event_api_id: string;
  name: string;
  start_at: string | null;
  end_at: string | null;
  url: string | null;
  capacity: number | null;
}

interface GuestRow {
  event_api_id: string;
  email: string;
  ticket_type_name: string | null;
  activity_status: string | null;
  paid: boolean;
  checked_in_at: string | null;
  registered_at: string | null;
  luma_guest_api_id: string | null;
}

type StatusKey = 'approved' | 'waitlist' | 'invited' | 'declined' | 'other';

function bucketStatus(s: string | null): StatusKey {
  if (s === 'approved') return 'approved';
  if (s === 'waitlist') return 'waitlist';
  if (s === 'invited') return 'invited';
  if (s === 'declined') return 'declined';
  return 'other';
}

const TICKET_LABEL_FALLBACK = '— 未指定 —';

/**
 * GET /api/admin/luma-events
 *  - no params: returns event list with aggregated status counts
 *  - ?eventApiId=evt-xxx: returns full detail (event + ticket-type pivot + guests)
 */
export async function GET(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'db' }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const eventApiId = searchParams.get('eventApiId');

  if (eventApiId) {
    return detailResponse(eventApiId);
  }
  return listResponse();
}

async function listResponse() {
  const supa = supabaseServer!;

  const { data: events, error: evErr } = await supa
    .from('luma_events')
    .select('event_api_id, name, start_at, end_at, url, capacity')
    .order('start_at', { ascending: true });
  if (evErr) return NextResponse.json({ error: evErr.message }, { status: 500 });

  // PostgREST caps unfiltered selects at 1000 rows, which would silently
  // under-count once the festival passes ~1k registrations. Paginate so the
  // list-page numbers match the per-event detail (which is filtered by
  // event_api_id and never near the cap).
  const guests: Pick<GuestRow, 'event_api_id' | 'activity_status' | 'paid' | 'checked_in_at'>[] = [];
  const PAGE_SIZE = 1000;
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supa
      .from('luma_guests')
      .select('event_api_id, activity_status, paid, checked_in_at')
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) break;
    guests.push(...(data as typeof guests));
    if (data.length < PAGE_SIZE) break;
  }

  const counts = new Map<
    string,
    { approved: number; waitlist: number; invited: number; declined: number; other: number; total: number; paid: number; checkedIn: number }
  >();

  for (const g of guests) {
    let row = counts.get(g.event_api_id);
    if (!row) {
      row = { approved: 0, waitlist: 0, invited: 0, declined: 0, other: 0, total: 0, paid: 0, checkedIn: 0 };
      counts.set(g.event_api_id, row);
    }
    row.total += 1;
    row[bucketStatus(g.activity_status)] += 1;
    if (g.paid) row.paid += 1;
    if (g.checked_in_at) row.checkedIn += 1;
  }

  const rows = (events ?? []).map((e: EventRow) => ({
    ...e,
    url: toLumaEventUrl(e.url),
    counts:
      counts.get(e.event_api_id) ?? {
        approved: 0,
        waitlist: 0,
        invited: 0,
        declined: 0,
        other: 0,
        total: 0,
        paid: 0,
        checkedIn: 0,
      },
  }));

  return NextResponse.json({ events: rows });
}

type ProfileBreakdown = {
  approved: { label: string; count: number }[];
  all: { label: string; count: number }[];
};

type ProfileStats = {
  totals: { approved: number; all: number };
  ticketTier: ProfileBreakdown;
  nationality: ProfileBreakdown;
  workTypes: ProfileBreakdown;
  nomadExperience: ProfileBreakdown;
  profileCompletion: ProfileBreakdown;
};

const NATIONALITY_TOP_N = 10;
const WORK_TYPE_ORDER = [
  'admin_mgmt',
  'sales_marketing',
  'finance_legal',
  'it_engineering',
  'design_creative',
  'education_research',
  'healthcare_social',
  'tourism_hospitality',
  'manufacturing_logistics',
  'freelance_entrepreneur',
] as const;
const NOMAD_EXPERIENCE_ORDER = [
  'not_yet',
  'under_3m',
  '3m_to_1y',
  '1_to_3y',
  '3_to_5y',
  '5_to_10y',
  'over_10y',
] as const;
const TIER_ORDER = ['backer', 'weekly_backer', 'contribute', 'explore', 'none'] as const;

function buildBreakdown(
  approvedEmails: Set<string>,
  allEmails: Set<string>,
  pickValues: (email: string) => string[],
  options: { sortKey?: readonly string[]; topN?: number } = {}
): ProfileBreakdown {
  const countFor = (emails: Set<string>) => {
    const m = new Map<string, number>();
    for (const email of emails) {
      const vals = pickValues(email);
      for (const v of vals) m.set(v, (m.get(v) ?? 0) + 1);
    }
    return m;
  };

  const sortEntries = (entries: [string, number][]) => {
    const order = options.sortKey;
    if (order) {
      const idx = new Map(order.map((k, i) => [k, i]));
      return entries.slice().sort((a, b) => {
        const ai = idx.get(a[0]) ?? Number.MAX_SAFE_INTEGER;
        const bi = idx.get(b[0]) ?? Number.MAX_SAFE_INTEGER;
        if (ai !== bi) return ai - bi;
        return b[1] - a[1];
      });
    }
    const sorted = entries.slice().sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    if (options.topN && sorted.length > options.topN) {
      const top = sorted.slice(0, options.topN);
      const otherCount = sorted.slice(options.topN).reduce((s, [, n]) => s + n, 0);
      if (otherCount > 0) top.push(['__other__', otherCount]);
      return top;
    }
    return sorted;
  };

  const toRows = (m: Map<string, number>) =>
    sortEntries(Array.from(m.entries())).map(([label, count]) => ({ label, count }));

  return {
    approved: toRows(countFor(approvedEmails)),
    all: toRows(countFor(allEmails)),
  };
}

async function detailResponse(eventApiId: string) {
  const supa = supabaseServer!;

  const [{ data: event, error: evErr }, { data: guests, error: gErr }] = await Promise.all([
    supa
      .from('luma_events')
      .select('event_api_id, name, start_at, end_at, url, capacity')
      .eq('event_api_id', eventApiId)
      .maybeSingle(),
    supa
      .from('luma_guests')
      .select('event_api_id, email, ticket_type_name, activity_status, paid, checked_in_at, registered_at, luma_guest_api_id')
      .eq('event_api_id', eventApiId)
      .order('registered_at', { ascending: false }),
  ]);

  if (evErr) return NextResponse.json({ error: evErr.message }, { status: 500 });
  if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 });
  if (!event) return NextResponse.json({ error: 'event_not_found' }, { status: 404 });

  // Pivot: ticket_type_name × bucketed status
  type PivotKey = StatusKey;
  const pivot = new Map<string, Record<PivotKey, number> & { total: number; paid: number; checkedIn: number }>();
  for (const g of (guests ?? []) as GuestRow[]) {
    const key = g.ticket_type_name ?? TICKET_LABEL_FALLBACK;
    let row = pivot.get(key);
    if (!row) {
      row = { approved: 0, waitlist: 0, invited: 0, declined: 0, other: 0, total: 0, paid: 0, checkedIn: 0 };
      pivot.set(key, row);
    }
    row.total += 1;
    row[bucketStatus(g.activity_status)] += 1;
    if (g.paid) row.paid += 1;
    if (g.checked_in_at) row.checkedIn += 1;
  }

  // Look up the latest review_log reason for each (email, event) so admin can
  // see WHY each guest is in their current state without an extra round-trip.
  const reasonByEmail = new Map<string, string>();
  if ((guests ?? []).length > 0) {
    const emails = Array.from(new Set((guests ?? []).map((g: GuestRow) => g.email.toLowerCase())));
    const { data: logs } = await supa
      .from('luma_review_log')
      .select('email, reason, created_at')
      .eq('event_api_id', eventApiId)
      .in('email', emails)
      .order('created_at', { ascending: false });
    for (const l of (logs ?? []) as { email: string; reason: string }[]) {
      const k = l.email.toLowerCase();
      if (!reasonByEmail.has(k)) reasonByEmail.set(k, l.reason);
    }
  }

  const guestsOut = (guests ?? []).map((g: GuestRow) => ({
    email: g.email,
    ticket_type_name: g.ticket_type_name,
    activity_status: g.activity_status,
    paid: g.paid,
    checked_in_at: g.checked_in_at,
    registered_at: g.registered_at,
    luma_guest_api_id: g.luma_guest_api_id,
    latest_reason: reasonByEmail.get(g.email.toLowerCase()) ?? null,
  }));

  const profile_stats = await computeProfileStats((guests ?? []) as GuestRow[]);

  return NextResponse.json({
    event: { ...event, url: toLumaEventUrl(event.url) },
    pivot: Array.from(pivot.entries())
      .map(([ticket_type_name, counts]) => ({ ticket_type_name, counts }))
      .sort((a, b) => b.counts.total - a.counts.total),
    guests: guestsOut,
    profile_stats,
  });
}

async function computeProfileStats(guests: GuestRow[]): Promise<ProfileStats> {
  const supa = supabaseServer!;

  const normEmails = guests.map((g) => g.email.toLowerCase());
  const allEmails = new Set(normEmails);
  const approvedEmails = new Set(
    guests.filter((g) => g.activity_status === 'approved').map((g) => g.email.toLowerCase())
  );

  if (allEmails.size === 0) {
    const empty: ProfileBreakdown = { approved: [], all: [] };
    return {
      totals: { approved: approvedEmails.size, all: allEmails.size },
      ticketTier: empty,
      nationality: empty,
      workTypes: empty,
      nomadExperience: empty,
      profileCompletion: empty,
    };
  }

  const emailList = Array.from(allEmails);

  // Join members + member_profiles by email
  const { data: members } = await supa
    .from('members')
    .select('id, email')
    .in('email', emailList);

  const memberByEmail = new Map<string, { id: number; email: string }>();
  for (const m of (members ?? []) as { id: number; email: string }[]) {
    memberByEmail.set(m.email.toLowerCase(), m);
  }
  const memberIds = Array.from(memberByEmail.values()).map((m) => m.id);

  const [{ data: profiles }, { data: enriched }] = await Promise.all([
    memberIds.length > 0
      ? supa
          .from('member_profiles')
          .select('member_id, nationality, work_types, nomad_experience')
          .in('member_id', memberIds)
      : Promise.resolve({ data: [] as ProfileRow[] }),
    supa
      .from('members_enriched')
      .select('email, highest_ticket_tier')
      .in('email', emailList),
  ]);

  const profileByMemberId = new Map<number, ProfileRow>();
  for (const p of (profiles ?? []) as ProfileRow[]) {
    profileByMemberId.set(p.member_id, p);
  }

  const tierByEmail = new Map<string, string | null>();
  for (const e of (enriched ?? []) as { email: string; highest_ticket_tier: string | null }[]) {
    tierByEmail.set(e.email.toLowerCase(), e.highest_ticket_tier);
  }

  const profileFor = (email: string): ProfileRow | null => {
    const m = memberByEmail.get(email);
    if (!m) return null;
    return profileByMemberId.get(m.id) ?? null;
  };

  const ticketTier = buildBreakdown(
    approvedEmails,
    allEmails,
    (email) => [tierByEmail.get(email) ?? 'none'],
    { sortKey: TIER_ORDER }
  );

  const nationality = buildBreakdown(
    approvedEmails,
    allEmails,
    (email) => {
      const p = profileFor(email);
      const n = p?.nationality?.trim();
      return n ? [n] : ['__unknown__'];
    },
    { topN: NATIONALITY_TOP_N }
  );

  const workTypes = buildBreakdown(
    approvedEmails,
    allEmails,
    (email) => {
      const p = profileFor(email);
      const arr = (p?.work_types ?? []).filter(Boolean);
      return arr.length > 0 ? arr : ['__unknown__'];
    },
    { sortKey: [...WORK_TYPE_ORDER, '__unknown__'] }
  );

  const nomadExperience = buildBreakdown(
    approvedEmails,
    allEmails,
    (email) => {
      const p = profileFor(email);
      const v = p?.nomad_experience;
      return [v ?? '__unknown__'];
    },
    { sortKey: [...NOMAD_EXPERIENCE_ORDER, '__unknown__'] }
  );

  const profileCompletion = buildBreakdown(
    approvedEmails,
    allEmails,
    (email) => {
      const p = profileFor(email);
      if (!p) return ['none'];
      const fields = [
        p.nationality,
        Array.isArray(p.work_types) && p.work_types.length > 0 ? 'x' : null,
        p.nomad_experience,
      ];
      const filled = fields.filter(Boolean).length;
      if (filled === 0) return ['none'];
      if (filled >= 3) return ['complete'];
      return ['partial'];
    },
    { sortKey: ['complete', 'partial', 'none'] }
  );

  return {
    totals: { approved: approvedEmails.size, all: allEmails.size },
    ticketTier,
    nationality,
    workTypes,
    nomadExperience,
    profileCompletion,
  };
}

type ProfileRow = {
  member_id: number;
  nationality: string | null;
  work_types: string[] | null;
  nomad_experience: string | null;
};
