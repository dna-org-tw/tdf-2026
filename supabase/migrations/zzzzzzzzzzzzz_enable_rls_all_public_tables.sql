-- ================================================================
-- 啟用 public schema 所有資料表的 RLS（Supabase advisor: rls_disabled_in_public）
--
-- 2026-11-22 Supabase 安全通知：TDF 2026 (bphcdxxmpgtptjpnhikt) 有 public 表
-- 未啟用 RLS，任何拿到 project URL + anon/publishable key 的人都能經 PostgREST
-- 讀寫刪除該表。
--
-- 從 migrations 檔看，至少以下表沒有開 RLS：
--   order_actions, stay_weeks, stay_bookings, stay_booking_weeks,
--   stay_charge_attempts, stay_guarantees, stay_invite_codes,
--   stay_transfers, stay_waitlist_entries
-- 但 dashboard 也可能建過其他表，所以這裡直接掃 pg_tables 全部處理。
--
-- 所有存取都走 server-side（lib/supabaseServer.ts，SUPABASE_SECRET_KEY），
-- secret/service_role key 會繞過 RLS，前端沒有用 anon key，所以啟用 RLS
-- 且不加 policy＝對 anon/authenticated 全部拒絕，不影響現有功能。
--
-- 不使用 FORCE ROW LEVEL SECURITY：pg_cron 工作以 table owner 身分執行，
-- FORCE 會讓它們也受 RLS 限制。
--
-- 可重複執行（已啟用的表不會變動）。
-- ================================================================

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')      -- 一般表、分割表
      AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
    RAISE NOTICE 'RLS enabled: public.%', t.relname;
  END LOOP;
END
$$;

-- 驗證：應回傳 0 列
-- SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public' AND c.relkind IN ('r','p') AND NOT c.relrowsecurity;
