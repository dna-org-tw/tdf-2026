# Member Status & Engagement Tier — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every email in the system a `status` (lifecycle stage) and `tier` (engagement heat), surface both in `/admin/members`, and let `/admin/send` filter recipients by those dimensions plus quick presets.

**Architecture:** A Postgres view `members_enriched` unions orders / newsletter / notification sources and derives status + score + tier on read. A new `/api/admin/members` serves the admin list; existing `/api/admin/recipients` and `lib/recipients.ts` switch to reading the view and accept new `statuses` / `tiers` params. Two UI surfaces (`/admin/members`, `/admin/send`) get redesigned filters.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Supabase (service role server-side), Tailwind 4, Postgres views.

**Repo note on testing:** This codebase has **no test framework** (`CLAUDE.md` confirms). "Tests" in this plan are **SQL sanity queries + curl / browser verification**. Keep the TDD spirit: write the verification criterion before each change, then verify it's green before committing.

**Data limitation:** `email_logs` / `notification_logs` track only sent/failed — no open/click tracking exists. The view will compute `email_open_rate` and `email_click_count` as placeholders (always 0 in v1). The score formula stays forward-compatible; a future Mailgun-webhook task can backfill these.

---

## File Structure

**Create:**
- `lib/members.ts` — Shared types (`MemberStatus`, `MemberTier`, `EnrichedMember`) and constants (score weights, tier thresholds, ticket tier rank).
- `supabase/migrations/create_members_enriched_view.sql` — The `members_enriched` view.
- `app/api/admin/members/route.ts` — New admin list endpoint (replaces `contacts`).

**Modify:**
- `lib/recipients.ts` — Read from `members_enriched`; add `statuses`, `memberTiers`, keep `groups` for back-compat, rename current `tiers` param to `ticketTiers` (both accepted during transition).
- `app/api/admin/recipients/route.ts` — Accept new query params, keep old ones.
- `app/admin/members/page.tsx` — Add status/tier columns, filters, overview chips.
- `app/admin/send/page.tsx` — Add preset buttons, status/tier checkboxes.

**Delete:**
- `app/api/admin/contacts/route.ts` — After `/admin/members` switches to new endpoint.

---

## Task 1: Shared types and constants in `lib/members.ts`

**Files:**
- Create: `lib/members.ts`

- [ ] **Step 1: Write the file**

```typescript
// lib/members.ts
// Shared types and constants for the members model.

export type MemberStatus = 'paid' | 'pending' | 'abandoned' | 'subscriber' | 'other';
export type MemberTier = 'S' | 'A' | 'B' | 'C';
export type TicketTier = 'explore' | 'contribute' | 'weekly_backer' | 'backer';

export const MEMBER_STATUSES: MemberStatus[] = ['paid', 'pending', 'abandoned', 'subscriber', 'other'];
export const MEMBER_TIERS: MemberTier[] = ['S', 'A', 'B', 'C'];
export const TICKET_TIERS: TicketTier[] = ['explore', 'contribute', 'weekly_backer', 'backer'];

// Used by the SQL view and kept here for reference / client labels.
export const TICKET_TIER_RANK: Record<TicketTier, number> = {
  explore: 1,
  contribute: 2,
  weekly_backer: 3,
  backer: 4,
};

export const TICKET_TIER_SCORE: Record<TicketTier, number> = {
  explore: 8,
  contribute: 15,
  weekly_backer: 25,
  backer: 40,
};

// Tier bucket thresholds (lower bound inclusive).
export const TIER_THRESHOLDS: Record<MemberTier, number> = {
  S: 50,
  A: 20,
  B: 5,
  C: 0,
};

export interface EnrichedMember {
  email: string;
  name: string | null;
  phone: string | null;
  status: MemberStatus;
  paid_order_count: number;
  total_spent_cents: number;
  currency: string;
  highest_ticket_tier: TicketTier | null;
  last_order_at: string | null;
  last_interaction_at: string | null;
  email_sent_count: number;
  email_open_count: number;
  email_click_count: number;
  email_open_rate: number | null;
  score: number;
  tier: MemberTier;
  subscribed_newsletter: boolean;
  in_orders: boolean;
}

export const STATUS_LABELS_ZH: Record<MemberStatus, string> = {
  paid: '已付費',
  pending: '待付款',
  abandoned: '已放棄',
  subscriber: '訂閱者',
  other: '其他',
};

export const STATUS_BADGE_CLASSES: Record<MemberStatus, string> = {
  paid: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-800',
  abandoned: 'bg-orange-100 text-orange-700',
  subscriber: 'bg-blue-100 text-blue-700',
  other: 'bg-slate-100 text-slate-600',
};

export const TIER_BADGE_CLASSES: Record<MemberTier, string> = {
  S: 'bg-purple-100 text-purple-700',
  A: 'bg-red-100 text-red-700',
  B: 'bg-yellow-100 text-yellow-800',
  C: 'bg-slate-100 text-slate-600',
};

export const TIER_LABELS_ZH: Record<MemberTier, string> = {
  S: 'S (VIP)',
  A: 'A (熱)',
  B: 'B (溫)',
  C: 'C (冷)',
};

export const TICKET_TIER_LABELS: Record<TicketTier, string> = {
  explore: 'Explore',
  contribute: 'Contribute',
  weekly_backer: 'Weekly Backer',
  backer: 'Backer',
};

export const TICKET_TIER_BADGE_CLASSES: Record<TicketTier, string> = {
  explore: 'bg-blue-100 text-blue-700',
  contribute: 'bg-teal-100 text-teal-700',
  weekly_backer: 'bg-amber-100 text-amber-700',
  backer: 'bg-purple-100 text-purple-700',
};
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: Pass (no errors).

- [ ] **Step 3: Commit**

```bash
git add lib/members.ts
git commit -m "feat: add member types and constants for status/tier system"
```

---

## Task 2: Create `members_enriched` SQL view

**Files:**
- Create: `supabase/migrations/create_members_enriched_view.sql`

The view must use the exact constants from Task 1 so the two stay in sync. The pending-to-abandoned cutoff is 7 days (per spec).

- [ ] **Step 1: Write the migration**

```sql
-- Create members_enriched view
-- Aggregates every email in the system with derived status, score, and tier.
-- Union source: orders, newsletter_subscriptions, notification_logs/email_logs (recipients).

