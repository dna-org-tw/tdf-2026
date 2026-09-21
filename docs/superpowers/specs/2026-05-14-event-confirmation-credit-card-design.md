# 會員活動確認與信用卡擔保

**日期**：2026-05-14
**狀態**：設計完成，待實作
**相關檔案**：`app/me/`、`lib/lumaAutoReview.ts`、`lib/lumaSyncWorker.ts`、`lib/stayStripe.ts`、`supabase/migrations/`

## 目的

確保 Luma 活動報名者真的會出席，避免空座位浪費名額。會員必須：

1. 在 `/me` 看到自己已報名的 Luma 活動。
2. 綁定一張信用卡作為擔保（Stripe SetupIntent，off-session usage）。
3. 對每個活動主動點「確認出席」。
4. 未在 cutoff 前確認 → auto-review 將狀態降為 `waitlist`。
5. 已確認但 no-show（活動結束 4 小時寬限後 `checked_in_at` 仍為空）→ 以該活動 Standard Ticket 票價自動扣款。Standard Ticket 不存在則略過扣款。

## 背景

`lib/lumaSyncWorker.ts` 已在每 30 分鐘同步 `luma_guests`，`lib/lumaAutoReview.ts` 已有 cutoff gate（`lib/lumaCutoff.ts` 的 3-bucket 模型）與 no-show penalty audit。`lib/stayStripe.ts` 已有 SetupIntent + off-session charge 的範本（住宿 booking 用）。本設計把這兩條 pipeline 結合，加上一層「會員主動確認」的擔保流程。

## 規則

### 確認狀態（per 會員 × 活動）

| 狀態 | 觸發 | 影響 |
|---|---|---|
| `pending` | 預設值，luma_guests 同步時建立 | 在 cutoff 前可確認；過 cutoff 後 auto-review 降為 waitlist |
| `confirmed` | 會員在 cutoff 前點「確認出席」（要求已綁卡） | auto-review 維持原本決策；可被取消回 pending |
| `cancelled` | 會員在 cutoff 前點「取消確認」 | 視同 pending，過 cutoff 仍會被降為 waitlist |

### auto-review 新 gate（在 cutoff gate 之後）

對 cutoff 未到的活動：行為不變。

對 cutoff 已過的活動，現有 cutoff 覆寫表（見 `2026-05-02-luma-approve-cutoff-design.md`）已把多數人推為 `declined`，但「已 approved 且 makeDecision 仍判斷有效」的人會保留座位。**新增**：若這類保留者的 `event_confirmations.status !== 'confirmed'`，改寫為 `waitlist:unconfirmed`（而非 `declined`，讓他仍能在現場退票後遞補）。

| makeDecision 結果 | 當前 status | confirmation | 改寫 |
|---|---|---|---|
| `approved:*` | `approved` | `confirmed` | 維持 |
| `approved:*` | `approved` | 非 `confirmed` | → `waitlist:unconfirmed` |

`approved:downgraded` 的票降級邏輯仍套用（但若未確認則改為 waitlist，不再執行票種更動）。

### no-show 扣款條件（事後）

於既有 luma sync worker 加掃描階段：

- 活動 `end_at + 4h` 已過
- `luma_guests.checked_in_at IS NULL`
- `event_confirmations.status = 'confirmed'`（確認當下有綁卡 → snapshot 保存）
- 該活動有 Standard Ticket 且 `price_twd > 0`
- `no_show_charges` 表此 (member_id, event_api_id) 尚無成功紀錄

符合 → 以 snapshot 中的 `payment_method_id` off-session 扣款。

Standard Ticket 不存在或價格為 0 → 寫入 `no_show_charges.status='skipped'`，`failure_reason='no_standard_ticket'`，不重試。

### Standard Ticket 價格識別

在 Luma 同步 event 詳情時，把 `ticket_types` 陣列中 `name='Standard Ticket'` 的那筆價格（以 TWD 計）寫入 `luma_events.standard_ticket_price_twd`。沒找到則為 null。

## 資料庫變更

### 新表

