import { supabaseServer } from '@/lib/supabaseServer';
import { getStayBookingForEmail } from '@/lib/stayQueries';

export async function createStayTransfer(input: {
  bookingId: string;
  bookingWeekId: string;
  fromEmail: string;
  toEmail: string;
}) {
  if (!supabaseServer) throw new Error('db_not_configured');

  const booking = await getStayBookingForEmail(input.bookingId, input.fromEmail);
  if (!booking) throw new Error('booking_not_found');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bookingWeek = (booking.stay_booking_weeks as any[]).find((w) => w.id === input.bookingWeekId);
  if (!bookingWeek) throw new Error('booking_week_not_found');

  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseServer
    .from('stay_transfers')
    .insert({
      booking_week_id: bookingWeek.id,
      from_member_id: booking.member_id,
      to_email: input.toEmail,
      status: 'pending_acceptance',
      booking_type: booking.booking_type,
      expires_at: expiresAt,
    })
    .select('*')
    .single();
  if (error) throw error;

  await supabaseServer
    .from('stay_booking_weeks')
    .update({ status: 'pending_transfer', hold_expires_at: expiresAt })
    .eq('id', bookingWeek.id);

  return data;
}
