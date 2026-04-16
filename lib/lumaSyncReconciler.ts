import { supabaseServer } from '@/lib/supabaseServer';

export async function reconcileStuckJobs(): Promise<void> {
  if (!supabaseServer) return;
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  await supabaseServer
    .from('luma_sync_jobs')
    .update({
      status: 'failed',
      finished_at: new Date().toISOString(),
      error_summary: 'process_restarted',
    })
    .in('status', ['queued', 'running'])
    .lt('created_at', cutoff);
}