```sql
-- 會員 Stripe Customer 與預設信用卡（一張）
CREATE TABLE member_payment_methods (
  member_id uuid PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  stripe_customer_id text NOT NULL,
  default_payment_method_id text NOT NULL,
  card_brand text,
  card_last4 text,
  card_exp_month int,
  card_exp_year int,
  attached_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 每位會員每個活動的確認狀態（pending 由 trigger 自動建立）
CREATE TABLE event_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  event_api_id text NOT NULL REFERENCES luma_events(event_api_id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'confirmed', 'cancelled')) DEFAULT 'pending',
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  payment_method_id_snapshot text,  -- 確認當下綁定的卡，後續扣款用
  stripe_customer_id_snapshot text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, event_api_id)
);

-- 扣款記錄（idempotent，UNIQUE 防重複扣）
CREATE TABLE no_show_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  event_api_id text NOT NULL REFERENCES luma_events(event_api_id),
  amount_twd int NOT NULL,
  stripe_payment_intent_id text UNIQUE,
  status text NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'skipped')),
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  charged_at timestamptz,
  UNIQUE (member_id, event_api_id)
);
```

### 既有表變更

```sql
ALTER TABLE luma_events
  ADD COLUMN standard_ticket_price_twd int;
```

### Trigger：guests 同步時自動建立 pending confirmation

`luma_guests` 每次 upsert（worker 同步時）如果 member_id 對得上，且 event_confirmations 沒有對應列 → INSERT (member_id, event_api_id, 'pending')。用 plpgsql trigger 實作避免應用層遺漏。

## API

### 會員自助

| 路徑 | 方法 | 用途 |
|---|---|---|
| `/api/me/luma-events` | GET | 列出當前會員的 upcoming `luma_guests`（含 confirmation 狀態、event 資料、cutoff 時間） |
| `/api/me/payment-method` | GET | 取得當前綁定信用卡資訊（last4/brand）或 null |
| `/api/me/payment-method/setup` | POST | 建立 SetupIntent，回傳 `client_secret` + `customer_id` |
| `/api/me/payment-method` | POST | SetupIntent 完成後，將 `payment_method_id` 設為預設並寫入 `member_payment_methods` |
| `/api/me/payment-method` | DELETE | 移除信用卡（Stripe detach + DB 刪除）。若有「已確認且 cutoff 未過」的活動則拒絕，提示先取消確認 |
| `/api/me/events/[eventApiId]/confirm` | POST | 確認出席。前置：已綁卡、event cutoff 未過、`luma_guests` 狀態為 `approved` 或 `pending_approval` |
| `/api/me/events/[eventApiId]/cancel-confirmation` | POST | 取消確認，回到 `pending`。前置：cutoff 未過 |

所有 `/api/me/*` 走既有 Supabase session（`AuthContext` / `/api/auth/session`）。

## UI

`/me` 頁面新增「活動確認」區塊，置於現有「我的訂單」之後、「我的個人資料」之前（待 layout 確認）。

