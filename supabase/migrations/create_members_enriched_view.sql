-- Create members_enriched view
-- Aggregates every email in the system with derived status, score, and tier.
-- Union source: orders, newsletter_subscriptions, notification_logs/email_logs (recipients).

CREATE OR REPLACE VIEW members_enriched AS
WITH
-- Lowercased, trimmed unique email universe
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
-- Order aggregates per email
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
    -- Pick the latest non-null name/phone overall
    (ARRAY_AGG(customer_name ORDER BY created_at DESC) FILTER (WHERE customer_name IS NOT NULL))[1] AS latest_name,
    (ARRAY_AGG(customer_phone ORDER BY created_at DESC) FILTER (WHERE customer_phone IS NOT NULL))[1] AS latest_phone,
    (ARRAY_AGG(currency ORDER BY created_at DESC) FILTER (WHERE status = 'paid'))[1] AS latest_paid_currency,
    -- Highest ticket tier among paid orders (by rank)
    (ARRAY_AGG(ticket_tier ORDER BY CASE ticket_tier
        WHEN 'backer' THEN 4
        WHEN 'weekly_backer' THEN 3
        WHEN 'contribute' THEN 2
        WHEN 'explore' THEN 1
        ELSE 0 END DESC, created_at DESC)
      FILTER (WHERE status = 'paid'))[1] AS highest_ticket_tier,
    -- Active ticket tier: highest tier among paid orders whose validity period covers NOW
    (ARRAY_AGG(ticket_tier ORDER BY CASE ticket_tier
        WHEN 'backer' THEN 4
        WHEN 'weekly_backer' THEN 3
        WHEN 'contribute' THEN 2
        WHEN 'explore' THEN 1
        ELSE 0 END DESC, created_at DESC)
      FILTER (WHERE status = 'paid'
              AND valid_from IS NOT NULL
              AND valid_until IS NOT NULL
              AND CURRENT_DATE >= valid_from
              AND CURRENT_DATE <= valid_until))[1] AS active_ticket_tier,
    -- Earliest valid_from and latest valid_until among paid orders
    MIN(valid_from) FILTER (WHERE status = 'paid' AND valid_from IS NOT NULL) AS earliest_valid_from,
    MAX(valid_until) FILTER (WHERE status = 'paid' AND valid_until IS NOT NULL) AS latest_valid_until,
    -- Sum of per-order ticket scores for paid orders only
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
newsletter_agg AS (
  SELECT DISTINCT lower(trim(email)) AS email, TRUE AS subscribed
  FROM newsletter_subscriptions
  WHERE email IS NOT NULL AND trim(email) <> ''
),
-- Email send history per recipient (open/click are placeholders; no tracking yet)
email_agg AS (
  SELECT
    lower(trim(to_email)) AS email,
    COUNT(*) FILTER (WHERE status = 'sent') AS sent_count,
    0::int AS open_count,
    0::int AS click_count,
    MAX(created_at) FILTER (WHERE status = 'sent') AS last_email_at
  FROM email_logs
  WHERE to_email IS NOT NULL AND trim(to_email) <> ''
  GROUP BY lower(trim(to_email))
)
SELECT
  e.email,
  oa.latest_name AS name,
  oa.latest_phone AS phone,
  -- Status (priority: paid > pending > abandoned > subscriber > other)
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
  oa.active_ticket_tier,
  oa.earliest_valid_from,
  oa.latest_valid_until,
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
  -- Score
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
  -- Tier bucket
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
  (oa.email IS NOT NULL) AS in_orders
FROM all_emails e
LEFT JOIN order_agg oa ON oa.email = e.email
LEFT JOIN newsletter_agg na ON na.email = e.email
LEFT JOIN email_agg ea ON ea.email = e.email;

COMMENT ON VIEW members_enriched IS
  'Member universe (union of orders, newsletter, email recipients) with derived status, score, and tier. See lib/members.ts for constants.';
