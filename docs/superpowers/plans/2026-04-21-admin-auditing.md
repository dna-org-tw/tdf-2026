# Admin Auditing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only admin page at `/admin/auditing` that merges three existing audit tables (`order_actions`, `order_transfers`, `visa_letter_issuances`) into a single debug timeline.

**Architecture:** One new `GET /api/admin/auditing` route fans out three parallel Supabase queries, normalizes rows into a common `UnifiedEvent` shape in a shared lib module, and merges+sorts in-memory. One new client page renders the result with filters and an expandable JSON payload viewer. One new top-nav link. Zero schema changes, zero write-side instrumentation.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5 (strict), Tailwind 4, Supabase (service-role client via `lib/supabaseServer.ts`), existing admin auth via `lib/adminAuth.ts`.

**Spec:** `docs/superpowers/specs/2026-04-21-admin-auditing-design.md`

**Testing approach:** This repo has no unit-test harness (only Playwright e2e). Per CLAUDE.md, we verify with `tsc --noEmit` + `npm run lint` + a live smoke test. For the one piece with nontrivial logic (the normalizers), we add a small standalone node script that exercises the pure functions — run once, not checked into CI.

---

## File Structure

**New files:**

- `lib/adminAuditing.ts` — Types (`UnifiedEvent`, source-row shapes), pure normalizers (`normalizeOrderAction`, `normalizeOrderTransfer`, `normalizeVisaLetterIssuance`), and a `mergeAndSort` helper. Pure functions only, no DB access. Kept separate from the route so it's easy to reason about and smoke-test.
- `app/api/admin/auditing/route.ts` — GET handler. Auth check → param parse+clamp → parallel Supabase queries → map through normalizers → merge+sort+slice → JSON response.
- `app/admin/auditing/page.tsx` — Client component. Filter bar + table + expandable rows + "載入更多" button.

**Modified:**

- `app/admin/layout.tsx` — add `稽核軌跡` link between `發送紀錄` and `Luma 同步`.

---

## Task 1: Types and source-row shapes

**Files:**
- Create: `lib/adminAuditing.ts` (initial skeleton)

- [ ] **Step 1: Create `lib/adminAuditing.ts` with type definitions**

```ts
// lib/adminAuditing.ts
// Pure types + normalizers for the admin auditing timeline.
// No DB access here; route handlers pass raw rows in.

export type AuditSource = 'order_action' | 'order_transfer' | 'visa_letter';
export type ActorType = 'admin' | 'user' | 'system';

export type UnifiedEvent = {
  id: string;
  at: string;
  source: AuditSource;
  actor: string;
  actorType: ActorType;
  action: string;
  resourceType: 'order' | 'visa_letter';
  resourceId: string;
  resourceLabel: string;
  resourceLink: string | null;
  status: 'success' | 'failed' | null;
  summary: string;
  payload: unknown;
};

export type OrderActionRow = {
  id: string;
  order_id: string;
  admin_email: string;
  action: string;
  payload: unknown;
  stripe_response: unknown;
  status: 'success' | 'failed';
  error_message: string | null;
  created_at: string;
};

export type OrderTransferRow = {
  id: string;
  order_id: string;
  parent_transfer_id: string | null;
  from_email: string;
  to_email: string;
  initiated_by: 'user' | 'admin';
  actor_user_id: string | null;
  actor_admin_email: string | null;
  ip_address: string | null;
  user_agent: string | null;
  notes: string | null;
  transferred_at: string;
};

export type VisaLetterIssuanceRow = {
  id: number;
  member_id: number;
  document_no: string;
  letter_type: string;
  has_paid_order: boolean;
  order_snapshot: unknown;
  profile_snapshot: unknown;
  pdf_checksum: string | null;
  issued_by: string;
  issued_at: string;
};
```

- [ ] **Step 2: Verify the file type-checks**

Run: `npx tsc --noEmit`
Expected: no new errors referencing `lib/adminAuditing.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/adminAuditing.ts
git commit -m "feat(admin/auditing): add unified event types"
```

---

## Task 2: Normalizers

**Files:**
- Modify: `lib/adminAuditing.ts` (append normalizer functions)

