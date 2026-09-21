# Email Preferences Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a member-page UI letting users toggle which categories of email they receive (newsletter / events / award), enforce those preferences at send time, and require admin broadcasts to declare a category.

**Architecture:** Three boolean columns on `newsletter_subscriptions` (default `true`) act as category-level opt-ins; `unsubscribed_at` remains the global hard kill-switch. A new `/api/member/preferences` GET/PATCH pair, gated by the existing `useAuth` session, lets logged-in members read and update their own row (lazy-creating one if none exists). `lib/recipients.ts` accepts an optional `category` parameter and adds a `LEFT JOIN newsletter_subscriptions` filter so addresses with that category turned off are excluded. The admin send form gains a required category dropdown that flows through to `getRecipients()`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase (service role), Tailwind CSS 4. **The repo has no automated test framework** — verification steps use psql/SQL queries, curl, and manual browser checks instead of unit tests.

**Spec:** `docs/superpowers/specs/2026-04-16-email-preferences-design.md`

---

## File Map

**Create:**
- `supabase/migrations/zzz_add_email_preferences.sql` — schema migration
- `app/api/member/preferences/route.ts` — GET/PATCH endpoints
- `components/member/EmailPreferences.tsx` — UI section component

**Modify:**
- `lib/recipients.ts` — add `category` param + LEFT JOIN filter
- `lib/email.ts` — `sendSubscriptionThankYouEmail` precheck on `pref_newsletter`
- `app/api/newsletter/subscribe/route.ts` — reactivation also resets all `pref_*` to true
- `app/api/admin/send/route.ts` — accept and validate `category`, pass into `getRecipients`
- `app/api/admin/recipients/route.ts` — accept `category` query param, pass through
- `app/admin/send/page.tsx` — required category radio group, include in payload
- `app/member/page.tsx` — render `<EmailPreferences />` inside `MemberDashboard`
- `data/content.ts` — `memberPreferences` namespace (zh + en)

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/zzz_add_email_preferences.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Adds three category preference flags to newsletter_subscriptions.
-- Each flag defaults to TRUE so existing subscribers retain delivery for all
-- categories. The global `unsubscribed_at` column remains the hard kill-switch.
ALTER TABLE newsletter_subscriptions
  ADD COLUMN IF NOT EXISTS pref_newsletter boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pref_events     boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pref_award      boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN newsletter_subscriptions.pref_newsletter IS
  'Festival newsletter (general announcements). Default true.';
COMMENT ON COLUMN newsletter_subscriptions.pref_events IS
  'Event & schedule update broadcasts. Default true.';
COMMENT ON COLUMN newsletter_subscriptions.pref_award IS
  'Nomad Award & community broadcasts. Default true.';
```

- [ ] **Step 2: Apply the migration via Supabase MCP**

Run via the `mcp__claude_ai_Supabase__apply_migration` tool. Migration name: `add_email_preferences`.

- [ ] **Step 3: Verify columns exist and defaults are TRUE**

Run via `mcp__claude_ai_Supabase__execute_sql`:
```sql
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'newsletter_subscriptions'
  AND column_name IN ('pref_newsletter', 'pref_events', 'pref_award')
ORDER BY column_name;
```
Expected: 3 rows, all `boolean`, `column_default = true`, `is_nullable = NO`.

Then verify backfill on existing rows:
```sql
SELECT COUNT(*) AS total,
       COUNT(*) FILTER (WHERE pref_newsletter) AS newsletter_on,
       COUNT(*) FILTER (WHERE pref_events)     AS events_on,
       COUNT(*) FILTER (WHERE pref_award)      AS award_on
FROM newsletter_subscriptions;
```
Expected: all four counts equal.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/zzz_add_email_preferences.sql
git commit -m "feat(db): add email category preference flags to newsletter_subscriptions"
```

---

## Task 2: Recipient Filter — `lib/recipients.ts`

**Files:**
- Modify: `lib/recipients.ts`

- [ ] **Step 1: Add `EmailCategory` type and extend `RecipientsQuery`**

At the top of `lib/recipients.ts`, after the existing `RecipientGroup` type, add:

```typescript
export type EmailCategory = 'newsletter' | 'events' | 'award';

export const EMAIL_CATEGORIES: readonly EmailCategory[] = ['newsletter', 'events', 'award'] as const;
```

In the `RecipientsQuery` interface add:
```typescript
  category?: EmailCategory; // when set, exclude addresses with that pref_* turned off or unsubscribed_at set
```

- [ ] **Step 2: Replace the `members_enriched` query block with a category-aware version**

In `getRecipients`, replace the current query construction (the section starting with `let query = supabaseServer.from('members_enriched')...` through the `for (const row of data || [])` loop) with:

