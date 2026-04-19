import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createOrder } from '@/lib/orders';
import { verifyRecaptcha } from '@/lib/recaptcha';
import { isTicketSaleClosed, getTicketSaleCutoff } from '@/lib/ticketSaleCutoff';

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

const PRICE_IDS: Record<'explore' | 'contribute' | 'weekly_backer' | 'backer', string | undefined> = {
  explore: process.env.STRIPE_PRICE_EXPLORE,
  contribute: process.env.STRIPE_PRICE_CONTRIBUTE,
  weekly_backer: process.env.STRIPE_PRICE_WEEKLY_BACKER,
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

    if (await isTicketSaleClosed()) {
      const cutoff = await getTicketSaleCutoff();
      return NextResponse.json(
        { error: 'sales_closed', cutoff: cutoff.toISOString() },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => null);

    const rc = await verifyRecaptcha(body?.recaptchaToken, 'checkout');
    if (!rc.ok) {
      if (rc.reason === 'not_configured') {
        return NextResponse.json(
          { error: 'reCAPTCHA is not configured on the server.' },
          { status: 500 }
        );
      }
      if (rc.reason === 'missing_token') {
        return NextResponse.json(
          { error: 'reCAPTCHA verification is required' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'reCAPTCHA verification failed' },
        { status: 400 }
      );
    }

    const tier: 'explore' | 'contribute' | 'weekly_backer' | 'backer' | undefined = body?.tier;
    const week: string | undefined = body?.week;

    if (!tier || !['explore', 'contribute', 'weekly_backer', 'backer'].includes(tier)) {
      return NextResponse.json({ error: 'Invalid ticket tier.' }, { status: 400 });
    }

    // Weekly Backer requires week selection
    if (tier === 'weekly_backer' && (!week || !['week1', 'week2', 'week3', 'week4'].includes(week))) {
      return NextResponse.json({ error: 'Week selection is required for Weekly Backer.' }, { status: 400 });
    }

    const priceId = PRICE_IDS[tier];

    if (!priceId) {
      return NextResponse.json(
        { error: `Stripe price ID not configured for tier: ${tier}` },
        { status: 500 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    // Read discount code from cookie and auto-apply Stripe promotion code
    const discountCode = req.cookies.get('discount_code')?.value;
    let stripePromotionCodeId: string | undefined;

    if (discountCode) {
      try {
        const promoCodes = await stripe.promotionCodes.list({
          code: discountCode,
          active: true,
          limit: 1,
        });
        if (promoCodes.data.length > 0) {
          stripePromotionCodeId = promoCodes.data[0].id;
        } else {
          console.warn(`[Checkout] Promotion code not found or inactive: ${discountCode}`);
        }
      } catch (err) {
        console.error('[Checkout] Error looking up promotion code:', err);
      }
    }

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
      ...(stripePromotionCodeId
        ? { discounts: [{ promotion_code: stripePromotionCodeId }] }
        : { allow_promotion_codes: true }),
      tax_id_collection: {
        enabled: true,
      },
      ...(week ? { metadata: { week } } : {}),
    });

    const visitorFingerprint = body?.visitor_fingerprint ?? null;

    // Create order record in Supabase (amounts set to 0; updated later by webhook/sync with actual Stripe amounts)
    const order = await createOrder({
      stripe_session_id: session.id,
      ticket_tier: tier,
      amount_subtotal: 0,
      amount_total: 0,
      amount_tax: 0,
      amount_discount: 0,
      currency: 'usd',
      visitor_fingerprint: visitorFingerprint,
    });

    if (!order) {
      console.warn('[Checkout] Failed to create order in Supabase, but Stripe session was created:', session.id);
      // Don't block the response since the Stripe session was created successfully
    } else {
      console.log('[Checkout] Order created in Supabase:', order.id);
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[Stripe Checkout] Error creating session', error);
    return NextResponse.json({ error: 'Failed to create checkout session.' }, { status: 500 });
  }
}

