import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { resolveMember } from '@/lib/adminMembers';
import { leaveStayWaitlist } from '@/lib/stayWaitlist';

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const member = await resolveMember(encodeURIComponent(session.email));
  if (!member) return NextResponse.json({ error: 'member_not_found' }, { status: 404 });

  const { id } = await ctx.params;
  try {
    await leaveStayWaitlist(id, member.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'leave_failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
