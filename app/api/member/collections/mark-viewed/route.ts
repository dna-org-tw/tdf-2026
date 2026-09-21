import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabaseServer';
import { getMemberIdByEmail, markCollectionsViewed } from '@/lib/memberCollections';

export async function POST(req: NextRequest) {
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const memberId = await getMemberIdByEmail(session.email);
  if (!memberId) {
    return NextResponse.json({ ok: true });
  }
  await markCollectionsViewed(memberId);
  return NextResponse.json({ ok: true });
}
