# Admin Member Details Page — Design

**Date**: 2026-04-16
**Branch**: `feature/admin-member-details`
**Goal**: Make `/admin/members` rows clickable; clicking opens a detail page that shows *everything* the system knows about a single member — as exhaustively as possible.

## Scope

- Read-only detail page + basic operations (send one-off email, unsubscribe newsletter, resend order confirmation, open Stripe link, export JSON).
- Introduce a real `members` table so every member has a stable, human-readable number (`M00042`).
- Admin auth only (`getAdminSession`); no sub-roles.

**Out of scope**: member notes / tags / blacklist, editing customer data, precise per-recipient tracking for `notification_logs`, writing email into `tracking_events`.

## Data Layer

### New table `members`

```sql
CREATE TABLE members (
  id BIGSERIAL PRIMARY KEY,
  member_no TEXT GENERATED ALWAYS AS ('M' || LPAD(id::text, 5, '0')) STORED UNIQUE,
  email TEXT NOT NULL UNIQUE,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_members_email_lower ON members (LOWER(email));
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE members FORCE ROW LEVEL SECURITY;
```

- `member_no` is auto-generated from `id` (`M` + 5-digit zero-pad; naturally grows past 5 digits when id ≥ 100000).
- Emails stored as lowercased-trimmed; enforced in the `upsert_member()` function below.

### Backfill (runs in same migration)

Insert every email seen in the system so far, ordered by its earliest appearance, so older members get smaller numbers:

```sql
INSERT INTO members (email, first_seen_at)
SELECT email, MIN(seen_at)
FROM (
  SELECT lower(trim(customer_email)) AS email, created_at AS seen_at
    FROM orders WHERE customer_email IS NOT NULL AND trim(customer_email) <> ''
  UNION ALL
  SELECT lower(trim(email)), created_at FROM newsletter_subscriptions
    WHERE email IS NOT NULL AND trim(email) <> ''
  UNION ALL
  SELECT lower(trim(to_email)), created_at FROM email_logs
    WHERE to_email IS NOT NULL AND trim(to_email) <> ''
) t
GROUP BY email
ORDER BY MIN(seen_at) ASC
ON CONFLICT (email) DO NOTHING;
```

### Auto-insert triggers

A shared `public.upsert_member(p_email text)` function does a lowercased-trimmed `INSERT ... ON CONFLICT DO NOTHING`. Three `BEFORE INSERT` triggers call it:

- `orders.customer_email`
- `newsletter_subscriptions.email`
- `email_logs.to_email`

Each trigger skips nulls / empty strings. This guarantees any new email anywhere in the system gets a member row without application-layer changes.

### View update — `members_enriched`

Replace the view (`CREATE OR REPLACE VIEW`) to `LEFT JOIN members m ON m.email = e.email` and expose:

- `m.id AS member_id`
- `m.member_no`
- `m.first_seen_at`

All existing columns preserved.

### TypeScript

`lib/members.ts` — extend `EnrichedMember`:

```ts
member_id: number;
member_no: string;
first_seen_at: string;
```

## API Routes

All routes under `/app/api/admin/members/[memberNo]/...`; all gated by `getAdminSession`.

### Resolver helper
`lib/adminMembers.ts` — `resolveMember(slug: string): Promise<{ member, email } | null>`:
- If slug matches `/^M\d+$/` → look up by `member_no`
- Else → `decodeURIComponent`, lowercase+trim → look up by `email`
- Returns the `members` row + canonical email, or `null`.

### `GET /api/admin/members/[memberNo]`

Aggregates everything; single round-trip. Response shape:

```ts
{
  member: { member_no, email, first_seen_at, id },
  enriched: EnrichedMember,
  orders: Order[],                  // all statuses, newest first
  newsletter: NewsletterSubRow | null,
  email_logs: EmailLog[],           // newest first
  notification_campaigns: {         // loose match against recipient_groups/tiers
    id, subject, created_at, recipient_count, status
  }[],
  award_votes: AwardVote[],
  visitors: Visitor[],              // distinct fingerprints joined via orders/newsletter visitor_id
  tracking_events: {                // last 50 events tied to any of the above visitor_ids
    event_name, occurred_at, parameters
  }[]
}
```

### `POST /api/admin/members/[memberNo]/unsubscribe`
Delete rows in `newsletter_subscriptions` where `LOWER(email) = email`. Returns `{ removed: n }`.

### `POST /api/admin/members/[memberNo]/resend-confirmation`
Body: `{ orderId: string }`. Validates the order belongs to this member and is `status='paid'`. Reuses existing order confirmation email path (find where `webhooks/stripe` sends confirmation, factor into reusable `sendOrderConfirmation(order)` if not already). Writes a new `email_logs` row.

### `GET /api/admin/members/[memberNo]/export`
Same payload as the GET endpoint but `Content-Disposition: attachment; filename="member-{member_no}-{YYYYMMDD}.json"`.

