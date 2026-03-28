import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { updateOrder, createOrder, getOrderBySessionId } from '@/lib/orders';
import type { OrderStatus } from '@/lib/types/order';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

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
  if (sessionStatus === 'expired') {
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
      console.error('[Webhook] Stripe is not configured');
      return NextResponse.json(
        { error: 'Stripe is not configured on the server.' },
        { status: 500 }
      );
    }

    if (!webhookSecret) {
      console.warn('[Webhook] STRIPE_WEBHOOK_SECRET is not set. Webhook verification will be skipped.');
    }

    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header.' },
        { status: 400 }
      );
    }

    let event: Stripe.Event;

    // 驗證 webhook 簽章
    if (webhookSecret) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      } catch (err) {
        console.error('[Webhook] Signature verification failed:', err);
        return NextResponse.json(
          { error: 'Webhook signature verification failed.' },
          { status: 400 }
        );
      }
    } else {
      // 如果沒有設定 webhook secret，直接解析（僅用於開發環境）
      try {
        event = JSON.parse(body) as Stripe.Event;
      } catch (err) {
        console.error('[Webhook] Failed to parse event:', err);
        return NextResponse.json(
          { error: 'Invalid event format.' },
          { status: 400 }
        );
      }
    }

    // 處理 checkout.session.completed 事件
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      console.log('[Webhook] Processing checkout.session.completed:', session.id);

      // 獲取支付詳情
      let paymentIntent: Stripe.PaymentIntent | null = null;
      let charge: Stripe.Charge | null = null;

      if (session.payment_intent) {
        const paymentIntentId =
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent.id;

        try {
          paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
            expand: ['latest_charge'],
          });

          if (paymentIntent.latest_charge) {
            const chargeId =
              typeof paymentIntent.latest_charge === 'string'
                ? paymentIntent.latest_charge
                : paymentIntent.latest_charge.id;

            try {
              charge = await stripe.charges.retrieve(chargeId);
            } catch (err) {
              console.error('[Webhook] Error retrieving charge:', err);
            }
          }
        } catch (err) {
          console.error('[Webhook] Error retrieving payment intent:', err);
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
      const paymentMethodBrand =
        charge?.payment_method_details?.card?.brand || null;
      const paymentMethodLast4 =
        charge?.payment_method_details?.card?.last4 || null;
      const paymentMethodType = charge?.payment_method_details?.type || null;

      // 确定订单状态
      const orderStatus = mapPaymentStatusToOrderStatus(
        session.payment_status,
        session.status
      );

      // 更新订单
      const orderData = {
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

      const updatedOrder = await updateOrder(session.id, orderData);

      if (updatedOrder) {
        console.log('[Webhook] Order updated successfully:', updatedOrder.id);
      } else {
        // 訂單不存在（可能建立時失敗），從 success_url 解析 tier 後補建
        console.warn('[Webhook] Order not found for session:', session.id, '— attempting to create');
        const tierMatch = session.success_url?.match(/tier=(explore|contribute|weekly_backer|backer)/);
        const tier = tierMatch?.[1] as 'explore' | 'contribute' | 'weekly_backer' | 'backer' | undefined;

        if (tier) {
          const createdOrder = await createOrder({
            stripe_session_id: session.id,
            ticket_tier: tier,
            amount_subtotal: session.amount_subtotal || 0,
            amount_total: session.amount_total || 0,
            amount_tax: session.total_details?.amount_tax || 0,
            amount_discount: session.total_details?.amount_discount || 0,
            currency: session.currency || 'usd',
          });

          if (createdOrder) {
            // 建立後立即更新完整資料
            await updateOrder(session.id, orderData);
            console.log('[Webhook] Order created and updated:', createdOrder.id);
          } else {
            console.error('[Webhook] Failed to create fallback order for session:', session.id);
          }
        } else {
          console.error('[Webhook] Cannot determine tier for session:', session.id);
        }
      }
    }
    // 處理 payment_intent.succeeded 事件（備用）
    else if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const checkoutSessionId = paymentIntent.metadata?.checkout_session_id;

      if (checkoutSessionId) {
        console.log(
          '[Webhook] Processing payment_intent.succeeded for session:',
          checkoutSessionId
        );

        const updatedOrder = await updateOrder(checkoutSessionId, {
          stripe_payment_intent_id: paymentIntent.id,
          status: 'paid',
        });

        if (updatedOrder) {
          console.log('[Webhook] Order updated successfully:', updatedOrder.id);
        } else {
          console.warn(
            '[Webhook] Failed to update order for session:',
            checkoutSessionId
          );
        }
      }
    }
    // 處理 checkout.session.async_payment_succeeded 事件
    else if (event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object as Stripe.Checkout.Session;

      console.log(
        '[Webhook] Processing checkout.session.async_payment_succeeded:',
        session.id
      );

      const updatedOrder = await updateOrder(session.id, {
        status: 'paid',
      });

      if (updatedOrder) {
        console.log('[Webhook] Order updated successfully:', updatedOrder.id);
      } else {
        console.warn('[Webhook] Failed to update order for session:', session.id);
      }
    }
    // 處理 checkout.session.async_payment_failed 事件
    else if (event.type === 'checkout.session.async_payment_failed') {
      const session = event.data.object as Stripe.Checkout.Session;

      console.log(
        '[Webhook] Processing checkout.session.async_payment_failed:',
        session.id
      );

      const updatedOrder = await updateOrder(session.id, {
        status: 'failed',
      });

      if (updatedOrder) {
        console.log('[Webhook] Order updated successfully:', updatedOrder.id);
      } else {
        console.warn('[Webhook] Failed to update order for session:', session.id);
      }
    }
    // 處理 checkout.session.expired 事件（session 過期/取消）
    else if (event.type === 'checkout.session.expired') {
      const session = event.data.object as Stripe.Checkout.Session;

      console.log(
        '[Webhook] Processing checkout.session.expired:',
        session.id
      );

      const updatedOrder = await updateOrder(session.id, {
        status: 'cancelled',
      });

      if (updatedOrder) {
        console.log('[Webhook] Order updated successfully:', updatedOrder.id);
      } else {
        console.warn('[Webhook] Failed to update order for session:', session.id);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Webhook] Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed.' },
      { status: 500 }
    );
  }
}
