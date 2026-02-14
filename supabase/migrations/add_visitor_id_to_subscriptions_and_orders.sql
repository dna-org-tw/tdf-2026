-- 為 newsletter_subscriptions 新增 visitor_id 外鍵
ALTER TABLE newsletter_subscriptions
  ADD COLUMN IF NOT EXISTS visitor_id UUID REFERENCES visitors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_newsletter_subscriptions_visitor_id 
  ON newsletter_subscriptions(visitor_id);

-- 為 orders 新增 visitor_id 外鍵
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS visitor_id UUID REFERENCES visitors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_visitor_id 
  ON orders(visitor_id);
