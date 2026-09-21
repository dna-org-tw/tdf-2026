# Admin Auditing Page — Design

**Status:** Approved
**Date:** 2026-04-21
**Owner:** kkshyu@dna.org.tw
**Purpose:** Give admins a single read-only timeline that unifies existing audit-trail tables, used for debugging — not compliance.

## Context

The admin backend already writes several audit-like tables:

- `order_actions` — admin operations on orders (refund, cancel, edit, resend_receipt, note, manual_create, upgrade, transfer)
- `order_transfers` — ownership changes for orders (user self-serve + admin force-transfer; captures IP and user-agent)
- `visa_letter_issuances` — visa support PDF issuances

These are scattered across different admin detail pages (each order page shows its own `order_actions` timeline, each member page shows its own visa issuances). When debugging, there's no single view to answer "what changed in the system in the last hour?" This spec adds that view.

**Non-goals:**

- Not a compliance system. No new `audit_logs` table, no write-side instrumentation, no RLS policies, no retention rules.
- Not a replacement for `/admin/history` (batch notifications).

## Route & Navigation

- New route: `/admin/auditing`
- New top-nav link `稽核軌跡`, placed between `發送紀錄` and `Luma 同步` in `app/admin/layout.tsx`
- Gated by the existing `AdminGate` (which already requires `@dna.org.tw` email)

## Data Sources

Three existing tables, merged in-memory. **No schema changes.**

| Source              | Captures                                    | Actor field             | Key extras                  |
| ------------------- | ------------------------------------------- | ----------------------- | --------------------------- |
| `order_actions`     | Admin ops on orders                         | `admin_email`           | `payload`, `stripe_response`, `status`, `error_message` |
| `order_transfers`   | Order ownership changes (user + admin)      | `actor_admin_email` or `actor_user_id` | `ip_address`, `user_agent`, `initiated_by` |
| `visa_letter_issuances` | Visa PDF issuances                      | `issued_by`             | `document_no`, `profile_snapshot`, `order_snapshot` |

### Overlap note

When an admin force-transfers an order, both `order_actions` (action='transfer') and `order_transfers` receive a row. We keep **both rows** in the timeline (each tagged with its source badge) rather than dedupe, because each carries distinct context useful for debugging:

- `order_actions` has `stripe_response` and `error_message`
- `order_transfers` has `ip_address`, `user_agent`, and `initiated_by`

## Unified Event Shape

Normalized at the API layer; the DB is untouched.

```ts
type UnifiedEvent = {
  id: string;                      // stable per-source id, prefixed to avoid collisions: "oa:<uuid>" | "ot:<uuid>" | "vl:<id>"
  at: string;                      // ISO 8601 timestamp
  source: 'order_action' | 'order_transfer' | 'visa_letter';
  actor: string;                   // admin email, user email, or 'system'
  actorType: 'admin' | 'user' | 'system';
  action: string;                  // 'refund' | 'transfer' | 'visa_issue' | ...
  resourceType: 'order' | 'visa_letter';
  resourceId: string;              // order UUID, document_no, etc.
  resourceLabel: string;           // short human-facing label shown in the cell
  resourceLink: string | null;     // deep link back into admin, e.g. /admin/orders/<id>
  status: 'success' | 'failed' | null;
  summary: string;                 // one-line human-readable description (zh-TW)
  payload: unknown;                // raw source row (redacted of secrets), shown in expand
};
```

### Source → action mapping

- `order_actions.action` → `action` verbatim (`refund` | `cancel` | `edit` | `resend_receipt` | `note` | `manual_create` | `upgrade` | `transfer`); `actor = admin_email`, `actorType = 'admin'`
- `order_transfers` → `action = 'transfer'`. If `initiated_by='admin'`, `actor = actor_admin_email`, `actorType = 'admin'`. If `initiated_by='user'`, `actor = from_email` (the original owner who initiated the handover), `actorType = 'user'`. `actor_user_id` is surfaced in the expanded payload only.
- `visa_letter_issuances` → `action = 'visa_issue'`; `actor = issued_by`; `actorType = 'system'` if `issued_by='system'`, else `'admin'`

## API

### Endpoint

`GET /api/admin/auditing`

### Query parameters

| Param     | Type               | Default   | Notes |
| --------- | ------------------ | --------- | ----- |
| `from`    | ISO timestamp      | now - 7d  | Inclusive lower bound on event time |
| `to`      | ISO timestamp      | now       | Inclusive upper bound |
| `actor`   | string             | —         | Case-insensitive substring match on actor |
| `source`  | comma-separated    | all three | Allowed: `order_action,order_transfer,visa_letter` |
| `action`  | string             | —         | Exact match on action |
| `q`       | string             | —         | Substring match on `resourceId`, `resourceLabel`, or `summary` |
| `limit`   | int                | 100       | Max 500; request-time clamp |

### Behavior

1. Validate the caller's Supabase session cookie; require `@dna.org.tw` email. Return 401 otherwise.
2. Parse and clamp query params. Invalid params → 400 with a short message.
3. Fetch each of the three tables **in parallel** with Supabase, applying time window + source-specific filters. For the `actor` filter, match substring against each table's actor column(s): `order_actions.admin_email`, `order_transfers.actor_admin_email OR from_email`, `visa_letter_issuances.issued_by`. Use an `OR` expression in Supabase, not a client-side post-filter, so `limit` remains meaningful. Request `limit + 1` from each source so we can detect whether more rows exist.
4. Normalize each row into `UnifiedEvent`.
5. Merge, sort `at` DESC, slice to `limit`.
6. Return `{ events: UnifiedEvent[], hasMore: boolean, window: { from, to } }`.

