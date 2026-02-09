// 订单状态类型
export type OrderStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded';

// 订单数据库记录类型
export interface Order {
  id: string; // UUID
  stripe_session_id: string; // Stripe checkout session ID
  stripe_payment_intent_id: string | null; // Stripe payment intent ID
  ticket_tier: 'explore' | 'contribute' | 'backer';
  status: OrderStatus;
  amount_subtotal: number; // 以分为单位
  amount_total: number; // 以分为单位
  amount_tax: number; // 以分为单位
  amount_discount: number; // 以分为单位
  currency: string;
  customer_email: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    country: string | null;
  } | null;
  payment_method_brand: string | null;
  payment_method_last4: string | null;
  payment_method_type: string | null;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

// 创建订单的输入类型
export interface CreateOrderInput {
  stripe_session_id: string;
  ticket_tier: 'explore' | 'contribute' | 'backer';
  amount_subtotal: number;
  amount_total: number;
  amount_tax: number;
  amount_discount: number;
  currency: string;
}

// 更新订单的输入类型
export interface UpdateOrderInput {
  stripe_payment_intent_id?: string;
  status?: OrderStatus;
  amount_subtotal?: number;
  amount_total?: number;
  amount_tax?: number;
  amount_discount?: number;
  customer_email?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    country: string | null;
  } | null;
  payment_method_brand?: string;
  payment_method_last4?: string;
  payment_method_type?: string;
}