CREATE OR REPLACE VIEW members_enriched AS
WITH
-- Lowercased, trimmed unique email universe
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
-- Order aggregates per email
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
    -- Pick the latest non-null name/phone overall
    (ARRAY_AGG(customer_name ORDER BY created_at DESC) FILTER (WHERE customer_name IS NOT NULL))[1] AS latest_name,
    (ARRAY_AGG(customer_phone ORDER BY created_at DESC) FILTER (WHERE customer_phone IS NOT NULL))[1] AS latest_phone,
    (ARRAY_AGG(currency ORDER BY created_at DESC) FILTER (WHERE status = 'paid'))[1] AS latest_paid_currency,
    -- Highest ticket tier among paid orders (by rank)
    (ARRAY_AGG(ticket_tier ORDER BY CASE ticket_tier
        WHEN 'backer' THEN 4
        WHEN 'weekly_backer' THEN 3
        WHEN 'contribute' THEN 2
        WHEN 'explore' THEN 1
        ELSE 0 END DESC, created_at DESC)
      FILTER (WHERE status = 'paid'))[1] AS highest_ticket_tier,
    -- Sum of per-order ticket scores for paid orders only
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
-- Email send history per recipient (open/click are placeholders; no tracking yet)
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
  oa.latest_name AS name,
  oa.latest_phone AS phone,
  -- Status (priority: paid > pending > abandoned > subscriber > other)
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
  -- Score
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
  -- Tier bucket
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
LEFT JOIN order_agg oa ON oa.email = e.email
LEFT JOIN newsletter_agg na ON na.email = e.email
LEFT JOIN email_agg ea ON ea.email = e.email;

COMMENT ON VIEW members_enriched IS
  'Member universe (union of orders, newsletter, email recipients) with derived status, score, and tier. See lib/members.ts for constants.';
```

- [ ] **Step 2: Apply the migration in Supabase dashboard or CLI**

Apply via Supabase dashboard SQL editor or `supabase db push`. If using the MCP, use `mcp__claude_ai_Supabase__apply_migration`.

- [ ] **Step 3: Verify the view returns data and statuses add up**

Run (Supabase SQL editor):

```sql
SELECT status, COUNT(*) FROM members_enriched GROUP BY status ORDER BY 1;
SELECT tier, COUNT(*) FROM members_enriched GROUP BY tier ORDER BY 1;
SELECT email, status, tier, score, paid_order_count, total_spent_cents
FROM members_enriched ORDER BY score DESC LIMIT 10;
```

Expected:
- Status groups only contain the five enum values.
- Tier groups only contain S/A/B/C.
- Top-scoring members are `paid` with high spend.
- A member with only a newsletter subscription shows `subscriber`, score 0, tier `C`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/create_members_enriched_view.sql
git commit -m "feat: add members_enriched Postgres view for status & tier"
```

---

## Task 3: Create `GET /api/admin/members` route

**Files:**
- Create: `app/api/admin/members/route.ts`

This route queries `members_enriched` (via Supabase) with search, status, tier, and ticket-tier filters, plus paging. It also returns summary counts used by the overview chips.

- [ ] **Step 1: Write the route**

