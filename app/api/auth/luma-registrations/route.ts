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

  // Fetch review reasons for this user's registrations
  const { data: reviews } = await supabaseServer
    .from('luma_review_log')
    .select('event_api_id, reason')
    .eq('email', email)
    .order('created_at', { ascending: false });

  // Build map: event_api_id → most recent reason
  const reviewReasons = new Map<string, string>();
  for (const r of reviews ?? []) {
    if (!reviewReasons.has(r.event_api_id)) {
      reviewReasons.set(r.event_api_id, r.reason);
    }
  }

  // Count no-show penalty consumptions
  const noShowConsumedCount = (reviews ?? []).filter(
    (r) => r.reason === 'waitlist:no_show_penalty',
  ).length;

  const registrations = await shapeRegistrations(
    (data ?? []) as unknown as LumaGuestRow[],
    reviewReasons,
  );

  return NextResponse.json({ registrations, noShowConsumedCount });
}
