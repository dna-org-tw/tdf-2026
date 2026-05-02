-- Update pg_cron schedule for /api/cron/luma-sync.
--
-- Previously: '*/30 * * * *' (every 30 min, ticking on :00 and :30)
-- Now:        '15,45 * * * *' (every 30 min, ticking on :15 and :45)
--
-- Combined with the slower in-worker throttle (lib/lumaSyncWorker.ts), each
-- run targets ~15–18 minutes of runtime — comfortably under the 30-min gap
-- between ticks (so consecutive runs never overlap and the in-progress
-- dedupe never has to fire) and within the 20-min freshness budget the
-- operator wants.
--
-- The old schedule names are unscheduled first so we don't end up with two
-- jobs firing after this migration is applied.

CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'luma-sync-every-30min') THEN
    PERFORM cron.unschedule('luma-sync-every-30min');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'luma-sync-hourly-15min') THEN
    PERFORM cron.unschedule('luma-sync-hourly-15min');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'luma-sync-15-45') THEN
    PERFORM cron.unschedule('luma-sync-15-45');
  END IF;
END $$;

SELECT cron.schedule(
  'luma-sync-15-45',
  '15,45 * * * *',
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
