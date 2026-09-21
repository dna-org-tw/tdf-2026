# basePath `/2026` 遷移 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將網站正規網址由 `https://2026.taiwandigitalfest.com/` 遷移至 `https://www.taiwandigitalfest.com/2026/:path`，使用 Next.js `basePath`，並調整所有對應資源位置、SEO metadata、客戶端 fetch 與轉向。

**Architecture:** 在 `next.config.ts` 設 `basePath`（由 `NEXT_PUBLIC_BASE_PATH` 注入），App 自此只服務 `/2026/*`。Next 自動為 `<Link>`/`next/image`/router/redirect/API route/middleware matcher 補前綴；客戶端 `fetch()` 字串、`window.location.origin` 拼接與 SEO metadata 需手動處理。主機層級轉址（舊子網域、www 裸根）移至 Zeabur 基礎設施層。

**Tech Stack:** Next.js 16（App Router、standalone）、React 19、TypeScript 5、Playwright（唯一測試框架，無 unit test runner）。

## Global Constraints

- 互動語言：繁體中文（台灣用語）；程式碼／路徑／識別字維持原文。
- `basePath` 值：`/2026`，一律透過 `process.env.NEXT_PUBLIC_BASE_PATH` 注入，不在程式碼硬編。
- 正規網址（prod）：`https://www.taiwandigitalfest.com/2026`（無結尾斜線存於 env）。
- dev 網址：`http://localhost:3000/2026`。
- 無 unit test 框架：每個任務以 `npx tsc --noEmit`、`npm run lint`、`npm run build` 及執行期（curl / 瀏覽器 Network 面板）驗證；既有 Playwright e2e 需配合 `/2026` 前綴。
- 不更動 `2027.taiwandigitalfest.com`（TDF 2027 popup）與 email 信箱 `registration@taiwandigitalfest.com`。
- 受驗證路由（`/me`, `/admin`, `/order/[id]`）遵守專案規則：用 `/api/auth/dev-signin` 或交付使用者自有 Chrome 驗證，5 步斷路器。
- 遵守 commit 慣例（結尾 Co-Authored-By 行）；頻繁、原子 commit。

---

### Task 1: basePath 設定、env 變數、`apiFetch` helper

**Files:**
- Create: `lib/basePath.ts`
- Modify: `next.config.ts`（檔頭 `const nextConfig: NextConfig = {` 區塊內新增 `basePath`）
- Modify: `.env.local`、`.env.production.local`、`.env.example`

**Interfaces:**
- Produces:
  - `lib/basePath.ts` → `export const BASE_PATH: string`（值為 `process.env.NEXT_PUBLIC_BASE_PATH ?? ''`）
  - `lib/basePath.ts` → `export function apiFetch(input: string, init?: RequestInit): Promise<Response>`（將 root-relative 路徑前綴 `BASE_PATH` 後呼叫 `fetch`）

- [ ] **Step 1: 建立 `lib/basePath.ts`**

```ts
// lib/basePath.ts
// basePath-aware helpers. Next.js does NOT auto-prefix fetch() string
// literals with basePath (only <Link>/next-image/router/redirect get it),
// so all client-side root-relative fetches must go through apiFetch().
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/**
 * fetch() wrapper that prepends BASE_PATH to root-relative request paths.
 * Absolute URLs (http(s)://) and protocol-relative URLs pass through unchanged.
 */
export function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const url = /^https?:\/\//i.test(input) || input.startsWith('//')
    ? input
    : `${BASE_PATH}${input}`;
  return fetch(url, init);
}
```

- [ ] **Step 2: 在 `next.config.ts` 新增 basePath**

在 `const nextConfig: NextConfig = {` 之後、`output: 'standalone',` 附近新增：

```ts
  // 路徑前綴：整站服務於 /2026 之下（由 NEXT_PUBLIC_BASE_PATH 注入）
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
```

- [ ] **Step 3: 更新三個 env 檔**

