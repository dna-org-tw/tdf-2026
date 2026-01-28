import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2024-12-18.acacia',
    })
  : null;

export async function GET(req: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe is not configured on the server.' },
        { status: 500 }
      );
    }

    const sessionId = req.nextUrl.searchParams.get('id');

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing session id.' }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent', 'line_items', 'line_items.data.price.product'],
    });

    const paymentIntent = session.payment_intent as Stripe.PaymentIntent | null;

    const charge = paymentIntent?.charges?.data?.[0];

    // Extract line items details
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

    // Extract discount information
    const totalDetails = session.total_details;
    const discount = session.total_details?.amount_discount
      ? {
          amount: session.total_details.amount_discount,
          amount_tax: session.total_details.amount_tax || 0,
        }
      : null;

    // Extract customer details
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
    console.error('[Stripe Checkout] Error retrieving session', error);
    return NextResponse.json({ error: 'Failed to load order details.' }, { status: 500 });
  }
}

