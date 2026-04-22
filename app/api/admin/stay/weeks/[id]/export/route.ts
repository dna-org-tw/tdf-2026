import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';
import { csvEscape } from '@/lib/csv';

interface BookingRow {
  id: string;
  booking_type: 'guaranteed' | 'complimentary';
  primary_guest_name: string;
  primary_guest_email: string;
  primary_guest_phone: string;
  internal_notes: string | null;
  created_at: string;
}

interface BookingWeekRow {
  status: string;
  stay_bookings: BookingRow | null;
}

const ACTIVE_STATUSES = ['confirmed', 'modified_in', 'pending_transfer'];

const BOOKING_TYPE_LABEL: Record<string, string> = {
  guaranteed: '保證訂房',
  complimentary: '免費招待',
};

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'db' }, { status: 500 });

  const { id: idParam } = await ctx.params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { data: week, error: weekErr } = await supabaseServer
    .from('stay_weeks')
    .select('id, code, starts_on, ends_on')
    .eq('id', id)
    .maybeSingle();
  if (weekErr) return NextResponse.json({ error: weekErr.message }, { status: 500 });
  if (!week) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data: bookingWeeks, error: bwErr } = await supabaseServer
    .from('stay_booking_weeks')
    .select(`
      status,
      stay_bookings (
        id,
        booking_type,
        primary_guest_name,
        primary_guest_email,
        primary_guest_phone,
        internal_notes,
        created_at
      )
    `)
    .eq('week_id', id)
    .in('status', ACTIVE_STATUSES);
  if (bwErr) return NextResponse.json({ error: bwErr.message }, { status: 500 });

  const rows = ((bookingWeeks ?? []) as unknown as BookingWeekRow[])
    .map((bw) => bw.stay_bookings)
    .filter((b): b is BookingRow => b !== null)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const header = [
    '入住日',
    '退房日',
    '訂房編號',
    '類型',
    '主住客姓名',
    '電話',
    'Email',
    '備註',
  ];
  const lines = [header.map(csvEscape).join(',')];
  for (const r of rows) {
    lines.push([
      csvEscape(week.starts_on),
      csvEscape(week.ends_on),
      csvEscape(r.id.slice(0, 8)),
      csvEscape(BOOKING_TYPE_LABEL[r.booking_type] ?? r.booking_type),
      csvEscape(r.primary_guest_name),
      csvEscape(r.primary_guest_phone),
      csvEscape(r.primary_guest_email),
      csvEscape(r.internal_notes),
    ].join(','));
  }
  const csv = '\uFEFF' + lines.join('\r\n');

  const ts = new Date().toISOString().slice(0, 10);
  const filename = `stay-${week.code}-${ts}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
