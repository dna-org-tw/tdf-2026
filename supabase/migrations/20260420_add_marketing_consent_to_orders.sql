-- Explicit marketing consent captured at checkout (GDPR / CASL).
-- NULL = legacy order (grandfathered soft opt-in via ToS);
-- TRUE  = explicit opt-in;
-- FALSE = explicit opt-out — exclude from all broadcast categories.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN;

COMMENT ON COLUMN orders.marketing_consent IS 'Explicit marketing consent captured at checkout (GDPR/CASL). NULL = legacy order (grandfathered soft opt-in via ToS); TRUE = explicit opt-in; FALSE = explicit opt-out.';

CREATE INDEX IF NOT EXISTS idx_orders_marketing_consent
  ON orders(marketing_consent)
  WHERE marketing_consent IS NOT NULL;
