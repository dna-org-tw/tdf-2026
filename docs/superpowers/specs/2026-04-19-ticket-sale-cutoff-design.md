# Ticket Sale Cutoff — Design

**Date:** 2026-04-19
**Status:** Draft for review

## Problem

Today (2026-04-19) the TDF 2026 site accepts ticket purchases indefinitely — no date gate exists in frontend, checkout API, or Stripe. We want to stop public ticket sales at **2026-04-21 00:00:00 Asia/Taipei** (= `2026-04-20T16:00:00Z`), with the cutoff overridable from the admin backend.

## Goals

1. At the default cutoff, all public purchase paths (new tickets + paid upgrades) stop accepting orders.
2. Admin can change the cutoff at any time via `/admin/settings`.
3. Admin manual-order path (`/admin/orders/new` → `/api/admin/orders`) is **unaffected** — it is the supported post-cutoff escape hatch.
4. In-flight Stripe sessions already created before the cutoff can still complete (do not break webhooks or checkout retrieval).

## Non-Goals

- Pausing Stripe Prices / Products (prices stay `active=true`; the gate is in our app).
- Per-tier cutoffs (all four tiers close together).
- Scheduled re-opening.
- Localisation of the contact-support email copy into more languages.

## Architecture

Mirror the existing `order_transfer_deadline` pattern, which already has:

- `app_settings` table (Supabase, key/value/updated_by/updated_at).
- Admin settings page at `app/admin/settings/page.tsx`.
- Admin API route shape at `app/api/admin/settings/<key>/route.ts`.
- Helper module (`lib/orderTransfer.ts`) exposing `get*`, `get*Raw`, `set*`, and a custom error class.

### New key

`ticket_sale_cutoff` in `app_settings`. If absent, the lib returns the hard-coded default `2026-04-20T16:00:00Z`. Admin may upsert any ISO 8601 timestamp.

### Data flow

```
                                   ┌─ /admin/settings  ──PATCH──► /api/admin/settings/ticket-sale-cutoff ──► app_settings
                                   │                                                                          │
                                   └─────────────────────────────GET─────────────────────────────────────────┘
                                                                                                              │
Public checkout (POST /api/checkout) ──► isTicketSaleClosed()  ──┐                                            │
Member upgrade (POST /api/member/upgrade) ──► isTicketSaleClosed() ──────────► getTicketSaleCutoff() ─────────┘
TicketsSection (client) ──fetch──► GET /api/tickets/status ──► getTicketSaleCutoff() (public shape)
UpgradeBanner / UpgradePageContent ──fetch──► GET /api/tickets/status
```

Everything reads from one source (`getTicketSaleCutoff()`), which reads `app_settings` or falls back to the default.

## Components

### 1. `lib/ticketSaleCutoff.ts` (new)

```ts
export const DEFAULT_CUTOFF_ISO = '2026-04-20T16:00:00Z'; // = 2026-04-21 00:00 Asia/Taipei
export const CUTOFF_KEY = 'ticket_sale_cutoff';

export class TicketSaleError extends Error {
  constructor(message: string, public httpStatus: number = 400) { super(message); }
}

export async function getTicketSaleCutoffRaw(): Promise<string | null>;     // raw value from DB (null if unset)
export async function getTicketSaleCutoff(): Promise<Date>;                 // DB value or DEFAULT_CUTOFF_ISO as Date
export async function isTicketSaleClosed(): Promise<boolean>;               // Date.now() >= cutoff.getTime()
export async function setTicketSaleCutoff(iso: string, adminEmail: string): Promise<string>;
```

Cutoff comparison is strictly `>=` against the cutoff instant; at exactly 00:00 Taipei, sales are closed.

### 2. `app/api/admin/settings/ticket-sale-cutoff/route.ts` (new)

GET + PATCH, copy-shape from `order-transfer-deadline/route.ts`:
- GET returns `{ value }` (null if unset).
- PATCH validates ISO 8601, upserts `app_settings`, returns `{ value }`.
- Both gated by `getAdminSession(req)`.

### 3. `app/api/tickets/status/route.ts` (new, public)

```ts
export async function GET() {
  const cutoff = await getTicketSaleCutoff();
  const closed = Date.now() >= cutoff.getTime();
  return NextResponse.json(
    { closed, cutoff: cutoff.toISOString(), supportEmail: 'registration@taiwandigitalfest.com' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
```

No auth. `no-store` is important — the cutoff flips at a specific instant and must not be CDN-cached stale.

### 4. `app/api/checkout/route.ts` (modify)

At the very top of the POST handler, **before** reCAPTCHA / Stripe work:

```ts
if (await isTicketSaleClosed()) {
  return NextResponse.json(
    { error: 'sales_closed', cutoff: (await getTicketSaleCutoff()).toISOString() },
    { status: 403 },
  );
}
```

