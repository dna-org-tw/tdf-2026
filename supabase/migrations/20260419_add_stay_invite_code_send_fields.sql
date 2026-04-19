ALTER TABLE stay_invite_codes
  ADD COLUMN sent_to_email TEXT,
  ADD COLUMN sent_at TIMESTAMPTZ,
  ADD COLUMN sent_by TEXT;
