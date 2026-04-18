import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { modifyStayWeek } from '@/lib/stayBooking';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await ctx.params;

  try {
    const { bookingWeekId, targetWeekCode } = await req.json();
    const result = await modifyStayWeek({
      bookingId: id,
      bookingWeekId,
      targetWeekCode,
      ownerEmail: session.email,
    });
    return NextResponse.json({ booking: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'modify_failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
