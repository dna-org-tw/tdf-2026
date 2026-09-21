# Critical Notification Category Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fourth notification category `critical` to the admin batch-email tool that bypasses per-category prefs and the global unsubscribe flag, gated by a warning panel, an extra confirmation checkbox, and a mandatory recipient filter.

**Architecture:** Extend the existing `EmailCategory` type and footer/suppression helpers rather than forking a new send path. All filtering branches inside the current `getRecipients`, `filterSuppressed`, and `buildComplianceFooter*` helpers. UI adds one radio option plus a conditional warning block. `notification_logs` gains a `category` column so audits / history can distinguish critical sends.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Supabase (Postgres + service-role client), Mailgun, Tailwind 4, Playwright E2E.

**Spec:** `docs/superpowers/specs/2026-04-19-critical-notification-category-design.md`

---

## File Inventory

**Create:**
- `supabase/migrations/add_critical_notification_category.sql` — adds `notification_logs.category` column
- `tests/e2e/admin-critical-notification.spec.ts` — Playwright E2E for the new flow

**Modify:**
- `lib/emailCompliance.ts` — extend `ComplianceFooterOptions` with `criticalNotice`; extend `filterSuppressed` with `allowUnsubscribed`
- `lib/recipients.ts` — add `'critical'` to `EmailCategory`, add critical branch in `getRecipients`
- `lib/notificationEmail.ts` — thread category through `enqueueEmails` / `processQueueBatch`; use `criticalNotice` in footer calls; use `allowUnsubscribed` in suppression filter
- `app/api/admin/recipients/route.ts` — accept `'critical'`; require identity/status/tier filter when critical
- `app/api/admin/send/route.ts` — accept `'critical'`; require filter when critical; persist `category` into `notification_logs`
- `app/admin/send/page.tsx` — 4th radio, red warning panel, submit gating, confirm-modal checkbox, preview footer adjustment
- `data/content.ts` — add `unsubscribe.criticalNote` copy (en + zh)
- `app/newsletter/unsubscribe/page.tsx` — render `criticalNote` on success state
- `app/admin/history/page.tsx` — red 重大通知 badge on rows where `category === 'critical'`

**Env (production + .env.local):**
- `CUSTOMER_SUPPORT_EMAIL` (optional; falls back to `info@dna.org.tw`)

---

## Task 1: Add `category` column to `notification_logs`

**Files:**
- Create: `supabase/migrations/add_critical_notification_category.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Adds category to notification_logs so history/audit can distinguish
-- broadcast categories (newsletter/events/award) from 履約必要通知 (critical).
-- The app already accepts a `category` field on POST /api/admin/send but did
-- not persist it. This migration closes that gap and adds the 'critical' value.
ALTER TABLE notification_logs
  ADD COLUMN IF NOT EXISTS category TEXT;

CREATE INDEX IF NOT EXISTS idx_notification_logs_category
  ON notification_logs (category);

COMMENT ON COLUMN notification_logs.category IS
  'One of: newsletter, events, award, critical. NULL for rows created before category tracking.';
```

- [ ] **Step 2: Apply the migration against production via the Supabase MCP**

Per `CLAUDE.md` + `feedback_prod_test_account.md`, this project verifies against `.env.production.local`. Apply via the Supabase MCP `apply_migration` tool (fetch project ref from the current `.env.production.local` `SUPABASE_URL`).

Expected: migration applied successfully; running `SELECT column_name FROM information_schema.columns WHERE table_name = 'notification_logs' AND column_name = 'category'` returns a row.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/add_critical_notification_category.sql
git commit -m "feat(db): add category column to notification_logs"
```

---

## Task 2: Extend `filterSuppressed` with `allowUnsubscribed` option

**Files:**
- Modify: `lib/emailCompliance.ts` (search for `export async function filterSuppressed` around line 174)

- [ ] **Step 1: Update the function signature and body**

Replace the current `filterSuppressed` export with:

```ts
/**
 * Bulk suppression filter. Returns the input emails split into allowed / suppressed.
 *
 * Pass `allowUnsubscribed: true` to exclude only hard deliverability signals
 * (bounced / complained / spam / manual). Addresses whose only reason is
 * `unsubscribed` pass through — used for `critical`-category broadcasts
 * (履約必要通知) that legally/contractually must reach the recipient.
 */
