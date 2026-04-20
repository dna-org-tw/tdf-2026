import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';
import {
  type MemberStatus,
  type MemberTier,
  type TicketTier,
  type MemberIdentity,
  type DisplayStatus,
  type EnrichedMember,
  ticketTierToIdentity,
  memberStatusToDisplay,
} from '@/lib/members';
import { parseMemberFilter, applyMemberFilter } from '@/lib/adminMembersQuery';

export async function GET(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const filter = parseMemberFilter(searchParams);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));

  try {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const baseQuery = supabaseServer.from('members_enriched').select('*', { count: 'exact' });
    const { data, count, error } = await applyMemberFilter(baseQuery, filter)
      .order('score', { ascending: false })
      .order('last_interaction_at', { ascending: false, nullsFirst: false })
      .range(from, to);

    if (error) {
      console.error('[Admin Members]', error);
      return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
    }

    // Summary counts: filtered only by search (so chips show counts for the search scope,
    // not the already-filtered status/tier scope).
    let summaryQuery = supabaseServer
      .from('members_enriched')
      .select('status, tier, highest_ticket_tier', { head: false });
    if (filter.search) {
      summaryQuery = summaryQuery.or(`email.ilike.%${filter.search}%,name.ilike.%${filter.search}%`);
    }
    const { data: summaryRows, error: summaryErr } = await summaryQuery;
    if (summaryErr) {
      console.error('[Admin Members] summary', summaryErr);
    }

    const byStatus: Record<MemberStatus, number> = {
      paid: 0, pending: 0, abandoned: 0, subscriber: 0, other: 0,
    };
    const byTier: Record<MemberTier, number> = { S: 0, A: 0, B: 0, C: 0 };
    const byIdentity: Record<MemberIdentity, number> = {
      backer: 0, contributor: 0, explorer: 0, follower: 0,
    };
    const byDisplayStatus: Record<DisplayStatus, number> = {
      completed: 0, pending: 0, abandoned: 0, not_started: 0,
    };
    for (const row of summaryRows || []) {
      const s = row.status as MemberStatus;
      const t = row.tier as MemberTier;
      if (byStatus[s] !== undefined) byStatus[s]++;
      if (byTier[t] !== undefined) byTier[t]++;
      const identity = ticketTierToIdentity(row.highest_ticket_tier as TicketTier | null);
      byIdentity[identity]++;
      const ds = memberStatusToDisplay(s);
      byDisplayStatus[ds]++;
    }

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return NextResponse.json({
      members: (data || []) as EnrichedMember[],
      total,
      totalPages,
      page,
      summary: { byStatus, byTier, byIdentity, byDisplayStatus },
    });
  } catch (err) {
    console.error('[Admin Members] unexpected', err);
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