```typescript
  if (q.category) {
    // Category-aware path: LEFT JOIN newsletter_subscriptions so addresses with
    // the category turned off (or unsubscribed_at set) are excluded. Addresses
    // with no subscription row pass through (treated as opted-in by default).
    const prefColumn = `pref_${q.category}`;
    let query = supabaseServer
      .from('members_enriched')
      .select(`email, newsletter_subscriptions!left(${prefColumn}, unsubscribed_at)`)
      .eq('suppressed', false);
    if (statuses && statuses.length) query = query.in('status', statuses);
    if (memberTiers && memberTiers.length) query = query.in('tier', memberTiers);
    if (ticketTiers && ticketTiers.length) query = query.in('highest_ticket_tier', ticketTiers);
    query = query.limit(50000);

    const { data, error } = await query;
    if (error) {
      console.error('[Recipients] Error fetching members_enriched (category-filtered):', error);
      throw new Error('Failed to fetch recipients');
    }

    type SubRow = { pref_newsletter?: boolean; pref_events?: boolean; pref_award?: boolean; unsubscribed_at?: string | null };
    type Row = { email?: string; newsletter_subscriptions?: SubRow | SubRow[] | null };

    for (const row of (data || []) as Row[]) {
      if (!row.email) continue;
      const subRaw = row.newsletter_subscriptions;
      const sub = Array.isArray(subRaw) ? subRaw[0] : subRaw;
      // No row = treated as opted-in (default true). Row present = both pref and unsub gates must pass.
      if (sub) {
        if (sub.unsubscribed_at) continue;
        const prefValue = sub[prefColumn as keyof SubRow] as boolean | undefined;
        if (prefValue === false) continue;
      }
      emailSet.add(String(row.email).trim().toLowerCase());
    }
  } else {
    // Legacy path — no category filter (preserves current behavior for callers
    // that haven't been updated yet, e.g., recipient-count preview queries).
    let query = supabaseServer
      .from('members_enriched')
      .select('email')
      .eq('suppressed', false);
    if (statuses && statuses.length) query = query.in('status', statuses);
    if (memberTiers && memberTiers.length) query = query.in('tier', memberTiers);
    if (ticketTiers && ticketTiers.length) query = query.in('highest_ticket_tier', ticketTiers);
    query = query.limit(50000);

    const { data, error } = await query;
    if (error) {
      console.error('[Recipients] Error fetching members_enriched:', error);
      throw new Error('Failed to fetch recipients');
    }
    for (const row of data || []) {
      if (row.email) emailSet.add(String(row.email).trim().toLowerCase());
    }
  }
```

> **Note for executor:** Supabase JS embed via `members_enriched!left(...)` requires a foreign-key relationship. `members_enriched` is a view over multiple tables, so PostgREST will likely refuse the embed. If `query` returns an embed error, fall back to two queries: (1) fetch emails from `members_enriched` as today; (2) fetch `email, pref_*, unsubscribed_at` from `newsletter_subscriptions` for those emails; (3) filter in JS. Replace the category branch with this two-query implementation:
>
> ```typescript
> if (q.category) {
>   const prefColumn: 'pref_newsletter' | 'pref_events' | 'pref_award' = `pref_${q.category}`;
>   let query = supabaseServer.from('members_enriched').select('email').eq('suppressed', false);
>   if (statuses && statuses.length) query = query.in('status', statuses);
>   if (memberTiers && memberTiers.length) query = query.in('tier', memberTiers);
>   if (ticketTiers && ticketTiers.length) query = query.in('highest_ticket_tier', ticketTiers);
>   query = query.limit(50000);
>   const { data, error } = await query;
>   if (error) { console.error('[Recipients] members_enriched error:', error); throw new Error('Failed to fetch recipients'); }
>   const candidateEmails = (data || []).map((r) => String(r.email).trim().toLowerCase()).filter(Boolean);
>   if (candidateEmails.length === 0) return { emails: Array.from(emailSet), count: emailSet.size };
>
>   const { data: subs, error: subsErr } = await supabaseServer
>     .from('newsletter_subscriptions')
>     .select(`email, ${prefColumn}, unsubscribed_at`)
>     .in('email', candidateEmails);
>   if (subsErr) { console.error('[Recipients] subscriptions error:', subsErr); throw new Error('Failed to fetch preferences'); }
>
>   const subMap = new Map<string, { pref: boolean; unsubscribed: boolean }>();
>   for (const s of (subs || []) as Array<Record<string, unknown>>) {
>     const e = String(s.email).trim().toLowerCase();
>     subMap.set(e, { pref: (s[prefColumn] as boolean) !== false, unsubscribed: !!s.unsubscribed_at });
>   }
>   for (const e of candidateEmails) {
>     const m = subMap.get(e);
>     if (m && (m.unsubscribed || !m.pref)) continue;
>     emailSet.add(e);
>   }
> } else {
>   /* legacy path as above */
> }
> ```
>
> Use whichever variant works after a quick `npm run build` typecheck. Both produce identical results; the two-query version is the safe default.

