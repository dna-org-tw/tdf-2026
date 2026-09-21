import { supabaseServer } from '@/lib/supabaseServer';

/**
 * Runs on every process boot (instrumentation.ts). Any job still marked
 * `queued` or `running` at startup has been orphaned — its worker died with
 * the previous process (SIGTERM on redeploy, OOM, crash). We don't wait: by
 * the time a new process is executing this code, the old one is gone.
 *
 * The worker polls its own status between events, so any in-flight worker
 * from a rolling-deploy overlap will self-abort on its next iteration
 * without overwriting the 'failed' status we set here.
 */
export async function reconcileStuckJobs(): Promise<void> {
  if (!supabaseServer) return;
  const { data, error } = await supabaseServer
    .from('luma_sync_jobs')
    .update({
      status: 'failed',
      phase: 'done',
      finished_at: new Date().toISOString(),
      error_summary: 'process_restarted',
    })
    .in('status', ['queued', 'running'])
    .select('id');
  if (error) {
    console.error('[luma-sync] reconcile query failed', error);
    return;
  }
  if (data && data.length > 0) {
    console.warn(`[luma-sync] reconciled ${data.length} orphaned job(s): ${data.map((r) => r.id).join(', ')}`);
  }
}