export async function filterSuppressed(
  emails: string[],
  opts: { allowUnsubscribed?: boolean } = {},
): Promise<{ allowed: string[]; suppressed: string[] }> {
  if (!supabaseServer || emails.length === 0) {
    return { allowed: emails, suppressed: [] };
  }
  const normalized = Array.from(
    new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean)),
  );

  let query = supabaseServer
    .from('email_suppressions')
    .select('email, reason')
    .in('email', normalized);

  if (opts.allowUnsubscribed) {
    // Only hard deliverability signals block the send.
    query = query.in('reason', ['bounced', 'complained', 'spam', 'manual']);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[EmailCompliance] filterSuppressed lookup failed:', error);
    return { allowed: emails, suppressed: [] };
  }

  const suppressedSet = new Set((data ?? []).map((r) => r.email));
  const allowed: string[] = [];
  const suppressed: string[] = [];
  for (const e of normalized) {
    if (suppressedSet.has(e)) suppressed.push(e);
    else allowed.push(e);
  }
  return { allowed, suppressed };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. Existing `filterSuppressed(emails)` callers (in `lib/notificationEmail.ts`) still compile because `opts` is optional and defaults preserve the old behavior.

- [ ] **Step 3: Commit**

```bash
git add lib/emailCompliance.ts
git commit -m "feat(email): allowUnsubscribed option on filterSuppressed"
```

---

## Task 3: Add `criticalNotice` option to footer builders

**Files:**
- Modify: `lib/emailCompliance.ts` (around line 31 for the interface, lines 53–88 for the builders)

- [ ] **Step 1: Add the support-email constant near the other env-backed constants (around line 29, under `SENDER_ORG`)**

```ts
const CUSTOMER_SUPPORT_EMAIL =
  process.env.CUSTOMER_SUPPORT_EMAIL?.trim() || 'info@dna.org.tw';
```

- [ ] **Step 2: Extend `ComplianceFooterOptions`**

Replace the existing interface:

```ts
export interface ComplianceFooterOptions {
  email?: string;
  includeUnsubscribe?: boolean;
  /**
   * When true, render a "履約必要通知，無法取消訂閱" notice and force
   * includeUnsubscribe=false. Used for `critical`-category broadcasts.
   */
  criticalNotice?: boolean;
}
```

- [ ] **Step 3: Update `buildComplianceFooterHtml`**

Replace the function body:

```ts
export function buildComplianceFooterHtml(opts: ComplianceFooterOptions): string {
  const { email, criticalNotice = false } = opts;
  const includeUnsubscribe = criticalNotice ? false : (opts.includeUnsubscribe ?? true);

  let unsubscribeLine = '';
  if (includeUnsubscribe && email) {
    const url = getUnsubscribeUrl(email);
    unsubscribeLine = `
    <p style="margin: 8px 0;">
      <a href="${url}" style="color: #999; text-decoration: underline;">Unsubscribe</a>
    </p>`;
  }

  const criticalBlock = criticalNotice
    ? `
    <p style="margin: 8px 0; color: #b45309; line-height: 1.5;">
      此為 TDF 2026 履約必要通知（重大變更／權益異動／安全），無法取消訂閱。<br>
      有任何疑問請聯絡 <a href="mailto:${CUSTOMER_SUPPORT_EMAIL}" style="color: #b45309; text-decoration: underline;">${CUSTOMER_SUPPORT_EMAIL}</a>。
    </p>`
    : '';

  return `
  <div style="text-align: center; color: #999; font-size: 12px; margin-top: 24px; padding: 16px; border-top: 1px solid #eee;">${criticalBlock}
    <p style="margin: 8px 0;">This is an automated email. Please do not reply directly to this message.</p>${unsubscribeLine}
    <p style="margin: 8px 0; line-height: 1.5;">
      <strong>${SENDER_ORG}</strong><br>
      ${PHYSICAL_ADDRESS}
    </p>
  </div>`;
}
```

- [ ] **Step 4: Update `buildComplianceFooterText`**

Replace the function body:

```ts
export function buildComplianceFooterText(opts: ComplianceFooterOptions): string {
  const { email, criticalNotice = false } = opts;
  const includeUnsubscribe = criticalNotice ? false : (opts.includeUnsubscribe ?? true);

  const lines: string[] = ['---'];

  if (criticalNotice) {
    lines.push('此為 TDF 2026 履約必要通知（重大變更／權益異動／安全），無法取消訂閱。');
    lines.push(`有任何疑問請聯絡 ${CUSTOMER_SUPPORT_EMAIL}。`);
    lines.push('');
  }

  lines.push('This is an automated email. Please do not reply directly to this message.');

  if (includeUnsubscribe && email) {
    lines.push(`Unsubscribe: ${getUnsubscribeUrl(email)}`);
  }

  lines.push('');
  lines.push(SENDER_ORG);
  lines.push(PHYSICAL_ADDRESS);

  return lines.join('\n');
}
```

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint -- lib/emailCompliance.ts`
Expected: no errors. No existing caller passes `criticalNotice`, so defaults leave every other send path unchanged.

- [ ] **Step 6: Commit**

```bash
git add lib/emailCompliance.ts
git commit -m "feat(email): criticalNotice variant for compliance footer"
```

---

## Task 4: Extend `EmailCategory` + critical branch in `getRecipients`

**Files:**
- Modify: `lib/recipients.ts`

- [ ] **Step 1: Extend the type and constant**

Replace lines 13–14:

```ts
export type EmailCategory = 'newsletter' | 'events' | 'award' | 'critical';
export const EMAIL_CATEGORIES: readonly EmailCategory[] = [
  'newsletter',
  'events',
  'award',
  'critical',
] as const;
```

- [ ] **Step 2: Bypass the `suppressed=false` filter for critical**

Replace the three lines starting with `let query = supabaseServer` (currently around line 70):

```ts
  let query = supabaseServer
    .from('members_enriched')
    .select('email, suppressed, suppression_reason');
  if (q.category === 'critical') {
    // For 履約必要通知, keep addresses whose only suppression reason is
    // `unsubscribed`. Drop bounced/complained/spam/manual — those are hard
    // deliverability failures.
    query = query.or('suppressed.eq.false,suppression_reason.eq.unsubscribed');
  } else {
    // Non-critical: exclude everyone on the suppression list.
    query = query.eq('suppressed', false);
  }
