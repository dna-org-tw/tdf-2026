import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'db' }, { status: 500 });

  const { id } = await ctx.params;
  const { data: booking, error: bErr } = await supabaseServer
    .from('stay_bookings')
    .select('id, booking_type')
    .eq('id', id)
    .maybeSingle();
  if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });
  if (!booking) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const nowIso = new Date().toISOString();
  await supabaseServer
    .from('stay_bookings')
    .update({
      booking_type: 'complimentary',
      internal_notes: `comped by ${session.email} at ${nowIso}`,
      updated_at: nowIso,
    })
    .eq('id', id);

  await supabaseServer
    .from('stay_guarantees')
    .update({ guarantee_type: 'complimentary', replaced_at: nowIso, updated_at: nowIso })
    .eq('booking_id', id);

  return NextResponse.json({ ok: true });
}
