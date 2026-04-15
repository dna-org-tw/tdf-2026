import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { updateOrder, createOrder, getOrderBySessionId } from '@/lib/orders';
import { sendOrderEmail } from '@/lib/sendOrderEmail';
import { mapPaymentStatusToOrderStatus } from '@/lib/orderStatus';
import { supabaseServer } from '@/lib/supabaseServer';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2025-12-15.clover',
    })
  : null;

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
      if (process.env.NODE_ENV === 'production') {
        console.error('[Webhook] STRIPE_WEBHOOK_SECRET is required in production. Rejecting request.');
        return NextResponse.json(
          { error: 'Webhook signature verification is not configured.' },
          { status: 500 }
        );
      }
      console.warn('[Webhook] STRIPE_WEBHOOK_SECRET is not set. Signature verification skipped (non-production only).');
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

      let finalOrder = await updateOrder(session.id, orderData);

      if (finalOrder) {
        console.log('[Webhook] Order updated successfully:', finalOrder.id);
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
            finalOrder = await updateOrder(session.id, orderData);
            console.log('[Webhook] Order created and updated:', createdOrder.id);
          } else {
            console.error('[Webhook] Failed to create fallback order for session:', session.id);
          }
        } else {
          console.error('[Webhook] Cannot determine tier for session:', session.id);
        }
      }

      // 發送訂單確認 email（server-side，確保不依賴 client）
      if (orderStatus === 'paid' && customerDetails?.email) {
        const emailOrder = finalOrder ?? await getOrderBySessionId(session.id);
        const emailResult = await sendOrderEmail(
          {
            id: emailOrder?.id ?? session.id,
            payment_status: 'paid',
            amount_total: session.amount_total || 0,
            currency: session.currency || null,
            customer_email: customerDetails.email,
            customer_name: customerDetails.name || null,
            ticket_tier: emailOrder?.ticket_tier ?? null,
            created: Math.floor(session.created),
          },
          'success'
        );
        if (emailResult.skipped) {
          console.log('[Webhook] Confirmation email already sent, skipped.');
        } else if (emailResult.success) {
          console.log('[Webhook] Confirmation email sent:', emailResult.messageId);
        } else {
          console.error('[Webhook] Failed to send confirmation email:', emailResult.error);
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
        status: 'expired',
      });

      if (updatedOrder) {
        console.log('[Webhook] Order updated successfully:', updatedOrder.id);
      } else {
        console.warn('[Webhook] Failed to update order for session:', session.id);
      }
    }
    // invoice.paid: mark pending upgrade orders as paid when the customer pays via hosted URL
    else if (event.type === 'invoice.paid') {
      const inv = event.data.object as Stripe.Invoice;
      if (inv.id && supabaseServer) {
        const { data: order } = await supabaseServer
          .from('orders')
          .select('id, status')
          .eq('stripe_invoice_id', inv.id)
          .maybeSingle();
        if (order && order.status === 'pending') {
          await supabaseServer
            .from('orders')
            .update({ status: 'paid' })
            .eq('id', order.id);
          console.log('[Webhook] Marked upgrade order paid:', order.id);
        }
      }
    }
    // charge.refunded / charge.refund.updated: reconcile refund state with Stripe
    else if (event.type === 'charge.refunded' || event.type === 'charge.refund.updated') {
      const object = event.data.object as Stripe.Charge | Stripe.Refund;
      const paymentIntentId = 'payment_intent' in object
        ? (typeof object.payment_intent === 'string' ? object.payment_intent : object.payment_intent?.id)
        : null;
      if (paymentIntentId && supabaseServer) {
        const { data: order } = await supabaseServer
          .from('orders')
          .select('id, amount_total, amount_refunded')
          .eq('stripe_payment_intent_id', paymentIntentId)
          .maybeSingle();

        if (!order) {
          console.warn('[Webhook] Refund event for unknown PI:', paymentIntentId);
        } else {
          try {
            const pi = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge'] });
            const chargeObj = pi.latest_charge && typeof pi.latest_charge !== 'string' ? pi.latest_charge : null;
            const stripeRefunded = chargeObj?.amount_refunded ?? 0;
            if (stripeRefunded !== order.amount_refunded) {
              const newStatus = stripeRefunded >= order.amount_total ? 'refunded' : 'partially_refunded';
              await supabaseServer
                .from('orders')
                .update({ amount_refunded: stripeRefunded, status: newStatus })
                .eq('id', order.id);
              console.log('[Webhook] Reconciled refund for order:', order.id, { stripeRefunded });
            }
          } catch (err) {
            console.error('[Webhook] Error reconciling refund:', err);
          }
        }
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
