-- 更新 orders 表的 ticket_tier CHECK 約束，新增 'weekly_backer' 類型
-- 原約束只允許 ('explore', 'contribute', 'backer')，但 Weekly Backer 使用 'weekly_backer'

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_ticket_tier_check;

ALTER TABLE orders ADD CONSTRAINT orders_ticket_tier_check
  CHECK (ticket_tier IN ('explore', 'contribute', 'weekly_backer', 'backer'));

-- 更新 status CHECK 約束，新增 'expired' 狀態
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'expired', 'refunded'));

-- 更新欄位註解
COMMENT ON COLUMN orders.ticket_tier IS '票種類型：explore, contribute, weekly_backer, backer';
COMMENT ON COLUMN orders.status IS '訂單狀態：pending, paid, failed, cancelled, expired, refunded';
