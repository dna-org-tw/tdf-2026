# 部署交付清單：/2026 basePath 遷移

**日期：** 2026-06-18
**分支：** feat/basepath-2026-migration

---

## Zeabur 基礎設施（Claude 以 zeabur skill 協助）

1. **綁定主網域**：將 `www.taiwandigitalfest.com` 綁定至本服務。
2. **301 舊子網域**：設定 `2026.taiwandigitalfest.com/*` → `https://www.taiwandigitalfest.com/2026/$1`（永久重導）。
3. **根路徑轉址**：`www.taiwandigitalfest.com/` → `/2026/`（避免裸根顯示 404）。
4. **SEO 輔助路徑轉址**：
   - `/robots.txt` → `/2026/robots.txt`
   - `/sitemap.xml` → `/2026/sitemap.xml`
5. **部署環境變數**（於 Zeabur 服務設定）：
   - `NEXT_PUBLIC_BASE_PATH=/2026`
   - `NEXT_PUBLIC_SITE_URL=https://www.taiwandigitalfest.com/2026`

---

## 第三方設定（使用者於各平台手動操作）

### Stripe
- Checkout success / cancel URL 已自動帶 `/2026`（由 `apiFetch` 組成，無需手動改）。
- 確認 Stripe Dashboard → Webhooks → Endpoint URL 仍使用正確網域。
- 確認 OAuth / Customer Portal redirect 白名單包含 `https://www.taiwandigitalfest.com/2026`。

### Supabase Auth
- Site URL 更新：`https://www.taiwandigitalfest.com/2026`
- Redirect URLs 加入：
  - `https://www.taiwandigitalfest.com/2026/**`
  - `https://www.taiwandigitalfest.com/2026/api/auth/callback`
- 移除舊子網域 `2026.taiwandigitalfest.com` 的條目（或留作轉址過渡期備援）。

### reCAPTCHA Enterprise
- 於 Google Cloud Console → reCAPTCHA Enterprise → 金鑰設定中，新增允許網域：
  - `www.taiwandigitalfest.com`

### Google Search Console
- 新增資源：`https://www.taiwandigitalfest.com`（網域資源）或前綴型 `https://www.taiwandigitalfest.com/2026/`。
- 提交新 Sitemap：`https://www.taiwandigitalfest.com/2026/sitemap.xml`
- 舊子網域資源（若存在）：標記為已棄用，或保留觀察 301 流量轉移。

### Meta Pixel / Google Tag Manager
- 確認網域驗證設定更新至 `www.taiwandigitalfest.com`。
- 若有事件路徑過濾規則，確認涵蓋 `/2026/` 前綴的頁面。

---

## 驗證（部署後，使用無痕視窗）

- [ ] `https://www.taiwandigitalfest.com/2026/` → HTTP 200，首頁正常渲染，無 console error。
- [ ] `https://2026.taiwandigitalfest.com/` → HTTP 301 重導至 `https://www.taiwandigitalfest.com/2026/`。
- [ ] `https://www.taiwandigitalfest.com/` → 重導至 `/2026/`（或 301）。
- [ ] `<link rel="canonical">` 指向 `https://www.taiwandigitalfest.com/2026/`。
- [ ] `<link rel="alternate" hreflang="zh-TW">` 及 `hreflang="en"` 指向新址。
- [ ] `<meta property="og:url">` 指向 `https://www.taiwandigitalfest.com/2026/`。
- [ ] `https://www.taiwandigitalfest.com/robots.txt` → 重導至 `/2026/robots.txt`，內容正確。
- [ ] `https://www.taiwandigitalfest.com/sitemap.xml` → 重導至 `/2026/sitemap.xml`，內容正確。
- [ ] 受驗證路由 `/2026/me`、`/2026/admin`：以已登入帳號（`kk@dna.org.tw`）確認正常載入。
- [ ] Stripe Checkout：走完購票流程，success URL 回到 `/2026/order/...`。
