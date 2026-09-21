import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabaseServer';
import { issueQrToken } from '@/lib/memberCollections';

export async function POST(req: NextRequest) {
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: member } = await supabaseServer
    .from('members')
    .select('member_no')
    .ilike('email', session.email)
    .maybeSingle();

  if (!member?.member_no) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  const { token, expiresAt } = await issueQrToken(member.member_no);
  return NextResponse.json({ token, expiresAt });
}
