-- Supabase pg_cron schedule that pings /api/cron/luma-sync every 30 minutes.
-- This is a more reliable alternative to the GitHub Actions schedule (which
-- drops many ticks under GitHub load). The GH Actions workflow is kept as a
-- redundant backup; the /api/cron/luma-sync endpoint dedupes via its
-- "existing in_progress" check, so overlapping ticks are safe.
--
-- ────────────────────────────────────────────────────────────────────────────
-- One-time manual step (NOT in this migration for security):
-- ────────────────────────────────────────────────────────────────────────────
-- The scheduled job reads the bearer token from Supabase Vault. Create the
-- secret once per environment BEFORE applying this migration:
--
--   SELECT vault.create_secret(
--     '<CRON_SECRET matching your Zeabur env var>',
--     'cron_secret_luma_sync'
--   );
--
-- To rotate: use `vault.update_secret(id, new_value, 'cron_secret_luma_sync')`.
-- ────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_net;

-- Idempotent: drop any existing schedule with the same name before creating.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'luma-sync-every-30min') THEN
    PERFORM cron.unschedule('luma-sync-every-30min');
  END IF;
END $$;

SELECT cron.schedule(
  'luma-sync-every-30min',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://fest.dna.org.tw/api/cron/luma-sync',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'cron_secret_luma_sync' LIMIT 1
      ),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
  $$
);
