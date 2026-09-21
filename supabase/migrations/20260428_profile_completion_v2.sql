-- v2 of the profile completion onboarding fields.
-- Replaces the singular work_type with a multi-select work_types array,
-- removes work_location_flexible, and adds nomad_experience bucket.

ALTER TABLE member_profiles DROP CONSTRAINT IF EXISTS member_profiles_work_type_check;
ALTER TABLE member_profiles DROP COLUMN IF EXISTS work_type;
ALTER TABLE member_profiles DROP COLUMN IF EXISTS work_location_flexible;

ALTER TABLE member_profiles ADD COLUMN IF NOT EXISTS work_types       TEXT[];
ALTER TABLE member_profiles ADD COLUMN IF NOT EXISTS nomad_experience TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'member_profiles_nomad_experience_check'
  ) THEN
    ALTER TABLE member_profiles
      ADD CONSTRAINT member_profiles_nomad_experience_check
        CHECK (nomad_experience IS NULL OR nomad_experience IN (
          'not_yet','under_3m','3m_to_1y','1_to_3y','3_to_5y','5_to_10y','over_10y'
        ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'member_profiles_work_types_check'
  ) THEN
    ALTER TABLE member_profiles
      ADD CONSTRAINT member_profiles_work_types_check
        CHECK (
          work_types IS NULL
          OR work_types <@ ARRAY[
            'admin_mgmt','sales_marketing','finance_legal','it_engineering',
            'design_creative','education_research','healthcare_social',
            'tourism_hospitality','manufacturing_logistics','freelance_entrepreneur'
          ]::text[]
        );
  END IF;
END $$;

COMMENT ON COLUMN member_profiles.work_types IS
  'Multi-select work categories: admin_mgmt, sales_marketing, finance_legal, it_engineering, design_creative, education_research, healthcare_social, tourism_hospitality, manufacturing_logistics, freelance_entrepreneur';
COMMENT ON COLUMN member_profiles.nomad_experience IS
  'How long the member has been a digital nomad: not_yet | under_3m | 3m_to_1y | 1_to_3y | 3_to_5y | 5_to_10y | over_10y';