```
┌─ 活動確認 ──────────────────────────────────────┐
│ 擔保信用卡: Visa •••• 4242                       │
│ 到期: 12/27         [更換]  [移除]               │
│                                                  │
│ 為什麼要綁卡？                                    │
│ 確認出席後若未到場，將扣取該活動 Standard Ticket │
│ 票價作為擔保金（免費活動不扣）。                  │
│                                                  │
│ ─────────────────────                           │
│                                                  │
│ ┌── 5/15 (五) 數位遊牧晚餐會 ──────────────┐    │
│ │ 19:00 @ 台東糖廠                          │    │
│ │ Standard Ticket 票價: NT$ 800             │    │
│ │ 確認截止: 5/15 12:00 (還剩 3 小時)        │    │
│ │ Luma 狀態: approved                        │    │
│ │ ✓ 已確認出席                              │    │
│ │                            [取消確認]      │    │
│ └────────────────────────────────────────────┘  │
│                                                  │
│ ┌── 5/18 (一) 共同工作日 ────────────────────┐  │
│ │ 09:00 @ 鹿野鄉                             │  │
│ │ 免費活動，未確認也不會扣款                  │  │
│ │ 確認截止: 5/18 00:00 (還剩 3 天)           │  │
│ │ Luma 狀態: approved                         │  │
│ │ ⚠️ 尚未確認                                │  │
│ │                            [確認出席]       │  │
│ └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

未綁卡前，所有「確認出席」按鈕替換為「先綁定信用卡」CTA，點擊開 Stripe Elements modal 完成 SetupIntent。免費活動（無 Standard Ticket）的「確認出席」不強制要求綁卡。

## 整合點

### lumaSyncWorker.ts

1. 同步事件 detail 時，從 Luma API 抓 `ticket_types`，找 `Standard Ticket` 寫入 `luma_events.standard_ticket_price_twd`。
2. 每輪 sync 後新增 `processNoShowCharges()` 階段：掃描 `end_at + 4h < now`、且 `(checked_in_at IS NULL) AND (event_confirmations.status='confirmed') AND no charge exists` 的紀錄，呼叫共用 `chargeNoShow(memberId, eventApiId, amountTwd, paymentMethodId, customerId)`。
3. 此函式從 `lib/stayStripe.ts` 抽出共用，移到 `lib/stripeOffSession.ts`。

### lumaAutoReview.ts

`makeDecision` 維持純函式。Worker 在套用 cutoff 覆寫之後、push 之前，再做一道 confirmation 覆寫：

```ts
if (isPastCutoff(event.startAt) && decision.status === 'approved' && currentStatus === 'approved') {
  const confirmation = await getEventConfirmation(memberId, eventApiId);
  if (confirmation?.status !== 'confirmed') {
    return { status: 'waitlist', reason: 'waitlist:unconfirmed' };
  }
}
```

### review log

新增 reason 字串：
- `waitlist:unconfirmed`
- audit-only 標記：no_show_charges 表本身即為 audit；不寫入 `luma_review_log`

## 環境變數

無新增。沿用既有 `STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET`、`SUPABASE_*`。

未來如需 webhook 處理 SetupIntent 確認，建議在既有 `/api/webhooks/stripe` 路由分支處理 `setup_intent.succeeded`，但 v1 採前端拿到 `payment_method_id` 後直接 POST `/api/me/payment-method`，較簡單。

## 失敗情境

| 情境 | 處理 |
|---|---|
| 扣款失敗（卡片過期、餘額不足） | `no_show_charges.status='failed'`，記 `failure_reason`，不重試。Admin 介面顯示「待人工處理」 |
| Stripe API 暫時不可用 | worker 階段 catch 例外，下一輪重試（idempotent UNIQUE 防重複） |
| 會員在活動前移除信用卡 | DELETE 路由拒絕（已 confirm 且 cutoff 未過的活動先取消確認）。若 cutoff 已過則允許移除，但 snapshot 仍會被用來扣款 |
| 會員 Luma 端取消報名 | 既有 reverse-sync 會移除 luma_guests；event_confirmations cascade 不必特別處理 |
| 活動被刪除 | `event_api_id` FK ON DELETE CASCADE |
| Standard Ticket 改名 | 設計上認 name='Standard Ticket' 字串匹配；若 admin 改名，price 抓不到 → 扣款 skipped。後續可改為 ticket_type_api_id 識別 |

## 測試重點

- pending → confirmed → cancelled 狀態轉換
- cutoff 後 auto-review 對「approved + unconfirmed」覆寫為 `waitlist:unconfirmed`
- no-show 掃描的 idempotency（重複跑不重複扣）
- Standard Ticket 不存在時 status='skipped'
- 已確認且 cutoff 未過時無法 DELETE payment method
- Stripe Customer 唯一性（同 email 多次 setup 不重建 customer）

## 不在範圍內

- 多張信用卡管理（v1 限一張預設卡）
- 退款流程（後續視需求做 admin 工具）
- 主動通知（email 提醒「請確認出席」/「您因 no-show 被扣款」）
- 申訴流程（v1 由 admin 手動處理）
- 部分扣款 / 比例扣款（一律全額）
- ticket tier 差異化擔保門檻（所有 tier 一視同仁）
