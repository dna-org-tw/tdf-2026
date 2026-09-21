-- Audit trail for each visa support letter generation.
-- document_no is generated from the row id so the app can rely on a race-free identifier.

CREATE TABLE IF NOT EXISTS visa_letter_issuances (
  id BIGSERIAL PRIMARY KEY,
  member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  document_no TEXT GENERATED ALWAYS AS (
    'TDF-VISA-2026-' || LPAD(id::text, 6, '0')
  ) STORED UNIQUE,
  letter_type TEXT NOT NULL DEFAULT 'visa_support'
    CHECK (letter_type = 'visa_support'),
  has_paid_order BOOLEAN NOT NULL DEFAULT FALSE,
  order_snapshot JSONB,
  profile_snapshot JSONB NOT NULL,
  pdf_checksum TEXT,
  issued_by TEXT NOT NULL DEFAULT 'system',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visa_letter_issuances_member_issued_at
  ON visa_letter_issuances(member_id, issued_at DESC);

COMMENT ON TABLE visa_letter_issuances IS
  'One row per generated visa support PDF.';
COMMENT ON COLUMN visa_letter_issuances.document_no IS
  'Public-facing document number shown on the PDF.';
COMMENT ON COLUMN visa_letter_issuances.order_snapshot IS
  'Paid-order details included in the PDF at issue time, if any.';
COMMENT ON COLUMN visa_letter_issuances.profile_snapshot IS
  'Full member visa profile used to render the PDF.';

ALTER TABLE visa_letter_issuances ENABLE ROW LEVEL SECURITY;
