import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.warn(
    '[Stripe] STRIPE_SECRET_KEY is not set. Checkout API will return 500 until it is configured.'
  );
}

const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2024-12-18.acacia',
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

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[Stripe Checkout] Error creating session', error);
    return NextResponse.json({ error: 'Failed to create checkout session.' }, { status: 500 });
  }
}

