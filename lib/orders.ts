import { supabaseServer } from './supabaseServer';
import type { Order, CreateOrderInput, UpdateOrderInput, OrderStatus } from './types/order';

if (!supabaseServer) {
  console.warn('[Orders] Supabase client is not initialized. Order operations will fail.');
}

/**
 * 在 Supabase 中建立訂單
 */
export async function createOrder(input: CreateOrderInput): Promise<Order | null> {
  if (!supabaseServer) {
    console.error('[Orders] Cannot create order: Supabase client not initialized');
    return null;
  }

  try {
    const insertData: Record<string, unknown> = {
      stripe_session_id: input.stripe_session_id,
      ticket_tier: input.ticket_tier,
      status: 'pending',
      amount_subtotal: input.amount_subtotal,
      amount_total: input.amount_total,
      amount_tax: input.amount_tax,
      amount_discount: input.amount_discount,
      currency: input.currency,
    };
    if (input.visitor_fingerprint) insertData.visitor_fingerprint = input.visitor_fingerprint;

    const { data, error } = await supabaseServer
      .from('orders')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('[Orders] Error creating order:', error);
      return null;
    }

    return data as Order;
  } catch (error) {
    console.error('[Orders] Exception creating order:', error);
    return null;
  }
}

/**
 * 根据 Stripe session ID 查找订单
 */
export async function getOrderBySessionId(sessionId: string): Promise<Order | null> {
  if (!supabaseServer) {
    console.error('[Orders] Cannot get order: Supabase client not initialized');
    return null;
  }

  try {
    const { data, error } = await supabaseServer
      .from('orders')
      .select('*')
      .eq('stripe_session_id', sessionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // 订单不存在
        return null;
      }
      console.error('[Orders] Error getting order:', error);
      return null;
    }

    return data as Order;
  } catch (error) {
    console.error('[Orders] Exception getting order:', error);
    return null;
  }
}

/**
 * 更新订单
 */
export async function updateOrder(
  sessionId: string,
  input: UpdateOrderInput
): Promise<Order | null> {
  if (!supabaseServer) {
    console.error('[Orders] Cannot update order: Supabase client not initialized');
    return null;
  }

  try {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.stripe_payment_intent_id !== undefined) {
      updateData.stripe_payment_intent_id = input.stripe_payment_intent_id;
    }
    if (input.status !== undefined) {
      updateData.status = input.status;
    }
    if (input.amount_subtotal !== undefined) {
      updateData.amount_subtotal = input.amount_subtotal;
    }
    if (input.amount_total !== undefined) {
      updateData.amount_total = input.amount_total;
    }
    if (input.amount_tax !== undefined) {
      updateData.amount_tax = input.amount_tax;
    }
    if (input.amount_discount !== undefined) {
      updateData.amount_discount = input.amount_discount;
    }
    if (input.customer_email !== undefined) {
      updateData.customer_email = input.customer_email;
    }
    if (input.customer_name !== undefined) {
      updateData.customer_name = input.customer_name;
    }
    if (input.customer_phone !== undefined) {
      updateData.customer_phone = input.customer_phone;
    }
    if (input.customer_address !== undefined) {
      updateData.customer_address = input.customer_address;
    }
    if (input.payment_method_brand !== undefined) {
      updateData.payment_method_brand = input.payment_method_brand;
    }
    if (input.payment_method_last4 !== undefined) {
      updateData.payment_method_last4 = input.payment_method_last4;
    }
    if (input.payment_method_type !== undefined) {
      updateData.payment_method_type = input.payment_method_type;
    }

    const { data, error } = await supabaseServer
      .from('orders')
      .update(updateData)
      .eq('stripe_session_id', sessionId)
      .select()
      .single();

    if (error) {
      console.error('[Orders] Error updating order:', error);
      return null;
    }

    return data as Order;
  } catch (error) {
    console.error('[Orders] Exception updating order:', error);
    return null;
  }
}

/**
 * 根据 Stripe session ID 更新订单状态
 */
export async function updateOrderStatus(
  sessionId: string,
  status: OrderStatus
): Promise<Order | null> {
  return updateOrder(sessionId, { status });
}
