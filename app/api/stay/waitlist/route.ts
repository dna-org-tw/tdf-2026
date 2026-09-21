import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { resolveMember } from '@/lib/adminMembers';
import { joinStayWaitlist } from '@/lib/stayWaitlist';

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const member = await resolveMember(encodeURIComponent(session.email));
  if (!member) return NextResponse.json({ error: 'member_not_found' }, { status: 404 });

  try {
    const { weekCode } = await req.json();
    const entry = await joinStayWaitlist({ weekCode, memberId: member.id });
    return NextResponse.json({ entry });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'waitlist_failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