- [ ] **Step 3: Typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: passes with no new errors.

- [ ] **Step 4: Manual verification via SQL fixture**

Run via Supabase MCP `execute_sql`:
```sql
-- Snapshot: pick an existing subscriber email
SELECT email, pref_newsletter, pref_events, pref_award, unsubscribed_at
FROM newsletter_subscriptions
ORDER BY created_at DESC
LIMIT 3;
```
Pick one address from the result. Record it (call it `<TEST_EMAIL>`). Then:
```sql
UPDATE newsletter_subscriptions SET pref_events = false WHERE email = '<TEST_EMAIL>';
```

Then start the dev server (`npm run dev`) and from another terminal:
```bash
# Will need an admin session cookie — easier to verify via a Node REPL or via the admin send UI in Task 5.
# For now, just inspect with another SQL query:
```
Skip runtime verification here; full e2e check happens in Task 7 (admin send) and Task 8 (member UI).

Restore the test row:
```sql
UPDATE newsletter_subscriptions SET pref_events = true WHERE email = '<TEST_EMAIL>';
```

- [ ] **Step 5: Commit**

```bash
git add lib/recipients.ts
git commit -m "feat(recipients): support category-level email preference filtering"
```

---

## Task 3: Subscribe Endpoint — Reset prefs on Reactivation

**Files:**
- Modify: `app/api/newsletter/subscribe/route.ts`

- [ ] **Step 1: Update the reactivation update statement**

In `app/api/newsletter/subscribe/route.ts`, find the block (around line 121):
```typescript
        const { data: updated, error: updateError } = await supabaseServer
          .from('newsletter_subscriptions')
          .update({ unsubscribed_at: null })
          .eq('id', existing.id)
          .select()
          .single();
```

Replace the `.update({ unsubscribed_at: null })` argument with:
```typescript
          .update({
            unsubscribed_at: null,
            pref_newsletter: true,
            pref_events: true,
            pref_award: true,
          })
```

(Rationale: explicit re-subscription is treated as "give me everything again".)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add app/api/newsletter/subscribe/route.ts
git commit -m "feat(newsletter): reset all category prefs on resubscribe"
```

---

## Task 4: `sendSubscriptionThankYouEmail` Precheck

**Files:**
- Modify: `lib/email.ts`

- [ ] **Step 1: Add a precheck for `pref_newsletter`**

In `lib/email.ts`, locate `sendSubscriptionThankYouEmail`. Just inside the function body (before the Mailgun client check), add:

```typescript
  // Skip if the recipient has explicitly disabled the newsletter category.
  // This protects against admin-triggered resends and future code paths that
  // call this helper outside the homepage subscribe flow.
  if (supabaseServer) {
    const { data: pref } = await supabaseServer
      .from('newsletter_subscriptions')
      .select('pref_newsletter, unsubscribed_at')
      .eq('email', email)
      .maybeSingle();
    if (pref && (pref.unsubscribed_at || pref.pref_newsletter === false)) {
      console.log(`[Email] Skipping subscription_thank_you for ${email}: newsletter pref off`);
      return false;
    }
  }
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add lib/email.ts
git commit -m "feat(email): respect pref_newsletter in subscription_thank_you sender"
```

---

## Task 5: Admin Send API — Required Category

**Files:**
- Modify: `app/api/admin/send/route.ts`
- Modify: `app/api/admin/recipients/route.ts`

- [ ] **Step 1: Update `app/api/admin/send/route.ts` to require category**

After the line `const emailBody = body.body.trim();` (around line 50), add:

```typescript
  const VALID_CATEGORIES = ['newsletter', 'events', 'award'] as const;
  type Category = typeof VALID_CATEGORIES[number];
  const category = body.category as Category | undefined;
  if (!category || !VALID_CATEGORIES.includes(category)) {
    return NextResponse.json(
      { error: '請選擇信件分類（newsletter / events / award）' },
      { status: 400 }
    );
  }
```

Then in the `getRecipients({...})` call (around line 68), add `category` to the args:

```typescript
    const { emails, count } = await getRecipients({
      groups,
      statuses,
      memberTiers,
      ticketTiers,
      legacyTicketTiers,
      adminEmail: session.email,
      category,
    });
```

In the `notification_logs` insert (around line 86), add the category to the row body:
```typescript
        recipient_groups: groups ?? [],
        recipient_tiers: legacyTicketTiers ?? ticketTiers ?? null,
        recipient_count: count,
        sent_by: session.email,
        status: 'sending',
        // Persist the chosen category for audit/debug. Column does not exist yet
        // and is intentionally omitted from the insert if it errors — see fallback.
