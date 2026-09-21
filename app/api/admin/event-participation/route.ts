import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';
import { toLumaEventUrl } from '@/lib/lumaUrl';

export const dynamic = 'force-dynamic';

type StatusKey = 'approved' | 'waitlist' | 'invited' | 'declined' | 'going' | 'pending_approval' | 'other';

const ACTIVE_STATUSES: StatusKey[] = ['approved', 'going'];

interface EventMeta {
  event_api_id: string;
  name: string;
  start_at: string | null;
  end_at: string | null;
  url: string | null;
}

interface GuestRow {
  event_api_id: string;
  email: string;
  activity_status: string | null;
  paid: boolean;
  checked_in_at: string | null;
  registered_at: string | null;
  ticket_type_name: string | null;
}

interface ParticipantEvent {
  event_api_id: string;
  name: string;
  start_at: string | null;
  end_at: string | null;
  url: string | null;
  activity_status: string | null;
  paid: boolean;
  checked_in_at: string | null;
  registered_at: string | null;
  ticket_type_name: string | null;
}

interface Participant {
  email: string;
  name: string | null;
  member_no: string | null;
  event_count: number;
  approved_count: number;
  checked_in_count: number;
  events: ParticipantEvent[];
}

function bucketStatus(s: string | null): StatusKey {
  if (s === 'approved') return 'approved';
  if (s === 'waitlist') return 'waitlist';
  if (s === 'invited') return 'invited';
  if (s === 'declined') return 'declined';
  if (s === 'going') return 'going';
  if (s === 'pending_approval') return 'pending_approval';
  return 'other';
}

/**
 * GET /api/admin/event-participation
 *
 * Query params:
 *   - includePast=0   exclude events whose end_at is already in the past
 *                     (default: include all events)
 *   - mode=active|all|checked_in
 *       active     (default) count rows whose activity_status is approved/going
 *       all        count every registration regardless of status
 *       checked_in only count rows with a non-null checked_in_at
 *
 * Returns participants sorted by event_count desc, with the underlying
 * event list per person and a summary block.
 */
export async function GET(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'db' }, { status: 500 });
  const supa = supabaseServer;

  const { searchParams } = new URL(req.url);
  const includePast = searchParams.get('includePast') !== '0';
  const modeParam = searchParams.get('mode');
  const mode: 'active' | 'all' | 'checked_in' =
    modeParam === 'all' || modeParam === 'checked_in' ? modeParam : 'active';

  const { data: eventsData, error: evErr } = await supa
    .from('luma_events')
    .select('event_api_id, name, start_at, end_at, url')
    .order('start_at', { ascending: true });
  if (evErr) return NextResponse.json({ error: evErr.message }, { status: 500 });

  const now = Date.now();
  const eventById = new Map<string, EventMeta>();
  for (const e of (eventsData ?? []) as EventMeta[]) {
    if (!includePast) {
      const endMs = e.end_at
        ? new Date(e.end_at).getTime()
        : e.start_at
        ? new Date(e.start_at).getTime() + 24 * 60 * 60 * 1000
        : null;
      if (endMs !== null && endMs < now) continue;
    }
    eventById.set(e.event_api_id, e);
  }

  if (eventById.size === 0) {
    return NextResponse.json({
      participants: [],
      summary: {
        totalParticipants: 0,
        totalRegistrations: 0,
        avgEventsPerPerson: 0,
        eventsConsidered: 0,
        mode,
        includePast,
      },
    });
  }

  // Pull guests in batches. PostgREST caps unfiltered selects at 1000 rows,
  // and the festival has thousands of guest rows across all events.
  const guests: GuestRow[] = [];
  const PAGE_SIZE = 1000;
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supa
      .from('luma_guests')
      .select('event_api_id, email, activity_status, paid, checked_in_at, registered_at, ticket_type_name')
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) break;
    guests.push(...(data as GuestRow[]));
    if (data.length < PAGE_SIZE) break;
  }

  // Filter guests to the events we care about + the chosen counting mode.
  const filteredGuests = guests.filter((g) => {
    if (!eventById.has(g.event_api_id)) return false;
    if (mode === 'all') return true;
    if (mode === 'checked_in') return !!g.checked_in_at;
    return ACTIVE_STATUSES.includes(bucketStatus(g.activity_status));
  });

  // Aggregate per email.
  const byEmail = new Map<string, Participant>();
  for (const g of filteredGuests) {
    const emailKey = g.email.toLowerCase();
    let p = byEmail.get(emailKey);
    if (!p) {
      p = {
        email: g.email,
        name: null,
        member_no: null,
        event_count: 0,
        approved_count: 0,
        checked_in_count: 0,
        events: [],
      };
      byEmail.set(emailKey, p);
    }
    const meta = eventById.get(g.event_api_id)!;
    p.event_count += 1;
    if (bucketStatus(g.activity_status) === 'approved' || bucketStatus(g.activity_status) === 'going') {
      p.approved_count += 1;
    }
    if (g.checked_in_at) p.checked_in_count += 1;
    p.events.push({
      event_api_id: g.event_api_id,
      name: meta.name,
      start_at: meta.start_at,
      end_at: meta.end_at,
      url: toLumaEventUrl(meta.url),
      activity_status: g.activity_status,
      paid: g.paid,
      checked_in_at: g.checked_in_at,
      registered_at: g.registered_at,
      ticket_type_name: g.ticket_type_name,
    });
  }

  // Enrich with member_no + display name. members table is keyed by lowercased
  // email; members_enriched view exposes latest_name from order history.
  const emailList = Array.from(byEmail.keys());
  if (emailList.length > 0) {
    const [{ data: members }, { data: enriched }] = await Promise.all([
      supa.from('members').select('email, member_no').in('email', emailList),
      supa.from('members_enriched').select('email, name').in('email', emailList),
    ]);
    for (const m of (members ?? []) as { email: string; member_no: string | null }[]) {
      const p = byEmail.get(m.email.toLowerCase());
      if (p) p.member_no = m.member_no;
    }
    for (const e of (enriched ?? []) as { email: string; name: string | null }[]) {
      const p = byEmail.get(e.email.toLowerCase());
      if (p && !p.name && e.name) p.name = e.name;
    }
  }

  // Sort events within each participant by start_at asc; null start_at last.
  for (const p of byEmail.values()) {
    p.events.sort((a, b) => {
      const av = a.start_at ?? '￿';
      const bv = b.start_at ?? '￿';
      return av.localeCompare(bv);
    });
  }

  const participants = Array.from(byEmail.values()).sort((a, b) => {
    if (b.event_count !== a.event_count) return b.event_count - a.event_count;
    if (b.checked_in_count !== a.checked_in_count) return b.checked_in_count - a.checked_in_count;
    return a.email.localeCompare(b.email);
  });

  const totalRegistrations = participants.reduce((s, p) => s + p.event_count, 0);
  const totalParticipants = participants.length;
  const avgEventsPerPerson = totalParticipants > 0 ? totalRegistrations / totalParticipants : 0;

  return NextResponse.json({
    participants,
    summary: {
      totalParticipants,
      totalRegistrations,
      avgEventsPerPerson: Math.round(avgEventsPerPerson * 100) / 100,
      eventsConsidered: eventById.size,
      mode,
      includePast,
    },
  });
}
