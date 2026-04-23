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
  booked_price_twd: number | null;
  stay_bookings: BookingRow | null;
}

const ACTIVE_STATUSES = ['confirmed', 'modified_in', 'pending_transfer'];

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
    .select('id, code, starts_on, ends_on, room_capacity')
    .eq('id', id)
    .maybeSingle();
  if (weekErr) return NextResponse.json({ error: weekErr.message }, { status: 500 });
  if (!week) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data: bookingWeeks, error: bwErr } = await supabaseServer
    .from('stay_booking_weeks')
    .select(`
      status,
      booked_price_twd,
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
    .filter((bw): bw is BookingWeekRow & { stay_bookings: BookingRow } => bw.stay_bookings !== null)
    .sort((a, b) => a.stay_bookings.created_at.localeCompare(b.stay_bookings.created_at));

  const header = [
    '入住日',
    '退房日',
    '訂房編號',
    '付費',
    '金額',
    '主住客姓名',
    '電話',
    'Email',
    '備註',
  ];
  const lines = [header.map(csvEscape).join(',')];
  for (const bw of rows) {
    const r = bw.stay_bookings;
    const isPaid = r.booking_type === 'guaranteed';
    lines.push([
      csvEscape(week.starts_on),
      csvEscape(week.ends_on),
      csvEscape(r.id.slice(0, 8)),
      csvEscape(isPaid ? '✓' : ''),
      csvEscape(isPaid && bw.booked_price_twd != null ? bw.booked_price_twd : ''),
      csvEscape(r.primary_guest_name),
      csvEscape(r.primary_guest_phone),
      csvEscape(r.primary_guest_email),
      csvEscape(r.internal_notes),
    ].join(','));
  }

  const fillerCount = Math.max(0, (week.room_capacity ?? 0) - rows.length);
  for (let i = 0; i < fillerCount; i++) {
    lines.push([
      csvEscape(week.starts_on),
      csvEscape(week.ends_on),
      csvEscape(''),
      csvEscape(''),
      csvEscape(''),
      csvEscape('徐愷'),
      csvEscape('+886-983-665352'),
      csvEscape('accommodation@taiwandigitalfest.com'),
      csvEscape('主辦單位使用'),
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
