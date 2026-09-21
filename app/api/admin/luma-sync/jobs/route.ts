import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'db' }, { status: 500 });

  // A job is "current" while finished_at is null — the worker only writes
  // finished_at together with phase='done', so this covers both the sync
  // loop and the review phase, and won't false-positive on historical rows.
  const { data: current } = await supabaseServer
    .from('luma_sync_jobs')
    .select('*')
    .is('finished_at', null)
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
