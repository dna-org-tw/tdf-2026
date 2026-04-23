import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';
import { renderStayWeekBookingPdf, type StayBookingPdfRow } from '@/lib/stayWeekBookingPdf';

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
    .select('id, code, starts_on, ends_on')
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

  const rows: StayBookingPdfRow[] = ((bookingWeeks ?? []) as unknown as BookingWeekRow[])
    .filter((bw): bw is BookingWeekRow & { stay_bookings: BookingRow } => bw.stay_bookings !== null)
    .sort((a, b) => a.stay_bookings.created_at.localeCompare(b.stay_bookings.created_at))
    .map((bw) => {
      const r = bw.stay_bookings;
      const isPaid = r.booking_type === 'guaranteed';
      return {
        bookingId: r.id.slice(0, 8),
        isPaid,
        amount: isPaid ? bw.booked_price_twd : null,
        name: r.primary_guest_name,
        phone: r.primary_guest_phone,
        email: r.primary_guest_email,
        notes: r.internal_notes,
      };
    });

  try {
    const pdfBuffer = await renderStayWeekBookingPdf({
      weekCode: week.code,
      startsOn: week.starts_on,
      endsOn: week.ends_on,
      generatedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      rows,
    });

    const ts = new Date().toISOString().slice(0, 10);
    const filename = `stay-${week.code}-${ts}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[Stay PDF export]', error);
    return NextResponse.json({ error: 'pdf_render_failed' }, { status: 500 });
  }
}
