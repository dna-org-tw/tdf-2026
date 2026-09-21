# Admin Members CSV Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "匯出 CSV" button to `/admin/members` that downloads the current filtered member list as a CSV, using the same filter semantics as the list API and the same file-download pattern as `/admin/subscribers` and `/admin/orders`.

**Architecture:** Extract the filter parsing and Supabase query-builder logic currently inlined in `app/api/admin/members/route.ts` into a shared module `lib/adminMembersQuery.ts`. Introduce a new route `app/api/admin/members/export/route.ts` that reuses that module to stream the full result set as a UTF-8-BOM CSV. Add an export button to `app/admin/members/page.tsx` that passes the current filter state through as query params.

**Tech Stack:** Next.js 16 App Router, TypeScript 5 (strict), Supabase JS client (service role, server-only), existing `members_enriched` view.

**Spec:** `docs/superpowers/specs/2026-04-21-admin-members-export-design.md`

---

## File Structure

**New files:**
- `lib/adminMembersQuery.ts` — shared filter parsing + query builder (`parseMemberFilter`, `applyMemberFilter`) used by both the list route and the export route. Single responsibility: keep filter semantics identical across endpoints.
- `app/api/admin/members/export/route.ts` — GET handler that paginates through `members_enriched`, formats rows, returns CSV.

**Modified files:**
- `app/api/admin/members/route.ts` — replace the inlined `resolveIdentityFilter` / `resolveDisplayStatusFilter` / `buildFiltered` logic with calls into `lib/adminMembersQuery.ts`. No behavior change.
- `app/admin/members/page.tsx` — add `<a>` export button in the filter toolbar.

No migrations, no schema changes, no new env vars.

---

### Task 1: Extract shared filter module

**Files:**
- Create: `lib/adminMembersQuery.ts`

- [ ] **Step 1: Create the module with filter parser and applier**

`lib/adminMembersQuery.ts`:

