import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createOrder } from '@/lib/orders';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.warn(
    '[Stripe] STRIPE_SECRET_KEY is not set. Checkout API will return 500 until it is configured.'
  );
}

const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2025-12-15.clover',
    })
  : null;

const PRICE_IDS: Record<'explore' | 'contribute' | 'backer', string | undefined> = {
  explore: process.env.STRIPE_PRICE_EXPLORE,
  contribute: process.env.STRIPE_PRICE_CONTRIBUTE,
  backer: process.env.STRIPE_PRICE_BACKER,
};

export async function POST(req: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe is not configured on the server.' },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);

    const tier: 'explore' | 'contribute' | 'backer' | undefined = body?.tier;

    if (!tier || !['explore', 'contribute', 'backer'].includes(tier)) {
      return NextResponse.json({ error: 'Invalid ticket tier.' }, { status: 400 });
    }

    const priceId = PRICE_IDS[tier];

    if (!priceId) {
      return NextResponse.json(
        { error: `Stripe price ID not configured for tier: ${tier}` },
        { status: 500 }
      );
    }

    // 獲取價格資訊以獲取金額
    const price = await stripe.prices.retrieve(priceId);
    const amount = price.unit_amount || 0;

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}&tier=${tier}`,
      cancel_url: `${baseUrl}/checkout/cancelled?session_id={CHECKOUT_SESSION_ID}&tier=${tier}`,
      allow_promotion_codes: true,
      metadata: {
        ticket_tier: tier,
      },
    });

    const visitorFingerprint = body?.visitor_fingerprint ?? null;

    // 在 Supabase 中创建订单记录
    const order = await createOrder({
      stripe_session_id: session.id,
      ticket_tier: tier,
      amount_subtotal: amount,
      amount_total: amount,
      amount_tax: 0,
      amount_discount: 0,
      currency: price.currency || 'usd',
      visitor_fingerprint: visitorFingerprint,
    });

    if (!order) {
      console.warn('[Checkout] Failed to create order in Supabase, but Stripe session was created:', session.id);
      // 不阻止返回，因為 Stripe session 已建立成功
    } else {
      console.log('[Checkout] Order created in Supabase:', order.id);
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[Stripe Checkout] Error creating session', error);
    return NextResponse.json({ error: 'Failed to create checkout session.' }, { status: 500 });
  }
}

