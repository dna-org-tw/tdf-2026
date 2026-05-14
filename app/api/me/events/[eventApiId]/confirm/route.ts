import { NextRequest, NextResponse } from 'next/server';
import { resolveMemberFromSession } from '@/lib/memberSession';
import { supabaseServer } from '@/lib/supabaseServer';
import { isPastCutoff } from '@/lib/lumaCutoff';

export const dynamic = 'force-dynamic';

// Member confirms intent to attend a Luma event they've already RSVP'd to.
// Preconditions (all must hold):
//   - Caller has a luma_guests row for (member, event)
//   - Event start_at exists and cutoff has not passed
//   - Member has bound a payment method (required only if event has a
//     Standard Ticket price; free events confirm without a card)
// Snapshots the payment_method + customer at confirmation time so a later
// card change/removal cannot retroactively neutralize the guarantee.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventApiId: string }> },
) {
  const ctx = await resolveMemberFromSession(req);
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'db' }, { status: 500 });

  const { eventApiId } = await params;
  if (!eventApiId) return NextResponse.json({ error: 'missing_event_api_id' }, { status: 400 });

  // Verify the member actually registered for this event on Luma.
  const { data: guest, error: guestErr } = await supabaseServer
    .from('luma_guests')
    .select('id, activity_status')
    .eq('event_api_id', eventApiId)
    .eq('member_id', ctx.memberId)
    .maybeSingle();
  if (guestErr) return NextResponse.json({ error: guestErr.message }, { status: 500 });
  if (!guest) return NextResponse.json({ error: 'not_registered' }, { status: 404 });

  // Event must exist, have a start_at, and be opted into the confirmation
  // mechanism by an admin (requires_confirmation = true).
  const { data: event, error: eventErr } = await supabaseServer
    .from('luma_events')
    .select('start_at, standard_ticket_price_twd, requires_confirmation')
    .eq('event_api_id', eventApiId)
    .maybeSingle();
  if (eventErr) return NextResponse.json({ error: eventErr.message }, { status: 500 });
  if (!event) return NextResponse.json({ error: 'event_not_found' }, { status: 404 });
  if (!event.start_at) return NextResponse.json({ error: 'event_missing_start_at' }, { status: 400 });
  if (!event.requires_confirmation) {
    return NextResponse.json({ error: 'event_does_not_require_confirmation' }, { status: 400 });
  }

  if (isPastCutoff(event.start_at, new Date())) {
    return NextResponse.json({ error: 'cutoff_passed' }, { status: 409 });
  }

  // Payment method required if the event is billable (has Standard Ticket price).
  const isBillable = (event.standard_ticket_price_twd ?? 0) > 0;
  let pmCustomerId: string | null = null;
  let pmPaymentMethodId: string | null = null;
  if (isBillable) {
    const { data: pm } = await supabaseServer
      .from('member_payment_methods')
      .select('stripe_customer_id, default_payment_method_id')
      .eq('member_id', ctx.memberId)
      .maybeSingle();
    if (!pm) return NextResponse.json({ error: 'payment_method_required' }, { status: 412 });
    pmCustomerId = pm.stripe_customer_id;
    pmPaymentMethodId = pm.default_payment_method_id;
  }

  const { error: upsertErr } = await supabaseServer
    .from('event_confirmations')
    .upsert(
      {
        member_id: ctx.memberId,
        event_api_id: eventApiId,
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        cancelled_at: null,
        payment_method_id_snapshot: pmPaymentMethodId,
        stripe_customer_id_snapshot: pmCustomerId,
      },
      { onConflict: 'member_id,event_api_id' },
    );
  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, status: 'confirmed' });
}
