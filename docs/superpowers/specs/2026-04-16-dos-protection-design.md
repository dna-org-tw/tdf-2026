# DOS Protection for Unprotected API Endpoints

**Date:** 2026-04-16
**Status:** Design

## Goal

Add DOS protection to API endpoints that are currently unprotected. The site already uses reCAPTCHA Enterprise on `newsletter/subscribe` and `award/vote`, and rate limiting on auth endpoints. Extend the same two mechanisms to every remaining endpoint that could be abused to burn external quota, write DB rows in bulk, or spike costs.

## Scope

### Endpoints to add reCAPTCHA Enterprise

User-initiated actions where we can run `grecaptcha.enterprise.execute()` in the browser before submission.

| Endpoint | Action name | Frontend touch point |
|---|---|---|
| `POST /api/checkout` | `checkout` | `components/sections/TicketsSection.tsx` (before Stripe redirect) |
| `POST /api/award/check-follow` | `check_follow` | Award flow (wherever email submit triggers the check) |
| `POST /api/newsletter/unsubscribe` | `unsubscribe` | `app/newsletter/unsubscribe/page.tsx` |

Verification follows the existing `newsletter/subscribe` pattern:
- Reject if token missing
- Reject if `tokenProperties.valid` is false or `action` mismatches
- Reject if `riskAnalysis.score < 0.5`
- Reject if 500 from Google (fail closed)

### Endpoints to add rate limiting

Fires automatically on page load — can't insert a reCAPTCHA challenge. Use `lib/rateLimit.ts` keyed by client IP.

| Endpoint | Limit | Window |
|---|---|---|
| `POST /api/visitors/record` | 180 req | 60s |
| `POST /api/events/track` | 180 req | 60s |
| `GET/POST /api/award/fetch-reels` | 120 req | 60s |
| `GET /api/luma-data` | 120 req | 60s |
| `GET /api/luma-schedule` | 120 req | 60s |
| `GET /api/luma-speakers` | 120 req | 60s |
| `GET /api/luma-events` | 120 req | 60s |
| `GET /api/luma-partners` | 120 req | 60s |

Rate-limit key: `<endpoint>:<ip>`. Use the same IP extraction pattern as `newsletter/subscribe` (`x-forwarded-for` → `x-real-ip` → `cf-connecting-ip`). On rate-limit hit, return HTTP 429 with `Retry-After` header derived from `resetAt`.

### Explicitly out of scope

- `order/query` — already requires authenticated session, low DOS payoff.
- `award/confirm-vote` — GET with HMAC token, token verification is the rate limiter.
- `webhooks/stripe` — protected by Stripe signature.
- `news`, `auth/session`, `auth/logout`, `auth/orders` — low DOS impact.
- Endpoints that already have reCAPTCHA or rate limiting.

## Architecture

### Shared reCAPTCHA verifier helper

Current state: `newsletter/subscribe` and `award/vote` each inline ~60 lines of reCAPTCHA verification against `recaptchaenterprise.googleapis.com`. Adding 3 more copies is noise.

Extract to `lib/recaptcha.ts`:

```ts
export type RecaptchaResult =
  | { ok: true; score: number | null }
  | { ok: false; reason: 'not_configured' | 'missing_token' | 'invalid' | 'low_score' | 'api_error' };

export async function verifyRecaptcha(token: string | undefined, expectedAction: string): Promise<RecaptchaResult>
```

Behavior matches existing inline code: score threshold 0.5, fail-closed on HTTP errors, check `tokenProperties.valid` and `action`.

Refactor `newsletter/subscribe` and `award/vote` to use the helper — this is part of the same change because otherwise we'd have five copies of the same block.

### Rate-limit helper for API routes

`lib/rateLimit.ts` already exports `checkRateLimit`. Add a thin wrapper `lib/rateLimitResponse.ts` that combines IP extraction + limit check + 429 response so each route can add one line:

```ts
const rl = enforceRateLimit(req, { key: 'visitors-record', limit: 120, windowSeconds: 60 });
if (rl) return rl; // 429 response if rate-limited, undefined otherwise
```

Uses the same IP extraction helper (extract `getClientIP` to `lib/clientIp.ts` since it's duplicated across `newsletter/subscribe` and `visitors/record`).

### Frontend changes

Three components need to call `useRecaptcha` before posting:

1. **`TicketsSection.tsx`** — before `fetch('/api/checkout')`, call `useRecaptcha('checkout').executeRecaptcha()` and include `recaptchaToken` in body.
2. **Award check-follow caller** — wherever `/api/award/check-follow` is fetched (likely in `components/award/VoteEmailModal.tsx` or the vote flow).
3. **Unsubscribe page** — `app/newsletter/unsubscribe/page.tsx` before POST.

`RecaptchaScript` is already loaded in `app/layout.tsx`, so the Enterprise SDK is available globally.

## Failure handling

- reCAPTCHA failures return 400 with a localized error (reuse `content[lang].api.recaptchaFailed` where available; add new keys if missing).
- Rate-limit 429 includes `Retry-After: <seconds>` header and a JSON body `{ error: 'Too many requests' }` (localized).
- Server misconfiguration (missing `RECAPTCHA_API_KEY`) returns 500 and logs — never silently bypasses verification.

## Non-goals

- Not migrating `lib/rateLimit.ts` to Redis/Upstash. The existing in-memory limiter and its multi-instance caveat remain as-is. Current Zeabur deployment is single-instance so this is acceptable.
- Not adding CAPTCHA to endpoints that already have rate limiting (auth endpoints) — double coverage is overkill for now.
- Not caching `fetch-reels` / `luma-*` responses. Rate limit alone is the scope of this spec; caching is a separate concern.

## Testing

No test framework configured in repo. Manual verification:

1. For each reCAPTCHA-added endpoint: submit with missing token → 400; submit with valid token → 200.
2. For each rate-limited endpoint: fire `limit + 5` requests rapidly from one IP → observe 429 with `Retry-After`.
3. Verify `newsletter/subscribe` and `award/vote` still work after refactor to shared helper (regression check).
4. Smoke-test checkout end-to-end (user journey through `TicketsSection` → Stripe → return).