```

- [ ] **Step 3: Short-circuit preference/unsubscribe filtering for critical**

Replace the existing `if (q.category && candidateEmails.length > 0) { ... } else { ... }` block (currently around lines 95–126) with:

```ts
  // Category filter: drop addresses whose newsletter_subscriptions row has the
  // matching pref turned off, or that have unsubscribed_at set. Critical
  // broadcasts skip this filter entirely — they are履約必要通知 and always
  // deliver to non-hard-bounced candidates.
  const needsPrefFilter =
    q.category &&
    q.category !== 'critical' &&
    candidateEmails.length > 0;

  if (needsPrefFilter) {
    const prefColumn = `pref_${q.category}` as 'pref_newsletter' | 'pref_events' | 'pref_award';
    // Batch the .in() lookup — a single 990-email IN list overflows the
    // PostgREST URL/payload limit. 200/batch keeps the URL well under 16KB.
    const BATCH_SIZE = 200;
    const subs: Array<Record<string, unknown>> = [];
    for (let i = 0; i < candidateEmails.length; i += BATCH_SIZE) {
      const chunk = candidateEmails.slice(i, i + BATCH_SIZE);
      const { data, error: subsErr } = await supabaseServer
        .from('newsletter_subscriptions')
        .select(`email, ${prefColumn}, unsubscribed_at`)
        .in('email', chunk);
      if (subsErr) {
        console.error('[Recipients] Error fetching subscription preferences:', subsErr);
        throw new Error('Failed to fetch recipient preferences');
      }
      if (data) subs.push(...(data as Array<Record<string, unknown>>));
    }
    const blocked = new Set<string>();
    for (const sRow of subs) {
      const e = String(sRow.email ?? '').trim().toLowerCase();
      if (!e) continue;
      const prefValue = sRow[prefColumn];
      const unsub = sRow.unsubscribed_at;
      if (unsub || prefValue === false) blocked.add(e);
    }
    for (const e of candidateEmails) {
      if (!blocked.has(e)) emailSet.add(e);
    }
  } else {
    for (const e of candidateEmails) emailSet.add(e);
  }
```

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint -- lib/recipients.ts`
Expected: no errors.

- [ ] **Step 5: Manual sanity SQL — verify critical branch via MCP**

Using the Supabase MCP `execute_sql` tool, run against the production project:

```sql
-- Sanity: compare candidate counts between "critical" semantic (suppressed=false
-- OR reason='unsubscribed') vs normal (suppressed=false). The critical count
-- should be >= the normal count; the delta = number of opted-out members.
SELECT
  (SELECT COUNT(*) FROM members_enriched WHERE suppressed = false) AS normal_count,
  (SELECT COUNT(*) FROM members_enriched WHERE suppressed = false OR suppression_reason = 'unsubscribed') AS critical_count;
```

Expected: both numbers return; `critical_count >= normal_count`.

- [ ] **Step 6: Commit**

```bash
git add lib/recipients.ts
git commit -m "feat(recipients): critical category bypasses pref + unsubscribe filters"
```

---

## Task 5: Admin recipients API — accept `critical` and require filter

**Files:**
- Modify: `app/api/admin/recipients/route.ts`

- [ ] **Step 1: Update the valid categories list and enforce filter requirement**

Replace the `VALID_CATEGORIES` constant + the guard immediately above `getRecipients` (currently around lines 42–53):

