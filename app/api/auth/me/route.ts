import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { getSessionFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    if (!supabaseServer) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data } = await supabaseServer
      .from('members_enriched')
      .select('member_no, first_seen_at, name')
      .ilike('email', session.email)
      .maybeSingle();

    return NextResponse.json({
      email: session.email,
      memberNo: data?.member_no ?? null,
      firstSeenAt: data?.first_seen_at ?? null,
      name: data?.name ?? null,
    });
  } catch (error) {
    console.error('[Auth/Me] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
