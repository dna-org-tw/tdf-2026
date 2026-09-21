# Ticket Sale Cutoff — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop public ticket sales + member self-service upgrade at a configurable cutoff (default 2026-04-21 00:00 Asia/Taipei = `2026-04-20T16:00:00Z`). Admin can edit the cutoff from `/admin/settings`. Admin manual-order and admin upgrade routes remain unaffected.

**Architecture:** Mirror the existing `order_transfer_deadline` pattern — store cutoff in `app_settings` under key `ticket_sale_cutoff`, fall back to a hard-coded default if DB row absent. One lib module (`lib/ticketSaleCutoff.ts`) is the single source of truth; checkout/upgrade API routes gate on it; a public `GET /api/tickets/status` feeds the frontend.

**Tech Stack:** Next.js 16 App Router, TypeScript 5, Supabase (`app_settings` table, service-role client in `lib/supabaseServer.ts`), Playwright for the public-route smoke test.

**Spec:** `docs/superpowers/specs/2026-04-19-ticket-sale-cutoff-design.md`

---

## File Map

| Path | Action | Responsibility |
|---|---|---|
| `lib/ticketSaleCutoff.ts` | create | DB accessors + `isTicketSaleClosed()` helper + error class |
| `app/api/admin/settings/ticket-sale-cutoff/route.ts` | create | Admin GET/PATCH API (auth-gated) |
| `app/api/tickets/status/route.ts` | create | Public GET — `{ closed, cutoff, supportEmail }` |
| `app/api/checkout/route.ts` | modify | Add closed-sales 403 guard at top of POST |
| `app/api/member/upgrade/route.ts` | modify | Add closed-sales 403 guard after auth |
| `components/sections/TicketsSection.tsx` | modify | Fetch status; show banner + disable buttons when closed |
| `components/upgrade/UpgradePageContent.tsx` | modify | Fetch status; show banner + hide tier grid when closed |
| `components/member/UpgradeBanner.tsx` | modify | Fetch status; render nothing when closed |
| `data/content.ts` | modify | Add `tickets.salesClosed` block (en + zh) |
| `app/admin/settings/page.tsx` | modify | Add second section for ticket sale cutoff |
| `tests/e2e/tickets-cutoff.spec.ts` | create | Public-route Playwright smoke test |

No DB migration needed — `app_settings` table already exists.

---

## Task 1: Create `lib/ticketSaleCutoff.ts`

**Files:**
- Create: `lib/ticketSaleCutoff.ts`

- [ ] **Step 1: Create the lib module**

```ts
// lib/ticketSaleCutoff.ts
import { supabaseServer } from './supabaseServer';

// 2026-04-21 00:00:00 Asia/Taipei (UTC+8) = 2026-04-20T16:00:00Z
export const DEFAULT_CUTOFF_ISO = '2026-04-20T16:00:00Z';
export const CUTOFF_KEY = 'ticket_sale_cutoff';

export class TicketSaleError extends Error {
  constructor(message: string, public httpStatus: number = 400) {
    super(message);
  }
}

export async function getTicketSaleCutoffRaw(): Promise<string | null> {
  if (!supabaseServer) return null;
  const { data } = await supabaseServer
    .from('app_settings')
    .select('value')
    .eq('key', CUTOFF_KEY)
    .maybeSingle();
  return (data?.value as string | undefined) ?? null;
}

export async function getTicketSaleCutoff(): Promise<Date> {
  const raw = await getTicketSaleCutoffRaw().catch(() => null);
  const iso = raw ?? DEFAULT_CUTOFF_ISO;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return new Date(DEFAULT_CUTOFF_ISO);
  return d;
}

export async function isTicketSaleClosed(): Promise<boolean> {
  const cutoff = await getTicketSaleCutoff();
  return Date.now() >= cutoff.getTime();
}

export async function setTicketSaleCutoff(iso: string, adminEmail: string): Promise<string> {
  if (!supabaseServer) throw new TicketSaleError('DB not configured', 500);
  const parsed = new Date(iso);
  if (isNaN(parsed.getTime())) throw new TicketSaleError('Invalid ISO 8601 timestamp');
  const value = parsed.toISOString();
  const { error } = await supabaseServer
    .from('app_settings')
    .upsert(
      {
        key: CUTOFF_KEY,
        value,
        updated_by: adminEmail,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' },
    );
  if (error) throw new TicketSaleError(error.message, 500);
  return value;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/ticketSaleCutoff.ts
git commit -m "feat(tickets): add ticketSaleCutoff helper (default 2026-04-21 00:00 Taipei)"
```

