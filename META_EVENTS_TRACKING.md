# Meta 標準事件追蹤清單

本文件記錄了整個網站中已實現的 Meta (Facebook Pixel) 標準事件追蹤。

## 已實現的 Meta 標準事件

**注意**: 我們使用 `CompleteRegistration` 而非 `Subscribe` 來追蹤免費郵箱訂閱，因為 `Subscribe` 事件通常用於付費訂閱服務。

### 1. PageView
**位置**: `components/FacebookPixel.tsx`
- **觸發時機**: 每個頁面載入時自動觸發
- **說明**: 基礎頁面瀏覽追蹤，已在 Facebook Pixel 初始化時自動設定

### 2. ViewContent
**位置**: 多個組件和頁面
- **觸發時機**: 
  - 各個 Section 進入視口時（透過 `useSectionTracking` hook）
  - 訂單詳情頁面載入時
  - 訂單查詢頁面載入時
  - 結帳成功頁面載入時
  - 結帳取消頁面載入時
  - 票務區塊查看時
  - YouTube 影片播放時
- **實現位置**:
  - `hooks/useSectionTracking.ts` - 自動追蹤所有使用該 hook 的 section
  - `app/order/[id]/page.tsx` - 訂單詳情頁
  - `app/order/query/page.tsx` - 訂單查詢頁
  - `app/checkout/success/page.tsx` - 結帳成功頁
  - `app/checkout/cancelled/page.tsx` - 結帳取消頁
  - `components/sections/TicketsSection.tsx` - 票務區塊
  - `components/LazyYouTubeEmbed.tsx` - 影片播放

### 3. CompleteRegistration
**位置**: 訂閱表單組件
- **觸發時機**: 用戶成功訂閱免費時事通訊時
- **說明**: 使用 CompleteRegistration 而非 Subscribe，因為我們的郵箱訂閱是免費的。Subscribe 事件通常用於付費訂閱。
- **實現位置**:
  - `components/sections/HeroSection.tsx` - Hero 區塊訂閱表單
  - `components/sections/FollowUsSection.tsx` - Follow Us 區塊訂閱表單
  - `components/sections/TicketsSection.tsx` - 票務區塊訂閱表單
- **參數**:
  - `content_name`: 表單名稱
  - `content_category`: 'Newsletter Subscription'

### 4. Subscribe
**說明**: 目前未使用。Subscribe 事件通常用於付費訂閱服務。我們的郵箱訂閱是免費的，因此使用 CompleteRegistration 事件。

### 5. InitiateCheckout
**位置**: `components/sections/TicketsSection.tsx`
- **觸發時機**: 用戶點擊票務購買按鈕，開始結帳流程
- **參數**:
  - `content_name`: 票務類型名稱
  - `content_category`: 'Tickets'
  - `content_ids`: 票務層級識別碼
  - `value`: 價格
  - `currency`: 'USD'
  - `num_items`: 1

### 6. AddPaymentInfo
**位置**: `components/sections/TicketsSection.tsx`
- **觸發時機**: 用戶點擊結帳按鈕，即將進入支付資訊輸入頁面
- **參數**:
  - `content_name`: 票務類型名稱
  - `content_category`: 'Tickets'
  - `content_ids`: 票務層級識別碼
  - `value`: 價格
  - `currency`: 'USD'

### 7. Purchase
**位置**: `app/checkout/success/page.tsx`
- **觸發時機**: 用戶完成支付，訂單確認成功
- **參數**:
  - `value`: 訂單總金額（轉換為美元）
  - `currency`: 貨幣代碼（大寫）
  - `content_name`: 票務類型
  - `content_category`: 'Tickets'
  - `content_ids`: 訂單 ID 陣列
  - `num_items`: 商品數量

### 8. Lead
**位置**: 多個 CTA 按鈕和連結
- **觸發時機**: 用戶點擊潛在客戶生成相關的連結
- **實現位置**:
  - `components/sections/HeroSection.tsx` - Call for Speakers/Volunteers/Partners/Side Events
  - `components/Navbar.tsx` - Instagram 連結、Register CTA
  - `components/Footer.tsx` - 所有 CTA 連結、Instagram 連結
  - `components/sections/EventsSection.tsx` - Luma 活動連結和活動輪播連結
- **參數**:
  - `content_name`: CTA 名稱
  - `content_category`: 分類（'CTA', 'Social Media', 'Event Schedule' 等）

### 9. Search
**位置**: 搜尋相關功能
- **觸發時機**: 
  - 用戶提交訂單查詢
  - 用戶在日程表中使用篩選器
- **實現位置**:
  - `app/order/query/page.tsx` - 訂單查詢
  - `components/sections/EventsSection.tsx` - 日程篩選
- **參數**:
  - `search_string`: 搜尋關鍵詞或篩選類型
  - `content_category`: 搜尋類別