### Reuse: `POST /api/email/send`
The one-off "send email" modal in the UI calls the existing endpoint — no new endpoint needed. The admin session on that route already enforces authorization.

### Errors

- **401** — no admin session
- **404** — `resolveMember` returns null
- **400** — malformed slug / body
- **500** — DB or Mailgun failure; logged with `console.error('[Admin Member Detail]', ...)`; Mailgun error messages are forwarded to the frontend (admin-only, detailed errors are desirable)

## UI

### Route
`/admin/members/[memberNo]` — accepts `M00042` or URL-encoded email.

### List page change
- New leftmost column: `編號` showing `member_no`
- Each `<tr>` becomes a clickable row linking to the detail page

### Detail page layout (single scrollable page)

```
┌─────────────────────────────────────────────────────────┐
│ ← 回會員列表                                             │
│ M00042  [status badge] [tier badge]  score: 87         │
│ alice@example.com                                       │
│ [寄信] [取消訂閱] [匯出 JSON]                            │
├─────────────────────────────────────────────────────────┤
│ KPI cards: 總消費 | 訂單數 | 訂閱狀態 | 最近互動         │
├─────────────────────────────────────────────────────────┤
│ § Identity & Contact (name, phone, address, source, etc)│
│ § Orders (table, per-row actions: 重寄確認信 / Stripe)  │
│ § Email History (email_logs + matched notification_logs)│
│ § Award Votes                                           │
│ § Device & Visitor (distinct fingerprints table)        │
│ § Tracking Events (last 50)                             │
│ § Raw JSON (<details> collapsed by default)             │
└─────────────────────────────────────────────────────────┘
```

Tailwind only, matches existing admin look (`bg-white rounded-xl shadow-sm` cards).

### Interactions

- **寄信 modal** — subject + body textarea; on submit POST `/api/email/send`; success toast + prepend row to Email History in local state.
- **取消訂閱** — `confirm()` then POST `.../unsubscribe`; on success update newsletter badge and KPI card.
- **重寄確認信** — per-order button → `confirm()` → POST `.../resend-confirmation` → toast.
- **匯出 JSON** — plain `<a href>` download link.

### States
- Initial: full-page skeleton placeholders per section.
- On error from GET: inline error card with retry button.
- 404: empty state "查無此會員 M00042" with link back to list.

## Security / PII Notes
- All routes `getAdminSession`-gated. Service role key stays server-side.
- Detailed Mailgun errors visible to admin — intentional, admin-only.
- No RLS policies added (service role bypasses anyway, consistent with siblings).
- Export JSON contains PII (phone, address, IP). Admin responsibility. No extra gating.

## Testing
No test framework configured in the repo. Verification is manual:
1. Migration runs cleanly on a fresh DB (docker supabase).
2. Backfill assigns `M00001` to the earliest email.
3. Inserting a new order with a fresh email auto-creates a `members` row.
4. GET endpoint returns all sections for a seeded member.
5. Each of 5 operations works end-to-end in the browser, at least once per action.
6. Unauthorized requests return 401.
7. 404 path works with both bogus `Mxxxxx` and bogus email slug.

Screenshots for the review go to `.screenshots/2026-04-16/`.

## Files Touched / Created

**New**:
- `supabase/migrations/create_members_table.sql` — table + backfill + trigger function + 3 triggers
- `supabase/migrations/update_members_enriched_with_member_no.sql` — view replacement
- `lib/adminMembers.ts` — `resolveMember` helper
- `app/api/admin/members/[memberNo]/route.ts` — GET aggregate
- `app/api/admin/members/[memberNo]/unsubscribe/route.ts`
- `app/api/admin/members/[memberNo]/resend-confirmation/route.ts`
- `app/api/admin/members/[memberNo]/export/route.ts`
- `app/admin/members/[memberNo]/page.tsx` — detail page
- `app/admin/members/[memberNo]/SendEmailModal.tsx` — modal component
- `docs/superpowers/specs/2026-04-16-admin-member-details-design.md` (this doc)

**Modified**:
- `lib/members.ts` — add new fields to `EnrichedMember`
- `app/admin/members/page.tsx` — add `編號` column, make rows link
- Possibly: factor out `sendOrderConfirmation(order)` from `app/api/webhooks/stripe/route.ts` if not already reusable

## Risks & Open Questions
- **Trigger performance** — `upsert_member()` adds a single `INSERT ... ON CONFLICT DO NOTHING` per insert on 3 tables. Negligible but worth noting.
- **Race on backfill vs. live writes** — migration should run during low traffic; if a new email gets inserted mid-backfill it'll get a high number (fine).
- **Order confirmation email source of truth** — need to verify where current confirmation is sent (likely in Stripe webhook). If the logic isn't cleanly extractable, the resend endpoint has to duplicate a small amount of code; acceptable.
