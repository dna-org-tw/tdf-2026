import { supabaseServer } from '@/lib/supabaseServer';
import { getStayBookingForEmail, getPendingTransferForRecipient } from '@/lib/stayQueries';
import { stayStripe } from '@/lib/stayStripe';
import { resolveMember } from '@/lib/adminMembers';

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

export async function acceptStayTransfer(input: {
  transferId: string;
  recipientEmail: string;
  setupIntentId: string | null;
}) {
  if (!supabaseServer) throw new Error('db_not_configured');

  const transfer = await getPendingTransferForRecipient(input.transferId, input.recipientEmail);
  if (!transfer) throw new Error('transfer_not_found');
  if (transfer.booking_type === 'guaranteed' && !input.setupIntentId) throw new Error('setup_intent_required');

  const recipient = await resolveMember(encodeURIComponent(input.recipientEmail));
  if (!recipient) throw new Error('recipient_member_not_found');

  const { data: bookingWeek } = await supabaseServer
    .from('stay_booking_weeks')
    .select('booking_id')
    .eq('id', transfer.booking_week_id)
    .maybeSingle();
  if (!bookingWeek) throw new Error('booking_week_not_found');

  // Validate SetupIntent BEFORE any writes so a failed validation leaves the
  // booking_week untouched (otherwise the original owner loses the week and
  // the reconcile cron can't revert it).
  let validatedSetupIntent: Awaited<ReturnType<NonNullable<typeof stayStripe>['setupIntents']['retrieve']>> | null = null;
  if (transfer.booking_type === 'guaranteed') {
    if (!stayStripe) throw new Error('stripe_not_configured');
    const setupIntent = await stayStripe.setupIntents.retrieve(input.setupIntentId!, { expand: ['payment_method'] });
    if (
      setupIntent.status !== 'succeeded' ||
      typeof setupIntent.payment_method === 'string' ||
      !setupIntent.payment_method ||
      !setupIntent.customer
    ) {
      throw new Error('setup_intent_not_ready');
    }
    validatedSetupIntent = setupIntent;
  }

  await supabaseServer
    .from('stay_booking_weeks')
    .update({ member_id: recipient.id, status: 'transferred', hold_expires_at: null })
    .eq('id', transfer.booking_week_id);

  if (validatedSetupIntent) {
    const setupIntent = validatedSetupIntent;
    // The guards in the validation block above ensure payment_method is an
    // expanded object; narrow again here for the type-checker.
    if (typeof setupIntent.payment_method === 'string' || !setupIntent.payment_method) {
      throw new Error('setup_intent_not_ready');
    }
    await supabaseServer
      .from('stay_guarantees')
      .update({
        stripe_customer_id: String(setupIntent.customer),
        stripe_setup_intent_id: setupIntent.id,
        stripe_payment_method_id: setupIntent.payment_method.id,
        card_brand: setupIntent.payment_method.card?.brand ?? null,
        card_last4: setupIntent.payment_method.card?.last4 ?? null,
        replaced_at: new Date().toISOString(),
      })
      .eq('booking_id', bookingWeek.booking_id);
  }

  const { data: updated, error: tErr } = await supabaseServer
    .from('stay_transfers')
    .update({
      to_member_id: recipient.id,
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    })
    .eq('id', transfer.id)
    .select('*')
    .single();
  if (tErr) throw tErr;
  return updated;
}
