# 環境變數配置說明

## 新增功能所需的環境變數

### 1. reCAPTCHA Enterprise 配置（訂單查詢功能）

為了啟用訂單查詢的 reCAPTCHA Enterprise 驗證，需要配置以下環境變數：

```bash
# reCAPTCHA Enterprise Site Key (前端使用)
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=6Lcu81gsAAAAAIrVoGK7urIEt9_w7gOoUSjzC5Uv

# reCAPTCHA Enterprise API Key (後端驗證使用)
RECAPTCHA_API_KEY=your_recaptcha_api_key

# reCAPTCHA Project ID (後端驗證使用)
RECAPTCHA_PROJECT_ID=tdna-1769599168858
```

**獲取 reCAPTCHA Enterprise 金鑰：**
1. 存取 [Google Cloud Console](https://console.cloud.google.com/)
2. 選擇或建立專案（Project ID: `tdna-1769599168858`）
3. 啟用 reCAPTCHA Enterprise API
4. 在 reCAPTCHA Enterprise 中建立網站金鑰
5. 獲取 API Key（在 API 和服務 > 憑證中）
6. 獲取 Site Key（在 reCAPTCHA Enterprise > 金鑰中）

**注意：** 如果未配置 reCAPTCHA，訂單查詢功能仍可使用，但不會進行驗證。

### 2. 郵件服務配置（Mailgun）

為了啟用郵件發送功能，需要配置以下環境變數：

```bash
# Mailgun API Key
MAILGUN_API_KEY=your_mailgun_api_key

# Mailgun 網域（必須是在 Mailgun 中驗證的網域）
MAILGUN_DOMAIN=yourdomain.com

# 寄件人電子郵件位址（必須使用驗證過的網域）
EMAIL_FROM=noreply@yourdomain.com

# 網站基礎 URL（用於產生訂單詳情連結和取消訂閱連結）
NEXT_PUBLIC_SITE_URL=https://yourdomain.com

# 取消訂閱 Token 金鑰（用於產生和驗證取消訂閱連結，建議使用隨機字串）
UNSUBSCRIBE_SECRET=your_random_secret_key_here
```

**設定 Mailgun：**
1. 存取 [Mailgun](https://www.mailgun.com) 並註冊帳號
2. 在 Dashboard 中添加並驗證你的網域
3. 在 Settings > API Keys 中獲取 Private API Key
4. 使用驗證過的網域作為 `MAILGUN_DOMAIN`
5. 使用驗證過的網域作為 `EMAIL_FROM`（例如：`noreply@yourdomain.com`）

**注意：** 如果未配置 Mailgun，郵件發送功能將被停用，但不會影響其他功能。

### 3. Instagram API 配置（Award 功能）

為了啟用 Award 頁面的 Instagram Reels 抓取功能，需要配置以下環境變數：

```bash
# Instagram Graph API Access Token
INSTAGRAM_ACCESS_TOKEN=your_instagram_access_token

# Instagram User ID
INSTAGRAM_USER_ID=your_instagram_user_id

# Instagram Hashtag ID（可選，如果使用 Hashtag API）
INSTAGRAM_HASHTAG_ID=your_hashtag_id

# 要抓取的 Hashtag（預設為 #taiwandigitalfest）
INSTAGRAM_HASHTAG=#taiwandigitalfest
```

**設定 Instagram API：**
1. 存取 [Facebook Developers](https://developers.facebook.com/) 並建立應用
2. 添加 Instagram Graph API 產品
3. 獲取 Access Token 和 User ID
4. （可選）如果需要使用 Hashtag API，需要先搜尋並獲取 Hashtag ID

**注意：** 如果未配置 Instagram API，Award 頁面仍可存取，但無法抓取 Reels。

### 4. 現有 Stripe 配置

確保以下 Stripe 環境變數已配置：

```bash
STRIPE_SECRET_KEY=sk_xxxxxxxxxxxxx
STRIPE_PRICE_EXPLORE=price_xxxxxxxxxxxxx
STRIPE_PRICE_CONTRIBUTE=price_xxxxxxxxxxxxx
STRIPE_PRICE_BACKER=price_xxxxxxxxxxxxx
```

## 安裝依賴

在配置環境變數之前，請先安裝新增的依賴套件：

```bash
npm install mailgun.js form-data
```

## 功能說明

### 訂單查詢功能
- 存取 `/order/query` 頁面
- 輸入訂單編號（Stripe Checkout Session ID 或 Payment Intent ID）
- 完成 reCAPTCHA 驗證（如果已配置）
- 查看訂單詳情

### 郵件通知功能
- 付款成功或取消後，系統會自動發送郵件通知
- 郵件包含訂單詳情和訂單詳情頁面連結
- 郵件發送失敗不會影響用戶體驗（僅在控制台記錄錯誤）

### 電子報訂閱功能
- 用戶訂閱電子報後，系統會自動發送感謝郵件
- 感謝郵件包含取消訂閱連結
- 用戶可以透過郵件中的連結取消訂閱
- 取消訂閱頁面：`/newsletter/unsubscribe?token=...`
- 取消訂閱 API：`/api/newsletter/unsubscribe`

### 訂單詳情頁面
- 存取 `/order/[id]` 查看訂單詳情
- 顯示完整的訂單資訊、付款狀態、商品明細等