```

> **Note for executor:** `notification_logs` may not have a `category` column. Do **not** add one in this plan (out of scope). Persist the category in a free-form way only if a column exists; otherwise rely on the `email_logs.metadata` path. For now, omit category from the `notification_logs` insert. Audit lives via the `category` parameter being threaded through `getRecipients` (which determines who got the email).

Drop the `// Persist the chosen category...` block above and leave the insert unchanged. Just thread `category` into `getRecipients`. Final result:

```typescript
    const { emails, count } = await getRecipients({
      groups,
      statuses,
      memberTiers,
      ticketTiers,
      legacyTicketTiers,
      adminEmail: session.email,
      category,
    });
```

- [ ] **Step 2: Update `app/api/admin/recipients/route.ts` to accept `category`**

After the existing `parseList` calls (around line 41), add:
```typescript
  const VALID_CATEGORIES = ['newsletter', 'events', 'award'] as const;
  const categoryRaw = searchParams.get('category');
  const category = (VALID_CATEGORIES as readonly string[]).includes(categoryRaw ?? '')
    ? (categoryRaw as 'newsletter' | 'events' | 'award')
    : undefined;
```

Then in the `getRecipients({...})` call, add `category`:
```typescript
    const result = await getRecipients({
      groups,
      statuses,
      memberTiers,
      ticketTiers,
      legacyTicketTiers,
      category,
    });
```

(Recipient-count preview is not required to filter by category — current admin UX shows the audience size, then category narrows it. But threading the param keeps preview accurate. Optional but recommended.)

- [ ] **Step 3: Typecheck and lint**

Run: `npm run lint && npx tsc --noEmit`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/send/route.ts app/api/admin/recipients/route.ts
git commit -m "feat(admin/send): require category and forward to recipient filter"
```

---

## Task 6: Admin Send UI — Category Dropdown

**Files:**
- Modify: `app/admin/send/page.tsx`

- [ ] **Step 1: Add category state**

In `app/admin/send/page.tsx`, after the `const [body, setBody] = useState('');` line (around line 66), add:

```typescript
  type Category = 'newsletter' | 'events' | 'award';
  const [category, setCategory] = useState<Category>('newsletter');
```

- [ ] **Step 2: Include category in payload**

In the `submit` function (around line 136), after `const payload: Record<string, unknown> = { subject, body };`, add:
```typescript
      payload.category = category;
```

Also in `fetchCount` (around line 105), append the category to the URLSearchParams:
```typescript
      params.set('category', category);
