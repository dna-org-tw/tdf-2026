import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabaseServer';
import {
  getMemberIdByEmail,
  getMemberIdByNo,
  removeCollection,
} from '@/lib/memberCollections';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ memberNo: string }> },
) {
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }
  const { memberNo } = await params;
  if (!/^M\d+$/.test(memberNo)) {
    return NextResponse.json({ error: 'Invalid member_no' }, { status: 400 });
  }

  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const collectorId = await getMemberIdByEmail(session.email);
  if (!collectorId) {
    return NextResponse.json({ ok: true });
  }

  const collectedId = await getMemberIdByNo(memberNo);
  if (!collectedId) {
    return NextResponse.json({ ok: true });
  }

  await removeCollection({ collectorMemberId: collectorId, collectedMemberId: collectedId });
  return NextResponse.json({ ok: true });
}
