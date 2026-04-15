-- ================================================================
-- Declarative migration for newsletter_subscriptions
--
-- Background: this table was originally created ad-hoc in the
-- Supabase dashboard and never committed as a migration. This file
-- is idempotent so it can be applied to fresh environments without
-- breaking existing production data.
--
-- Columns match how the table is used in:
--   - app/api/newsletter/subscribe/route.ts
--   - app/api/award/vote/route.ts
--   - supabase/migrations/z_add_visitor_id_to_subscriptions_and_orders.sql
-- ================================================================

CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT NOT NULL,
  source       TEXT,
  timezone     TEXT,
  locale       TEXT,
  country      TEXT,
  ip_address   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backfill missing columns on pre-existing deployments
ALTER TABLE newsletter_subscriptions
  ADD COLUMN IF NOT EXISTS source     TEXT,
  ADD COLUMN IF NOT EXISTS timezone   TEXT,
  ADD COLUMN IF NOT EXISTS locale     TEXT,
  ADD COLUMN IF NOT EXISTS country    TEXT,
  ADD COLUMN IF NOT EXISTS ip_address TEXT;

-- Enforce email NOT NULL (skip cleanly if already NOT NULL)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'newsletter_subscriptions'
      AND column_name = 'email'
      AND is_nullable = 'YES'
  ) THEN
    EXECUTE 'ALTER TABLE newsletter_subscriptions ALTER COLUMN email SET NOT NULL';
  END IF;
END $$;

-- Normalise existing rows before adding the unique index
UPDATE newsletter_subscriptions
SET email = LOWER(TRIM(email))
WHERE email IS NOT NULL
  AND email <> LOWER(TRIM(email));

-- Case-insensitive uniqueness (keeps current mixed-case lookups safe)
CREATE UNIQUE INDEX IF NOT EXISTS newsletter_subscriptions_email_unique
  ON newsletter_subscriptions (LOWER(email));

CREATE INDEX IF NOT EXISTS idx_newsletter_subscriptions_created_at
  ON newsletter_subscriptions (created_at DESC);

ALTER TABLE newsletter_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_subscriptions FORCE ROW LEVEL SECURITY;

COMMENT ON TABLE newsletter_subscriptions IS 'Newsletter signups; server-only (service role bypasses RLS).';
