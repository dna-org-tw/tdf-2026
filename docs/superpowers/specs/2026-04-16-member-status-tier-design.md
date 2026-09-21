# Member Status & Engagement Tier — Design

**Date:** 2026-04-16
**Status:** Approved, ready for implementation plan

## Goal

Treat every email in our system as a **member**. Add two orthogonal attributes — **status** (lifecycle stage) and **tier** (engagement heat) — to the admin Members page and the notification sender, so we can (a) spot conversion opportunities and (b) send targeted communications by segment.

## Definitions

### Member

Any email that appears in at least one of:

- `orders.customer_email` (any status)
- `newsletter_subscriptions.email`
- `notification_logs.recipient_email`
- Future: award voters, visitor emails

Deduplicate by lowercased trimmed email.

### Status (one per member)

Mutually exclusive lifecycle stage, highest priority wins.

| status | Rule | Typical action |
|---|---|---|
| `paid` | ≥1 order with `status='paid'` | Thank, event info |
| `pending` | No paid order; has ≥1 order with `status='pending'` that is not past its effective expiry | Chase payment |
| `abandoned` | No paid order, no active pending; has ≥1 order with `status` in (`expired`, `cancelled`, `failed`) | Re-invite |
| `subscriber` | Not in orders at all; present in `newsletter_subscriptions` | Convert |
| `other` | None of the above (e.g., only in `notification_logs`) | Nurture |

Priority: `paid > pending > abandoned > subscriber > other`.

Pending-expiry rule: a `pending` order counts as active if `created_at > now() - interval '7 days'` (Stripe checkout sessions expire in 24h but we give a week-long window for pending status before classifying as abandoned). Exact threshold to be confirmed during implementation if business wants different.

### Tier (engagement score bucket)

Independent of status. Score is derived from interactions across all sources.

**Scoring formula** (sum all that apply):

| Signal | Points |
|---|---|
| Paid `backer` ticket (per order) | +40 |
| Paid `weekly_backer` ticket (per order) | +25 |
| Paid `contribute` ticket (per order) | +15 |
| Paid `explore` ticket (per order) | +8 |
| Any activity in last 30 days (paid order, notification open, click) | +10 |
| Any activity in last 90 days (and not in 30-day bucket) | +5 |
| Email open rate >50% over all sent notifications | +5 |
| Has ever clicked a tracked link in a notification | +5 |
| Paid order count >1 | +10 |

Note: "Any activity in last 30 days" and "last 90 days" are mutually exclusive — take the higher-scoring one, not both.

**Tier buckets:**

- `S` (VIP) — score ≥ 50
- `A` (Warm) — 20–49
- `B` (Cool) — 5–19
- `C` (Cold) — < 5

## Architecture

### Data layer: `members_enriched` SQL view

Postgres view aggregating the sources above. Columns:

```
email                  text (lowercased, primary-key equivalent)
name                   text       -- most recent non-null from orders
phone                  text       -- most recent non-null from orders
status                 text       -- enum (paid|pending|abandoned|subscriber|other)
paid_order_count       int
total_spent_cents      bigint
currency               text       -- last-seen currency from paid orders (default 'usd')
highest_ticket_tier    text       -- max across paid orders by rank
last_order_at          timestamptz
last_interaction_at    timestamptz -- max(last_order_at, last_notification_open, ...)
email_sent_count       int        -- from notification_logs
email_open_count       int
email_click_count      int
email_open_rate        numeric    -- open_count / sent_count (NULL if sent_count=0)
score                  int
tier                   text       -- S|A|B|C
subscribed_newsletter  boolean
in_orders              boolean
```

Start with a plain view (evaluated on every query). If performance degrades beyond ~10k members, convert to `MATERIALIZED VIEW` with a 5-minute refresh cron.

Migration: `supabase/migrations/create_members_enriched_view.sql`.

### API changes

**New: `GET /api/admin/members`**

Replaces `/api/admin/contacts`. Query params:

- `search` — email or name, ILIKE
- `status` — comma-separated list (e.g. `paid,pending`)
- `tier` — comma-separated list (e.g. `S,A`)
- `ticketTier` — comma-separated ticket tier (only applies when `status` includes `paid`)
- `page`, `limit` — paging

Returns `{ members: EnrichedMember[], total, totalPages, summary: { byStatus, byTier } }`.

`summary` powers the overview chips on the page.

**Modified: `/api/admin/recipients` and `lib/recipients.ts`**

Read from `members_enriched` instead of querying `orders` / `newsletter_subscriptions` directly. New optional params:

- `statuses?: MemberStatus[]`
- `tiers?: MemberTier[]`
- `ticketTiers?: TicketTier[]` (renamed from current `tiers` to avoid collision)

Keep `groups` parameter for backward compat, but translate internally: `orders` → `statuses=['paid']`, `subscribers` → `statuses=['subscriber']`.

### UI changes

**`/admin/members` page:**

- Table gains two columns: **狀態** (status badge) and **等級** (tier badge).
- Badge colors:
  - Status: `paid` green, `pending` yellow, `abandoned` orange, `subscriber` blue, `other` gray.
  - Tier: `S` purple, `A` red, `B` yellow, `C` gray.
- Filter row gains two multi-selects (status, tier) and keeps ticket tier select.
- Above the table, add **overview chips** showing counts per status and per tier. Clicking a chip applies that filter.

**`/admin/send` page:**

- Top row: **Quick presets** (buttons):
  - 催單 → `status=pending,abandoned`
  - VIP → `status=paid` + `tier=S,A`
  - 冷名單喚醒 → `status=subscriber` + `tier=B,C`
  - 全體付費 → `status=paid`
- Below presets: detailed checkboxes for status / tier / ticket_tier, editable.
- Live recipient count preview via `/api/admin/recipients?...&preview=1`.

## Files touched

New:
- `supabase/migrations/create_members_enriched_view.sql`
- `app/api/admin/members/route.ts`
- `lib/members.ts` — shared types (`MemberStatus`, `MemberTier`, `EnrichedMember`)

Modified:
- `app/admin/members/page.tsx` — new columns, filters, overview chips
- `app/admin/send/page.tsx` — preset buttons, new filters
- `lib/recipients.ts` — read from view, new params
- `app/api/admin/recipients/route.ts` — accept new params

Kept (deprecated, remove after `/api/admin/members` ships):
- `app/api/admin/contacts/route.ts` — can delete once page switches over

## Out of scope (YAGNI)

- Manual tier/VIP tagging (all derived).
- Persisting status/tier as columns on a `members` table.
- Materialized view (unless performance requires).
- Multi-select bulk actions on members page.
- A/B campaign tooling, automated drip sequences.
- Award-voter and visitor email sources (can be added to the view later without API changes).

## Open questions

- **Pending-to-abandoned threshold** — proposed 7 days; confirm with business before shipping.
- **Score weights** — current numbers are a reasonable first cut; should be tunable (centralized in `lib/members.ts` or a DB config row) but first version ships as constants.

## Testing

No test framework in the repo. Manual verification:

1. Seed a few orders across all statuses/tiers in dev.
2. Visit `/admin/members` — verify badges, filters, chip counts sum to total.
3. On `/admin/send`, click each preset — verify recipient count matches SQL spot-check.
4. Confirm `paid` members with multiple `backer` orders land in tier `S`.
