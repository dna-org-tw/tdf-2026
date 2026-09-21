-- ================================================================
-- Declarative migration for award_votes
--
-- Table was originally created ad-hoc in the Supabase dashboard.
-- Kept idempotent so it runs cleanly on fresh environments and is
-- a no-op on production where the table already exists.
--
-- Columns match app/api/award/vote/route.ts and confirm-vote/route.ts.
-- ================================================================

CREATE TABLE IF NOT EXISTS award_votes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     TEXT NOT NULL,
  email       TEXT NOT NULL,
  confirmed   BOOLEAN NOT NULL DEFAULT FALSE,
  token       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ
);

-- Backfill missing columns on pre-existing deployments
ALTER TABLE award_votes
  ADD COLUMN IF NOT EXISTS token        TEXT,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

-- Normalise existing emails so the partial unique index below is safe
UPDATE award_votes
SET email = LOWER(TRIM(email))
WHERE email IS NOT NULL
  AND email <> LOWER(TRIM(email));

-- Indexes for hot query paths
CREATE INDEX IF NOT EXISTS idx_award_votes_post_id        ON award_votes (post_id);
CREATE INDEX IF NOT EXISTS idx_award_votes_email          ON award_votes (email);
CREATE INDEX IF NOT EXISTS idx_award_votes_confirmed      ON award_votes (confirmed);
CREATE INDEX IF NOT EXISTS idx_award_votes_created_at     ON award_votes (created_at DESC);

-- Prevent a user ending up with multiple pending votes for the same post
CREATE UNIQUE INDEX IF NOT EXISTS award_votes_pending_unique
  ON award_votes (post_id, email)
  WHERE confirmed = FALSE;

ALTER TABLE award_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE award_votes FORCE ROW LEVEL SECURITY;

COMMENT ON TABLE award_votes IS 'Nomad Award votes; server-only (service role bypasses RLS).';
