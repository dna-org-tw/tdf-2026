# DOS Protection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reCAPTCHA Enterprise to three user-initiated API endpoints and IP-based rate limiting to eight auto-fired endpoints, with shared helpers to remove duplication.

**Architecture:** Extract existing inline reCAPTCHA verification (currently duplicated in `newsletter/subscribe` and `award/vote`) into `lib/recaptcha.ts`. Extract duplicated `getClientIP` into `lib/clientIp.ts`. Add `lib/rateLimitResponse.ts` wrapper around existing `lib/rateLimit.ts`. Refactor two existing routes to use the shared helpers, then apply the helpers to new routes.

**Tech Stack:** Next.js 16 API routes, TypeScript, reCAPTCHA Enterprise REST API, in-memory rate limiter (`lib/rateLimit.ts`).

**No test framework** is configured. Verification uses `npm run lint` + `npm run build` + targeted manual curl / browser smoke tests documented in each task.

---

## File Structure

### New files
- `lib/clientIp.ts` — Extract `getClientIP(req: NextRequest): string | null` from duplicated copies.
- `lib/recaptcha.ts` — `verifyRecaptcha(token, expectedAction): Promise<RecaptchaResult>`.
- `lib/rateLimitResponse.ts` — `enforceRateLimit(req, opts): NextResponse | null`.

### Modified files
- `data/content.ts` — Add `tooManyRequests` to `api` block for both `en` and `zh`.
- `app/api/newsletter/subscribe/route.ts` — Refactor to use `verifyRecaptcha` + `getClientIP`.
- `app/api/award/vote/route.ts` — Refactor to use `verifyRecaptcha`.
- `app/api/checkout/route.ts` — Add reCAPTCHA verification.
- `app/api/award/check-follow/route.ts` — Add reCAPTCHA verification.
- `app/api/newsletter/unsubscribe/route.ts` — Add reCAPTCHA verification to POST.
- `app/api/visitors/record/route.ts` — Add rate limit + use shared `getClientIP`.
- `app/api/events/track/route.ts` — Add rate limit.
- `app/api/award/fetch-reels/route.ts` — Add rate limit.
- `app/api/luma-data/route.ts` — Add rate limit.
- `app/api/luma-schedule/route.ts` — Add rate limit.
- `app/api/luma-speakers/route.ts` — Add rate limit.
- `app/api/luma-events/route.ts` — Add rate limit.
- `app/api/luma-partners/route.ts` — Add rate limit.
- `components/sections/TicketsSection.tsx` — Call `useRecaptcha('checkout')` before `/api/checkout`.
- `components/award/VoteEmailModal.tsx` — Call `useRecaptcha('check_follow')` before `/api/award/check-follow`.
- `app/newsletter/unsubscribe/page.tsx` — Call `useRecaptcha('unsubscribe')` before POST.

---

## Task 1: Extract shared `getClientIP` helper

**Files:**
- Create: `lib/clientIp.ts`

- [ ] **Step 1: Write `lib/clientIp.ts`**

```ts
import type { NextRequest } from 'next/server';

/**
 * Extract the client IP from standard proxy headers.
 * Order: x-forwarded-for → x-real-ip → cf-connecting-ip.
 * Returns null when no header is present.
 */
export function getClientIP(req: NextRequest): string | null {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();

  const realIP = req.headers.get('x-real-ip');
  if (realIP) return realIP;

  const cfConnectingIP = req.headers.get('cf-connecting-ip');
  if (cfConnectingIP) return cfConnectingIP;

  return null;
}
```

- [ ] **Step 2: Lint check**

Run: `npm run lint -- lib/clientIp.ts`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/clientIp.ts
git commit -m "refactor: extract getClientIP into lib/clientIp.ts"
```

---

## Task 2: Extract shared `verifyRecaptcha` helper

**Files:**
- Create: `lib/recaptcha.ts`

- [ ] **Step 1: Write `lib/recaptcha.ts`**

```ts
const recaptchaApiKey = process.env.RECAPTCHA_API_KEY;
const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '6Lcu81gsAAAAAIrVoGK7urIEt9_w7gOoUSjzC5Uv';
const recaptchaProjectId = process.env.RECAPTCHA_PROJECT_ID || 'tdna-1769599168858';

