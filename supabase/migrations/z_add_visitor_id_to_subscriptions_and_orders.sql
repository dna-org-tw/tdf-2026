-- 為 newsletter_subscriptions 添加 visitor_fingerprint 外鍵（關聯裝置）
ALTER TABLE newsletter_subscriptions
  ADD COLUMN IF NOT EXISTS visitor_fingerprint TEXT REFERENCES visitors(fingerprint) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_newsletter_subscriptions_visitor_fingerprint
  ON newsletter_subscriptions(visitor_fingerprint);

-- 為 orders 添加 visitor_fingerprint 外鍵（關聯裝置）
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS visitor_fingerprint TEXT REFERENCES visitors(fingerprint) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_visitor_fingerprint
  ON orders(visitor_fingerprint);