```typescript
// app/api/admin/members/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';
import {
  type MemberStatus,
  type MemberTier,
  type TicketTier,
  type EnrichedMember,
  MEMBER_STATUSES,
  MEMBER_TIERS,
  TICKET_TIERS,
} from '@/lib/members';

function parseList<T extends string>(raw: string | null, allowed: readonly T[]): T[] | undefined {
  if (!raw) return undefined;
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean) as T[];
  const filtered = list.filter((v) => (allowed as readonly string[]).includes(v));
  return filtered.length ? filtered : undefined;
}

export async function GET(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search')?.trim() || '';
  const statuses = parseList<MemberStatus>(searchParams.get('status'), MEMBER_STATUSES);
  const tiers = parseList<MemberTier>(searchParams.get('tier'), MEMBER_TIERS);
  const ticketTiers = parseList<TicketTier>(searchParams.get('ticketTier'), TICKET_TIERS);
  const repeatOnly = searchParams.get('repeat') === '1';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));

  try {
    // Build base query for filtered members (for list + total)
    const buildFiltered = () => {
      let q = supabaseServer!.from('members_enriched').select('*', { count: 'exact' });
      if (search) {
        q = q.or(`email.ilike.%${search}%,name.ilike.%${search}%`);
      }
      if (statuses) q = q.in('status', statuses);
      if (tiers) q = q.in('tier', tiers);
      if (ticketTiers) q = q.in('highest_ticket_tier', ticketTiers);
      if (repeatOnly) q = q.gt('paid_order_count', 1);
      return q;
    };

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, count, error } = await buildFiltered()
      .order('score', { ascending: false })
      .order('last_interaction_at', { ascending: false, nullsFirst: false })
      .range(from, to);

    if (error) {
      console.error('[Admin Members]', error);
      return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
    }

    // Summary counts (unfiltered by status/tier so chips reflect the full universe
    // after text search alone).
    let summaryQuery = supabaseServer!
      .from('members_enriched')
      .select('status, tier', { head: false });
    if (search) {
      summaryQuery = summaryQuery.or(`email.ilike.%${search}%,name.ilike.%${search}%`);
    }
    const { data: summaryRows, error: summaryErr } = await summaryQuery;
    if (summaryErr) {
      console.error('[Admin Members] summary', summaryErr);
    }

    const byStatus: Record<MemberStatus, number> = {
      paid: 0, pending: 0, abandoned: 0, subscriber: 0, other: 0,
    };
    const byTier: Record<MemberTier, number> = { S: 0, A: 0, B: 0, C: 0 };
    for (const row of summaryRows || []) {
      const s = row.status as MemberStatus;
      const t = row.tier as MemberTier;
      if (byStatus[s] !== undefined) byStatus[s]++;
      if (byTier[t] !== undefined) byTier[t]++;
    }

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return NextResponse.json({
      members: (data || []) as EnrichedMember[],
      total,
      totalPages,
      page,
      summary: { byStatus, byTier },
    });
  } catch (err) {
    console.error('[Admin Members] unexpected', err);
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: Pass.

- [ ] **Step 3: Smoke-test the endpoint in the dev server**

Start `npm run dev`, authenticate to the admin, then in the browser devtools console (logged in):

```js
await fetch('/api/admin/members?limit=5').then(r => r.json())
```

Expected: `{ members: [...], total, totalPages, page: 1, summary: { byStatus, byTier } }`. `members` array length ≤ 5, summary counts are non-negative integers.

Also try filters:

```js
await fetch('/api/admin/members?status=paid&tier=S,A&limit=20').then(r => r.json())
```

Expected: every returned `member.status === 'paid'` and `member.tier` is `S` or `A`.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/members/route.ts
git commit -m "feat: add /api/admin/members endpoint with status/tier filters"
```

---

## Task 4: Redesign `/admin/members` page

**Files:**
- Modify: `app/admin/members/page.tsx` (whole file rewrite)

The page switches from `/api/admin/contacts` to `/api/admin/members`, adds status + tier columns and filters, and adds clickable overview chips.

- [ ] **Step 1: Replace the file**

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  type EnrichedMember,
  type MemberStatus,
  type MemberTier,
  type TicketTier,
  MEMBER_STATUSES,
  MEMBER_TIERS,
  TICKET_TIERS,
  STATUS_LABELS_ZH,
  STATUS_BADGE_CLASSES,
  TIER_LABELS_ZH,
  TIER_BADGE_CLASSES,
  TICKET_TIER_LABELS,
  TICKET_TIER_BADGE_CLASSES,
} from '@/lib/members';

interface ApiResponse {
  members: EnrichedMember[];
  total: number;
  totalPages: number;
  page: number;
  summary: {
    byStatus: Record<MemberStatus, number>;
    byTier: Record<MemberTier, number>;
  };
}

