import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';
import {
  type MemberStatus,
  type MemberTier,
  type TicketTier,
  type EnrichedMember,
  MEMBER_STATUSES,
  MEMBER_TIERS,
  TICKET_TIERS,
} from '@/lib/members';

function parseList<T extends string>(raw: string | null, allowed: readonly T[]): T[] | undefined {
  if (!raw) return undefined;
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean) as T[];
  const filtered = list.filter((v) => (allowed as readonly string[]).includes(v));
  return filtered.length ? filtered : undefined;
}

export async function GET(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search')?.trim() || '';
  const statuses = parseList<MemberStatus>(searchParams.get('status'), MEMBER_STATUSES);
  const tiers = parseList<MemberTier>(searchParams.get('tier'), MEMBER_TIERS);
  const ticketTiers = parseList<TicketTier>(searchParams.get('ticketTier'), TICKET_TIERS);
  const repeatOnly = searchParams.get('repeat') === '1';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));

  try {
    const buildFiltered = () => {
      let q = supabaseServer!.from('members_enriched').select('*', { count: 'exact' });
      if (search) {
        q = q.or(`email.ilike.%${search}%,name.ilike.%${search}%`);
      }
      if (statuses) q = q.in('status', statuses);
      if (tiers) q = q.in('tier', tiers);
      if (ticketTiers) q = q.in('highest_ticket_tier', ticketTiers);
      if (repeatOnly) q = q.gt('paid_order_count', 1);
      return q;
    };

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, count, error } = await buildFiltered()
      .order('score', { ascending: false })
      .order('last_interaction_at', { ascending: false, nullsFirst: false })
      .range(from, to);

    if (error) {
      console.error('[Admin Members]', error);
      return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
    }

    // Summary counts: filtered only by search (so chips show counts for the search scope,
    // not the already-filtered status/tier scope).
    let summaryQuery = supabaseServer!
      .from('members_enriched')
      .select('status, tier', { head: false });
    if (search) {
      summaryQuery = summaryQuery.or(`email.ilike.%${search}%,name.ilike.%${search}%`);
    }
    const { data: summaryRows, error: summaryErr } = await summaryQuery;
    if (summaryErr) {
      console.error('[Admin Members] summary', summaryErr);
    }

    const byStatus: Record<MemberStatus, number> = {
      paid: 0, pending: 0, abandoned: 0, subscriber: 0, other: 0,
    };
    const byTier: Record<MemberTier, number> = { S: 0, A: 0, B: 0, C: 0 };
    for (const row of summaryRows || []) {
      const s = row.status as MemberStatus;
      const t = row.tier as MemberTier;
      if (byStatus[s] !== undefined) byStatus[s]++;
      if (byTier[t] !== undefined) byTier[t]++;
    }

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return NextResponse.json({
      members: (data || []) as EnrichedMember[],
      total,
      totalPages,
      page,
      summary: { byStatus, byTier },
    });
  } catch (err) {
    console.error('[Admin Members] unexpected', err);
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
