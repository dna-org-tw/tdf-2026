-- 創建 visitors 表
-- fingerprint 作為 primary key，識別裝置以關聯訂閱、購買操作
CREATE TABLE IF NOT EXISTS visitors (
  fingerprint TEXT PRIMARY KEY,  -- 來自 FingerprintJS 的 visitorId
  ip_address TEXT,
  timezone TEXT,
  locale TEXT,
  user_agent TEXT,
  country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_visitors_created_at ON visitors(created_at DESC);

-- 使用現有的 update_updated_at_column 函數
CREATE TRIGGER update_visitors_updated_at
  BEFORE UPDATE ON visitors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE visitors IS '訪客資訊：browser fingerprint、IP、時區、語系等，用於訂閱與訂單關聯';