```ts
import {
  type MemberStatus,
  type MemberTier,
  type TicketTier,
  type MemberIdentity,
  type DisplayStatus,
  MEMBER_STATUSES,
  MEMBER_TIERS,
  TICKET_TIERS,
  MEMBER_IDENTITIES,
  DISPLAY_STATUSES,
  DISPLAY_STATUS_TO_DB,
} from '@/lib/members';

export interface MemberFilter {
  search?: string;
  statuses?: MemberStatus[];
  tiers?: MemberTier[];
  ticketTiers?: TicketTier[];
  identities?: MemberIdentity[];
  displayStatuses?: DisplayStatus[];
  repeatOnly?: boolean;
}

function parseList<T extends string>(raw: string | null, allowed: readonly T[]): T[] | undefined {
  if (!raw) return undefined;
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean) as T[];
  const filtered = list.filter((v) => (allowed as readonly string[]).includes(v));
  return filtered.length ? filtered : undefined;
}

export function parseMemberFilter(searchParams: URLSearchParams): MemberFilter {
  return {
    search: searchParams.get('search')?.trim() || undefined,
    statuses: parseList<MemberStatus>(searchParams.get('status'), MEMBER_STATUSES),
    tiers: parseList<MemberTier>(searchParams.get('tier'), MEMBER_TIERS),
    ticketTiers: parseList<TicketTier>(searchParams.get('ticketTier'), TICKET_TIERS),
    identities: parseList<MemberIdentity>(searchParams.get('identity'), MEMBER_IDENTITIES),
    displayStatuses: parseList<DisplayStatus>(searchParams.get('displayStatus'), DISPLAY_STATUSES),
    repeatOnly: searchParams.get('repeat') === '1',
  };
}

function resolveIdentityFilter(identities: MemberIdentity[] | undefined): {
  ticketTiersFromIdentity?: TicketTier[];
  includeNullTier?: boolean;
} {
  if (!identities) return {};
  const tiers: TicketTier[] = [];
  let includeNullTier = false;
  for (const id of identities) {
    if (id === 'backer') tiers.push('backer', 'weekly_backer');
    else if (id === 'contributor') tiers.push('contribute');
    else if (id === 'explorer') tiers.push('explore');
    else if (id === 'follower') includeNullTier = true;
  }
  return {
    ticketTiersFromIdentity: tiers.length ? tiers : undefined,
    includeNullTier,
  };
}

function resolveDisplayStatusFilter(
  displayStatuses: DisplayStatus[] | undefined,
  statuses: MemberStatus[] | undefined
): MemberStatus[] | undefined {
  if (!displayStatuses) return statuses;
  const dbStatuses: MemberStatus[] = [];
  for (const ds of displayStatuses) {
    dbStatuses.push(...DISPLAY_STATUS_TO_DB[ds]);
  }
  return dbStatuses.length ? dbStatuses : undefined;
}

/**
 * Apply the shared member filter to a Supabase `members_enriched` query builder.
 *
 * Generic passthrough: the input builder's static type is preserved on the output,
 * so callers keep full type inference on subsequent `.order()` / `.range()` /
 * destructured `{ data, count, error }` results. Internally we cast to `any` to
 * sidestep Supabase's nested builder generics, which don't compose cleanly across
 * module boundaries.
 */
export function applyMemberFilter<T>(query: T, filter: MemberFilter): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = query;
  if (filter.search) {
    q = q.or(`email.ilike.%${filter.search}%,name.ilike.%${filter.search}%`);
  }
  const resolvedStatuses = resolveDisplayStatusFilter(filter.displayStatuses, filter.statuses);
  if (resolvedStatuses) q = q.in('status', resolvedStatuses);
  if (filter.tiers) q = q.in('tier', filter.tiers);
  if (filter.ticketTiers) q = q.in('highest_ticket_tier', filter.ticketTiers);
  const { ticketTiersFromIdentity, includeNullTier } = resolveIdentityFilter(filter.identities);
  if (ticketTiersFromIdentity && includeNullTier) {
    q = q.or(
      `highest_ticket_tier.in.(${ticketTiersFromIdentity.join(',')}),highest_ticket_tier.is.null`
    );
  } else if (ticketTiersFromIdentity) {
    q = q.in('highest_ticket_tier', ticketTiersFromIdentity);
  } else if (includeNullTier) {
    q = q.is('highest_ticket_tier', null);
  }
  if (filter.repeatOnly) q = q.gt('paid_order_count', 1);
  return q as T;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors introduced by the new file.

- [ ] **Step 3: Commit**

```bash
git add lib/adminMembersQuery.ts
git commit -m "refactor(admin/members): extract shared filter module"
```

---

### Task 2: Refactor list route to use the shared module

**Files:**
- Modify: `app/api/admin/members/route.ts`

- [ ] **Step 1: Replace filter parsing and query builder with imports**

Replace the entire file contents with:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';
import {
  type MemberStatus,
  type MemberTier,
  type TicketTier,
  type MemberIdentity,
  type DisplayStatus,
  type EnrichedMember,
  ticketTierToIdentity,
  memberStatusToDisplay,
} from '@/lib/members';
import { parseMemberFilter, applyMemberFilter } from '@/lib/adminMembersQuery';

export async function GET(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const filter = parseMemberFilter(searchParams);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));

  try {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const baseQuery = supabaseServer.from('members_enriched').select('*', { count: 'exact' });
    const { data, count, error } = await applyMemberFilter(baseQuery, filter)
      .order('score', { ascending: false })
      .order('last_interaction_at', { ascending: false, nullsFirst: false })
      .range(from, to);

    if (error) {
      console.error('[Admin Members]', error);
      return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
    }

    // Summary counts: filtered only by search (so chips show counts for the search scope,
    // not the already-filtered status/tier scope).
    let summaryQuery = supabaseServer
      .from('members_enriched')
      .select('status, tier, highest_ticket_tier', { head: false });
    if (filter.search) {
      summaryQuery = summaryQuery.or(`email.ilike.%${filter.search}%,name.ilike.%${filter.search}%`);
    }
    const { data: summaryRows, error: summaryErr } = await summaryQuery;
    if (summaryErr) {
      console.error('[Admin Members] summary', summaryErr);
    }

    const byStatus: Record<MemberStatus, number> = {
      paid: 0, pending: 0, abandoned: 0, subscriber: 0, other: 0,
    };
    const byTier: Record<MemberTier, number> = { S: 0, A: 0, B: 0, C: 0 };
    const byIdentity: Record<MemberIdentity, number> = {
      backer: 0, contributor: 0, explorer: 0, follower: 0,
    };
    const byDisplayStatus: Record<DisplayStatus, number> = {
      completed: 0, pending: 0, abandoned: 0, not_started: 0,
    };
    for (const row of summaryRows || []) {
      const s = row.status as MemberStatus;
      const t = row.tier as MemberTier;
      if (byStatus[s] !== undefined) byStatus[s]++;
      if (byTier[t] !== undefined) byTier[t]++;
      const identity = ticketTierToIdentity(row.highest_ticket_tier as TicketTier | null);
      byIdentity[identity]++;
      const ds = memberStatusToDisplay(s);
      byDisplayStatus[ds]++;
    }

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return NextResponse.json({
      members: (data || []) as EnrichedMember[],
      total,
      totalPages,
      page,
      summary: { byStatus, byTier, byIdentity, byDisplayStatus },
    });
  } catch (err) {
    console.error('[Admin Members] unexpected', err);
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors.

- [ ] **Step 3: Manual smoke test of list page**

Start dev server if not running: `npm run dev`.
Open `/admin/members` (after dev-signin as `kk@dna.org.tw`). Apply each filter combination in turn — search, identity chips, displayStatus chips, repeat-only — and confirm the list and counts are unchanged from before the refactor. The "共 X 位會員" number and summary chip counts must match the pre-refactor behavior.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/members/route.ts
git commit -m "refactor(admin/members): use shared filter module in list route"
```

