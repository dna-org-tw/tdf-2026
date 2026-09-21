import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';
import { chargeStayNoShow } from '@/lib/stayStripe';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'db' }, { status: 500 });

  const { id } = await ctx.params; // this is a booking_week_id
  const { data: bookingWeek, error: bwErr } = await supabaseServer
    .from('stay_booking_weeks')
    .select('id, booked_price_twd, booking_id, status')
    .eq('id', id)
    .maybeSingle();
  if (bwErr) return NextResponse.json({ error: bwErr.message }, { status: 500 });
  if (!bookingWeek) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data: guarantee } = await supabaseServer
    .from('stay_guarantees')
    .select('stripe_customer_id, stripe_payment_method_id')
    .eq('booking_id', bookingWeek.booking_id)
    .eq('guarantee_type', 'stripe_card')
    .maybeSingle();
  if (!guarantee?.stripe_customer_id || !guarantee?.stripe_payment_method_id) {
    return NextResponse.json({ error: 'missing_guarantee' }, { status: 400 });
  }

  try {
    const paymentIntent = await chargeStayNoShow({
      customerId: guarantee.stripe_customer_id,
      paymentMethodId: guarantee.stripe_payment_method_id,
      amountTwd: bookingWeek.booked_price_twd,
      statementDescriptorSuffix: 'NOSHOW',
    });

    await supabaseServer.from('stay_charge_attempts').insert({
      booking_week_id: bookingWeek.id,
      reason: 'no_show',
      amount_twd: bookingWeek.booked_price_twd,
      stripe_payment_intent_id: paymentIntent.id,
      status: 'succeeded',
      created_by: session.email,
    });

    await supabaseServer
      .from('stay_booking_weeks')
      .update({ status: 'no_show', updated_at: new Date().toISOString() })
      .eq('id', bookingWeek.id);

    return NextResponse.json({ ok: true, paymentIntentId: paymentIntent.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'charge_failed';
    await supabaseServer.from('stay_charge_attempts').insert({
      booking_week_id: bookingWeek.id,
      reason: 'no_show',
      amount_twd: bookingWeek.booked_price_twd,
      status: 'failed',
      error_message: message,
      created_by: session.email,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
