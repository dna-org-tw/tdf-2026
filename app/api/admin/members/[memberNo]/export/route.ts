import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { resolveMember } from '@/lib/adminMembers';
import { GET as getMemberDetail } from '../route';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ memberNo: string }> },
) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { memberNo } = await ctx.params;
  const member = await resolveMember(memberNo);
  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const detailRes = await getMemberDetail(req, ctx);
  if (!detailRes.ok) return detailRes;
  const payload = await detailRes.json();

  const filename = `member-${member.member_no}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.json`;
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