---

## Task 2: Create admin GET/PATCH route

**Files:**
- Create: `app/api/admin/settings/ticket-sale-cutoff/route.ts`

Reference existing shape at `app/api/admin/settings/order-transfer-deadline/route.ts`.

- [ ] **Step 1: Write the route**

```ts
// app/api/admin/settings/ticket-sale-cutoff/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import {
  getTicketSaleCutoffRaw,
  setTicketSaleCutoff,
  TicketSaleError,
} from '@/lib/ticketSaleCutoff';

export async function GET(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const value = await getTicketSaleCutoffRaw();
  return NextResponse.json({ value });
}

export async function PATCH(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const value = typeof body.value === 'string' ? body.value : '';

  if (!value) {
    return NextResponse.json({ error: 'value required' }, { status: 400 });
  }

  try {
    const saved = await setTicketSaleCutoff(value, session.email);
    return NextResponse.json({ value: saved });
  } catch (err) {
    if (err instanceof TicketSaleError) {
      return NextResponse.json({ error: err.message }, { status: err.httpStatus });
    }
    console.error('[PATCH settings/ticket-sale-cutoff]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/settings/ticket-sale-cutoff/route.ts
git commit -m "feat(admin): API for editing ticket_sale_cutoff in app_settings"
```

---

## Task 3: Create public status route

**Files:**
- Create: `app/api/tickets/status/route.ts`

- [ ] **Step 1: Write the route**

```ts
// app/api/tickets/status/route.ts
import { NextResponse } from 'next/server';
import { getTicketSaleCutoff } from '@/lib/ticketSaleCutoff';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cutoff = await getTicketSaleCutoff();
  const closed = Date.now() >= cutoff.getTime();
  return NextResponse.json(
    {
      closed,
      cutoff: cutoff.toISOString(),
      supportEmail: 'registration@taiwandigitalfest.com',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Smoke-test locally**

Run: `npm run dev` (background), then `curl -s http://localhost:3000/api/tickets/status | head`
Expected: JSON like `{"closed":false,"cutoff":"2026-04-20T16:00:00.000Z","supportEmail":"registration@taiwandigitalfest.com"}`.
Stop the dev server before moving on.

- [ ] **Step 4: Commit**

```bash
git add app/api/tickets/status/route.ts
git commit -m "feat(api): public GET /api/tickets/status (no-store)"
```

---

## Task 4: Gate `/api/checkout` POST

