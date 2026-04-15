# Luma Guest Sync — Design Spec

**Date:** 2026-04-16
**Owner:** Admin tooling
**Status:** Approved (brainstorm), pending implementation plan

## Goal

Pull Luma guest registration data for every event in the TDF 2026 calendar
(`https://luma.com/taiwandigitalfest`) into our database so that:

1. Each TDF member can see which Luma events they have applied for and the
   status of each application (pending / approved / waitlist / declined,
   paid, checked-in).
2. Admins can see the same information per member, plus a sync dashboard
   that shows job progress, history, and per-event results.
3. The sync runs automatically on a daily cron and can be triggered
   manually from the admin UI.

Luma does not provide an official public guest API for free calendars; we
authenticate by replaying a cookie copied from a logged-in admin's browser
session for the calendar's owner account.

## Non-Goals

- Cross-event guest search / activity export (deferred).
- Per-event admin overview page listing all guests of an event (deferred).
- Storing `registration_answers` (custom form fields) — privacy reasons.
- Real-time push from Luma — Luma has no webhook for this.
- Surfacing "you have applied" badges on the public Luma calendar widget.

## Constraints

- Deployment is Zeabur (long-running Node process). No serverless timeout.
- Calendar has ~100+ events; one `get-guests` call per event, each may
  paginate. Estimated wall-clock per full sync: 1–10 minutes.
- The Luma session cookie is high-sensitivity (equivalent to logging in
  as the calendar owner). Must be encrypted at rest.
- Cookie expires (typically weeks). When it expires, sync must fail loudly.
- Existing admin auth: `AdminGate` requires `@dna.org.tw` Supabase user.
- Members are keyed by lowercased email in the existing `members` table.

## Data Model

Five new tables, all in the public schema with RLS forced on (service-role
access only via `lib/supabaseServer.ts`).

### `luma_sync_config` — singleton

```
id                        smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1)
luma_session_cookie_enc   bytea          AES-256-GCM ciphertext
luma_session_cookie_iv    bytea          12-byte IV
luma_session_cookie_tag   bytea          16-byte auth tag
cookie_last4              text           plaintext last 4 chars for UI display
cookie_invalid            boolean        NOT NULL DEFAULT false
cron_enabled              boolean        NOT NULL DEFAULT false
cron_schedule             text           cron expression, default '0 19 * * *' (03:00 Asia/Taipei in UTC)
last_manual_run_at        timestamptz
updated_by                text           admin email
updated_at                timestamptz    NOT NULL DEFAULT now()
```

The encryption key lives in `LUMA_COOKIE_ENCRYPTION_KEY` (32-byte hex).
Key rotation is out of scope; if it's rotated, admins re-enter cookie.

### `luma_sync_jobs`

```
id                bigserial PRIMARY KEY
trigger           text NOT NULL CHECK (trigger IN ('manual','cron'))
status            text NOT NULL CHECK (status IN ('queued','running','succeeded','partial','failed'))
started_at        timestamptz
finished_at       timestamptz
total_events      integer NOT NULL DEFAULT 0
processed_events  integer NOT NULL DEFAULT 0
failed_events     integer NOT NULL DEFAULT 0
total_guests_upserted integer NOT NULL DEFAULT 0
error_summary     text
triggered_by      text                       admin email when manual; null for cron
created_at        timestamptz NOT NULL DEFAULT now()
```

Index: `(status, created_at DESC)` for the "current job" lookup and
`(created_at DESC)` for history.

### `luma_sync_event_results`

```
id              bigserial PRIMARY KEY
job_id          bigint NOT NULL REFERENCES luma_sync_jobs(id) ON DELETE CASCADE
event_api_id    text NOT NULL
event_name      text
status          text NOT NULL CHECK (status IN ('pending','running','done','failed'))
guests_count    integer NOT NULL DEFAULT 0
error_message   text
started_at      timestamptz
finished_at     timestamptz
UNIQUE (job_id, event_api_id)
```

