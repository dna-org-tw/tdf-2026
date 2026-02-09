-- 创建 orders 表
-- 用于存储 Stripe 支付订单信息

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id TEXT NOT NULL UNIQUE,
  stripe_payment_intent_id TEXT,
  ticket_tier TEXT NOT NULL CHECK (ticket_tier IN ('explore', 'contribute', 'backer')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'refunded')),
  amount_subtotal BIGINT NOT NULL DEFAULT 0, -- 以分为单位
  amount_total BIGINT NOT NULL DEFAULT 0, -- 以分为单位
  amount_tax BIGINT NOT NULL DEFAULT 0, -- 以分为单位
  amount_discount BIGINT NOT NULL DEFAULT 0, -- 以分为单位
  currency TEXT NOT NULL DEFAULT 'usd',
  customer_email TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  customer_address JSONB, -- 存储地址信息
  payment_method_brand TEXT,
  payment_method_last4 TEXT,
  payment_method_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session_id ON orders(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_stripe_payment_intent_id ON orders(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- 创建 updated_at 自动更新的触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 添加注释
COMMENT ON TABLE orders IS '存储 Stripe 支付订单信息';
COMMENT ON COLUMN orders.stripe_session_id IS 'Stripe checkout session ID';
COMMENT ON COLUMN orders.stripe_payment_intent_id IS 'Stripe payment intent ID';
COMMENT ON COLUMN orders.ticket_tier IS '票种类型：explore, contribute, backer';
COMMENT ON COLUMN orders.status IS '订单状态：pending, paid, failed, cancelled, refunded';
COMMENT ON COLUMN orders.amount_subtotal IS '小计金额（以分为单位）';
COMMENT ON COLUMN orders.amount_total IS '总金额（以分为单位）';
COMMENT ON COLUMN orders.amount_tax IS '税费（以分为单位）';
COMMENT ON COLUMN orders.amount_discount IS '折扣金额（以分为单位）';
COMMENT ON COLUMN orders.customer_address IS '客户地址信息（JSON 格式）';
