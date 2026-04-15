import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { updateOrder, createOrder } from '@/lib/orders';
import { getAdminSession } from '@/lib/adminAuth';
import type { OrderStatus } from '@/lib/types/order';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2025-12-15.clover',
    })
  : null;

/**
 * Map Stripe payment status to order status
 */
function mapPaymentStatusToOrderStatus(
  paymentStatus: string | null,
  sessionStatus: string | null
): OrderStatus {
  if (sessionStatus === 'complete' && paymentStatus === 'paid') {
    return 'paid';
  }
  if (sessionStatus === 'complete' && paymentStatus === 'no_payment_required') {
    return 'paid';
  }
  // session expired or incomplete and unpaid -> cancelled
  if (sessionStatus === 'expired' || (sessionStatus !== 'complete' && paymentStatus === 'unpaid')) {
    return 'cancelled';
  }
  if (paymentStatus === 'unpaid' || paymentStatus === 'no_payment_required') {
    return 'pending';
  }
  return 'pending';
}

export async function POST(req: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe is not configured on the server.' },
        { status: 500 }
      );
    }

    // Auth: require admin session OR internal API secret (for webhook handler)
    const internalSecret = req.headers.get('x-internal-secret');
    const hasValidInternalSecret =
      internalSecret && process.env.INTERNAL_API_SECRET && internalSecret === process.env.INTERNAL_API_SECRET;

    if (!hasValidInternalSecret) {
      const adminSession = await getAdminSession(req);
      if (!adminSession) {
        return NextResponse.json(
          { error: 'Unauthorized. Admin access or internal secret required.' },
          { status: 401 }
        );
      }
    }

    const body = await req.json().catch(() => null);

    if (!body || !body.session_id) {
      return NextResponse.json(
        { error: 'Missing session_id in request body.' },
        { status: 400 }
      );
    }

    const sessionId = body.session_id as string;

    // Retrieve latest session info from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent', 'payment_intent.latest_charge', 'line_items'],
    });

    // Get payment details
    let charge: Stripe.Charge | null = null;
    const paymentIntent = session.payment_intent as Stripe.PaymentIntent | null;

    if (paymentIntent?.latest_charge) {
      const chargeId =
        typeof paymentIntent.latest_charge === 'string'
          ? paymentIntent.latest_charge
          : paymentIntent.latest_charge.id;

      try {
        charge = await stripe.charges.retrieve(chargeId);
      } catch (err) {
        console.error('[Order Sync] Error retrieving charge:', err);
      }
    }

    // Extract customer info
    const customerDetails = session.customer_details;
    const customerAddress = customerDetails?.address
      ? {
          line1: customerDetails.address.line1 || null,
          line2: customerDetails.address.line2 || null,
          city: customerDetails.address.city || null,
          state: customerDetails.address.state || null,
          postal_code: customerDetails.address.postal_code || null,
          country: customerDetails.address.country || null,
        }
      : null;

    // Extract payment method info
    const paymentMethodBrand = charge?.payment_method_details?.card?.brand || null;
    const paymentMethodLast4 = charge?.payment_method_details?.card?.last4 || null;
    const paymentMethodType = charge?.payment_method_details?.type || null;

    // Determine order status from Stripe session (no force_status override)
    const orderStatus = mapPaymentStatusToOrderStatus(
      session.payment_status,
      session.status
    );

    // Update order
    const orderUpdateData = {
      stripe_payment_intent_id:
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id || null,
      status: orderStatus,
      amount_subtotal: session.amount_subtotal || 0,
      amount_total: session.amount_total || 0,
      amount_tax: session.total_details?.amount_tax || 0,
      amount_discount: session.total_details?.amount_discount || 0,
      customer_email: customerDetails?.email || null,
      customer_name: customerDetails?.name || null,
      customer_phone: customerDetails?.phone || null,
      customer_address: customerAddress,
      payment_method_brand: paymentMethodBrand,
      payment_method_last4: paymentMethodLast4,
      payment_method_type: paymentMethodType,
    };

    let updatedOrder = await updateOrder(sessionId, orderUpdateData);

    // If order doesn't exist, try to create it from tier info
    if (!updatedOrder) {
      console.warn('[Order Sync] Order not found for session:', sessionId, '-- attempting to create');
      const tier = (body.tier as string) || session.success_url?.match(/tier=(explore|contribute|weekly_backer|backer)/)?.[1];

      if (tier && ['explore', 'contribute', 'weekly_backer', 'backer'].includes(tier)) {
        const createdOrder = await createOrder({
          stripe_session_id: sessionId,
          ticket_tier: tier as 'explore' | 'contribute' | 'weekly_backer' | 'backer',
          amount_subtotal: session.amount_subtotal || 0,
          amount_total: session.amount_total || 0,
          amount_tax: session.total_details?.amount_tax || 0,
          amount_discount: session.total_details?.amount_discount || 0,
          currency: session.currency || 'usd',
        });

        if (createdOrder) {
          updatedOrder = await updateOrder(sessionId, orderUpdateData);
          console.log('[Order Sync] Order created and updated:', createdOrder.id);
        }
      }

      if (!updatedOrder) {
        return NextResponse.json(
          { error: 'Failed to update order in database.' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder,
    });
  } catch (error) {
    console.error('[Order Sync] Error syncing order:', error);
    return NextResponse.json(
      { error: 'Failed to sync order.' },
      { status: 500 }
    );
  }
}
