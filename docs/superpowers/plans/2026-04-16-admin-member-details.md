# Admin Member Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/admin/members` rows clickable; the detail page shows everything the system knows about a single member (orders, email logs, newsletter, award votes, visitors, tracking events). Add a real `members` table with human-friendly `M00042` numbers and 5 basic operations.

**Architecture:** New `members` table sits beside existing tables, auto-populated via DB triggers when any email is inserted into `orders` / `newsletter_subscriptions` / `email_logs`. A single aggregate GET endpoint returns every slice of data; the detail page renders them all on one scrollable page. Actions live at sibling endpoints under `/api/admin/members/[memberNo]/`.

**Tech Stack:** Next.js 16 App Router, Supabase (service role), Mailgun, Tailwind 4, TypeScript strict.

**Repo conventions:**
- No test framework — verification steps are DB inspection + manual browser checks captured as screenshots in `.screenshots/2026-04-16/`.
- Lint before each commit: `npm run lint`.
- All admin API routes start with `const session = await getAdminSession(req); if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });`.
- Emails are always lowercased and trimmed at boundaries.
- Commit message convention: look at `git log --oneline -10` — use `feat:` / `fix:` / `docs:` prefixes with imperative summaries.

**Design reference:** `docs/superpowers/specs/2026-04-16-admin-member-details-design.md`

---

## Task 1: Create `members` table + backfill + triggers

**Files:**
- Create: `supabase/migrations/create_members_table.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/create_members_table.sql` with exactly this content:

```sql
-- Create members table — stable identity per email across the system.
-- Member numbers (M00001, M00002, ...) are generated from id.

CREATE TABLE IF NOT EXISTS members (
  id BIGSERIAL PRIMARY KEY,
  member_no TEXT GENERATED ALWAYS AS ('M' || LPAD(id::text, 5, '0')) STORED UNIQUE,
  email TEXT NOT NULL UNIQUE,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_members_email_lower ON members (LOWER(email));

ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE members FORCE ROW LEVEL SECURITY;

COMMENT ON TABLE members IS
  'Stable identity per email. Auto-populated by triggers on orders/newsletter_subscriptions/email_logs.';

-- ---------------------------------------------------------------------------
-- Backfill from existing data, ordered by earliest appearance so older
-- members receive smaller numbers.
-- ---------------------------------------------------------------------------
INSERT INTO members (email, first_seen_at)
SELECT email, MIN(seen_at) AS first_seen_at
FROM (
  SELECT lower(trim(customer_email)) AS email, created_at AS seen_at
    FROM orders
    WHERE customer_email IS NOT NULL AND trim(customer_email) <> ''
  UNION ALL
  SELECT lower(trim(email)), created_at
    FROM newsletter_subscriptions
    WHERE email IS NOT NULL AND trim(email) <> ''
  UNION ALL
  SELECT lower(trim(to_email)), created_at
    FROM email_logs
    WHERE to_email IS NOT NULL AND trim(to_email) <> ''
) t
GROUP BY email
ORDER BY MIN(seen_at) ASC
ON CONFLICT (email) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Auto-insert function + triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_member_from_email()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_email TEXT;
BEGIN
  -- Pull the right column from the row depending on which table fired.
  IF TG_TABLE_NAME = 'orders' THEN
    v_email := NEW.customer_email;
  ELSIF TG_TABLE_NAME = 'newsletter_subscriptions' THEN
    v_email := NEW.email;
  ELSIF TG_TABLE_NAME = 'email_logs' THEN
    v_email := NEW.to_email;
  ELSE
    RETURN NEW;
  END IF;

  IF v_email IS NOT NULL AND trim(v_email) <> '' THEN
    INSERT INTO members (email)
    VALUES (lower(trim(v_email)))
    ON CONFLICT (email) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_member_orders ON orders;
CREATE TRIGGER trg_ensure_member_orders
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_member_from_email();

DROP TRIGGER IF EXISTS trg_ensure_member_newsletter ON newsletter_subscriptions;
CREATE TRIGGER trg_ensure_member_newsletter
  BEFORE INSERT ON newsletter_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_member_from_email();

DROP TRIGGER IF EXISTS trg_ensure_member_email_logs ON email_logs;
CREATE TRIGGER trg_ensure_member_email_logs
  BEFORE INSERT ON email_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_member_from_email();
```

- [ ] **Step 2: Apply the migration to Supabase**

Apply via Supabase Dashboard SQL editor (this project applies migrations manually per existing files which are idempotent). Run the file contents. Expected: no errors; many rows inserted into `members`.

- [ ] **Step 3: Verify backfill**

Run in SQL editor:

```sql
SELECT COUNT(*) FROM members;
SELECT member_no, email, first_seen_at FROM members ORDER BY id ASC LIMIT 5;
SELECT member_no, email, first_seen_at FROM members ORDER BY id DESC LIMIT 5;
```

Expected: count > 0 equal to distinct emails across the three source tables; earliest emails have `M00001`, `M00002`, etc.

- [ ] **Step 4: Verify triggers work**

```sql
-- Pick an email that isn't yet in members
SELECT 'trigger-test@example.com' WHERE NOT EXISTS (
  SELECT 1 FROM members WHERE email = 'trigger-test@example.com'
);

-- Insert a minimal newsletter_subscriptions row
INSERT INTO newsletter_subscriptions (email) VALUES ('trigger-test@example.com');

SELECT member_no, email FROM members WHERE email = 'trigger-test@example.com';

-- Cleanup
DELETE FROM newsletter_subscriptions WHERE email = 'trigger-test@example.com';
DELETE FROM members WHERE email = 'trigger-test@example.com';
```

Expected: after the INSERT, the SELECT returns a row with an `Mxxxxx` number.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/create_members_table.sql
git commit -m "feat(db): add members table with backfill and auto-insert triggers"
```

---

## Task 2: Update `members_enriched` view to expose `member_no`

**Files:**
- Create: `supabase/migrations/update_members_enriched_with_member_no.sql`

- [ ] **Step 1: Copy the existing view definition**

Read `supabase/migrations/create_members_enriched_view.sql`. The new migration is the **same view** with three extra columns from a LEFT JOIN to `members`. Do not change any existing logic.

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/update_members_enriched_with_member_no.sql`:

