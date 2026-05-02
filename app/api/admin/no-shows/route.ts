import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';
import { toLumaEventUrl } from '@/lib/lumaUrl';

export const dynamic = 'force-dynamic';

// Same window as lumaAutoReview.getNoShowData: events that ended at least
// 4 hours ago. Keep in sync with lib/lumaAutoReview.ts (NO_SHOW_GRACE_MS).
const NO_SHOW_GRACE_MS = 4 * 60 * 60 * 1000;

const NO_SHOW_PENALTY_REASON = 'waitlist:no_show_penalty';

interface NoShowRow {
  email: string;
  event_api_id: string;
  luma_events: { name: string; end_at: string | null; url: string | null } | null;
}

interface PenaltyRow {
  email: string;
  event_api_id: string;
  consumed_no_show_event_api_id: string | null;
  created_at: string;
}

interface MemberInfo {
  id: number;
  member_no: string;
  email: string;
  name: string | null;
  status: string;
  highest_ticket_tier: string | null;
  score: number;
}

interface NoShowEntry {
  event_api_id: string;
  event_name: string;
  event_url: string | null;
  end_at: string | null;
  consumed: boolean;
  penalty_event_api_id: string | null;
  penalty_event_name: string | null;
  penalty_at: string | null;
}

interface PenaltyEntry {
  event_api_id: string;
  event_name: string;
  event_url: string | null;
  consumed_no_show_event_api_id: string | null;
  consumed_no_show_event_name: string | null;
  created_at: string;
}

interface EmailRow {
  email: string;
  member: {
    id: number;
    member_no: string;
    name: string | null;
    status: string;
    highest_ticket_tier: string | null;
    score: number;
  } | null;
  no_show_count: number;
  consumed_count: number;
  pending_count: number;
  last_no_show_at: string | null;
  no_shows: NoShowEntry[];
  penalties: PenaltyEntry[];
}