```

And add `category` to the `fetchCount` `useCallback` dependency array (around line 119): `}, [testOnly, statuses, memberTiers, ticketTiers, category]);`

- [ ] **Step 3: Render the category selector**

Find the recipient-condition card (around line 184, the `<div className="bg-white rounded-xl p-4 shadow-sm mb-4">` that wraps the testOnly + statuses + tiers controls). Insert a new card **above** it:

```tsx
      <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
        <div className="text-xs text-slate-500 mb-2">信件分類（必選）</div>
        <div className="flex flex-wrap gap-2">
          {([
            { value: 'newsletter', label: '節慶電子報' },
            { value: 'events', label: '活動與議程更新' },
            { value: 'award', label: 'Nomad Award 與社群活動' },
          ] as const).map((opt) => (
            <label
              key={opt.value}
              className={`px-3 py-1.5 text-sm rounded-lg border cursor-pointer ${
                category === opt.value
                  ? 'border-[#10B8D9] bg-[#10B8D9]/10 text-[#10B8D9]'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="category"
                value={opt.value}
                checked={category === opt.value}
                onChange={() => setCategory(opt.value)}
                className="hidden"
              />
              {opt.label}
            </label>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-2">
          收件人若關閉此分類偏好將自動排除。
        </p>
      </div>
```

- [ ] **Step 4: Typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: passes.

- [ ] **Step 5: Manual browser check**

Start dev server: `npm run dev`. Navigate to `/admin/send` (log in if needed). Verify:
- Category radio group renders above the test-only checkbox card.
- Default selection is "節慶電子報".
- Selecting a different category triggers a recipient-count refetch.
- Sending with a category includes it in the network payload (DevTools → Network → `/api/admin/send` → request body should contain `"category":"events"`).

Save a screenshot to `.screenshots/2026-04-16/admin-send-category.png`.

- [ ] **Step 6: Commit**

```bash
git add app/admin/send/page.tsx
git commit -m "feat(admin/send): UI for required category selector"
```

---

## Task 7: Verify Send-Time Filtering End-to-End

**Files:** none modified — verification only.

- [ ] **Step 1: Set up a test row**

Via Supabase MCP `execute_sql`:
```sql
-- Pick a non-production-critical subscriber, OR insert a test row:
INSERT INTO newsletter_subscriptions (email, source, pref_events)
VALUES ('preferences-test+events-off@example.com', 'manual_test', false)
ON CONFLICT (email) DO UPDATE SET pref_events = false;
```

- [ ] **Step 2: Query recipients via admin UI for `events` category**

Navigate to `/admin/send`. Choose category = `活動與議程更新`. Check "subscribers" status. Observe `recipientCount`.

Then change category to `節慶電子報`. The count should differ by exactly 1 (the test row is excluded under `events`, included under `newsletter`). If counts match, the filter is broken — debug `lib/recipients.ts`.

- [ ] **Step 3: Send a real test email**

Tick "寄送測試信", category=`events`, subject `[TEST] events filter`, body `events test`. Submit. Verify it arrives at the admin's own inbox (test path always sends).

Then disable test mode, choose category=`events`, status=`subscribers`, send a test broadcast (subject prefixed `[TEST]`). Verify in `email_logs`:
```sql
SELECT to_email, status FROM email_logs
WHERE subject = '[TEST] events filter' AND created_at > NOW() - INTERVAL '5 minutes';
```
Confirm `preferences-test+events-off@example.com` is **NOT** in the recipient list.

- [ ] **Step 4: Cleanup test row**

```sql
DELETE FROM newsletter_subscriptions WHERE email = 'preferences-test+events-off@example.com';
DELETE FROM email_logs WHERE to_email = 'preferences-test+events-off@example.com';
```

- [ ] **Step 5: No commit (verification-only task)**

---

## Task 8: Bilingual Copy in `data/content.ts`

**Files:**
- Modify: `data/content.ts`

- [ ] **Step 1: Add `memberPreferences` namespace under both `en` and `zh`**

In `data/content.ts`, locate the `auth:` block under `content.en` (around line 47) and after it add:

```typescript
    memberPreferences: {
      title: 'Email Preferences',
      description: 'Manage which emails you receive at {email}.',
      categories: {
        newsletter: {
          label: 'Festival Newsletter',
          description: 'General announcements about Taiwan Digital Fest 2026.',
        },
        events: {
          label: 'Event & Schedule Updates',
          description: 'Session changes, check-in info, and on-site updates.',
        },
        award: {
          label: 'Nomad Award & Community',
          description: 'Award contest news and community activities.',
        },
      },
      save: 'Save preferences',
      saving: 'Saving…',
      saved: 'Preferences saved.',
      unsubscribeAll: 'Unsubscribe from all',
      unsubscribed: 'You are unsubscribed from all newsletters. Tick any category and save to resubscribe.',
      mandatoryNote: 'Important account and order emails (sign-in codes, payment receipts, vote confirmations) are always sent.',
      error: 'Could not save your preferences. Please try again.',
    },
```

Then under `content.zh` `auth:` block (around line 954), add the Chinese counterpart:

```typescript
    memberPreferences: {
      title: '電子報訂閱偏好',
      description: '管理 {email} 將收到哪些信件。',
      categories: {
        newsletter: {
          label: '節慶電子報',
          description: 'Taiwan Digital Fest 2026 一般訊息與通知。',
        },
        events: {
          label: '活動與議程更新',
          description: '議程變動、報到資訊、活動現場通知。',
        },
        award: {
          label: 'Nomad Award 與社群活動',
          description: 'Nomad Award 投票活動與社群相關訊息。',
        },
      },
      save: '儲存偏好',
      saving: '儲存中…',
      saved: '已儲存偏好。',
      unsubscribeAll: '完全退訂所有電子報',
      unsubscribed: '你已退訂所有電子報。勾選任一分類並儲存即可恢復訂閱。',
      mandatoryNote: '重要的帳號與訂單通知（登入驗證、付款收據、投票確認）將永遠寄送。',
      error: '無法儲存偏好，請稍後再試。',
    },
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: passes (TypeScript will infer the new keys; no schema file to update).

- [ ] **Step 3: Commit**

```bash
git add data/content.ts
git commit -m "feat(content): add memberPreferences namespace (zh + en)"
```

---

## Task 9: Member Preferences API — `GET /api/member/preferences`

**Files:**
- Create: `app/api/member/preferences/route.ts`

- [ ] **Step 1: Find the auth helper used by other member APIs**

Run: `grep -rn "getCurrentUser\|getMemberSession\|user.email" app/api/auth/ app/api/member/ 2>/dev/null | head -20`

Identify the canonical session-reading helper. (Most likely something in `lib/auth/` or a cookie-based helper.) Use the same one this file's GET/PATCH will use.

- [ ] **Step 2: Write the route file**

Create `app/api/member/preferences/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
// Replace the import below with whatever helper Step 1 identified.
import { getMemberSession } from '@/lib/memberAuth';

type Category = 'newsletter' | 'events' | 'award';
const VALID_CATEGORIES: readonly Category[] = ['newsletter', 'events', 'award'];

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

interface PreferencesPayload {
  email: string;
  unsubscribed: boolean;
  preferences: Record<Category, boolean>;
  hasSubscriptionRow: boolean;
}

async function fetchPreferences(email: string): Promise<PreferencesPayload> {
  if (!supabaseServer) throw new Error('Database not configured');
  const { data, error } = await supabaseServer
    .from('newsletter_subscriptions')
    .select('pref_newsletter, pref_events, pref_award, unsubscribed_at')
    .eq('email', email)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    return {
      email,
      unsubscribed: false,
      preferences: { newsletter: true, events: true, award: true },
      hasSubscriptionRow: false,
    };
  }
  return {
    email,
    unsubscribed: !!data.unsubscribed_at,
    preferences: {
      newsletter: data.pref_newsletter !== false,
      events: data.pref_events !== false,
      award: data.pref_award !== false,
    },
    hasSubscriptionRow: true,
  };
}

export async function GET(req: NextRequest) {
  const session = await getMemberSession(req);
  if (!session?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await fetchPreferences(normalizeEmail(session.email));
    return NextResponse.json(result);
  } catch (e) {
    console.error('[Member Preferences GET]', e);
    return NextResponse.json({ error: 'Failed to load preferences' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getMemberSession(req);
  if (!session?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  const email = normalizeEmail(session.email);
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const unsubscribeAll = body.unsubscribeAll === true;
  let prefRow: Record<string, boolean | string | null> = {};

  if (unsubscribeAll) {
    prefRow = {
      unsubscribed_at: new Date().toISOString(),
    };
  } else {
    const prefsInput = body.preferences;
    if (!prefsInput || typeof prefsInput !== 'object') {
      return NextResponse.json({ error: 'preferences object required' }, { status: 400 });
    }
    for (const cat of VALID_CATEGORIES) {
      if (typeof prefsInput[cat] !== 'boolean') {
        return NextResponse.json({ error: `preferences.${cat} must be boolean` }, { status: 400 });
      }
    }
    prefRow = {
      unsubscribed_at: null,
      pref_newsletter: prefsInput.newsletter,
      pref_events: prefsInput.events,
      pref_award: prefsInput.award,
    };
  }

  // Check for an existing row first to decide insert vs update.
  const { data: existing, error: existingErr } = await supabaseServer
    .from('newsletter_subscriptions')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (existingErr) {
    console.error('[Member Preferences PATCH] existing lookup:', existingErr);
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 });
  }

  if (existing) {
    const { error: updateErr } = await supabaseServer
      .from('newsletter_subscriptions')
      .update(prefRow)
      .eq('id', existing.id);
    if (updateErr) {
      console.error('[Member Preferences PATCH] update:', updateErr);
      return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 });
    }
  } else {
    const insertRow = {
      email,
      source: 'member_preferences',
      created_at: new Date().toISOString(),
      ...prefRow,
    };
    const { error: insertErr } = await supabaseServer
      .from('newsletter_subscriptions')
      .insert(insertRow);
    if (insertErr) {
      console.error('[Member Preferences PATCH] insert:', insertErr);
      return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 });
    }
  }

  // Also remove from email_suppressions if user is opting back in to anything.
  if (!unsubscribeAll) {
    await supabaseServer.from('email_suppressions').delete().eq('email', email);
  }

  const result = await fetchPreferences(email);
  return NextResponse.json(result);
}
```

- [ ] **Step 3: Fix the auth import**

Replace the placeholder `import { getMemberSession } from '@/lib/memberAuth';` with whatever Step 1 identified. If member auth currently lives only in client `useAuth` context (cookie-based), find the server-side cookie reader (likely `lib/auth/session.ts` or similar). The function MUST return `{ email: string } | null` from a request.

If no server-side helper exists yet, create the minimal one:

```typescript
// lib/memberAuth.ts (only if no equivalent exists)
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseServer } from '@/lib/supabaseServer';