```sql
-- Replace members_enriched view to expose member_id, member_no, first_seen_at
-- from the new members table. All existing columns unchanged.

CREATE OR REPLACE VIEW members_enriched AS
WITH
all_emails AS (
  SELECT DISTINCT lower(trim(customer_email)) AS email
  FROM orders
  WHERE customer_email IS NOT NULL AND trim(customer_email) <> ''
  UNION
  SELECT DISTINCT lower(trim(email)) AS email
  FROM newsletter_subscriptions
  WHERE email IS NOT NULL AND trim(email) <> ''
  UNION
  SELECT DISTINCT lower(trim(to_email)) AS email
  FROM email_logs
  WHERE to_email IS NOT NULL AND trim(to_email) <> ''
),
order_agg AS (
  SELECT
    lower(trim(customer_email)) AS email,
    COUNT(*) FILTER (WHERE status = 'paid') AS paid_order_count,
    COUNT(*) FILTER (WHERE status = 'pending' AND created_at > NOW() - INTERVAL '7 days') AS active_pending_count,
    COUNT(*) FILTER (WHERE status IN ('expired', 'cancelled', 'failed')
                     OR (status = 'pending' AND created_at <= NOW() - INTERVAL '7 days')) AS abandoned_order_count,
    COALESCE(SUM(amount_total) FILTER (WHERE status = 'paid'), 0) AS total_spent_cents,
    MAX(created_at) FILTER (WHERE status = 'paid') AS last_paid_order_at,
    MAX(created_at) AS last_order_at,
    (ARRAY_AGG(customer_name ORDER BY created_at DESC) FILTER (WHERE customer_name IS NOT NULL))[1] AS latest_name,
    (ARRAY_AGG(customer_phone ORDER BY created_at DESC) FILTER (WHERE customer_phone IS NOT NULL))[1] AS latest_phone,
    (ARRAY_AGG(currency ORDER BY created_at DESC) FILTER (WHERE status = 'paid'))[1] AS latest_paid_currency,
    (ARRAY_AGG(ticket_tier ORDER BY CASE ticket_tier
        WHEN 'backer' THEN 4
        WHEN 'weekly_backer' THEN 3
        WHEN 'contribute' THEN 2
        WHEN 'explore' THEN 1
        ELSE 0 END DESC, created_at DESC)
      FILTER (WHERE status = 'paid'))[1] AS highest_ticket_tier,
    COALESCE(SUM(CASE
      WHEN status = 'paid' AND ticket_tier = 'backer' THEN 40
      WHEN status = 'paid' AND ticket_tier = 'weekly_backer' THEN 25
      WHEN status = 'paid' AND ticket_tier = 'contribute' THEN 15
      WHEN status = 'paid' AND ticket_tier = 'explore' THEN 8
      ELSE 0 END), 0) AS ticket_score
  FROM orders
  WHERE customer_email IS NOT NULL AND trim(customer_email) <> ''
  GROUP BY lower(trim(customer_email))
),
newsletter_agg AS (
  SELECT DISTINCT lower(trim(email)) AS email, TRUE AS subscribed
  FROM newsletter_subscriptions
  WHERE email IS NOT NULL AND trim(email) <> ''
),
email_agg AS (
  SELECT
    lower(trim(to_email)) AS email,
    COUNT(*) FILTER (WHERE status = 'sent') AS sent_count,
    0::int AS open_count,
    0::int AS click_count,
    MAX(created_at) FILTER (WHERE status = 'sent') AS last_email_at
  FROM email_logs
  WHERE to_email IS NOT NULL AND trim(to_email) <> ''
  GROUP BY lower(trim(to_email))
)
SELECT
  e.email,
  m.id AS member_id,
  m.member_no,
  m.first_seen_at,
  oa.latest_name AS name,
  oa.latest_phone AS phone,
  CASE
    WHEN COALESCE(oa.paid_order_count, 0) > 0 THEN 'paid'
    WHEN COALESCE(oa.active_pending_count, 0) > 0 THEN 'pending'
    WHEN COALESCE(oa.abandoned_order_count, 0) > 0 THEN 'abandoned'
    WHEN na.subscribed IS TRUE THEN 'subscriber'
    ELSE 'other'
  END AS status,
  COALESCE(oa.paid_order_count, 0) AS paid_order_count,
  COALESCE(oa.total_spent_cents, 0) AS total_spent_cents,
  COALESCE(oa.latest_paid_currency, 'usd') AS currency,
  oa.highest_ticket_tier,
  oa.last_paid_order_at AS last_order_at,
  GREATEST(
    COALESCE(oa.last_order_at, 'epoch'::timestamptz),
    COALESCE(ea.last_email_at, 'epoch'::timestamptz)
  ) AS last_interaction_at,
  COALESCE(ea.sent_count, 0) AS email_sent_count,
  COALESCE(ea.open_count, 0) AS email_open_count,
  COALESCE(ea.click_count, 0) AS email_click_count,
  CASE
    WHEN COALESCE(ea.sent_count, 0) = 0 THEN NULL
    ELSE ROUND(COALESCE(ea.open_count, 0)::numeric / ea.sent_count, 4)
  END AS email_open_rate,
  (
    COALESCE(oa.ticket_score, 0)
    + CASE
        WHEN GREATEST(COALESCE(oa.last_order_at, 'epoch'::timestamptz), COALESCE(ea.last_email_at, 'epoch'::timestamptz))
             > NOW() - INTERVAL '30 days' THEN 10
        WHEN GREATEST(COALESCE(oa.last_order_at, 'epoch'::timestamptz), COALESCE(ea.last_email_at, 'epoch'::timestamptz))
             > NOW() - INTERVAL '90 days' THEN 5
        ELSE 0
      END
    + CASE WHEN COALESCE(ea.sent_count, 0) > 0
                AND COALESCE(ea.open_count, 0)::numeric / ea.sent_count > 0.5 THEN 5 ELSE 0 END
    + CASE WHEN COALESCE(ea.click_count, 0) > 0 THEN 5 ELSE 0 END
    + CASE WHEN COALESCE(oa.paid_order_count, 0) > 1 THEN 10 ELSE 0 END
  )::int AS score,
  CASE
    WHEN (
      COALESCE(oa.ticket_score, 0)
      + CASE
          WHEN GREATEST(COALESCE(oa.last_order_at, 'epoch'::timestamptz), COALESCE(ea.last_email_at, 'epoch'::timestamptz))
               > NOW() - INTERVAL '30 days' THEN 10
          WHEN GREATEST(COALESCE(oa.last_order_at, 'epoch'::timestamptz), COALESCE(ea.last_email_at, 'epoch'::timestamptz))
               > NOW() - INTERVAL '90 days' THEN 5
          ELSE 0 END
      + CASE WHEN COALESCE(ea.sent_count, 0) > 0
                  AND COALESCE(ea.open_count, 0)::numeric / ea.sent_count > 0.5 THEN 5 ELSE 0 END
      + CASE WHEN COALESCE(ea.click_count, 0) > 0 THEN 5 ELSE 0 END
      + CASE WHEN COALESCE(oa.paid_order_count, 0) > 1 THEN 10 ELSE 0 END
    ) >= 50 THEN 'S'
    WHEN (
      COALESCE(oa.ticket_score, 0)
      + CASE
          WHEN GREATEST(COALESCE(oa.last_order_at, 'epoch'::timestamptz), COALESCE(ea.last_email_at, 'epoch'::timestamptz))
               > NOW() - INTERVAL '30 days' THEN 10
          WHEN GREATEST(COALESCE(oa.last_order_at, 'epoch'::timestamptz), COALESCE(ea.last_email_at, 'epoch'::timestamptz))
               > NOW() - INTERVAL '90 days' THEN 5
          ELSE 0 END
      + CASE WHEN COALESCE(ea.sent_count, 0) > 0
                  AND COALESCE(ea.open_count, 0)::numeric / ea.sent_count > 0.5 THEN 5 ELSE 0 END
      + CASE WHEN COALESCE(ea.click_count, 0) > 0 THEN 5 ELSE 0 END
      + CASE WHEN COALESCE(oa.paid_order_count, 0) > 1 THEN 10 ELSE 0 END
    ) >= 20 THEN 'A'
    WHEN (
      COALESCE(oa.ticket_score, 0)
      + CASE
          WHEN GREATEST(COALESCE(oa.last_order_at, 'epoch'::timestamptz), COALESCE(ea.last_email_at, 'epoch'::timestamptz))
               > NOW() - INTERVAL '30 days' THEN 10
          WHEN GREATEST(COALESCE(oa.last_order_at, 'epoch'::timestamptz), COALESCE(ea.last_email_at, 'epoch'::timestamptz))
               > NOW() - INTERVAL '90 days' THEN 5
          ELSE 0 END
      + CASE WHEN COALESCE(ea.sent_count, 0) > 0
                  AND COALESCE(ea.open_count, 0)::numeric / ea.sent_count > 0.5 THEN 5 ELSE 0 END
      + CASE WHEN COALESCE(ea.click_count, 0) > 0 THEN 5 ELSE 0 END
      + CASE WHEN COALESCE(oa.paid_order_count, 0) > 1 THEN 10 ELSE 0 END
    ) >= 5 THEN 'B'
    ELSE 'C'
  END AS tier,
  COALESCE(na.subscribed, FALSE) AS subscribed_newsletter,
  (oa.email IS NOT NULL) AS in_orders
FROM all_emails e
LEFT JOIN members m ON m.email = e.email
LEFT JOIN order_agg oa ON oa.email = e.email
LEFT JOIN newsletter_agg na ON na.email = e.email
LEFT JOIN email_agg ea ON ea.email = e.email;

COMMENT ON VIEW members_enriched IS
  'Member universe with derived status/score/tier + member_no/member_id/first_seen_at from members table.';
```

