import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { resolveMember } from '@/lib/adminMembers';
import { createStayBooking } from '@/lib/stayBooking';
import { getMemberStaySummary } from '@/lib/stayQueries';

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const member = await resolveMember(encodeURIComponent(session.email));
  if (!member) return NextResponse.json({ error: 'member_not_found' }, { status: 404 });

  try {
    const body = await req.json();
    const booking = await createStayBooking({
      memberId: member.id,
      memberEmail: session.email,
      primaryGuestName: body.primaryGuestName,
      primaryGuestPhone: body.primaryGuestPhone,
      guestCount: body.guestCount,
      secondGuestName: body.secondGuestName ?? null,
      weekCodes: body.weekCodes,
      inviteCode: body.inviteCode ?? null,
      setupIntentId: body.setupIntentId ?? null,
    });
    return NextResponse.json({ booking });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'booking_failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const member = await resolveMember(encodeURIComponent(session.email));
  if (!member) return NextResponse.json({ bookings: [], waitlist: [], transfers: [] });

  const summary = await getMemberStaySummary(member.id, session.email);
  return NextResponse.json(summary);
}
