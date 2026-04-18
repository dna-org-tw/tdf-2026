import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { getSessionFromRequest } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'db' }, { status: 500 });

  const { code } = await req.json();
  const { data } = await supabaseServer
    .from('stay_invite_codes')
    .select('id, status')
    .eq('code', String(code).trim())
    .eq('status', 'active')
    .maybeSingle();

  if (!data) return NextResponse.json({ valid: false }, { status: 404 });
  return NextResponse.json({ valid: true, inviteId: data.id });
}