- [ ] **Step 2: Apply and verify**

Apply via Supabase SQL editor. Verify:

```sql
SELECT member_no, email, tier, status FROM members_enriched ORDER BY member_no LIMIT 3;
```

Expected: rows return with `member_no` populated.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/update_members_enriched_with_member_no.sql
git commit -m "feat(db): expose member_no in members_enriched view"
```

---

## Task 3: Update `lib/members.ts` types

**Files:**
- Modify: `lib/members.ts`

- [ ] **Step 1: Add new fields to `EnrichedMember`**

In `lib/members.ts`, inside the `EnrichedMember` interface (around line 35), add three new fields **at the top** of the interface so they appear first:

```ts
export interface EnrichedMember {
  member_id: number;
  member_no: string;
  first_seen_at: string;
  email: string;
  name: string | null;
  phone: string | null;
  status: MemberStatus;
  // ... rest unchanged
}
```

- [ ] **Step 2: Verify lint passes**

```bash
npm run lint
```

Expected: no new errors introduced.

- [ ] **Step 3: Commit**

```bash
git add lib/members.ts
git commit -m "feat(types): add member_no fields to EnrichedMember"
```

---

## Task 4: List page — add `編號` column + clickable rows

**Files:**
- Modify: `app/admin/members/page.tsx`

- [ ] **Step 1: Add Link import**

At the top of `app/admin/members/page.tsx`, add:

```ts
import Link from 'next/link';
```

- [ ] **Step 2: Add column header**

Find the `<thead>` block. Insert a new `<th>` as the **first** column:

```tsx
<th className="text-left px-4 py-3 font-medium text-slate-600">編號</th>
```

(The colspan value `9` on the empty-state row must change to `10`.)

- [ ] **Step 3: Add `member_no` cell and wrap each row**

Replace the `<tr key={m.email}>` block with a row that links to the detail page. Use `member_no` as the slug — fall back to encoded email if missing (defensive only; backfill should cover all):

```tsx
{members.map((m) => {
  const slug = m.member_no || encodeURIComponent(m.email);
  return (
    <tr key={m.email} className="border-b border-slate-100 hover:bg-slate-50">
      <td className="px-4 py-3 font-mono text-xs text-slate-500">
        <Link href={`/admin/members/${slug}`} className="hover:text-[#10B8D9] hover:underline">
          {m.member_no || '-'}
        </Link>
      </td>
      <td className="px-4 py-3 text-slate-900 font-medium">
        <Link href={`/admin/members/${slug}`} className="hover:underline">
          {m.name || '-'}
        </Link>
      </td>
      <td className="px-4 py-3 text-slate-600">
        <Link href={`/admin/members/${slug}`} className="hover:underline">
          {m.email}
        </Link>
      </td>
      {/* existing cells: status, tier, highest_ticket_tier, paid_order_count, total_spent, score, last_interaction_at — unchanged */}
    </tr>
  );
})}
```

Keep the remaining cells as they are — only the first three (編號, 姓名, Email) need to be wrapped in Links for click targets. The other cells remain plain `<td>` (the hover style on the `<tr>` gives the affordance).

- [ ] **Step 4: Update skeleton loader colspan**

The skeleton row must span 10 columns now. In the loading branch:

```tsx
Array.from({ length: 5 }).map((_, i) => (
  <tr key={i} className="border-b border-slate-100">
    {Array.from({ length: 10 }).map((_, j) => (
      <td key={j} className="px-4 py-3">
        <div className="h-4 bg-slate-200 rounded animate-pulse w-20" />
      </td>
    ))}
  </tr>
))
```

And the empty-state:

```tsx
<td colSpan={10} className="px-4 py-12 text-center text-slate-400">
```

- [ ] **Step 5: Run dev server, smoke-test**

```bash
npm run dev
```

Open http://localhost:3000/admin/members — expected: 編號 column visible on the left showing Mxxxxx; hovering a row shows pointer on name/email; clicking goes to `/admin/members/Mxxxxx` which will 404 until Task 7.

Capture screenshot to `.screenshots/2026-04-16/members-list.png`.

- [ ] **Step 6: Lint + commit**

```bash
npm run lint
git add app/admin/members/page.tsx
git commit -m "feat(admin): add 編號 column and link rows to detail page"
```

---

## Task 5: Resolver helper `lib/adminMembers.ts`

**Files:**
- Create: `lib/adminMembers.ts`

- [ ] **Step 1: Write the helper**

Create `lib/adminMembers.ts`:

```ts
import { supabaseServer } from '@/lib/supabaseServer';

