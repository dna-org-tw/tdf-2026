# Stay Invite Code Email — Design Spec

**Date:** 2026-04-19
**Owner:** kk@dna.org.tw
**Scope:** Admin can email a generated `stay_invite_codes.code` to a specified recipient from `/admin/stay/invite-codes`.

## Goals

- Let an admin pick any `active` invite code from the list and send it to one email address.
- Track the most recent recipient on the row so the admin can see what was already delivered.
- Re-send is allowed (overwrites the recipient fields).
- Reuse the existing Mailgun + `email_logs` infrastructure (`lib/stayEmail.ts`).

## Non-goals

- No multi-send / batch-email-to-list. One row → one recipient at a time.
- No binding of a code to an email (code remains usable by anyone who types it; matches existing `/api/stay/invite-code/validate` behavior).
- No full send-history audit table. The single `sent_to_email/sent_at/sent_by` snapshot is enough; if future needs require history, add `stay_invite_code_sends`.
- No language toggle in admin UI. Email is always bilingual (zh-TW + English).

## Architecture

### 1. Schema migration

New migration: `supabase/migrations/<timestamp>_add_stay_invite_code_send_fields.sql`

```sql
ALTER TABLE stay_invite_codes
  ADD COLUMN sent_to_email TEXT,
  ADD COLUMN sent_at TIMESTAMPTZ,
  ADD COLUMN sent_by TEXT;
```

No index needed — admin list already returns ≤ 500 rows.

### 2. Email helper

**Update** `lib/stayEmail.ts`: extend `StayEmailType` union with `'stay_invite_code'`.

**New file** `lib/stayInviteEmail.ts`:

```ts
export async function sendStayInviteEmail(input: { to: string; code: string }): Promise<void>
```

Responsibilities:
- Build bilingual subject + html + text.
  - Subject: `[TDF 2026] Your Stay Booking Invite Code / 您的住宿預約邀請碼`
  - Body (single email, zh-TW block on top, English block below, separated by `<hr>`):
    - Greeting + 1-line context (TDF 2026 stay booking).
    - Code rendered in a monospace box.
    - CTA button + plain-text fallback URL: `${NEXT_PUBLIC_SITE_URL}/stay?invite=<urlencoded code>`.
    - Note that the code can also be pasted manually on `/stay`.
- Delegate sending to `sendStayEmail({ to, subject, html, text, emailType: 'stay_invite_code' })` so logging stays consistent.

### 3. API route

**New file** `app/api/admin/stay/invite-codes/[id]/send/route.ts`

```
POST /api/admin/stay/invite-codes/:id/send
Body: { email: string }
```

Flow:
1. `getAdminSession(req)` → 401 if no session.
2. Validate `email` with a simple regex (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`); 400 on fail.
3. `supabaseServer.from('stay_invite_codes').select('id, code, status').eq('id', params.id).maybeSingle()`.
   - 404 if not found, 409 if `status !== 'active'`.
4. Call `sendStayInviteEmail({ to: email, code: row.code })`.
   - On thrown error → 502 with `{ error: 'send_failed' }` and do NOT update DB.
5. On success, update the row:
   ```ts
   .update({ sent_to_email: email, sent_at: new Date().toISOString(), sent_by: session.email })
   ```
6. Return `{ code: <updated row> }`.

No rate-limiting (admin-gated, low volume).

### 4. Stay page — read `?invite=` param

**Edit** `components/stay/StayBookingPanel.tsx`:

- Import `useSearchParams` from `next/navigation`.
- Initialize `inviteCode` state from `searchParams.get('invite') ?? ''`.
- This is a one-time initial value; user typing afterwards behaves exactly as today.

No new state, no extra useEffect needed if we initialize via lazy initial state. Keep the change to a couple of lines.

### 5. Admin UI — `/admin/stay/invite-codes`

**Edit** `app/admin/stay/invite-codes/page.tsx`:

- Extend `InviteCode` interface with `sent_to_email | null`, `sent_at | null`, `sent_by | null`.
- Add a new rightmost column `寄送`:
  - For `status === 'active'`:
    - If `sent_to_email` is null → button `寄送`.
    - Else → small line `已寄至 {sent_to_email} · {short date}` + button `重寄`.
  - For other statuses → render `—`.
- Click button → toggle inline form for that row (state keyed by row id):
  - Email `<input type="email">` + `送出` / `取消` buttons.
  - On submit → `POST /api/admin/stay/invite-codes/<id>/send` with `{ email }`.
  - While in flight → disable submit; on success → close form, call existing `load()`, show green message at top (`已寄出邀請碼至 {email}`); on error → red message inline.
- Pre-fill the email input on `重寄` with the existing `sent_to_email`.

UI stays in the same single-page admin view — no modal library needed.

## Data flow

```
admin clicks 寄送
   ↓
POST /api/admin/stay/invite-codes/:id/send  { email }
   ↓
verify admin session
   ↓
load row, ensure status = active
   ↓
sendStayInviteEmail()  →  Mailgun  →  email_logs (sent)
   ↓ (on Mailgun success)
UPDATE stay_invite_codes SET sent_to_email, sent_at, sent_by
   ↓
return updated row
   ↓
admin page reloads list, badge updates
```

If Mailgun fails: row is **not** updated, admin sees error and can retry.

## Error handling

| Case | Response |
|------|----------|
| No admin session | 401 |
| Bad email format | 400 `{ error: 'invalid_email' }` |
| Code id not found | 404 `{ error: 'not_found' }` |
| Code not active | 409 `{ error: 'not_active' }` |
| Mailgun config missing | 500 `{ error: 'mailgun_not_configured' }` (thrown by helper) |
| Mailgun call fails | 502 `{ error: 'send_failed' }` + email_logs `failed` row |
| DB update fails after send | 500; flag in response so admin knows email went out but state didn't persist |

## Testing

- Manual: in dev with `MAILGUN_API_KEY`/`MAILGUN_DOMAIN` set, send to `kk@dna.org.tw`, verify both inbox content and that the row in `stay_invite_codes` updates.
- E2E: not added in this iteration (admin route requires the `dev-signin` flow; the existing admin pages have no E2E either).
- TypeScript + ESLint must pass.

## Files touched

- `supabase/migrations/<timestamp>_add_stay_invite_code_send_fields.sql` — new
- `lib/stayEmail.ts` — extend union
- `lib/stayInviteEmail.ts` — new
- `app/api/admin/stay/invite-codes/[id]/send/route.ts` — new
- `app/admin/stay/invite-codes/page.tsx` — UI additions
- `components/stay/StayBookingPanel.tsx` — read `?invite=` from URL

## Out of scope (deferred)

- Binding a code to a specific email at validate time.
- Multi-recipient batch send.
- Full send-history table.
- Language toggle in admin UI.
