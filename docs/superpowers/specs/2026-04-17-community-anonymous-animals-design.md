# Community Section — Anonymous Animal Members

**Date:** 2026-04-17
**Status:** Approved
**Scope:** Homepage `CommunitySection` enhancement

## Problem

The homepage Community section currently shows only members who have opted into the public directory (`member_profiles.is_public = true`). This underrepresents the real community — most people on the email list, ticket holders, and past attendees never set up a public profile, so they're invisible.

We want to visually communicate "the community is bigger than what you see here" without exposing private identities.

## Solution

Append a row of **anonymous animal avatars** after the public member cards, followed by a numeric badge showing how many more private members exist. Inspired by Google Drive's anonymous animal system.

### Display Layout

```
┌─────────────────────────────────────────────────────┐
│  [Public member cards × up to 12]                    │
│                                                      │
│  [🦥] [🦦] [🦙] [🦥] [🦩] [🦔]   +523 more          │
└─────────────────────────────────────────────────────┘
```

- Public cards: unchanged — same `MemberBadge` component, sorted by profile richness
- Anonymous animals: fixed 6 avatars, same 64×64 circular dimensions as public cards
- `+N more` badge: text badge showing `anonymousCount - 6` if `> 0`
- If `anonymousCount === 0`: hide the entire anonymous row
- If `anonymousCount <= 6`: show actual count of animals, no trailing badge

### Sort Order (Public Members)

Current API uses `.order('member_id', desc)`. Change to a proxy-quality sort (favorites/views come later):

1. `avatar_url IS NOT NULL` first
2. `bio IS NOT NULL` next
3. `member_id DESC` (newest first as tiebreaker)

Supabase JS client doesn't compose multi-column ordering easily for mixed NULL-based conditions, so we'll sort client-side in the API route after fetching (the directory page fetches one page at a time, but the homepage only needs the first 12, so client-side sorting the fetched page is correct for homepage and acceptable for the directory page).

## Components

### `lib/anonymousAnimals.ts` (new)

- Array of 30 animals: `{ name: string, emoji: string }` (e.g., Axolotl 🦎, Capybara, Quokka, Fennec Fox 🦊, Pika, Tapir…)
- Helper `pickRandomAnimals(n: number): Animal[]` — random unique sample; called per render
- No persistence, no per-member correspondence — purely decorative

### `/api/members` route (extend)

- Add `total_members` count: `SELECT count FROM members` (full table count)
- Compute `anonymousCount = total_members - totalPublicCount`
  - `totalPublicCount` = count from the existing `member_profiles is_public=true` query
- Response shape adds: `anonymousCount: number`
- Apply new sort order after fetch (JS sort)

### `components/sections/CommunitySection.tsx` (extend)

- Read `anonymousCount` from `/api/members` response
- Render anonymous row after existing public member grid:
  - Use `pickRandomAnimals(Math.min(6, anonymousCount))`
  - Each avatar: circular `bg-white/5` background, emoji centered, `title="Anonymous {name}"`, not clickable
  - Trailing `+N` badge when `anonymousCount > 6`
- i18n labels: add `anonymousLabel` (for `aria-label` context) and `moreMembers(n)` formatter

## Data Model

No database changes. Uses existing tables:
- `members` — auto-populated from orders, newsletter_subscriptions, email_logs (every email we have)
- `member_profiles` — opt-in public cards

## Privacy

- API never returns identifying data (name, email, member_no) for non-public members
- `anonymousCount` is a raw number; cannot be reversed to identify anyone
- Animals are random per render — no stable mapping to real people

## Non-Goals

- Favorites/bookmarks on profiles — separate feature, future work
- Profile view counting — separate feature, future work
- Stable animal-per-person mapping — not needed for decorative intent
- Pagination of anonymous members — they're aggregated into one count

## Testing

Manual verification only (no test framework configured):
1. Load `/` → confirm 6 animals render under public cards
2. Confirm `+N more` matches `total_members - public_count - 6`
3. Confirm animals are not clickable, hover shows animal name
4. Confirm responsive layout on mobile (animals wrap naturally in existing `flex flex-wrap`)
