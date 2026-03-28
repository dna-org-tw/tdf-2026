-- 建立 orders 表
-- 用於儲存 Stripe 支付訂單資訊

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id TEXT NOT NULL UNIQUE,
  stripe_payment_intent_id TEXT,
  ticket_tier TEXT NOT NULL CHECK (ticket_tier IN ('explore', 'contribute', 'weekly_backer', 'backer')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'expired', 'refunded')),
  amount_subtotal BIGINT NOT NULL DEFAULT 0, -- 以分為單位
  amount_total BIGINT NOT NULL DEFAULT 0, -- 以分為單位
  amount_tax BIGINT NOT NULL DEFAULT 0, -- 以分為單位
  amount_discount BIGINT NOT NULL DEFAULT 0, -- 以分為單位
  currency TEXT NOT NULL DEFAULT 'usd',
  customer_email TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  customer_address JSONB, -- 儲存地址資訊
  payment_method_brand TEXT,
  payment_method_last4 TEXT,
  payment_method_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 建立索引以提高查詢效能
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session_id ON orders(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_stripe_payment_intent_id ON orders(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- 建立 updated_at 自動更新的觸發器函數
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 建立觸發器
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 新增註解
COMMENT ON TABLE orders IS '儲存 Stripe 支付訂單資訊';
COMMENT ON COLUMN orders.stripe_session_id IS 'Stripe checkout session ID';
COMMENT ON COLUMN orders.stripe_payment_intent_id IS 'Stripe payment intent ID';
COMMENT ON COLUMN orders.ticket_tier IS '票種類型：explore, contribute, weekly_backer, backer';
COMMENT ON COLUMN orders.status IS '订单状态：pending, paid, failed, cancelled, refunded';
COMMENT ON COLUMN orders.amount_subtotal IS '小計金額（以分為單位）';
COMMENT ON COLUMN orders.amount_total IS '總金額（以分為單位）';
COMMENT ON COLUMN orders.amount_tax IS '稅費（以分為單位）';
COMMENT ON COLUMN orders.amount_discount IS '折扣金額（以分為單位）';
COMMENT ON COLUMN orders.customer_address IS '客戶地址資訊（JSON 格式）';
