# 住宿每週訂房名單匯出 — 實作計畫

> **給 agent 執行者：** 必須使用 superpowers:subagent-driven-development（推薦）或 superpowers:executing-plans 逐 task 執行本計畫。步驟使用 `- [ ]` checkbox 追蹤。

**目標：** 在 `/admin/stay` 的每個週次列上加一顆「匯出名單」按鈕，下載該週已確認訂房的 CSV 給住宿業者。

**架構：** 新增 `GET /api/admin/stay/weeks/[id]/export` 路由，回傳 UTF-8 CSV（BOM + CRLF），僅含 `confirmed / modified_in / pending_transfer` 狀態的訂房。UI 在總覽表格每列加一個原生 `<a download>` 下載按鈕。共用的 `csvEscape` 工具函式抽到 `lib/csv.ts`（採用 `members/export` 目前較安全的版本，擋 CSV formula injection），新路由與三個既有 CSV 匯出都從這裡 import。

**技術棧：** Next.js 16 App Router、TypeScript、Supabase server client、ESLint。

**Spec：** `docs/superpowers/specs/2026-04-23-stay-weekly-booking-export-design.md`

**測試說明：** 本 repo 沒有 unit test 框架（只有 Playwright E2E，且依 CLAUDE.md 規定 admin 路由必須在使用者自己的 Chrome 驗證）。每個 task 以 `npm run lint` + `tsc --noEmit` 收尾，再加一個手動驗證步驟。

---

## 檔案結構

- **新增** `lib/csv.ts` — 共用 `csvEscape(value: unknown): string`
- **修改** `app/api/admin/orders/export/route.ts` — 從 `lib/csv` import
- **修改** `app/api/admin/members/export/route.ts` — 從 `lib/csv` import
- **修改** `app/api/admin/subscribers/export/route.ts` — 從 `lib/csv` import
- **新增** `app/api/admin/stay/weeks/[id]/export/route.ts` — 新的匯出 endpoint
- **修改** `app/admin/stay/page.tsx` — 新增「操作」欄位與每列下載按鈕

---

## Task 1：把 `csvEscape` 抽到 `lib/csv.ts` 並遷移既有呼叫端

**檔案：**
- 新增：`lib/csv.ts`
- 修改：`app/api/admin/orders/export/route.ts`
- 修改：`app/api/admin/members/export/route.ts`
- 修改：`app/api/admin/subscribers/export/route.ts`

**為什麼要加 formula injection 防護：** `members/export` 目前已會替開頭為 `= + - @ \t` 的字串加引號，避免 CSV 被 Excel 當成公式執行（ex: 惡意 payment 備註 `=cmd|...` ）。`orders/export` 跟 `subscribers/export` 還沒加。統一走較安全版本，等於順手把這兩支也加固，零成本。

- [ ] **Step 1：新增 `lib/csv.ts`**

```ts
// lib/csv.ts

/**
 * Escape a value for CSV output per RFC 4180, additionally quoting any
 * string that starts with =, +, -, @, or tab to prevent CSV formula
 * injection when the file is opened in Excel/Sheets.
 */
export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str) || /^[=+\-@\t]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
```

- [ ] **Step 2：改 `app/api/admin/orders/export/route.ts` 走 import**

在檔案 imports 區塊加上：
```ts
import { csvEscape } from '@/lib/csv';
```

刪掉檔案內原本的 `function csvEscape(value: unknown): string { ... }` 整塊（8 行左右，緊接在 `OrderRow` interface 後面）。`formatAmount` 保留不動，那是這支路由獨有的。

- [ ] **Step 3：改 `app/api/admin/members/export/route.ts` 走 import**

相同 pattern。加 import：
```ts
import { csvEscape } from '@/lib/csv';
```

刪掉原本帶 formula-injection 註解的 local `csvEscape` 定義。

- [ ] **Step 4：改 `app/api/admin/subscribers/export/route.ts` 走 import**

相同 pattern。加 import、刪掉 local 定義。

- [ ] **Step 5：Lint + typecheck**

執行：`npm run lint && npx tsc --noEmit`
預期：兩者都通過，沒有新錯誤。

- [ ] **Step 6：手動煙霧測試 — 確認 orders 匯出還正常**

