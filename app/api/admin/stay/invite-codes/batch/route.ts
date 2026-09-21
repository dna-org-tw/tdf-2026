import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';

export async function GET(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'db' }, { status: 500 });
  const { data, error } = await supabaseServer
    .from('stay_invite_codes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ codes: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'db' }, { status: 500 });

  const { count, prefix, batchLabel } = await req.json();
  const parsedCount = Number(count);
  if (!Number.isInteger(parsedCount) || parsedCount <= 0 || parsedCount > 1000) {
    return NextResponse.json({ error: 'invalid_count' }, { status: 400 });
  }
  const safePrefix = String(prefix ?? 'STAY').replace(/[^A-Z0-9_-]/gi, '').slice(0, 16).toUpperCase() || 'STAY';

  const rows = Array.from({ length: parsedCount }).map(() => ({
    code: `${safePrefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    status: 'active' as const,
    batch_label: batchLabel ?? null,
    created_by: session.email,
  }));

  const { data, error } = await supabaseServer.from('stay_invite_codes').insert(rows).select('*');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ codes: data ?? [] });
}
