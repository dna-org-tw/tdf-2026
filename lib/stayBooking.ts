import { supabaseServer } from '@/lib/supabaseServer';
import { isStayBookable } from '@/lib/stayTime';
import {
  getStayWeeksByCodes,
  getWeekOccupancy,
  getPendingWaitlistHoldCount,
  getStayBookingForEmail,
  getStayWeekByCode,
} from '@/lib/stayQueries';
import { stayStripe } from '@/lib/stayStripe';
import type { StayBookingType } from '@/lib/stayTypes';

export interface CreateStayBookingInput {
  memberId: number;
  memberEmail: string;
  primaryGuestName: string;
  primaryGuestPhone: string;
  guestCount: 1 | 2;
  secondGuestName?: string | null;
  weekCodes: string[];
  inviteCode?: string | null;
  setupIntentId?: string | null;
}

export async function createStayBooking(input: CreateStayBookingInput) {
  if (!supabaseServer) throw new Error('db_not_configured');

  const weeks = await getStayWeeksByCodes(input.weekCodes);
  if (weeks.length !== input.weekCodes.length) throw new Error('week_not_found');

  for (const week of weeks) {
    if (week.status !== 'active' || !isStayBookable(week.starts_on)) throw new Error('booking_closed');
    const [occupancy, holds] = await Promise.all([
      getWeekOccupancy(week.id),
      getPendingWaitlistHoldCount(week.id),
    ]);
    if (occupancy + holds >= week.room_capacity) throw new Error('week_sold_out');
  }

  const bookingType: StayBookingType = input.inviteCode ? 'complimentary' : 'guaranteed';
  const { data: booking, error: bookingErr } = await supabaseServer
    .from('stay_bookings')
    .insert({
      member_id: input.memberId,
      status: 'confirmed',
      booking_type: bookingType,
      primary_guest_name: input.primaryGuestName,
      primary_guest_email: input.memberEmail,
      primary_guest_phone: input.primaryGuestPhone,
      guest_count: input.guestCount,
      second_guest_name: input.secondGuestName ?? null,
    })
    .select('*')
    .single();
  if (bookingErr || !booking) throw bookingErr ?? new Error('booking_insert_failed');

  const { error: weekErr } = await supabaseServer.from('stay_booking_weeks').insert(
    weeks.map((week) => ({
      booking_id: booking.id,
      member_id: input.memberId,
      week_id: week.id,
      status: 'confirmed',
      booked_price_twd: week.price_twd,
    })),
  );
  if (weekErr) throw weekErr;

  if (bookingType === 'complimentary') {
    const { data: codeRow } = await supabaseServer
      .from('stay_invite_codes')
      .select('id')
      .eq('code', input.inviteCode!)
      .eq('status', 'active')
      .maybeSingle();
    if (!codeRow) throw new Error('invite_code_invalid');

    await supabaseServer.from('stay_invite_codes').update({
      status: 'used',
      used_by_member_id: input.memberId,
      used_by_booking_id: booking.id,
      used_at: new Date().toISOString(),
    }).eq('id', codeRow.id);

    await supabaseServer.from('stay_guarantees').insert({
      booking_id: booking.id,
      guarantee_type: 'complimentary',
    });
    return booking;
  }

  if (!stayStripe) throw new Error('stripe_not_configured');
  if (!input.setupIntentId) throw new Error('setup_intent_required');

  const setupIntent = await stayStripe.setupIntents.retrieve(input.setupIntentId, {
    expand: ['payment_method'],
  });
  if (
    setupIntent.status !== 'succeeded' ||
    typeof setupIntent.payment_method === 'string' ||
    !setupIntent.payment_method ||
    !setupIntent.customer
  ) {
    throw new Error('setup_intent_not_ready');
  }

  await supabaseServer.from('stay_guarantees').insert({
    booking_id: booking.id,
    guarantee_type: 'stripe_card',
    stripe_customer_id: String(setupIntent.customer),
    stripe_setup_intent_id: setupIntent.id,
    stripe_payment_method_id: setupIntent.payment_method.id,
    card_brand: setupIntent.payment_method.card?.brand ?? null,
    card_last4: setupIntent.payment_method.card?.last4 ?? null,
    consented_at: new Date().toISOString(),
  });

  return booking;
}

export async function modifyStayWeek(input: {
  bookingId: string;
  bookingWeekId: string;
  targetWeekCode: string;
  ownerEmail: string;
}) {
  if (!supabaseServer) throw new Error('db_not_configured');

  const booking = await getStayBookingForEmail(input.bookingId, input.ownerEmail);
  if (!booking) throw new Error('booking_not_found');

  const targetWeek = await getStayWeekByCode(input.targetWeekCode);
  if (!targetWeek || !isStayBookable(targetWeek.starts_on)) throw new Error('target_week_closed');

  const occupancy = await getWeekOccupancy(targetWeek.id);
  if (occupancy >= targetWeek.room_capacity) throw new Error('target_week_full');

  const { error: outErr } = await supabaseServer
    .from('stay_booking_weeks')
    .update({ status: 'modified_out', updated_at: new Date().toISOString() })
    .eq('id', input.bookingWeekId)
    .eq('booking_id', input.bookingId);
  if (outErr) throw outErr;

  const { error: inErr } = await supabaseServer
    .from('stay_booking_weeks')
    .insert({
      booking_id: input.bookingId,
      member_id: booking.member_id,
      week_id: targetWeek.id,
      status: 'modified_in',
      booked_price_twd: targetWeek.price_twd,
    });
  if (inErr) throw inErr;

  return getStayBookingForEmail(input.bookingId, input.ownerEmail);
}
