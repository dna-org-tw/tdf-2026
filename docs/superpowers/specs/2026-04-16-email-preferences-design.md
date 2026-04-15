# Email Preferences on Member Page — Design

**Date:** 2026-04-16
**Status:** Draft for review

## Goal

Give logged-in members a UI on `/member` to choose which categories of email they receive, replacing the all-or-nothing `unsubscribed_at` flag with category-level granularity. Compliance/account/transactional emails remain mandatory and are not user-controllable.

## Email Inventory and Categorization

Audit found 9 outbound email types. They are partitioned into two groups:

### Mandatory (no toggle, always delivered)

| Email type | Trigger |
|---|---|
| `magic_link` (link variant) | `app/api/auth/magic-link/route.ts` |
| `magic_link` (6-digit code) | `app/api/auth/send-code/route.ts` |
| `unsubscribe_confirmation` | `app/api/newsletter/unsubscribe/route.ts` |
| `order_success` | Stripe webhook + admin resend |
| `order_cancelled` | `lib/sendOrderEmail.ts` |
| `vote_confirmation` | `app/api/award/vote/route.ts` (immediate confirmation, treated as transactional) |
| `admin_one_off` | `app/api/admin/members/[memberNo]/send-email/route.ts` (direct site-to-member contact) |

These bypass both the suppression list and the new preference flags.

### User-controllable (3 categories)

| Category key | UI label (zh / en) | Covers |
|---|---|---|
| `pref_newsletter` | 節慶電子報 / Festival Newsletter | `subscription_thank_you`, broadcasts categorized as `newsletter` |
| `pref_events` | 活動與議程更新 / Event & Schedule Updates | broadcasts categorized as `events` |
| `pref_award` | Nomad Award 與社群活動 / Nomad Award & Community | broadcasts categorized as `award` |

All three default to `true` for both new subscribers and existing rows (per Q4 = A).

## Data Model

Add three boolean columns to `newsletter_subscriptions`:

```sql
ALTER TABLE newsletter_subscriptions
  ADD COLUMN pref_newsletter boolean NOT NULL DEFAULT true,
  ADD COLUMN pref_events     boolean NOT NULL DEFAULT true,
  ADD COLUMN pref_award      boolean NOT NULL DEFAULT true;
```

The `unsubscribed_at` column is preserved as the global hard kill-switch (covers any future category not yet listed). The send-time predicate is:

```
unsubscribed_at IS NULL
  AND pref_<category> = true
  AND email NOT IN email_suppressions
```

### Members without a `newsletter_subscriptions` row

Some members exist only in `orders` (paid customer who never explicitly subscribed). For them, broadcasts have historically been sent without any opt-in record. New behavior:

- The member-page UI treats "no row" as "all three prefs = true" for display purposes.
- Saving any preference change **creates** a row with `email`, `source = 'member_preferences'`, `unsubscribed_at = NULL`, and the chosen flags. This brings them into the standard preference system and gives them a consistent path to opt out later.
- Send-time filter uses `LEFT JOIN newsletter_subscriptions ns ON ns.email = e.email` and `WHERE COALESCE(ns.pref_<cat>, true) = true AND COALESCE(ns.unsubscribed_at, NULL) IS NULL`. Customers with no row continue to receive broadcasts (matches current behavior; YAGNI).

## Admin Broadcast Flow Changes

`app/api/admin/send/route.ts` and the admin send UI gain a **required category** field with three options matching the user-controllable categories above (`newsletter`, `events`, `award`). The category is:

1. Submitted by admin in the send form (radio or select).
2. Validated by the API route.
3. Passed into `getRecipients()` so the SQL filter applies the matching `pref_*` column.
4. Stored on the resulting `email_logs` rows in `metadata.category` for auditing.

Default category in the admin form: `newsletter`.

`subscription_thank_you` does not pass through this flow. It is sent directly per-subscription. When the homepage subscribe endpoint reactivates a row (clears `unsubscribed_at`), it **also resets all three `pref_*` flags to `true`** — explicit re-subscription is treated as "give me everything again". The thank-you email then sends unconditionally as part of that flow.

## Member Page UI

