import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';

const ALLOWED_STATUS = ['active', 'sold_out', 'closed'] as const;

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'db' }, { status: 500 });

  const { id } = await ctx.params;
  const body = await req.json();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: Record<string, any> = {};
  if (typeof body.price_twd === 'number' && body.price_twd >= 0) patch.price_twd = Math.floor(body.price_twd);
  if (typeof body.room_capacity === 'number' && body.room_capacity > 0) patch.room_capacity = Math.floor(body.room_capacity);
  if (typeof body.status === 'string' && (ALLOWED_STATUS as readonly string[]).includes(body.status)) patch.status = body.status;
  if (typeof body.waitlist_offer_expires_in_minutes === 'number' && body.waitlist_offer_expires_in_minutes > 0) {
    patch.waitlist_offer_expires_in_minutes = Math.floor(body.waitlist_offer_expires_in_minutes);
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'empty_patch' }, { status: 400 });
  patch.updated_at = new Date().toISOString();

  const { data, error } = await supabaseServer.from('stay_weeks').update(patch).eq('id', id).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ week: data });
}