```ts
  const VALID_CATEGORIES = ['newsletter', 'events', 'award', 'critical'] as const;
  const categoryRaw = searchParams.get('category');
  const category = (VALID_CATEGORIES as readonly string[]).includes(categoryRaw ?? '')
    ? (categoryRaw as 'newsletter' | 'events' | 'award' | 'critical')
    : undefined;

  if (!groups && !statuses && !memberTiers && !ticketTiers) {
    return NextResponse.json(
      { error: 'At least one of groups, statuses, memberTiers, or ticketTiers is required' },
      { status: 400 },
    );
  }

  // Critical broadcasts must target a concrete identity/status/tier cohort.
  // `groups` alone (e.g. 'subscribers') is not enough — it would let an admin
  // blast the entire newsletter universe by accident.
  if (category === 'critical' && !statuses && !memberTiers && !ticketTiers) {
    return NextResponse.json(
      { error: 'Critical notifications require at least one of statuses, memberTiers, or ticketTiers' },
      { status: 400 },
    );
  }
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint -- app/api/admin/recipients/route.ts`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/recipients/route.ts
git commit -m "feat(api): accept critical category in recipients endpoint"
```

---

## Task 6: Admin send API — accept `critical`, require filter, persist category

**Files:**
- Modify: `app/api/admin/send/route.ts`

- [ ] **Step 1: Extend `VALID_CATEGORIES`**

Replace line 52:

```ts
  const VALID_CATEGORIES = ['newsletter', 'events', 'award', 'critical'] as const;
```

- [ ] **Step 2: Add the critical filter guard**

Immediately after the existing `if ((!groups || groups.length === 0) && !statuses && !memberTiers && !ticketTiers)` block (currently ending around line 76), insert:

```ts
  if (category === 'critical' && !statuses && !memberTiers && !ticketTiers) {
    return NextResponse.json(
      { error: '重大通知必須指定身份／狀態／票種等收件人條件，不允許空篩選' },
      { status: 400 },
    );
  }
```

- [ ] **Step 3: Persist category into `notification_logs` insert**

Replace the `.insert({ ... })` object (currently lines 101–110):

```ts
      .insert({
        subject,
        body: emailBody,
        body_format: bodyFormat,
        category,
        recipient_groups: groups ?? [],
        recipient_tiers: legacyTicketTiers ?? ticketTiers ?? null,
        recipient_count: count,
        sent_by: session.email,
        status: 'sending',
      })
```

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint -- app/api/admin/send/route.ts`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/send/route.ts
git commit -m "feat(api): persist category on notification_logs, gate critical sends"
```

---

## Task 7: Thread category through notification send pipeline

**Files:**
- Modify: `lib/notificationEmail.ts`

- [ ] **Step 1: Pass `allowUnsubscribed` when enqueuing critical**

In `enqueueEmails` (around line 135), update the signature and the `filterSuppressed` call:

```ts
export async function enqueueEmails(
  emails: string[],
  subject: string,
  notificationId: string,
  opts: { category?: 'newsletter' | 'events' | 'award' | 'critical' } = {},
): Promise<{ queued: number; suppressed: number }> {
  if (!supabaseServer) throw new Error('Database not configured');

  // Remove addresses on the suppression list before enqueueing — never send to
  // bounced/complained recipients. For `critical` (履約必要通知) we still honor
  // hard deliverability suppressions but allow `unsubscribed` addresses through.
  const { allowed, suppressed } = await filterSuppressed(emails, {
    allowUnsubscribed: opts.category === 'critical',
  });

  if (allowed.length === 0) {
    return { queued: 0, suppressed: suppressed.length };
  }

  const rows = allowed.map((email) => ({
    to_email: email,
    from_email: fromEmail,
    subject,
    email_type: 'notification' as const,
    status: 'pending' as const,
    notification_id: notificationId,
  }));

  const { error } = await supabaseServer.from('email_logs').insert(rows);
  if (error) throw error;

  return { queued: rows.length, suppressed: suppressed.length };
}
```

- [ ] **Step 2: Read category in `processQueueBatch` and thread it through footer builders**

In `processQueueBatch`, update the notification_logs query (around line 210) to also select `category`:

```ts
  // Get notification body + format + category for HTML building
  const { data: notif } = await supabaseServer
    .from('notification_logs')
    .select('subject, body, body_format, category')
    .eq('id', notificationId)
    .single();

  const subject = notif?.subject ?? pending[0].subject ?? '';
  const body = notif?.body ?? '';
  const bodyFormat: BodyFormat = notif?.body_format === 'html' ? 'html' : 'plain';
  const isCritical = notif?.category === 'critical';
