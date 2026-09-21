CREATE TABLE stay_weeks (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  price_twd INTEGER NOT NULL,
  room_capacity INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'sold_out', 'closed')),
  waitlist_offer_expires_in_minutes INTEGER NOT NULL DEFAULT 120,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE stay_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'confirmed', 'partially_transferred', 'transferred', 'cancelled', 'completed')),
  booking_type TEXT NOT NULL CHECK (booking_type IN ('guaranteed', 'complimentary')),
  primary_guest_name TEXT NOT NULL,
  primary_guest_email TEXT NOT NULL,
  primary_guest_phone TEXT NOT NULL,
  guest_count INTEGER NOT NULL CHECK (guest_count IN (1, 2)),
  second_guest_name TEXT,
  internal_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE stay_booking_weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES stay_bookings(id) ON DELETE CASCADE,
  member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  week_id BIGINT NOT NULL REFERENCES stay_weeks(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('confirmed', 'modified_out', 'modified_in', 'pending_transfer', 'transferred', 'cancelled', 'no_show', 'completed')),
  booked_price_twd INTEGER NOT NULL,
  hold_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (booking_id, week_id)
);

CREATE UNIQUE INDEX stay_booking_weeks_one_room_per_member_per_week
  ON stay_booking_weeks(member_id, week_id)
  WHERE status IN ('confirmed', 'modified_in', 'pending_transfer');

CREATE TABLE stay_guarantees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES stay_bookings(id) ON DELETE CASCADE,
  guarantee_type TEXT NOT NULL CHECK (guarantee_type IN ('stripe_card', 'complimentary')),
  stripe_customer_id TEXT,
  stripe_setup_intent_id TEXT,
  stripe_payment_method_id TEXT,
  card_brand TEXT,
  card_last4 TEXT,
  consented_at TIMESTAMPTZ,
  replaced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE stay_invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('active', 'reserved', 'used', 'disabled')),
  used_by_member_id BIGINT REFERENCES members(id) ON DELETE SET NULL,
  used_by_booking_id UUID REFERENCES stay_bookings(id) ON DELETE SET NULL,
  batch_label TEXT,
  notes TEXT,
  created_by TEXT,
  reserved_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE stay_waitlist_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id BIGINT NOT NULL REFERENCES stay_weeks(id) ON DELETE CASCADE,
  member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('active', 'offered', 'accepted', 'expired', 'declined', 'removed')),
  position INTEGER NOT NULL,
  offered_at TIMESTAMPTZ,
  offer_expires_at TIMESTAMPTZ,
  accepted_booking_week_id UUID REFERENCES stay_booking_weeks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (week_id, member_id)
);

CREATE TABLE stay_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_week_id UUID NOT NULL REFERENCES stay_booking_weeks(id) ON DELETE CASCADE,
  from_member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  to_member_id BIGINT REFERENCES members(id) ON DELETE RESTRICT,
  to_email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending_acceptance', 'accepted', 'expired', 'revoked')),
  booking_type TEXT NOT NULL CHECK (booking_type IN ('guaranteed', 'complimentary')),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE stay_charge_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_week_id UUID NOT NULL REFERENCES stay_booking_weeks(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('cancellation', 'no_show')),
  amount_twd INTEGER NOT NULL,
  stripe_payment_intent_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed')),
  created_by TEXT NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO stay_weeks (code, starts_on, ends_on, price_twd, room_capacity, status)
VALUES
  ('2026-w1', DATE '2026-04-30', DATE '2026-05-07', 6125, 30, 'active'),
  ('2026-w2', DATE '2026-05-07', DATE '2026-05-14', 4904, 40, 'active'),
  ('2026-w3', DATE '2026-05-14', DATE '2026-05-21', 5026, 40, 'active'),
  ('2026-w4', DATE '2026-05-21', DATE '2026-05-28', 5120, 40, 'active')
ON CONFLICT (code) DO NOTHING;
