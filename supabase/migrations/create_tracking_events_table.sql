-- Create tracking_events table for persisting frontend tracking events
-- (PageView, ViewContent, Lead, InitiateCheckout, CompleteRegistration, ScrollDepth, etc.)
-- Writes come from POST /api/events/track using the service role client.
CREATE TABLE tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL CHECK (event_type IN ('standard', 'custom')),
  event_name TEXT NOT NULL,
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  client_ip TEXT,
  user_agent TEXT,
  referer TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tracking_events_event_name ON tracking_events (event_name);
CREATE INDEX idx_tracking_events_created_at ON tracking_events (created_at DESC);
CREATE INDEX idx_tracking_events_parameters_gin ON tracking_events USING GIN (parameters);

ALTER TABLE tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_events FORCE ROW LEVEL SECURITY;