export type RecaptchaResult =
  | { ok: true; score: number | null }
  | { ok: false; reason: 'not_configured' | 'missing_token' | 'invalid' | 'low_score' | 'api_error' };

/**
 * Verify a reCAPTCHA Enterprise token against Google's assessment API.
 * Matches the behavior used by newsletter/subscribe and award/vote:
 *  - Rejects tokens that fail tokenProperties.valid or whose action doesn't match.
 *  - Rejects risk score < 0.5 when a score is provided.
 *  - Fails closed on HTTP errors or network failures.
 */
export async function verifyRecaptcha(
  token: string | undefined,
  expectedAction: string
): Promise<RecaptchaResult> {
  if (!recaptchaApiKey) {
    console.error('[reCAPTCHA] RECAPTCHA_API_KEY is not configured.');
    return { ok: false, reason: 'not_configured' };
  }
  if (!token) {
    return { ok: false, reason: 'missing_token' };
  }

  try {
    const response = await fetch(
      `https://recaptchaenterprise.googleapis.com/v1/projects/${recaptchaProjectId}/assessments?key=${recaptchaApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: { token, expectedAction, siteKey: recaptchaSiteKey },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error('[reCAPTCHA Enterprise] API error:', errorData);
      return { ok: false, reason: 'api_error' };
    }

    const data = await response.json();
    if (!data.tokenProperties?.valid || data.tokenProperties?.action !== expectedAction) {
      return { ok: false, reason: 'invalid' };
    }

    const score: number | undefined = data.riskAnalysis?.score;
    if (score !== undefined && score < 0.5) {
      return { ok: false, reason: 'low_score' };
    }

    return { ok: true, score: score ?? null };
  } catch (error) {
    console.error('[reCAPTCHA Enterprise] Verification error:', error);
    return { ok: false, reason: 'api_error' };
  }
}
```

- [ ] **Step 2: Lint check**

Run: `npm run lint -- lib/recaptcha.ts`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/recaptcha.ts
git commit -m "feat: add shared lib/recaptcha.ts helper"
```

---

## Task 3: Add `tooManyRequests` i18n string

**Files:**
- Modify: `data/content.ts` (search for existing `recaptchaRequired` in `api` block; add a sibling key in both `en` and `zh`)

- [ ] **Step 1: Find the `api` block in `en`**

Run: `grep -n "recaptchaRequired" data/content.ts`

Expected output (line numbers will differ slightly):
```
797:      recaptchaRequired: "reCAPTCHA verification is required.",
1700:      recaptchaRequired: "reCAPTCHA 驗證是必須的。",
```

- [ ] **Step 2: Add `tooManyRequests` after `recaptchaFailed` in both `en` and `zh` api blocks**

For the `en` block, add after `recaptchaFailed: "reCAPTCHA verification failed. Please try again later.",`:

```ts
      tooManyRequests: "Too many requests. Please slow down and try again in a moment.",
```

For the `zh` block, add after `recaptchaFailed: "reCAPTCHA 驗證失敗，請稍後重試。",`:

```ts
      tooManyRequests: "請求過於頻繁，請稍候再試。",
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new type errors (existing keys referenced from content.ts must still resolve).

- [ ] **Step 4: Commit**

```bash
git add data/content.ts
git commit -m "feat: add tooManyRequests i18n string"
```

---

## Task 4: Add `enforceRateLimit` wrapper

**Files:**
- Create: `lib/rateLimitResponse.ts`

- [ ] **Step 1: Write `lib/rateLimitResponse.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimit';
import { getClientIP } from '@/lib/clientIp';
import { content } from '@/data/content';

interface EnforceOptions {
  /** Stable key for this endpoint, e.g. 'visitors-record'. */
  key: string;
  /** Max requests allowed in the window. */
  limit: number;
  /** Window size in seconds. */
  windowSeconds: number;
}

function getLang(req: NextRequest): 'en' | 'zh' {
  const url = new URL(req.url);
  const langParam = url.searchParams.get('lang');
  if (langParam === 'en' || langParam === 'zh') return langParam;
  const referer = req.headers.get('referer');
  if (referer) {
    try {
      const refLang = new URL(referer).searchParams.get('lang');
      if (refLang === 'en' || refLang === 'zh') return refLang;
    } catch {
      /* noop */
    }
  }
  return 'zh';
}

/**
 * IP-based rate limit. Returns a 429 NextResponse if the caller is over the limit,
 * or null when the request may proceed. Uses `unknown` as the IP key when the
 * request has no proxy headers (e.g. localhost) — this is acceptable because the
 * only practical caller without headers is local development.
 */
export function enforceRateLimit(req: NextRequest, opts: EnforceOptions): NextResponse | null {
  const ip = getClientIP(req) ?? 'unknown';
  const result = checkRateLimit(`${opts.key}:${ip}`, {
    limit: opts.limit,
    windowSeconds: opts.windowSeconds,
  });

  if (result.allowed) return null;

  const retryAfterSec = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
  const lang = getLang(req);
  return NextResponse.json(
    { error: content[lang].api.tooManyRequests },
    {
      status: 429,
      headers: { 'Retry-After': String(retryAfterSec) },
    }
  );
}
```

- [ ] **Step 2: Lint + type check**

Run: `npm run lint -- lib/rateLimitResponse.ts && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/rateLimitResponse.ts
git commit -m "feat: add enforceRateLimit wrapper with 429 response"
```

---

## Task 5: Refactor `newsletter/subscribe` to use shared helpers

**Files:**
- Modify: `app/api/newsletter/subscribe/route.ts`

- [ ] **Step 1: Replace top-of-file recaptcha constants and local `getClientIP`**

Remove these lines from the top of the file (they are now in shared helpers):

```ts
const recaptchaApiKey = process.env.RECAPTCHA_API_KEY;
const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '6Lcu81gsAAAAAIrVoGK7urIEt9_w7gOoUSjzC5Uv';
const recaptchaProjectId = process.env.RECAPTCHA_PROJECT_ID || 'tdna-1769599168858';
```

Remove the local `getClientIP` function (it is duplicated in `lib/clientIp.ts`).

Add imports:

```ts
import { verifyRecaptcha } from '@/lib/recaptcha';
import { getClientIP } from '@/lib/clientIp';
```

- [ ] **Step 2: Replace the inline reCAPTCHA verification block**

Replace the entire block starting with `// Verify reCAPTCHA Enterprise` and ending with the matching closing `}` of the inner `{ const { recaptchaToken } = body; ... }` block (lines ~118–195 in the current file) with:

```ts
    const { recaptchaToken } = body;
    const rc = await verifyRecaptcha(recaptchaToken, 'subscribe');
    if (!rc.ok) {
      if (rc.reason === 'not_configured') {
        return NextResponse.json(
          { error: 'reCAPTCHA is not configured on the server.' },
          { status: 500 }
        );
      }
      if (rc.reason === 'missing_token') {
        return NextResponse.json({ error: t.recaptchaRequired }, { status: 400 });
      }
      return NextResponse.json({ error: t.recaptchaFailed }, { status: 400 });
    }
```

- [ ] **Step 3: Type + lint check**

Run: `npx tsc --noEmit && npm run lint -- app/api/newsletter/subscribe/route.ts`
Expected: no errors.

- [ ] **Step 4: Manual smoke test**

Start dev server: `npm run dev`

In a separate terminal:
```bash
curl -X POST http://localhost:3000/api/newsletter/subscribe \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com"}'
```
Expected: HTTP 400 with `recaptchaRequired` message (missing token path works).

Stop dev server (Ctrl+C).

- [ ] **Step 5: Commit**

```bash
git add app/api/newsletter/subscribe/route.ts
git commit -m "refactor: newsletter/subscribe uses shared recaptcha+ip helpers"
```

---

## Task 6: Refactor `award/vote` to use shared `verifyRecaptcha`

**Files:**
- Modify: `app/api/award/vote/route.ts`

- [ ] **Step 1: Remove constants + add import**

Remove from the top:

```ts
const recaptchaApiKey = process.env.RECAPTCHA_API_KEY;
const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
const recaptchaProjectId = process.env.RECAPTCHA_PROJECT_ID;
```

Add:

```ts
import { verifyRecaptcha } from '@/lib/recaptcha';
```

- [ ] **Step 2: Replace the inline reCAPTCHA block (lines ~153–222)**

Replace the block from `// 驗證 reCAPTCHA` through the matching catch's closing brace with:

```ts
    const rc = await verifyRecaptcha(recaptchaToken, 'vote');
    if (!rc.ok) {
      if (rc.reason === 'not_configured') {
        return NextResponse.json(
          { error: 'reCAPTCHA is not configured on the server.' },
          { status: 500 }
        );
      }
      if (rc.reason === 'missing_token') {
        return NextResponse.json(
          { error: 'reCAPTCHA verification is required' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'reCAPTCHA verification failed' },
        { status: 400 }
      );
    }
```

- [ ] **Step 3: Type + lint check**

Run: `npx tsc --noEmit && npm run lint -- app/api/award/vote/route.ts`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/award/vote/route.ts
git commit -m "refactor: award/vote uses shared verifyRecaptcha"
```

---

## Task 7: Add reCAPTCHA to `POST /api/checkout` (server)

**Files:**
- Modify: `app/api/checkout/route.ts`

- [ ] **Step 1: Add import + verification at top of POST**

Add import near existing imports:

```ts
import { verifyRecaptcha } from '@/lib/recaptcha';
```

Inside `POST`, after the `body` is parsed but before reading `tier`, add:

```ts
    const rc = await verifyRecaptcha(body?.recaptchaToken, 'checkout');
    if (!rc.ok) {
      if (rc.reason === 'not_configured') {
        return NextResponse.json(
          { error: 'reCAPTCHA is not configured on the server.' },
          { status: 500 }
        );
      }
      if (rc.reason === 'missing_token') {
        return NextResponse.json(
          { error: 'reCAPTCHA verification is required' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'reCAPTCHA verification failed' },
        { status: 400 }
      );
    }
```

- [ ] **Step 2: Type + lint check**

Run: `npx tsc --noEmit && npm run lint -- app/api/checkout/route.ts`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/checkout/route.ts
git commit -m "feat: require reCAPTCHA on /api/checkout"
```

---

## Task 8: Pass reCAPTCHA token from `TicketsSection`

**Files:**
- Modify: `components/sections/TicketsSection.tsx`

- [ ] **Step 1: Add `useRecaptcha` import and hook near top of component**

Near the other hook imports, add:

```ts
import { useRecaptcha } from '@/hooks/useRecaptcha';
```

Inside the component (near other `use*` calls), add:

```ts
  const { executeRecaptcha } = useRecaptcha('checkout');
```

- [ ] **Step 2: Generate token before the fetch at line ~177**

Immediately before `const response = await fetch('/api/checkout', { ... })`, add:

```ts
      let recaptchaToken: string | null = null;
      try {
        recaptchaToken = await executeRecaptcha();
      } catch (err) {
        console.error('reCAPTCHA execution failed:', err);
        alert('Unable to start checkout. Please try again later or contact us.');
        return;
      }
```

- [ ] **Step 3: Include the token in the body**

In the `body: JSON.stringify({ ... })` for the checkout fetch, add `recaptchaToken` to the payload:

```ts
        body: JSON.stringify({
          tier: tier.key,
          visitor_fingerprint: getVisitorFingerprint(),
          recaptchaToken,
          ...(week ? { week } : {}),
        }),
```

- [ ] **Step 4: Type + lint check**

Run: `npx tsc --noEmit && npm run lint -- components/sections/TicketsSection.tsx`
Expected: no errors.

- [ ] **Step 5: Manual smoke test**

Start dev server: `npm run dev`. Open the home page in a browser. Scroll to the Tickets section. Click "Get Ticket" on any tier. Verify you are redirected to Stripe checkout (i.e. reCAPTCHA token is generated and accepted server-side).

- [ ] **Step 6: Commit**

```bash
git add components/sections/TicketsSection.tsx
git commit -m "feat: TicketsSection sends reCAPTCHA token with checkout request"
```

---

## Task 9: Add reCAPTCHA to `POST /api/award/check-follow` (server)

**Files:**
- Modify: `app/api/award/check-follow/route.ts`

- [ ] **Step 1: Add import + verification**

Add import:

```ts
import { verifyRecaptcha } from '@/lib/recaptcha';
```

Inside `POST`, after the body parsing and `email` validation but before the Supabase query, add:

```ts
    const rc = await verifyRecaptcha(body.recaptchaToken, 'check_follow');
    if (!rc.ok) {
      if (rc.reason === 'not_configured') {
        return NextResponse.json(
          { error: 'reCAPTCHA is not configured on the server.' },
          { status: 500 }
        );
      }
      if (rc.reason === 'missing_token') {
        return NextResponse.json(
          { error: 'reCAPTCHA verification is required' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'reCAPTCHA verification failed' },
        { status: 400 }
      );
    }
```

- [ ] **Step 2: Type + lint check**

Run: `npx tsc --noEmit && npm run lint -- app/api/award/check-follow/route.ts`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/award/check-follow/route.ts
git commit -m "feat: require reCAPTCHA on /api/award/check-follow"
```

---

## Task 10: Pass reCAPTCHA token from `VoteEmailModal`

**Files:**
- Modify: `components/award/VoteEmailModal.tsx`

- [ ] **Step 1: Add import and hook**

Add import:

```ts
import { useRecaptcha } from '@/hooks/useRecaptcha';
```

Inside the component, add near other hooks:

```ts
  const { executeRecaptcha } = useRecaptcha('check_follow');
```

- [ ] **Step 2: Generate token inside `checkFollowStatus` before the fetch**

Modify `checkFollowStatus` at line ~47. Before the fetch, add:

```ts
    let recaptchaToken: string | null = null;
    try {
      recaptchaToken = await executeRecaptcha();
    } catch (err) {
      console.error('reCAPTCHA execution failed:', err);
      setError('Unable to verify request. Please try again.');
      setIsChecking(false);
      return;
    }
```

Change the fetch body:

```ts
      const response = await fetch('/api/award/check-follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToCheck, recaptchaToken }),
      });
```

- [ ] **Step 3: Type + lint check**

Run: `npx tsc --noEmit && npm run lint -- components/award/VoteEmailModal.tsx`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/award/VoteEmailModal.tsx
git commit -m "feat: VoteEmailModal sends reCAPTCHA token for follow check"
```

---

## Task 11: Add reCAPTCHA to `POST /api/newsletter/unsubscribe` (server)

**Files:**
- Modify: `app/api/newsletter/unsubscribe/route.ts`

- [ ] **Step 1: Locate the POST handler**

Run: `grep -n "export async function POST" app/api/newsletter/unsubscribe/route.ts`
Expected: one hit for POST. (The GET handler already exists and uses a token — leave it alone.)

- [ ] **Step 2: Add import**

Add near existing imports:

```ts
import { verifyRecaptcha } from '@/lib/recaptcha';
```

- [ ] **Step 3: Add verification after body parsing + email validation**

Inside `POST`, after `body.email` is validated but before the Supabase operations, add:

```ts
    const rc = await verifyRecaptcha(body.recaptchaToken, 'unsubscribe');
    if (!rc.ok) {
      if (rc.reason === 'not_configured') {
        return NextResponse.json(
          { error: 'reCAPTCHA is not configured on the server.' },
          { status: 500 }
        );
      }
      if (rc.reason === 'missing_token') {
        return NextResponse.json({ error: t.recaptchaRequired }, { status: 400 });
      }
      return NextResponse.json({ error: t.recaptchaFailed }, { status: 400 });
    }
```

(Note: this file's POST handler already loads `t` via `getLangFromRequest`; confirm before editing. If it doesn't, add `const lang = getLangFromRequest(req); const t = content[lang].api;` at the top of POST, matching the GET handler.)

- [ ] **Step 4: Type + lint check**

Run: `npx tsc --noEmit && npm run lint -- app/api/newsletter/unsubscribe/route.ts`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/api/newsletter/unsubscribe/route.ts
git commit -m "feat: require reCAPTCHA on unsubscribe POST"
```

---

## Task 12: Pass reCAPTCHA token from unsubscribe page

**Files:**
- Modify: `app/newsletter/unsubscribe/page.tsx`

- [ ] **Step 1: Add import and hook**

Add import at the top of the client component:

```ts
import { useRecaptcha } from '@/hooks/useRecaptcha';
```

Inside the component, add:

```ts
  const { executeRecaptcha } = useRecaptcha('unsubscribe');
```

- [ ] **Step 2: Generate token inside `handleEmailUnsubscribe` before fetch**

In `handleEmailUnsubscribe` (near line ~54), before `const res = await fetch('/api/newsletter/unsubscribe', ...`, add:

```ts
      let recaptchaToken: string | null = null;
      try {
        recaptchaToken = await executeRecaptcha();
      } catch (err) {
        console.error('reCAPTCHA execution failed:', err);
        setStatus('error');
        setMessage(t.unsubscribe.errorTitle);
        return;
      }
```

Update the fetch body:

```ts
      const res = await fetch('/api/newsletter/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), recaptchaToken }),
      });
```

- [ ] **Step 3: Type + lint check**

Run: `npx tsc --noEmit && npm run lint -- app/newsletter/unsubscribe/page.tsx`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/newsletter/unsubscribe/page.tsx
git commit -m "feat: unsubscribe page sends reCAPTCHA token"
```

---

## Task 13: Rate limit `/api/visitors/record`

**Files:**
- Modify: `app/api/visitors/record/route.ts`

- [ ] **Step 1: Replace local `getClientIP` with shared helper**

Remove the local `getClientIP` function. Add import:

```ts
import { getClientIP } from '@/lib/clientIp';
import { enforceRateLimit } from '@/lib/rateLimitResponse';
```

- [ ] **Step 2: Enforce rate limit at start of POST**

At the very top of the `POST` function body, before any other work, add:

```ts
  const rl = enforceRateLimit(req, { key: 'visitors-record', limit: 180, windowSeconds: 60 });
  if (rl) return rl;
```

- [ ] **Step 3: Type + lint check**

Run: `npx tsc --noEmit && npm run lint -- app/api/visitors/record/route.ts`
Expected: no errors.

- [ ] **Step 4: Manual smoke test — rate limit triggers**

Start dev server. In another terminal:
```bash
for i in $(seq 1 185); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/visitors/record \
    -H 'Content-Type: application/json' \
    -d '{"fingerprint":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}'
done | sort | uniq -c
```
Expected: a mix of 200 and 429 (first 180 succeed, remainder 429). Stop dev server.

- [ ] **Step 5: Commit**

```bash
git add app/api/visitors/record/route.ts
git commit -m "feat: rate limit /api/visitors/record (180/60s)"
```

---

## Task 14: Rate limit `/api/events/track`

**Files:**
- Modify: `app/api/events/track/route.ts`

- [ ] **Step 1: Add imports + enforce**

Add near existing imports:

```ts
import { enforceRateLimit } from '@/lib/rateLimitResponse';
```

At the top of the POST handler:

```ts
  const rl = enforceRateLimit(req, { key: 'events-track', limit: 180, windowSeconds: 60 });
  if (rl) return rl;
```

- [ ] **Step 2: Type + lint check**

Run: `npx tsc --noEmit && npm run lint -- app/api/events/track/route.ts`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/events/track/route.ts
git commit -m "feat: rate limit /api/events/track (180/60s)"
```

---

## Task 15: Rate limit `/api/award/fetch-reels`

**Files:**
- Modify: `app/api/award/fetch-reels/route.ts`

- [ ] **Step 1: Add import + enforce in BOTH `GET` and `POST`**

Add import:

```ts
import { enforceRateLimit } from '@/lib/rateLimitResponse';
```

The current `GET()` and `POST()` signatures take no request parameter. Change both to accept `req: NextRequest`:

```ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const rl = enforceRateLimit(req, { key: 'fetch-reels', limit: 120, windowSeconds: 60 });
  if (rl) return rl;
  // ... existing body unchanged
}

export async function POST(req: NextRequest) {
  const rl = enforceRateLimit(req, { key: 'fetch-reels', limit: 120, windowSeconds: 60 });
  if (rl) return rl;
  // ... existing body unchanged
}
```

- [ ] **Step 2: Type + lint check**

Run: `npx tsc --noEmit && npm run lint -- app/api/award/fetch-reels/route.ts`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/award/fetch-reels/route.ts
git commit -m "feat: rate limit /api/award/fetch-reels (120/60s)"
```

---

## Task 16: Rate limit all `/api/luma-*` routes

**Files:**
- Modify: `app/api/luma-data/route.ts`
- Modify: `app/api/luma-schedule/route.ts`
- Modify: `app/api/luma-speakers/route.ts`
- Modify: `app/api/luma-events/route.ts`
- Modify: `app/api/luma-partners/route.ts`

For EACH of the five files, repeat the following steps. Do not batch-commit — one commit per file keeps history easy to revert.

- [ ] **Step 1: Inspect the file's handler signatures**

Run for each file, e.g.: `grep -n "export async function" app/api/luma-data/route.ts`

- [ ] **Step 2: Add import at top**

```ts
import { NextRequest } from 'next/server'; // if not already imported
import { enforceRateLimit } from '@/lib/rateLimitResponse';
```

- [ ] **Step 3: In each exported handler (GET/POST/etc.), ensure signature is `(req: NextRequest)` and add as first line of body:**

```ts
  const rl = enforceRateLimit(req, { key: 'luma-data', limit: 120, windowSeconds: 60 });
  if (rl) return rl;
```

Use the correct `key` per file:
- `luma-data/route.ts` → `'luma-data'`
- `luma-schedule/route.ts` → `'luma-schedule'`
- `luma-speakers/route.ts` → `'luma-speakers'`
- `luma-events/route.ts` → `'luma-events'`
- `luma-partners/route.ts` → `'luma-partners'`

- [ ] **Step 4: Type + lint check per file**

Run: `npx tsc --noEmit && npm run lint -- app/api/luma-data/route.ts`
Expected: no errors. Repeat for each file after modifying.

- [ ] **Step 5: Commit per file**

```bash
git add app/api/luma-data/route.ts
git commit -m "feat: rate limit /api/luma-data (120/60s)"
```

(And similarly for `luma-schedule`, `luma-speakers`, `luma-events`, `luma-partners`.)

---

## Task 17: Final verification

- [ ] **Step 1: Full lint**

Run: `npm run lint`
Expected: no errors introduced (warnings count unchanged vs. before the branch).

- [ ] **Step 2: Full TypeScript check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds with no type/compile errors.

- [ ] **Step 4: Browser smoke — protected flows still work**

Start dev server: `npm run dev`

Test these flows in the browser (with `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` and `RECAPTCHA_API_KEY` configured):

1. Newsletter subscribe from hero — expect success.
2. Award vote — expect vote recorded.
3. Tickets → Stripe redirect — expect redirect to Stripe.
4. Newsletter unsubscribe (email form path) — expect success.
5. Award VoteEmailModal check-follow — expect the follow status result.

- [ ] **Step 5: 429 smoke — rate-limited routes reject burst**

With dev server still running, re-run the burst from Task 13 Step 4. Expect 429s.

- [ ] **Step 6: Stop dev server and report**

Report a summary: files touched, endpoints protected, all commits applied.
