-- Event confirmation + credit-card guarantee for Luma activities.
-- See docs/superpowers/specs/2026-05-14-event-confirmation-credit-card-design.md
--
-- Three new tables:
--   1. member_payment_methods — one default off-session payment method per member
--   2. event_confirmations    — per (member, event) confirmation state
--   3. no_show_charges        — idempotent Stripe charge ledger for no-shows
--
-- One existing-table change:
--   luma_events.standard_ticket_price_twd — captured during sync; null means
--   the event has no Standard Ticket and no-show is non-billable.
--
-- One trigger:
--   luma_guests upsert with member_id → auto-INSERT pending event_confirmations
--   row (idempotent via UNIQUE). Guarantees /me listing has a row to show.

ALTER TABLE luma_events
  ADD COLUMN IF NOT EXISTS standard_ticket_price_twd INTEGER;

CREATE TABLE IF NOT EXISTS member_payment_methods (
  member_id BIGINT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL,
  default_payment_method_id TEXT NOT NULL,
  card_brand TEXT,
  card_last4 TEXT,
  card_exp_month SMALLINT,
  card_exp_year SMALLINT,
  attached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE member_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_payment_methods FORCE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS event_confirmations (
  id BIGSERIAL PRIMARY KEY,
  member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  event_api_id TEXT NOT NULL REFERENCES luma_events(event_api_id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending','confirmed','cancelled')) DEFAULT 'pending',
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  payment_method_id_snapshot TEXT,
  stripe_customer_id_snapshot TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (member_id, event_api_id)
);

CREATE INDEX IF NOT EXISTS idx_event_confirmations_event
  ON event_confirmations (event_api_id, status);
CREATE INDEX IF NOT EXISTS idx_event_confirmations_member
  ON event_confirmations (member_id, status);

ALTER TABLE event_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_confirmations FORCE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS no_show_charges (
  id BIGSERIAL PRIMARY KEY,
  member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  event_api_id TEXT NOT NULL REFERENCES luma_events(event_api_id),
  amount_twd INTEGER NOT NULL,
  stripe_payment_intent_id TEXT UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('pending','succeeded','failed','skipped')),
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  charged_at TIMESTAMPTZ,
  UNIQUE (member_id, event_api_id)
);

CREATE INDEX IF NOT EXISTS idx_no_show_charges_event
  ON no_show_charges (event_api_id, status);
CREATE INDEX IF NOT EXISTS idx_no_show_charges_member
  ON no_show_charges (member_id, created_at DESC);

ALTER TABLE no_show_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE no_show_charges FORCE ROW LEVEL SECURITY;

-- Auto-create a pending confirmation row whenever a luma_guests upsert binds
-- to a member. Trigger fires AFTER INSERT/UPDATE OF member_id; idempotent via
-- the UNIQUE (member_id, event_api_id) constraint so re-syncs are no-ops.
CREATE OR REPLACE FUNCTION public.ensure_event_confirmation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.member_id IS NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO event_confirmations (member_id, event_api_id, status)
    VALUES (NEW.member_id, NEW.event_api_id, 'pending')
    ON CONFLICT (member_id, event_api_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_event_confirmation ON luma_guests;
CREATE TRIGGER trg_ensure_event_confirmation
  AFTER INSERT OR UPDATE OF member_id ON luma_guests
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_event_confirmation();

-- Keep updated_at fresh on event_confirmations and member_payment_methods.
-- Reuses update_updated_at_column() from create_orders_table.sql.
DROP TRIGGER IF EXISTS trg_touch_event_confirmations ON event_confirmations;
CREATE TRIGGER trg_touch_event_confirmations
  BEFORE UPDATE ON event_confirmations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_touch_member_payment_methods ON member_payment_methods;
CREATE TRIGGER trg_touch_member_payment_methods
  BEFORE UPDATE ON member_payment_methods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
