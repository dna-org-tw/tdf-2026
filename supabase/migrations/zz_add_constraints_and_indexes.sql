-- ================================================================
-- Constraints and indexes flagged by the Supabase audit.
--
-- All statements are idempotent so this is safe to re-apply.
-- ================================================================

-- ----------------------------------------------------------------
-- email_logs.mailgun_message_id — must be unique so webhooks and
-- de-dup logic can't conflate multiple sends.
--
-- We first clear accidental duplicates (NULL is fine; only dedup on
-- non-null values) before creating the unique index.
-- ----------------------------------------------------------------
DELETE FROM email_logs el
USING email_logs dup
WHERE el.ctid < dup.ctid
  AND el.mailgun_message_id IS NOT NULL
  AND el.mailgun_message_id = dup.mailgun_message_id;

CREATE UNIQUE INDEX IF NOT EXISTS email_logs_mailgun_message_id_unique
  ON email_logs (mailgun_message_id)
  WHERE mailgun_message_id IS NOT NULL;

-- ----------------------------------------------------------------
-- orders — composite index used by admin members aggregation and
-- order-by-email lookups.
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_customer_email_status
  ON orders (customer_email, status);

-- ----------------------------------------------------------------
-- notification_logs.sent_by is currently TEXT (stores admin email).
-- Proper FK requires an admin_users table that does not exist yet;
-- tracked as a follow-up.
-- ----------------------------------------------------------------