Index: `(job_id, id)` for ordered progress display.

### `luma_events`

```
event_api_id    text PRIMARY KEY
name            text NOT NULL
start_at        timestamptz
end_at          timestamptz
url             text
cover_url       text
location_text   text
last_synced_at  timestamptz NOT NULL DEFAULT now()
```

Upserted from the calendar `get-items` response on every sync.

### `luma_guests`

```
id                bigserial PRIMARY KEY
event_api_id      text NOT NULL REFERENCES luma_events(event_api_id) ON DELETE CASCADE
email             text NOT NULL                                  -- lowercased, trimmed
member_id         bigint REFERENCES members(id) ON DELETE SET NULL
luma_guest_api_id text
activity_status   text                                           -- 'pending_approval' | 'approved' | 'declined' | 'waitlist' | 'invited' | other
paid              boolean NOT NULL DEFAULT false
checked_in_at     timestamptz
registered_at     timestamptz
ticket_type_name  text
amount_cents      integer
currency          text
last_synced_at    timestamptz NOT NULL DEFAULT now()
UNIQUE (event_api_id, email)
```

Indexes:
- `(member_id)` for the member-facing query
- `(email)` for the admin "find this email's events" lookup
- `(event_api_id)` covered by the unique constraint

`member_id` is populated via a BEFORE INSERT/UPDATE trigger that
upserts into `members` and links — same pattern as the existing
`ensure_member_from_email` trigger on orders/newsletter/email_logs.

### Stale / cancelled guests

Guests not seen in a successful sync are NOT deleted. The UI marks rows
where `last_synced_at < (latest successful job start - 1 day)` as
"可能已取消" (possibly cancelled). Hard-delete is a future decision.

## Execution Flow

### Worker model

Zeabur runs Next.js as a long-lived Node process, so the worker runs in
the same process as the request handlers. No queue infrastructure.

```
POST /api/admin/luma-sync/start
  1. Reject if there's a job with status IN ('queued','running').
  2. Reject if luma_sync_config.luma_session_cookie_enc is NULL.
  3. INSERT luma_sync_jobs (trigger='manual', status='queued',
                             triggered_by=current admin email).
  4. Return 202 { jobId }.
  5. setImmediate(() => runSyncJob(jobId)).  ← fire-and-forget
```

`runSyncJob(jobId)`:

1. `UPDATE jobs SET status='running', started_at=now()`.
2. Decrypt cookie. If decryption fails: mark job failed, return.
3. Fetch `https://api2.luma.com/calendar/get-items?calendar_api_id=cal-S2KwfjOEzcZl8E8&pagination_limit=100&period=all`
   with cookie + headers. Iterate pagination.
4. Upsert each entry into `luma_events`.
5. `UPDATE jobs SET total_events = N`. Insert one
   `luma_sync_event_results` row per event with status='pending'.
6. Loop events serially (no parallelism):
   - `UPDATE event_result SET status='running', started_at=now()`.
   - Fetch `https://api2.luma.com/event/admin/get-guests?event_api_id=...`
     with cookie. Follow `pagination_cursor` until exhausted.
   - Map each guest → `luma_guests` upsert (batch in chunks of 200).
   - `UPDATE event_result SET status='done', guests_count, finished_at`.
   - `UPDATE jobs SET processed_events = processed_events + 1,
                       total_guests_upserted += K`.
   - On HTTP error from Luma:
     - If 401/403: stop the whole job. Set
       `config.cookie_invalid=true`, send admin-alert email, mark job
       failed.
     - Otherwise: mark this event_result failed with error_message,
       increment job.failed_events, continue to next event.
   - Sleep 500ms between events to avoid Luma rate limiting.
7. Final job status:
   - All event_results done → `succeeded`.
   - Some failed, some done → `partial`.
   - All failed or fatal stop → `failed`.
8. `UPDATE jobs SET status, finished_at=now(), error_summary`.

