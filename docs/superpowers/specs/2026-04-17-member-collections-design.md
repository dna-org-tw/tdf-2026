# Member Card Collections (收藏名片)

**Date:** 2026-04-17
**Status:** Approved
**Scope:** New `/me/collections` page, collection actions on `/members/[memberNo]`, QR exchange flow for private cards.

## Problem

The member directory (`/members`) and individual member cards (`/members/[memberNo]`) are read-only. There's no way for a logged-in member to bookmark someone they find interesting online, nor to exchange cards with someone they meet at the festival. Private-card holders are currently invisible outside their own `/me` page, so in-person exchange is impossible.

## Goals

1. A logged-in member can **collect** another member's card from the directory (public cards) or via on-site QR exchange (private cards).
2. A logged-in member can view **who they've collected** and **who has collected them**.
3. Each party knows who holds their card — passive notification via an in-app unread badge, no email.
4. QR exchange for private cards expires within minutes so a stolen screenshot can't silently collect the owner later.

## Non-Goals

- Notes, tags, or folders on collected cards (not a CRM)
- Email notifications (passive in-app only)
- Sharing/exporting collection lists
- Mutual accept flow (collecting is one-directional; the collector's identity is revealed to the collected person as a side-effect)
- Stable public "contact list" — collections are private to each side

## Data Model

### New table: `member_collections`

```sql
CREATE TABLE member_collections (
  id                       BIGSERIAL PRIMARY KEY,
  collector_member_id      BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  collected_member_id      BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  source                   TEXT NOT NULL CHECK (source IN ('public', 'qr')),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (collector_member_id, collected_member_id),
  CHECK (collector_member_id <> collected_member_id)
);

CREATE INDEX idx_member_collections_collector
  ON member_collections(collector_member_id, created_at DESC);
CREATE INDEX idx_member_collections_collected
  ON member_collections(collected_member_id, created_at DESC);

ALTER TABLE member_collections ENABLE ROW LEVEL SECURITY;
```

- `source` records whether the collection happened from a public card browse (`public`) or on-site QR exchange (`qr`). Useful for future analytics.
- `UNIQUE` enforces idempotency; `CHECK` prevents self-collection.
- `ON DELETE CASCADE` cleans up if a member is removed.

### Extend `member_profiles`

```sql
ALTER TABLE member_profiles
  ADD COLUMN IF NOT EXISTS collections_last_viewed_at TIMESTAMPTZ;
```

- Used to compute the unread badge count: `COUNT(member_collections WHERE collected_member_id = me AND created_at > last_viewed_at)`
- `NULL` means "never viewed" → every incoming collection is unread.
- Members without a `member_profiles` row (never set up profile) don't get a badge; we lazily insert a row when they first visit `/me/collections`.

### No changes required

- `members` table
- `members_enriched` view
- Existing `member_profiles` columns

## QR Token Mechanism

Private cards can only be collected by someone who has a fresh token issued by the owner. We use a stateless signed JWT rather than a DB nonce table — the 5-minute TTL is short enough that revocation isn't needed.

- **Secret:** new env var `MEMBER_QR_SECRET` (distinct from `AUTH_SECRET`; documented in `.env.example`).
- **Algorithm:** HS256 via the existing `jose` dependency.
- **Payload:** `{ member_no: string, exp: number }` (exp = now + 300s).
- **Issuance:** `POST /api/member/qr-token` (authed) returns `{ token, expiresAt }`.
- **QR payload:** `https://{origin}/members/{member_no}?t={jwt}`.
- **Verification:** `POST /api/member/collections` and `GET /api/members/[memberNo]?t=...` verify signature, expiry, and that `payload.member_no` matches the target.

## API Endpoints

All endpoints require an authenticated session except `GET /api/members/[memberNo]` (still public, with optional token).

### `POST /api/member/qr-token`
Returns a fresh JWT for the caller's own member_no.
- Response: `{ token: string, expiresAt: string /* ISO */ }`
- 401 if not authed
- 404 if caller has no `member_no` (shouldn't happen for logged-in users)

### `GET /api/member/collections`
Returns the caller's collection lists plus unread badge count.
- Response:
  ```ts
  {
    collected: CollectionEntry[];    // people I've collected, newest first
    collectors: CollectionEntry[];    // people who collected me, newest first
    unreadCount: number;              // collectors since last_viewed_at
  }
  ```
- `CollectionEntry` shape: `{ member_no, display_name, avatar_url, bio, location, tags, tier, collected_at, source, is_unread? }`
- `is_unread` only set on the `collectors` side.

### `POST /api/member/collections`
Body: `{ member_no: string, token?: string }`
- If target's `member_profiles.is_public = true` → accept directly (`source='public'`).
- Else → require `token`; verify JWT and match against `member_no`; on success `source='qr'`.
- Self-collection (`collector === collected`): 400.
- Duplicate: idempotent — return existing row as 200.
- Rate limit: 60 POSTs/hour per collector (`member_collections_post:{member_id}` via existing `check_rate_limit` RPC).
- Returns: `{ ok: true, collection: CollectionEntry }`.

### `DELETE /api/member/collections/[memberNo]`
Removes the caller's collection of the given member_no. Idempotent (404 if not found, but UI treats as success).

### `POST /api/member/collections/mark-viewed`
Updates `member_profiles.collections_last_viewed_at = now()` for caller. Lazily inserts a profile row if missing. No body. Returns `{ ok: true }`.

### Extend `GET /api/members/[memberNo]`
Add optional `?t=<jwt>` query parameter.
- Current behaviour: only returns public profiles; 404 otherwise.
- New: if `?t` is present and validates to this `member_no`, return the profile even when `is_public=false`.
- The response shape is identical; callers don't need to distinguish.

## UI

### `/me` additions

**Entry link to collections** — inserted between `UpcomingEvents` and the Orders collapsible:
- Row with icon + label "名片收藏 / Card collections" + unread badge (red dot + count, hidden when 0) + right chevron.
- Clicking navigates to `/me/collections`.
- Fetches `unreadCount` from `GET /api/member/collections` on mount (alongside other `/me` fetches).

**"Show my QR" button** — a new small button on the `MemberPassport` component (next to existing edit controls, or directly below the card).
- Opens a modal with:
  - Large QR code (SVG via `qrcode` npm package) encoding the full URL
  - Countdown timer "5:00" that ticks down
  - Helper text: "請對方掃描此 QR 收藏你的名片 / Have them scan this to collect your card"
  - Auto re-fetches a fresh token when the timer hits zero.
- QR content is identical for public and private cards — the token is always included, so the URL works either way.

### `/me/collections` (new page)

Two stacked sections on a max-w-2xl column (matches `/me` width):

1. **我收藏的名片 / My collections** (`collected` list)
   - Count in title: "我收藏的 (N)"
   - Each entry: compact card re-using `MemberCardItem` styling from `/members/page.tsx`, plus a small "移除" button on hover/tap-hold that triggers `DELETE`. Confirm via a browser `confirm()` with i18n'd string.
   - Empty state: "還沒有收藏任何名片。逛逛 /members 或在現場掃描 QR 收藏別人吧！"

2. **收藏我的人 / Who collected me** (`collectors` list)
   - Count in title: "收藏我的 (N)"
   - New entries (`is_unread=true`) rendered with a subtle blue left border.
   - No remove button (can't remove someone from their own list).
   - Empty state: "還沒有人收藏你的名片。"

**On page mount:** fire `POST /api/member/collections/mark-viewed` after the list renders so the `/me` badge clears on next visit. Local UI still keeps the `is_unread` highlight for this session.

### `/members/[memberNo]` additions

New "收藏名片 / Collect card" button below the `MemberPassport` on the public profile page.

- **Not logged in:** button label becomes "登入以收藏 / Log in to collect", clicking redirects to `/me`.
- **Logged in + viewing public card:** direct POST on click. Button becomes disabled "已收藏 / Collected" after success.
- **Logged in + viewing private card via `?t=`:** same direct POST, but include `token` from URL in body. If token expired, show inline error "QR 已過期，請請對方重新產生 / QR expired — please ask them to regenerate".
- **Viewing private card without token:** current 404 behaviour unchanged (API still refuses).
- Below button, small helper text: "收藏後 {顯示名稱 / 會員編號} 可看見你的名片 / After collecting, {name} can see your card."

## i18n

New key block in `data/content.ts`:

```ts
collections: {
  entryLabel: 'Card collections' / '名片收藏',
  pageTitleCollected: 'My collections' / '我收藏的',
  pageTitleCollectors: 'Who collected me' / '收藏我的',
  emptyCollected: '...',
  emptyCollectors: '...',
  remove: 'Remove' / '移除',
  removeConfirm: 'Remove this card from your collection?' / '確定要從收藏移除這張名片嗎？',
  collect: 'Collect card' / '收藏名片',
  collected: 'Collected' / '已收藏',
  loginToCollect: 'Log in to collect' / '登入以收藏',
  qrShow: 'Show my QR' / '顯示我的 QR',
  qrHelper: 'Have them scan this to collect your card' / '請對方掃描此 QR 收藏你的名片',
  qrExpiresIn: 'Expires in {mm}:{ss}' / '{mm}:{ss} 後過期',
  qrExpired: 'QR expired. Please ask them to regenerate.' / 'QR 已過期，請請對方重新產生',
  privacyHint: 'After collecting, {name} can see your card.' / '收藏後 {name} 可看見你的名片。',
  newBadge: 'New' / '新',
}
```

## Privacy & Security

- **Collector identity reveal:** collecting is an explicit action that shares the collector's card with the collected person. We display a privacy hint on the collect button. The collector's own profile data (public OR private) becomes visible to the collected person in their "collectors" list.
- **Private card tokens:** 5-min TTL; never logged in server logs; signed with a dedicated secret.
- **Rate limiting:** 60 collects per hour per collector prevents scraping.
- **RLS:** `member_collections` enabled with no policies (service-role-only, matching the rest of the project).
- **Deletion:** `ON DELETE CASCADE` from `members` ensures orphaned rows can't leak data.

## Components to Create / Modify

### New
- `supabase/migrations/zzzzzzz_create_member_collections.sql` — table + alter column + indexes
- `lib/memberCollections.ts` — helpers: `issueQrToken`, `verifyQrToken`, `fetchCollectionsForMember`, `createCollection`, `removeCollection`, `markCollectionsViewed`
- `app/api/member/qr-token/route.ts`
- `app/api/member/collections/route.ts` (GET, POST)
- `app/api/member/collections/[memberNo]/route.ts` (DELETE)
- `app/api/member/collections/mark-viewed/route.ts` (POST)
- `app/me/collections/page.tsx`
- `components/member/CollectionList.tsx` — shared list item component
- `components/member/QrShareModal.tsx` — QR modal with countdown
- `components/member/CollectButton.tsx` — used on `/members/[memberNo]`

### Modified
- `app/api/members/[memberNo]/route.ts` — accept `?t=<jwt>`
- `app/me/page.tsx` — add entry link with unread badge; QR button inside MemberPassport area
- `app/members/[memberNo]/page.tsx` — render `<CollectButton>` below passport
- `data/content.ts` — i18n strings
- `.env.example` — document `MEMBER_QR_SECRET`
- `package.json` — add `qrcode` + `@types/qrcode`

## Testing

Manual verification only (no test framework configured):

1. **Happy-path public collect:** Log in as A, visit `/members/<B-public>`, click Collect → appears in A's `/me/collections` "collected" list; B sees A in "collectors" list with unread badge.
2. **Happy-path QR:** As B (private card), open `/me` → Show QR → on a second device as A, visit the QR URL → Collect succeeds.
3. **Expired token:** Wait 6 minutes, try to collect → error shown.
4. **Tampered token:** Edit the `?t=` string → server returns 401.
5. **Self-collect:** API rejects with 400.
6. **Duplicate collect:** Second POST returns 200 with existing row, UI unchanged.
7. **Remove:** Click Remove → confirm → row disappears from both A's "collected" and B's "collectors".
8. **Unread badge:** Fresh collect shows dot on A's `/me`; opening `/me/collections` clears the dot on next `/me` load.
9. **Not logged in:** Collect button routes to `/me`.
10. **Private card without token:** `/members/<B-private>` still 404s.

Screenshots saved under `.screenshots/2026-04-17/` per project convention.
