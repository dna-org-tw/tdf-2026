-- Allow admin batch sends to choose between plain-text body (current behavior:
-- escaped + wrapped in branded template) and raw HTML body (sent verbatim with
-- only the compliance footer appended). Default 'plain' keeps existing rows
-- and any retries of older notifications working unchanged.
ALTER TABLE notification_logs
  ADD COLUMN IF NOT EXISTS body_format TEXT NOT NULL DEFAULT 'plain'
    CHECK (body_format IN ('plain', 'html'));