啟動 dev server：`npm run dev`
請使用者在自己 Chrome（已登入 admin，依 CLAUDE.md 規定）開 `/admin/orders`，點既有的「匯出 CSV」連結，確認 Excel 打開沒有亂碼、欄位跟之前一樣。`/admin/members/export`、`/admin/subscribers/export` 若同一個 admin 登入流程可一併驗證。

（依 CLAUDE.md 的「5 步驟斷路器」：如果開 server + 驗證 3 個路由會超過預算，lint/tsc 通過後直接 commit 並把驗證交接給使用者。）

- [ ] **Step 7：Commit**

```bash
git add lib/csv.ts app/api/admin/orders/export/route.ts app/api/admin/members/export/route.ts app/api/admin/subscribers/export/route.ts
git commit -m "refactor(csv): extract csvEscape to lib/csv with formula-injection guard"
```

---

## Task 2：新增每週訂房名單匯出 API 路由

**檔案：**
- 新增：`app/api/admin/stay/weeks/[id]/export/route.ts`

- [ ] **Step 1：寫路由**

```ts
// app/api/admin/stay/weeks/[id]/export/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';
import { csvEscape } from '@/lib/csv';

interface BookingRow {
  id: string;
  booking_type: 'guaranteed' | 'complimentary';
  primary_guest_name: string;
  primary_guest_email: string;
  primary_guest_phone: string;
  internal_notes: string | null;
  created_at: string;
}

interface BookingWeekRow {
  status: string;
  stay_bookings: BookingRow | null;
}

const ACTIVE_STATUSES = ['confirmed', 'modified_in', 'pending_transfer'];

const BOOKING_TYPE_LABEL: Record<string, string> = {
  guaranteed: '保證訂房',
  complimentary: '免費招待',
};

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'db' }, { status: 500 });

  const { id: idParam } = await ctx.params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { data: week, error: weekErr } = await supabaseServer
    .from('stay_weeks')
    .select('id, code, starts_on, ends_on')
    .eq('id', id)
    .maybeSingle();
  if (weekErr) return NextResponse.json({ error: weekErr.message }, { status: 500 });
  if (!week) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data: bookingWeeks, error: bwErr } = await supabaseServer
    .from('stay_booking_weeks')
    .select(`
      status,
      stay_bookings (
        id,
        booking_type,
        primary_guest_name,
        primary_guest_email,
        primary_guest_phone,
        internal_notes,
        created_at
      )
    `)
    .eq('week_id', id)
    .in('status', ACTIVE_STATUSES);
  if (bwErr) return NextResponse.json({ error: bwErr.message }, { status: 500 });

  const rows = ((bookingWeeks ?? []) as unknown as BookingWeekRow[])
    .map((bw) => bw.stay_bookings)
    .filter((b): b is BookingRow => b !== null)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const header = [
    '入住日',
    '退房日',
    '訂房編號',
    '類型',
    '主住客姓名',
    '電話',
    'Email',
    '備註',
  ];
  const lines = [header.map(csvEscape).join(',')];
  for (const r of rows) {
    lines.push([
      csvEscape(week.starts_on),
      csvEscape(week.ends_on),
      csvEscape(r.id.slice(0, 8)),
      csvEscape(BOOKING_TYPE_LABEL[r.booking_type] ?? r.booking_type),
      csvEscape(r.primary_guest_name),
      csvEscape(r.primary_guest_phone),
      csvEscape(r.primary_guest_email),
      csvEscape(r.internal_notes),
    ].join(','));
  }
  const csv = '\uFEFF' + lines.join('\r\n');

  const ts = new Date().toISOString().slice(0, 10);
  const filename = `stay-${week.code}-${ts}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
