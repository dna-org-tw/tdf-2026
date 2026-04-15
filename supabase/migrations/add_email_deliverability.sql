-- Email deliverability infrastructure
-- Adds:
--   1. Soft-delete (unsubscribed_at) to newsletter_subscriptions
--   2. email_suppressions table (hard bounces, complaints, one-click unsubs)
--   3. Tracking columns (opens, clicks, bounces) on email_logs
--   4. Refreshed members_enriched view that honors unsubscribed + suppressed state

-- 1. Newsletter soft delete ---------------------------------------------------
ALTER TABLE newsletter_subscriptions
  ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_newsletter_subscriptions_active
  ON newsletter_subscriptions (email)
  WHERE unsubscribed_at IS NULL;

-- 2. Suppression list ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_suppressions (
  email TEXT PRIMARY KEY,
  reason TEXT NOT NULL CHECK (reason IN ('unsubscribed', 'bounced', 'complained', 'spam', 'manual')),
  source TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_suppressions_reason
  ON email_suppressions (reason);

COMMENT ON TABLE email_suppressions IS
  'Do-not-send list. Populated by Mailgun webhooks (bounce/complaint) and by the unsubscribe flow.';

-- Server-only access: RLS enabled without any policies (Secret/service key bypasses RLS).
ALTER TABLE email_suppressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_suppressions FORCE ROW LEVEL SECURITY;

-- 3. email_logs tracking columns ---------------------------------------------
ALTER TABLE email_logs
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bounced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS complained_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS open_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS click_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bounce_type TEXT;

CREATE INDEX IF NOT EXISTS idx_email_logs_mailgun_message_id
  ON email_logs (mailgun_message_id)
  WHERE mailgun_message_id IS NOT NULL;

-- 4. Rebuild members_enriched view -------------------------------------------
DROP VIEW IF EXISTS members_enriched;

CREATE VIEW members_enriched AS
WITH
all_emails AS (
  SELECT DISTINCT lower(trim(customer_email)) AS email
  FROM orders
  WHERE customer_email IS NOT NULL AND trim(customer_email) <> ''
  UNION
  SELECT DISTINCT lower(trim(email)) AS email
  FROM newsletter_subscriptions
  WHERE email IS NOT NULL AND trim(email) <> ''
  UNION
  SELECT DISTINCT lower(trim(to_email)) AS email
  FROM email_logs
  WHERE to_email IS NOT NULL AND trim(to_email) <> ''
),
order_agg AS (
  SELECT
    lower(trim(customer_email)) AS email,
    COUNT(*) FILTER (WHERE status = 'paid') AS paid_order_count,
    COUNT(*) FILTER (WHERE status = 'pending' AND created_at > NOW() - INTERVAL '7 days') AS active_pending_count,
    COUNT(*) FILTER (WHERE status IN ('expired', 'cancelled', 'failed')
                     OR (status = 'pending' AND created_at <= NOW() - INTERVAL '7 days')) AS abandoned_order_count,
    COALESCE(SUM(amount_total) FILTER (WHERE status = 'paid'), 0) AS total_spent_cents,
    MAX(created_at) FILTER (WHERE status = 'paid') AS last_paid_order_at,
    MAX(created_at) AS last_order_at,
    (ARRAY_AGG(customer_name ORDER BY created_at DESC) FILTER (WHERE customer_name IS NOT NULL))[1] AS latest_name,
    (ARRAY_AGG(customer_phone ORDER BY created_at DESC) FILTER (WHERE customer_phone IS NOT NULL))[1] AS latest_phone,
    (ARRAY_AGG(currency ORDER BY created_at DESC) FILTER (WHERE status = 'paid'))[1] AS latest_paid_currency,
    (ARRAY_AGG(ticket_tier ORDER BY CASE ticket_tier
        WHEN 'backer' THEN 4
        WHEN 'weekly_backer' THEN 3
        WHEN 'contribute' THEN 2
        WHEN 'explore' THEN 1
        ELSE 0 END DESC, created_at DESC)
      FILTER (WHERE status = 'paid'))[1] AS highest_ticket_tier,
    COALESCE(SUM(CASE
      WHEN status = 'paid' AND ticket_tier = 'backer' THEN 40
      WHEN status = 'paid' AND ticket_tier = 'weekly_backer' THEN 25
      WHEN status = 'paid' AND ticket_tier = 'contribute' THEN 15
      WHEN status = 'paid' AND ticket_tier = 'explore' THEN 8
      ELSE 0 END), 0) AS ticket_score
  FROM orders
  WHERE customer_email IS NOT NULL AND trim(customer_email) <> ''
  GROUP BY lower(trim(customer_email))
),
-- Only active newsletter subscribers (unsubscribed_at IS NULL)
newsletter_agg AS (
  SELECT DISTINCT lower(trim(email)) AS email, TRUE AS subscribed
  FROM newsletter_subscriptions
  WHERE email IS NOT NULL
    AND trim(email) <> ''
    AND unsubscribed_at IS NULL
),
-- Real engagement metrics from Mailgun webhooks
email_agg AS (
  SELECT
    lower(trim(to_email)) AS email,
    COUNT(*) FILTER (WHERE status = 'sent') AS sent_count,
    COALESCE(SUM(open_count), 0)::int AS open_count,
    COALESCE(SUM(click_count), 0)::int AS click_count,
    MAX(created_at) FILTER (WHERE status = 'sent') AS last_email_at
  FROM email_logs
  WHERE to_email IS NOT NULL AND trim(to_email) <> ''
  GROUP BY lower(trim(to_email))
),
suppression_agg AS (
  SELECT lower(trim(email)) AS email, reason
  FROM email_suppressions
  WHERE email IS NOT NULL AND trim(email) <> ''
)
SELECT
  e.email,
  oa.latest_name AS name,
  oa.latest_phone AS phone,
  CASE
    WHEN COALESCE(oa.paid_order_count, 0) > 0 THEN 'paid'
    WHEN COALESCE(oa.active_pending_count, 0) > 0 THEN 'pending'
    WHEN COALESCE(oa.abandoned_order_count, 0) > 0 THEN 'abandoned'
    WHEN na.subscribed IS TRUE THEN 'subscriber'
    ELSE 'other'
  END AS status,
  COALESCE(oa.paid_order_count, 0) AS paid_order_count,
  COALESCE(oa.total_spent_cents, 0) AS total_spent_cents,
  COALESCE(oa.latest_paid_currency, 'usd') AS currency,
  oa.highest_ticket_tier,
  oa.last_paid_order_at AS last_order_at,
  GREATEST(
    COALESCE(oa.last_order_at, 'epoch'::timestamptz),
    COALESCE(ea.last_email_at, 'epoch'::timestamptz)
  ) AS last_interaction_at,
  COALESCE(ea.sent_count, 0) AS email_sent_count,
  COALESCE(ea.open_count, 0) AS email_open_count,
  COALESCE(ea.click_count, 0) AS email_click_count,
  CASE
    WHEN COALESCE(ea.sent_count, 0) = 0 THEN NULL
    ELSE ROUND(COALESCE(ea.open_count, 0)::numeric / ea.sent_count, 4)
  END AS email_open_rate,
  (
    COALESCE(oa.ticket_score, 0)
    + CASE
        WHEN GREATEST(COALESCE(oa.last_order_at, 'epoch'::timestamptz), COALESCE(ea.last_email_at, 'epoch'::timestamptz))
             > NOW() - INTERVAL '30 days' THEN 10
        WHEN GREATEST(COALESCE(oa.last_order_at, 'epoch'::timestamptz), COALESCE(ea.last_email_at, 'epoch'::timestamptz))
             > NOW() - INTERVAL '90 days' THEN 5
        ELSE 0
      END
    + CASE WHEN COALESCE(ea.sent_count, 0) > 0
                AND COALESCE(ea.open_count, 0)::numeric / ea.sent_count > 0.5 THEN 5 ELSE 0 END
    + CASE WHEN COALESCE(ea.click_count, 0) > 0 THEN 5 ELSE 0 END
    + CASE WHEN COALESCE(oa.paid_order_count, 0) > 1 THEN 10 ELSE 0 END
  )::int AS score,
  CASE
    WHEN (
      COALESCE(oa.ticket_score, 0)
      + CASE
          WHEN GREATEST(COALESCE(oa.last_order_at, 'epoch'::timestamptz), COALESCE(ea.last_email_at, 'epoch'::timestamptz))
               > NOW() - INTERVAL '30 days' THEN 10
          WHEN GREATEST(COALESCE(oa.last_order_at, 'epoch'::timestamptz), COALESCE(ea.last_email_at, 'epoch'::timestamptz))
               > NOW() - INTERVAL '90 days' THEN 5
          ELSE 0 END
      + CASE WHEN COALESCE(ea.sent_count, 0) > 0
                  AND COALESCE(ea.open_count, 0)::numeric / ea.sent_count > 0.5 THEN 5 ELSE 0 END
      + CASE WHEN COALESCE(ea.click_count, 0) > 0 THEN 5 ELSE 0 END
      + CASE WHEN COALESCE(oa.paid_order_count, 0) > 1 THEN 10 ELSE 0 END
    ) >= 50 THEN 'S'
    WHEN (
      COALESCE(oa.ticket_score, 0)
      + CASE
          WHEN GREATEST(COALESCE(oa.last_order_at, 'epoch'::timestamptz), COALESCE(ea.last_email_at, 'epoch'::timestamptz))
               > NOW() - INTERVAL '30 days' THEN 10
          WHEN GREATEST(COALESCE(oa.last_order_at, 'epoch'::timestamptz), COALESCE(ea.last_email_at, 'epoch'::timestamptz))
               > NOW() - INTERVAL '90 days' THEN 5
          ELSE 0 END
      + CASE WHEN COALESCE(ea.sent_count, 0) > 0
                  AND COALESCE(ea.open_count, 0)::numeric / ea.sent_count > 0.5 THEN 5 ELSE 0 END
      + CASE WHEN COALESCE(ea.click_count, 0) > 0 THEN 5 ELSE 0 END
      + CASE WHEN COALESCE(oa.paid_order_count, 0) > 1 THEN 10 ELSE 0 END
    ) >= 20 THEN 'A'
    WHEN (
      COALESCE(oa.ticket_score, 0)
      + CASE
          WHEN GREATEST(COALESCE(oa.last_order_at, 'epoch'::timestamptz), COALESCE(ea.last_email_at, 'epoch'::timestamptz))
               > NOW() - INTERVAL '30 days' THEN 10
          WHEN GREATEST(COALESCE(oa.last_order_at, 'epoch'::timestamptz), COALESCE(ea.last_email_at, 'epoch'::timestamptz))
               > NOW() - INTERVAL '90 days' THEN 5
          ELSE 0 END
      + CASE WHEN COALESCE(ea.sent_count, 0) > 0
                  AND COALESCE(ea.open_count, 0)::numeric / ea.sent_count > 0.5 THEN 5 ELSE 0 END
      + CASE WHEN COALESCE(ea.click_count, 0) > 0 THEN 5 ELSE 0 END
      + CASE WHEN COALESCE(oa.paid_order_count, 0) > 1 THEN 10 ELSE 0 END
    ) >= 5 THEN 'B'
    ELSE 'C'
  END AS tier,
  COALESCE(na.subscribed, FALSE) AS subscribed_newsletter,
  (oa.email IS NOT NULL) AS in_orders,
  (sa.email IS NOT NULL) AS suppressed,
  sa.reason AS suppression_reason
FROM all_emails e
LEFT JOIN order_agg oa ON oa.email = e.email
LEFT JOIN newsletter_agg na ON na.email = e.email
LEFT JOIN email_agg ea ON ea.email = e.email
LEFT JOIN suppression_agg sa ON sa.email = e.email;

COMMENT ON VIEW members_enriched IS
  'Member universe with derived status, score, tier, and deliverability flags (suppressed, suppression_reason). See lib/members.ts for constants.';