export default function MembersPage() {
  const [members, setMembers] = useState<EnrichedMember[]>([]);
  const [summary, setSummary] = useState<ApiResponse['summary'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statuses, setStatuses] = useState<MemberStatus[]>([]);
  const [tiers, setTiers] = useState<MemberTier[]>([]);
  const [ticketTier, setTicketTier] = useState<TicketTier | ''>('');
  const [repeatOnly, setRepeatOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statuses.length) params.set('status', statuses.join(','));
      if (tiers.length) params.set('tier', tiers.join(','));
      if (ticketTier) params.set('ticketTier', ticketTier);
      if (repeatOnly) params.set('repeat', '1');
      params.set('page', String(page));
      params.set('limit', '20');

      const res = await fetch(`/api/admin/members?${params}`);
      if (res.ok) {
        const data: ApiResponse = await res.json();
        setMembers(data.members || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 0);
        setSummary(data.summary || null);
      }
    } catch (err) {
      console.error('[Admin Members]', err);
    } finally {
      setLoading(false);
    }
  }, [search, statuses, tiers, ticketTier, repeatOnly, page]);

  useEffect(() => {
    const timer = setTimeout(fetchMembers, 300);
    return () => clearTimeout(timer);
  }, [fetchMembers]);

  useEffect(() => { setPage(1); }, [search, statuses, tiers, ticketTier, repeatOnly]);

  const toggleStatus = (s: MemberStatus) => {
    setStatuses((cur) => cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]);
  };
  const toggleTier = (t: MemberTier) => {
    setTiers((cur) => cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]);
  };

  const formatAmount = (cents: number, currency: string) =>
    `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('zh-TW', {
      year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Taipei',
    });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">會員管理</h1>

      {/* Overview chips */}
      {summary && (
        <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
          <div className="text-xs text-slate-500 mb-2">狀態分佈（點擊切換篩選）</div>
          <div className="flex flex-wrap gap-2 mb-3">
            {MEMBER_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => toggleStatus(s)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                  statuses.includes(s)
                    ? `${STATUS_BADGE_CLASSES[s]} border-current`
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {STATUS_LABELS_ZH[s]} <span className="opacity-70">({summary.byStatus[s]})</span>
              </button>
            ))}
          </div>
          <div className="text-xs text-slate-500 mb-2">等級分佈</div>
          <div className="flex flex-wrap gap-2">
            {MEMBER_TIERS.map((t) => (
              <button
                key={t}
                onClick={() => toggleTier(t)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                  tiers.includes(t)
                    ? `${TIER_BADGE_CLASSES[t]} border-current`
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {TIER_LABELS_ZH[t]} <span className="opacity-70">({summary.byTier[t]})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-4 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋 Email 或姓名..."
          className="flex-1 min-w-[200px] px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10B8D9] text-slate-900 text-sm"
        />
        <select
          value={ticketTier}
          onChange={(e) => setTicketTier(e.target.value as TicketTier | '')}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#10B8D9]"
        >
          <option value="">全部票種</option>
          {TICKET_TIERS.map((t) => (
            <option key={t} value={t}>{TICKET_TIER_LABELS[t]}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={repeatOnly}
            onChange={(e) => setRepeatOnly(e.target.checked)}
            className="rounded border-slate-300 text-[#10B8D9] focus:ring-[#10B8D9]"
          />
          只看多筆訂單
        </label>
        <span className="text-sm text-slate-500">共 {total} 位會員</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-600">姓名</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Email</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">狀態</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">等級</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">最高票種</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">訂單</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">總消費</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">分數</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">最近互動</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-200 rounded animate-pulse w-20" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                    沒有符合條件的會員
                  </td>
                </tr>
              ) : (
                members.map((m) => (
                  <tr key={m.email} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-900 font-medium">{m.name || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{m.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE_CLASSES[m.status]}`}>
                        {STATUS_LABELS_ZH[m.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TIER_BADGE_CLASSES[m.tier]}`}>
                        {TIER_LABELS_ZH[m.tier]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {m.highest_ticket_tier ? (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TICKET_TIER_BADGE_CLASSES[m.highest_ticket_tier]}`}>
                          {TICKET_TIER_LABELS[m.highest_ticket_tier]}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-900">{m.paid_order_count}</td>
                    <td className="px-4 py-3 text-right text-slate-900 font-mono">
                      {m.total_spent_cents > 0 ? formatAmount(m.total_spent_cents, m.currency) : '-'}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-900 font-mono">{m.score}</td>
                    <td className="px-4 py-3 text-right text-slate-500">
                      {formatDate(m.last_interaction_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            上一頁
          </button>
          <span className="text-sm text-slate-500">
            第 {page} / {totalPages} 頁
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            下一頁
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: Pass.

- [ ] **Step 3: Manual check**

`npm run dev`, log in, visit `/admin/members`.

Verify:
- Overview chips render with counts; clicking a status chip filters table and toggles selection.
- Status/tier badges render with the right colors.
- Search works (typing filters).
- Pagination works when total > 20.
- `subscriber` rows show `-` for ticket and 0 for order count.

- [ ] **Step 4: Commit**

```bash
git add app/admin/members/page.tsx
git commit -m "feat: add status/tier columns, chips, and filters to members page"
```

---

## Task 5: Switch `lib/recipients.ts` to read from `members_enriched`

**Files:**
- Modify: `lib/recipients.ts` (full rewrite)

Accept new params, keep old `groups` + `tiers` for back-compat during the send-page transition.

- [ ] **Step 1: Rewrite the file**

```typescript
// lib/recipients.ts
import { supabaseServer } from '@/lib/supabaseServer';
import {
  type MemberStatus,
  type MemberTier,
  type TicketTier,
} from '@/lib/members';

// Legacy group names still accepted from the send page while it transitions.
export type RecipientGroup = 'orders' | 'subscribers' | 'test';
export type { TicketTier, MemberStatus, MemberTier };

interface RecipientsQuery {
  statuses?: MemberStatus[];
  memberTiers?: MemberTier[];
  ticketTiers?: TicketTier[];
  groups?: RecipientGroup[]; // legacy
  legacyTicketTiers?: TicketTier[]; // legacy: old `tiers` param
  adminEmail?: string;
}

interface RecipientsResult {
  emails: string[];
  count: number;
}

// Map legacy `groups` into status filters.
function groupsToStatuses(groups?: RecipientGroup[]): MemberStatus[] | undefined {
  if (!groups || !groups.length) return undefined;
  const set = new Set<MemberStatus>();
  for (const g of groups) {
    if (g === 'orders') set.add('paid');
    else if (g === 'subscribers') set.add('subscriber');
    // 'test' is handled separately via adminEmail
  }
  return set.size ? Array.from(set) : undefined;
}

export async function getRecipients(q: RecipientsQuery): Promise<RecipientsResult> {
  if (!supabaseServer) {
    throw new Error('Supabase not configured');
  }

  const emailSet = new Set<string>();

  // Test recipient: admin's own email.
  if (q.groups?.includes('test') && q.adminEmail) {
    emailSet.add(q.adminEmail.trim().toLowerCase());
  }

  // Resolve effective filters.
  const statuses = q.statuses ?? groupsToStatuses(q.groups);
  const memberTiers = q.memberTiers;
  const ticketTiers = q.ticketTiers ?? q.legacyTicketTiers;

  // If nothing to query (only test was requested), return test-only set.
  const needsQuery = statuses || memberTiers || ticketTiers;
  if (!needsQuery) {
    const emails = Array.from(emailSet);
    return { emails, count: emails.length };
  }

  let query = supabaseServer.from('members_enriched').select('email');
  if (statuses && statuses.length) query = query.in('status', statuses);
  if (memberTiers && memberTiers.length) query = query.in('tier', memberTiers);
  if (ticketTiers && ticketTiers.length) query = query.in('highest_ticket_tier', ticketTiers);

  const { data, error } = await query;
  if (error) {
    console.error('[Recipients] Error fetching members_enriched:', error);
    throw new Error('Failed to fetch recipients');
  }
  for (const row of data || []) {
    if (row.email) emailSet.add(String(row.email).trim().toLowerCase());
  }

  const emails = Array.from(emailSet);
  return { emails, count: emails.length };
}
```

- [ ] **Step 2: Update callers of the old signature**

The old signature was `getRecipients(groups, tiers, adminEmail)`. Find callers and update them:

Run: `grep -rn "getRecipients(" app/ lib/`

Expected callers (edit each to pass an object):

- `app/api/admin/recipients/route.ts`:
  ```typescript
  // before
  const result = await getRecipients(groups, tiers, session.email);
  // after
  const result = await getRecipients({
    groups,
    legacyTicketTiers: tiers,
    adminEmail: session.email,
  });
  ```

- `app/api/admin/send/route.ts`:
  ```typescript
  // before
  const { emails, count } = await getRecipients(groups, tiers, session.email);
  // after
  const { emails, count } = await getRecipients({
    groups,
    legacyTicketTiers: tiers,
    adminEmail: session.email,
  });
  ```

Leave the route files otherwise untouched for now; Task 6 adds the new params.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: Pass.

- [ ] **Step 4: Smoke test the existing `/api/admin/recipients` behavior is unchanged**

`npm run dev`, logged in as admin, in devtools:

```js
await fetch('/api/admin/recipients?groups=orders').then(r => r.json())
await fetch('/api/admin/recipients?groups=orders&tiers=backer,weekly_backer').then(r => r.json())
await fetch('/api/admin/recipients?groups=subscribers').then(r => r.json())
```

Expected: counts match what you'd get from:
```sql
SELECT COUNT(*) FROM members_enriched WHERE status='paid';
SELECT COUNT(*) FROM members_enriched WHERE status='paid' AND highest_ticket_tier IN ('backer','weekly_backer');
SELECT COUNT(*) FROM members_enriched WHERE status='subscriber';
```

- [ ] **Step 5: Commit**

```bash
git add lib/recipients.ts app/api/admin/recipients/route.ts app/api/admin/send/route.ts
git commit -m "refactor: route recipient lookups through members_enriched view"
```

---

## Task 6: Extend `/api/admin/recipients` with new params

**Files:**
- Modify: `app/api/admin/recipients/route.ts`

- [ ] **Step 1: Rewrite the route**

```typescript
// app/api/admin/recipients/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { getRecipients, type RecipientGroup } from '@/lib/recipients';
import {
  type MemberStatus,
  type MemberTier,
  type TicketTier,
  MEMBER_STATUSES,
  MEMBER_TIERS,
  TICKET_TIERS,
} from '@/lib/members';

const VALID_GROUPS: RecipientGroup[] = ['orders', 'subscribers', 'test'];

function parseList<T extends string>(raw: string | null, allowed: readonly T[]): T[] | undefined {
  if (!raw) return undefined;
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean) as T[];
  const filtered = list.filter((v) => (allowed as readonly string[]).includes(v));
  return filtered.length ? filtered : undefined;
}

export async function GET(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);

  const groupsRaw = searchParams.get('groups');
  const groups = groupsRaw
    ? (groupsRaw.split(',').filter((g): g is RecipientGroup =>
        VALID_GROUPS.includes(g as RecipientGroup)))
    : undefined;

  // Legacy `tiers` query param (meant ticket tier). New API uses `ticketTier`.
  const legacyTicketTiers = parseList<TicketTier>(searchParams.get('tiers'), TICKET_TIERS);
  const statuses = parseList<MemberStatus>(searchParams.get('statuses'), MEMBER_STATUSES);
  const memberTiers = parseList<MemberTier>(searchParams.get('memberTiers'), MEMBER_TIERS);
  const ticketTiers = parseList<TicketTier>(searchParams.get('ticketTiers'), TICKET_TIERS);

  // If caller provided nothing usable, error out.
  if (!groups && !statuses && !memberTiers && !ticketTiers) {
    return NextResponse.json(
      { error: 'At least one of groups, statuses, memberTiers, or ticketTiers is required' },
      { status: 400 },
    );
  }

  try {
    const result = await getRecipients({
      groups,
      statuses,
      memberTiers,
      ticketTiers,
      legacyTicketTiers,
      adminEmail: session.email,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Admin Recipients]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch recipients' },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: Pass.

- [ ] **Step 3: Smoke test new params**

```js
// status only
await fetch('/api/admin/recipients?statuses=pending,abandoned').then(r => r.json())
// status + member tier
await fetch('/api/admin/recipients?statuses=paid&memberTiers=S,A').then(r => r.json())
// ticket tier filter
await fetch('/api/admin/recipients?statuses=paid&ticketTiers=backer').then(r => r.json())
// legacy still works
await fetch('/api/admin/recipients?groups=orders&tiers=backer').then(r => r.json())
```

Expected: each returns `{ emails: [...], count: N }` with counts matching equivalent SQL on `members_enriched`.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/recipients/route.ts
git commit -m "feat: accept statuses/memberTiers/ticketTiers on recipients endpoint"
```

---

## Task 7: Redesign `/admin/send` with presets + status/tier filters

**Files:**
- Modify: `app/admin/send/page.tsx`
- Modify: `app/api/admin/send/route.ts` — accept and forward new params

This task updates both the UI (presets + checkboxes) and the send route so the server-side filter matches the UI.

- [ ] **Step 1: Update `app/api/admin/send/route.ts` to accept new params**

Find the existing body-parsing block (around lines 37–50 per Task 5 context) and change it to read both legacy and new fields, then pass all to `getRecipients`:

```typescript
// near top of POST handler, replacing current groups/tiers parsing
const rawGroups = Array.isArray(body.groups) ? (body.groups as string[]) : undefined;
const groups = rawGroups
  ? rawGroups.filter((g): g is RecipientGroup =>
      ['orders', 'subscribers', 'test'].includes(g))
  : undefined;

const toList = <T extends string>(val: unknown, allowed: readonly T[]): T[] | undefined => {
  if (!Array.isArray(val)) return undefined;
  const list = (val as string[]).filter((v) => (allowed as readonly string[]).includes(v)) as T[];
  return list.length ? list : undefined;
};

const legacyTicketTiers = toList<TicketTier>(body.tiers, TICKET_TIERS);
const statuses = toList<MemberStatus>(body.statuses, MEMBER_STATUSES);
const memberTiers = toList<MemberTier>(body.memberTiers, MEMBER_TIERS);
const ticketTiers = toList<TicketTier>(body.ticketTiers, TICKET_TIERS);

if (!groups && !statuses && !memberTiers && !ticketTiers) {
  return NextResponse.json({ error: 'No recipient filters provided' }, { status: 400 });
}
```

Import additions at top of the file:

```typescript
import {
  type MemberStatus,
  type MemberTier,
  type TicketTier,
  MEMBER_STATUSES,
  MEMBER_TIERS,
  TICKET_TIERS,
} from '@/lib/members';
```

And change the `getRecipients` call:

```typescript
const { emails, count } = await getRecipients({
  groups,
  statuses,
  memberTiers,
  ticketTiers,
  legacyTicketTiers,
  adminEmail: session.email,
});
```

When logging to `notification_logs`, persist the new filters too (extend the JSONB `recipient_groups` record or add fields). For v1, keep the existing columns but also stash new filter data in a metadata object:

```typescript
// in the notification_logs insert
recipient_groups: groups ?? [],
recipient_tiers: legacyTicketTiers ?? ticketTiers ?? null,
// existing columns unchanged; richer tracking deferred
```

- [ ] **Step 2: Rewrite `app/admin/send/page.tsx`**

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  type MemberStatus,
  type MemberTier,
  type TicketTier,
  MEMBER_STATUSES,
  MEMBER_TIERS,
  TICKET_TIERS,
  STATUS_LABELS_ZH,
  TIER_LABELS_ZH,
  TICKET_TIER_LABELS,
} from '@/lib/members';

interface Preset {
  id: string;
  label: string;
  statuses?: MemberStatus[];
  memberTiers?: MemberTier[];
  ticketTiers?: TicketTier[];
  testOnly?: boolean;
}

const PRESETS: Preset[] = [
  { id: 'test', label: '寄送測試信（寄給自己）', testOnly: true },
  { id: 'all-paid', label: '全體付費', statuses: ['paid'] },
  { id: 'vip', label: 'VIP (付費 + S/A)', statuses: ['paid'], memberTiers: ['S', 'A'] },
  { id: 'chase', label: '催單 (待付/放棄)', statuses: ['pending', 'abandoned'] },
  { id: 'wake', label: '冷名單喚醒 (訂閱者 B/C)', statuses: ['subscriber'], memberTiers: ['B', 'C'] },
];

function buildPreviewHtml(body: string, subject: string): string {
  const bodyHtml = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #1E1F1C; padding: 30px; border-radius: 8px; margin-bottom: 20px;">
    <h1 style="color: #10B8D9; margin: 0; font-size: 24px;">Taiwan Digital Fest 2026</h1>
  </div>
  <div style="background-color: #f9f9f9; padding: 30px; border-radius: 8px; margin-bottom: 20px;">
    <h2 style="color: #10B8D9; margin-top: 0;">${subject.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</h2>
    <div style="color: #333; font-size: 16px;">${bodyHtml}</div>
    <p style="color: #666; font-size: 14px; margin-top: 30px;">Best regards,<br>Taiwan Digital Fest 2026 Team</p>
  </div>
  <div style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
    <p>This is an automated email from Taiwan Digital Fest 2026.</p>
  </div>
</body>
</html>`;
}

export default function SendNotificationPage() {
  const router = useRouter();
  const [testOnly, setTestOnly] = useState(false);
  const [statuses, setStatuses] = useState<MemberStatus[]>([]);
  const [memberTiers, setMemberTiers] = useState<MemberTier[]>([]);
  const [ticketTiers, setTicketTiers] = useState<TicketTier[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);
  const [sending, setSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [emailConfig, setEmailConfig] = useState<{ from: string; replyTo: string | null; domain: string | null } | null>(null);

  useEffect(() => {
    fetch('/api/admin/email-config')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data) setEmailConfig(data); })
      .catch(() => {});
  }, []);

  const applyPreset = (p: Preset) => {
    setTestOnly(!!p.testOnly);
    setStatuses(p.statuses || []);
    setMemberTiers(p.memberTiers || []);
    setTicketTiers(p.ticketTiers || []);
  };

  const toggle = <T extends string>(val: T, cur: T[], setCur: (v: T[]) => void) => {
    setCur(cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val]);
  };

  const fetchCount = useCallback(async () => {
    if (testOnly) {
      setRecipientCount(1);
      return;
    }
    if (!statuses.length && !memberTiers.length && !ticketTiers.length) {
      setRecipientCount(null);
      return;
    }
    setLoadingCount(true);
    try {
      const params = new URLSearchParams();
      if (statuses.length) params.set('statuses', statuses.join(','));
      if (memberTiers.length) params.set('memberTiers', memberTiers.join(','));
      if (ticketTiers.length) params.set('ticketTiers', ticketTiers.join(','));
      const res = await fetch(`/api/admin/recipients?${params}`);
      if (res.ok) {
        const data = await res.json();
        setRecipientCount(data.count ?? 0);
      } else {
        setRecipientCount(null);
      }
    } finally {
      setLoadingCount(false);
    }
  }, [testOnly, statuses, memberTiers, ticketTiers]);

  useEffect(() => {
    const t = setTimeout(fetchCount, 200);
    return () => clearTimeout(t);
  }, [fetchCount]);

  const canSubmit =
    subject.trim().length > 0 &&
    body.trim().length > 0 &&
    (testOnly || statuses.length > 0 || memberTiers.length > 0 || ticketTiers.length > 0);

  const submit = async () => {
    setError('');
    setSuccessMessage('');
    setSending(true);
    try {
      const payload: Record<string, unknown> = { subject, body };
      if (testOnly) {
        payload.groups = ['test'];
      } else {
        if (statuses.length) payload.statuses = statuses;
        if (memberTiers.length) payload.memberTiers = memberTiers;
        if (ticketTiers.length) payload.ticketTiers = ticketTiers;
      }
      const res = await fetch('/api/admin/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '發送失敗');
      } else {
        setSuccessMessage(`已寄送給 ${data.count} 位收件人`);
        setShowConfirm(false);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '發送失敗');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">發送通知</h1>

      {/* Quick presets */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
        <div className="text-xs text-slate-500 mb-2">快速預設</div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p)}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Detailed filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
        <label className="flex items-center gap-2 mb-3">
          <input
            type="checkbox"
            checked={testOnly}
            onChange={(e) => setTestOnly(e.target.checked)}
          />
          <span className="text-sm text-slate-700">寄送測試信（僅寄到自己的信箱）</span>
        </label>

        {!testOnly && (
          <>
            <div className="mb-3">
              <div className="text-xs text-slate-500 mb-1">會員狀態（多選）</div>
              <div className="flex flex-wrap gap-2">
                {MEMBER_STATUSES.map((s) => (
                  <label key={s} className="flex items-center gap-1 px-2 py-1 border border-slate-300 rounded-lg text-sm">
                    <input
                      type="checkbox"
                      checked={statuses.includes(s)}
                      onChange={() => toggle(s, statuses, setStatuses)}
                    />
                    {STATUS_LABELS_ZH[s]}
                  </label>
                ))}
              </div>
            </div>

            <div className="mb-3">
              <div className="text-xs text-slate-500 mb-1">會員等級（多選）</div>
              <div className="flex flex-wrap gap-2">
                {MEMBER_TIERS.map((t) => (
                  <label key={t} className="flex items-center gap-1 px-2 py-1 border border-slate-300 rounded-lg text-sm">
                    <input
                      type="checkbox"
                      checked={memberTiers.includes(t)}
                      onChange={() => toggle(t, memberTiers, setMemberTiers)}
                    />
                    {TIER_LABELS_ZH[t]}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500 mb-1">票種篩選（僅對「已付費」生效）</div>
              <div className="flex flex-wrap gap-2">
                {TICKET_TIERS.map((t) => (
                  <label key={t} className="flex items-center gap-1 px-2 py-1 border border-slate-300 rounded-lg text-sm">
                    <input
                      type="checkbox"
                      checked={ticketTiers.includes(t)}
                      onChange={() => toggle(t, ticketTiers, setTicketTiers)}
                    />
                    {TICKET_TIER_LABELS[t]}
                  </label>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="mt-3 text-sm text-slate-500">
          {testOnly
            ? '將只寄給自己'
            : loadingCount
              ? '計算收件人中…'
              : recipientCount !== null
                ? `符合收件人：${recipientCount} 位`
                : '請選擇至少一個篩選條件'}
        </div>
      </div>

      {/* Compose */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-4 space-y-3">
        {emailConfig && (
          <div className="text-xs text-slate-500">
            寄件人：{emailConfig.from}{emailConfig.replyTo ? ` · 回信至 ${emailConfig.replyTo}` : ''}
          </div>
        )}
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="主旨"
          className="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-900 text-sm"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="內文（支援換行）"
          rows={12}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-900 text-sm font-mono"
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => setShowPreview(true)}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            預覽
          </button>
          <button
            type="button"
            disabled={!canSubmit || sending}
            onClick={() => setShowConfirm(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-[#10B8D9] rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {sending ? '發送中…' : '發送'}
          </button>
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        {successMessage && <div className="text-sm text-green-700">{successMessage}</div>}
      </div>

      {/* Preview modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowPreview(false)}>
          <div className="bg-white rounded-xl p-4 max-w-xl w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-3">預覽</h3>
            <iframe
              className="w-full h-[60vh] border border-slate-200 rounded"
              srcDoc={buildPreviewHtml(body, subject)}
            />
          </div>
        </div>
      )}

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-2">確認發送</h3>
            <p className="text-sm text-slate-700 mb-4">
              即將寄送「{subject}」給 {testOnly ? '你自己' : `${recipientCount ?? '?'} 位收件人`}，確認嗎？
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowConfirm(false)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg">取消</button>
              <button onClick={submit} disabled={sending} className="px-4 py-2 text-sm text-white bg-[#10B8D9] rounded-lg disabled:opacity-50">
                {sending ? '發送中…' : '確認發送'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: Pass.

- [ ] **Step 4: Manual check**

`npm run dev`, log in, visit `/admin/send`.

- Click "催單" preset → statuses show `pending, abandoned` checked, recipient count updates.
- Click "VIP" preset → status `paid`, member tier S+A checked, count updates.
- Click "寄送測試信" preset → checkbox toggles on, other filters disabled area shows "將只寄給自己".
- Send a test with "寄送測試信" preset → confirm you received it.
- Send a real batch with a narrow filter (e.g., ticketTiers=`backer`) and confirm count matches `/admin/members` with same filters.

- [ ] **Step 5: Commit**

```bash
git add app/admin/send/page.tsx app/api/admin/send/route.ts
git commit -m "feat: add status/tier filters and quick presets to send page"
```

---

## Task 8: Remove deprecated `/api/admin/contacts`

**Files:**
- Delete: `app/api/admin/contacts/route.ts`

Only do this after Task 4 ships and you've verified `/admin/members` no longer references `/api/admin/contacts`.

- [ ] **Step 1: Confirm no callers remain**

Run: `grep -rn "/api/admin/contacts" app/ lib/ components/ hooks/`
Expected: no matches.

- [ ] **Step 2: Delete the file**

```bash
rm app/api/admin/contacts/route.ts
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: Pass.

- [ ] **Step 4: Commit**

```bash
git add -A app/api/admin/contacts
git commit -m "chore: remove deprecated /api/admin/contacts endpoint"
```

---

## Final Verification

Before declaring done:

- [ ] `npm run build` passes.
- [ ] `/admin/members` renders, chips show sensible counts, filters work.
- [ ] `/admin/send` presets all set the right filters; test send works; real send to a narrow filter works.
- [ ] SQL sanity: `SELECT status, COUNT(*) FROM members_enriched GROUP BY status` matches what `/admin/members` overview chips show.
- [ ] No references to `/api/admin/contacts` remain.

## Known follow-ups (out of scope)

- Mailgun webhook → per-recipient open/click events → feed into the view so the currently-zero `email_open_count` / `email_click_count` signals come alive.
- Award-voter and visitor-fingerprint email sources can be unioned into `all_emails` later without API changes.
- If view evaluation becomes slow, convert to `MATERIALIZED VIEW` + 5-minute refresh cron.
