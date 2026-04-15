-- Adds three category preference flags to newsletter_subscriptions.
-- Each flag defaults to TRUE so existing subscribers retain delivery for all
-- categories. The global `unsubscribed_at` column remains the hard kill-switch.
ALTER TABLE newsletter_subscriptions
  ADD COLUMN IF NOT EXISTS pref_newsletter boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pref_events     boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pref_award      boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN newsletter_subscriptions.pref_newsletter IS
  'Festival newsletter (general announcements). Default true.';
COMMENT ON COLUMN newsletter_subscriptions.pref_events IS
  'Event & schedule update broadcasts. Default true.';
COMMENT ON COLUMN newsletter_subscriptions.pref_award IS
  'Nomad Award & community broadcasts. Default true.';
