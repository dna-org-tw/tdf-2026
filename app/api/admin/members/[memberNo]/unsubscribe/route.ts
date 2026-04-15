import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';
import { resolveMember } from '@/lib/adminMembers';

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

  const { data, error } = await supabaseServer
    .from('newsletter_subscriptions')
    .delete()
    .ilike('email', member.email)
    .select('id');
  if (error) {
    console.error('[Admin Unsubscribe]', error);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
  return NextResponse.json({ removed: data?.length ?? 0 });
}
