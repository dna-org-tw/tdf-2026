import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'db' }, { status: 500 });

  const { id } = await ctx.params;
  const { data: booking, error: bookingErr } = await supabaseServer
    .from('stay_bookings')
    .select('*, stay_booking_weeks(*, stay_weeks(*)), stay_guarantees(*)')
    .eq('id', id)
    .maybeSingle();
  if (bookingErr) return NextResponse.json({ error: bookingErr.message }, { status: 500 });
  if (!booking) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bookingWeekIds = ((booking as any).stay_booking_weeks ?? []).map((w: { id: string }) => w.id);

  const [transfersRes, chargesRes] = bookingWeekIds.length
    ? await Promise.all([
        supabaseServer
          .from('stay_transfers')
          .select('*, stay_booking_weeks(stay_weeks(code))')
          .in('booking_week_id', bookingWeekIds)
          .order('created_at', { ascending: false })
          .limit(50),
        supabaseServer
          .from('stay_charge_attempts')
          .select('*')
          .in('booking_week_id', bookingWeekIds)
          .order('created_at', { ascending: false })
          .limit(50),
      ])
    : [{ data: [] }, { data: [] }];

  return NextResponse.json({
    booking,
    transfers: transfersRes.data ?? [],
    charges: chargesRes.data ?? [],
  });
}
