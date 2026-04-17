-- Member card collections: one-way bookmark between two members.
-- Collector saves the collected person's card; collected person sees
-- an entry in their "collectors" list.

CREATE TABLE IF NOT EXISTS member_collections (
  id                       BIGSERIAL PRIMARY KEY,
  collector_member_id      BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  collected_member_id      BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  source                   TEXT NOT NULL CHECK (source IN ('public', 'qr')),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT member_collections_unique UNIQUE (collector_member_id, collected_member_id),
  CONSTRAINT member_collections_not_self CHECK (collector_member_id <> collected_member_id)
);

CREATE INDEX IF NOT EXISTS idx_member_collections_collector
  ON member_collections(collector_member_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_member_collections_collected
  ON member_collections(collected_member_id, created_at DESC);

ALTER TABLE member_collections ENABLE ROW LEVEL SECURITY;

ALTER TABLE member_profiles
  ADD COLUMN IF NOT EXISTS collections_last_viewed_at TIMESTAMPTZ;