In `app/member/page.tsx`, add a new section "Email Preferences / 電子報訂閱偏好" beneath the existing order/profile content (logged-in only).

### Layout

```
┌─ Email Preferences ──────────────────────────────────┐
│ Manage which emails you receive at <user@email>.     │
│                                                       │
│  [✓] Festival Newsletter                              │
│      General announcements about TDF 2026.            │
│                                                       │
│  [✓] Event & Schedule Updates                         │
│      Session changes, check-in info, on-site updates. │
│                                                       │
│  [✓] Nomad Award & Community                          │
│      Award contest news and community activities.     │
│                                                       │
│  ──────────────────────────────                       │
│  [Save preferences]   [Unsubscribe from all]          │
│                                                       │
│  Important account and order emails are always sent.  │
└──────────────────────────────────────────────────────┘
```

- Three checkboxes, initialized from API.
- "Unsubscribe from all" sets `unsubscribed_at = now()` (matching existing unsubscribe semantics) and disables the three checkboxes.
- A single Save button posts all three values (idempotent).
- Successful save shows an inline confirmation toast/banner; no navigation.
- Footer note clarifies the mandatory-email caveat.

Bilingual copy lives in `data/content.ts` under a new `memberPreferences` namespace.

## API Surface

Two new endpoints under `app/api/member/preferences/`:

### `GET /api/member/preferences`
- Auth: requires existing `useAuth` session (member login).
- Returns:
  ```json
  {
    "email": "user@example.com",
    "unsubscribed": false,
    "preferences": {
      "newsletter": true,
      "events": true,
      "award": true
    },
    "hasSubscriptionRow": false
  }
  ```
- If no row exists: returns the three flags as `true`, `unsubscribed: false`, `hasSubscriptionRow: false`.

### `PATCH /api/member/preferences`
- Auth: requires session; the email being modified must equal the session email (server reads from session, not body).
- Body:
  ```json
  {
    "preferences": { "newsletter": true, "events": false, "award": true },
    "unsubscribeAll": false
  }
  ```
- If `unsubscribeAll === true`: sets `unsubscribed_at = now()`, ignores `preferences`.
- Else: clears `unsubscribed_at`, upserts the row with the three booleans.
- Upsert key: `email`. If row absent, create with `source = 'member_preferences'`.
- Returns the same shape as GET.

Both endpoints normalize email with `lower(trim(...))` before query.

## Send-Time Enforcement

Update `lib/recipients.ts`:

1. Add an optional `category: 'newsletter' | 'events' | 'award'` to `RecipientsQuery`.
2. When a category is supplied, switch from the current `members_enriched` view query to one that LEFT JOINs `newsletter_subscriptions` and applies:
   ```
   COALESCE(ns.unsubscribed_at, NULL) IS NULL
   AND COALESCE(ns.pref_<category>, true) = true
   ```
3. The existing `suppressed = false` filter still applies.

The `members_enriched` view itself does **not** need new columns — the join happens in the query layer to keep the view stable. (If we later find we need preference data in the view for other reports, we can extend it then; YAGNI for now.)

`lib/email.ts`'s `sendSubscriptionThankYouEmail` adds a precheck: skip if the row exists with `pref_newsletter = false`.

## Migration Plan

Single SQL migration:
1. Add three columns with defaults.
2. Backfill is automatic (DEFAULT applies to existing rows).

No data migration script required.

## Out of Scope

- Per-language preferences (subscriber language is already stored separately).
- Frequency controls (daily/weekly digest).
- Granular sub-categories within the three buckets.
- A standalone preferences page accessible without login (the `/newsletter/unsubscribe` page remains as the email-link route; future work could redirect logged-in users there to `/member`).

## Testing

No test framework is configured in the repo, so verification is manual:

- Subscribe → verify three columns default to true.
- Toggle off `pref_events` in member UI → admin send with category=`events` excludes the address; category=`newsletter` still includes it.
- Click "Unsubscribe from all" → `unsubscribed_at` set; all three categories filtered out.
- Re-toggling any pref ON via member UI clears `unsubscribed_at`.
- Paid customer with no newsletter row → member UI shows three checkboxes ON; saving creates row.
- Mandatory emails (order_success, magic_link) continue delivering regardless of preferences and suppression.