`.env.local`：將 `NEXT_PUBLIC_SITE_URL` 改為 `http://localhost:3000/2026`，並新增一行 `NEXT_PUBLIC_BASE_PATH=/2026`。

`.env.production.local`：將 `NEXT_PUBLIC_SITE_URL` 改為 `https://www.taiwandigitalfest.com/2026`，並新增 `NEXT_PUBLIC_BASE_PATH=/2026`。

`.env.example`：將 `NEXT_PUBLIC_SITE_URL` 改為 `https://www.taiwandigitalfest.com/2026`，並新增 `NEXT_PUBLIC_BASE_PATH=/2026`。

- [ ] **Step 4: 型別與建置驗證**

Run: `npx tsc --noEmit && npm run lint`
Expected: 無錯誤。

Run: `npm run build`
Expected: 建置成功；輸出的路由顯示於 `/2026` 之下。

- [ ] **Step 5: 執行期驗證（dev）**

啟動 `npm run dev`，另開終端：

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/2026/`
Expected: `200`

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/`
Expected: `404`（裸根目錄不再由 app 服務，符合預期；之後由 Zeabur 轉址）

- [ ] **Step 6: Commit**

```bash
git add lib/basePath.ts next.config.ts .env.example
git commit -m "$(cat <<'EOF'
feat(routing): serve site under /2026 basePath

Add NEXT_PUBLIC_BASE_PATH-driven basePath and an apiFetch() helper
for prefixing client-side root-relative fetches.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

> 註：`.env.local`、`.env.production.local` 為 gitignored，不納入 commit；僅本機/部署環境更新。

---

### Task 2: SEO metadata、StructuredData 與顯示文字

**Files:**
- Modify: `app/layout.tsx`（`metadata` 物件，約 72-90 行；`<noscript>` 約 182 行）
- Modify: `components/StructuredData.tsx:9`
- Modify: `components/Footer.tsx`（顯示之網址）
- Modify: `components/intro/IntroDeck.tsx:544`
- Modify: `data/content.ts`（隱私/條款內文提及之網址：約 943、1080、2412、2543 行）

**Interfaces:**
- Consumes: `process.env.NEXT_PUBLIC_SITE_URL`（= `https://www.taiwandigitalfest.com/2026`，Task 1 設定）

- [ ] **Step 1: 改 `app/layout.tsx` metadata 為相對路徑 + 正確 metadataBase**

Next 的 `metadataBase` 支援 base path：相對路徑會解析到其下（base `…/2026` + `/images/x` → `…/2026/images/x`）。改用相對路徑、移除硬編子網域：

將 72-90 行對應欄位改為：

```ts
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://www.taiwandigitalfest.com/2026'),
  alternates: {
    canonical: '/',
    languages: {
      'en': '/?lang=en',
      'zh-TW': '/?lang=zh',
      'x-default': '/',
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    alternateLocale: ['zh_TW'],
    url: '/',
    siteName: 'Taiwan Digital Fest 2026',
    title: 'Taiwan Digital Fest 2026',
    description: 'Nomad festival in Taitung & Hualien, Taiwan. May 2026.',
    images: [
      {
        url: '/images/tdf2026_cover.webp',
        width: 1200,
        height: 630,
        alt: 'Taiwan Digital Fest 2026 — Nomad Festival in Taitung & Hualien',
      },
    ],
  },
```

（`twitter.images: ['/images/tdf2026_cover.webp']` 維持相對，metadataBase 會補 `/2026`。）

- [ ] **Step 2: 改 `<noscript>` 連結（約 182 行）**

```tsx
            <p>Visit <a href="https://www.taiwandigitalfest.com/2026">www.taiwandigitalfest.com/2026</a> with JavaScript enabled for the full experience.</p>
```

- [ ] **Step 3: 改 `components/StructuredData.tsx:9` 預設值**

```ts
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.taiwandigitalfest.com/2026';
```

- [ ] **Step 4: 改 `Footer.tsx`、`IntroDeck.tsx:544`、`data/content.ts` 顯示文字**

