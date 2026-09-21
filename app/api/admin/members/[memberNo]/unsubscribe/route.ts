import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';
import { resolveMember } from '@/lib/adminMembers';
import { applyUnsubscribe } from '@/lib/newsletterSubscriptions';

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ memberNo: string }> },
) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'Database not configured' }, { status: 500 });

  const { memberNo } = await ctx.params;
  const member = await resolveMember(memberNo);
  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const err = await applyUnsubscribe(member.email, `admin:${session.email}`);
  if (err) {
    console.error('[Admin Unsubscribe]', err);
    return NextResponse.json({ error: 'Unsubscribe failed' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
