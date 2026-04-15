-- Restore deliverability-aware members_enriched view.
--
-- Background: update_members_enriched_with_member_no.sql rebuilt this view
-- without `suppressed` / `suppression_reason` and replaced real Mailgun
-- engagement counters with 0. It also dropped the `unsubscribed_at IS NULL`
-- filter on the newsletter CTE so unsubscribed rows re-appeared as active
-- subscribers.
--
-- This migration supersedes both earlier versions. members_enriched is the
-- single source of truth for admin segmentation (lib/recipients.ts, /api/admin/recipients,
-- /api/admin/send) — keep deliverability columns here.

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
  m.id AS member_id,
  m.member_no,
  m.first_seen_at,
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
LEFT JOIN members m ON m.email = e.email
LEFT JOIN order_agg oa ON oa.email = e.email
LEFT JOIN newsletter_agg na ON na.email = e.email
LEFT JOIN email_agg ea ON ea.email = e.email
LEFT JOIN suppression_agg sa ON sa.email = e.email;

COMMENT ON VIEW members_enriched IS
  'Canonical member universe view. Columns: email, member_id, member_no, first_seen_at, name, phone, status, paid_order_count, total_spent_cents, currency, highest_ticket_tier, last_order_at, last_interaction_at, email_sent_count, email_open_count, email_click_count, email_open_rate, score, tier, subscribed_newsletter, in_orders, suppressed, suppression_reason. Deliverability columns (suppressed/suppression_reason, real engagement counters, unsubscribed_at filter) MUST be preserved in any future rebuild — lib/recipients.ts depends on them.';
