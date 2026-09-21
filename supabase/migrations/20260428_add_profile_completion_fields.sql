-- Profile completion fields for the in-app onboarding modal.
-- New columns extend member_profiles with nomad-specific identity data.

ALTER TABLE member_profiles
  ADD COLUMN IF NOT EXISTS nationality              TEXT,
  ADD COLUMN IF NOT EXISTS work_type                TEXT,
  ADD COLUMN IF NOT EXISTS work_location_flexible   BOOLEAN,
  ADD COLUMN IF NOT EXISTS consent_activity_stats   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS consent_activity_stats_at TIMESTAMPTZ;

-- Allowed work_type values
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'member_profiles_work_type_check'
  ) THEN
    ALTER TABLE member_profiles
      ADD CONSTRAINT member_profiles_work_type_check
        CHECK (work_type IS NULL OR work_type IN ('remote','freelancer','entrepreneur','other'));
  END IF;
END $$;

COMMENT ON COLUMN member_profiles.nationality IS 'Free-form country name, e.g. "Taiwan", "Japan", "United States"';
COMMENT ON COLUMN member_profiles.work_type IS 'remote | freelancer | entrepreneur | other';
COMMENT ON COLUMN member_profiles.work_location_flexible IS 'TRUE if member can work in different cities/countries';
COMMENT ON COLUMN member_profiles.consent_activity_stats IS 'Consent to record activity and use anonymized statistics';
COMMENT ON COLUMN member_profiles.consent_activity_stats_at IS 'When the consent was given';
