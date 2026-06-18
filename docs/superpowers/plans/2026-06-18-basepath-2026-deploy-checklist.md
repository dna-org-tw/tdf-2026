# 部署交付清單：/2026 basePath 遷移（封存站）

**日期：** 2026-06-18
**架構決策：** `/2026` 為 2026 封存站；`www.taiwandigitalfest.com` 根目錄留給既有的 2027 repo。

---

## 實際拓撲（Zeabur「TDF」專案）

| 服務 | 角色 | 綁定網域 / origin |
|------|------|------------------|
| `www-proxy` | 對外反向代理 | `www.taiwandigitalfest.com` |
| `tdf-2026`（本 repo） | 2026 封存站，basePath `/2026` | `2026.taiwandigitalfest.com`、`tdf-2026.zeabur.app` |
| `tdf-2027` | 當前活動，服務於根目錄 | `tdf-2027-origin.zeabur.app` |

www-proxy 應路由：
- `www.taiwandigitalfest.com/2026/*` → **tdf-2026**（**保留 `/2026` 前綴**，不可剝除）
- `www.taiwandigitalfest.com/*`（其餘含根目錄） → **tdf-2027**

---

## Zeabur 基礎設施

1. **⚠️ 關鍵：www-proxy 必須「保留」`/2026` 前綴** — 目前 proxy 會把 `/2026/award` 剝成 `/award` 再轉給 tdf-2026，與 basePath 不相容（會 404）。需改為原樣轉送 `/2026/award` → tdf-2026。**（使用者處理中）**
2. **tdf-2026 環境變數**（build-time，需 redeploy 生效）：
   - `NEXT_PUBLIC_BASE_PATH=/2026` ✅ 已設定
   - `NEXT_PUBLIC_SITE_URL=https://www.taiwandigitalfest.com/2026` ✅ 已設定（原為過時的 `https://fest.dna.org.tw`）
3. **redeploy tdf-2026** — 在 proxy 改為保留前綴後執行；redeploy 才會把上述 build-time 變數編入。**（待 proxy 確認後，Claude 執行）**
4. **舊子網域 `2026.taiwandigitalfest.com`** — basePath 上線後，此子網域直連 tdf-2026 的根目錄會 404。改為 **301 → `https://www.taiwandigitalfest.com/2026/`**（保留 SEO 權重、避免重複內容）。proxy 以內部 service host（`TDF_2026_HOST`）連 tdf-2026，故此公開子網域可安全改為轉址。
5. **robots / sitemap** — `/2026/robots.txt`、`/2026/sitemap.xml` 由 tdf-2026 在 basePath 下直接提供，內容已含 `/2026`。**不要**把 `www.../robots.txt` 轉到 `/2026/...`（根目錄 robots 屬 2027）。Search Console 直接提交 `https://www.taiwandigitalfest.com/2026/sitemap.xml`。

---

## 第三方設定（使用者於各平台手動操作）

### Supabase Auth（最高優先 — 漏設會讓 magic-link 登入靜默失效）
- Site URL：`https://www.taiwandigitalfest.com/2026`
- Redirect URLs 加入：
  - `https://www.taiwandigitalfest.com/2026/**`
  - `https://www.taiwandigitalfest.com/2026/auth/callback`
- 舊 `2026.taiwandigitalfest.com` 條目可於轉址過渡期後移除。

### Stripe
- Checkout success / cancel URL 由 `NEXT_PUBLIC_SITE_URL` 組成，redeploy 後自動帶 `/2026`。
- 確認 Webhooks → Endpoint URL 使用可達網域（建議 `https://www.taiwandigitalfest.com/2026/api/webhooks/...` 或內部 origin）。

### reCAPTCHA Enterprise
- 金鑰允許網域新增：`www.taiwandigitalfest.com`。

### Google Search Console
- 提交封存站 Sitemap：`https://www.taiwandigitalfest.com/2026/sitemap.xml`。
- 舊子網域資源保留觀察 301 流量轉移。

### Meta Pixel / Google Tag Manager
- 網域驗證更新至 `www.taiwandigitalfest.com`；事件路徑過濾規則涵蓋 `/2026/` 前綴。

---

## 驗證（cutover 後，使用無痕視窗）

- [ ] `https://www.taiwandigitalfest.com/2026/` → HTTP 200，首頁正常渲染，無 console error。
- [ ] `https://www.taiwandigitalfest.com/2026/award` → 200（深層路徑經 proxy 保留前綴正確命中）。
- [ ] `https://www.taiwandigitalfest.com/2026/_next/...` 靜態資源 → 200（資源前綴正確）。
- [ ] `<link rel="canonical">` 指向 `https://www.taiwandigitalfest.com/2026/`；hreflang / og:url 同步。
- [ ] `https://2026.taiwandigitalfest.com/` → 301 → `https://www.taiwandigitalfest.com/2026/`。
- [ ] `https://www.taiwandigitalfest.com/` → 仍由 2027 服務（不可被導去 2026）。
- [ ] `https://www.taiwandigitalfest.com/2026/manifest.webmanifest` → `start_url` 與 icons 皆含 `/2026`。
- [ ] `https://www.taiwandigitalfest.com/2026/robots.txt` → `Disallow: /2026/api/`、`Disallow: /2026/_next/`。
- [ ] 受驗證路由 `/2026/me`、`/2026/admin`：以 `kk@dna.org.tw` 登入確認正常。
- [ ] Stripe Checkout：走完購票流程，success URL 回到 `/2026/...`。
