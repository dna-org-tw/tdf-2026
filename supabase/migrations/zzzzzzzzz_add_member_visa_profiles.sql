-- Dedicated storage for visa-document identity data.
-- Kept separate from member_profiles because this table contains passport PII.

CREATE TABLE IF NOT EXISTS member_visa_profiles (
  id BIGSERIAL PRIMARY KEY,
  member_id BIGINT NOT NULL UNIQUE REFERENCES members(id) ON DELETE CASCADE,
  legal_name_en TEXT NOT NULL,
  nationality TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  passport_number TEXT NOT NULL,
  passport_country TEXT NOT NULL,
  passport_expiry_date DATE NOT NULL,
  planned_arrival_date DATE NOT NULL,
  planned_departure_date DATE NOT NULL,
  taiwan_stay_address TEXT NOT NULL,
  destination_mission TEXT,
  notes_for_letter TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_member_visa_profiles_member_id
  ON member_visa_profiles(member_id);

CREATE TRIGGER trg_member_visa_profiles_updated_at
  BEFORE UPDATE ON member_visa_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_member_profiles_updated_at();

COMMENT ON TABLE member_visa_profiles IS
  'Server-only visa support letter profile data; includes passport-related PII.';
COMMENT ON COLUMN member_visa_profiles.legal_name_en IS
  'Legal English name exactly as shown on the passport.';
COMMENT ON COLUMN member_visa_profiles.destination_mission IS
  'Optional ROC mission / office where the member will submit the application.';

ALTER TABLE member_visa_profiles ENABLE ROW LEVEL SECURITY;
