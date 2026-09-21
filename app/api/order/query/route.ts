import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSessionFromRequest } from '@/lib/auth';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2025-12-15.clover',
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

    // Require authenticated session
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required. Please log in.' },
        { status: 401 }
      );
    }

    const email = session.email;

    // Query Stripe checkout sessions by the authenticated user's email
    const checkoutSessions = await stripe.checkout.sessions.list({
      customer_details: { email },
      limit: 10,
      expand: ['data.payment_intent', 'data.line_items', 'data.line_items.data.price.product'],
    });

    const orders = await Promise.all(
      checkoutSessions.data.map(async (cs) => {
        const paymentIntent = cs.payment_intent as Stripe.PaymentIntent | null;

        let charge: Stripe.Charge | null = null;
        if (paymentIntent?.latest_charge) {
          const chargeId =
            typeof paymentIntent.latest_charge === 'string'
              ? paymentIntent.latest_charge
              : paymentIntent.latest_charge.id;
          try {
            charge = await stripe.charges.retrieve(chargeId);
          } catch (error) {
            console.error('[Stripe] Error retrieving charge:', error);
          }
        }

        const lineItems = cs.line_items?.data || [];
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

        const totalDetails = cs.total_details;
        const discount = cs.total_details?.amount_discount
          ? {
              amount: cs.total_details.amount_discount,
              amount_tax: cs.total_details.amount_tax || 0,
            }
          : null;

        const customerDetails = cs.customer_details
          ? {
              email: cs.customer_details.email,
              name: cs.customer_details.name,
              phone: cs.customer_details.phone,
              address: cs.customer_details.address
                ? {
                    line1: cs.customer_details.address.line1,
                    line2: cs.customer_details.address.line2,
                    city: cs.customer_details.address.city,
                    state: cs.customer_details.address.state,
                    postal_code: cs.customer_details.address.postal_code,
                    country: cs.customer_details.address.country,
                  }
                : null,
            }
          : null;

        return {
          id: cs.id,
          status: cs.status,
          payment_status: cs.payment_status,
          amount_subtotal: cs.amount_subtotal,
          amount_total: cs.amount_total,
          amount_tax: totalDetails?.amount_tax || 0,
          amount_discount: totalDetails?.amount_discount || 0,
          currency: cs.currency,
          customer_email: cs.customer_details?.email,
          customer_name: cs.customer_details?.name,
          customer_phone: cs.customer_details?.phone,
          customer_address: customerDetails?.address || null,
          created: cs.created,
          ticket_tier: cs.metadata?.ticket_tier,
          payment_method_brand: charge?.payment_method_details?.card?.brand,
          payment_method_last4: charge?.payment_method_details?.card?.last4,
          payment_method_type: charge?.payment_method_details?.type,
          line_items: lineItemsDetails,
          discount: discount,
          invoice: cs.invoice ? (typeof cs.invoice === 'string' ? cs.invoice : cs.invoice.id) : null,
          payment_intent_id: paymentIntent?.id || null,
        };
      })
    );

    return NextResponse.json({ orders });
  } catch (error) {
    console.error('[Order Query] Error retrieving orders', error);
    return NextResponse.json(
      { error: 'Failed to retrieve order details. Please try again later.' },
      { status: 500 }
    );
  }
}