export async function getMemberSession(_req: NextRequest): Promise<{ email: string } | null> {
  // Inspect existing cookie name — likely 'tdf_session' or similar. Look at
  // /api/auth/verify-code to find the exact cookie name and signing scheme.
  // Example skeleton — fill in based on the existing scheme:
  const store = await cookies();
  const sessionToken = store.get('tdf_session')?.value;
  if (!sessionToken || !supabaseServer) return null;
  const { data } = await supabaseServer
    .from('member_sessions')
    .select('email, expires_at')
    .eq('token', sessionToken)
    .maybeSingle();
  if (!data || !data.email) return null;
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return null;
  return { email: data.email };
}
```

> Adapt to the actual schema. Do not invent table or cookie names; use what verify-code/send-code already write.

- [ ] **Step 4: Typecheck and lint**

Run: `npm run lint && npx tsc --noEmit`
Expected: passes.

- [ ] **Step 5: Manual API check via curl**

Start dev server. Log into `/member` in browser (real auth flow). Copy the session cookie value from DevTools. Then:

```bash
curl -s http://localhost:3000/api/member/preferences \
  -H 'Cookie: tdf_session=<COPIED_VALUE>'
```
Expected JSON: `{"email":"...","unsubscribed":false,"preferences":{"newsletter":true,"events":true,"award":true},"hasSubscriptionRow":<bool>}`.

Then PATCH:
```bash
curl -s -X PATCH http://localhost:3000/api/member/preferences \
  -H 'Cookie: tdf_session=<COPIED_VALUE>' \
  -H 'Content-Type: application/json' \
  -d '{"preferences":{"newsletter":true,"events":false,"award":true}}'
