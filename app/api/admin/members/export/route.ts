import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';
import {
  type EnrichedMember,
  ticketTierToIdentity,
  memberStatusToDisplay,
} from '@/lib/members';
import { parseMemberFilter, applyMemberFilter } from '@/lib/adminMembersQuery';

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatAmount(cents: number | null): string {
  if (cents === null || cents === undefined) return '';
  return (cents / 100).toFixed(2);
}

function formatBool(value: boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  return value ? 'TRUE' : 'FALSE';
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
  const filter = parseMemberFilter(searchParams);

  const pageSize = 1000;
  const rows: EnrichedMember[] = [];
  let offset = 0;

  try {
    while (true) {
      const baseQuery = supabaseServer.from('members_enriched').select('*');
      const { data, error } = await applyMemberFilter(baseQuery, filter)
        .order('score', { ascending: false })
        .order('last_interaction_at', { ascending: false, nullsFirst: false })
        .range(offset, offset + pageSize - 1);

      if (error) {
        console.error('[Admin Members Export]', error);
        return NextResponse.json({ error: 'Failed to export members' }, { status: 500 });
      }
      if (!data || data.length === 0) break;
      rows.push(...(data as EnrichedMember[]));
      if (data.length < pageSize) break;
      offset += pageSize;
    }

    const header = [
      'member_no',
      'name',
      'email',
      'phone',
      'identity',
      'display_status',
      'tier',
      'paid_order_count',
      'total_spent',
      'currency',
      'score',
      'subscribed_newsletter',
      'first_seen_at',
      'last_interaction_at',
      'last_order_at',
      'earliest_valid_from',
      'latest_valid_until',
    ];

    const lines = [header.join(',')];
    for (const r of rows) {
      const identity = ticketTierToIdentity(r.highest_ticket_tier);
      const displayStatus = memberStatusToDisplay(r.status);
      lines.push(
        [
          csvEscape(r.member_no),
          csvEscape(r.name),
          csvEscape(r.email),
          csvEscape(r.phone),
          csvEscape(identity),
          csvEscape(displayStatus),
          csvEscape(r.tier),
          csvEscape(r.paid_order_count),
          csvEscape(formatAmount(r.total_spent_cents)),
          csvEscape(r.currency),
          csvEscape(r.score),
          csvEscape(formatBool(r.subscribed_newsletter)),
          csvEscape(r.first_seen_at),
          csvEscape(r.last_interaction_at),
          csvEscape(r.last_order_at),
          csvEscape(r.earliest_valid_from),
          csvEscape(r.latest_valid_until),
        ].join(',')
      );
    }
    const csv = '\uFEFF' + lines.join('\r\n');

    const ts = new Date().toISOString().slice(0, 10);
    const filename = `members-${ts}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[Admin Members Export]', error);
    return NextResponse.json({ error: 'Failed to export members' }, { status: 500 });
  }
}
