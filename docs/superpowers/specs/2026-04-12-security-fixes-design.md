# Security Fixes Design

Based on security audit findings. 8 issues across Critical / High / Medium severity.

## Scope

Fix 8 vulnerabilities without changing deployment architecture (stays single-instance standalone).

---

## 1. Order API Protection (Critical #1, #2, #3)

### Problem

- `/api/checkout/session` — unauthenticated, returns full PII for any session ID
- `/api/order/sync` — unauthenticated, accepts `force_status` to overwrite order state
- `/api/email/send` — unauthenticated, can send email from official domain to any address

### Changes

**Delete `/api/checkout/session`** — redundant with `/api/order/query`.

**`/api/order/query` — require buyer session:**
- Buyer must verify email via verification code before querying.
- Build a buyer auth flow similar to the existing admin auth (`getAdminSession`), but with a separate session scope.
- Buyer submits email → receives verification code via email → submits code → server sets `buyer_session` cookie (signed, httpOnly, 24h expiry) containing the verified email.
- API only returns orders matching the authenticated buyer's email (read from session, not from request body).

**`/api/order/sync` — restrict access:**
- Remove `force_status` parameter entirely.
- Add auth: only allow calls from Stripe webhook handler (internal) or admin session.
- `checkout/cancelled` page stops calling this API directly.

**Delete `/api/email/send`:**
- Order emails are sent internally by the Stripe webhook handler calling `sendOrderEmail()` directly.
- No public route needed.

**`checkout/success` and `checkout/cancelled` page changes:**
- No longer display order details inline.
- Show a message directing user to the order query page to log in and view their order.

### Files affected

- `app/api/checkout/session/route.ts` — delete
- `app/api/order/query/route.ts` — add buyer session auth
- `app/api/order/sync/route.ts` — remove `force_status`, add auth
- `app/api/email/send/route.ts` — delete
- `app/checkout/success/page.tsx` — remove inline order display
- `app/checkout/cancelled/page.tsx` — remove sync call and inline order display
- `app/api/webhooks/route.ts` — call `sendOrderEmail()` directly
- New: buyer auth routes (verify code, create session)

---

## 2. Newsletter Unsubscribe Protection (High #4)

### Problem

POST handler accepts raw email without token — anyone can unsubscribe anyone.

### Changes

**Remove raw email branch from POST handler.** Token is always required.

**Add "request unsubscribe" flow:**
- New endpoint or branch: user submits email → server sends a confirmation email containing a signed unsubscribe link (with token) → user clicks link → actual unsubscribe happens via existing GET handler.
- POST with `body.email` (no token) triggers the confirmation email, does NOT delete the subscription.

### Files affected

- `app/api/newsletter/unsubscribe/route.ts` — rewrite POST handler

---

## 3. Award API Information Leakage (Medium #5)

### Problem

- `/api/award/fetch-reels` GET dumps all raw `ig_posts` data
- POST error includes `stack` trace

### Changes

**Filter GET response fields** — only return fields needed by frontend: `id`, `shortcode`, `thumbnail_url`, `caption`, `username`, `vote_count`, etc.

**Remove `stack` from POST error response** — return generic error message only.

### Files affected

- `app/api/award/fetch-reels/route.ts`

---

## 4. Fail-open Security Controls (Medium #6)

### Problem

- Default secrets: `'default-vote-secret-change-in-production'`, `'default-secret-change-in-production'`
- Client `useRecaptcha` returns null (allow) when site key is missing
- Server-side reCAPTCHA only validates when API key exists — silently skipped otherwise

### Changes

**Secrets: hard-fail on missing env.**
- Remove all `|| 'default-...'` fallbacks from `VOTE_SECRET` and `UNSUBSCRIBE_SECRET`.
- When these env vars are not set, API calls that depend on them return 500.

**reCAPTCHA server-side: hard-fail.**
- `/api/newsletter/subscribe`, `/api/order/query`, `/api/award/vote` — when `RECAPTCHA_API_KEY` is not set, return 500 instead of skipping validation.

**`useRecaptcha.ts` client-side: hard-fail.**
- When `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` is missing, throw error instead of returning null.

**Startup env check:**
- Add `instrumentation.ts` with `console.error` warnings for missing critical env vars. Does not block startup (to allow frontend-only dev).

### Files affected

- `lib/email.ts` — remove default secret
- `app/api/award/vote/route.ts` — remove default secrets, hard-fail reCAPTCHA
- `app/api/award/confirm-vote/route.ts` — remove default secret
- `app/api/newsletter/subscribe/route.ts` — hard-fail reCAPTCHA
- `app/api/order/query/route.ts` — hard-fail reCAPTCHA
- `hooks/useRecaptcha.ts` — throw on missing key
- New: `instrumentation.ts`

---

## 5. Dependency Upgrades & Security Headers (Medium #7, #8)

### Problem

- `next@16.1.2` has known advisories (including image optimizer DoS)
- `mailgun.js` pulls in vulnerable `axios`
- Missing security headers: CSP, HSTS, Referrer-Policy, Permissions-Policy

### Changes

**Rate limiting: no architecture change.** Current single-instance deployment means in-memory rate limit is effective. Add a comment noting Redis migration needed if deployment changes.

**Upgrade `next`** to latest patch (16.2.x+).

**Upgrade `mailgun.js`** to latest version.

**Add security headers** in `next.config.ts` `headers()`:
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `Content-Security-Policy` — baseline policy allowing self, inline styles (Tailwind), and known external origins
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### Files affected

- `package.json` — version bumps
- `next.config.ts` — add headers
- `lib/rateLimit.ts` — add migration comment
