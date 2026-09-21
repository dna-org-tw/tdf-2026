-- Luma guest sync — config, jobs, per-event results, event dimension, guests.

CREATE TABLE IF NOT EXISTS luma_sync_config (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  luma_session_cookie_enc BYTEA,
  luma_session_cookie_iv BYTEA,
  luma_session_cookie_tag BYTEA,
  cookie_last4 TEXT,
  cookie_invalid BOOLEAN NOT NULL DEFAULT false,
  cron_enabled BOOLEAN NOT NULL DEFAULT false,
  cron_schedule TEXT NOT NULL DEFAULT '0 19 * * *',
  last_manual_run_at TIMESTAMPTZ,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO luma_sync_config (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE luma_sync_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE luma_sync_config FORCE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS luma_sync_jobs (
  id BIGSERIAL PRIMARY KEY,
  trigger TEXT NOT NULL CHECK (trigger IN ('manual','cron')),
  status TEXT NOT NULL CHECK (status IN ('queued','running','succeeded','partial','failed')),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  total_events INTEGER NOT NULL DEFAULT 0,
  processed_events INTEGER NOT NULL DEFAULT 0,
  failed_events INTEGER NOT NULL DEFAULT 0,
  total_guests_upserted INTEGER NOT NULL DEFAULT 0,
  error_summary TEXT,
  triggered_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_luma_sync_jobs_status_created
  ON luma_sync_jobs (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_luma_sync_jobs_created
  ON luma_sync_jobs (created_at DESC);

ALTER TABLE luma_sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE luma_sync_jobs FORCE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS luma_sync_event_results (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES luma_sync_jobs(id) ON DELETE CASCADE,
  event_api_id TEXT NOT NULL,
  event_name TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','running','done','failed')),
  guests_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  UNIQUE (job_id, event_api_id)
);

CREATE INDEX IF NOT EXISTS idx_luma_sync_event_results_job
  ON luma_sync_event_results (job_id, id);

ALTER TABLE luma_sync_event_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE luma_sync_event_results FORCE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS luma_events (
  event_api_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  url TEXT,
  cover_url TEXT,
  location_text TEXT,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE luma_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE luma_events FORCE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS luma_guests (
  id BIGSERIAL PRIMARY KEY,
  event_api_id TEXT NOT NULL REFERENCES luma_events(event_api_id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  member_id BIGINT REFERENCES members(id) ON DELETE SET NULL,
  luma_guest_api_id TEXT,
  activity_status TEXT,
  paid BOOLEAN NOT NULL DEFAULT false,
  checked_in_at TIMESTAMPTZ,
  registered_at TIMESTAMPTZ,
  ticket_type_name TEXT,
  amount_cents INTEGER,
  currency TEXT,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_api_id, email)
);

CREATE INDEX IF NOT EXISTS idx_luma_guests_member ON luma_guests (member_id);
CREATE INDEX IF NOT EXISTS idx_luma_guests_email ON luma_guests (email);

ALTER TABLE luma_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE luma_guests FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.link_luma_guest_to_member()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_email TEXT; v_member_id BIGINT;
BEGIN
  v_email := lower(trim(NEW.email));
  IF v_email IS NULL OR v_email = '' THEN
    RETURN NEW;
  END IF;
  NEW.email := v_email;
  INSERT INTO members (email) VALUES (v_email)
    ON CONFLICT (email) DO NOTHING;
  SELECT id INTO v_member_id FROM members WHERE email = v_email;
  NEW.member_id := v_member_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_luma_guest_to_member ON luma_guests;
CREATE TRIGGER trg_link_luma_guest_to_member
  BEFORE INSERT OR UPDATE OF email ON luma_guests
  FOR EACH ROW
  EXECUTE FUNCTION public.link_luma_guest_to_member();
