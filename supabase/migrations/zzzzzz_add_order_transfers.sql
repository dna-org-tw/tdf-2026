-- Order transfer feature: lets ticket owners hand an order to another email,
-- with an audit trail and a configurable deadline (editable from admin).

-- 1. app_settings: simple key/value config store (currently only transfer deadline)
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings FORCE ROW LEVEL SECURITY;

INSERT INTO app_settings (key, value, description)
VALUES (
  'order_transfer_deadline',
  '2026-04-30T23:59:59+08:00',
  '訂單轉讓截止時間（ISO 8601，含時區）。此時間後使用者無法自助轉讓，僅管理員可強制執行。'
)
ON CONFLICT (key) DO NOTHING;

-- 2. order_transfers: full audit trail for every ownership change
CREATE TABLE IF NOT EXISTS order_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  parent_transfer_id UUID REFERENCES order_transfers(id) ON DELETE SET NULL,
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  initiated_by TEXT NOT NULL CHECK (initiated_by IN ('user', 'admin')),
  actor_user_id UUID,
  actor_admin_email TEXT,
  ip_address INET,
  user_agent TEXT,
  notes TEXT,
  transferred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_transfers_order_id ON order_transfers(order_id);
CREATE INDEX IF NOT EXISTS idx_order_transfers_from_email ON order_transfers(from_email);
CREATE INDEX IF NOT EXISTS idx_order_transfers_to_email ON order_transfers(to_email);
CREATE INDEX IF NOT EXISTS idx_order_transfers_transferred_at ON order_transfers(transferred_at DESC);

COMMENT ON TABLE order_transfers IS '訂單轉讓稽核：會員自助或管理員執行的票主 email 變更';
COMMENT ON COLUMN order_transfers.parent_transfer_id IS '若此筆是因母訂單被轉讓而帶動的子訂單轉讓，指向母訂單那筆';

ALTER TABLE order_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_transfers FORCE ROW LEVEL SECURITY;

-- 3. Extend order_actions.action CHECK so admin-initiated transfers also show in the admin timeline
ALTER TABLE order_actions DROP CONSTRAINT IF EXISTS order_actions_action_check;
ALTER TABLE order_actions ADD CONSTRAINT order_actions_action_check
  CHECK (action IN ('refund', 'cancel', 'edit', 'resend_receipt', 'note', 'manual_create', 'upgrade', 'transfer'));
