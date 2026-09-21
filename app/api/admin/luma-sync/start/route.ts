import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';
import { runSyncJob } from '@/lib/lumaSyncWorker';
import { getPublicConfig, touchManualRun } from '@/lib/lumaSyncConfig';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'db' }, { status: 500 });

  const cfg = await getPublicConfig();
  if (!cfg.hasCookie) return NextResponse.json({ error: 'no_cookie' }, { status: 400 });

  const { data: existing } = await supabaseServer
    .from('luma_sync_jobs')
    .select('id,status')
    .in('status', ['queued', 'running'])
    .limit(1);
  if (existing && existing.length > 0) {
    return NextResponse.json({ error: 'job_in_progress', jobId: existing[0].id }, { status: 409 });
  }

  const { data, error } = await supabaseServer
    .from('luma_sync_jobs')
    .insert({ trigger: 'manual', status: 'queued', triggered_by: session.email })
    .select('id')
    .single();
  if (error || !data) return NextResponse.json({ error: 'insert_failed' }, { status: 500 });

  await touchManualRun();
  setImmediate(() => {
    runSyncJob(data.id).catch((e) => console.error('[luma-sync] worker crashed', e));
  });

  return NextResponse.json({ jobId: data.id }, { status: 202 });
}
