# Taiwan Digital Fest 2026

Taiwan Digital Fest 2026 官方網站 - 一個為全球數位遊牧民族舉辦的節慶活動網站。

## 專案簡介

Taiwan Digital Fest 2026 是一個為期一個月的數位遊牧節慶活動，將於 2026 年 5 月 1 日至 5 月 31 日在台灣台東和花蓮舉行。本網站提供活動資訊、票務購買、活動日程、住宿地圖等功能。

## 技術棧

- **框架**: Next.js 16.1.2 (App Router)
- **語言**: TypeScript
- **樣式**: Tailwind CSS 4
- **動畫**: Framer Motion
- **資料庫**: Supabase
- **支付**: Stripe
- **郵件**: Mailgun
- **地圖**: Leaflet / React Leaflet
- **驗證**: reCAPTCHA Enterprise

## 功能特色

### 核心功能
- 🎫 **票務系統**: 整合 Stripe 的票務購買功能
- 📅 **活動日程**: 整合 Luma 活動日曆，顯示活動資訊和篩選功能
- 🗺️ **住宿地圖**: 互動式地圖顯示推薦住宿地點
- 📧 **電子報訂閱**: 郵件訂閱功能，支援取消訂閱
- 🏆 **Nomad Award**: Instagram Reels 投票系統
- 📱 **響應式設計**: 完整的行動裝置支援
- 🌐 **多語言支援**: 中英文切換

### 優化功能
- ⚡ **效能優化**: ISR、程式碼分割、動態導入
- 🔍 **SEO 優化**: 結構化資料、AEO 優化
- 📊 **分析追蹤**: Meta Pixel 事件追蹤
- 🛡️ **安全保護**: reCAPTCHA Enterprise 驗證

## 開始使用

### 環境需求

- Node.js 18+ 
- npm 或 yarn

### 安裝步驟

1. 克隆專案
```bash
git clone <repository-url>
cd tdf-2026
```

2. 安裝依賴
```bash
npm install
```

3. 配置環境變數

複製 `.env.example` 並建立 `.env` 檔案，填入必要的環境變數。詳細說明請參考 [ENV_SETUP.md](./ENV_SETUP.md)。

主要環境變數：
- `NEXT_PUBLIC_SITE_URL`: 網站 URL
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase 專案 URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Supabase Publishable Key（前端用）
- `SUPABASE_SECRET_KEY`: Supabase Secret Key（後端用）
- `STRIPE_SECRET_KEY`: Stripe 私鑰
- `STRIPE_PRICE_EXPLORE`, `STRIPE_PRICE_CONTRIBUTE`, `STRIPE_PRICE_BACKER`: Stripe 價格 ID
- `MAILGUN_API_KEY`: Mailgun API 金鑰
- `MAILGUN_DOMAIN`: Mailgun 域名
- `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`: reCAPTCHA Site Key
- `RECAPTCHA_API_KEY`: reCAPTCHA API Key
- `RECAPTCHA_PROJECT_ID`: reCAPTCHA Project ID

4. 執行開發伺服器
```bash
npm run dev
```

5. 開啟瀏覽器存取 [http://localhost:3000](http://localhost:3000)

## 專案結構

```
tdf-2026/
├── app/                    # Next.js App Router 頁面
│   ├── api/               # API 路由
│   ├── award/             # Award 頁面
│   ├── checkout/          # 結帳頁面
│   ├── order/             # 訂單查詢頁面
│   └── newsletter/        # 電子報頁面
├── components/            # React 組件
│   ├── sections/          # 頁面區塊組件
│   └── ...
├── data/                  # 靜態資料
├── hooks/                 # React Hooks
├── lib/                   # 工具函數
├── types/                 # TypeScript 類型定義
└── public/                # 靜態資源
```

## 可用腳本

- `npm run dev`: 啟動開發伺服器
- `npm run build`: 建置生產版本
- `npm run start`: 啟動生產伺服器
- `npm run lint`: 執行 ESLint 檢查
- `npm run analyze`: 分析 bundle 大小（需要 `@next/bundle-analyzer`）

## 資料庫設置

本專案使用 Supabase 作為資料庫。詳細的資料庫設置說明請參考 [AWARD_DATABASE_SETUP.md](./AWARD_DATABASE_SETUP.md)。

## 文件

- [ENV_SETUP.md](./ENV_SETUP.md) - 環境變數配置說明
- [AWARD_DATABASE_SETUP.md](./AWARD_DATABASE_SETUP.md) - Award 功能資料庫設置
- [PERFORMANCE_OPTIMIZATIONS.md](./PERFORMANCE_OPTIMIZATIONS.md) - 效能優化記錄
- [AEO_OPTIMIZATION.md](./AEO_OPTIMIZATION.md) - AEO 優化實施記錄
- [META_EVENTS_TRACKING.md](./META_EVENTS_TRACKING.md) - Meta Pixel 事件追蹤說明
- [META_EVENTS_MISSING.md](./META_EVENTS_MISSING.md) - Meta 標準事件遺漏檢查

## 部署

本專案已配置為 standalone 輸出模式，適合使用 Docker 部署。也可以部署到 Vercel、Netlify 等平台。

### Docker 部署

```bash
docker build -t tdf-2026 .
docker run -p 3000:3000 tdf-2026
```

## 授權

本專案為私有專案。

## 聯絡資訊

如有問題或建議，請透過網站上的聯絡方式聯繫。