- [ ] **Step 1: Append normalizers to `lib/adminAuditing.ts`**

Append below the types:

```ts
export function normalizeOrderAction(row: OrderActionRow): UnifiedEvent {
  const short = row.order_id.slice(0, 8);
  return {
    id: `oa:${row.id}`,
    at: row.created_at,
    source: 'order_action',
    actor: row.admin_email,
    actorType: 'admin',
    action: row.action,
    resourceType: 'order',
    resourceId: row.order_id,
    resourceLabel: `#${short}`,
    resourceLink: `/admin/orders/${row.order_id}`,
    status: row.status,
    summary: buildOrderActionSummary(row),
    payload: row,
  };
}

function buildOrderActionSummary(row: OrderActionRow): string {
  const base = `${row.admin_email} 對訂單 ${row.order_id.slice(0, 8)} 執行 ${row.action}`;
  if (row.status === 'failed') {
    return `${base}（失敗${row.error_message ? `：${row.error_message}` : ''}）`;
  }
  return base;
}

export function normalizeOrderTransfer(row: OrderTransferRow): UnifiedEvent {
  const isAdmin = row.initiated_by === 'admin';
  const actor = isAdmin
    ? (row.actor_admin_email ?? 'unknown-admin')
    : row.from_email;
  const short = row.order_id.slice(0, 8);
  return {
    id: `ot:${row.id}`,
    at: row.transferred_at,
    source: 'order_transfer',
    actor,
    actorType: isAdmin ? 'admin' : 'user',
    action: 'transfer',
    resourceType: 'order',
    resourceId: row.order_id,
    resourceLabel: `#${short}`,
    resourceLink: `/admin/orders/${row.order_id}`,
    status: 'success',
    summary: `${actor} 將訂單 ${short} 從 ${row.from_email} 轉讓給 ${row.to_email}`,
    payload: row,
  };
}

export function normalizeVisaLetterIssuance(row: VisaLetterIssuanceRow): UnifiedEvent {
  const isSystem = row.issued_by === 'system';
  return {
    id: `vl:${row.id}`,
    at: row.issued_at,
    source: 'visa_letter',
    actor: row.issued_by,
    actorType: isSystem ? 'system' : 'admin',
    action: 'visa_issue',
    resourceType: 'visa_letter',
    resourceId: row.document_no,
    resourceLabel: row.document_no,
    resourceLink: null,
    status: 'success',
    summary: `${row.issued_by} 為 member #${row.member_id} 開立簽證信 ${row.document_no}`,
    payload: row,
  };
}

export function mergeAndSort(events: UnifiedEvent[]): UnifiedEvent[] {
  return [...events].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}
```

- [ ] **Step 2: Smoke-test the normalizers via an ad-hoc script**

Create `scripts/smoke-admin-auditing.ts` with a couple of hand-written rows and `console.log` the normalized output. Run with `npx tsx scripts/smoke-admin-auditing.ts` and eyeball the output. Delete the script once you're satisfied.

```ts
// scripts/smoke-admin-auditing.ts (temporary)
import {
  normalizeOrderAction,
  normalizeOrderTransfer,
  normalizeVisaLetterIssuance,
  mergeAndSort,
} from '../lib/adminAuditing';

const oa = normalizeOrderAction({
  id: '11111111-1111-1111-1111-111111111111',
  order_id: '22222222-2222-2222-2222-222222222222',
  admin_email: 'alice@dna.org.tw',
  action: 'refund',
  payload: { amount: 500 },
  stripe_response: { id: 're_123' },
  status: 'success',
  error_message: null,
  created_at: '2026-04-21T06:00:00Z',
});

const otUser = normalizeOrderTransfer({
  id: '33333333-3333-3333-3333-333333333333',
  order_id: '22222222-2222-2222-2222-222222222222',
  parent_transfer_id: null,
  from_email: 'oldowner@example.com',
  to_email: 'newowner@example.com',
  initiated_by: 'user',
  actor_user_id: 'abc',
  actor_admin_email: null,
  ip_address: '1.2.3.4',
  user_agent: 'Mozilla/5.0',
  notes: null,
  transferred_at: '2026-04-21T05:30:00Z',
});

