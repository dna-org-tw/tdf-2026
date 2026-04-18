import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'db' }, { status: 500 });

  const { id } = await ctx.params;
  const [bookingRes, transfersRes, chargesRes] = await Promise.all([
    supabaseServer
      .from('stay_bookings')
      .select('*, stay_booking_weeks(*, stay_weeks(*)), stay_guarantees(*)')
      .eq('id', id)
      .maybeSingle(),
    supabaseServer
      .from('stay_transfers')
      .select('*, stay_booking_weeks(stay_weeks(code))')
      .eq('stay_booking_weeks.booking_id', id)
      .limit(50),
    supabaseServer
      .from('stay_charge_attempts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  if (bookingRes.error) return NextResponse.json({ error: bookingRes.error.message }, { status: 500 });
  if (!bookingRes.data) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return NextResponse.json({
    booking: bookingRes.data,
    transfers: transfersRes.data ?? [],
    charges: chargesRes.data ?? [],
  });
}
