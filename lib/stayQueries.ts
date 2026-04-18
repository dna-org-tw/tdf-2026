import { supabaseServer } from '@/lib/supabaseServer';

function requireSupabase() {
  if (!supabaseServer) throw new Error('db_not_configured');
  return supabaseServer;
}

export async function getStayWeekByCode(code: string) {
  const sb = requireSupabase();
  const { data, error } = await sb.from('stay_weeks').select('*').eq('code', code).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getStayWeeksByCodes(codes: string[]) {
  const sb = requireSupabase();
  const { data, error } = await sb.from('stay_weeks').select('*').in('code', codes).order('starts_on', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getWeekOccupancy(weekId: number) {
  const sb = requireSupabase();
  const { count, error } = await sb
    .from('stay_booking_weeks')
    .select('*', { count: 'exact', head: true })
    .eq('week_id', weekId)
    .in('status', ['confirmed', 'modified_in', 'pending_transfer']);
  if (error) throw error;
  return count ?? 0;
}

export async function getPendingWaitlistHoldCount(weekId: number) {
  const sb = requireSupabase();
  const now = new Date().toISOString();
  const { count, error } = await sb
    .from('stay_waitlist_entries')
    .select('*', { count: 'exact', head: true })
    .eq('week_id', weekId)
    .eq('status', 'offered')
    .gt('offer_expires_at', now);
  if (error) throw error;
  return count ?? 0;
}

export async function getNextWaitlistPosition(weekId: number) {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('stay_waitlist_entries')
    .select('position')
    .eq('week_id', weekId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.position ?? 0) + 1;
}

export async function getStayBookingForEmail(bookingId: string, email: string) {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('stay_bookings')
    .select('*, stay_booking_weeks(*, stay_weeks(*)), stay_guarantees(*)')
    .eq('id', bookingId)
    .eq('primary_guest_email', email)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getPendingTransferForRecipient(transferId: string, recipientEmail: string) {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('stay_transfers')
    .select('*')
    .eq('id', transferId)
    .eq('to_email', recipientEmail)
    .eq('status', 'pending_acceptance')
    .maybeSingle();
  if (error) throw error;
  return data;
}
