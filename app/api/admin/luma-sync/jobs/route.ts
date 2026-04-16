import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'db' }, { status: 500 });

  const { data: current } = await supabaseServer
    .from('luma_sync_jobs')
    .select('*')
    .in('status', ['queued', 'running'])
    .order('created_at', { ascending: false })
    .limit(1);
  const { data: recent } = await supabaseServer
    .from('luma_sync_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  return NextResponse.json({
    current: current && current[0] ? current[0] : null,
    recent: recent ?? [],
  });
}
