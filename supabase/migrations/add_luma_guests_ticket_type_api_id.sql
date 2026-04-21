-- Track which Luma ticket type api_id the guest currently holds. This lets the
-- auto-review upgrade a high-tier member off a lower-tier ticket to protect
-- low-tier capacity (e.g. a Backer member is auto-upgraded from TDF Follower
-- to TDF Backer so the Follower slot stays available for actual Followers).

ALTER TABLE luma_guests
  ADD COLUMN IF NOT EXISTS event_ticket_type_api_id TEXT;
