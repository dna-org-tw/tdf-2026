export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'expired'
  | 'refunded'
  | 'partially_refunded';

export type OrderSource = 'stripe_checkout' | 'stripe_invoice_offline' | 'stripe_invoice_upgrade';

export type OrderActionType =
  | 'refund'
  | 'cancel'
  | 'edit'
  | 'resend_receipt'
  | 'note'
  | 'manual_create'
  | 'upgrade'
  | 'transfer';

export interface OrderTransfer {
  id: string;
  order_id: string;
  parent_transfer_id: string | null;
  from_email: string;
  to_email: string;
  initiated_by: 'user' | 'admin';
  actor_user_id: string | null;
  actor_admin_email: string | null;
  ip_address: string | null;
  user_agent: string | null;
  notes: string | null;
  transferred_at: string;
}

export interface Order {
  id: string;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_invoice_id: string | null;
  ticket_tier: 'explore' | 'contribute' | 'weekly_backer' | 'backer';
  status: OrderStatus;
  source: OrderSource;
  amount_subtotal: number;
  amount_total: number;
  amount_tax: number;
  amount_discount: number;
  amount_refunded: number;
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
  discount_code: string | null;
  discount_promotion_code_id: string | null;
  discount_coupon_id: string | null;
  internal_notes: string | null;
  parent_order_id: string | null;
  valid_from: string | null;
  valid_until: string | null;
  visitor_fingerprint: string | null;
  marketing_consent: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface OrderAction {
  id: string;
  order_id: string;
  admin_email: string;
  action: OrderActionType;
  payload: Record<string, unknown> | null;
  stripe_response: Record<string, unknown> | null;
  status: 'success' | 'failed';
  error_message: string | null;
  created_at: string;
}

export interface CreateOrderInput {
  stripe_session_id: string | null;
  stripe_invoice_id?: string | null;
  ticket_tier: 'explore' | 'contribute' | 'weekly_backer' | 'backer';
  amount_subtotal: number;
  amount_total: number;
  amount_tax: number;
  amount_discount: number;
  currency: string;
  source?: OrderSource;
  visitor_fingerprint?: string | null;
  marketing_consent?: boolean | null;
}

export interface UpdateOrderInput {
  stripe_payment_intent_id?: string | null;
  stripe_invoice_id?: string | null;
  status?: OrderStatus;
  source?: OrderSource;
  amount_subtotal?: number;
  amount_total?: number;
  amount_tax?: number;
  amount_discount?: number;
  amount_refunded?: number;
  customer_email?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_address?: Order['customer_address'];
  payment_method_brand?: string | null;
  payment_method_last4?: string | null;
  payment_method_type?: string | null;
  discount_code?: string | null;
  discount_promotion_code_id?: string | null;
  discount_coupon_id?: string | null;
  internal_notes?: string | null;
  valid_from?: string | null;
  valid_until?: string | null;
}