### Cron path

```
POST /api/cron/luma-sync   (Authorization: Bearer ${CRON_SECRET})
  - Same logic as /start but trigger='cron', triggered_by=null.
  - Skips silently (200 noop) if a job is already running.
  - Skips if config.cron_enabled = false.
```

A Zeabur Cron service hits this endpoint on `cron_schedule` (default
03:00 Asia/Taipei = 19:00 UTC).

### Process-restart reconciliation

On Next.js server startup (in `instrumentation.ts` or first admin request),
run:

```
UPDATE luma_sync_jobs
   SET status='failed',
       error_summary='process_restarted',
       finished_at=now()
 WHERE status IN ('queued','running')
   AND COALESCE(started_at, created_at) < now() - interval '15 minutes'
```

This prevents stuck "running" jobs blocking new ones after a deploy.

## API Routes

All admin routes go through the existing `requireAdmin()` helper used by
the other `/api/admin/*` routes. The cron route uses bearer token.

```
POST   /api/admin/luma-sync/start
       → 202 { jobId } | 409 { error: 'job_in_progress' } | 400 { error: 'no_cookie' }

GET    /api/admin/luma-sync/jobs
       → { current: Job | null, recent: Job[] }   (recent = last 20)

GET    /api/admin/luma-sync/jobs/[id]
       → { job: Job, results: EventResult[] }     (for progress polling)

GET    /api/admin/luma-sync/config
       → { cookieLast4, cookieInvalid, cronEnabled, cronSchedule, lastManualRunAt }

PUT    /api/admin/luma-sync/config
       Body: { cookie?: string, cronEnabled?: boolean, cronSchedule?: string }
       → 200 { ok: true }
       Setting a new cookie clears cookie_invalid.

GET    /api/admin/members/[memberNo]/luma-registrations
       → { registrations: Registration[] }

POST   /api/cron/luma-sync   (Authorization: Bearer)
       → 200 { jobId } | 200 { skipped: 'in_progress'|'cron_disabled' } | 401

GET    /api/member/luma-registrations
       (Member auth via existing session)
       → { registrations: Registration[] }
```

`Registration` shape returned to UI:

```ts
{
  eventApiId: string;
  eventName: string;
  startAt: string | null;
  endAt: string | null;
  url: string | null;
  activityStatus: string | null;
  paid: boolean;
  checkedInAt: string | null;
  registeredAt: string | null;
  ticketTypeName: string | null;
  amountCents: number | null;
  currency: string | null;
  stale: boolean;   // last_synced_at older than latest job start - 1 day
}
```

## UI

### `/admin/luma-sync` (new page; add link to `AdminNav`)

Sections top to bottom:

1. **Cookie & cron settings card**
   - Shows `cookie_last4` ("…ABCD") with timestamp `updated_at`.
   - Red banner if `cookie_invalid=true`: "Cookie 已失效，請重新設定。"
   - "編輯 cookie" button → modal with textarea (paste raw `Cookie:` header
     value or just `luma.auth-session-key=…`); on save, PUT config.
   - Cron toggle switch (enabled/disabled).
   - Schedule field (text input with cron expression validation).
   - "上次手動執行" timestamp.

2. **Manual trigger**
   - Big button "立即同步".
   - Disabled with explanation when there's a current job or no cookie.

3. **Current job card** (only when a job is queued/running)
   - Progress bar `{processed_events} / {total_events}`.
   - "目前活動：{event_name}" — derived from latest `running` event_result.
   - Counters: 已完成 / 失敗 / 已寫入 guest 數.
   - Started_at + elapsed time.
   - Scrollable list of `event_results` with status icon, name, guest
     count, error message (if any).
   - Polls `/api/admin/luma-sync/jobs/{currentId}` every 2s.

4. **Recent jobs table** (last 10)
   - Columns: Trigger, Started, Duration, Status, Processed/Total,
     Failed, Guests upserted, Triggered by.
   - Click row → expands to show the same `event_results` list.

