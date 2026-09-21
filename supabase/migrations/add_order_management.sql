-- Extend orders table + add order_actions audit table for admin management.

-- 1. Widen status CHECK constraint (add 'partially_refunded')
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'expired', 'refunded', 'partially_refunded'));

-- 2. New columns
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS amount_refunded BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'stripe_checkout',
  ADD COLUMN IF NOT EXISTS internal_notes TEXT;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_source_check;
ALTER TABLE orders ADD CONSTRAINT orders_source_check
  CHECK (source IN ('stripe_checkout', 'stripe_invoice_offline'));

-- 3. Make stripe_session_id nullable; replace unique constraint with partial index
ALTER TABLE orders ALTER COLUMN stripe_session_id DROP NOT NULL;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_stripe_session_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS orders_stripe_session_id_key
  ON orders(stripe_session_id) WHERE stripe_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_stripe_invoice_id ON orders(stripe_invoice_id);

COMMENT ON COLUMN orders.amount_refunded IS '已退款總額（以分為單位）';
COMMENT ON COLUMN orders.stripe_invoice_id IS '手動建單用的 Stripe Invoice ID';
COMMENT ON COLUMN orders.source IS '訂單來源：stripe_checkout | stripe_invoice_offline';
COMMENT ON COLUMN orders.internal_notes IS 'admin 內部備註';

-- 4. order_actions audit table
CREATE TABLE IF NOT EXISTS order_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN (
    'refund', 'cancel', 'edit', 'resend_receipt', 'note', 'manual_create'
  )),
  payload JSONB,
  stripe_response JSONB,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS order_actions_order_id_created_at_idx
  ON order_actions(order_id, created_at DESC);

COMMENT ON TABLE order_actions IS 'Admin 對訂單執行的操作稽核記錄';
