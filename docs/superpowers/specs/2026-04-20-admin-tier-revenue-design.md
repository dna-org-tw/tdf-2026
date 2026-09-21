# Admin Per-Tier Revenue + Stripe Reconciliation — Design

**Date:** 2026-04-20
**Status:** Draft for review

## Problem

The admin dashboard (`/admin`) currently shows ticket-tier **counts** (paid / comp / total) on its four top cards, plus a single grand-total **revenue** figure in the "營收健康" block. It does not show per-tier revenue. Admins can see how many Contributors we have, but not how much money Contributor tickets actually brought in.

Additionally, because revenue is a financial number, the admin needs confidence that the DB reflects what Stripe actually received — mismatches (webhook drops, test-mode residue, partial refunds only reconciled on one side) are currently invisible.

## Goals

1. Each of the three ticket-tier top cards on `/admin` displays the actual net revenue for that tier, next to the existing count.
2. Per-tier revenue is calculated consistently with the existing per-tier count bucketing.
3. An always-visible Stripe reconciliation badge in the "營收健康" block tells the admin at a glance whether DB ≈ Stripe.
4. When a discrepancy exists, a drill-down page lists each differing order with enough context to investigate (Stripe dashboard link, tier, amounts).
5. Stripe is the source of truth — any material mismatch surfaces visually and is not silently hidden.

## Non-Goals