將顯示給使用者的 `2026.taiwandigitalfest.com` 文字（含 `IntroDeck.tsx:544` 的 `taiwandigitalfest.com`）改為 `www.taiwandigitalfest.com/2026`；`data/content.ts` 隱私權政策與服務條款內文中提及網站位址處（約 943、1080、2412、2543 行）一併更新。請逐處確認上下文，僅改網址字面，勿動信箱 `registration@taiwandigitalfest.com`。

- [ ] **Step 5: 建置與渲染驗證**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: 無錯誤。

啟動 dev 後：

Run: `curl -s http://localhost:3000/2026/ | grep -Eo '<link rel="canonical"[^>]*>|property="og:(url|image)"[^>]*content="[^"]*"'`
Expected: canonical 與 og:url 指向 `https://www.taiwandigitalfest.com/2026`，og:image 指向 `https://www.taiwandigitalfest.com/2026/images/tdf2026_cover.webp`。

Run: `curl -s http://localhost:3000/2026/ | grep -Eo 'hreflang="[^"]*" href="[^"]*"'`
Expected: hreflang 連結皆含 `/2026/?lang=...`。

- [ ] **Step 6: Commit**

```bash
git add app/layout.tsx components/StructuredData.tsx components/Footer.tsx components/intro/IntroDeck.tsx data/content.ts
git commit -m "$(cat <<'EOF'
feat(seo): point canonical/hreflang/og to www.taiwandigitalfest.com/2026

Switch metadata to relative paths resolved via /2026 metadataBase and
update display/legal copy to the new canonical URL.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: 清理 `proxy.ts` 主機轉址、保留語言邏輯

**Files:**
- Modify: `proxy.ts`（1-22 行的 `CANONICAL_HOST` 與主機 301 區塊）

**Interfaces:**
- Consumes: 無（middleware matcher 由 Next 自動補 `/2026`）

- [ ] **Step 1: 移除主機層級 301 轉址區塊**

`basePath` 下 middleware 只在 `/2026/*` 執行，無法攔截裸主機路徑，主機轉址改由 Zeabur 處理（見 Task 7）。移除 `CANONICAL_HOST` 常數（第 3 行）與其 301 區塊（第 8-15 行）：

刪除：

```ts
const CANONICAL_HOST = '2026.taiwandigitalfest.com';
```

刪除函式內：

```ts
  const host = request.headers.get('host')?.split(':')[0];

  // 301 redirect non-canonical domains (fest.dna.org.tw, taiwandigitalfest.com, tdf-2026.zeabur.app) to 2026.taiwandigitalfest.com
  if (host && host !== CANONICAL_HOST && host !== 'localhost' && host !== '127.0.0.1') {
    const url = new URL(request.url);
    url.hostname = CANONICAL_HOST;
    url.port = '';
    url.protocol = 'https:';
    return NextResponse.redirect(url, 301);
  }

```

保留其後的 `/zh`、`/en` 與語言 header/cookie 邏輯不動（這些路徑在 basePath 下為 `/2026/zh` 等，matcher 自動補前綴後仍正確）。

- [ ] **Step 2: 型別與建置驗證**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: 無錯誤。

- [ ] **Step 3: 語言重導執行期驗證（dev）**

Run: `curl -s -o /dev/null -w "%{redirect_url}\n" "http://localhost:3000/2026/zh"`
Expected: 重導至含 `?lang=zh` 的 `/2026/` 路徑。

Run: `curl -s -o /dev/null -w "%{redirect_url}\n" "http://localhost:3000/2026/en/award"`
Expected: 重導至 `/2026/award?lang=en`。

- [ ] **Step 4: Commit**

```bash
git add proxy.ts
git commit -m "$(cat <<'EOF'
refactor(proxy): drop host redirect, keep lang logic under basePath

Host-level redirects (old subdomain, www root) move to the Zeabur infra
layer since middleware only runs on /2026/* paths under basePath.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: 遷移客戶端 fetch 至 `apiFetch` — contexts / hooks / sections / 共用 components

**Files（逐檔加入 `import { apiFetch } from '@/lib/basePath';` 並替換 fetch 呼叫）:**
- `contexts/AuthContext.tsx`、`contexts/LumaDataContext.tsx`
- `hooks/useNewsletterCount.ts`
- `components/sections/HeroSection.tsx`、`NewsSection.tsx`、`TeamSection.tsx`、`CommunitySection.tsx`、`TicketsSection.tsx`
- `components/FacebookPixel.tsx`、`components/VisitorTracker.tsx`、`components/FollowModalWithForm.tsx`、`components/ProfileEditModal.tsx`

**Interfaces:**
- Consumes: `apiFetch`（Task 1）

**轉換規則（適用本任務所有檔案）：** 將每個 root-relative 的客戶端呼叫 `fetch('/...')` / `` fetch(`/...`) `` 改為 `apiFetch('/...')` / `` apiFetch(`/...`) ``，第二參數（`init`）原樣保留。**不要**改外部 `https://...` 的 fetch。每檔在既有 import 區塊加入一行 `import { apiFetch } from '@/lib/basePath';`。

- [ ] **Step 1: 逐檔替換**

範例（`contexts/AuthContext.tsx`）：

```ts
// before
const res = await fetch('/api/auth/session');
await fetch('/api/auth/logout', { method: 'POST' });
// after
const res = await apiFetch('/api/auth/session');
await apiFetch('/api/auth/logout', { method: 'POST' });
```

範例（`contexts/LumaDataContext.tsx`）：

```ts
// before
const response = await fetch('/api/luma-data');
// after
const response = await apiFetch('/api/luma-data');
```

對上列每個檔案重複，套用轉換規則。

- [ ] **Step 2: 驗證本任務檔案已無裸 fetch**

Run:
```bash
grep -rnE "[^a-zA-Z]fetch\(['\"\`]/" contexts/ hooks/ components/sections/ components/FacebookPixel.tsx components/VisitorTracker.tsx components/FollowModalWithForm.tsx components/ProfileEditModal.tsx
```
Expected: 無輸出（所有 root-relative fetch 皆已改為 apiFetch）。

- [ ] **Step 3: 型別與建置**

Run: `npx tsc --noEmit && npm run lint`
Expected: 無錯誤。

- [ ] **Step 4: Commit**

```bash
git add contexts/ hooks/ components/sections/ components/FacebookPixel.tsx components/VisitorTracker.tsx components/FollowModalWithForm.tsx components/ProfileEditModal.tsx
git commit -m "$(cat <<'EOF'
fix(routing): route contexts/sections fetches through apiFetch for basePath

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: 遷移客戶端 fetch — `components/member`、`award`、`auth`、`stay`、`upgrade`、`admin`，並修正分享連結 origin 拼接

**Files（apiFetch 替換，規則同 Task 4）:**
- `components/member/`：`CardShareModal.tsx`、`CollectButton.tsx`、`EmailChangeForm.tsx`、`EmailPreferences.tsx`、`MemberPassport.tsx`、`MemberQrPanel.tsx`、`PaymentMethodModal.tsx`、`ProfileEditor.tsx`、`UpgradeBanner.tsx`、`VisaSupportSection.tsx`
- `components/award/VoteEmailModal.tsx`
- `components/auth/LoginForm.tsx`
- `components/stay/StayBookingPanel.tsx`、`StayPageContent.tsx`
- `components/upgrade/UpgradePageContent.tsx`
- `components/admin/LumaCookieStatus.tsx`

**額外修正（origin 拼接，需補 `BASE_PATH`）:**
- `components/member/MemberQrPanel.tsx:65`
- `components/member/MemberPassport.tsx:550`
- `components/member/CardShareModal.tsx:94`

**Interfaces:**
- Consumes: `apiFetch`、`BASE_PATH`（Task 1）

- [ ] **Step 1: apiFetch 替換**

對上列每檔加入 `import { apiFetch } from '@/lib/basePath';` 並套用 Task 4 的轉換規則。

- [ ] **Step 2: 修正 `window.location.origin` 分享連結**

`origin` 不含路徑，分享連結需補 `BASE_PATH`。於三個檔案加入（或共用既有）`import { BASE_PATH } from '@/lib/basePath';` 並修改：

`MemberQrPanel.tsx`（約 64-65 行）：
```ts
// before
const origin = typeof window !== 'undefined' ? window.location.origin : '';
return `${origin}/members/${memberNo}?t=${token}`;
// after
const origin = typeof window !== 'undefined' ? window.location.origin : '';
return `${origin}${BASE_PATH}/members/${memberNo}?t=${token}`;
```

`CardShareModal.tsx`（約 93-94 行）：
```ts
// before
const origin = typeof window !== 'undefined' ? window.location.origin : '';
return `${origin}/members/${memberNo}?t=${token}`;
// after
const origin = typeof window !== 'undefined' ? window.location.origin : '';
return `${origin}${BASE_PATH}/members/${memberNo}?t=${token}`;
```

`MemberPassport.tsx`（約 550 行）：
```ts
// before
? `${typeof window !== 'undefined' ? window.location.origin : ''}/members/${memberNo}?t=${token}`
// after
? `${typeof window !== 'undefined' ? window.location.origin : ''}${BASE_PATH}/members/${memberNo}?t=${token}`
```

- [ ] **Step 3: 驗證本任務檔案已無裸 fetch**

Run:
```bash
grep -rnE "[^a-zA-Z]fetch\(['\"\`]/" components/member components/award components/auth components/stay components/upgrade components/admin
```
Expected: 無輸出。

- [ ] **Step 4: 型別與建置**

Run: `npx tsc --noEmit && npm run lint`
Expected: 無錯誤。

- [ ] **Step 5: Commit**

```bash
git add components/member components/award components/auth components/stay components/upgrade components/admin
git commit -m "$(cat <<'EOF'
fix(routing): apiFetch + basePath-aware share links for member/award/stay

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: 遷移客戶端 fetch — `app/` 頁面（admin / me / members / award / order / newsletter）

**Files（apiFetch 替換，規則同 Task 4）:**
- `app/admin/`：`auditing/page.tsx`、`discounts/page.tsx`、`history/[id]/page.tsx`、`history/page.tsx`、`impact/page.tsx`、`layout.tsx`、`luma-events/page.tsx`、`luma-sync/page.tsx`、`members/[memberNo]/page.tsx`、`members/page.tsx`、`no-shows/page.tsx`、`orders/[id]/page.tsx`、`orders/new/page.tsx`、`orders/page.tsx`、`page.tsx`、`participation/page.tsx`、`reconcile/page.tsx`、`send/page.tsx`、`settings/page.tsx`、`stay/bookings/[id]/page.tsx`、`stay/bookings/page.tsx`、`stay/invite-codes/page.tsx`、`stay/page.tsx`、`stay/weeks/page.tsx`、`subscribers/page.tsx`
- `app/me/page.tsx`、`app/me/collections/page.tsx`
- `app/members/page.tsx`
- `app/award/page.tsx`
- `app/order/[id]/page.tsx`
- `app/newsletter/unsubscribe/page.tsx`

**Interfaces:**
- Consumes: `apiFetch`（Task 1）

- [ ] **Step 1: 逐檔加入 import 並替換**

對上列每檔加入 `import { apiFetch } from '@/lib/basePath';` 並套用 Task 4 轉換規則。範例（`app/award/page.tsx`）：

```ts
// before
const response = await fetch('/api/award/posts');
const response = await fetch('/api/award/vote', { method: 'POST', ... });
// after
const response = await apiFetch('/api/award/posts');
const response = await apiFetch('/api/award/vote', { method: 'POST', ... });
```

- [ ] **Step 2: 全專案驗證已無遺漏的客戶端裸 fetch**

Run:
```bash
grep -rnE "[^a-zA-Z]fetch\(['\"\`]/" app components contexts hooks | grep -v "/api/auth/dev-signin"
```
Expected: 無輸出（全部 root-relative 客戶端 fetch 已改 apiFetch）。

> 註：server route handler（`app/api/**`）內若有 `fetch` 多為外部絕對 URL，不在此列；如出現 root-relative server fetch 需個別評估（server 端本就不該用相對 fetch）。

- [ ] **Step 3: 型別與建置**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: 無錯誤。

- [ ] **Step 4: 執行期 Network 驗證（公開頁）**

啟動 dev，於瀏覽器開 `http://localhost:3000/2026/award`，開 DevTools Network：
Expected: award 相關 XHR 皆打到 `/2026/api/award/*`（非 `/api/award/*`），回應 200。

- [ ] **Step 5: Commit**

```bash
git add app/admin app/me app/members app/award app/order app/newsletter
git commit -m "$(cat <<'EOF'
fix(routing): route app-page fetches through apiFetch for basePath

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6b: 非 fetch 的 basePath 缺口修補（執行期發現，計畫補追加）

**背景：** 原計畫聚焦 `fetch()` 與 origin 分享連結，遺漏了 Next 在 basePath 下**不會**自動補前綴的其他 root-relative 參照。執行 Task 6 時掃出下列缺口，必須在分支完成前修正。

**Files:**
- 純 `<a>` 錨點補 `BASE_PATH`（Next 不會為原生 `<a>`/`<form>` 補前綴）：
  - `app/admin/stay/page.tsx`（兩個 `<a href={`/api/admin/stay/weeks/${w.id}/export(-pdf)`}>` 下載連結）
  - `app/admin/orders/page.tsx`（`<a href="/admin/orders/new">`）
  - `app/admin/orders/new/page.tsx`（`<a href="/admin/orders">`）
  - `app/admin/orders/[id]/page.tsx`（`<a href="/admin/orders">`）
  - `components/sections/TicketsSection.tsx`（`<a href="/terms">`、`<a href="/privacy">`）
- 伺服端 route handler 重導補 `BASE_PATH`（route handler 重導不會自動補前綴）：
  - `app/api/award/confirm-vote/route.ts`（9 處 `new URL(`/award/confirm?...`, req.url)`）
- 過時網域字串／fallback 預設值更新為 `https://www.taiwandigitalfest.com/2026`：
  - `app/robots.ts:4`、`app/sitemap.ts:4`（`||` fallback 預設）
  - `lib/stayInviteEmail.ts:3`（`SITE_URL` fallback 預設）
  - `app/api/checkout/route.ts:137`（Terms 連結）
  - `lib/visaLetter.tsx:103,163`（Website 顯示文字）
  - `app/terms/layout.tsx:8`（description 文字）

**Interfaces:**
- Consumes: `BASE_PATH`（Task 1）— client 與 server 皆可讀（`NEXT_PUBLIC_*` 於建置期內聯）。

**不需更動（執行期已正確）：** `app/api/auth/verify/route.ts`、`app/api/auth/magic-link/route.ts`、`lib/unsubscribeEmail.ts`、`app/api/checkout/route.ts` 的 `${baseUrl}/...`（`baseUrl=NEXT_PUBLIC_SITE_URL` 已含 `/2026`）；所有 `<Link href>`（Next 自動補前綴）。

- [ ] **Step 1: 純 `<a>` 錨點補 BASE_PATH**

對上列 `<a>` 檔案，於既有 `@/lib/basePath` import 併入 `BASE_PATH`，並把 root-relative href 改為樣板字串前綴 `${BASE_PATH}`。範例：

```tsx
// TicketsSection.tsx — before
<a href="/terms" ...>
// after
<a href={`${BASE_PATH}/terms`} ...>

// admin/stay/page.tsx — before
href={`/api/admin/stay/weeks/${w.id}/export`}
// after
href={`${BASE_PATH}/api/admin/stay/weeks/${w.id}/export`}
```

保留 `<a>`（下載／既有全頁載入行為），不改成 `<Link>`。

- [ ] **Step 2: confirm-vote 伺服端重導補 BASE_PATH**

`app/api/award/confirm-vote/route.ts` 加入 `import { BASE_PATH } from '@/lib/basePath';`，把 9 處 `new URL(`/award/confirm?...`, req.url)` 改為 `new URL(`${BASE_PATH}/award/confirm?...`, req.url)`。第 66 行 `new URL(req.url)`（僅解析 searchParams）不動。

- [ ] **Step 3: 過時網域字串更新**

將上列檔案中的 `https://2026.taiwandigitalfest.com` 改為 `https://www.taiwandigitalfest.com/2026`；`terms/layout.tsx` 顯示文字 `2026.taiwandigitalfest.com` 改為 `www.taiwandigitalfest.com/2026`。勿動 email 信箱與 2027 連結。

- [ ] **Step 4: 驗證**

```bash
# 不應再有純 <a> 指向未前綴的 root-relative（人工確認剩餘者皆為 ${BASE_PATH} 或外部）
grep -rnE "<a [^>]*href=[\"\`']/" app components | grep -vE "BASE_PATH|https?:|//|mailto:|/#"
grep -rnE "href=\{\`/(api|[a-z])" app components | grep -v BASE_PATH   # template-literal a href 未前綴者
grep -rn "2026\.taiwandigitalfest\.com" app components lib data | grep -vE "registration@|2027\."   # 應為空
grep -nE "new URL\(\`/award/confirm" app/api/award/confirm-vote/route.ts   # 應為空（皆已前綴）
```
Expected: 前兩個 grep 無未前綴殘留；第三個（過時網域）為空；第四個為空。

Run: `npx tsc --noEmit` 與 `npx eslint <changed files>` → 無錯誤；`npm run build` → 成功（controller 於 sandbox 外執行）。

- [ ] **Step 5: Commit**

```bash
git add app components lib
git commit -m "$(cat <<'EOF'
fix(routing): basePath-prefix plain anchors, server redirects, stale domains

Plain <a>/<form> and route-handler redirects are not auto-prefixed under
basePath; prefix them with BASE_PATH. Update remaining hardcoded
2026.taiwandigitalfest.com URLs to www.taiwandigitalfest.com/2026.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Playwright e2e 路徑調整、全站驗證、Zeabur 與第三方交付文件

**Files:**
- Modify: `tests/e2e/auth.setup.ts`（`page.goto` 路徑）
- Modify: `tests/e2e/tickets-cutoff.spec.ts`（`page.goto` 路徑）
- Modify: `playwright.config.ts`（如需，`BASE_URL`）
- Create: `docs/superpowers/plans/2026-06-18-basepath-2026-deploy-checklist.md`

**Interfaces:**
- Consumes: 完整遷移後的 app

- [ ] **Step 1: 調整 e2e goto 路徑加上 `/2026`**

`auth.setup.ts` 與 `tickets-cutoff.spec.ts` 內所有 `page.goto('/...')` 改為 `page.goto('/2026/...')`。範例：

```ts
// before
await page.goto('/?lang=en#tickets');
// after
await page.goto('/2026/?lang=en#tickets');
```

`auth.setup.ts` 若以 `POST /api/auth/dev-signin` 呼叫，需改為 `/2026/api/auth/dev-signin`（dev-signin route 在 basePath 下亦位於 `/2026/api`）。逐處確認。

- [ ] **Step 2: 跑 e2e（需 `.env.local` 設 `DEV_SIGNIN_SECRET`）**

Run: `npm run e2e`
Expected: 既有測試通過（auth.setup 登入成功、tickets-cutoff 斷言通過）。

> 若本機未設 `DEV_SIGNIN_SECRET`，記錄此前置條件並交付使用者於自有環境執行（遵守受驗證路由規則）。

- [ ] **Step 3: 全站最終驗證**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: 全部通過。

啟動 dev，於無痕視窗驗證（避免舊 301 快取）：
- `http://localhost:3000/2026/`：首頁渲染、無 console error
- `http://localhost:3000/2026/award`、`/2026/code-of-conduct`：渲染正常
- 切換語言 `?lang=en`、`/2026/zh`：重導正確
- 內部 `<Link>` 導覽維持 `/2026` 前綴
- 受驗證路由（`/2026/me`, `/2026/admin`）：用 dev-signin 或交付使用者 Chrome 驗證

- [ ] **Step 4: 撰寫 Zeabur + 第三方交付清單**

建立 `docs/superpowers/plans/2026-06-18-basepath-2026-deploy-checklist.md`，內容含：

```markdown
# 部署交付清單：/2026 basePath 遷移

## Zeabur 基礎設施（Claude 以 zeabur skill 協助）
1. 綁定 www.taiwandigitalfest.com 至本服務。
2. 301：2026.taiwandigitalfest.com/* → https://www.taiwandigitalfest.com/2026/*
3. 轉址：www.taiwandigitalfest.com/ → /2026/
4. 轉址：/robots.txt、/sitemap.xml → /2026/robots.txt、/2026/sitemap.xml
5. 部署環境變數：NEXT_PUBLIC_BASE_PATH=/2026、NEXT_PUBLIC_SITE_URL=https://www.taiwandigitalfest.com/2026

## 第三方設定（使用者於各平台）
- Stripe：success/cancel 已自動帶 /2026；確認 webhook endpoint 網域、redirect 白名單。
- Supabase Auth：Site URL / Redirect URLs 加入 https://www.taiwandigitalfest.com/2026 路徑。
- reCAPTCHA Enterprise：網域加入 www.taiwandigitalfest.com。
- Google Search Console：新增 www 資源，提交 https://www.taiwandigitalfest.com/2026/sitemap.xml。
- Meta Pixel / Google Tag：確認網域驗證。

## 驗證（部署後，無痕）
- https://www.taiwandigitalfest.com/2026/ 回 200
- 舊子網域 301 至新址
- canonical / hreflang / og 指向新址
```

- [ ] **Step 5: Commit**

```bash
git add tests/e2e playwright.config.ts docs/superpowers/plans/2026-06-18-basepath-2026-deploy-checklist.md
git commit -m "$(cat <<'EOF'
test(e2e): prefix paths with /2026 and add deploy checklist

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- §3.1 自動處理 → 無需任務，於 Task 1/3 建置與執行期驗證涵蓋 ✅
- §3.2(1) 139 fetch → Task 4/5/6（涵蓋全部 59 檔），Task 6 Step 2 全站 grep 驗證零遺漏 ✅
- §3.2(2) SEO metadata → Task 2 ✅
- §3.2(3) NEXT_PUBLIC_SITE_URL/BASE_PATH → Task 1 ✅
- §3.2(4) origin 分享連結 → Task 5 Step 2 ✅
- §3.2(5) 顯示/法務文案 → Task 2 Step 4 ✅
- §3.2(6) proxy.ts → Task 3 ✅
- §3.3 robots/sitemap 位置 → 內容由 env 自動帶 /2026（Task 1/2）；root 轉址於 Task 7 交付清單 ✅
- §4 Zeabur 基礎設施 → Task 7 Step 4 交付清單 ✅
- §5 第三方 → Task 7 Step 4 交付清單 ✅
- §6 測試驗證 → 各任務驗證步驟 + Task 7 ✅

**Placeholder scan:** 無 TBD/TODO；fetch 遷移以明確轉換規則 + 範例 + grep 驗證表達（mechanical codemod，非占位符）。

**Type consistency:** `BASE_PATH`、`apiFetch(input, init?)` 於 Task 1 定義，Task 4/5/6 一致使用；env 名稱 `NEXT_PUBLIC_BASE_PATH`、`NEXT_PUBLIC_SITE_URL` 全程一致。
