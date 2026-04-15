-- Support manual tier upgrades: a new "upgrade" order row is created and linked
-- to the original via parent_order_id. Supports both comped upgrades (paid out
-- of band at $0) and customer-paid upgrades via a hosted Stripe invoice URL.

-- 1. Link column to original order
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS parent_order_id UUID REFERENCES orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_parent_order_id ON orders(parent_order_id);

COMMENT ON COLUMN orders.parent_order_id IS '升級訂單指向原始訂單的 FK';

-- 2. Widen source CHECK to include upgrade source
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_source_check;
ALTER TABLE orders ADD CONSTRAINT orders_source_check
  CHECK (source IN ('stripe_checkout', 'stripe_invoice_offline', 'stripe_invoice_upgrade'));

-- 3. Widen order_actions.action CHECK to include 'upgrade'
ALTER TABLE order_actions DROP CONSTRAINT IF EXISTS order_actions_action_check;
ALTER TABLE order_actions ADD CONSTRAINT order_actions_action_check
  CHECK (action IN ('refund', 'cancel', 'edit', 'resend_receipt', 'note', 'manual_create', 'upgrade'));