- Per-user "effective tier" attribution (i.e. moving an upgrader's original purchase revenue from `explore` to `backer`). Each order's revenue stays under its own `ticket_tier`. Upgrade rows already carry the target tier, so upgrade deltas naturally land in the upgraded bucket.
- Auto-fixing discrepancies. The reconciliation page is read-only; manual resolution still happens through existing admin tools or Stripe dashboard.
- Multi-currency handling. The site is single-currency (USD) today. If multi-currency ever appears, the badge will show an early-exit state rather than reporting wrong numbers.
- Persisting reconciliation history. Results live in memory with a 5-minute TTL; no new DB table.
- Writing to Stripe from the reconcile endpoint (read-only).

## Architecture

Two additive changes, both tied into the existing `/admin` flow:

1. `app/api/admin/stats/route.ts` — augment the existing `tiers` payload with `revenue` per bucket. Pure DB query, no new Stripe calls.
2. `app/api/admin/stripe-reconcile/route.ts` (new) — pulls both DB orders and Stripe PaymentIntents, diffs them, returns a summary + discrepancy list. Cached in-memory for 5 min. Called asynchronously from the admin dashboard after paint.

Plus frontend:

3. `app/admin/page.tsx` — new third line on each tier StatCard (`sub2`). New reconcile badge in "營收健康" block.
4. `app/admin/reconcile/page.tsx` (new) — read-only list of discrepancies sorted by severity, each row linking to Stripe dashboard.

### Data flow

```
                        ┌─ /admin ──mount──► GET /api/admin/stats ──────► reads orders table
                        │                      (adds tiers[*].revenue)
                        │
                        └─ /admin ──mount──► GET /api/admin/stripe-reconcile
                                                │
                                                ├─ reads orders (paid / partially_refunded)
                                                ├─ paginates stripe.paymentIntents.list (all-time)
                                                ├─ diffs by stripe_payment_intent_id
                                                └─ returns { db_total, stripe_total, diff, discrepancies, checked_at }
                                                   │
                                 (results cached in module-level Map, TTL 5min, ?force=1 bypasses cache)
                                                   │
                        /admin ──badge─────────────┘
                           │
                           └─► click ──► /admin/reconcile (fetches same endpoint, shows full list)
```

## Per-tier revenue calculation

Extend the existing loop in `app/api/admin/stats/route.ts` (currently lines 81-91). For every order with `status IN ('paid', 'partially_refunded')`:

```
net = amount_total - amount_refunded
```

Add `net` to the tier's revenue field using the same bucketing as the existing count:

- `explore.revenue` += net  where `ticket_tier = 'explore'`
- `contribute.revenue` += net  where `ticket_tier = 'contribute'`
- `backer.revenue` += net  where `ticket_tier IN ('backer', 'weekly_backer')`

Notes:
- `refunded` (full refund) → `amount_total - amount_refunded = 0`, contributes nothing. Still included in the status filter is fine but unnecessary; exclude for clarity.
- `partially_refunded` contributes the net (post-refund) amount.
- Upgrade rows: `ticket_tier` is already the target tier and `amount_total` is the delta — no special-casing needed. The original order keeps its original tier and amount; the upgrade delta lands in the new tier.
- Comp orders (`amount_total = 0`) contribute 0 — already handled by existing count logic, harmless for revenue.
- The existing `/admin` also exposes `stats.revenue.total` (grand total). Keep that field as-is; the sum of `tiers[*].revenue` should equal `stats.revenue.total` minus any orders whose tier is not one of the four known values (none today, but defensive).

### API shape change

`GET /api/admin/stats` current:

```ts
tiers: {
  explore:    { paid: number; comp: number; total: number };
  contribute: { paid: number; comp: number; total: number };
  backer:     { paid: number; comp: number; total: number };
}
```

New:

```ts
tiers: {
  explore:    { paid: number; comp: number; total: number; revenue: number };
  contribute: { paid: number; comp: number; total: number; revenue: number };
  backer:     { paid: number; comp: number; total: number; revenue: number };
}
```

`revenue` is an integer in the smallest currency unit (cents), matching existing `amount_total` convention.

## Stripe reconciliation endpoint

`POST` or `GET /api/admin/stripe-reconcile` (GET, idempotent read-only, allows browser fetch without CSRF concerns; admin-auth required same as other `/api/admin/*` routes).

### Algorithm

1. Admin-auth gate (`getAdminSession`). Return 401 if absent.
2. Query DB: all orders with `status IN ('paid', 'partially_refunded')` where `stripe_payment_intent_id IS NOT NULL`. Fields: `id`, `stripe_payment_intent_id`, `ticket_tier`, `amount_total`, `amount_refunded`, `currency`.
3. Early-exit: if DB orders contain more than one distinct `currency`, return a `multi_currency` status with no reconciliation (badge renders neutrally).
4. Paginate `stripe.paymentIntents.list({ limit: 100, status: 'succeeded', expand: ['data.latest_charge'] })` across all pages (auto_pagination via `.autoPagingEach` or manual loop with `starting_after`). Collect PIs into a `Map<piId, { received, refunded }>` where:
   - `received = pi.amount_received`
   - `refunded = pi.latest_charge?.amount_refunded ?? 0`
5. Build discrepancy list:
   - `missing_in_db`: Stripe PI succeeded, no matching DB order
   - `missing_in_stripe`: DB order references a PI that doesn't exist in Stripe
   - `amount_mismatch`: both sides have the PI but `db.amount_total - db.amount_refunded != stripe.received - stripe.refunded`
6. Compute totals:
   - `db_total = sum(amount_total - amount_refunded) over DB set`
   - `stripe_total = sum(received - refunded) over ALL succeeded Stripe PIs (matched + unmatched)`. This way `diff = db_total - stripe_total` directly reflects unrecorded Stripe money (negative diff → DB is missing money); matches the intuitive "money gap" a finance person expects.
7. Cache result in module-scope `Map` keyed by a singleton string, with `{ payload, expires_at }`. TTL = 5 min. `?force=1` bypasses cache.
8. Return:
   ```ts
   {
     status: 'ok' | 'warning' | 'critical' | 'multi_currency' | 'stripe_unavailable';
     db_total: number;        // cents
     stripe_total: number;    // cents (matched PIs)
     diff: number;            // db_total - stripe_total
     currency: string;
     checked_at: string;      // ISO
     cached: boolean;
     counts: { missing_in_db: number; missing_in_stripe: number; amount_mismatch: number };
     discrepancies: Array<{
       type: 'missing_in_db' | 'missing_in_stripe' | 'amount_mismatch';
       payment_intent_id: string;
       db_order_id: string | null;
       ticket_tier: string | null;
       db_net: number | null;      // amount_total - amount_refunded, or null
       stripe_net: number | null;  // amount_received - amount_refunded, or null
       stripe_created: string | null;
     }>;
   }
   ```

### Severity mapping (response `status` field)

- `critical`: any `missing_in_db` → **Stripe received money, DB has no record**. Financial discrepancy, must be investigated.
- `warning`: no `missing_in_db`, but at least one `missing_in_stripe` or `amount_mismatch`.
- `ok`: all three discrepancy lists empty.
- `multi_currency`: early exit, cannot reconcile meaningfully.
- `stripe_unavailable`: Stripe API errored (rate limit, network). Badge shows amber "暫無法對帳".

### Error handling

- Stripe API errors: return `status: 'stripe_unavailable'` with HTTP 200 and `error_message`. Frontend badge stays amber, not red. We don't want Stripe being down to look identical to "critical missing money".
- DB errors: HTTP 500 `{ error: 'Database unavailable' }`. Badge shows generic red error state.

### Rate limit / performance

- All-time scan. For ~1k PIs expect ~10 paginated calls at 100/page. Stripe's default rate limit (100 req/s in live mode) is plenty.
- Each call: ~100-400ms. Full pass: 3-8s realistic.
- 5-min cache avoids repeat work when admin refreshes.
- Dashboard shows "對帳中…" spinner while first request is in flight; does not block other dashboard content (fires in its own useEffect).

## Admin dashboard UI changes

File: `app/admin/page.tsx`

### StatCard tweaks

Add optional `sub2` prop to the `StatCard` component:

```tsx
function StatCard({ label, value, sub, sub2, color, ring }: {
  ...
  sub2?: string;
})
```

When `sub2` is present, render below `sub` with the same slate-400 styling but on its own line to avoid crowding.

Callers for the three tier cards pass:

```tsx
sub2={formatCurrency(stats.tiers.<key>.revenue, stats.revenue.currency)}
```

Hide (`sub2` undefined) when revenue is 0, so backer-only-comp looks clean. The first card ("訂閱會員數") never gets `sub2`.

### Reconcile badge

In the "營收健康" header row (currently just `<h2>`), add a flex spacer and a badge on the right.

Badge states (Tailwind):

| status          | look                                               |
|-----------------|----------------------------------------------------|
| `ok`            | `bg-green-50 text-green-700 border-green-200` — `已同步 · {relative(checked_at)}` |
| `warning`       | `bg-amber-50 text-amber-700 border-amber-200` — `差異 {formatCurrency(abs(diff))} · 查看 →` (link) |
| `critical`      | `bg-red-600 text-white border-red-700` — `⚠ 有 {counts.missing_in_db} 筆待釐清 · 查看 →` (link) |
| `multi_currency`| `bg-slate-100 text-slate-600` — `混合幣別，暫不對帳` (no link) |
| `stripe_unavailable` | `bg-amber-50 text-amber-700` — `暫無法對帳 · 重試` (click calls with `?force=1`) |
| loading         | `bg-slate-100 text-slate-500 animate-pulse` — `對帳中…` |

Link targets `/admin/reconcile`.

Fetched via a new `useEffect` with its own state — independent from the stats fetch, doesn't block the rest of the dashboard.

## Reconcile detail page

File: `app/admin/reconcile/page.tsx` (new, client component).

- Calls `/api/admin/stripe-reconcile` on mount. Button at top: "強制重算" → calls with `?force=1`.
- Summary row: DB 總淨收入 / Stripe 總淨收入 / 差額 / 對帳時間.
- Table sorted: `missing_in_db` first (red left border), then `amount_mismatch` (amber), then `missing_in_stripe` (slate).
- Columns: 類型 / PI ID (truncated, click to copy) / DB tier / DB net / Stripe net / Stripe 建立時間 / 操作.
- 操作 column:
  - Stripe dashboard link: `https://dashboard.stripe.com/payments/{pi_id}` (opens new tab). Use `/test/payments/` in non-prod (detect via `NODE_ENV` or `STRIPE_SECRET_KEY.startsWith('sk_test')`, server-side via a flag in the response).
  - For orders where `db_order_id` exists, also link to `/admin/orders/{db_order_id}`.
- Empty states: per section ("無此類差異") and overall ("目前 DB 與 Stripe 完全一致 ✓").

## Files to add / modify

**Modify:**
- `app/api/admin/stats/route.ts` — add `revenue` field to each tier bucket.
- `app/admin/page.tsx` — `StatCard` gets `sub2`, tier cards pass revenue, "營收健康" header gets badge, new useEffect for reconcile fetch.

**Add:**
- `app/api/admin/stripe-reconcile/route.ts` — reconcile endpoint with in-memory cache.
- `app/admin/reconcile/page.tsx` — discrepancy list.
- `lib/stripeReconcile.ts` (optional helper) — the diff algorithm + cache, so it is unit-testable without Next request context.

**No DB migration.** No new columns, no new tables.

## Testing

### Unit (if `lib/stripeReconcile.ts` is extracted)

- `diff()` given DB set + Stripe map → correct bucket assignment for all three discrepancy types.
- `diff()` with empty sides, identical sides, single-side data.
- Amount comparison uses `net` (post-refund) on both sides.

### E2E

- `/admin` dashboard loads with per-tier revenue showing on all three tier cards (using seeded fixtures or existing dev DB). Public-route visual check via Playwright allowed per CLAUDE.md UI verification rules.
- Reconcile fetch is mocked or skipped in e2e (Stripe call is real otherwise) — inject `NEXT_PUBLIC_DISABLE_RECONCILE=1` or similar, or mock via route interception in Playwright. Simpler: point tests at stats-only, and do manual verification for reconcile badge.

### Manual verification (user session)

Because `/admin` is behind auth, Claude hands off for final visual verification per the CLAUDE.md 5-step circuit breaker rule. Before handoff:

- `tsc --noEmit` passes
- `npm run lint` passes
- Dev server boots cleanly

User then opens `/admin` in their own Chrome and confirms:

1. Three tier cards each show a "NT$ X,XXX" third line matching `stats.revenue.total` in aggregate.
2. "營收健康" badge shows `已同步` after initial load (assuming DB is consistent).
3. `/admin/reconcile` loads, Stripe connects, discrepancies list populates.
4. Force recompute button refreshes timestamp.

## Risks / open questions

- **Pagination overhead**: If PI count grows past a few thousand, the all-time scan could take 10+ seconds. Mitigation: the 5-min cache makes this a one-time cost per window. If unacceptable later, add a window parameter.
- **`stripe_invoice_id`-only upgrade orders**: Some upgrade paths create an order with `stripe_invoice_id` but no `stripe_payment_intent_id` until the invoice is paid (see `invoice.paid` webhook, lines 311-392 of `app/api/webhooks/stripe/route.ts`, which backfills the PI). If any paid upgrade order still lacks a `stripe_payment_intent_id`, it will show as `missing_in_stripe` here. Confirm via query before shipping; if present, extend the reconciler to look up those orders' PIs via their invoice.
- **Test-mode residue**: In production env with a live key, test PIs won't appear in Stripe. But if any old DB rows reference test PIs (shouldn't, but possible), they'll surface as `missing_in_stripe`. Acceptable — admin can ignore or clean up.
- **Cache invalidation across Node instances**: On Vercel, different serverless invocations may have different caches. That's fine — worst case is a user sometimes hits a cold one and waits 5s. No correctness issue.
- **`stats.revenue.total` vs sum of tier revenues**: The existing `stats.revenue.total` (stats route line 99) sums across all paid orders, which includes exactly the same set we'll bucket. They should match. If they don't (e.g. an order has an unexpected tier value), that's a bug we want to know about — consider logging if `sum(tiers[*].revenue) !== stats.revenue.total`.
