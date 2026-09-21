-- Capture which Stripe promotion/coupon code was applied to each order.
-- We already store `amount_discount` (cents), but that loses attribution:
-- without the code string we can't answer "how did EARLYBIRD2026 perform?".
-- All fields are nullable because the vast majority of orders carry no code.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_code TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_promotion_code_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_coupon_id TEXT;

COMMENT ON COLUMN orders.discount_code IS 'Human-readable promotion code string applied at checkout (e.g. EARLYBIRD2026). NULL if no code was used.';
COMMENT ON COLUMN orders.discount_promotion_code_id IS 'Stripe promotion_code ID (promo_...) corresponding to discount_code.';
COMMENT ON COLUMN orders.discount_coupon_id IS 'Stripe coupon ID backing the promotion code; useful when the same coupon is exposed via multiple codes.';

-- Analytics queries group by discount_code; partial index keeps it tiny.
CREATE INDEX IF NOT EXISTS idx_orders_discount_code
  ON orders(discount_code)
  WHERE discount_code IS NOT NULL;
