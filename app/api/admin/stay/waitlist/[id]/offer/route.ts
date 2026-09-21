import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'db' }, { status: 500 });

  const { id } = await ctx.params;
  const { data: entry, error } = await supabaseServer
    .from('stay_waitlist_entries')
    .select('*, stay_weeks(waitlist_offer_expires_in_minutes)')
    .eq('id', id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!entry) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (entry.status !== 'active') return NextResponse.json({ error: 'not_active' }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expiresMinutes = (entry as any).stay_weeks?.waitlist_offer_expires_in_minutes ?? 120;
  const offerExpiresAt = new Date(Date.now() + expiresMinutes * 60 * 1000).toISOString();

  const { error: updErr } = await supabaseServer
    .from('stay_waitlist_entries')
    .update({
      status: 'offered',
      offered_at: new Date().toISOString(),
      offer_expires_at: offerExpiresAt,
    })
    .eq('id', id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, offer_expires_at: offerExpiresAt });
}
