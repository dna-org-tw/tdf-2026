# Member Passport — Merge QR Share & Collections Entry

**Date:** 2026-04-17
**Status:** Approved

## Context

The `/me` page currently renders two separate "chunks" for card-collection related actions:

1. **`MemberPassport` (hero identity card)** — contains a static QR of `/members/{memberNo}` that is shown only when `profile.isPublic === true`. This QR links to the user's public profile page.
2. **A standalone row below the passport** (`app/me/page.tsx:469-496`) — two controls:
   - A `Link` to `/me/collections` with an unread badge (from `/api/member/collections`).
   - A "Show my QR" button that opens `QrShareModal` — this modal fetches a **time-limited token** via `/api/member/qr-token` and renders `/members/{memberNo}?t={token}` as a QR, with a countdown and regenerate action. This is the QR other members scan to **collect** the card; the token authorizes the view regardless of `isPublic`.

The two QRs are semantically different. The static `publicUrl` QR is a "here is my profile link" convenience; the tokenized QR is the actual share-to-be-collected mechanism.

The task is to fold both auxiliary actions (the collections link and the QR share) **into** the passport card, and replace the less-useful static QR with the tokenized one.

## Goals

- Single, clear "share me to be collected" surface on the member page.
- Collections entry (with unread badge) remains reachable from the passport.
- Follower-tier members (no paid ticket) still benefit, as long as they have a `memberNo`.

## Non-Goals

- No change to `/me/collections` page itself.
- No API changes. `/api/member/qr-token` and `/api/member/collections` stay as they are.
- No change to the public-member page at `/members/{memberNo}` or the `?t=` token-aware fetch logic.
- No change to the `isPublic` toggle semantics (it still gates whether `/members/{memberNo}` is browsable without a token).

## Design

### New component: `components/member/MemberQrPanel.tsx`

A self-contained presentational + stateful component that owns the token QR UX. It is extracted from `QrShareModal.tsx` so the passport can embed it without the passport taking on the modal's logic.

Responsibilities:
- On mount (or when `memberNo` changes), `POST /api/member/qr-token` to fetch `{ token, expiresAt }`.
- Render the QR (`qrcode.react` → `/members/{memberNo}?t={token}`, size 160, level "M").
- Tick every second to show `qrExpiresIn` countdown as `{mm}:{ss}`, or `qrExpired` message once the token elapses.
- Auto-refetch when the token expires.
- Expose a "Regenerate" text link that manually refetches.
- Loading state: rounded skeleton matching the QR footprint.
- Error state: inline retry affordance.

Props:
```ts
{
  memberNo: string;
  lang: 'en' | 'zh';
  accent: string;        // from tier palette, used for links/accents
  labels: {
    qrHelper: string;
    qrExpiresIn: string; // contains "{mm}" and "{ss}"
    qrExpired: string;
    qrRegenerate: string;
  };
}
```

Styling: dark-card-friendly. White background container around the QR (same as the current static QR container). Countdown/helper/regenerate use `text-white/55` ~ `text-white/70`; the regenerate link uses `accent` on hover.

### Changes to `components/member/MemberPassport.tsx`

1. **Remove** the current static QR block (lines 862-878), which is gated on `publicUrl && profile?.isPublic`.
2. **Render `<MemberQrPanel />`** in its place, gated on `memberNo` being present. No `isPublic` check.
3. **Add a footer "My Collections" row** below the QR panel, also gated on `memberNo`. Layout:
   - Inline text link: "我的收藏 / My Collection" + `→` arrow.
   - Red unread badge (existing `bg-red-500 text-white` style) when `collectionsUnread > 0`, min-width 20px, rounded-full, `text-[10px]`.
   - Styled to sit inside the dark card: `text-white/65 hover:text-white/90`.
4. **Extend `PassportProps`**:
   ```ts
   collectionsUnread?: number;
   qrLabels?: { qrHelper; qrExpiresIn; qrExpired; qrRegenerate };
   collectionsLabel?: string;
   ```
   All optional so existing callers (e.g. the public `/members/{memberNo}` page) keep working without forcing them to pass QR labels. The QR panel and collections link render only when `memberNo` exists **and** the respective labels are provided.

### Changes to `app/me/page.tsx`

1. Remove the dynamic import of `QrShareModal` (line 20).
2. Remove `qrOpen` state (line 240).
3. Remove the entire card-collections-entry row (lines 469-496).
4. Remove the `<QrShareModal …>` render at lines 719-733.
5. Keep the `/api/member/collections` fetch — still needed to populate the badge.
6. Pass the new props to `<MemberPassport>`:
   - `collectionsUnread={collectionsUnread}`
   - `qrLabels={{ qrHelper, qrExpiresIn, qrExpired, qrRegenerate }}` pulled from `t.collections`
   - `collectionsLabel={t.collections.entryLabel}`

### Deletion

- `components/member/QrShareModal.tsx` — no longer used. Delete.
- The `t.collections.qrTitle` and `t.collections.qrShow` strings are no longer referenced from any UI after this change. Keep the strings (harmless) or remove them — decision at implementation time based on whether any other consumer is grep-confirmed to use them.

## Behaviour matrix

| Condition                                       | Existing                                       | After change                                                |
| ----------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------- |
| Logged-in, has `memberNo`, `isPublic=true`      | Static profile QR in card; entry row below     | Tokenized share QR in card; collections link at card bottom |
| Logged-in, has `memberNo`, `isPublic=false`     | **No** QR in card; entry row below             | Tokenized share QR in card; collections link at card bottom |
| Logged-in, no `memberNo` (rare edge case)       | No QR; entry row hidden                        | No QR; collections link hidden                              |
| Viewing someone else's `/members/{memberNo}`    | Passport rendered non-editable, no QR          | Passport still rendered; no QR (labels not passed)          |

## Testing

- Manual smoke test (`npm run dev`) with account `kk@dna.org.tw`:
  - Identity card shows the tokenized QR with countdown ticking.
  - Regenerate link fetches a fresh token without reloading the page.
  - Scanning the QR lands on `/members/{memberNo}?t=…` and the profile renders.
  - Flip `isPublic` off — the QR is still shown (behaviour change, intentional).
  - Unread badge appears next to "My Collection" when there are unread cards.
  - Clicking the collections link navigates to `/me/collections`.
- `npm run lint` passes.
- `npm run build` passes.
- Screenshots saved to `.screenshots/2026-04-17/` before/after.

## Risks / Follow-ups

- The tokenized QR now triggers a `POST /api/member/qr-token` on every `/me` load (previously only when the modal was opened). Ensure the endpoint's cost is negligible — it is a simple HMAC-sign-and-return, so this should be fine. Flag if this turns out to generate noticeable DB load.
- Users who previously relied on the static `/members/{memberNo}` QR for a "here is my public page" sharable code lose that quick surface. The `/members/{memberNo}` URL is still shown as plain text when `isPublic=true`, and the public member page can still be linked via the URL bar.
