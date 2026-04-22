# Stay Weekly Booking Export — Design

**Date:** 2026-04-23
**Author:** Claude + kkshyu
**Status:** Approved, pending implementation plan

## Problem

The accommodation vendor needs a weekly list of confirmed guests so they can prepare rooms and collect on-site payment from non-complimentary guests. Today the admin has no way to hand this off — `/admin/stay/bookings` shows all bookings across all weeks, mixed together and in a UI table, not a file the vendor can consume.

## Goal

Per-week CSV download from the admin stay overview. One click on a week row → CSV that can be forwarded directly to the vendor.

## Non-goals

- Scheduled auto-send to vendor (manual download only for now)
- Multi-week combined export
- XLSX or any format other than CSV
- Vendor-facing portal / shared link
- Exporting historical `no_show` / `cancelled` / `completed` data — this is an operational hand-off list, not an audit trail

## UI

On `/admin/stay` (overview page), the existing per-week table gains a rightmost "操作" column with a single button: **匯出名單**.

- Rendered as `<a href="/api/admin/stay/weeks/{id}/export" download>` — native browser download, no JS fetch needed.
- Style: reuse the cyan button class pattern already on the page (e.g. `px-3 py-1 text-xs bg-cyan-500 hover:bg-cyan-600 text-white rounded`).
- No other pages change. `/admin/stay/weeks` (config editing) and `/admin/stay/bookings` (individual booking management) are unaffected.

## API

**New route:** `app/api/admin/stay/weeks/[id]/export/route.ts`

- Method: `GET`
- Auth: `getAdminSession(req)` — returns 401 JSON if absent (matches existing export routes)
- Param: `id` — stay_weeks.id (BIGSERIAL). Parse as integer; non-integer → 404.
- Lookup: if no matching `stay_weeks` row, return 404 JSON.

**Query:**

```
stay_booking_weeks
  select *, stay_bookings(*), stay_weeks(code, starts_on, ends_on)
  where week_id = :id
  and status in ('confirmed', 'modified_in', 'pending_transfer')
  order by stay_bookings(created_at) asc
```

Result set size is bounded by `stay_weeks.room_capacity` (single/low-double digits). Sort the rows in JS by `stay_bookings.created_at` after the fetch — simpler than PostgREST's order-across-relation syntax and the list is tiny.

**Response:**

- 200 with `text/csv; charset=utf-8`
- `Content-Disposition: attachment; filename="stay-{week.code}-{YYYY-MM-DD}.csv"` (ASCII-safe; avoids Chinese-in-header quirks). `YYYY-MM-DD` is today's date (when the export was run), so multiple same-day exports overwrite and cross-day exports archive naturally.
- Body: UTF-8 BOM (`﻿`) + CRLF-joined lines (matches existing pattern for Excel compatibility)

**Error cases:**

- Auth fail → 401 JSON `{ error: 'Unauthorized' }`
- `supabaseServer` null → 500 JSON `{ error: 'db' }`
- Invalid / non-integer `id` → 404 JSON `{ error: 'not_found' }`
- Supabase query error → 500 JSON `{ error: error.message }` (same pattern as existing `/api/admin/stay/bookings`)
- Zero matching bookings → 200, CSV with header row only (explicit "empty" signal for the vendor)

## CSV columns

All headers in Chinese. 8 columns:

| # | Header | Source | Notes |
|---|---|---|---|
| 1 | 入住日 | `stay_weeks.starts_on` | YYYY-MM-DD |
| 2 | 退房日 | `stay_weeks.ends_on` | YYYY-MM-DD |
| 3 | 訂房編號 | `stay_bookings.id.slice(0,8)` | 8-char prefix for vendor cross-reference |
| 4 | 類型 | `stay_bookings.booking_type` | `guaranteed` → `保證訂房`, `complimentary` → `免費招待` |
| 5 | 主住客姓名 | `stay_bookings.primary_guest_name` | |
| 6 | 電話 | `stay_bookings.primary_guest_phone` | |
| 7 | Email | `stay_bookings.primary_guest_email` | |
| 8 | 備註 | `stay_bookings.internal_notes` | May be empty |

Explicitly **omitted** (with reasons, for future reference):

- `guest_count`, `second_guest_name` — currently single-room only; always `1` / empty. Add back when 2-person rooms are offered.
- `booked_price_twd` — vendor collects on-site using a separate price reference; not needed per-row.
- `booking.status`, `booking_weeks.status` — filtered upstream by the query; redundant.

## Shared helper

Extract `csvEscape(value)` to a new `lib/csv.ts`:

```ts
export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}
```

Update callers to import from there instead of keeping private copies:

- `app/api/admin/orders/export/route.ts`
- `app/api/admin/members/export/route.ts`
- `app/api/admin/subscribers/export/route.ts`
- New: `app/api/admin/stay/weeks/[id]/export/route.ts`

(Note: `app/api/admin/members/[memberNo]/export/route.ts` exports JSON, not CSV, so it is untouched.)

This is the only refactor bundled into the change; it's tightly scoped (4 files, one helper) and removes duplication directly in the path of new code.

## Data volume

`stay_weeks.room_capacity` is small (single-digit or low-double-digit). Per-week bookings are bounded by capacity. No pagination needed — a single Supabase query returns the full set.

## Testing

- Unit: `lib/csv.ts` — quote/escape behaviour for commas, quotes, newlines, null/undefined.
- Manual: after deploy, on `/admin/stay`, click 匯出名單 for an active week, open in Excel, verify columns, BOM (no mojibake on Chinese), and that inactive-status bookings are excluded.
- Playwright: public-route constraint — skip automated E2E on this admin flow per project CLAUDE.md (authenticated admin routes require `dev-signin` wiring); hand off to user's Chrome for live verification.

## Rollout

Single PR. No migrations, no flags, no backfill. Internal-only feature behind admin auth.