**Files:**
- Modify: `app/api/checkout/route.ts` — insert guard at the top of the POST handler (after the `if (!stripe)` early return, before `req.json()` so we don't pay the parse cost on closed sales).

- [ ] **Step 1: Edit the route**

Add import near the top of the file:

```ts
import { isTicketSaleClosed, getTicketSaleCutoff } from '@/lib/ticketSaleCutoff';
```

Inside `POST(req: NextRequest)`, immediately after the existing `if (!stripe) { ... return ... }` block (ends at current line 34), insert:

```ts
    if (await isTicketSaleClosed()) {
      const cutoff = await getTicketSaleCutoff();
      return NextResponse.json(
        { error: 'sales_closed', cutoff: cutoff.toISOString() },
        { status: 403 },
      );
    }
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new warnings for this file.

- [ ] **Step 4: Commit**

```bash
git add app/api/checkout/route.ts
git commit -m "feat(checkout): block /api/checkout after ticket sale cutoff"
```

---

## Task 5: Gate `/api/member/upgrade` POST

**Files:**
- Modify: `app/api/member/upgrade/route.ts` — insert guard right after step 1 (session check), so unauthenticated requests still get 401 first.

- [ ] **Step 1: Edit the route**

Add import:

```ts
import { isTicketSaleClosed, getTicketSaleCutoff } from '@/lib/ticketSaleCutoff';
```

Inside `POST`, immediately after the step-1 block:

```ts
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
```

insert:

```ts
    if (await isTicketSaleClosed()) {
      const cutoff = await getTicketSaleCutoff();
      return NextResponse.json(
        { error: 'sales_closed', cutoff: cutoff.toISOString() },
        { status: 403 },
      );
    }
```

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/member/upgrade/route.ts
git commit -m "feat(upgrade): block /api/member/upgrade after ticket sale cutoff"
```

---

## Task 6: Add `salesClosed` copy to `data/content.ts`

**Files:**
- Modify: `data/content.ts` — add a `salesClosed` block to both the `en` (`tickets:` at ~line 291) and `zh` (`tickets:` at ~line 1443) top-level copies.

- [ ] **Step 1: Add the en block**

Find the `tickets: {` block inside the `en` object. Insert after `processing: "Preparing your journey...",` (existing key):

```ts
      salesClosed: {
        banner: "Ticket sales closed at 2026-04-21 00:00 (Asia/Taipei). For late orders please contact registration@taiwandigitalfest.com",
        button: "Sales closed",
      },
```

- [ ] **Step 2: Add the zh block**

Find the `tickets: {` block inside the `zh` object. Insert after the matching `processing:` key:

```ts
      salesClosed: {
        banner: "售票已於 2026-04-21 00:00（台北時間）結束。如需補購，請來信 registration@taiwandigitalfest.com",
        button: "售票已結束",
      },
```

Note: the banner text is hard-coded to the default cutoff date — this is a deliberate trade-off. If admin extends the cutoff via `/admin/settings`, the banner reads from the status API and should dynamically use the actual cutoff. See Task 7 step 2 for the runtime replacement.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add data/content.ts
git commit -m "feat(i18n): add tickets.salesClosed copy (en + zh)"
```

---

## Task 7: Gate `TicketsSection.tsx`

**Files:**
- Modify: `components/sections/TicketsSection.tsx`

- [ ] **Step 1: Add status state + fetch**

Near the top of the component, alongside existing `useState` declarations, add:

```ts
  const [saleStatus, setSaleStatus] = useState<{ closed: boolean; cutoff: string } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/tickets/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d) setSaleStatus({ closed: !!d.closed, cutoff: d.cutoff });
      })
      .catch(() => {
        // fail-open: leave saleStatus null so UI stays open (server still blocks)
      });
    return () => {
      alive = false;
    };
  }, []);

  const salesClosed = saleStatus?.closed === true;
```

- [ ] **Step 2: Add the closed banner**

Just inside the `<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">` (existing line ~303), before the existing sale countdown block, insert:

```tsx
        {salesClosed && (
          <div
            className="mb-10 rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-4 text-center text-sm sm:text-base text-red-100"
            role="status"
          >
            {t.tickets.salesClosed?.banner ??
              'Ticket sales are closed. Please contact registration@taiwandigitalfest.com.'}
            {saleStatus?.cutoff && (
              <div className="mt-1 text-xs text-red-200/70 font-mono">
                cutoff: {new Date(saleStatus.cutoff).toLocaleString('en-US', {
                  timeZone: 'Asia/Taipei',
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })} (Asia/Taipei)
              </div>
            )}
          </div>
        )}
```

- [ ] **Step 3: Disable the three-tier Buy buttons**

Find the `<button onClick={() => handleCheckout(tier)} ...>` inside the `ticketTiers.map(...)` block (around existing line 589). Change:

```tsx
                  disabled={loadingTier === tier.key}
```

to:

```tsx
                  disabled={salesClosed || loadingTier === tier.key}
```

And change the button label JSX:

```tsx
                  {loadingTier === tier.key
                    ? t.tickets?.processing ?? 'Processing...'
                    : t.tickets?.payWithCard ?? 'Pay with card'}
```

to:

```tsx
                  {salesClosed
                    ? t.tickets.salesClosed?.button ?? 'Sales closed'
                    : loadingTier === tier.key
                      ? t.tickets?.processing ?? 'Processing...'
                      : t.tickets?.payWithCard ?? 'Pay with card'}
```

