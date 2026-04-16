import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';
import { shapeRegistrations, type LumaGuestRow } from '@/lib/lumaSyncConfig';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ memberNo: string }> }) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'db' }, { status: 500 });

  const { memberNo } = await params;
  const { data: m } = await supabaseServer
    .from('members')
    .select('email')
    .eq('member_no', memberNo)
    .single();
  if (!m) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data, error } = await supabaseServer
    .from('luma_guests')
    .select(`
      event_api_id, activity_status, paid, checked_in_at, registered_at,
      ticket_type_name, amount_cents, currency, last_synced_at,
      luma_events ( name, start_at, end_at, url )
    `)
    .eq('email', m.email.trim().toLowerCase())
    .order('registered_at', { ascending: false, nullsFirst: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const registrations = await shapeRegistrations((data ?? []) as unknown as LumaGuestRow[]);
  return NextResponse.json({ registrations });
}