```

- [ ] **Step 3: Update `buildHtml`, `injectComplianceFooter`, `buildPlainText`, `buildPlainTextFromHtml` to accept a critical flag**

Replace the four helper functions (currently lines 23–105):

```ts
function buildHtml(
  body: string,
  subject: string,
  recipientEmail: string,
  criticalNotice: boolean,
): string {
  const bodyHtml = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #1E1F1C; padding: 30px; border-radius: 8px; margin-bottom: 20px;">
    <h1 style="color: #10B8D9; margin: 0; font-size: 24px;">Taiwan Digital Fest 2026</h1>
  </div>
  <div style="background-color: #f9f9f9; padding: 30px; border-radius: 8px; margin-bottom: 20px;">
    <h2 style="color: #10B8D9; margin-top: 0;">${subject}</h2>
    <div style="color: #333; font-size: 16px;">${bodyHtml}</div>
    <p style="color: #666; font-size: 14px; margin-top: 30px;">
      Best regards,<br>
      Taiwan Digital Fest 2026 Team
    </p>
  </div>
  ${buildComplianceFooterHtml({ email: recipientEmail, criticalNotice })}
</body>
</html>`;
}

function injectComplianceFooter(
  rawHtml: string,
  recipientEmail: string,
  criticalNotice: boolean,
): string {
  const footer = buildComplianceFooterHtml({ email: recipientEmail, criticalNotice });
  const closingBody = /<\/body\s*>/i;
  if (closingBody.test(rawHtml)) {
    return rawHtml.replace(closingBody, `${footer}\n</body>`);
  }
  return `${rawHtml}\n${footer}`;
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(br|hr)\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article|header|footer)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildPlainText(body: string, recipientEmail: string, criticalNotice: boolean): string {
  return `Taiwan Digital Fest 2026\n\n${body}\n\nBest regards,\nTaiwan Digital Fest 2026 Team\n\n${buildComplianceFooterText({ email: recipientEmail, criticalNotice })}`;
}

function buildPlainTextFromHtml(
  rawHtml: string,
  recipientEmail: string,
  criticalNotice: boolean,
): string {
  const stripped = htmlToPlainText(rawHtml);
  return `${stripped}\n\n${buildComplianceFooterText({ email: recipientEmail, criticalNotice })}`;
}
```

- [ ] **Step 4: Pass `isCritical` through the per-recipient send loop**

Inside `processQueueBatch`, replace the block that builds `html`, `text`, and calls `mailgunClient.messages.create` (currently lines 230–250):

```ts
    // Per-recipient body so each email gets its own unsubscribe link (or,
    // for critical, the fixed "履約必要通知" footer with no unsubscribe).
    const html = bodyFormat === 'html'
      ? injectComplianceFooter(body, email.to_email, isCritical)
      : buildHtml(body, subject, email.to_email, isCritical);
    const text = bodyFormat === 'html'
      ? buildPlainTextFromHtml(body, email.to_email, isCritical)
      : buildPlainText(body, email.to_email, isCritical);

    try {
      const response = await mailgunClient.messages.create(mailgunDomain, {
        from: fromEmail,
        to: [email.to_email],
        subject,
        html,
        text,
        ...buildMailgunComplianceOptions({
          // Critical sends omit List-Unsubscribe so Gmail/Yahoo clients don't
          // render their built-in one-click unsubscribe button — that would
          // contradict the "無法取消訂閱" semantic of履約必要通知.
          unsubscribeEmail: isCritical ? undefined : email.to_email,
          replyTo: replyToEmail,
          tag: isCritical ? 'notification-critical' : 'notification',
        }),
      });
```

- [ ] **Step 5: Update the caller in `app/api/admin/send/route.ts`**

Find the `enqueueEmails(emails, subject, logEntry.id)` call (around line 120) and add the `category` option:

```ts
    // Enqueue all emails (inserted as 'pending' in email_logs)
    const { queued } = await enqueueEmails(emails, subject, logEntry.id, { category });
```

- [ ] **Step 6: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint -- lib/notificationEmail.ts app/api/admin/send/route.ts`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add lib/notificationEmail.ts app/api/admin/send/route.ts
git commit -m "feat(email): thread category through send pipeline for critical"
```

---

## Task 8: Admin send UI — 4th radio + warning panel + gating + modal checkbox

**Files:**
- Modify: `app/admin/send/page.tsx`

- [ ] **Step 1: Extend the `Category` type and add a derived `isCritical` flag**

Inside the component, replace the `Category` type / `category` state (currently around lines 76–77):

```ts
  type Category = 'newsletter' | 'events' | 'award' | 'critical';
  const [category, setCategory] = useState<Category>('newsletter');
  const [criticalAck, setCriticalAck] = useState(false);
  const isCritical = category === 'critical';
```

Reset `criticalAck` whenever the category changes away from critical:

```ts
  useEffect(() => {
    if (!isCritical) setCriticalAck(false);
  }, [isCritical]);
```

Add this `useEffect` immediately after the existing `emailConfig` fetch effect (around line 92) so it runs on every category change.

- [ ] **Step 2: Add the `critical` radio option**

In the category `<div className="flex flex-wrap gap-2">` (currently lines 222–246), replace the `([...] as const).map(...)` block:

```tsx
          {([
            { value: 'newsletter', label: '節慶電子報' },
            { value: 'events', label: '活動與議程更新' },
            { value: 'award', label: 'Nomad Award 與社群活動' },
            { value: 'critical', label: '⚠️ 重大通知（無法退訂）' },
          ] as const).map((opt) => {
            const selected = category === opt.value;
            const isCriticalOpt = opt.value === 'critical';
            const baseClass = 'px-3 py-1.5 text-sm rounded-lg border cursor-pointer';
            const selectedClass = isCriticalOpt
              ? 'border-red-500 bg-red-50 text-red-700'
              : 'border-[#10B8D9] bg-[#10B8D9]/10 text-[#10B8D9]';
            const idleClass = isCriticalOpt
              ? 'border-red-300 bg-white text-red-600 hover:bg-red-50'
              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50';
            return (
              <label
                key={opt.value}
                className={`${baseClass} ${selected ? selectedClass : idleClass}`}
              >
                <input
                  type="radio"
                  name="category"
                  value={opt.value}
                  checked={selected}
                  onChange={() => setCategory(opt.value)}
                  className="hidden"
                />
                {opt.label}
              </label>
            );
          })}
```

- [ ] **Step 3: Replace the hint text below the category radios with a conditional warning panel**

Replace `<p className="text-xs text-slate-500 mt-2">收件人若關閉此分類偏好將自動排除。</p>` (around lines 248–250) with:

```tsx
        {!isCritical && (
          <p className="text-xs text-slate-500 mt-2">
            收件人若關閉此分類偏好將自動排除。
          </p>
        )}
        {isCritical && (
          <div
            role="alert"
            data-testid="critical-warning"
            className="mt-3 border border-red-400 bg-red-50 text-red-800 rounded-lg p-3 text-sm space-y-1"
          >
            <div className="font-semibold">重大通知模式</div>
            <ul className="list-disc list-inside space-y-0.5">
              <li>僅限重大變更、會員權益異動、簽證或安全等履約必要事項</li>
              <li>將忽略收件人的分類偏好與退訂設定（仍排除硬退信／投訴名單）</li>
              <li>信件底部不會附退訂連結，改顯示客服聯絡方式</li>
              <li>必須至少選一個身份／狀態／等級條件（禁止空篩選群發）</li>
              <li>發送紀錄會特別標記供稽核</li>
            </ul>
          </div>
        )}
```

- [ ] **Step 4: Keep `canSubmit` as is — the API guard is authoritative**

The existing `canSubmit` (currently lines 159–162) already requires at least one filter when `!testOnly`. Critical adds no *additional* client-side restriction beyond this — the API route's guard (Task 6) is authoritative and returns 400 if critical is submitted without `statuses | memberTiers | ticketTiers`. The warning panel text (Step 3) covers user awareness. No edit needed in this step.

(If later behavior shows admins still confusingly submitting with only a `groups` filter and hitting the 400, revisit — but per YAGNI don't pre-empt it.)

- [ ] **Step 5: Add the critical-acknowledgement checkbox inside the confirmation modal**

Replace the modal body (currently lines 431–445):

```tsx
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-2">
              {isCritical ? '確認發送重大通知' : '確認發送'}
            </h3>
            <p className="text-sm text-slate-700 mb-4">
              即將寄送「{subject}」給 {testOnly ? '你自己' : `${recipientCount ?? '?'} 位收件人`}，確認嗎？
            </p>
            {isCritical && !testOnly && (
              <label className="flex items-start gap-2 mb-4 p-3 bg-red-50 border border-red-300 rounded-lg text-sm text-red-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={criticalAck}
                  onChange={(e) => setCriticalAck(e.target.checked)}
                  data-testid="critical-ack"
                  className="mt-0.5"
                />
                <span>我確認此通知符合重大通知定義（重大變更／權益異動／簽證安全），並理解將忽略收件人退訂設定。</span>
              </label>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowConfirm(false); setCriticalAck(false); }} className="px-4 py-2 text-sm border border-slate-300 rounded-lg">取消</button>
              <button
                onClick={submit}
                disabled={sending || (isCritical && !testOnly && !criticalAck)}
                className="px-4 py-2 text-sm text-white bg-[#10B8D9] rounded-lg disabled:opacity-50"
              >
                {sending ? '發送中…' : '確認發送'}
              </button>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 6: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint -- app/admin/send/page.tsx`
Expected: no errors.

- [ ] **Step 7: Start dev server and self-verify public-facing parts**

Per the CLAUDE.md UI verification rules, the admin page is authenticated — hand off for manual verification after this step. Locally:

```bash
npm run dev
```

Open `/admin/send`, pick "重大通知", confirm:
- Radio is red-styled
- Warning panel appears
- Confirm modal has the extra checkbox
- "確認發送" stays disabled until the checkbox is ticked

If the 5-step circuit breaker is hit (per `feedback_ui_verification.md`), hand off to the user to verify in their own Chrome.

- [ ] **Step 8: Commit**

```bash
git add app/admin/send/page.tsx
git commit -m "feat(admin): critical notification radio + warning + ack checkbox"
```

---

## Task 9: Unsubscribe page — note about critical mail

**Files:**
- Modify: `data/content.ts`
- Modify: `app/newsletter/unsubscribe/page.tsx`

- [ ] **Step 1: Add `criticalNote` to both locales in `data/content.ts`**

Find the English `unsubscribe` object (around line 959) and add, immediately after `successNote`:

```ts
      criticalNote: "A small number of notices directly affecting your participation (e.g. event cancellation, visa, or safety updates) will still be delivered.",
```

Find the Chinese `unsubscribe` object (around line 2111) and add, immediately after `successNote`:

```ts
      criticalNote: "極少數與您權益直接相關的重大通知（例如活動取消、簽證或安全事項）仍會寄出。",
```

- [ ] **Step 2: Render `criticalNote` on the success state**

In `app/newsletter/unsubscribe/page.tsx`, find the `status === 'success'` block (starts around line 111). Immediately below the existing `<div className="bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-left">` that contains `successNote`, add a new muted line before the "Back to Home" button:

```tsx
            <p className="text-white/50 text-xs leading-relaxed">
              {t.unsubscribe.criticalNote}
            </p>
```

Concretely the insertion goes between the existing `</div>` that closes the success note card and the `<div className="pt-4">` that wraps `backToHome`.

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint -- data/content.ts app/newsletter/unsubscribe/page.tsx`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add data/content.ts app/newsletter/unsubscribe/page.tsx
git commit -m "feat(unsubscribe): note that critical notices still send"
```

---

## Task 10: Admin history — red badge for critical sends

**Files:**
- Modify: `app/admin/history/page.tsx`

- [ ] **Step 1: Extend the interface**

Replace the `NotificationLog` interface (currently lines 6–17):

```ts
interface NotificationLog {
  id: string;
  subject: string;
  category: 'newsletter' | 'events' | 'award' | 'critical' | null;
  recipient_groups: string[];
  recipient_tiers: string[] | null;
  recipient_count: number;
  success_count: number | null;
  failure_count: number | null;
  sent_by: string;
  status: string;
  created_at: string;
}
```

- [ ] **Step 2: Render the badge next to the subject**

In the `.map` over notifications (around line 91), update the `<div className="flex items-center gap-2 mb-1">` block to include a critical badge alongside the existing status pill:

```tsx
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-slate-900 truncate">{n.subject}</h3>
                      {n.category === 'critical' && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium shrink-0 bg-red-100 text-red-700 border border-red-300">
                          重大通知
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${statusStyle.className}`}>
                        {statusStyle.label}
                      </span>
                    </div>
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint -- app/admin/history/page.tsx`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/admin/history/page.tsx
git commit -m "feat(admin): red badge for critical notifications in history"
```

---

## Task 11: E2E Playwright spec

**Files:**
- Create: `tests/e2e/admin-critical-notification.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from '@playwright/test';

test.describe('Admin critical notification flow', () => {
  test('UI shows warning + gating + badge for critical category', async ({ page }) => {
    await page.goto('/admin/send');
    await expect(page.getByRole('heading', { name: '發送通知' })).toBeVisible();

    // Select the critical category
    await page.getByText('⚠️ 重大通知（無法退訂）').click();

    // Warning panel appears
    await expect(page.getByTestId('critical-warning')).toBeVisible();
    await expect(page.getByTestId('critical-warning')).toContainText('履約必要');

    // Fill subject + body
    await page.getByPlaceholder('主旨').fill('E2E critical test');
    await page.getByPlaceholder('內文（支援換行）').fill('Body for critical test.');

    // Switch to testOnly to avoid hitting the real audience, but still
    // verify the ack checkbox and badge appear for non-test path.
    // First: non-testOnly, pick a filter (identity) to enable the submit.
    await page.getByLabel('Backer').check();

    // Open confirm modal
    await page.getByRole('button', { name: '發送' }).click();

    // The critical-ack checkbox must be present and required
    const ack = page.getByTestId('critical-ack');
    await expect(ack).toBeVisible();
    const confirmBtn = page.getByRole('button', { name: '確認發送' });
    await expect(confirmBtn).toBeDisabled();
    await ack.check();
    await expect(confirmBtn).toBeEnabled();

    // Cancel out — we don't actually send in E2E to avoid email side-effects.
    await page.getByRole('button', { name: '取消' }).click();
    await expect(ack).not.toBeVisible();
  });

  test('API rejects critical send without identity/status/tier filter', async ({ request }) => {
    const res = await request.post('/api/admin/send', {
      data: {
        subject: 'Should be rejected',
        body: 'No filter provided',
        category: 'critical',
        groups: ['subscribers'], // groups alone is not enough for critical
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('重大通知');
  });

  test('API accepts non-critical send with only groups filter (regression)', async ({ request }) => {
    // Guard regression: non-critical sends with `groups` alone must still work.
    // We only test the validation path — use a subject that makes side-effects
    // auditable, and rely on the 1/min rate limit + 'test' group to avoid blast.
    const res = await request.post('/api/admin/send', {
      data: {
        subject: 'E2E validation probe (test-only)',
        body: 'Validation probe',
        category: 'newsletter',
        groups: ['test'], // sends to the admin's own email only
      },
    });
    // Either 200 (enqueued to self) or 429 (rate-limited from a prior run) is
    // acceptable; 400 would indicate the guard incorrectly blocked non-critical.
    expect([200, 429]).toContain(res.status());
  });
});
```

- [ ] **Step 2: Ensure `DEV_SIGNIN_SECRET` is set in `.env.local`**

Per CLAUDE.md, Playwright's `auth.setup.ts` logs in as `kk@dna.org.tw` via `/api/auth/dev-signin`. If `DEV_SIGNIN_SECRET` is unset, set it to any non-empty string (e.g. `dev-only-local-secret`).

- [ ] **Step 3: Run the spec**

```bash
npm run e2e -- admin-critical-notification.spec.ts
```

Expected: all three tests pass.

If the admin layout `/admin/send` renders a login form even after dev-signin, it means the auth cookie didn't attach to the admin layout's `useAuth()` hook (different from Supabase session). Investigate `contexts/AuthContext.tsx` and confirm the session is picked up via Supabase's cookie-based client. Do **not** mutate DB state or insert fake tokens (per `feedback_ui_verification.md`).

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/admin-critical-notification.spec.ts
git commit -m "test(e2e): critical notification admin flow"
```

---

## Task 12: Production verification + env var + final checks

**Files:**
- Modify: `.env.production.local` (not tracked — apply to the running deploy via the hosting provider's env UI)

- [ ] **Step 1: Set `CUSTOMER_SUPPORT_EMAIL` in production env**

Add `CUSTOMER_SUPPORT_EMAIL=info@dna.org.tw` (or whatever the team chooses). Skip this step if the fallback is acceptable — the code defaults to `info@dna.org.tw`.

- [ ] **Step 2: Deploy + verify footer rendering end-to-end**

Against prod with `kk@dna.org.tw` as the only test account:

1. Open `/admin/send`, pick 重大通知, pick 身份 = Backer, check `testOnly`, write a disposable subject/body, send.
2. Check inbox. Footer should:
   - Have the red-tinted "履約必要通知" block
   - Have NO `Unsubscribe` link
   - Still have `Taiwan Digital Fest 2026` + physical address (CAN-SPAM)
3. Open `/admin/history`. The just-sent entry should display the red 重大通知 badge.

- [ ] **Step 3: Verify unsubscribe page copy (public route, self-verifiable)**

Per `feedback_ui_verification.md`, `/newsletter/unsubscribe` is a public route — Claude may Playwright it.

```bash
npm run dev
```

Navigate to `http://localhost:3100/newsletter/unsubscribe` via Playwright, trigger the form flow (email-only path with `kk@dna.org.tw`), follow the email confirmation link, and confirm the success screen now shows the `criticalNote` line below `successNote`.

Screenshots go to `.screenshots/2026-04-19/` per CLAUDE.md.

- [ ] **Step 4: Sanity-check the suppression semantics on a real address**

Via the Supabase MCP `execute_sql` tool against the production project:

```sql
-- Pick one unsubscribed test address (e.g., kk@dna.org.tw if it's been
-- through the unsubscribe flow during testing) and confirm the critical
-- recipients query includes it while normal queries do not.
SELECT email, suppressed, suppression_reason
  FROM members_enriched
 WHERE email = 'kk@dna.org.tw';
```

Expected: if `suppressed = true` and `suppression_reason = 'unsubscribed'`, the critical branch (`suppressed = false OR suppression_reason = 'unsubscribed'`) will include this row; the normal branch (`suppressed = false`) will not.

- [ ] **Step 5: Final commit if any env/docs updates were made**

```bash
git status
# If anything changed:
git add -p
git commit -m "chore: critical notification rollout verification"
```

---

## Scope Boundaries (re-stated from spec, with YAGNI refinements)

- No `pref_critical` column, no member-facing toggle
- No role-based gating beyond `@dna.org.tw` admin gate
- No second-person approval
- No subject auto-prefix
- No changes to transactional emails (`order_success`, `magic_link`, etc.) — those already skip prefs via their own code path
- **Preview pane footer is NOT modified.** The current `/admin/send` preview iframe renders `body` + brand wrapper only, with no compliance footer for any category. Adding a footer just for critical would be inconsistent. Admins see the real critical footer via the `testOnly` self-send round-trip. (The spec mentioned "replace the unsubscribe footer placeholder" — there is no such placeholder today, so nothing to replace.)
