-- Member profiles: stores editable profile / business-card data
-- linked 1-to-1 with the members table.

CREATE TABLE IF NOT EXISTS member_profiles (
  id            BIGSERIAL PRIMARY KEY,
  member_id     BIGINT NOT NULL UNIQUE REFERENCES members(id) ON DELETE CASCADE,
  display_name  TEXT,
  bio           TEXT,
  avatar_url    TEXT,
  location      TEXT,
  timezone      TEXT,
  tags          TEXT[] NOT NULL DEFAULT '{}',
  languages     TEXT[] NOT NULL DEFAULT '{}',
  social_links  JSONB  NOT NULL DEFAULT '{}',
  is_public     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for public profile lookups by member_id
CREATE INDEX IF NOT EXISTS idx_member_profiles_member_id ON member_profiles(member_id);

-- Index for public profile listing (future member directory)
CREATE INDEX IF NOT EXISTS idx_member_profiles_public ON member_profiles(is_public) WHERE is_public = TRUE;

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_member_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_member_profiles_updated_at
  BEFORE UPDATE ON member_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_member_profiles_updated_at();

-- RLS: only service role can access (matches existing pattern)
ALTER TABLE member_profiles ENABLE ROW LEVEL SECURITY;