const vl = normalizeVisaLetterIssuance({
  id: 7,
  member_id: 42,
  document_no: 'TDF-VISA-2026-000007',
  letter_type: 'visa_support',
  has_paid_order: true,
  order_snapshot: null,
  profile_snapshot: { name: 'Test' },
  pdf_checksum: 'abc',
  issued_by: 'system',
  issued_at: '2026-04-21T05:00:00Z',
});

console.log(JSON.stringify(mergeAndSort([oa, otUser, vl]), null, 2));
```

Run: `npx tsx scripts/smoke-admin-auditing.ts`
Expected: 3 events, order_action first (latest timestamp), visa_letter last. Fields look sensible (actor, actorType, summary).

Delete the script after verification:

```bash
rm scripts/smoke-admin-auditing.ts
```

- [ ] **Step 3: `tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add lib/adminAuditing.ts
git commit -m "feat(admin/auditing): add event normalizers"
```

---

## Task 3: API route

**Files:**
- Create: `app/api/admin/auditing/route.ts`

- [ ] **Step 1: Create the route file**

```ts
// app/api/admin/auditing/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';
import {
  mergeAndSort,
  normalizeOrderAction,
  normalizeOrderTransfer,
  normalizeVisaLetterIssuance,
  type AuditSource,
  type OrderActionRow,
  type OrderTransferRow,
  type UnifiedEvent,
  type VisaLetterIssuanceRow,
} from '@/lib/adminAuditing';

const DEFAULT_WINDOW_DAYS = 7;
const MAX_WINDOW_DAYS = 90;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

const ALL_SOURCES: AuditSource[] = ['order_action', 'order_transfer', 'visa_letter'];

export async function GET(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  const url = new URL(req.url);
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - DEFAULT_WINDOW_DAYS * 86400_000);

  const from = parseDate(url.searchParams.get('from'), defaultFrom);
  const to = parseDate(url.searchParams.get('to'), now);
  if (!from || !to) {
    return NextResponse.json({ error: 'Invalid from/to' }, { status: 400 });
  }
  if (to.getTime() - from.getTime() > MAX_WINDOW_DAYS * 86400_000) {
    return NextResponse.json({ error: `Window cannot exceed ${MAX_WINDOW_DAYS} days` }, { status: 400 });
  }
  if (to.getTime() < from.getTime()) {
    return NextResponse.json({ error: '`to` must be >= `from`' }, { status: 400 });
  }

  const limitParam = Number(url.searchParams.get('limit'));
  const limit = Math.min(
    MAX_LIMIT,
    Number.isFinite(limitParam) && limitParam > 0 ? limitParam : DEFAULT_LIMIT,
  );
  const fetchCap = limit + 1;

  const sourcesParam = url.searchParams.get('source');
  const sources: AuditSource[] = sourcesParam
    ? (sourcesParam.split(',').filter((s): s is AuditSource =>
        (ALL_SOURCES as string[]).includes(s),
      ))
    : ALL_SOURCES;

  const actor = url.searchParams.get('actor')?.trim() || null;
  const action = url.searchParams.get('action')?.trim() || null;
  const q = url.searchParams.get('q')?.trim() || null;

  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  try {
    const [oaEvents, otEvents, vlEvents] = await Promise.all([
      sources.includes('order_action')
        ? fetchOrderActions({ fromIso, toIso, actor, action, fetchCap })
        : Promise.resolve([] as UnifiedEvent[]),
      sources.includes('order_transfer')
        ? fetchOrderTransfers({ fromIso, toIso, actor, action, fetchCap })
        : Promise.resolve([] as UnifiedEvent[]),
      sources.includes('visa_letter')
        ? fetchVisaLetterIssuances({ fromIso, toIso, actor, action, fetchCap })
        : Promise.resolve([] as UnifiedEvent[]),
    ]);

    const merged = mergeAndSort([...oaEvents, ...otEvents, ...vlEvents]);
    const filtered = q ? merged.filter((e) => matchesQuery(e, q)) : merged;
    const sliced = filtered.slice(0, limit);
    const hasMore = filtered.length > limit;

    return NextResponse.json({
      events: sliced,
      hasMore,
      window: { from: fromIso, to: toIso },
    });
  } catch (err) {
    console.error('[Admin Auditing]', err);
    return NextResponse.json({ error: 'Failed to fetch audit events' }, { status: 500 });
  }
}

