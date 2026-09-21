-- Supabase pg_cron schedule that pings /api/cron/stay-reconcile every 5 minutes.
-- Drives time-based state transitions for the stay booking system:
--   * expire pending_acceptance transfers past expires_at → release room back to owner
--   * expire offered waitlist entries past offer_expires_at
--   * issue next waitlist offers for free capacity + notify via email
--
-- ────────────────────────────────────────────────────────────────────────────
-- Shared secret: reuses `cron_secret_luma_sync` from Vault.
-- ────────────────────────────────────────────────────────────────────────────
-- Both /api/cron/luma-sync and /api/cron/stay-reconcile check the same
-- `process.env.CRON_SECRET`, so we reuse the existing Vault entry instead of
-- maintaining a duplicate. If per-job rotation is ever needed, split the
-- Vault secret and update this migration's command to reference the new name.

CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'stay-reconcile-every-5min') THEN
    PERFORM cron.unschedule('stay-reconcile-every-5min');
  END IF;
END $$;

SELECT cron.schedule(
  'stay-reconcile-every-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://fest.dna.org.tw/api/cron/stay-reconcile',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'cron_secret_luma_sync' LIMIT 1
      ),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