### `/admin/members/[memberNo]` (extend existing page)

Add a new section "Luma 活動報名" between existing sections (placement
TBD by writing-plans phase). Calls
`/api/admin/members/[memberNo]/luma-registrations`. Renders a card list
sorted by `registered_at DESC`:

- Event name (link to `url`)
- Start date
- Status badge (color-coded: 申請中 amber / 已核准 green / 候補 blue /
  已拒絕 grey / 未知 grey)
- 票種 + 金額 (if any)
- "已 check-in" pill if `checkedInAt` set
- Greyed-out + "可能已取消" pill if `stale=true`

### `/member` (extend existing page)

Same section title "我的活動報名", same card layout. Hidden when the
member has zero registrations.

## Security

- **Cookie storage:** AES-256-GCM via Node `crypto`. Key is
  `LUMA_COOKIE_ENCRYPTION_KEY` env var (32 bytes, hex). IV per record.
- **Cookie display:** only `cookie_last4` is ever sent to the browser.
- **Admin auth:** existing `AdminGate` + server-side `requireAdmin()` on
  all `/api/admin/luma-sync/*` routes.
- **Cron auth:** `Authorization: Bearer ${CRON_SECRET}`. Reject mismatches
  with 401.
- **Member auth:** `/api/member/luma-registrations` reads
  `members.email` from existing member session and only returns rows
  WHERE `luma_guests.member_id = current_member.id`.
- **Logging:** never log the cookie value, even on decryption failure.
  Log `[luma-sync]` prefix to make it greppable.

## Error Handling & Edge Cases

| Case | Behaviour |
| --- | --- |
| No cookie configured | `/start` returns 400; UI shows the cookie card prompting setup. |
| Cookie invalid (401/403) | Whole job fails; `config.cookie_invalid=true`; admin-alert email; UI red banner. |
| Cookie decryption failure | Job fails with error_summary='cookie_decrypt_failed'; admin alert. |
| Luma `get-items` 5xx / network error | Whole job fails; retry via cron next day or manual. |
| Per-event 5xx / network error | That event_result marked failed; loop continues; final job status='partial'. |
| Concurrent /start | 409 `job_in_progress`. |
| Process restart mid-job | Reconciler at startup marks the stuck job failed; new sync OK. |
| Member with zero Luma rows | Section hidden on member page; admin page shows "尚無 Luma 報名紀錄". |
| Email casing mismatch | All emails stored lowercased + trimmed; trigger uses same. |
| Guest with no email (rare on Luma) | Skip; do not insert. |

## Environment Variables

Add to `.env.local` documentation:

```
LUMA_COOKIE_ENCRYPTION_KEY   # 32-byte hex (run: openssl rand -hex 32)
CRON_SECRET                  # bearer token for /api/cron/luma-sync
ADMIN_ALERT_EMAIL            # where cookie-expired alerts go
```

## Migration Plan

Single migration `supabase/migrations/zzz_add_luma_sync.sql` that
creates the five tables, indexes, and the
`ensure_member_from_luma_guest` trigger. Naming uses the existing
`zzz_*` ordering convention.

## Open Questions Resolved in Brainstorm

- Sync scope: all events in calendar (every run).
- Stored fields: precise (status, paid, check-in, registered_at,
  ticket_type, amount). No registration_answers.
- Execution: background job + polling progress.
- Cookie: stored encrypted + cron, with alert on expiry.
- Member view: new section on `/member`.
- Admin view: per-member detail section + dedicated sync dashboard.
  No event-level overview, no global guest search.

## Out of Scope / Future Work

- Per-event admin overview (`/admin/luma-events`).
- Cross-event guest search.
- Storing registration_answers behind an explicit privacy review.
- Hard-delete of stale guests after retention window.
- Webhook ingestion if Luma adds it.
- Cookie key rotation tooling.