function parseDate(raw: string | null, fallback: Date): Date | null {
  if (!raw) return fallback;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function matchesQuery(ev: UnifiedEvent, q: string): boolean {
  const needle = q.toLowerCase();
  return (
    ev.resourceId.toLowerCase().includes(needle) ||
    ev.resourceLabel.toLowerCase().includes(needle) ||
    ev.summary.toLowerCase().includes(needle)
  );
}

type FetchOpts = {
  fromIso: string;
  toIso: string;
  actor: string | null;
  action: string | null;
  fetchCap: number;
};

async function fetchOrderActions(opts: FetchOpts): Promise<UnifiedEvent[]> {
  let q = supabaseServer!
    .from('order_actions')
    .select('*')
    .gte('created_at', opts.fromIso)
    .lte('created_at', opts.toIso)
    .order('created_at', { ascending: false })
    .limit(opts.fetchCap);
  if (opts.actor) q = q.ilike('admin_email', `%${opts.actor}%`);
  if (opts.action) q = q.eq('action', opts.action);
  const { data, error } = await q;
  if (error) throw error;
  return (data as OrderActionRow[]).map(normalizeOrderAction);
}

async function fetchOrderTransfers(opts: FetchOpts): Promise<UnifiedEvent[]> {
  let q = supabaseServer!
    .from('order_transfers')
    .select('*')
    .gte('transferred_at', opts.fromIso)
    .lte('transferred_at', opts.toIso)
    .order('transferred_at', { ascending: false })
    .limit(opts.fetchCap);
  if (opts.actor) {
    q = q.or(
      `actor_admin_email.ilike.%${opts.actor}%,from_email.ilike.%${opts.actor}%`,
    );
  }
  if (opts.action && opts.action !== 'transfer') return [];
  const { data, error } = await q;
  if (error) throw error;
  return (data as OrderTransferRow[]).map(normalizeOrderTransfer);
}

async function fetchVisaLetterIssuances(opts: FetchOpts): Promise<UnifiedEvent[]> {
  let q = supabaseServer!
    .from('visa_letter_issuances')
    .select('*')
    .gte('issued_at', opts.fromIso)
    .lte('issued_at', opts.toIso)
    .order('issued_at', { ascending: false })
    .limit(opts.fetchCap);
  if (opts.actor) q = q.ilike('issued_by', `%${opts.actor}%`);
  if (opts.action && opts.action !== 'visa_issue') return [];
  const { data, error } = await q;
  if (error) throw error;
  return (data as VisaLetterIssuanceRow[]).map(normalizeVisaLetterIssuance);
}
```

- [ ] **Step 2: `tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: `npm run lint`**

Run: `npm run lint`
Expected: no errors from `app/api/admin/auditing/route.ts`.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/auditing/route.ts
git commit -m "feat(admin/auditing): add GET /api/admin/auditing route"
```

---

## Task 4: Admin page UI

**Files:**
- Create: `app/admin/auditing/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
// app/admin/auditing/page.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { UnifiedEvent, AuditSource, ActorType } from '@/lib/adminAuditing';

const SOURCE_LABELS: Record<AuditSource, string> = {
  order_action: '訂單操作',
  order_transfer: '訂單轉讓',
  visa_letter: '簽證信',
};

const SOURCE_BADGE: Record<AuditSource, string> = {
  order_action: 'bg-sky-100 text-sky-700',
  order_transfer: 'bg-amber-100 text-amber-700',
  visa_letter: 'bg-violet-100 text-violet-700',
};

const ACTOR_BADGE: Record<ActorType, string> = {
  admin: 'bg-emerald-100 text-emerald-700',
  user: 'bg-slate-100 text-slate-700',
  system: 'bg-slate-200 text-slate-600',
};

const ALL_SOURCES: AuditSource[] = ['order_action', 'order_transfer', 'visa_letter'];

function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Taipei',
  });
}

