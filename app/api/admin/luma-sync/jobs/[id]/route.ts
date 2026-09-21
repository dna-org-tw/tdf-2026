import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'db' }, { status: 500 });

  const { id } = await params;
  const jobId = Number(id);
  if (!Number.isFinite(jobId)) return NextResponse.json({ error: 'bad_id' }, { status: 400 });

  const { data: job } = await supabaseServer
    .from('luma_sync_jobs')
    .select('*')
    .eq('id', jobId)
    .single();
  if (!job) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data: results } = await supabaseServer
    .from('luma_sync_event_results')
    .select('*')
    .eq('job_id', jobId)
    .order('id', { ascending: true });

  return NextResponse.json({ job, results: results ?? [] });
}

/**
 * Request cancellation of an in-flight job. Sets cancel_requested_at; the
 * worker polls this between events and finalizes the job as 'cancelled'
 * at the next event boundary (cannot abort mid-event without risking
 * Luma/local divergence).
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'db' }, { status: 500 });

  const { id } = await params;
  const jobId = Number(id);
  if (!Number.isFinite(jobId)) return NextResponse.json({ error: 'bad_id' }, { status: 400 });

  const { data: job } = await supabaseServer
    .from('luma_sync_jobs')
    .select('id, status, cancel_requested_at')
    .eq('id', jobId)
    .single();
  if (!job) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!['queued', 'running'].includes(job.status)) {
    return NextResponse.json({ error: 'not_cancellable', status: job.status }, { status: 409 });
  }
  if (job.cancel_requested_at) {
    return NextResponse.json({ alreadyRequested: true, cancelRequestedAt: job.cancel_requested_at });
  }

  const now = new Date().toISOString();
  const { error } = await supabaseServer
    .from('luma_sync_jobs')
    .update({ cancel_requested_at: now })
    .eq('id', jobId);
  if (error) return NextResponse.json({ error: 'update_failed', message: error.message }, { status: 500 });

  return NextResponse.json({ cancelRequestedAt: now, requestedBy: session.email });
}
