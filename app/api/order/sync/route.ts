import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { updateOrder, createOrder } from '@/lib/orders';
import type { OrderStatus } from '@/lib/types/order';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2025-12-15.clover',
    })
  : null;

/**
 * 将 Stripe 支付状态映射到订单状态
 */
function mapPaymentStatusToOrderStatus(
  paymentStatus: string | null,
  sessionStatus: string | null
): OrderStatus {
  if (sessionStatus === 'complete' && paymentStatus === 'paid') {
    return 'paid';
  }
  // session 過期或未完成且未支付，視為取消
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

    const body = await req.json().catch(() => null);

    if (!body || !body.session_id) {
      return NextResponse.json(
        { error: 'Missing session_id in request body.' },
        { status: 400 }
      );
    }

    const sessionId = body.session_id as string;
    const forceStatus = body.force_status as OrderStatus | undefined;

    // 從 Stripe 獲取最新的 session 資訊
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent', 'payment_intent.latest_charge', 'line_items'],
    });

    // 獲取支付詳情
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

    // 擷取客戶資訊
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

    // 擷取支付方式資訊
    const paymentMethodBrand = charge?.payment_method_details?.card?.brand || null;
    const paymentMethodLast4 = charge?.payment_method_details?.card?.last4 || null;
    const paymentMethodType = charge?.payment_method_details?.type || null;

    // 确定订单状态：如果指定了强制状态则使用，否则根据 session 状态判断
    const orderStatus = forceStatus || mapPaymentStatusToOrderStatus(
      session.payment_status,
      session.status
    );

    // 更新订单
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

    // 訂單不存在時，從 request body 的 tier 或 success_url 解析後補建
    if (!updatedOrder) {
      console.warn('[Order Sync] Order not found for session:', sessionId, '— attempting to create');
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
