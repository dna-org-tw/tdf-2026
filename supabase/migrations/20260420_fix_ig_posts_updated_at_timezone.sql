-- ================================================================
-- Fix ig_posts.updated_at timezone
--
-- The column was added ad-hoc in the Supabase dashboard as
-- TIMESTAMP WITHOUT TIME ZONE, inconsistent with the rest of the
-- schema which uses TIMESTAMPTZ. Interpreting naive timestamps as
-- UTC preserves their absolute instant when the DB session TZ is UTC
-- (Supabase default); verify before running if you override the
-- session TZ elsewhere.
-- ================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ig_posts'
      AND column_name = 'updated_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE ig_posts
      ALTER COLUMN updated_at TYPE TIMESTAMPTZ
      USING updated_at AT TIME ZONE 'UTC';
  END IF;
END $$;