### 10. Contact
**位置**: `components/Footer.tsx`
- **觸發時機**: 用戶點擊郵箱聯絡連結
- **參數**:
  - `content_category`: 'Email Contact'

### 11. Unsubscribe (自訂事件)
**位置**: `app/newsletter/unsubscribe/page.tsx`
- **觸發時機**: 用戶成功取消訂閱時事通訊
- **說明**: 雖然 Meta 沒有標準的 Unsubscribe 事件，但我們使用自訂事件追蹤

## 自訂事件追蹤

除了 Meta 標準事件外，我們還使用自訂事件來追蹤更細粒度的用戶行為：

### 導航相關
- `NavClick` - 導覽列點擊
- `SectionView` - Section 查看

### 訂閱相關
- `HeroFollowSubmit`, `HeroFollowSuccess`, `HeroFollowError`, `HeroFollowDuplicate` - Hero 區塊訂閱
- `FollowUsSubmit`, `FollowUsSuccess`, `FollowUsError`, `FollowUsDuplicate` - Follow Us 區塊訂閱
- `TicketsFollowSuccess`, `TicketsFollowError`, `TicketsFollowDuplicate` - 票務區塊訂閱
- `NewsletterUnsubscribe` - 取消訂閱

### 結帳相關
- `StripeCheckoutClick` - Stripe 結帳點擊
- `TicketPurchaseSuccess` - 票務購買成功
- `TicketPurchaseCancelled` - 票務購買取消
- `OrderQuerySearch` - 訂單查詢搜尋

### 活動相關
- `EventClick` - 日程表活動點擊（EventsSection）
- `EventCarouselClick` - 活動輪播點擊（EventsSection）
- `ScheduleFilter` - 日程篩選器使用（EventsSection）

### CTA 相關
- `CallForSpeakersClick` - Call for Speakers 點擊
- `CallForVolunteersClick` - Call for Volunteers 點擊
- `CallForPartnersClick` - Call for Partners 點擊
- `CallForSideEventsClick` - Call for Side Events 點擊
- `CallForSponsorsClick` - Call for Sponsors 點擊

### 外部連結
- `ExternalLinkClick` - 外部連結點擊（Instagram 等）
- `EmailClick` - 郵箱連結點擊
- `OrderQueryClick` - 訂單查詢連結點擊

### 影片相關
- `YouTubeVideoPlay` - YouTube 影片播放

## 事件追蹤覆蓋範圍

### 頁面級別
- ✅ 首頁 (Home)
- ✅ 訂單查詢頁 (`/order/query`)
- ✅ 訂單詳情頁 (`/order/[id]`)
- ✅ 結帳成功頁 (`/checkout/success`)
- ✅ 結帳取消頁 (`/checkout/cancelled`)
- ✅ 取消訂閱頁 (`/newsletter/unsubscribe`)

### Section 級別
所有主要 Section 都透過 `useSectionTracking` hook 自動追蹤 ViewContent：
- ✅ Hero Section
- ✅ About Section
- ✅ Why Section
- ✅ Highlights Section
- ✅ Schedule Section
- ✅ Tickets Section
- ✅ Ticket Follow Section
- ✅ Accommodation Section
- ✅ Team Section
- ✅ Follow Us Section

### 用戶互動
- ✅ 表單提交（訂閱、訂單查詢）
- ✅ 按鈕點擊（結帳、CTA）
- ✅ 連結點擊（外部連結、社群媒體）
- ✅ 影片播放
- ✅ 篩選器使用
- ✅ 導覽點擊

## 事件參數規範

所有事件都遵循 Meta 標準事件參數規範：

### 通用參數
- `content_name`: 內容名稱
- `content_category`: 內容分類
- `content_type`: 內容類型（如 'section', 'video', 'product_listing'）
- `content_ids`: 內容 ID 陣列

### 電商相關參數
- `value`: 金額（美元）
- `currency`: 貨幣代碼（大寫，如 'USD'）
- `num_items`: 商品數量

### 搜尋相關參數
- `search_string`: 搜尋關鍵詞

## 注意事項

1. **隱私合規**: 所有事件追蹤都符合 GDPR 和隱私法規要求
2. **效能優化**: 事件追蹤不會影響頁面效能，使用非同步方式發送
3. **錯誤處理**: 所有事件追蹤都有錯誤處理，不會影響用戶體驗
4. **數據準確性**: 使用標準事件名稱和參數，確保數據在 Meta 平台中正確識別

## 未來改進建議

1. 考慮添加 `AddToCart` 事件（如果未來有購物車功能）
2. 考慮添加 `CompleteRegistration` 事件（用於用戶註冊，如果有註冊功能）
3. 考慮添加 `StartTrial` 事件（如果有試用功能）
4. 優化事件參數，添加更多上下文資訊（如用戶來源、裝置類型等）