- [ ] **Step 4: Disable the Weekly Backer button**

Find the second button (Weekly Backer tier, around line 648) with `onClick={() => { setPendingWeekTier({ ... Weekly Backer ... }); ... setWeekModalOpen(true); }}`. Change:

```tsx
                disabled={loadingTier === 'weekly_backer'}
```

to:

```tsx
                disabled={salesClosed || loadingTier === 'weekly_backer'}
```

And update its label similarly:

```tsx
                {salesClosed
                  ? t.tickets.salesClosed?.button ?? 'Sales closed'
                  : loadingTier === 'weekly_backer'
                    ? (t.tickets?.processing ?? 'Processing...')
                    : (t.tickets?.payWithCard ?? 'Start Your Journey')}
```

- [ ] **Step 5: Do NOT touch the Follower (free email) section**

The Follower card is a newsletter subscription, not a paid ticket — it stays active even after sales close.

- [ ] **Step 6: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add components/sections/TicketsSection.tsx
git commit -m "feat(tickets): disable purchase UI after sale cutoff"
```

---

## Task 8: Gate `UpgradePageContent.tsx`

**Files:**
- Modify: `components/upgrade/UpgradePageContent.tsx`

- [ ] **Step 1: Fetch status**

In the component (after the existing `useState` block), add:

```ts
  const [salesClosed, setSalesClosed] = useState(false);
  const [saleCutoff, setSaleCutoff] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/tickets/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d) {
          setSalesClosed(!!d.closed);
          setSaleCutoff(d.cutoff ?? null);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
```

- [ ] **Step 2: Early-return a closed banner when sales are closed**

Read the full file first (you only have lines 1-80; there's more below). Find the main JSX return. Wherever the tier grid renders (usually after `<Navbar />` and before `<Footer />`), wrap it with a conditional: when `salesClosed === true`, render a closed-banner block instead of the grid.

Example closed block (match the page's existing style — Navbar/Footer + a centered card):

```tsx
<section className="min-h-screen bg-stone-50">
  <Navbar />
  <div className="max-w-3xl mx-auto px-4 py-20">
    <div className="rounded-2xl border border-red-300 bg-red-50 p-8 text-center">
      <h1 className="text-2xl font-display font-bold text-red-900 mb-3">
        {lang === 'zh' ? '升級通道已關閉' : 'Upgrades closed'}
      </h1>
      <p className="text-sm text-red-800">
        {t.tickets?.salesClosed?.banner ??
          'Ticket sales are closed. Please contact registration@taiwandigitalfest.com.'}
      </p>
      {saleCutoff && (
        <p className="mt-2 text-xs font-mono text-red-700/70">
          cutoff: {new Date(saleCutoff).toLocaleString(lang === 'zh' ? 'zh-TW' : 'en-US', {
            timeZone: 'Asia/Taipei', dateStyle: 'medium', timeStyle: 'short',
          })} (Asia/Taipei)
        </p>
      )}
    </div>
  </div>
  <Footer />
</section>
```

Place the conditional so that the existing Navbar/Footer aren't duplicated — the simplest way is to insert the closed branch as an early `return` right before the existing page JSX `return`.

- [ ] **Step 3: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`

- [ ] **Step 4: Commit**

```bash
git add components/upgrade/UpgradePageContent.tsx
git commit -m "feat(upgrade): close self-service upgrade page after sale cutoff"
```

---

## Task 9: Gate `UpgradeBanner.tsx`

**Files:**
- Modify: `components/member/UpgradeBanner.tsx`

- [ ] **Step 1: Fetch status and hide banner when closed**

At the top of the component body (after `const { t } = useTranslation();` at line 26), add:

```ts
  const [salesClosed, setSalesClosed] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch('/api/tickets/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d?.closed) setSalesClosed(true);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  if (salesClosed) return null;
```

Add the React import if missing:

```ts
import { useEffect, useState } from 'react';
```

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`

- [ ] **Step 3: Commit**

```bash
git add components/member/UpgradeBanner.tsx
git commit -m "feat(member): hide upgrade banner after sale cutoff"
```

---

## Task 10: Add admin settings section

**Files:**
- Modify: `app/admin/settings/page.tsx` — add a second `<section>` after the existing `order-transfer-deadline` section.

- [ ] **Step 1: Add state hooks**

Alongside the existing `deadline` / `input` state, add:

```ts
  const [cutoff, setCutoff] = useState<string | null>(null);
  const [cutoffInput, setCutoffInput] = useState('');
  const [cutoffSaving, setCutoffSaving] = useState(false);
  const DEFAULT_CUTOFF_ISO = '2026-04-20T16:00:00Z';
```

- [ ] **Step 2: Add loader**

Inside the existing `load()` function (or as a sibling), after loading the transfer deadline, also fetch the cutoff:

```ts
      const cRes = await fetch('/api/admin/settings/ticket-sale-cutoff');
      if (cRes.ok) {
        const cData = await cRes.json();
        setCutoff(cData.value ?? null);
        setCutoffInput(formatLocalInputValue(cData.value ?? DEFAULT_CUTOFF_ISO));
      }
```

- [ ] **Step 3: Add save function**

```ts
  const saveCutoff = async () => {
    if (!cutoffInput) {
      showToast('請輸入日期時間');
      return;
    }
    const localDate = new Date(cutoffInput);
    if (isNaN(localDate.getTime())) {
      showToast('時間格式無效');
      return;
    }
    setCutoffSaving(true);
    try {
      const res = await fetch('/api/admin/settings/ticket-sale-cutoff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: localDate.toISOString() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(`儲存失敗：${data.error ?? '未知錯誤'}`);
        return;
      }
      setCutoff(data.value);
      showToast('已儲存');
    } finally {
      setCutoffSaving(false);
    }
  };

  const cutoffPassed = cutoff
    ? (() => {
        const d = new Date(cutoff);
        return !isNaN(d.getTime()) && Date.now() > d.getTime();
      })()
    : (Date.now() > new Date(DEFAULT_CUTOFF_ISO).getTime());
```

- [ ] **Step 4: Add the section JSX**

After the existing `<section>` (the order-transfer-deadline one), add:

```tsx
      <section className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">售票截止時間</h2>
          <p className="text-xs text-slate-500 mt-1">
            此時間之後，公開購票頁與會員自助升級會關閉（後台手動開單／升級不受影響）。預設為 2026-04-21 00:00（台北時間）。
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">載入中…</p>
        ) : (
          <>
            <div className="text-sm space-y-1">
              <div>
                <span className="text-slate-500">目前設定值：</span>
                <span className="font-mono text-slate-900">
                  {cutoff ?? `(未設定，使用預設 ${DEFAULT_CUTOFF_ISO})`}
                </span>
              </div>
              <div>
                <span className="text-slate-500">本地顯示：</span>
                <span className="text-slate-900">
                  {new Date(cutoff ?? DEFAULT_CUTOFF_ISO).toLocaleString('zh-TW', {
                    year: 'numeric', month: 'long', day: 'numeric',
                    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Taipei',
                    timeZoneName: 'short',
                  })}
                </span>
              </div>
              {cutoffPassed && (
                <div className="inline-block mt-1 px-2 py-0.5 text-xs bg-rose-100 text-rose-800 rounded">
                  已過截止時間 · 公開購票與自助升級已關閉
                </div>
              )}
            </div>

            <label className="block text-sm">
              <span className="text-slate-700 font-medium">新的截止時間（本地時區）</span>
              <input
                type="datetime-local"
                value={cutoffInput}
                onChange={(e) => setCutoffInput(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded text-sm font-mono"
              />
            </label>

            <div className="flex gap-2 pt-2">
              <button
                onClick={saveCutoff}
                disabled={cutoffSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-[#10B8D9] hover:bg-[#0EA5C4] rounded-lg disabled:opacity-50"
              >
                {cutoffSaving ? '儲存中…' : '儲存'}
              </button>
              <button
                onClick={() => setCutoffInput(formatLocalInputValue(cutoff ?? DEFAULT_CUTOFF_ISO))}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                重設
              </button>
            </div>
          </>
        )}
      </section>
```

- [ ] **Step 5: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`

- [ ] **Step 6: Commit**

```bash
git add app/admin/settings/page.tsx
git commit -m "feat(admin): settings UI for ticket sale cutoff"
```

---

## Task 11: Playwright smoke test (public route)

**Files:**
- Create: `tests/e2e/tickets-cutoff.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
// tests/e2e/tickets-cutoff.spec.ts
import { expect, test } from '@playwright/test';

test.describe('ticket sale cutoff UI', () => {
  test('when /api/tickets/status returns closed, banner shows and buy button is disabled', async ({ page }) => {
    await page.route('**/api/tickets/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          closed: true,
          cutoff: '2026-04-20T16:00:00.000Z',
          supportEmail: 'registration@taiwandigitalfest.com',
        }),
      }),
    );

    await page.goto('/?lang=en#tickets');

    // Banner copy (partial match on the hard-coded contact email)
    await expect(
      page.getByText(/registration@taiwandigitalfest\.com/i).first(),
    ).toBeVisible();

    // Explorer / Contributor / Backer buttons should read "Sales closed" and be disabled
    const salesClosedButtons = page.getByRole('button', { name: /sales closed/i });
    await expect(salesClosedButtons.first()).toBeVisible();
    await expect(salesClosedButtons.first()).toBeDisabled();
  });

  test('when status returns open, buy button is enabled', async ({ page }) => {
    await page.route('**/api/tickets/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          closed: false,
          cutoff: '2099-12-31T00:00:00.000Z',
          supportEmail: 'registration@taiwandigitalfest.com',
        }),
      }),
    );

    await page.goto('/?lang=en#tickets');

    const buyButtons = page.getByRole('button', { name: /pay with card|start your journey/i });
    await expect(buyButtons.first()).toBeVisible();
    await expect(buyButtons.first()).toBeEnabled();
  });
});
```

- [ ] **Step 2: Run the spec**

Run: `PLAYWRIGHT_PORT=3101 npx playwright test tests/e2e/tickets-cutoff.spec.ts --project=chromium`
Expected: both tests pass.

(If the auth.setup dependency is configured as required for all specs and forces login: run with `--project=chromium-no-auth` or whichever project doesn't depend on `auth.setup.ts`. Check `playwright.config.ts` and use the public-route project.)

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/tickets-cutoff.spec.ts
git commit -m "test(e2e): public-route smoke test for ticket sale cutoff"
```

---

## Task 12: End-to-end verification

- [ ] **Step 1: Full type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 2: Manual smoke (dev server)**

1. `npm run dev` (background)
2. `curl -s http://localhost:3000/api/tickets/status` — confirm `closed:false` when now < default cutoff, `closed:true` when now > cutoff.
3. POST to `/api/checkout` with an invalid body while artificially tripping cutoff (temporary: in dev, edit DEFAULT_CUTOFF_ISO to `1970-01-01T00:00:00Z`, restart, verify 403 `sales_closed`, then revert).
4. Open `/?lang=zh#tickets` and check banner + disabled buttons render.

If all looks clean, move to step 3. (Do NOT leave the DEFAULT_CUTOFF_ISO edit in.)

- [ ] **Step 3: Playwright full run (public specs only)**

Run: `npm run e2e -- tests/e2e/tickets-cutoff.spec.ts`
Expected: pass.

- [ ] **Step 4: Final commit — if nothing was modified, skip**

Otherwise commit with a tidying message, then stop. Do not merge or push — leave for user review.

---

## Post-Implementation Notes

- **Admin bypass is implicit.** `/api/admin/orders/*` and `/api/admin/orders/[id]/upgrade` never call `/api/checkout` or `/api/member/upgrade`, so they are naturally unaffected — **do not add guards there**.
- **Webhook untouched.** `app/api/webhooks/stripe/route.ts` must continue accepting deliveries unconditionally.
- **Rollback.** If something breaks post-cutoff, admin can set a far-future date in `/admin/settings/ticket-sale-cutoff` to reopen public sales — no redeploy needed.
- **Testing against prod DB:** do NOT modify the prod `app_settings` row during testing. Use `.env.local` with a separate project, or edit `DEFAULT_CUTOFF_ISO` locally for a quick smoke then revert.
