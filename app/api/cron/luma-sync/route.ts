import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { runSyncJob } from '@/lib/lumaSyncWorker';
import { getPublicConfig } from '@/lib/lumaSyncConfig';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return NextResponse.json({ error: 'cron_disabled' }, { status: 503 });
  const auth = req.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseServer) return NextResponse.json({ error: 'db' }, { status: 500 });

  const cfg = await getPublicConfig();
  if (!cfg.cronEnabled) return NextResponse.json({ skipped: 'cron_disabled' });
  if (!cfg.hasCookie) return NextResponse.json({ skipped: 'no_cookie' });

  const { data: existing } = await supabaseServer
    .from('luma_sync_jobs')
    .select('id')
    .in('status', ['queued', 'running'])
    .limit(1);
  if (existing && existing.length > 0) {
    return NextResponse.json({ skipped: 'in_progress', jobId: existing[0].id });
  }

  const { data } = await supabaseServer
    .from('luma_sync_jobs')
    .insert({ trigger: 'cron', status: 'queued' })
    .select('id')
    .single();
  if (!data) return NextResponse.json({ error: 'insert_failed' }, { status: 500 });

  setImmediate(() => {
    runSyncJob(data.id).catch((e) => console.error('[luma-sync] cron worker crashed', e));
  });
  return NextResponse.json({ jobId: data.id });
}
