import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabaseServer';
import { shapeRegistrations, type LumaGuestRow } from '@/lib/lumaSyncConfig';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'db' }, { status: 500 });

  const email = session.email.trim().toLowerCase();
  const { data, error } = await supabaseServer
    .from('luma_guests')
    .select(`
      event_api_id, activity_status, paid, checked_in_at, registered_at,
      ticket_type_name, amount_cents, currency, last_synced_at,
      luma_events ( name, start_at, end_at, url )
    `)
    .eq('email', email)
    .order('registered_at', { ascending: false, nullsFirst: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const registrations = await shapeRegistrations((data ?? []) as unknown as LumaGuestRow[]);
  return NextResponse.json({ registrations });
}
