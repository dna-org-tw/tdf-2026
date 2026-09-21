-- Create members table — stable identity per email across the system.
-- Member numbers (M00001, M00002, ...) are generated from id.

CREATE TABLE IF NOT EXISTS members (
  id BIGSERIAL PRIMARY KEY,
  member_no TEXT GENERATED ALWAYS AS ('M' || LPAD(id::text, 5, '0')) STORED UNIQUE,
  email TEXT NOT NULL UNIQUE,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_members_email_lower ON members (LOWER(email));

ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE members FORCE ROW LEVEL SECURITY;

COMMENT ON TABLE members IS
  'Stable identity per email. Auto-populated by triggers on orders/newsletter_subscriptions/email_logs.';

-- ---------------------------------------------------------------------------
-- Backfill from existing data, ordered by earliest appearance so older
-- members receive smaller numbers.
-- ---------------------------------------------------------------------------
INSERT INTO members (email, first_seen_at)
SELECT email, MIN(seen_at) AS first_seen_at
FROM (
  SELECT lower(trim(customer_email)) AS email, created_at AS seen_at
    FROM orders
    WHERE customer_email IS NOT NULL AND trim(customer_email) <> ''
  UNION ALL
  SELECT lower(trim(email)), created_at
    FROM newsletter_subscriptions
    WHERE email IS NOT NULL AND trim(email) <> ''
  UNION ALL
  SELECT lower(trim(to_email)), created_at
    FROM email_logs
    WHERE to_email IS NOT NULL AND trim(to_email) <> ''
) t
GROUP BY email
ORDER BY MIN(seen_at) ASC
ON CONFLICT (email) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Auto-insert function + triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_member_from_email()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_email TEXT;
BEGIN
  IF TG_TABLE_NAME = 'orders' THEN
    v_email := NEW.customer_email;
  ELSIF TG_TABLE_NAME = 'newsletter_subscriptions' THEN
    v_email := NEW.email;
  ELSIF TG_TABLE_NAME = 'email_logs' THEN
    v_email := NEW.to_email;
  ELSE
    RETURN NEW;
  END IF;

  IF v_email IS NOT NULL AND trim(v_email) <> '' THEN
    INSERT INTO members (email)
    VALUES (lower(trim(v_email)))
    ON CONFLICT (email) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_member_orders ON orders;
CREATE TRIGGER trg_ensure_member_orders
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_member_from_email();

DROP TRIGGER IF EXISTS trg_ensure_member_newsletter ON newsletter_subscriptions;
CREATE TRIGGER trg_ensure_member_newsletter
  BEFORE INSERT ON newsletter_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_member_from_email();

DROP TRIGGER IF EXISTS trg_ensure_member_email_logs ON email_logs;
CREATE TRIGGER trg_ensure_member_email_logs
  BEFORE INSERT ON email_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_member_from_email();
