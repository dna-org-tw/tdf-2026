# Admin Members CSV Export

Date: 2026-04-21

## Goal

Add a "匯出 CSV" button to `/admin/members` that downloads the current filtered member list as a CSV, matching the existing export UX on `/admin/subscribers` and `/admin/orders`.

## Non-goals

- No new filters or query parameters beyond what the list page already supports.
- No Excel (.xlsx) export. CSV only.
- No background job / emailed export. Request is handled synchronously like the other two exports.
- No changes to `members_enriched` view or underlying schema.

## User-facing behavior

- Button in the filter toolbar on `/admin/members`, right of the stat line, same teal style (`bg-[#10B8D9]`) and copy ("匯出 CSV") as `/admin/subscribers` and `/admin/orders`.
- `href` is built from the current filter state: `search`, `identity`, `displayStatus`, `repeat`.
- Clicking downloads `members-YYYY-MM-DD.csv` (UTF-8 with BOM so Excel opens it cleanly).
- Row order matches the list view: `score` desc, then `last_interaction_at` desc (nulls last).

## API

### New route: `GET /api/admin/members/export`

Auth: `getAdminSession(req)` — 401 if missing. Same gate as other admin routes.

Query params (all optional, identical semantics to `/api/admin/members`):
- `search` — ilike match on `email` or `name`
- `identity` — CSV list of `backer|contributor|explorer|follower`, mapped to `highest_ticket_tier` values via `ticketTierToIdentity` inverse
- `displayStatus` — CSV list of `completed|pending|abandoned|not_started`, mapped via `DISPLAY_STATUS_TO_DB`
- `repeat=1` — `paid_order_count > 1`

Pagination: fetch from `members_enriched` in 1000-row windows until exhausted (same pattern as subscribers/orders export).

Response: `text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="members-YYYY-MM-DD.csv"`, `Cache-Control: no-store`.

### Shared query module: `lib/adminMembersQuery.ts`

To prevent filter drift between list and export, extract the filter-resolution + query-builder currently inlined in `app/api/admin/members/route.ts` into a shared module:

```ts
export interface MemberFilter {
  search?: string;
  identities?: MemberIdentity[];
  displayStatuses?: DisplayStatus[];
  statuses?: MemberStatus[];     // raw, optional
  tiers?: MemberTier[];          // raw, optional
  ticketTiers?: TicketTier[];    // raw, optional
  repeatOnly?: boolean;
}

export function parseMemberFilter(searchParams: URLSearchParams): MemberFilter;
export function applyMemberFilter<T>(
  query: PostgrestFilterBuilder<T>,
  filter: MemberFilter
): PostgrestFilterBuilder<T>;
```

`parseMemberFilter` reuses `parseList` with the existing allow-lists (`MEMBER_IDENTITIES`, `DISPLAY_STATUSES`, etc.).

`applyMemberFilter` contains the OR-clause logic currently inside `buildFiltered` (search, resolved statuses, identity→ticket-tier mapping with `includeNullTier` handling, repeat-only).

Both the list route and the export route call these helpers. The list route continues to compute its own summary counts — those are not shared.

## CSV format

UTF-8 with leading BOM, `\r\n` line endings, `csvEscape` helper copied from the existing export routes.

### Columns (in order)

| Column | Source | Notes |
|---|---|---|
| `member_no` | `member_no` | |
| `name` | `name` | nullable → empty |
| `email` | `email` | |
| `phone` | `phone` | nullable → empty |
| `identity` | `ticketTierToIdentity(highest_ticket_tier)` | English key: backer/contributor/explorer/follower |
| `display_status` | `memberStatusToDisplay(status)` | English key: completed/pending/abandoned/not_started |
| `tier` | `tier` | S/A/B/C |
| `paid_order_count` | `paid_order_count` | integer |
| `total_spent` | `total_spent_cents / 100` | fixed to 2 decimals, e.g. `1234.00` |
| `currency` | `currency` | |
| `score` | `score` | integer |
| `subscribed_newsletter` | `subscribed_newsletter` | `TRUE`/`FALSE` |
| `first_seen_at` | `first_seen_at` | ISO 8601 as stored |
| `last_interaction_at` | `last_interaction_at` | ISO 8601 or empty |
| `last_order_at` | `last_order_at` | ISO 8601 or empty |
| `earliest_valid_from` | `earliest_valid_from` | ISO 8601 or empty |
| `latest_valid_until` | `latest_valid_until` | ISO 8601 or empty |

English keys (not Chinese labels) for `identity` / `display_status` / `tier` because downstream sheets / mail-merge tools handle ASCII more reliably and the enum values are stable across locales.

## UI change

`app/admin/members/page.tsx`, inside the filter toolbar (around the "共 X 位會員" span), append:

```tsx
<a
  href={`/api/admin/members/export?${new URLSearchParams({
    ...(search ? { search } : {}),
    ...(identities.length ? { identity: identities.join(',') } : {}),
    ...(displayStatuses.length ? { displayStatus: displayStatuses.join(',') } : {}),
    ...(repeatOnly ? { repeat: '1' } : {}),
  }).toString()}`}
  className="px-4 py-2 text-sm font-medium text-white bg-[#10B8D9] rounded-lg hover:bg-[#0EA5C4] transition-colors whitespace-nowrap"
  title="以目前篩選條件匯出 CSV"
>
  匯出 CSV
</a>
```

## Error handling

- 401 if no admin session.
- 500 with `{ error: 'Database not configured' }` if `supabaseServer` is null (matches other routes).
- 500 with `{ error: 'Failed to export members' }` on Supabase error; log `[Admin Members Export]` with the error.

## Testing

Manual verification (matches the admin CLAUDE.md workflow):
1. `npm run lint` and `tsc --noEmit` clean.
2. Dev-signin to `/admin/members` with `kk@dna.org.tw`, click 匯出 CSV with no filters — confirm file downloads with all members and `TRUE/FALSE`, amounts, dates look correct.
3. Apply each filter in turn (search, identity chip, displayStatus chip, repeat toggle) and confirm exported row count matches the list's "共 X 位會員".
4. Open CSV in Excel (Mac) — confirm BOM makes Chinese characters render correctly.

No automated E2E — exports are admin-only and the pattern is already covered by eyeball testing of subscribers/orders exports.

## Rollback

Pure additive change. Rollback = revert the commit; no schema or data changes.
