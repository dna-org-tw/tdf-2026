# 訂單系統說明

本系統實現了在 Supabase 中儲存和管理 Stripe 支付訂單的功能。

## 功能概述

1. **建立訂單**：在使用者發起購買時，建立 Stripe checkout session 的同時在 Supabase 中建立訂單記錄
2. **更新訂單狀態**：透過 Stripe webhook 和 success 頁面同步更新訂單狀態

## 資料庫設定

### 1. 建立 orders 表

在 Supabase Dashboard 中執行 SQL 遷移檔案：

```bash
# 檔案位置：supabase/migrations/create_orders_table.sql
```

或者直接在 Supabase SQL Editor 中執行該檔案的內容。

### 2. 表結構說明

- `id`: UUID 主鍵
- `stripe_session_id`: Stripe checkout session ID（唯一）
- `stripe_payment_intent_id`: Stripe payment intent ID
- `ticket_tier`: 票種類型（explore, contribute, backer）
- `status`: 訂單狀態（pending, paid, failed, cancelled, refunded）
- `amount_*`: 金額欄位（以分為單位）
- `currency`: 貨幣代碼
- `customer_*`: 客戶資訊欄位
- `customer_address`: JSONB 格式的地址資訊
- `payment_method_*`: 支付方式資訊
- `created_at`, `updated_at`: 時間戳

## API 端點

### 1. 建立訂單
- **端點**: `POST /api/checkout`
- **功能**: 建立 Stripe checkout session 並在 Supabase 中建立訂單記錄
- **修改檔案**: `app/api/checkout/route.ts`

### 2. Webhook 處理
- **端點**: `POST /api/webhooks/stripe`
- **功能**: 處理 Stripe webhook 事件，更新訂單狀態
- **檔案**: `app/api/webhooks/stripe/route.ts`
- **需要配置**: `STRIPE_WEBHOOK_SECRET` 環境變數

### 3. 同步訂單狀態
- **端點**: `POST /api/order/sync`
- **功能**: 從 Stripe 同步訂單資訊到 Supabase
- **檔案**: `app/api/order/sync/route.ts`

## 環境變數

確保以下環境變數已配置：

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SECRET_KEY=sb_secret_your_secret_key

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_webhook_secret  # 用於驗證 webhook 請求
```

## Webhook 配置

在 Stripe Dashboard 中配置 webhook：

1. 進入 Stripe Dashboard > Developers > Webhooks
2. 添加端點：`https://your-domain.com/api/webhooks/stripe`
3. 選擇以下事件：
   - `checkout.session.completed` - 支付完成
   - `checkout.session.async_payment_succeeded` - 非同步支付成功
   - `checkout.session.async_payment_failed` - 非同步支付失敗
   - `checkout.session.expired` - Session 過期/取消
   - `payment_intent.succeeded` - 支付意圖成功
4. 複製 webhook signing secret 到 `STRIPE_WEBHOOK_SECRET` 環境變數

## 訂單狀態流程

1. **pending**: 訂單已建立，等待支付
2. **paid**: 支付成功
3. **failed**: 支付失敗
4. **cancelled**: 訂單已取消（使用者取消付款或 session 過期）
5. **refunded**: 已退款

### 取消訂單處理

當客戶取消付款時，系統會透過以下方式更新訂單狀態：

1. **取消頁面同步** (`app/checkout/cancelled/page.tsx`)
   - 使用者存取取消頁面時，自動呼叫 `/api/order/sync` API
   - 強制將訂單狀態設為 `cancelled`

2. **Webhook 事件** (`app/api/webhooks/stripe/route.ts`)
   - 處理 `checkout.session.expired` 事件
   - 自動將過期 session 的訂單狀態更新為 `cancelled`

3. **狀態對應邏輯**
   - Session 狀態為 `expired` → `cancelled`
   - Session 未完成且支付狀態為 `unpaid` → `cancelled`

## 程式碼檔案

- `lib/types/order.ts`: 訂單類型定義
- `lib/orders.ts`: 訂單資料庫操作函數
- `app/api/checkout/route.ts`: 建立訂單 API
- `app/api/webhooks/stripe/route.ts`: Webhook 處理（包含取消事件）
- `app/api/order/sync/route.ts`: 訂單同步 API（支援強制狀態）
- `app/checkout/success/page.tsx`: 支付成功頁面（已更新）
- `app/checkout/cancelled/page.tsx`: 支付取消頁面（已更新，自動同步訂單狀態）

## 使用範例

### 建立訂單
```typescript
// 在 checkout API 中自動建立
const order = await createOrder({
  stripe_session_id: session.id,
  ticket_tier: 'explore',
  amount_subtotal: 10000,
  amount_total: 10000,
  amount_tax: 0,
  amount_discount: 0,
  currency: 'usd',
});
```

### 更新訂單狀態
```typescript
const updatedOrder = await updateOrder(sessionId, {
  status: 'paid',
  stripe_payment_intent_id: paymentIntent.id,
  customer_email: 'customer@example.com',
});
```

## 注意事項

1. 金額欄位以分為單位儲存（Stripe 的標準格式）
2. 訂單狀態透過 webhook 和 success 頁面雙重更新，確保資料一致性
3. 如果 webhook 失敗，success 頁面會嘗試同步訂單狀態
4. 所有資料庫操作都有錯誤處理，不會影響 Stripe checkout 流程