### 5. `app/api/member/upgrade/route.ts` (modify)

Same guard, added **after** session auth (step 1) but **before** the order lookup (step 3). Error body `{ error: 'sales_closed', cutoff }`.

### 6. `/api/admin/orders/*` and `/api/admin/orders/[id]/upgrade` — **unchanged**

Admin manual orders and admin-driven upgrades bypass the cutoff. No code change. Admin routes do not call `/api/checkout` or `/api/member/upgrade`, so they are already naturally unaffected.

### 7. `app/api/webhooks/stripe/route.ts` — **unchanged**

Must always accept webhook deliveries; otherwise sessions that paid before the cutoff would never finalise into `orders` rows.

### 8. `components/sections/TicketsSection.tsx` (modify)

- On mount, fetch `/api/tickets/status` (single fetch, no retry/poll).
- While loading: render as today (no flash of "closed" state).
- When `closed === true`:
  - Show a red-ish banner above the tier cards:
    > **zh:** 售票已於 2026-04-21 00:00（台北時間）結束。如需補購，請來信 registration@taiwandigitalfest.com
    > **en:** Ticket sales closed at 2026-04-21 00:00 (Asia/Taipei). For late orders please contact registration@taiwandigitalfest.com
  - All Buy buttons: `disabled`, label swapped to `售票已結束` / `Sales closed`.
  - The sale-countdown / sale-badge UI is already conditional on date and naturally hides — no change needed there.

### 9. `components/member/UpgradeBanner.tsx` + `components/upgrade/UpgradePageContent.tsx` + `app/upgrade/page.tsx` (modify)

- Same `/api/tickets/status` fetch.
- When `closed === true`:
  - `UpgradeBanner`: hide entirely (no upgrade CTA on `/me`).
  - `UpgradePageContent` (at `/upgrade/...`): replace the tier grid with the same closed banner as above. `TierCard` Upgrade buttons not rendered.
- Rationale: once the cutoff hits, upgrade is just paid checkout under the hood, so it must close together per user's decision.

### 10. `data/content.ts` (modify)

Add a `tickets.salesClosed` block (zh + en) with banner text and button text. Single source of truth for all the UI above.

### 11. `app/admin/settings/page.tsx` (modify)

Add a second `<section>` below the existing order-transfer-deadline one:

- Title: `售票截止時間`
- Hint text: `此時間之後，公開購票頁與會員升級通道會關閉（後台手動開單不受影響）。預設為 2026-04-21 00:00（台北時間）。`
- Loads from `GET /api/admin/settings/ticket-sale-cutoff`. If `value` is null, prefill the input with the default (2026-04-21 00:00 Taipei).
- Same datetime-local input + Save / Reset buttons, matching the existing section's behavior (Reset reverts unsaved input to the currently-saved value).

### 12. E2E smoke test (Playwright, public route — allowed per CLAUDE.md)

Add one spec that stubs the `/api/tickets/status` response to `closed: true` (via `page.route`) and asserts:
1. Banner visible on `/` (Tickets section).
2. Buy button disabled.

Admin-side changes are not Playwright-tested (authenticated route — hand off to user's browser).

## Error Handling

- `app_settings` read failure in `getTicketSaleCutoff()` → log, fall through to `DEFAULT_CUTOFF_ISO`. Failure must **not** reopen sales.
- `setTicketSaleCutoff()` with invalid ISO → `TicketSaleError(400)`.
- `/api/tickets/status` failure in the browser → treat as `closed === false` (fail-open to avoid false-positive closed state from a transient API glitch). The server-side checkout/upgrade guard is the authoritative block; client UI is advisory.

## Testing Plan

- `tsc --noEmit`, `npm run lint`.
- Playwright spec (above) against `/`.
- Manual: `npm run dev`, open `/admin/settings`, edit the cutoff to `Date.now() - 1` hour, hit `/api/checkout` via curl and verify 403 `sales_closed`. Reset cutoff back to default.
- Manual: verify `/api/admin/orders` POST still works after the cutoff is in the past (admin bypass).
- Manual: verify an in-flight Stripe checkout (session created before flipping cutoff) still completes via webhook.

## Rollout

One PR. No DB migration needed (`app_settings` table already exists). Before merging to `main`:
1. Confirm `NEXT_PUBLIC_*` is not needed — the cutoff is read server-side and via a public API, never baked into the bundle.
2. On deploy, the default cutoff is immediately in effect for all environments. No env var needed.
3. If we need to **open sales again** before 2026-04-21, admin edits the value in `/admin/settings` to a future date.

## Open Questions

None. All clarifications resolved during brainstorming (2026-04-19).
