# 設計：遷移正規網址至 `www.taiwandigitalfest.com/2026/:path`

- 日期：2026-06-18
- 狀態：待實作
- 機制：Next.js `basePath: '/2026'`

## 1. 目標

將網站的正規（canonical）網址從子網域 `https://2026.taiwandigitalfest.com/`（根路徑）遷移至路徑前綴方案 `https://www.taiwandigitalfest.com/2026/:path`。所有對應的資源位置、SEO metadata、內部連結與轉向一併調整，使新方案下的功能與 SEO 與遷移前等價。

## 2. 決策（已與使用者確認）

| 項目 | 決策 |
|------|------|
| 路徑機制 | Next.js `basePath: '/2026'`（非反向代理 rewrite） |
| 舊子網域 `2026.taiwandigitalfest.com/*` | 301 轉址至 `www.taiwandigitalfest.com/2026/*` |
| www 裸根目錄 `/` | 轉址至 `/2026/` |
| 舊子網域與 www 根目錄轉址的執行層 | Zeabur 基礎設施層（程式先完成，Zeabur 設定由 Claude 協助使用者操作） |

## 3. 架構

App 設定 `basePath: '/2026'` 後，整個 Next 應用只服務 `/2026/*`。透過 `NEXT_PUBLIC_BASE_PATH` 環境變數注入，確保 dev 與 prod 行為一致。

### 3.1 `basePath` 自動處理（不需改碼）

- `<Link href>`、`next/image` 的 `src`、`router.push()`/`router.replace()`、`redirect()` → 自動補 `/2026` 前綴
- `_next/static`、`_next/image` 等內部資源 → 自動補前綴
- API route 定義（`app/api/**`）→ 自動服務於 `/2026/api/*`
- `middleware`（`proxy.ts`）的 `matcher` → Next 在建置時自動補 `/2026` 前綴
- `next.config` 的 `redirects()` / `rewrites()` → 自動補前綴（除非設 `basePath: false`）

### 3.2 需手動調整（實作重點）

1. **客戶端 `fetch('/api/...')`（139 處，散落於 59 個檔案）**
   - Next **不會**為 `fetch()` 的字串字面值補 basePath。
   - 解法：新增 `lib/basePath.ts`，匯出 `BASE_PATH`（讀 `NEXT_PUBLIC_BASE_PATH`，預設 `''`）與 `apiFetch(path, init?)` helper。
   - 將所有 root-relative 的 client `fetch('/...')` 改走 `apiFetch('/...')`，並在各檔案加上 import。
   - 僅改 root-relative（以 `/` 開頭）的呼叫；外部 `https://` 的 fetch 不動。

2. **SEO metadata（`app/layout.tsx`）**
   - `alternates.canonical`：`https://2026.taiwandigitalfest.com/` → `https://www.taiwandigitalfest.com/2026/`
   - `alternates.languages.en` / `zh-TW` / `x-default`：同步更新並保留 `?lang=` 查詢參數
   - `openGraph.url`：更新為新網址
   - `metadataBase`：由 `NEXT_PUBLIC_SITE_URL` 推導（見下）

3. **環境變數 `NEXT_PUBLIC_SITE_URL`**
   - `.env.local`、`.env.production.local`、`.env.example` 改為含路徑的形式：
     - prod：`https://www.taiwandigitalfest.com/2026`
     - dev：`http://localhost:3000/2026`
   - 新增 `NEXT_PUBLIC_BASE_PATH=/2026`（三個 env 檔）
   - 連帶使下列以 `NEXT_PUBLIC_SITE_URL` 組字串的位置自然帶上 `/2026`，多數不需個別改：
     - `app/api/checkout/route.ts`（`success_url` / `cancel_url`）
     - `app/api/auth/magic-link/route.ts`、`app/api/auth/verify/route.ts`
     - `components/StructuredData.tsx`
     - `app/sitemap.ts`、`app/robots.ts`（產生的 URL 內容）

4. **`window.location.origin` 拼接的分享連結**
   - `components/member/MemberQrPanel.tsx`、`components/member/CardShareModal.tsx`、`components/member/MemberPassport.tsx`
   - `${origin}/members/...` → `${origin}${BASE_PATH}/members/...`（origin 不含路徑前綴）

5. **顯示文字 / 法務文案**
   - `app/layout.tsx` 的 `<noscript>` 連結文字
   - `components/Footer.tsx`、`components/intro/IntroDeck.tsx` 顯示之網址
   - `data/content.ts`（隱私權政策、服務條款中提及的 `2026.taiwandigitalfest.com`）更新為新網址
   - 不更動：`components/Tdf2027Popup.tsx`（指向 `2027.taiwandigitalfest.com`，與本次無關）、email 聯絡信箱 `registration@taiwandigitalfest.com`（信箱非網址）

