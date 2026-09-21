-- 遷移腳本：從 visitor_id (UUID) 改為 visitor_fingerprint (TEXT)
-- 適用於已執行舊版 migrations 的資料庫

-- 1. 移除 newsletter_subscriptions 的 visitor_id 外鍵與欄位
ALTER TABLE newsletter_subscriptions
  DROP COLUMN IF EXISTS visitor_id;

-- 2. 移除 orders 的 visitor_id 外鍵與欄位
ALTER TABLE orders
  DROP COLUMN IF EXISTS visitor_id;

-- 3. 刪除舊 visitors 表
DROP TABLE IF EXISTS visitors;

-- 4. 建立新 visitors 表（fingerprint 為 PK）
CREATE TABLE visitors (
  fingerprint TEXT PRIMARY KEY,
  ip_address TEXT,
  timezone TEXT,
  locale TEXT,
  user_agent TEXT,
  country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visitors_created_at ON visitors(created_at DESC);

CREATE TRIGGER update_visitors_updated_at
  BEFORE UPDATE ON visitors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE visitors IS '訪客資訊：fingerprint 為 PK，識別裝置以關聯訂閱、購買操作';

-- 5. 為 newsletter_subscriptions 新增 visitor_fingerprint 外鍵
ALTER TABLE newsletter_subscriptions
  ADD COLUMN visitor_fingerprint TEXT REFERENCES visitors(fingerprint) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_newsletter_subscriptions_visitor_fingerprint
  ON newsletter_subscriptions(visitor_fingerprint);

-- 6. 為 orders 新增 visitor_fingerprint 外鍵
ALTER TABLE orders
  ADD COLUMN visitor_fingerprint TEXT REFERENCES visitors(fingerprint) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_visitor_fingerprint
  ON orders(visitor_fingerprint);