---

### Task 3: Implement the export API route

**Files:**
- Create: `app/api/admin/members/export/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';
import {
  type EnrichedMember,
  ticketTierToIdentity,
  memberStatusToDisplay,
} from '@/lib/members';
import { parseMemberFilter, applyMemberFilter } from '@/lib/adminMembersQuery';

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatAmount(cents: number | null): string {
  if (cents === null || cents === undefined) return '';
  return (cents / 100).toFixed(2);
}

function formatBool(value: boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  return value ? 'TRUE' : 'FALSE';
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
  const filter = parseMemberFilter(searchParams);

  const pageSize = 1000;
  const rows: EnrichedMember[] = [];
  let offset = 0;

  try {
    while (true) {
      const baseQuery = supabaseServer.from('members_enriched').select('*');
      const { data, error } = await applyMemberFilter(baseQuery, filter)
        .order('score', { ascending: false })
        .order('last_interaction_at', { ascending: false, nullsFirst: false })
        .range(offset, offset + pageSize - 1);

      if (error) {
        console.error('[Admin Members Export]', error);
        return NextResponse.json({ error: 'Failed to export members' }, { status: 500 });
      }
      if (!data || data.length === 0) break;
      rows.push(...(data as EnrichedMember[]));
      if (data.length < pageSize) break;
      offset += pageSize;
    }

    const header = [
      'member_no',
      'name',
      'email',
      'phone',
      'identity',
      'display_status',
      'tier',
      'paid_order_count',
      'total_spent',
      'currency',
      'score',
      'subscribed_newsletter',
      'first_seen_at',
      'last_interaction_at',
      'last_order_at',
      'earliest_valid_from',
      'latest_valid_until',
    ];

    const lines = [header.join(',')];
    for (const r of rows) {
      const identity = ticketTierToIdentity(r.highest_ticket_tier);
      const displayStatus = memberStatusToDisplay(r.status);
      lines.push(
        [
          csvEscape(r.member_no),
          csvEscape(r.name),
          csvEscape(r.email),
          csvEscape(r.phone),
          csvEscape(identity),
          csvEscape(displayStatus),
          csvEscape(r.tier),
          csvEscape(r.paid_order_count),
          csvEscape(formatAmount(r.total_spent_cents)),
          csvEscape(r.currency),
          csvEscape(r.score),
          csvEscape(formatBool(r.subscribed_newsletter)),
          csvEscape(r.first_seen_at),
          csvEscape(r.last_interaction_at),
          csvEscape(r.last_order_at),
          csvEscape(r.earliest_valid_from),
          csvEscape(r.latest_valid_until),
        ].join(',')
      );
    }
    const csv = '\uFEFF' + lines.join('\r\n');

    const ts = new Date().toISOString().slice(0, 10);
    const filename = `members-${ts}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[Admin Members Export]', error);
    return NextResponse.json({ error: 'Failed to export members' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 3: Smoke test with curl (no auth → 401)**

Run (dev server running):
```bash
curl -i http://localhost:3100/api/admin/members/export
```
Expected: HTTP/1.1 401 with `{"error":"Unauthorized"}`.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/members/export/route.ts
git commit -m "feat(admin/members): add CSV export API"
```

---

### Task 4: Add the export button to the members page

**Files:**
- Modify: `app/admin/members/page.tsx:133-151` (the filter toolbar block)

- [ ] **Step 1: Add the export link inside the filter toolbar**

Replace lines 133–151 (the `<div className="bg-white rounded-xl p-4 shadow-sm mb-4 flex flex-wrap gap-3 items-center">` block ending with `</div>`) with:

```tsx
      <div className="bg-white rounded-xl p-4 shadow-sm mb-4 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋 Email 或姓名..."
          className="flex-1 min-w-[200px] px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10B8D9] text-slate-900 text-sm"
        />
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
        <a
          href={`/api/admin/members/export?${new URLSearchParams({
            ...(search ? { search } : {}),
            ...(identities.length ? { identity: identities.join(',') } : {}),
            ...(displayStatuses.length ? { displayStatus: displayStatuses.join(',') } : {}),
            ...(repeatOnly ? { repeat: '1' } : {}),
          }).toString()}`}
          className="px-4 py-2 text-sm font-medium text-white bg-[#10B8D9] rounded-lg hover:bg-[#0EA5C4] transition-colors whitespace-nowrap"
          title="以目前篩選條件匯出 CSV"
        >
          匯出 CSV
        </a>
      </div>
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 3: Manual UI check**

In browser (dev-signin as `kk@dna.org.tw`):
1. Open `/admin/members`. Confirm "匯出 CSV" button appears next to "共 X 位會員".
2. Click with no filters. Verify `members-YYYY-MM-DD.csv` downloads, opens cleanly in Excel (zh characters readable via BOM), column order matches the header list in Task 3.
3. Type `kk` into search. Click export. Confirm downloaded row count = the "共 X 位會員" number.
4. Toggle an identity chip (e.g. Backer). Click export. Confirm only backer-identity rows present.
5. Toggle `只看多筆訂單`. Click export. Confirm every row has `paid_order_count >= 2`.
6. Combine search + identity + displayStatus + repeat. Click export. Confirm filtered count matches.

- [ ] **Step 4: Commit**

```bash
git add app/admin/members/page.tsx
git commit -m "feat(admin/members): add CSV export button"
```

---

### Task 5: Final verification

- [ ] **Step 1: Final lint + type check on full repo**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors introduced by this branch.

- [ ] **Step 2: Regression check on list page**

In browser, open `/admin/members` and exercise every filter. Confirm counts and list match the behavior observed before Task 2 (the refactor). If anything differs, stop and diagnose the shared-module regression before shipping.

- [ ] **Step 3: Verify no secrets or test data leaked**

Run: `git diff main --stat`
Expected: only the 4 files in scope (`lib/adminMembersQuery.ts`, `app/api/admin/members/route.ts`, `app/api/admin/members/export/route.ts`, `app/admin/members/page.tsx`) plus the spec/plan docs.

- [ ] **Step 4: Push and hand off**

No push in plan — user decides when to push and open PR (per CLAUDE.md git safety). Report "ready for review" and wait for direction.