export default function AdminAuditingPage() {
  const today = new Date();
  const sevenDaysAgo = new Date(today.getTime() - 7 * 86400_000);

  const [fromDate, setFromDate] = useState(toDateInput(sevenDaysAgo));
  const [toDate, setToDate] = useState(toDateInput(today));
  const [sources, setSources] = useState<Set<AuditSource>>(new Set(ALL_SOURCES));
  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');
  const [q, setQ] = useState('');

  const [events, setEvents] = useState<UnifiedEvent[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchEvents = useCallback(
    async (opts: { append?: boolean; toOverride?: string } = {}) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set('from', new Date(`${fromDate}T00:00:00+08:00`).toISOString());
        params.set(
          'to',
          opts.toOverride ?? new Date(`${toDate}T23:59:59+08:00`).toISOString(),
        );
        if (sources.size && sources.size < ALL_SOURCES.length) {
          params.set('source', [...sources].join(','));
        }
        if (actor.trim()) params.set('actor', actor.trim());
        if (action.trim()) params.set('action', action.trim());
        if (q.trim()) params.set('q', q.trim());
        params.set('limit', '100');

        const res = await fetch(`/api/admin/auditing?${params.toString()}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        const data = (await res.json()) as {
          events: UnifiedEvent[];
          hasMore: boolean;
        };
        setEvents((prev) => (opts.append ? [...prev, ...data.events] : data.events));
        setHasMore(data.hasMore);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch');
      } finally {
        setLoading(false);
      }
    },
    [fromDate, toDate, sources, actor, action, q],
  );

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleSource = (s: AuditSource) => {
    setSources((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next.size === 0 ? new Set(ALL_SOURCES) : next;
    });
  };

  const loadMore = () => {
    const oldest = events[events.length - 1];
    if (!oldest) return;
    fetchEvents({ append: true, toOverride: oldest.at });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">稽核軌跡</h1>

      <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="flex flex-col text-xs text-slate-600">
            起始日期
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="mt-1 px-2 py-1.5 border border-slate-300 rounded text-sm text-slate-900"
            />
          </label>
          <label className="flex flex-col text-xs text-slate-600">
            結束日期
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="mt-1 px-2 py-1.5 border border-slate-300 rounded text-sm text-slate-900"
            />
          </label>
          <label className="flex flex-col text-xs text-slate-600">
            Actor（email 子字串）
            <input
              type="text"
              value={actor}
              onChange={(e) => setActor(e.target.value)}
              placeholder="例：alice@dna"
              className="mt-1 px-2 py-1.5 border border-slate-300 rounded text-sm text-slate-900"
            />
          </label>
          <label className="flex flex-col text-xs text-slate-600">
            動作（精確）
            <input
              type="text"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="例：refund / transfer"
              className="mt-1 px-2 py-1.5 border border-slate-300 rounded text-sm text-slate-900"
            />
          </label>
          <label className="flex flex-col text-xs text-slate-600 lg:col-span-3">
            搜尋（resource id / summary 子字串）
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="mt-1 px-2 py-1.5 border border-slate-300 rounded text-sm text-slate-900"
            />
          </label>
          <div className="flex items-end">
            <button
              onClick={() => fetchEvents()}
              disabled={loading}
              className="w-full bg-[#10B8D9] hover:bg-[#0EA5C4] disabled:opacity-50 text-white font-semibold py-2 rounded text-sm"
            >
              {loading ? '載入中…' : '套用'}
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {ALL_SOURCES.map((s) => (
            <button
              key={s}
              onClick={() => toggleSource(s)}
              className={`px-2 py-1 rounded text-xs font-medium ${
                sources.has(s)
                  ? SOURCE_BADGE[s]
                  : 'bg-slate-50 text-slate-400 border border-slate-200'
              }`}
            >
              {SOURCE_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded px-4 py-3 mb-4 text-sm">
          {error}
          <button
            onClick={() => fetchEvents()}
            className="ml-3 underline hover:no-underline"
          >
            重試
          </button>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">時間</th>
              <th className="px-3 py-2 text-left">來源</th>
              <th className="px-3 py-2 text-left">操作人</th>
              <th className="px-3 py-2 text-left">動作</th>
              <th className="px-3 py-2 text-left">對象</th>
              <th className="px-3 py-2 text-left">狀態</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {events.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                  在此區間沒有稽核紀錄
                </td>
              </tr>
            )}
            {events.map((ev) => {
              const isOpen = expanded === ev.id;
              const failed = ev.status === 'failed';
              return (
                <>
                  <tr
                    key={ev.id}
                    onClick={() => setExpanded(isOpen ? null : ev.id)}
                    className={`cursor-pointer hover:bg-slate-50 ${
                      failed ? 'border-l-4 border-red-500' : ''
                    }`}
                  >
                    <td className="px-3 py-2 text-slate-700 font-mono text-xs whitespace-nowrap">
                      {formatTime(ev.at)}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${SOURCE_BADGE[ev.source]}`}>
                        {SOURCE_LABELS[ev.source]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      <span className={`mr-2 px-1.5 py-0.5 rounded text-[10px] ${ACTOR_BADGE[ev.actorType]}`}>
                        {ev.actorType}
                      </span>
                      {ev.actor}
                    </td>
                    <td className="px-3 py-2 text-slate-700 font-mono text-xs">{ev.action}</td>
                    <td className="px-3 py-2">
                      {ev.resourceLink ? (
                        <a
                          href={ev.resourceLink}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-sky-600 hover:underline"
                        >
                          {ev.resourceLabel}
                        </a>
                      ) : (
                        <span className="text-slate-700">{ev.resourceLabel}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {ev.status === 'success' && <span className="text-emerald-600">✓</span>}
                      {ev.status === 'failed' && <span className="text-red-600">✗ 失敗</span>}
                      {ev.status === null && <span className="text-slate-400">—</span>}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr key={`${ev.id}:expand`} className="bg-slate-50">
                      <td colSpan={6} className="px-3 py-3">
                        <div className="text-xs text-slate-600 mb-2">{ev.summary}</div>
                        {ev.source === 'order_transfer' && (
                          <TransferExtras payload={ev.payload} />
                        )}
                        <pre className="bg-white border border-slate-200 rounded p-3 text-xs text-slate-800 overflow-x-auto">
                          {JSON.stringify(ev.payload, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>

        <div className="border-t border-slate-100 px-3 py-3 text-center">
          {hasMore ? (
            <button
              onClick={loadMore}
              disabled={loading}
              className="text-sm text-sky-600 hover:underline disabled:opacity-50"
            >
              {loading ? '載入中…' : '載入更多'}
            </button>
          ) : (
            events.length > 0 && (
              <span className="text-xs text-slate-400">沒有更多紀錄了</span>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function TransferExtras({ payload }: { payload: unknown }) {
  const p = payload as { ip_address?: string | null; user_agent?: string | null };
  if (!p || (!p.ip_address && !p.user_agent)) return null;
  return (
    <div className="mb-2 text-xs text-slate-600 flex flex-wrap gap-x-4">
      {p.ip_address && <span>IP: <code className="text-slate-800">{p.ip_address}</code></span>}
      {p.user_agent && <span className="truncate max-w-[60%]">UA: <code className="text-slate-800">{p.user_agent}</code></span>}
    </div>
  );
}
```

- [ ] **Step 2: `tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: `npm run lint`**

Run: `npm run lint`
Expected: no errors. The `<>` Fragment in the `events.map` body needs a stable key — the Fragment is keyed via the inner `<tr key={ev.id}>`; if lint flags `react/jsx-key` on the Fragment, convert to an array or add `<Fragment key={ev.id}>` explicitly.

If lint flags the Fragment:

```tsx
// replace
<>
  <tr key={ev.id} ...>...</tr>
  {isOpen && <tr key={`${ev.id}:expand`}...>...</tr>}
</>
// with
<Fragment key={ev.id}>
  <tr ...>...</tr>
  {isOpen && <tr ...>...</tr>}
</Fragment>
```

And add `import { Fragment, useCallback, useEffect, useState } from 'react';`.

- [ ] **Step 4: Commit**

```bash
git add app/admin/auditing/page.tsx
git commit -m "feat(admin/auditing): add client page with filters and timeline"
```

---

## Task 5: Wire nav tab

**Files:**
- Modify: `app/admin/layout.tsx`

- [ ] **Step 1: Add link between 發送紀錄 and Luma 同步**

In `app/admin/layout.tsx`, locate this block:

```tsx
<Link href="/admin/history" className="text-sm text-slate-300 hover:text-white transition-colors whitespace-nowrap">
  發送紀錄
</Link>
<Link
  href="/admin/luma-sync"
  ...
```

Insert between them:

```tsx
<Link href="/admin/auditing" className="text-sm text-slate-300 hover:text-white transition-colors whitespace-nowrap">
  稽核軌跡
</Link>
```

- [ ] **Step 2: `tsc --noEmit` and `npm run lint`**

Run: `npx tsc --noEmit && npm run lint`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add app/admin/layout.tsx
git commit -m "feat(admin/auditing): add 稽核軌跡 nav link"
```

---

## Task 6: Live verification

- [ ] **Step 1: Start dev server**

Run: `npm run dev` (in background; stop after verification)

- [ ] **Step 2: Manual smoke test**

Because `/admin/auditing` is an authenticated route and `DEV_SIGNIN_SECRET` is not set in `.env.local`, Claude cannot drive it with Playwright per CLAUDE.md. Hand off to the user with a clear checklist:

1. Open `http://localhost:3000/admin/auditing` in the browser where you're logged in as `@dna.org.tw`.
2. Expect to see: filter bar, table of events from last 7 days, no console errors.
3. Toggle a source chip off → table updates after clicking `套用`.
4. Enter an admin email substring in Actor → hit `套用` → only matching rows show.
5. Click a row → inline expansion shows the raw payload JSON.
6. If any `order_transfer` rows exist in the last 7 days, verify IP/UA appear above the JSON.
7. Click 對象 link on an `order_action` row → new tab opens at `/admin/orders/<id>`.
8. Check the 稽核軌跡 link appears in the top nav between 發送紀錄 and Luma 同步.

- [ ] **Step 3: Stop dev server**

Stop the background `npm run dev`.

---

## Self-review

**Spec coverage:**

| Spec requirement | Task |
| --- | --- |
| Route `/admin/auditing` | Task 4 |
| Nav link `稽核軌跡` | Task 5 |
| Three data sources (order_actions, order_transfers, visa_letter_issuances) | Task 3 |
| Keep overlapping transfer rows (no dedupe) | Task 3 (no dedupe logic is present) |
| `UnifiedEvent` shape with `id` prefixes `oa:` / `ot:` / `vl:` | Task 2 |
| Source → action mapping incl. user-initiated transfer uses `from_email` | Task 2 |
| GET `/api/admin/auditing` with `from/to/actor/source/action/q/limit` | Task 3 |
| Default window 7d, max 90d, max limit 500 | Task 3 |
| Auth enforced at API layer via `getAdminSession` | Task 3 |
| Parallel queries, `limit+1` to detect hasMore | Task 3 |
| Actor filter pushes down for all three tables (incl. `from_email` for transfers) | Task 3 |
| UI: filter bar, table, colored source badge, actor type badge, failed red border, expand row with JSON, "載入更多" | Task 4 |
| Empty/error states | Task 4 |
| No schema changes, no new table | no task — by omission |
| `tsc` + `lint` pass | Tasks 3,4,5 |
| Live smoke checklist | Task 6 |

No gaps.

**Placeholder scan:** all code blocks contain actual implementations, not "TODO" or "add appropriate handling." Good.

**Type consistency:** `UnifiedEvent` / `AuditSource` / `ActorType` / row types defined in Task 1, used consistently in Tasks 2/3/4. Normalizer names (`normalizeOrderAction` / `normalizeOrderTransfer` / `normalizeVisaLetterIssuance`) match across Tasks 2 and 3. `mergeAndSort` defined once, imported once.
