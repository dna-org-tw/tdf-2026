import { NextRequest, NextResponse } from 'next/server';
import { resolveMemberFromSession } from '@/lib/memberSession';
import { supabaseServer } from '@/lib/supabaseServer';
import {
  detachPaymentMethod,
  extractCardInfo,
  retrieveSetupIntentWithCard,
  stripeOffSession,
} from '@/lib/stripeOffSession';
import { isPastCutoff } from '@/lib/lumaCutoff';

export const dynamic = 'force-dynamic';

type PaymentMethodRow = {
  stripe_customer_id: string;
  default_payment_method_id: string;
  card_brand: string | null;
  card_last4: string | null;
  card_exp_month: number | null;
  card_exp_year: number | null;
  attached_at: string;
};

function shapeForClient(row: PaymentMethodRow | null) {
  if (!row) return null;
  return {
    brand: row.card_brand,
    last4: row.card_last4,
    expMonth: row.card_exp_month,
    expYear: row.card_exp_year,
    attachedAt: row.attached_at,
  };
}

export async function GET(req: NextRequest) {
  const ctx = await resolveMemberFromSession(req);
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'db' }, { status: 500 });

  const { data, error } = await supabaseServer
    .from('member_payment_methods')
    .select('stripe_customer_id, default_payment_method_id, card_brand, card_last4, card_exp_month, card_exp_year, attached_at')
    .eq('member_id', ctx.memberId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ paymentMethod: shapeForClient(data) });
}

// Persist a payment method captured via SetupIntent on the client.
// Body: { setupIntentId: string }
// Verifies the SetupIntent succeeded, belongs to this user's Stripe Customer,
// and has a card-type payment_method. If the member already has a payment
// method on file, detach the old one before overwriting.
export async function POST(req: NextRequest) {
  const ctx = await resolveMemberFromSession(req);
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'db' }, { status: 500 });
  if (!stripeOffSession) return NextResponse.json({ error: 'stripe_not_configured' }, { status: 500 });

  let body: { setupIntentId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const setupIntentId = body.setupIntentId?.trim();
  if (!setupIntentId) return NextResponse.json({ error: 'missing_setup_intent' }, { status: 400 });

  let setupIntent: Awaited<ReturnType<typeof retrieveSetupIntentWithCard>>;
  try {
    setupIntent = await retrieveSetupIntentWithCard(setupIntentId);
  } catch (err) {
    return NextResponse.json(
      { error: 'setup_intent_lookup_failed', detail: (err as Error).message },
      { status: 400 },
    );
  }
  if (setupIntent.status !== 'succeeded') {
    return NextResponse.json({ error: 'setup_intent_not_succeeded', status: setupIntent.status }, { status: 400 });
  }
  const customerId = typeof setupIntent.customer === 'string'
    ? setupIntent.customer
    : setupIntent.customer?.id ?? null;
  const paymentMethod = typeof setupIntent.payment_method === 'object' ? setupIntent.payment_method : null;
  const paymentMethodId = typeof setupIntent.payment_method === 'string'
    ? setupIntent.payment_method
    : paymentMethod?.id ?? null;
  if (!customerId || !paymentMethodId) {
    return NextResponse.json({ error: 'setup_intent_incomplete' }, { status: 400 });
  }

  // Verify the customer belongs to this email — protects against a malicious
  // client passing a SetupIntent ID belonging to someone else's session.
  const customer = await stripeOffSession.customers.retrieve(customerId);
  if (customer.deleted || customer.email?.toLowerCase() !== ctx.email) {
    return NextResponse.json({ error: 'customer_email_mismatch' }, { status: 403 });
  }

  // Replace any existing PM (detach first to avoid orphan PMs at Stripe).
  const { data: existing } = await supabaseServer
    .from('member_payment_methods')
    .select('default_payment_method_id')
    .eq('member_id', ctx.memberId)
    .maybeSingle();
  if (existing?.default_payment_method_id && existing.default_payment_method_id !== paymentMethodId) {
    try {
      await detachPaymentMethod(existing.default_payment_method_id);
    } catch (err) {
      console.warn(`[me/payment-method] detach old PM failed: ${(err as Error).message}`);
    }
  }

  const card = extractCardInfo(paymentMethod ?? paymentMethodId);
  const { error: upsertErr } = await supabaseServer
    .from('member_payment_methods')
    .upsert(
      {
        member_id: ctx.memberId,
        stripe_customer_id: customerId,
        default_payment_method_id: paymentMethodId,
        card_brand: card.brand,
        card_last4: card.last4,
        card_exp_month: card.expMonth,
        card_exp_year: card.expYear,
      },
      { onConflict: 'member_id' },
    );
  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  return NextResponse.json({
    paymentMethod: {
      brand: card.brand,
      last4: card.last4,
      expMonth: card.expMonth,
      expYear: card.expYear,
      attachedAt: new Date().toISOString(),
    },
  });
}

// Remove the saved payment method. Refuses if the member has any active
// confirmations on future events that have not yet hit cutoff (the user
// must cancel those confirmations first — otherwise removing the card would
// silently free them from the guarantee).
export async function DELETE(req: NextRequest) {
  const ctx = await resolveMemberFromSession(req);
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'db' }, { status: 500 });

  // Find active confirmations where cutoff is still in the future. Only
  // consider events whose admin has opted into the confirmation mechanism;
  // confirmations on non-opted-in events don't bind the member to anything.
  const { data: confirmations, error: confErr } = await supabaseServer
    .from('event_confirmations')
    .select('event_api_id, luma_events!inner(start_at, requires_confirmation)')
    .eq('member_id', ctx.memberId)
    .eq('status', 'confirmed')
    .eq('luma_events.requires_confirmation', true);
  if (confErr) return NextResponse.json({ error: confErr.message }, { status: 500 });

  const now = new Date();
  const blocking = (confirmations ?? []).filter((row) => {
    const ev = (row as unknown as {
      luma_events: { start_at: string | null } | { start_at: string | null }[] | null;
    }).luma_events;
    const startAt = Array.isArray(ev) ? ev[0]?.start_at : ev?.start_at;
    if (!startAt) return false;
    return !isPastCutoff(startAt, now);
  });
  if (blocking.length > 0) {
    return NextResponse.json(
      {
        error: 'has_active_confirmations',
        blockingEventApiIds: blocking.map((r) => r.event_api_id),
      },
      { status: 409 },
    );
  }

  const { data: existing } = await supabaseServer
    .from('member_payment_methods')
    .select('default_payment_method_id')
    .eq('member_id', ctx.memberId)
    .maybeSingle();
  if (existing?.default_payment_method_id) {
    try {
      await detachPaymentMethod(existing.default_payment_method_id);
    } catch (err) {
      console.warn(`[me/payment-method] detach during DELETE failed: ${(err as Error).message}`);
    }
  }

  const { error: delErr } = await supabaseServer
    .from('member_payment_methods')
    .delete()
    .eq('member_id', ctx.memberId);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