```
Expected: response with `preferences.events === false`.

Verify in DB:
```sql
SELECT email, pref_newsletter, pref_events, pref_award, unsubscribed_at
FROM newsletter_subscriptions
WHERE email = '<your-email>';
```

- [ ] **Step 6: Commit**

```bash
git add app/api/member/preferences/route.ts lib/memberAuth.ts 2>/dev/null
git commit -m "feat(api): GET/PATCH /api/member/preferences for category opt-in/out"
```

(Drop `lib/memberAuth.ts` from `git add` if it wasn't created.)

---

## Task 10: Member UI Component

**Files:**
- Create: `components/member/EmailPreferences.tsx`

- [ ] **Step 1: Write the component**

Create `components/member/EmailPreferences.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';

type Category = 'newsletter' | 'events' | 'award';
const CATEGORIES: readonly Category[] = ['newsletter', 'events', 'award'];

interface ApiPayload {
  email: string;
  unsubscribed: boolean;
  preferences: Record<Category, boolean>;
  hasSubscriptionRow: boolean;
}

interface Props {
  userEmail: string;
}

export default function EmailPreferences({ userEmail }: Props) {
  const { t } = useTranslation();
  const tp = t.auth.memberPreferences;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unsubscribed, setUnsubscribed] = useState(false);
  const [prefs, setPrefs] = useState<Record<Category, boolean>>({
    newsletter: true,
    events: true,
    award: true,
  });
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/member/preferences');
        if (!res.ok) throw new Error('load failed');
        const data: ApiPayload = await res.json();
        if (cancelled) return;
        setUnsubscribed(data.unsubscribed);
        setPrefs(data.preferences);
      } catch {
        if (!cancelled) setMessage({ kind: 'err', text: tp.error });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tp.error]);

  const togglePref = (cat: Category) => {
    setPrefs((cur) => ({ ...cur, [cat]: !cur[cat] }));
    if (unsubscribed) setUnsubscribed(false);
  };

  const submit = async (unsubscribeAll: boolean) => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/member/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(unsubscribeAll ? { unsubscribeAll: true } : { preferences: prefs }),
      });
      if (!res.ok) throw new Error('save failed');
      const data: ApiPayload = await res.json();
      setUnsubscribed(data.unsubscribed);
      setPrefs(data.preferences);
      setMessage({ kind: 'ok', text: tp.saved });
    } catch {
      setMessage({ kind: 'err', text: tp.error });
    } finally {
      setSaving(false);
    }
  };

  const description = tp.description.replace('{email}', userEmail);

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-1/3 mb-3" />
        <div className="h-3 bg-slate-200 rounded w-2/3" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <h2 className="text-xl font-bold text-slate-900 mb-1">{tp.title}</h2>
      <p className="text-sm text-slate-500 mb-4">{description}</p>

      {unsubscribed && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-amber-50 text-amber-800 text-sm">
          {tp.unsubscribed}
        </div>
      )}

      <div className="space-y-3 mb-4">
        {CATEGORIES.map((cat) => {
          const cInfo = tp.categories[cat];
          return (
            <label key={cat} className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs[cat] && !unsubscribed}
                onChange={() => togglePref(cat)}
                className="mt-1 h-4 w-4 accent-[#10B8D9]"
              />
              <span>
                <span className="block font-medium text-slate-900">{cInfo.label}</span>
                <span className="block text-sm text-slate-500">{cInfo.description}</span>
              </span>
            </label>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-100">
        <button
          type="button"
          disabled={saving}
          onClick={() => submit(false)}
          className="bg-[#10B8D9] hover:bg-[#0EA5C4] disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg transition-colors"
        >
          {saving ? tp.saving : tp.save}
        </button>
        <button
          type="button"
          disabled={saving || unsubscribed}
          onClick={() => submit(true)}
          className="text-sm text-slate-500 hover:text-red-500 disabled:opacity-50 transition-colors"
        >
          {tp.unsubscribeAll}
        </button>
        {message && (
          <span className={`text-sm ${message.kind === 'ok' ? 'text-emerald-600' : 'text-red-500'}`}>
            {message.text}
          </span>
        )}
      </div>

      <p className="mt-4 text-xs text-slate-400">{tp.mandatoryNote}</p>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: passes. If `useTranslation` typing complains about `memberPreferences` not existing, the content keys from Task 8 must be saved first — re-check Task 8 was committed.

- [ ] **Step 3: Commit**

```bash
git add components/member/EmailPreferences.tsx
git commit -m "feat(member): EmailPreferences UI component"
```

---

## Task 11: Mount the Component on Member Page

**Files:**
- Modify: `app/member/page.tsx`

- [ ] **Step 1: Import the component**

At the top of `app/member/page.tsx`, after the other imports, add:
```typescript
import EmailPreferences from '@/components/member/EmailPreferences';
```

- [ ] **Step 2: Render it inside `MemberDashboard`**

In `MemberDashboard`, find the closing `</div>` of the order-history block (around line 336, just before the function's closing `</div>`). Insert before it:

```tsx
      {/* Email Preferences */}
      {user?.email && (
        <div className="mt-8">
          <EmailPreferences userEmail={user.email} />
        </div>
      )}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npm run lint && npx tsc --noEmit`
Expected: passes.

- [ ] **Step 4: Browser verification**

Start dev server: `npm run dev`. Log into `/member`. Verify:
- Section "Email Preferences" appears below order history.
- Three checkboxes default to checked (or reflect DB state if user already has prefs).
- Toggling and clicking Save shows "已儲存偏好" / "Preferences saved." inline.
- Network tab shows successful `PATCH /api/member/preferences`.
- Refresh page; toggled state persists.
- Click "完全退訂" — checkboxes disable, amber banner shows, mandatory-note still visible.
- Re-tick a checkbox and Save — `unsubscribed_at` clears in DB.

Switch language to English (URL `?lang=en`); verify all copy switches.

Save a screenshot to `.screenshots/2026-04-16/member-email-preferences.png`.

- [ ] **Step 5: Commit**

```bash
git add app/member/page.tsx
git commit -m "feat(member): mount EmailPreferences on member dashboard"
```

---

## Task 12: Final End-to-End Verification

**Files:** none.

- [ ] **Step 1: Mandatory emails still fire regardless of preferences**

Set up a test member with all three prefs OFF and `unsubscribed_at` set:
```sql
UPDATE newsletter_subscriptions
SET pref_newsletter = false, pref_events = false, pref_award = false,
    unsubscribed_at = NOW()
WHERE email = '<your-email>';
```

Then:
- Trigger a magic-link login → email arrives. ✅
- Place a $0 test order or trigger a comp upgrade → order_success arrives. ✅

If either fails to deliver, regression: `lib/email.ts` precheck (Task 4) should ONLY apply to `subscription_thank_you`, not magic_link or order_success. Verify those code paths bypass the suppression list.

Restore:
```sql
UPDATE newsletter_subscriptions
SET pref_newsletter = true, pref_events = true, pref_award = true,
    unsubscribed_at = NULL
WHERE email = '<your-email>';
```

- [ ] **Step 2: Re-subscribe via homepage clears prefs**

Manually: `UPDATE newsletter_subscriptions SET unsubscribed_at = NOW(), pref_award = false WHERE email = 'resub-test@example.com';`

Submit the homepage subscribe form with `resub-test@example.com`. Verify:
```sql
SELECT pref_newsletter, pref_events, pref_award, unsubscribed_at
FROM newsletter_subscriptions WHERE email = 'resub-test@example.com';
```
Expected: all three `true`, `unsubscribed_at` NULL.

- [ ] **Step 3: Cleanup**

```sql
DELETE FROM newsletter_subscriptions WHERE email LIKE '%-test@example.com';
```

- [ ] **Step 4: Final commit (if any tweaks were needed)**

If verification revealed bugs, fix and commit individually. Otherwise no commit needed.

---

## Summary of Commits

1. `feat(db): add email category preference flags to newsletter_subscriptions`
2. `feat(recipients): support category-level email preference filtering`
3. `feat(newsletter): reset all category prefs on resubscribe`
4. `feat(email): respect pref_newsletter in subscription_thank_you sender`
5. `feat(admin/send): require category and forward to recipient filter`
6. `feat(admin/send): UI for required category selector`
7. `feat(content): add memberPreferences namespace (zh + en)`
8. `feat(api): GET/PATCH /api/member/preferences for category opt-in/out`
9. `feat(member): EmailPreferences UI component`
10. `feat(member): mount EmailPreferences on member dashboard`