```

**為什麼 Supabase 查詢結果要 `as unknown as` cast：** Supabase 的型別推論在 nested relation 會把 `stay_bookings` 推成 array，但實際資料是單一物件（或 null）。這個 cast 只是對齊 runtime 形狀。之後若要更乾淨可改用 Supabase CLI 產生的型別，不在本計畫範圍。

- [ ] **Step 2：Lint + typecheck**

執行：`npm run lint && npx tsc --noEmit`
預期：通過。

- [ ] **Step 3：手動驗證 — cURL 打 dev server**

`npm run dev` 啟動。從使用者瀏覽器 DevTools → Application → Cookies 複製 admin session cookie（cookie 名稱看其他 `/api/admin/*` request header）。從 `/admin/stay` 挑一個 week id。

```bash
curl -i "http://localhost:3100/api/admin/stay/weeks/1/export" \
  -H "Cookie: <貼上 admin session cookie>" \
  -o /tmp/stay-export-test.csv
```

確認：
- HTTP 200
- `Content-Type: text/csv; charset=utf-8`
- `Content-Disposition: attachment; filename="stay-<code>-YYYY-MM-DD.csv"`
- Excel 打開沒有亂碼
- 表頭有 8 欄中文
- 資料列只含 `confirmed / modified_in / pending_transfer`
- 無效 id 回 404：`curl -i ".../weeks/abc/export"` 和 `.../weeks/999999/export`
- 沒帶 cookie 回 401

依 CLAUDE.md「不得插入 Supabase auth token」規定：必須用真正 admin 登入後取得的 cookie，不能偽造 token。

- [ ] **Step 4：Commit**

```bash
git add app/api/admin/stay/weeks/\[id\]/export/route.ts
git commit -m "feat(admin/stay): add per-week booking list CSV export"
```

---

## Task 3：在 `/admin/stay` 總覽頁加「匯出名單」按鈕

**檔案：**
- 修改：`app/admin/stay/page.tsx`

- [ ] **Step 1：加欄位 header**

在 `app/admin/stay/page.tsx` 找到 `<thead>` 區塊（約 82–92 行），在「狀態」`<th>` 後面加一欄：

```tsx
<th className="py-2 px-3 text-left">狀態</th>
<th className="py-2 px-3 text-right">操作</th>
```

- [ ] **Step 2：加按鈕 cell**

在 `summary.weeks.map((w) => { ... })` 迴圈內，狀態 pill 的 `<td>` 後面加一個 `<td>`。把原本這段：

```tsx
<td className="py-2 px-3">
  <span
    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
      w.status === 'active'
        ? 'bg-green-100 text-green-700'
        : w.status === 'sold_out'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-slate-100 text-slate-600'
    }`}
  >
    {w.status}
  </span>
</td>
```

改成：

```tsx
<td className="py-2 px-3">
  <span
    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
      w.status === 'active'
        ? 'bg-green-100 text-green-700'
        : w.status === 'sold_out'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-slate-100 text-slate-600'
    }`}
  >
    {w.status}
  </span>
</td>
<td className="py-2 px-3 text-right">
  <a
    href={`/api/admin/stay/weeks/${w.id}/export`}
    download
    className="inline-block px-2.5 py-1 text-xs bg-cyan-500 hover:bg-cyan-600 text-white rounded transition-colors"
  >
    匯出名單
  </a>
</td>
```

`<a download>` 直接觸發瀏覽器原生下載，不用 JS fetch/blob 來回。

- [ ] **Step 3：Lint + typecheck**

執行：`npm run lint && npx tsc --noEmit`
預期：通過。

- [ ] **Step 4：手動驗證（使用者 Chrome，依 CLAUDE.md）**

`npm run dev`，交給使用者用他自己已登入的 Chrome 開 `/admin/stay`，確認：
- 右側多一欄「操作」
- 每列都有青色「匯出名單」按鈕
- 點下去下載 `stay-<week-code>-<date>.csv`
- Excel 打開沒有亂碼，欄位符合 spec
- 桌面常用寬度下 table 不會溢位

- [ ] **Step 5：Commit**

```bash
git add app/admin/stay/page.tsx
git commit -m "feat(admin/stay): add per-week 匯出名單 button on overview"
```

---

## 全部完成後驗收 checklist

- [ ] `npm run lint` 通過
- [ ] `npx tsc --noEmit` 通過
- [ ] `/admin/stay` 表格有新的「操作」欄
- [ ] 點任一 active week 的「匯出名單」能下載 CSV，Excel 開啟正常
- [ ] CSV 只含 `confirmed / modified_in / pending_transfer` 的訂房
- [ ] CSV 表頭是 spec 指定的 8 個中文欄位
- [ ] 三個既有 CSV 匯出（`/admin/orders`、`/admin/members`、`/admin/subscribers`）仍可用，且都繼承了 formula-injection 防護（測試：名字填 `=test` 會被加引號）
- [ ] 三個 commit 各自範圍乾淨，沒有夾帶無關檔案