export interface MemberRow {
  id: number;
  member_no: string;
  email: string;
  first_seen_at: string;
  created_at: string;
}

const MEMBER_NO_PATTERN = /^M\d+$/;

/**
 * Look up a member by slug — either member_no (M00042) or URL-encoded email.
 * Emails are normalised to lower+trim for the lookup.
 */
export async function resolveMember(slug: string): Promise<MemberRow | null> {
  if (!supabaseServer) return null;

  const raw = decodeURIComponent(slug || '').trim();
  if (!raw) return null;

  if (MEMBER_NO_PATTERN.test(raw)) {
    const { data } = await supabaseServer
      .from('members')
      .select('id, member_no, email, first_seen_at, created_at')
      .eq('member_no', raw)
      .maybeSingle();
    return (data as MemberRow | null) ?? null;
  }

  const email = raw.toLowerCase();
  const { data } = await supabaseServer
    .from('members')
    .select('id, member_no, email, first_seen_at, created_at')
    .eq('email', email)
    .maybeSingle();
  return (data as MemberRow | null) ?? null;
}
```

- [ ] **Step 2: Lint + commit**

```bash
npm run lint
git add lib/adminMembers.ts
git commit -m "feat(admin): add resolveMember helper for member_no/email lookup"
```

---

## Task 6: GET aggregate endpoint `/api/admin/members/[memberNo]`

**Files:**
- Create: `app/api/admin/members/[memberNo]/route.ts`

- [ ] **Step 1: Write the route**

Create `app/api/admin/members/[memberNo]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';
import { resolveMember } from '@/lib/adminMembers';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ memberNo: string }> },
) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'Database not configured' }, { status: 500 });

  const { memberNo } = await ctx.params;
  const member = await resolveMember(memberNo);
  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const email = member.email;

  try {
    const [
      enrichedRes,
      ordersRes,
      newsletterRes,
      emailLogsRes,
      awardVotesRes,
    ] = await Promise.all([
      supabaseServer.from('members_enriched').select('*').eq('email', email).maybeSingle(),
      supabaseServer.from('orders').select('*').ilike('customer_email', email).order('created_at', { ascending: false }),
      supabaseServer.from('newsletter_subscriptions').select('*').ilike('email', email).maybeSingle(),
      supabaseServer.from('email_logs').select('*').ilike('to_email', email).order('created_at', { ascending: false }).limit(200),
      supabaseServer.from('award_votes').select('*').ilike('email', email).order('created_at', { ascending: false }),
    ]);

    const orders = ordersRes.data ?? [];
    const emailLogs = emailLogsRes.data ?? [];

    // Collect visitor_ids from orders + newsletter to fetch visitors + tracking events
    const visitorIds = Array.from(
      new Set(
        [
          ...orders.map((o: { visitor_id?: string | null }) => o.visitor_id),
          newsletterRes.data ? (newsletterRes.data as { visitor_id?: string | null }).visitor_id : null,
        ].filter((v): v is string => !!v),
      ),
    );

    let visitors: unknown[] = [];
    let trackingEvents: unknown[] = [];
    if (visitorIds.length > 0) {
      const [vRes, tRes] = await Promise.all([
        supabaseServer.from('visitors').select('*').in('fingerprint', visitorIds),
        supabaseServer
          .from('tracking_events')
          .select('event_name, parameters, occurred_at, created_at')
          .order('occurred_at', { ascending: false })
          .limit(50)
          .or(
            visitorIds
              .map((id) => `parameters->>visitor_id.eq.${id}`)
              .join(','),
          ),
      ]);
      visitors = vRes.data ?? [];
      trackingEvents = tRes.data ?? [];
    }

    // Notification campaigns that might have hit this member.
    // email_logs already has notification_id when sent through the queue; use those IDs.
    const notificationIds = Array.from(
      new Set(
        emailLogs
          .map((l: { notification_id?: string | null }) => l.notification_id)
          .filter((v): v is string => !!v),
      ),
    );
    let notificationCampaigns: unknown[] = [];
    if (notificationIds.length > 0) {
      const { data } = await supabaseServer
        .from('notification_logs')
        .select('id, subject, recipient_count, status, sent_by, created_at')
        .in('id', notificationIds)
        .order('created_at', { ascending: false });
      notificationCampaigns = data ?? [];
    }

    return NextResponse.json({
      member,
      enriched: enrichedRes.data,
      orders,
      newsletter: newsletterRes.data,
      email_logs: emailLogs,
      notification_campaigns: notificationCampaigns,
      award_votes: awardVotesRes.data ?? [],
      visitors,
      tracking_events: trackingEvents,
    });
  } catch (err) {
    console.error('[Admin Member Detail]', err);
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify dev server boot**

```bash
npm run dev
```

In another shell:
```bash
curl -i "http://localhost:3000/api/admin/members/M00001"
```

Expected without session cookie: `HTTP/1.1 401 Unauthorized`.

- [ ] **Step 3: Verify with admin session**

Open DevTools on `/admin/members` (you should be logged in), then in the browser console:

```js
fetch('/api/admin/members/M00001').then(r => r.json()).then(console.log)
```

Expected: JSON with `member`, `enriched`, `orders`, `email_logs`, etc. populated. If visitor_ids exist, `visitors` and `tracking_events` are non-empty.

If the tracking events `.or(...)` syntax fails (Supabase JSONB operator syntax has quirks), temporarily reduce to fetching tracking events by inspecting `parameters` on the client side — but first try as written. If it fails, replace the `.or(...)` chain with:

```ts
supabaseServer
  .from('tracking_events')
  .select('event_name, parameters, occurred_at, created_at')
  .order('occurred_at', { ascending: false })
  .limit(500)
  .then((r) => ({
    ...r,
    data: (r.data ?? []).filter((ev: { parameters: Record<string, unknown> }) =>
      visitorIds.includes(String(ev.parameters?.visitor_id ?? '')),
    ).slice(0, 50),
  })),
```

(Fetch 500, filter client-side to 50. Acceptable given admin-only low volume.)

- [ ] **Step 4: Lint + commit**

```bash
npm run lint
git add app/api/admin/members/M00001 app/api/admin/members
git commit -m "feat(admin): add GET /api/admin/members/[memberNo] aggregate endpoint"
```

---

## Task 7: Detail page `app/admin/members/[memberNo]/page.tsx`

**Files:**
- Create: `app/admin/members/[memberNo]/page.tsx`

- [ ] **Step 1: Write the page**

Create the file. This is a client component that fetches the aggregate endpoint and renders all sections. Keep styling consistent with `app/admin/orders/page.tsx` (`bg-white rounded-xl shadow-sm` cards, slate palette, `#10B8D9` accent).

```tsx
'use client';

import { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import {
  type EnrichedMember,
  STATUS_LABELS_ZH,
  STATUS_BADGE_CLASSES,
  TIER_LABELS_ZH,
  TIER_BADGE_CLASSES,
  TICKET_TIER_LABELS,
  TICKET_TIER_BADGE_CLASSES,
} from '@/lib/members';

interface MemberRow {
  id: number;
  member_no: string;
  email: string;
  first_seen_at: string;
  created_at: string;
}

interface Order {
  id: string;
  stripe_session_id: string;
  stripe_payment_intent_id: string | null;
  ticket_tier: string;
  status: string;
  amount_total: number;
  amount_discount: number;
  currency: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: Record<string, unknown> | null;
  payment_method_brand: string | null;
  payment_method_last4: string | null;
  payment_method_type: string | null;
  visitor_id: string | null;
  created_at: string;
  updated_at: string;
}

interface NewsletterSub {
  id: string;
  email: string;
  source: string | null;
  timezone: string | null;
  locale: string | null;
  country: string | null;
  ip_address: string | null;
  visitor_id: string | null;
  created_at: string;
}

interface EmailLog {
  id: string;
  to_email: string;
  subject: string | null;
  email_type: string;
  status: string;
  error_message: string | null;
  notification_id: string | null;
  mailgun_message_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface NotificationCampaign {
  id: string;
  subject: string;
  recipient_count: number;
  status: string;
  sent_by: string;
  created_at: string;
}

interface AwardVote {
  id: string;
  post_id: string;
  email: string;
  confirmed: boolean;
  token: string | null;
  created_at: string;
  confirmed_at: string | null;
}

interface Visitor {
  fingerprint: string;
  ip_address: string | null;
  timezone: string | null;
  locale: string | null;
  user_agent: string | null;
  country: string | null;
  created_at: string;
  updated_at: string;
}

interface TrackingEvent {
  event_name: string;
  parameters: Record<string, unknown>;
  occurred_at: string;
  created_at: string;
}

interface MemberDetail {
  member: MemberRow;
  enriched: EnrichedMember | null;
  orders: Order[];
  newsletter: NewsletterSub | null;
  email_logs: EmailLog[];
  notification_campaigns: NotificationCampaign[];
  award_votes: AwardVote[];
  visitors: Visitor[];
  tracking_events: TrackingEvent[];
}

function formatAmount(cents: number, currency: string) {
  return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

function formatDateTime(s: string | null | undefined) {
  if (!s) return '-';
  return new Date(s).toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Taipei',
  });
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl shadow-sm p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-slate-900">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="text-slate-900 font-semibold text-lg">{value}</div>
    </div>
  );
}

export default function MemberDetailPage({ params }: { params: Promise<{ memberNo: string }> }) {
  const { memberNo } = use(params);
  const [data, setData] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sendOpen, setSendOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/members/${encodeURIComponent(memberNo)}`);
      if (res.status === 404) {
        setError('查無此會員');
      } else if (!res.ok) {
        setError('載入失敗');
      } else {
        setData(await res.json());
      }
    } catch {
      setError('載入失敗');
    } finally {
      setLoading(false);
    }
  }, [memberNo]);

  useEffect(() => { load(); }, [load]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleUnsubscribe = async () => {
    if (!confirm('確定要將此會員從電子報退訂嗎？')) return;
    const res = await fetch(`/api/admin/members/${encodeURIComponent(memberNo)}/unsubscribe`, { method: 'POST' });
    if (res.ok) { showToast('已取消訂閱'); load(); }
    else { showToast('退訂失敗'); }
  };

  const handleResend = async (orderId: string) => {
    if (!confirm('重新寄送訂單確認信？')) return;
    const res = await fetch(`/api/admin/members/${encodeURIComponent(memberNo)}/resend-confirmation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) { showToast('已重寄確認信'); load(); }
    else { showToast(`重寄失敗：${body.error || res.status}`); }
  };

  if (loading) {
    return (
      <div>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-64" />
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-slate-200 rounded-xl" />)}
          </div>
          <div className="h-48 bg-slate-200 rounded-xl" />
          <div className="h-64 bg-slate-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-xl p-8 text-center shadow-sm">
        <p className="text-slate-600 mb-3">{error || '查無此會員'} {memberNo}</p>
        <Link href="/admin/members" className="text-[#10B8D9] hover:underline">← 回會員列表</Link>
      </div>
    );
  }

  const { member, enriched, orders, newsletter, email_logs, notification_campaigns, award_votes, visitors, tracking_events } = data;

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed top-6 right-6 bg-slate-900 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <Link href="/admin/members" className="text-sm text-slate-500 hover:text-[#10B8D9]">← 回會員列表</Link>
        <div className="flex flex-wrap items-start justify-between gap-4 mt-2">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900 font-mono">{member.member_no}</h1>
              {enriched && (
                <>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE_CLASSES[enriched.status]}`}>
                    {STATUS_LABELS_ZH[enriched.status]}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TIER_BADGE_CLASSES[enriched.tier]}`}>
                    {TIER_LABELS_ZH[enriched.tier]}
                  </span>
                  <span className="text-sm text-slate-500">score: <span className="font-mono text-slate-900">{enriched.score}</span></span>
                </>
              )}
            </div>
            <div className="text-slate-600 mt-1">{member.email}</div>
            <div className="text-xs text-slate-400 mt-1">首次出現：{formatDateTime(member.first_seen_at)}</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setSendOpen(true)} className="px-3 py-1.5 text-sm bg-[#10B8D9] text-white rounded-lg hover:bg-[#0EA5C4]">寄信</button>
            <button onClick={handleUnsubscribe} disabled={!enriched?.subscribed_newsletter} className="px-3 py-1.5 text-sm bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">取消訂閱</button>
            <a href={`/api/admin/members/${encodeURIComponent(memberNo)}/export`} className="px-3 py-1.5 text-sm bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">匯出 JSON</a>
          </div>
        </div>
      </div>

      {/* KPIs */}
      {enriched && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="總消費" value={enriched.total_spent_cents > 0 ? formatAmount(enriched.total_spent_cents, enriched.currency) : '-'} />
          <Kpi label="訂單數" value={String(enriched.paid_order_count)} />
          <Kpi label="電子報" value={enriched.subscribed_newsletter ? '已訂閱' : '未訂閱'} />
          <Kpi label="最近互動" value={formatDateTime(enriched.last_interaction_at)} />
        </div>
      )}

      {/* Identity & Contact */}
      <Section title="Identity & Contact">
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div className="flex gap-2"><dt className="text-slate-500 w-28 shrink-0">姓名</dt><dd className="text-slate-900">{enriched?.name || '-'}</dd></div>
          <div className="flex gap-2"><dt className="text-slate-500 w-28 shrink-0">電話</dt><dd className="text-slate-900">{enriched?.phone || '-'}</dd></div>
          <div className="flex gap-2"><dt className="text-slate-500 w-28 shrink-0">電子報</dt><dd className="text-slate-900">{enriched?.subscribed_newsletter ? '已訂閱' : '未訂閱'}</dd></div>
          <div className="flex gap-2"><dt className="text-slate-500 w-28 shrink-0">來源</dt><dd className="text-slate-900">{newsletter?.source || '-'}</dd></div>
          <div className="flex gap-2"><dt className="text-slate-500 w-28 shrink-0">Timezone</dt><dd className="text-slate-900">{newsletter?.timezone || '-'}</dd></div>
          <div className="flex gap-2"><dt className="text-slate-500 w-28 shrink-0">Locale</dt><dd className="text-slate-900">{newsletter?.locale || '-'}</dd></div>
          <div className="flex gap-2"><dt className="text-slate-500 w-28 shrink-0">國家</dt><dd className="text-slate-900">{newsletter?.country || '-'}</dd></div>
          <div className="flex gap-2"><dt className="text-slate-500 w-28 shrink-0">地址</dt><dd className="text-slate-900 font-mono text-xs break-all">{orders[0]?.customer_address ? JSON.stringify(orders[0].customer_address) : '-'}</dd></div>
        </dl>
      </Section>

      {/* Orders */}
      <Section title={`訂單 (${orders.length})`}>
        {orders.length === 0 ? <p className="text-sm text-slate-400">沒有訂單</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-3 py-2 font-medium text-slate-600">ID</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Tier</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">狀態</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-600">金額</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">付款方式</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">建立</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const tier = o.ticket_tier as keyof typeof TICKET_TIER_LABELS;
                  return (
                    <tr key={o.id} className="border-b border-slate-100">
                      <td className="px-3 py-2 font-mono text-xs text-slate-500">{o.id.slice(0, 8)}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${TICKET_TIER_BADGE_CLASSES[tier] || 'bg-slate-100 text-slate-600'}`}>
                          {TICKET_TIER_LABELS[tier] || o.ticket_tier}
                        </span>
                      </td>
                      <td className="px-3 py-2">{o.status}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatAmount(o.amount_total, o.currency)}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        {o.payment_method_brand && o.payment_method_last4 ? `${o.payment_method_brand} •••• ${o.payment_method_last4}` : '-'}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">{formatDateTime(o.created_at)}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex gap-1 justify-end">
                          <a
                            href={`https://dashboard.stripe.com/payments/${o.stripe_payment_intent_id || o.stripe_session_id}`}
                            target="_blank" rel="noreferrer"
                            className="text-xs text-slate-600 hover:text-[#10B8D9] px-2 py-1 border border-slate-200 rounded"
                          >Stripe</a>
                          {o.status === 'paid' && (
                            <button onClick={() => handleResend(o.id)} className="text-xs text-slate-600 hover:text-[#10B8D9] px-2 py-1 border border-slate-200 rounded">
                              重寄確認信
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Email History */}
      <Section title={`Email 記錄 (${email_logs.length})`}>
        {email_logs.length === 0 ? <p className="text-sm text-slate-400">無發信紀錄</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-3 py-2 font-medium text-slate-600">時間</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">類型</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">主旨</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">狀態</th>
                </tr>
              </thead>
              <tbody>
                {email_logs.map((l) => (
                  <tr key={l.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-xs text-slate-500">{formatDateTime(l.created_at)}</td>
                    <td className="px-3 py-2 text-xs text-slate-700">{l.email_type}</td>
                    <td className="px-3 py-2 text-slate-900">{l.subject || '-'}</td>
                    <td className="px-3 py-2 text-xs">
                      <span className={l.status === 'sent' ? 'text-green-700' : l.status === 'failed' ? 'text-red-700' : 'text-slate-600'}>
                        {l.status}
                      </span>
                      {l.error_message && <div className="text-xs text-red-600 mt-0.5">{l.error_message}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {notification_campaigns.length > 0 && (
          <div className="mt-4">
            <div className="text-xs text-slate-500 mb-1">相關群發活動</div>
            <ul className="text-sm space-y-1">
              {notification_campaigns.map((c) => (
                <li key={c.id} className="flex justify-between text-slate-700">
                  <span>{c.subject}</span>
                  <span className="text-xs text-slate-500">{formatDateTime(c.created_at)}（{c.recipient_count}）</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      {/* Award Votes */}
      <Section title={`Nomad Award 投票 (${award_votes.length})`}>
        {award_votes.length === 0 ? <p className="text-sm text-slate-400">無投票紀錄</p> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-3 py-2 font-medium text-slate-600">Post</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">狀態</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">投票時間</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">確認時間</th>
              </tr>
            </thead>
            <tbody>
              {award_votes.map((v) => (
                <tr key={v.id} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-mono text-xs">
                    <a href={`https://instagram.com/p/${v.post_id}`} target="_blank" rel="noreferrer" className="text-[#10B8D9] hover:underline">{v.post_id}</a>
                  </td>
                  <td className="px-3 py-2 text-xs">{v.confirmed ? '已確認' : '待確認'}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{formatDateTime(v.created_at)}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{formatDateTime(v.confirmed_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Device & Visitor */}
      <Section title={`裝置與訪客 (${visitors.length})`}>
        {visitors.length === 0 ? <p className="text-sm text-slate-400">無裝置資料</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Fingerprint</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">IP</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">國家</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Timezone</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">UA</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">最近</th>
                </tr>
              </thead>
              <tbody>
                {visitors.map((v) => (
                  <tr key={v.fingerprint} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-mono text-xs text-slate-500">{v.fingerprint.slice(0, 12)}</td>
                    <td className="px-3 py-2 text-xs">{v.ip_address || '-'}</td>
                    <td className="px-3 py-2 text-xs">{v.country || '-'}</td>
                    <td className="px-3 py-2 text-xs">{v.timezone || '-'}</td>
                    <td className="px-3 py-2 text-xs text-slate-500 max-w-xs truncate" title={v.user_agent || ''}>{v.user_agent || '-'}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{formatDateTime(v.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Tracking Events */}
      <Section title={`追蹤事件 (${tracking_events.length})`}>
        {tracking_events.length === 0 ? <p className="text-sm text-slate-400">無事件</p> : (
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="text-left px-3 py-2 font-medium text-slate-600">時間</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Event</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Parameters</th>
                </tr>
              </thead>
              <tbody>
                {tracking_events.map((ev, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-xs text-slate-500">{formatDateTime(ev.occurred_at)}</td>
                    <td className="px-3 py-2 text-xs text-slate-900">{ev.event_name}</td>
                    <td className="px-3 py-2 text-xs text-slate-600 font-mono truncate max-w-md" title={JSON.stringify(ev.parameters)}>
                      {JSON.stringify(ev.parameters)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Raw JSON */}
      <Section title="Raw JSON">
        <details>
          <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-700">展開完整資料</summary>
          <pre className="mt-3 bg-slate-50 p-3 rounded-lg text-xs overflow-x-auto">{JSON.stringify(data, null, 2)}</pre>
        </details>
      </Section>

      {sendOpen && (
        <SendEmailModal
          memberNo={memberNo}
          email={member.email}
          onClose={() => setSendOpen(false)}
          onSent={() => { setSendOpen(false); showToast('信件已送出'); load(); }}
        />
      )}
    </div>
  );
}

function SendEmailModal({ memberNo, email, onClose, onSent }: {
  memberNo: string; email: string; onClose: () => void; onSent: () => void;
}) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const send = async () => {
    if (!subject.trim() || !body.trim()) { setErr('主旨與內容不可空白'); return; }
    setSending(true);
    setErr(null);
    const res = await fetch(`/api/admin/members/${encodeURIComponent(memberNo)}/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, body }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) { onSent(); }
    else { setErr(data.error || `寄送失敗 (${res.status})`); }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-xl shadow-xl p-5 max-w-lg w-full">
        <h3 className="text-lg font-semibold text-slate-900 mb-3">寄信給 {email}</h3>
        <input
          value={subject} onChange={(e) => setSubject(e.target.value)}
          placeholder="主旨"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 mb-2"
        />
        <textarea
          value={body} onChange={(e) => setBody(e.target.value)}
          placeholder="內容"
          rows={8}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 mb-2"
        />
        {err && <p className="text-sm text-red-600 mb-2">{err}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg text-slate-700">取消</button>
          <button onClick={send} disabled={sending} className="px-3 py-1.5 text-sm bg-[#10B8D9] text-white rounded-lg hover:bg-[#0EA5C4] disabled:opacity-50">
            {sending ? '寄送中...' : '寄送'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Smoke-test page**

Restart dev server if needed. Open `/admin/members`, click any row. Expected: page loads with all sections; missing data shows `-` or empty-state text. Buttons visible: 寄信 / 取消訂閱 / 匯出 JSON.

Capture screenshot to `.screenshots/2026-04-16/member-detail.png`.

Actions are not yet wired on the backend — pressing them will 404 until Tasks 8/9/10.

- [ ] **Step 3: Lint + commit**

```bash
npm run lint
git add app/admin/members/\[memberNo\]
git commit -m "feat(admin): add member detail page with all sections"
```

---

## Task 8: Send-email endpoint + wire modal

**Files:**
- Create: `app/api/admin/members/[memberNo]/send-email/route.ts`

- [ ] **Step 1: Write the route**

Create the file:

```ts
import { NextRequest, NextResponse } from 'next/server';
import formData from 'form-data';
import Mailgun from 'mailgun.js';
import { getAdminSession } from '@/lib/adminAuth';
import { resolveMember } from '@/lib/adminMembers';
import { logEmail } from '@/lib/emailLog';
import {
  buildComplianceFooterHtml,
  buildComplianceFooterText,
  buildMailgunComplianceOptions,
} from '@/lib/emailCompliance';

const mailgunApiKey = process.env.MAILGUN_API_KEY;
const mailgunDomain = process.env.MAILGUN_DOMAIN;
const fromRaw = process.env.EMAIL_FROM || `noreply@${mailgunDomain || 'example.com'}`;
const fromEmail = fromRaw.includes('<') ? fromRaw : `Taiwan Digital Fest <${fromRaw}>`;

const mailgunClient = mailgunApiKey && mailgunDomain
  ? new Mailgun(formData).client({ username: 'api', key: mailgunApiKey })
  : null;

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ memberNo: string }> },
) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { memberNo } = await ctx.params;
  const member = await resolveMember(memberNo);
  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const subject = String(body.subject || '').trim();
  const text = String(body.body || '').trim();
  if (!subject || !text) return NextResponse.json({ error: 'subject and body required' }, { status: 400 });

  if (!mailgunClient || !mailgunDomain) {
    return NextResponse.json({ error: 'Mailgun not configured' }, { status: 500 });
  }

  const bodyHtml = escapeHtml(text).replace(/\n/g, '<br>');
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="font-family:-apple-system,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:#1E1F1C;padding:30px;border-radius:8px;margin-bottom:20px;">
    <h1 style="color:#10B8D9;margin:0;font-size:24px;">Taiwan Digital Fest 2026</h1>
  </div>
  <div style="background:#f9f9f9;padding:30px;border-radius:8px;">
    <h2 style="color:#10B8D9;margin-top:0;">${escapeHtml(subject)}</h2>
    <div style="color:#333;font-size:16px;">${bodyHtml}</div>
  </div>
  ${buildComplianceFooterHtml({ email: member.email })}
</body></html>`;
  const plain = `${text}\n\n${buildComplianceFooterText({ email: member.email })}`;

  try {
    const response = await mailgunClient.messages.create(mailgunDomain, {
      from: fromEmail,
      to: [member.email],
      subject,
      html,
      text: plain,
      ...buildMailgunComplianceOptions({ unsubscribeEmail: member.email, tag: 'admin_one_off' }),
    });

    await logEmail({
      to_email: member.email,
      from_email: fromEmail,
      subject,
      email_type: 'admin_one_off',
      status: 'sent',
      mailgun_message_id: response.id || undefined,
      metadata: { sent_by: session.email, member_no: member.member_no },
    }).catch(() => {});

    return NextResponse.json({ ok: true, messageId: response.id });
  } catch (err) {
    const mg = err as { status?: number; message?: string; details?: string };
    const errMsg = [mg.status ? `HTTP ${mg.status}` : '', mg.message, mg.details].filter(Boolean).join(' — ');
    await logEmail({
      to_email: member.email,
      from_email: fromEmail,
      subject,
      email_type: 'admin_one_off',
      status: 'failed',
      error_message: errMsg,
      metadata: { sent_by: session.email, member_no: member.member_no },
    }).catch(() => {});
    console.error('[Admin Send Email]', err);
    return NextResponse.json({ error: errMsg || 'send failed' }, { status: 500 });
  }
}
```

**Check: does `lib/emailLog.ts` support the `email_type` value `'admin_one_off'`?** Read `lib/emailLog.ts`. If `EmailType` is a union that excludes it, add `'admin_one_off'` to the union. If it already accepts any string, skip this check.

- [ ] **Step 2: Test via UI**

Open a member detail page → click 寄信 → fill subject/body → send to a real address you own. Expected: toast 信件已送出; reload; Email History has a new row with type `admin_one_off`, status `sent`.

Capture screenshot `.screenshots/2026-04-16/send-email-modal.png`.

- [ ] **Step 3: Lint + commit**

```bash
npm run lint
git add app/api/admin/members/\[memberNo\]/send-email lib/emailLog.ts
git commit -m "feat(admin): add one-off send-email endpoint for member detail"
```

---

## Task 9: Unsubscribe + resend-confirmation endpoints

**Files:**
- Create: `app/api/admin/members/[memberNo]/unsubscribe/route.ts`
- Create: `app/api/admin/members/[memberNo]/resend-confirmation/route.ts`

- [ ] **Step 1: Write unsubscribe**

Create `app/api/admin/members/[memberNo]/unsubscribe/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';
import { resolveMember } from '@/lib/adminMembers';

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ memberNo: string }> },
) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'Database not configured' }, { status: 500 });

  const { memberNo } = await ctx.params;
  const member = await resolveMember(memberNo);
  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data, error } = await supabaseServer
    .from('newsletter_subscriptions')
    .delete()
    .ilike('email', member.email)
    .select('id');
  if (error) {
    console.error('[Admin Unsubscribe]', error);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
  return NextResponse.json({ removed: data?.length ?? 0 });
}
```

- [ ] **Step 2: Write resend-confirmation**

Create `app/api/admin/members/[memberNo]/resend-confirmation/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';
import { resolveMember } from '@/lib/adminMembers';
import { sendOrderEmail } from '@/lib/sendOrderEmail';

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ memberNo: string }> },
) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'Database not configured' }, { status: 500 });

  const { memberNo } = await ctx.params;
  const member = await resolveMember(memberNo);
  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const orderId = String(body.orderId || '').trim();
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 });

  const { data: order, error } = await supabaseServer
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();
  if (error || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  if ((order.customer_email || '').toLowerCase().trim() !== member.email) {
    return NextResponse.json({ error: 'Order does not belong to member' }, { status: 403 });
  }
  if (order.status !== 'paid') {
    return NextResponse.json({ error: 'Order not paid' }, { status: 400 });
  }

  // Delete the old success email_logs row so sendOrderEmail's idempotency guard
  // doesn't short-circuit. Admin action is intentional resend.
  await supabaseServer
    .from('email_logs')
    .delete()
    .eq('email_type', 'order_success')
    .eq('status', 'sent')
    .contains('metadata', { order_id: orderId });

  const result = await sendOrderEmail(
    {
      id: order.id,
      payment_status: order.status,
      amount_total: order.amount_total,
      currency: order.currency,
      customer_email: order.customer_email,
      customer_name: order.customer_name,
      ticket_tier: order.ticket_tier,
      created: order.created_at ? Math.floor(new Date(order.created_at).getTime() / 1000) : null,
    },
    'success',
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error || 'Send failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, messageId: result.messageId });
}
```

- [ ] **Step 3: Test in UI**

- Visit a member who has `subscribed_newsletter=true`. Click 取消訂閱 → confirm. Expected: toast, KPI card flips to `未訂閱`, DB row gone.
- Visit a member with a paid order. Click 重寄確認信 on that order row → confirm. Expected: toast, Email History gains a new `order_success` row.

Capture `.screenshots/2026-04-16/unsubscribe.png` and `.screenshots/2026-04-16/resend-confirmation.png`.

- [ ] **Step 4: Lint + commit**

```bash
npm run lint
git add app/api/admin/members/\[memberNo\]/unsubscribe app/api/admin/members/\[memberNo\]/resend-confirmation
git commit -m "feat(admin): unsubscribe and resend order confirmation endpoints"
```

---

## Task 10: Export JSON endpoint + final review

**Files:**
- Create: `app/api/admin/members/[memberNo]/export/route.ts`

- [ ] **Step 1: Write export route**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { resolveMember } from '@/lib/adminMembers';
import { GET as getMemberDetail } from '../route';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ memberNo: string }> },
) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { memberNo } = await ctx.params;
  const member = await resolveMember(memberNo);
  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Reuse the aggregate GET handler to avoid duplication.
  const detailRes = await getMemberDetail(req, ctx);
  if (!detailRes.ok) return detailRes;
  const payload = await detailRes.json();

  const filename = `member-${member.member_no}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.json`;
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
```

- [ ] **Step 2: Test download**

Click 匯出 JSON on a member. Expected: a `member-M00042-20260416.json` file downloads and contains all fields visible in the Raw JSON section.

Capture `.screenshots/2026-04-16/export-json.png` showing the downloaded file open.

- [ ] **Step 3: Full regression sweep**

With dev server running:

1. `/admin/members` list still renders, 編號 column populated, search/filter still work.
2. Click row → detail page loads. All sections render without JS errors (check DevTools console).
3. 404 state: navigate to `/admin/members/M99999` → see 「查無此會員」 with back link.
4. 401 state: open an incognito window, hit `/api/admin/members/M00001` → 401.
5. Run full lint: `npm run lint`. Expected: no new errors.

- [ ] **Step 4: Final commit + screenshot**

```bash
npm run lint
git add app/api/admin/members/\[memberNo\]/export
git commit -m "feat(admin): add JSON export endpoint for member data"
```

---

## Wrap-up

After Task 10:

- All screenshots live under `.screenshots/2026-04-16/`.
- All commits are on branch `feature/admin-member-details`.
- The two DB migrations (`create_members_table.sql`, `update_members_enriched_with_member_no.sql`) must be applied to production Supabase before the code deploys, in that order. The code will still boot without them (resolve will just return null for everyone), but all detail pages will 404.
- Follow-up with `superpowers:finishing-a-development-branch` when ready to merge.
