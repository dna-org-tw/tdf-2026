# Critical Notification Category — Design

**Date:** 2026-04-19
**Status:** Draft for review

## Goal

Add a fourth notification category — **重大通知 (critical)** — to the admin batch-email tool (`/admin/send`). Unlike the existing three categories (`newsletter`, `events`, `award`), `critical` bypasses both per-category preferences and the global unsubscribe flag. It is reserved for履約/法律必要通知 (performance-of-service or legally required communications) and is gated behind visible UI warnings plus a mandatory filter to prevent blast sends.

## Scope of "重大通知"

Defined jointly with the admin user as:

- 活動重大變更（日期、地點）
- 會員權益重大變更（違規、退款）
- 簽證、安全等重要事項

These are communications that the festival is obligated to deliver because the recipient is directly affected (purchased a ticket, submitted a visa profile, enrolled in a guided tour, etc.). They are NOT marketing, newsletters, or optional updates.

## Delivery Policy

| Exclusion reason | `newsletter`/`events`/`award` | `critical` |
|---|---|---|
| `hard_bounced_at IS NOT NULL` | skip | **skip** |
| `unsubscribed_at IS NOT NULL` | skip | send |
| `pref_<category> = false` | skip | send (category has no pref column) |

`critical` continues to respect `hard_bounced_at` because undeliverable addresses stay undeliverable regardless of intent.

## Data Model

### 1. `newsletter_subscriptions`

No new column. There is no user-facing preference for `critical`, so nothing to store per user.

### 2. `notification_logs`

Add `category TEXT` column (nullable for backward compatibility with existing rows). New sends write the category. This closes an existing gap: today `category` is accepted by `/api/admin/send` and used for filtering, but never persisted.

```sql
ALTER TABLE notification_logs
  ADD COLUMN IF NOT EXISTS category TEXT;

COMMENT ON COLUMN notification_logs.category IS
  'One of: newsletter, events, award, critical. NULL for legacy rows sent before category tracking.';
```

No CHECK constraint: application layer validates the enum and DB stays flexible if categories evolve.

## Server Changes

### `lib/recipients.ts` (`getRecipients`)

Extend the `category` type to include `'critical'`. When `category === 'critical'`:

- Do not join `newsletter_subscriptions` for preference filtering
- Do not exclude rows where `unsubscribed_at IS NOT NULL`
- Continue to exclude `hard_bounced_at IS NOT NULL`

Existing non-critical branches are unchanged.

### `app/api/admin/send/route.ts`

- Extend `VALID_CATEGORIES` to `['newsletter', 'events', 'award', 'critical']`
- When `category === 'critical'`, require at least one of `statuses | memberTiers | ticketTiers` (reject blank-filter sends even if `groups` contains `'subscribers'`). `testOnly` / `groups: ['test']` remains allowed for self-preview.
- Persist `category` into `notification_logs` insert payload.
- No rate-limit change (existing 1/min per admin applies).

### `app/api/admin/recipients/route.ts`

- Extend `VALID_CATEGORIES` to include `'critical'`.
- Same filter-required rule when `category === 'critical'` (reject request with no identity/status/tier filter, return `{ error }`).

### `lib/emailCompliance.ts` — footer variant

Existing infrastructure already supports `includeUnsubscribe: false` (used by `order_success`, `order_transfer`, `unsubscribe_confirmation`). For `critical` broadcasts:

1. Extend `ComplianceFooterOptions` with `criticalNotice?: boolean`. When true:
   - Force `includeUnsubscribe = false` (no `Unsubscribe` link in HTML or text).
   - Prepend a new copy block above the existing "This is an automated email…" line:
     ```
     此為 TDF 2026 履約必要通知（重大變更／權益異動／安全），無法取消訂閱。
     有任何疑問請聯絡 <CUSTOMER_SUPPORT_EMAIL>。
     ```
   - `<CUSTOMER_SUPPORT_EMAIL>` resolves from `process.env.CUSTOMER_SUPPORT_EMAIL`, falling back to `info@dna.org.tw`. Add this env var to `.env.production.local` during rollout.
2. Same block is applied to both `buildComplianceFooterHtml` and `buildComplianceFooterText`.

### `lib/notificationEmail.ts` — threading the category

