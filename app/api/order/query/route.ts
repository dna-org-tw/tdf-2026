import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const recaptchaApiKey = process.env.RECAPTCHA_API_KEY;
const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '6Lcu81gsAAAAAIrVoGK7urIEt9_w7gOoUSjzC5Uv';
const recaptchaProjectId = process.env.RECAPTCHA_PROJECT_ID || 'tdna-1769599168858';

const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2025-12-15.clover',
    })
  : null;

export async function POST(req: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe is not configured on the server.' },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const { orderId, email, recaptchaToken } = body;

    if (!orderId && !email) {
      return NextResponse.json({ error: 'Order ID or email is required.' }, { status: 400 });
    }

    // Verify reCAPTCHA Enterprise
    if (recaptchaApiKey) {
      if (!recaptchaToken) {
        return NextResponse.json({ error: 'reCAPTCHA verification is required.' }, { status: 400 });
      }

      try {
        const requestBody = {
          event: {
            token: recaptchaToken,
            expectedAction: 'submit',
            siteKey: recaptchaSiteKey,
          },
        };

        const recaptchaResponse = await fetch(
          `https://recaptchaenterprise.googleapis.com/v1/projects/${recaptchaProjectId}/assessments?key=${recaptchaApiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          }
        );

        if (!recaptchaResponse.ok) {
          const errorData = await recaptchaResponse.text();
          console.error('[reCAPTCHA Enterprise] API error:', errorData);
          return NextResponse.json(
            { error: 'reCAPTCHA verification failed. Please try again.' },
            { status: 400 }
          );
        }

        const recaptchaData = await recaptchaResponse.json();

        if (!recaptchaData.tokenProperties?.valid || recaptchaData.tokenProperties?.action !== 'submit') {
          return NextResponse.json(
            { error: 'reCAPTCHA verification failed. Please try again.' },
            { status: 400 }
          );
        }

        if (recaptchaData.riskAnalysis?.score !== undefined) {
          const score = recaptchaData.riskAnalysis.score;
          if (score < 0.5) {
            return NextResponse.json(
              { error: 'reCAPTCHA verification failed. Please try again.' },
              { status: 400 }
            );
          }
        }
      } catch (error) {
        console.error('[reCAPTCHA Enterprise] Verification error:', error);
        return NextResponse.json(
          { error: 'reCAPTCHA verification failed. Please try again.' },
          { status: 400 }
        );
      }
    }

    // Query by email - return list of orders
    if (email) {
      const sessions = await stripe.checkout.sessions.list({
        customer_details: { email: email.trim().toLowerCase() },
        limit: 100,
        expand: ['data.line_items'],
      });

      if (!sessions.data.length) {
        return NextResponse.json(
          { error: 'No orders found for this email address.' },
          { status: 404 }
        );
      }

      const orders = sessions.data.map((s) => {
        const firstItem = s.line_items?.data?.[0];
        const product = firstItem?.price?.product as Stripe.Product | string | null;
        return {
          id: s.id,
          status: s.status,
          payment_status: s.payment_status,
          amount_total: s.amount_total,
          currency: s.currency,
          created: s.created,
          customer_name: s.customer_details?.name,
          ticket_tier: s.metadata?.ticket_tier,
          product_name: typeof product === 'object' && product ? product.name : (firstItem?.description || null),
        };
      });

      return NextResponse.json({ orders });
    }

    // Query by order ID - return single order detail
    let session;
    
    try {
      session = await stripe.checkout.sessions.retrieve(orderId, {
        expand: ['payment_intent', 'payment_intent.latest_charge', 'line_items', 'line_items.data.price.product'],
      });
    } catch (error) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(orderId);
        if (paymentIntent.metadata?.checkout_session_id) {
          session = await stripe.checkout.sessions.retrieve(
            paymentIntent.metadata.checkout_session_id,
            {
              expand: ['payment_intent', 'payment_intent.latest_charge', 'line_items', 'line_items.data.price.product'],
            }
          );
        } else {
          return NextResponse.json(
            { error: 'Order not found. Please check your order ID.' },
            { status: 404 }
          );
        }
      } catch (err) {
        return NextResponse.json(
          { error: 'Order not found. Please check your order ID.' },
          { status: 404 }
        );
      }
    }

    const paymentIntent = session.payment_intent as Stripe.PaymentIntent | null;

    let charge: Stripe.Charge | null = null;
    if (paymentIntent?.latest_charge && stripe) {
      const chargeId = typeof paymentIntent.latest_charge === 'string' 
        ? paymentIntent.latest_charge 
        : paymentIntent.latest_charge.id;
      try {
        charge = await stripe.charges.retrieve(chargeId);
      } catch (error) {
        console.error('[Stripe] Error retrieving charge:', error);
      }
    }

    const lineItems = session.line_items?.data || [];
    const lineItemsDetails = lineItems.map((item) => {
      const price = item.price;
      const product = price?.product as Stripe.Product | string | null;
      return {
        id: item.id,
        description: item.description,
        amount: item.amount_total,
        currency: item.currency,
        quantity: item.quantity,
        price_unit: item.price?.unit_amount,
        product_name: typeof product === 'object' && product ? product.name : null,
        product_description: typeof product === 'object' && product ? product.description : null,
      };
    });

    const totalDetails = session.total_details;
    const discount = session.total_details?.amount_discount
      ? {
          amount: session.total_details.amount_discount,
          amount_tax: session.total_details.amount_tax || 0,
        }
      : null;

    const customerDetails = session.customer_details
      ? {
          email: session.customer_details.email,
          name: session.customer_details.name,
          phone: session.customer_details.phone,
          address: session.customer_details.address
            ? {
                line1: session.customer_details.address.line1,
                line2: session.customer_details.address.line2,
                city: session.customer_details.address.city,
                state: session.customer_details.address.state,
                postal_code: session.customer_details.address.postal_code,
                country: session.customer_details.address.country,
              }
            : null,
        }
      : null;

    const safeResponse = {
      id: session.id,
      status: session.status,
      payment_status: session.payment_status,
      amount_subtotal: session.amount_subtotal,
      amount_total: session.amount_total,
      amount_tax: totalDetails?.amount_tax || 0,
      amount_discount: totalDetails?.amount_discount || 0,
      currency: session.currency,
      customer_email: session.customer_details?.email,
      customer_name: session.customer_details?.name,
      customer_phone: session.customer_details?.phone,
      customer_address: customerDetails?.address || null,
      created: session.created,
      ticket_tier: session.metadata?.ticket_tier,
      payment_method_brand: charge?.payment_method_details?.card?.brand,
      payment_method_last4: charge?.payment_method_details?.card?.last4,
      payment_method_type: charge?.payment_method_details?.type,
      line_items: lineItemsDetails,
      discount: discount,
      invoice: session.invoice ? (typeof session.invoice === 'string' ? session.invoice : session.invoice.id) : null,
      payment_intent_id: paymentIntent?.id || null,
    };

    return NextResponse.json(safeResponse);
  } catch (error) {
    console.error('[Order Query] Error retrieving order', error);
    return NextResponse.json(
      { error: 'Failed to retrieve order details. Please try again later.' },
      { status: 500 }
    );
  }
}
