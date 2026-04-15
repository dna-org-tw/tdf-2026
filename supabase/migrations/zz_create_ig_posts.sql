-- ================================================================
-- Declarative migration for ig_posts
--
-- Source of Instagram Reels entered into the Nomad Award. Originally
-- created ad-hoc in the dashboard; this file keeps fresh environments
-- working and is a no-op on production.
--
-- Shape is driven by app/api/award/posts/route.ts (primarily the
-- `id` primary key and `data` JSONB blob; everything else is optional).
-- ================================================================

CREATE TABLE IF NOT EXISTS ig_posts (
  id           TEXT PRIMARY KEY,
  data         JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backfill missing columns on pre-existing deployments
ALTER TABLE ig_posts
  ADD COLUMN IF NOT EXISTS data       JSONB,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_ig_posts_created_at ON ig_posts (created_at DESC);

ALTER TABLE ig_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ig_posts FORCE ROW LEVEL SECURITY;

COMMENT ON TABLE ig_posts IS 'Instagram Reels entries for Nomad Award; server-only.';
