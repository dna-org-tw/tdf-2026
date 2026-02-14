# Visitor Tracking 訪客追蹤

進入網頁時自動記錄瀏覽器 fingerprint、IP、時區、語系等資訊至 Supabase，並在訂閱或購買時關聯裝置（fingerprint 作為 primary key）。

## 功能說明

1. **自動記錄**：用戶進入網站時，`VisitorTracker` 元件會：
   - 使用 FingerprintJS 取得瀏覽器 fingerprint
   - 取得時區與語系
   - 呼叫 `/api/visitors/record` 將資料存入 Supabase
   - 將 `visitor_fingerprint` 存至 `sessionStorage` 供後續關聯使用

2. **訂閱關聯**：用戶訂閱 newsletter 時，會將 `visitor_fingerprint` 傳給 subscribe API，寫入 `newsletter_subscriptions.visitor_fingerprint`，可識別是哪個裝置進行訂閱

3. **購買關聯**：用戶發起 checkout 時，會將 `visitor_fingerprint` 傳給 checkout API，寫入 `orders.visitor_fingerprint`，可識別是哪個裝置進行購買

## 資料庫設定

### 1. 執行 migrations

在 Supabase SQL Editor 中依序執行：

1. `supabase/migrations/create_visitors_table.sql` - 建立 visitors 表（fingerprint 為 PK）
2. `supabase/migrations/z_add_visitor_id_to_subscriptions_and_orders.sql` - 為 newsletter_subscriptions 和 orders 新增 visitor_fingerprint 外鍵

**注意**：若先前已執行舊版 migrations（visitors 表有 id 欄位、關聯欄位為 visitor_id），需先移除舊欄位再執行上述 migrations。

### 2. visitors 表結構

| 欄位 | 型別 | 說明 |
|------|------|------|
| fingerprint | TEXT | 主鍵，FingerprintJS visitorId |
| ip_address | TEXT | 客戶端 IP |
| timezone | TEXT | 時區 |
| locale | TEXT | 語系 |
| user_agent | TEXT | User-Agent |
| country | TEXT | 從 IP 解析的國家 |
| created_at | TIMESTAMPTZ | 建立時間 |
| updated_at | TIMESTAMPTZ | 更新時間 |

### 3. 關聯欄位

- `newsletter_subscriptions.visitor_fingerprint` → `visitors.fingerprint`
- `orders.visitor_fingerprint` → `visitors.fingerprint`

## 隱私與合規

- FingerprintJS 開源版為 MIT 授權，在瀏覽器端產生 hash 後的識別碼
- IP 與 fingerprint 為個人識別資訊，請依 GDPR/CCPA 等規範處理
- 建議在隱私政策中說明此資料收集用途
