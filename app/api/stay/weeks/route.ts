import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { getStayBookingDeadlineAt, isStayBookable } from '@/lib/stayTime';

export async function GET() {
  if (!supabaseServer) return NextResponse.json({ error: 'db' }, { status: 500 });

  const { data, error } = await supabaseServer
    .from('stay_weeks')
    .select('*')
    .order('starts_on', { ascending: true });

  if (error) return NextResponse.json({ error: 'weeks_failed' }, { status: 500 });

  const weeks = (data ?? []).map((week) => ({
    ...week,
    booking_deadline_at: getStayBookingDeadlineAt(week.starts_on).toISOString(),
    booking_open: week.status === 'active' && isStayBookable(week.starts_on),
  }));

  return NextResponse.json({ weeks });
}
