# Admin Batch Email Notification System

## Overview

Management team dashboard for sending batch notification emails to members and subscribers. Accessible to `@dna.org.tw` email accounts via the existing auth system.

## Authentication & Authorization

- Reuse existing verification code login flow (`/api/auth/send-code` → `/api/auth/verify-code`)
- Admin gate: middleware checks that the authenticated user's email ends with `@dna.org.tw`
- Environment variable `ADMIN_EMAIL_DOMAIN=dna.org.tw` for configurability
- All `/admin/*` pages and `/api/admin/*` routes require this check

## Pages

### `/admin` — Dashboard (History)

- Lists past batch sends in reverse chronological order
- Each entry shows: subject, recipient groups, recipient count, sent by, date, status
- Links to `/admin/send` to compose a new notification

### `/admin/send` — Compose & Send

- **Recipient selection**:
  - Checkbox group: "Paid members" (from `orders` table, `status = 'paid'`) and/or "Newsletter subscribers" (from `subscriptions` table)
  - When "Paid members" is selected, optional tier filter: explore, contribute, weekly_backer, backer (multi-select)
- **Email content**:
  - Subject (text input)
  - Body (textarea, plain text)
- **Preview panel**:
  - Shows recipient count (fetched live as filters change)
  - Renders email preview using the brand HTML template
- **Send flow**:
  - "Preview & Send" button → confirmation dialog showing recipient count and subject
  - Confirm to send; button disabled during sending; success/error feedback

## API Routes

### `GET /api/admin/recipients`

- Query params: `groups` (comma-separated: `orders`, `subscribers`), `tiers` (comma-separated, optional)
- Returns: `{ count: number, emails: string[] }`
- Deduplicates emails across groups
- Auth required: JWT session + `@dna.org.tw` domain

### `POST /api/admin/send`

- Body: `{ subject, body, groups, tiers }`
- Fetches recipient list (same logic as GET recipients)
- Sends via Mailgun Batch Sending API (max 1,000 per call, loops if more)
- Logs to `notification_logs` table
- Rate limit: max 1 batch send per minute
- Auth required: JWT session + `@dna.org.tw` domain
- Returns: `{ success: boolean, recipientCount: number, notificationId: string }`

### `GET /api/admin/history`

- Returns list of `notification_logs` entries, ordered by `created_at DESC`
- Auth required: JWT session + `@dna.org.tw` domain

## Database

### New table: `notification_logs`

```sql
CREATE TABLE notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  recipient_groups JSONB NOT NULL,    -- e.g. ["orders", "subscribers"]
  recipient_tiers JSONB,              -- e.g. ["explore", "backer"] or null
  recipient_count INTEGER NOT NULL,
  sent_by TEXT NOT NULL,              -- admin email
  status TEXT NOT NULL DEFAULT 'sending', -- sending | sent | partial_failure
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_logs_created_at ON notification_logs (created_at DESC);
CREATE INDEX idx_notification_logs_sent_by ON notification_logs (sent_by);
```

RLS enabled, service role only (consistent with existing tables).

## Email Template

- Reuses existing brand style: `#10B8D9` primary color, TDF 2026 header
- Plain text body converted to HTML: newlines → `<br>`, wrapped in brand template
- Both HTML and plain text versions sent
- From address: configured via `EMAIL_FROM` env var

## Security

- All admin routes verify JWT session + `@dna.org.tw` email domain
- Rate limit on send endpoint: 1 request per minute per admin
- Confirmation dialog before sending (client-side)
- No public access to recipient email lists

## i18n

- Admin dashboard is Chinese-only (internal tool for `@dna.org.tw` team)
- Notification email content is written by the admin (no auto-translation)

## Out of Scope

- Rich text / Markdown editor
- Email scheduling (send later)
- Per-recipient delivery tracking (use Mailgun dashboard)
- Template management (single fixed brand template)
- Admin user management UI
