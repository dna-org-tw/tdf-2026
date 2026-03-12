-- 建立住宿媒合平台相關表
-- 用於台灣數位嘉年華 2026 台東住宿媒合系統

-- ===== accommodation_properties =====
CREATE TABLE IF NOT EXISTS accommodation_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_email TEXT NOT NULL,
  host_name TEXT NOT NULL,
  host_phone TEXT,
  name_zh TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_zh TEXT,
  description_en TEXT,
  address_zh TEXT NOT NULL,
  address_en TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  license_number TEXT NOT NULL,
  property_type TEXT CHECK (property_type IN ('hotel', 'hostel', 'bnb', 'guesthouse')),
  amenities JSONB NOT NULL DEFAULT '[]',
  cover_photo_url TEXT,
  photos JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accommodation_properties_is_active ON accommodation_properties(is_active);
CREATE INDEX IF NOT EXISTS idx_accommodation_properties_host_email ON accommodation_properties(host_email);

CREATE TRIGGER update_accommodation_properties_updated_at
  BEFORE UPDATE ON accommodation_properties
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE accommodation_properties IS '台東合法旅宿資料';
COMMENT ON COLUMN accommodation_properties.license_number IS '合法旅宿登記證號';
COMMENT ON COLUMN accommodation_properties.photos IS '照片陣列 [{url, alt_zh, alt_en}]';
COMMENT ON COLUMN accommodation_properties.amenities IS '設施清單 ["wifi","kitchen","parking","ac"]';

-- ===== accommodation_rooms =====
CREATE TABLE IF NOT EXISTS accommodation_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES accommodation_properties(id) ON DELETE CASCADE,
  name_zh TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_zh TEXT,
  description_en TEXT,
  max_guests INT NOT NULL DEFAULT 2,
  bed_type TEXT,
  room_size_sqm INT,
  amenities JSONB NOT NULL DEFAULT '[]',
  photos JSONB NOT NULL DEFAULT '[]',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accommodation_rooms_property_id ON accommodation_rooms(property_id);

CREATE TRIGGER update_accommodation_rooms_updated_at
  BEFORE UPDATE ON accommodation_rooms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE accommodation_rooms IS '旅宿房型資料';
COMMENT ON COLUMN accommodation_rooms.bed_type IS '床型：single, double, queen, king, bunk';
COMMENT ON COLUMN accommodation_rooms.photos IS '照片陣列 [{url, alt_zh, alt_en}]';

-- ===== accommodation_availability =====
CREATE TABLE IF NOT EXISTS accommodation_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES accommodation_rooms(id) ON DELETE CASCADE,
  week_period TEXT NOT NULL CHECK (week_period IN ('week1', 'week2', 'week3', 'week4')),
  price_per_week BIGINT NOT NULL,
  total_units INT NOT NULL DEFAULT 1,
  booked_units INT NOT NULL DEFAULT 0,
  is_available BOOLEAN GENERATED ALWAYS AS (booked_units < total_units) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(room_id, week_period)
);

CREATE INDEX IF NOT EXISTS idx_accommodation_availability_room_week ON accommodation_availability(room_id, week_period);

CREATE TRIGGER update_accommodation_availability_updated_at
  BEFORE UPDATE ON accommodation_availability
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE accommodation_availability IS '各週次房型可售狀態與價格';
COMMENT ON COLUMN accommodation_availability.week_period IS 'week1=5/1-7, week2=5/8-14, week3=5/15-21, week4=5/22-28';
COMMENT ON COLUMN accommodation_availability.price_per_week IS '每週價格（新台幣整數）';

-- ===== accommodation_bookings =====
CREATE TABLE IF NOT EXISTS accommodation_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES accommodation_rooms(id),
  property_id UUID NOT NULL REFERENCES accommodation_properties(id),
  availability_id UUID NOT NULL REFERENCES accommodation_availability(id),
  week_period TEXT NOT NULL,
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'refunded')),
  amount_total BIGINT NOT NULL DEFAULT 0,
  guest_email TEXT,
  guest_name TEXT,
  guest_phone TEXT,
  guest_notes TEXT,
  num_guests INT NOT NULL DEFAULT 1,
  visitor_fingerprint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accommodation_bookings_stripe_session_id ON accommodation_bookings(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_accommodation_bookings_status ON accommodation_bookings(status);
CREATE INDEX IF NOT EXISTS idx_accommodation_bookings_guest_email ON accommodation_bookings(guest_email);

CREATE TRIGGER update_accommodation_bookings_updated_at
  BEFORE UPDATE ON accommodation_bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE accommodation_bookings IS '住宿訂單';

-- ===== Atomic booking RPC (prevent overbooking) =====
CREATE OR REPLACE FUNCTION book_accommodation(p_availability_id UUID)
RETURNS SETOF accommodation_availability AS $$
  UPDATE accommodation_availability
  SET booked_units = booked_units + 1, updated_at = NOW()
  WHERE id = p_availability_id AND booked_units < total_units
  RETURNING *;
$$ LANGUAGE sql;

COMMENT ON FUNCTION book_accommodation IS '原子性訂房操作，防止超賣';

-- ===== Host auth tokens =====
CREATE TABLE IF NOT EXISTS accommodation_host_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accommodation_host_tokens_email ON accommodation_host_tokens(host_email);

COMMENT ON TABLE accommodation_host_tokens IS '旅宿業者 email 驗證碼';