Thread `category` through `enqueueEmails` and `processAllPending` so per-recipient footer rendering knows whether to pass `criticalNotice: true`. No new column on `email_logs` — the existing `email_logs.notification_id → notification_logs.id` FK plus the new `notification_logs.category` column is enough for the worker to recover category (pass it in memory during the send, and re-derive via the FK for any retry path).

### Mail headers (`buildMailgunComplianceOptions`)

For `critical`, do **not** pass `unsubscribeEmail`. This omits `List-Unsubscribe` / `List-Unsubscribe-Post` headers, so Gmail/Yahoo clients won't surface their built-in one-click unsubscribe button for these messages. Trade-off: omitting these headers weakens deliverability under bulk-sender rules. Acceptable because (a) critical volume is low, (b) recipients have a direct contractual relationship with TDF that justifies the mail. Flag this in release notes so ops is aware.

## Admin UI Changes (`app/admin/send/page.tsx`)

### Category radio

Add a fourth option after `award`:

> ⚠️ **重大通知（無法退訂）**

Visually distinct (red text / red border when selected) to signal danger.

### Warning block

When `category === 'critical'`, render a persistent red-bordered panel above the recipient filter block:

- Headline: 「重大通知模式」
- Copy: 用途限重大變更、權益異動、簽證安全等履約必要事項；將忽略收件人的分類偏好與退訂設定；信件底部不會附退訂連結；發送紀錄會特別標記供稽核
- No dismiss button (always visible while category is selected)

### Submit button gating

`canSubmit` currently requires subject + body + at least one of (testOnly | displayStatuses | memberTiers | identities). For `critical`, tighten to require **at least one of displayStatuses | memberTiers | identities** (testOnly still allowed on its own for self-test). This is the "no empty filter" guard.

### Confirmation modal

The existing confirm modal adds an extra checkbox when `category === 'critical'`:

> ☐ 我確認此通知符合重大通知定義（重大變更／權益異動／簽證安全）

The "確認發送" button stays disabled until the checkbox is ticked. No free-text challenge — we agreed warning is enough.

### Preview pane

Replace the unsubscribe footer placeholder with the critical-mode footer text so the admin sees exactly what recipients will receive.

## Recipient-Facing Copy

### Unsubscribe page (`app/newsletter/unsubscribe/page.tsx`)

On the success state, add a small muted line under the existing `successNote`:

> 極少數與您權益直接相關的重大通知（例如活動取消、簽證或安全事項）仍會寄出。

Add translations in `data/content.ts` (`t.unsubscribe.criticalNote`, both `en` and `zh`).

### Admin history (`app/admin/history/page.tsx`)

In the list, rows where `category = 'critical'` get a red badge「重大通知」next to the subject. No other UI change needed — existing filters and detail view work once the column is persisted.

## Backwards Compatibility

- Existing `notification_logs` rows without `category` render without a badge in history. No backfill needed.
- Existing non-critical sends keep current behaviour (filters unchanged).
- Existing unsubscribed users start receiving `critical`-category broadcasts the moment this ships. That is the intended policy change; the unsubscribe page copy communicates it upfront.

## Testing

- Unit: `getRecipients` returns the same candidate set with and without `pref_*` preferences when `category='critical'`; returns same set with and without `unsubscribed_at`; still excludes `hard_bounced_at`.
- API: `/api/admin/send` rejects `category='critical'` without identity/status/tier filters (400).
- API: non-critical sends unchanged (regression).
- E2E (admin, gated by `/api/auth/dev-signin`): select 重大通知 → warning panel appears → attempt send without filter → button disabled → pick one filter → confirm modal shows extra checkbox → send succeeds → history row shows red badge.
- Manual: send a critical test to `kk@dna.org.tw` (only allowed test account per `feedback_prod_test_account.md`), verify footer has no unsubscribe link and includes customer-support email.

## Out of Scope

- Role-based gating beyond `@dna.org.tw` (explicitly decided against — "過度設計").
- Second-person approval flow (explicitly decided against).
- Subject-line auto-prefixing (admin writes the subject; no system rewriting).
- New `pref_critical` column or member-facing toggle (no preference exists to store).
- Changes to transactional emails (`order_success`, `magic_link`, etc.) — those already bypass preferences via a separate code path in `lib/notificationEmail.ts`.