6. **`proxy.ts`（middleware）**
   - `CANONICAL_HOST` 常數移除或改為 `www.taiwandigitalfest.com`；但**主機層級的 301 轉址邏輯**在 basePath 下已無法攔截非 `/2026` 路徑，改由 Zeabur 處理（見 §4）。
   - 保留 `/zh`、`/en` → `?lang=` 與 `x-lang` header / cookie 的語言邏輯（這些路徑在 basePath 下會是 `/2026/zh` 等，matcher 自動補前綴後仍可運作）。

### 3.3 robots.txt / sitemap.xml 位置

- basePath 下，Next 會在 `/2026/robots.txt`、`/2026/sitemap.xml` 提供檔案；其內容 URL 因 `NEXT_PUBLIC_SITE_URL` 含 `/2026` 而保持一致。
- 爬蟲於網域根目錄抓取 `www.taiwandigitalfest.com/robots.txt`，需在 Zeabur 層將 `/robots.txt`、`/sitemap.xml` 轉址至 `/2026/...`（Google 會跟隨 robots.txt 轉址）。
- Search Console 提交 sitemap 網址：`https://www.taiwandigitalfest.com/2026/sitemap.xml`。

## 4. Zeabur 基礎設施層（程式完成後設定）

以下無法在程式碼內完成，於 Zeabur 操作（Claude 以 zeabur skill 協助）：

1. 將 `www.taiwandigitalfest.com` 綁定至本服務。
2. 轉址規則：`2026.taiwandigitalfest.com/*` → `https://www.taiwandigitalfest.com/2026/*`（301）。
3. 轉址規則：`www.taiwandigitalfest.com/`（裸根目錄）→ `https://www.taiwandigitalfest.com/2026/`。
4. 轉址規則：`www.taiwandigitalfest.com/robots.txt`、`/sitemap.xml` → `/2026/robots.txt`、`/2026/sitemap.xml`。

## 5. 第三方設定（程式外，需使用者於各平台更新）

非本次程式改動，但遷移後需同步，否則對應功能會中斷。spec 列出供追蹤：

- **Stripe**：webhook endpoint、允許的 redirect 網域（若有白名單）
- **Supabase Auth**：Site URL / Redirect URLs 需含 `/2026`（magic-link 回跳）
- **reCAPTCHA Enterprise**：允許的網域加入 `www.taiwandigitalfest.com`
- **Meta Pixel / Google Tag**：網域驗證（如有）
- **Google Search Console**：新增 `www.taiwandigitalfest.com` 資源並提交新 sitemap

## 6. 測試與驗證

- `npx tsc --noEmit` 通過
- `npm run lint` 通過
- `npm run build` 通過
- 本機 dev（`http://localhost:3000/2026/`）：
  - 公開頁面（`/`, `/award`, `/code-of-conduct` 等對應 `/2026/...`）正常渲染、無 console error
  - 客戶端 `apiFetch` 呼叫命中 `/2026/api/*`（Network 面板確認）
  - 語言切換 `?lang=en` / `/2026/zh` 重導正常
  - 內部 `<Link>` / `router.push` 導覽皆維持 `/2026` 前綴
  - 分享連結（member QR / card share）含 `/2026`
- 受驗證路由（`/me`, `/admin`, `/order/[id]`）：依專案規則，使用 `/api/auth/dev-signin` 或交由使用者於自有 Chrome 驗證（遵守 5 步斷路器）
- 檢視原始碼確認 `<link rel="canonical">`、`og:url`、`hreflang` 皆指向 `www.taiwandigitalfest.com/2026/...`
- E2E（Playwright）：`baseURL` 與測試內路徑需配合 `/2026` 前綴調整

## 7. 範圍邊界（不做）

- 不重構與遷移無關的程式碼
- 不處理 `2027.taiwandigitalfest.com`（TDF 2027 popup）
- 不更動 email 聯絡信箱位址
- 不在本次新增 www 根目錄的年度入口頁（未來工作）

## 8. 風險

- **139 處 fetch 改動量大**：機械式但需逐一加 import 且不可誤改外部 fetch；以建置 + 執行期 Network 驗證涵蓋。
- **主機轉址依賴 Zeabur**：若 Zeabur 不支援所需轉址規則，需備案（例如保留舊子網域服務並以 canonical 指向新址，或加一層轉址服務）。實作前先確認 Zeabur 能力。
- **瀏覽器快取舊 301**：舊子網域既有 301 快取可能干擾驗證，需以無痕模式測試。
