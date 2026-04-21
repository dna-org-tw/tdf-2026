-- pg_cron safety net for batch notification sends. Fires every 5 minutes and
-- re-kicks any notification whose drainer died mid-send (SIGTERM on redeploy,
-- crash, OOM). Endpoint dedupes via the reconciler's staleness threshold so
-- overlapping ticks are safe.
--
-- Reuses the `cron_secret_luma_sync` vault secret already created in
-- add_pg_cron_luma_sync.sql; both cron endpoints authenticate with the same
-- CRON_SECRET env var on the app side.

CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notification-resume-every-5min') THEN
    PERFORM cron.unschedule('notification-resume-every-5min');
  END IF;
END $$;

SELECT cron.schedule(
  'notification-resume-every-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://fest.dna.org.tw/api/cron/notification-resume',
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
