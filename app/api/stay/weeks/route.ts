import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { getStayBookingDeadlineAt, isStayBookable } from '@/lib/stayTime';
import { getWeekOccupancy, getPendingWaitlistHoldCount } from '@/lib/stayQueries';

export async function GET() {
  if (!supabaseServer) return NextResponse.json({ error: 'db' }, { status: 500 });

  const { data, error } = await supabaseServer
    .from('stay_weeks')
    .select('*')
    .order('starts_on', { ascending: true });

  if (error) return NextResponse.json({ error: 'weeks_failed' }, { status: 500 });

  const weeks = await Promise.all(
    (data ?? []).map(async (week) => {
      const [occupancy, holds] = await Promise.all([
        getWeekOccupancy(week.id),
        getPendingWaitlistHoldCount(week.id),
      ]);
      const remaining = Math.max(0, week.room_capacity - occupancy - holds);
      return {
        ...week,
        booking_deadline_at: getStayBookingDeadlineAt(week.starts_on).toISOString(),
        booking_open: week.status === 'active' && isStayBookable(week.starts_on) && remaining > 0,
        remaining,
      };
    }),
  );

  return NextResponse.json({ weeks });
}
