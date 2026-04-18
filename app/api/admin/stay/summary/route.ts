import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';

export async function GET(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'db' }, { status: 500 });

  const [weeks, bookings, waitlist, transfers] = await Promise.all([
    supabaseServer.from('stay_weeks').select('*').order('starts_on', { ascending: true }),
    supabaseServer.from('stay_booking_weeks').select('week_id, status'),
    supabaseServer.from('stay_waitlist_entries').select('week_id, status'),
    supabaseServer.from('stay_transfers').select('status'),
  ]);

  return NextResponse.json({
    weeks: weeks.data ?? [],
    bookingWeeks: bookings.data ?? [],
    waitlist: waitlist.data ?? [],
    transfers: transfers.data ?? [],
  });
}
