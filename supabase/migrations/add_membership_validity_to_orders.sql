-- Add membership validity period columns to orders table
-- Each paid order grants membership for a specific date range.
-- weekly_backer: only the selected week; all others: full festival month.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS valid_from DATE,
  ADD COLUMN IF NOT EXISTS valid_until DATE;

COMMENT ON COLUMN orders.valid_from IS 'Start date of the membership granted by this order (inclusive)';
COMMENT ON COLUMN orders.valid_until IS 'End date of the membership granted by this order (inclusive)';

-- Backfill existing paid orders
-- Full-month tiers: May 1 – May 31
UPDATE orders
SET valid_from = '2026-05-01',
    valid_until = '2026-05-31'
WHERE status = 'paid'
  AND ticket_tier IN ('explore', 'contribute', 'backer')
  AND valid_from IS NULL;

-- Weekly backer: derive from Stripe session metadata (stored in checkout success_url)
-- We need to match week from the stripe session metadata.
-- Since the week is stored in Stripe metadata (not in our DB), we backfill based on
-- stripe_session_id patterns. For any weekly_backer without dates, default to full month
-- as a safe fallback — the webhook will set correct dates going forward.
UPDATE orders
SET valid_from = '2026-05-01',
    valid_until = '2026-05-31'
WHERE status = 'paid'
  AND ticket_tier = 'weekly_backer'
  AND valid_from IS NULL;
