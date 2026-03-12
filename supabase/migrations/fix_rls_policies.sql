-- ================================================================
-- 修正 RLS (Row Level Security) 設定
--
-- 問題：visitors 和 email_logs 未啟用 RLS，
--       任何人都能用 Publishable Key 讀取/寫入敏感資料。
--
-- 所有資料表僅由 server-side (Secret Key) 操作，
-- Secret Key 會繞過 RLS，因此啟用 RLS 不影響現有功能。
-- ================================================================

-- ────────────────────────────────────────────────
-- 1. visitors — 啟用 RLS（含 IP、fingerprint 等敏感資訊）
-- ────────────────────────────────────────────────
ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;

-- 強制 table owner 也受 RLS 約束（更安全）
ALTER TABLE visitors FORCE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────
-- 2. email_logs — 啟用 RLS（含 email 地址、寄件紀錄）
-- ────────────────────────────────────────────────
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE email_logs FORCE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────
-- 3. 確認其他資料表 RLS 都已啟用
-- ────────────────────────────────────────────────
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE award_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ig_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_subscriptions ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────
-- 驗證：執行後可用以下 SQL 確認所有 public 表的 RLS 狀態
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
-- ────────────────────────────────────────────────
