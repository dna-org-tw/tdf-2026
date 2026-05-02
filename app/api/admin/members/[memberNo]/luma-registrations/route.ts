import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';
import { shapeRegistrations, fetchApprovedCounts, type LumaGuestRow } from '@/lib/lumaSyncConfig';
import { toLumaEventUrl } from '@/lib/lumaUrl';

export const dynamic = 'force-dynamic';

// Mirrors lib/lumaAutoReview.ts NO_SHOW_GRACE_MS — events ended at least 4h ago.
const NO_SHOW_GRACE_MS = 4 * 60 * 60 * 1000;
const NO_SHOW_PENALTY_REASON = 'waitlist:no_show_penalty';

interface NoShowItem {
  event_api_id: string;
  event_name: string;
  event_url: string | null;
  end_at: string | null;
  consumed: boolean;
  penalty_event_api_id: string | null;
  penalty_event_name: string | null;
  penalty_event_url: string | null;
  penalty_at: string | null;
}

interface PenaltyItem {
  event_api_id: string;
  event_name: string;
  event_url: string | null;
  consumed_no_show_event_api_id: string | null;
  consumed_no_show_event_name: string | null;
  consumed_no_show_event_url: string | null;
  created_at: string;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ memberNo: string }> }) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'db' }, { status: 500 });
  const supa = supabaseServer;

  const { memberNo } = await params;
  const { data: m } = await supa
    .from('members')
    .select('email')
    .eq('member_no', memberNo)
    .single();
  if (!m) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const email = m.email.trim().toLowerCase();

  const { data, error } = await supa
    .from('luma_guests')
    .select(`
      event_api_id, activity_status, paid, checked_in_at, registered_at,
      ticket_type_name, amount_cents, currency, last_synced_at,
      luma_events ( name, start_at, end_at, url, capacity )
    `)
    .eq('email', email)
    .order('registered_at', { ascending: false, nullsFirst: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Review log for this member: latest reason per event for the
  // registration's reviewReason field, plus all no-show penalties for the
  // attendance summary below.
  const { data: reviews } = await supa
    .from('luma_review_log')
    .select('event_api_id, reason, consumed_no_show_event_api_id, created_at')
    .eq('email', email)
    .order('created_at', { ascending: false });

  const reviewReasons = new Map<string, string>();
  for (const r of (reviews ?? []) as { event_api_id: string; reason: string }[]) {
    if (!reviewReasons.has(r.event_api_id)) reviewReasons.set(r.event_api_id, r.reason);
  }

  const rows = (data ?? []) as unknown as LumaGuestRow[];
  const approvedCounts = await fetchApprovedCounts(rows.map((r) => r.event_api_id));
  const registrations = await shapeRegistrations(rows, reviewReasons, approvedCounts);

  // No-show summary: events the member was approved for but didn't check in
  // to, where end_at is at least 4h ago. Pair against penalty rows.
  const cutoff = Date.now() - NO_SHOW_GRACE_MS;
  const noShowItems: NoShowItem[] = rows
    .filter((r) => {
      if (r.activity_status !== 'approved') return false;
      if (r.checked_in_at) return false;
      const endIso = r.luma_events?.end_at;
      if (!endIso) return false;
      return new Date(endIso).getTime() < cutoff;
    })
    .map((r) => ({
      event_api_id: r.event_api_id,
      event_name: r.luma_events?.name ?? r.event_api_id,
      event_url: toLumaEventUrl(r.luma_events?.url ?? null),
      end_at: r.luma_events?.end_at ?? null,
      consumed: false,
      penalty_event_api_id: null,
      penalty_event_name: null,
      penalty_event_url: null,
      penalty_at: null,
    }))
    .sort((a, b) => (a.end_at ?? '').localeCompare(b.end_at ?? ''));

  const penaltyRows = ((reviews ?? []) as Array<{
    event_api_id: string;
    reason: string;
    consumed_no_show_event_api_id: string | null;
    created_at: string;
  }>)
    .filter((r) => r.reason === NO_SHOW_PENALTY_REASON)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  // Resolve event names for events referenced by penalty rows that aren't
  // already in the member's own registration list.
  const knownEvents = new Map<string, { name: string; url: string | null }>();
  for (const r of rows) {
    if (r.luma_events) {
      knownEvents.set(r.event_api_id, {
        name: r.luma_events.name,
        url: r.luma_events.url,
      });
    }
  }
  const missingIds = new Set<string>();
  for (const p of penaltyRows) {
    if (!knownEvents.has(p.event_api_id)) missingIds.add(p.event_api_id);
    if (p.consumed_no_show_event_api_id && !knownEvents.has(p.consumed_no_show_event_api_id)) {
      missingIds.add(p.consumed_no_show_event_api_id);
    }
  }
  if (missingIds.size > 0) {
    const { data: extras } = await supa
      .from('luma_events')
      .select('event_api_id, name, url')
      .in('event_api_id', Array.from(missingIds));
    for (const e of (extras ?? []) as { event_api_id: string; name: string; url: string | null }[]) {
      knownEvents.set(e.event_api_id, { name: e.name, url: e.url });
    }
  }

  const penalties: PenaltyItem[] = penaltyRows.map((p) => {
    const meta = knownEvents.get(p.event_api_id);
    const consumedMeta = p.consumed_no_show_event_api_id
      ? knownEvents.get(p.consumed_no_show_event_api_id)
      : null;
    return {
      event_api_id: p.event_api_id,
      event_name: meta?.name ?? p.event_api_id,
      event_url: toLumaEventUrl(meta?.url ?? null),
      consumed_no_show_event_api_id: p.consumed_no_show_event_api_id,
      consumed_no_show_event_name: consumedMeta?.name ?? null,
      consumed_no_show_event_url: toLumaEventUrl(consumedMeta?.url ?? null),
      created_at: p.created_at,
    };
  });

  // Pair penalties → no-show entries: explicit consumed_no_show_event_api_id
  // first; fall back to chronological "earliest unmarked" for legacy rows
  // that pre-date the consumed_no_show_event_api_id column.
  const noShowByEvent = new Map<string, NoShowItem>();
  for (const n of noShowItems) noShowByEvent.set(n.event_api_id, n);
  const unpaired: typeof penaltyRows = [];
  for (const p of penaltyRows) {
    const target = p.consumed_no_show_event_api_id
      ? noShowByEvent.get(p.consumed_no_show_event_api_id)
      : null;
    if (target && !target.consumed) {
      target.consumed = true;
      target.penalty_event_api_id = p.event_api_id;
      target.penalty_event_name = knownEvents.get(p.event_api_id)?.name ?? p.event_api_id;
      target.penalty_event_url = toLumaEventUrl(knownEvents.get(p.event_api_id)?.url ?? null);
      target.penalty_at = p.created_at;
    } else {
      unpaired.push(p);
    }
  }
  for (const p of unpaired) {
    const target = noShowItems.find((n) => !n.consumed);
    if (target) {
      target.consumed = true;
      target.penalty_event_api_id = p.event_api_id;
      target.penalty_event_name = knownEvents.get(p.event_api_id)?.name ?? p.event_api_id;
      target.penalty_event_url = toLumaEventUrl(knownEvents.get(p.event_api_id)?.url ?? null);
      target.penalty_at = p.created_at;
    }
  }

  const consumedCount = noShowItems.filter((n) => n.consumed).length;
  const pendingCount = Math.max(0, noShowItems.length - penaltyRows.length);

  return NextResponse.json({
    registrations,
    noShowSummary: {
      total: noShowItems.length,
      consumed: consumedCount,
      pending: pendingCount,
      items: noShowItems,
      penalties,
    },
  });
}
