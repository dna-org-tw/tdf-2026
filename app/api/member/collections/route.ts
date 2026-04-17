import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabaseServer';
import { checkRateLimit } from '@/lib/rateLimit';
import {
  createCollection,
  fetchCollectionsForMember,
  getMemberIdByEmail,
  getMemberIdByNo,
  isMemberPublic,
  verifyQrToken,
} from '@/lib/memberCollections';

export async function GET(req: NextRequest) {
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const memberId = await getMemberIdByEmail(session.email);
  if (!memberId) {
    return NextResponse.json({ collected: [], collectors: [], unreadCount: 0 });
  }
  const result = await fetchCollectionsForMember(memberId);
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { member_no?: string; token?: string } | null;
  if (!body?.member_no || !/^M\d+$/.test(body.member_no)) {
    return NextResponse.json({ error: 'Invalid member_no' }, { status: 400 });
  }

  const collectorId = await getMemberIdByEmail(session.email);
  if (!collectorId) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  const rl = await checkRateLimit(`member_collections_post:${collectorId}`, {
    limit: 60,
    windowSeconds: 3600,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }

  const collectedId = await getMemberIdByNo(body.member_no);
  if (!collectedId) {
    return NextResponse.json({ error: 'Target not found' }, { status: 404 });
  }
  if (collectedId === collectorId) {
    return NextResponse.json({ error: 'Cannot collect yourself' }, { status: 400 });
  }

  const isPublic = await isMemberPublic(collectedId);
  let source: 'public' | 'qr' = 'public';

  if (!isPublic) {
    if (!body.token) {
      return NextResponse.json({ error: 'Token required for private card' }, { status: 403 });
    }
    const payload = await verifyQrToken(body.token);
    if (!payload || payload.member_no !== body.member_no) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    source = 'qr';
  }

  const result = await createCollection({
    collectorMemberId: collectorId,
    collectedMemberId: collectedId,
    source,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, source });
}
