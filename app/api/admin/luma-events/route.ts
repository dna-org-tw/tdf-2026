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

  const { data: guests, error: gErr } = await supa
    .from('luma_guests')
    .select('event_api_id, activity_status, paid, checked_in_at');
  if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 });

  const counts = new Map<
    string,
    { approved: number; waitlist: number; invited: number; declined: number; other: number; total: number; paid: number; checkedIn: number }
  >();

  for (const g of (guests ?? []) as Pick<GuestRow, 'event_api_id' | 'activity_status' | 'paid' | 'checked_in_at'>[]) {
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

  return NextResponse.json({
    event: { ...event, url: toLumaEventUrl(event.url) },
    pivot: Array.from(pivot.entries())
      .map(([ticket_type_name, counts]) => ({ ticket_type_name, counts }))
      .sort((a, b) => b.counts.total - a.counts.total),
    guests: guestsOut,
  });
}