**Why not SQL `UNION ALL`?** The three tables have very different columns (JSONB snapshots, INET addresses, nullable admin emails, system-issued flags). Normalizing in TypeScript is clearer and easier to evolve than stitching heterogeneous SELECTs together in a single query.

### Scale & safety

- `limit` capped server-side at 500.
- Date window capped at 90 days (reject with 400 if `to - from > 90d`); debugging almost never needs more, and it prevents accidental full-table scans.
- Route uses the existing server-side Supabase service-role client (`lib/supabaseServer.ts`). Auth is enforced at the API layer — we do not rely on RLS.
- Payloads shown to admins may contain order emails and Stripe IDs; this is acceptable because the route is already admin-only. We do **not** display raw Supabase user IDs from `order_transfers.actor_user_id` in the summary — only the resolved email where possible (falling back to the UUID).

## UI

**File:** `app/admin/auditing/page.tsx` (client component; follows existing admin page pattern — see `app/admin/history/page.tsx`).

### Layout

```
┌ 稽核軌跡 ────────────────────────────────────────────────────────┐
│ [日期 from] [日期 to]  [來源 ▽] [Actor ___] [動作 ▽] [搜尋 ___]  │
│                                                          [套用]  │
├──────────────────────────────────────────────────────────────────┤
│ 時間        │ 來源       │ 操作人      │ 動作    │ 對象   │ 狀態│
│ 04-21 14:32 │ 訂單操作   │ admin@...   │ refund  │ #abc   │ ✓   │
│   ▼ (expanded row: JSON payload + link)                         │
│ 04-21 14:18 │ 訂單轉讓   │ user@...    │ transfer│ #def   │ ✓   │
│ 04-21 13:55 │ 簽證信     │ system      │ issue   │ TDF-.. │ ✓   │
│ ...                                                              │
│                     [ 載入更多 ]                                │
└──────────────────────────────────────────────────────────────────┘
```

### Filter bar

- Two `<input type="date">` for `from` / `to` (defaults: last 7 days, Asia/Taipei)
- Source multi-select (checkboxes: `訂單操作`, `訂單轉讓`, `簽證信`)
- Actor text input (substring match)
- Action dropdown (populated from the union of known actions)
- Free-text search input (matches `resourceId` / `resourceLabel` / `summary`)
- `套用` button triggers a single fetch with the current filter state. No debounced auto-fetch — debugging flows prefer explicit refresh.

### Table

- Columns: **時間 · 來源 · 操作人 · 動作 · 對象 · 狀態**
- Time formatted in Asia/Taipei, `YYYY-MM-DD HH:mm:ss`
- Source shown as a colored badge (one color per source)
- Actor shown with a small `admin` / `user` / `system` badge so it's scannable
- Object column is a link to the resource's admin detail page (`/admin/orders/<id>`, etc.); clicking opens in a new tab
- Status: `✓` (success), `✗ 失敗` (failed, red), or `—` (no status)
- Failed rows get a red 4px left-border for scanability
- Clicking anywhere else on a row toggles an expanded inline row showing:
  - Full `summary`
  - `payload` rendered in a `<pre>` with subtle background (raw JSON, 2-space indent)
  - For `order_transfer` rows, `ip_address` and `user_agent` surfaced outside the JSON for quick scanning

### Pagination

- `limit=100` per page
- `載入更多` button at the bottom; clicking re-fetches with `to = <oldest loaded event.at>` (keyset-style via date) and appends. Good enough for debugging; no need for offset pagination.
- When `hasMore === false`, show `沒有更多紀錄了` instead of the button.

### Empty / error states

- Loading: center spinner (reuse the admin layout pattern)
- Empty result: `在此區間沒有稽核紀錄`
- API error: red banner with the error message and a `重試` button

## What's explicitly out of scope (YAGNI)

- No new `audit_logs` table
- No write-side instrumentation for untracked flows (discount codes, stay bookings, settings, Luma sync triggers)
- No inclusion of `notification_logs` (already at `/admin/history`), `email_logs` (too high-volume for a debug timeline), or `app_settings` (currently only one tunable key)
- No CSV export — copy/paste from the expanded JSON is sufficient
- No realtime / auto-refresh
- No RLS policies on the source tables
- No retention cleanup jobs

## Acceptance criteria

1. Navigating to `/admin/auditing` as a `@dna.org.tw`-authenticated user shows the last 7 days of events merged across all three sources, newest first.
2. Filtering by `actor=<email>` returns only rows whose actor matches (case-insensitive).
3. Filtering by `source=order_transfer` returns only transfer events (both user- and admin-initiated).
4. Each row's 對象 cell links to the correct admin detail page (`/admin/orders/<id>` for orders).
5. Expanding a row reveals the raw payload as formatted JSON plus, for transfers, IP and user-agent.
6. Unauthenticated or non-`dna.org.tw` requests to `GET /api/admin/auditing` return 401.
7. `tsc --noEmit` and `npm run lint` pass.

## File inventory

**New:**

- `app/api/admin/auditing/route.ts` — GET handler, merges the three sources
- `app/admin/auditing/page.tsx` — client UI
- `lib/adminAuditing.ts` — shared types (`UnifiedEvent`, mappers) and merge/normalize helpers

**Modified:**

- `app/admin/layout.tsx` — add `稽核軌跡` nav link

**Unchanged:** all existing tables, migrations, and audit-writing code paths.
