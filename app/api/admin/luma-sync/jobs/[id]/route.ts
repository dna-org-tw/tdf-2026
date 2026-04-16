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