export async function GET(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'db' }, { status: 500 });
  const supa = supabaseServer;

  const cutoffIso = new Date(Date.now() - NO_SHOW_GRACE_MS).toISOString();

  // 1) All no-shows: approved + not checked in + event ended >= 4h ago.
  // Paginate to dodge the 1000-row PostgREST cap.
  const noShows: NoShowRow[] = [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supa
      .from('luma_guests')
      .select('email, event_api_id, luma_events!inner(name, end_at, url)')
      .eq('activity_status', 'approved')
      .is('checked_in_at', null)
      .lt('luma_events.end_at', cutoffIso)
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) break;
    noShows.push(...(data as unknown as NoShowRow[]));
    if (data.length < PAGE) break;
  }

  // 2) All no-show penalties.
  const penalties: PenaltyRow[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supa
      .from('luma_review_log')
      .select('email, event_api_id, consumed_no_show_event_api_id, created_at')
      .eq('reason', NO_SHOW_PENALTY_REASON)
      .order('created_at', { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) break;
    penalties.push(...(data as PenaltyRow[]));
    if (data.length < PAGE) break;
  }

  // 3) Look up event metadata for events referenced by penalty rows
  // (the event the guest was waitlisted into, and the consumed no-show event)
  // that aren't already covered by the no-show join above.
  const knownEventIds = new Set<string>();
  for (const r of noShows) knownEventIds.add(r.event_api_id);
  const extraEventIds = new Set<string>();
  for (const p of penalties) {
    if (!knownEventIds.has(p.event_api_id)) extraEventIds.add(p.event_api_id);
    if (p.consumed_no_show_event_api_id && !knownEventIds.has(p.consumed_no_show_event_api_id)) {
      extraEventIds.add(p.consumed_no_show_event_api_id);
    }
  }
  const eventMeta = new Map<string, { name: string; url: string | null }>();
  for (const r of noShows) {
    if (r.luma_events) eventMeta.set(r.event_api_id, { name: r.luma_events.name, url: r.luma_events.url });
  }
  if (extraEventIds.size > 0) {
    const { data: extras, error: exErr } = await supa
      .from('luma_events')
      .select('event_api_id, name, url')
      .in('event_api_id', Array.from(extraEventIds));
    if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 });
    for (const e of (extras ?? []) as { event_api_id: string; name: string; url: string | null }[]) {
      eventMeta.set(e.event_api_id, { name: e.name, url: e.url });
    }
  }

  // 4) Member metadata for affected emails.
  const affectedEmails = new Set<string>();
  for (const r of noShows) affectedEmails.add(r.email.toLowerCase());
  for (const p of penalties) affectedEmails.add(p.email.toLowerCase());

  const memberByEmail = new Map<string, MemberInfo>();
  if (affectedEmails.size > 0) {
    const emails = Array.from(affectedEmails);
    // Chunk to avoid too-long IN clauses.
    const CHUNK = 200;
    for (let i = 0; i < emails.length; i += CHUNK) {
      const slice = emails.slice(i, i + CHUNK);
      const { data, error } = await supa
        .from('members_enriched')
        .select('member_id, member_no, email, name, status, highest_ticket_tier, score')
        .in('email', slice);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      for (const m of (data ?? []) as Array<{
        member_id: number;
        member_no: string;
        email: string;
        name: string | null;
        status: string;
        highest_ticket_tier: string | null;
        score: number;
      }>) {
        memberByEmail.set(m.email.toLowerCase(), {
          id: m.member_id,
          member_no: m.member_no,
          email: m.email,
          name: m.name,
          status: m.status,
          highest_ticket_tier: m.highest_ticket_tier,
          score: m.score,
        });
      }
    }
  }

  // 5) Aggregate per email.
  type Acc = {
    no_shows: NoShowEntry[];
    penalties: PenaltyEntry[];
  };
  const byEmail = new Map<string, Acc>();
  const ensure = (email: string): Acc => {
    let a = byEmail.get(email);
    if (!a) {
      a = { no_shows: [], penalties: [] };
      byEmail.set(email, a);
    }
    return a;
  };

  for (const r of noShows) {
    const key = r.email.toLowerCase();
    const meta = eventMeta.get(r.event_api_id);
    ensure(key).no_shows.push({
      event_api_id: r.event_api_id,
      event_name: meta?.name ?? r.luma_events?.name ?? r.event_api_id,
      event_url: toLumaEventUrl(meta?.url ?? r.luma_events?.url ?? null),
      end_at: r.luma_events?.end_at ?? null,
      consumed: false,
      penalty_event_api_id: null,
      penalty_event_name: null,
      penalty_at: null,
    });
  }

  for (const p of penalties) {
    const key = p.email.toLowerCase();
    const penaltyMeta = eventMeta.get(p.event_api_id);
    const consumedMeta = p.consumed_no_show_event_api_id
      ? eventMeta.get(p.consumed_no_show_event_api_id)
      : null;
    ensure(key).penalties.push({
      event_api_id: p.event_api_id,
      event_name: penaltyMeta?.name ?? p.event_api_id,
      event_url: toLumaEventUrl(penaltyMeta?.url ?? null),
      consumed_no_show_event_api_id: p.consumed_no_show_event_api_id,
      consumed_no_show_event_name: consumedMeta?.name ?? null,
      created_at: p.created_at,
    });
  }

  // 6) Mark each no-show as consumed (or not) by checking penalty rows.
  // Accuracy: prefer the penalty's recorded consumed_no_show_event_api_id.
  // Fallback: the autoReview convention is "first N no-shows by end_at order
  // are consumed", so when consumed_no_show_event_api_id is null on a penalty
  // row, fill from the earliest unmatched no-show.
  const rows: EmailRow[] = [];
  for (const [email, acc] of byEmail) {
    // Stable ordering: no-shows by end_at asc, penalties by created_at asc.
    acc.no_shows.sort((a, b) => (a.end_at ?? '').localeCompare(b.end_at ?? ''));
    acc.penalties.sort((a, b) => a.created_at.localeCompare(b.created_at));

    // First pass: pair penalties whose consumed_no_show_event_api_id explicitly matches.
    const noShowByEvent = new Map<string, NoShowEntry>();
    for (const ns of acc.no_shows) noShowByEvent.set(ns.event_api_id, ns);
    const unpairedPenalties: PenaltyEntry[] = [];
    for (const p of acc.penalties) {
      const target = p.consumed_no_show_event_api_id
        ? noShowByEvent.get(p.consumed_no_show_event_api_id)
        : null;
      if (target && !target.consumed) {
        target.consumed = true;
        target.penalty_event_api_id = p.event_api_id;
        target.penalty_event_name = p.event_name;
        target.penalty_at = p.created_at;
      } else {
        unpairedPenalties.push(p);
      }
    }
    // Second pass: legacy penalties without consumed_no_show_event_api_id —
    // fall back to "earliest unmarked no-show" (lumaAutoReview's ordering).
    for (const p of unpairedPenalties) {
      const target = acc.no_shows.find((n) => !n.consumed);
      if (target) {
        target.consumed = true;
        target.penalty_event_api_id = p.event_api_id;
        target.penalty_event_name = p.event_name;
        target.penalty_at = p.created_at;
      }
    }

    const consumed_count = acc.no_shows.filter((n) => n.consumed).length;
    const no_show_count = acc.no_shows.length;
    // pending_count uses penalty count vs no-show count (mirrors
    // lumaAutoReview.pendingNoShows). When penalties > no-shows (rare race or
    // historical no-show that's been re-checked-in retroactively), clamp to 0.
    const pending_count = Math.max(0, no_show_count - acc.penalties.length);
    const last_no_show_at = acc.no_shows.length > 0
      ? acc.no_shows.reduce<string | null>((acc2, n) => {
          if (!n.end_at) return acc2;
          if (!acc2) return n.end_at;
          return n.end_at > acc2 ? n.end_at : acc2;
        }, null)
      : null;

    const m = memberByEmail.get(email);
    rows.push({
      email,
      member: m
        ? {
            id: m.id,
            member_no: m.member_no,
            name: m.name,
            status: m.status,
            highest_ticket_tier: m.highest_ticket_tier,
            score: m.score,
          }
        : null,
      no_show_count,
      consumed_count,
      pending_count,
      last_no_show_at,
      no_shows: acc.no_shows,
      penalties: acc.penalties,
    });
  }

  // Sort: pending desc, then no-show desc, then most recent no-show desc.
  rows.sort((a, b) => {
    if (b.pending_count !== a.pending_count) return b.pending_count - a.pending_count;
    if (b.no_show_count !== a.no_show_count) return b.no_show_count - a.no_show_count;
    return (b.last_no_show_at ?? '').localeCompare(a.last_no_show_at ?? '');
  });

  const totals = {
    affectedEmails: rows.length,
    totalNoShows: rows.reduce((s, r) => s + r.no_show_count, 0),
    totalConsumed: rows.reduce((s, r) => s + r.consumed_count, 0),
    totalPending: rows.reduce((s, r) => s + r.pending_count, 0),
  };

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    totals,
    rows,
  });
}
