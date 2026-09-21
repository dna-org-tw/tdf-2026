# Luma Auto-Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically approve/decline/waitlist Luma event registrations based on TDF membership tier, ticket type match, validity period, and no-show history — executed as part of the existing Luma sync job.

**Architecture:** After the sync worker finishes upserting guests, a new `runAutoReview(jobId, cookie)` phase processes all `pending_approval` guests. It queries `orders` for membership data, applies business rules (tier match, weekly validity, no-show penalty), calls the Luma API to update guest status, and logs every decision to `luma_review_log`. The member dashboard shows no-show penalty consumption status.

**Tech Stack:** Next.js API routes, Supabase (PostgreSQL), Luma internal API (`update-guest-status`), TypeScript

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `supabase/migrations/add_luma_auto_review.sql` | Create | New table `luma_review_log`, new columns on `luma_sync_jobs` |
| `lib/lumaApi.ts` | Modify | Add `updateGuestStatus()` function |
| `lib/lumaAutoReview.ts` | Create | Core auto-review logic: membership lookup, tier matching, no-show calculation, batch processing |
| `lib/lumaSyncWorker.ts` | Modify | Call `runAutoReview()` after sync completes |
| `lib/lumaSyncTypes.ts` | Modify | Add `reviewReason` to `Registration`, review stats to `SyncJob` |
| `lib/lumaSyncConfig.ts` | Modify | Include `reviewReason` and no-show stats in `shapeRegistrations()` |
| `app/api/auth/luma-registrations/route.ts` | Modify | Query and return no-show consumption data |
| `components/member/UpcomingEvents.tsx` | Modify | Display no-show penalty consumption status and waitlist reason |

## Key Constants

```typescript
// Luma ticket type name → TDF identity weight
const LUMA_TICKET_WEIGHT: Record<string, number> = {
  'TDF Follower': 1,
  'TDF Explorer': 2,
  'TDF Contributor': 3,
  'TDF Backer': 4,
};

// TDF ticket_tier (from orders) → identity weight
const TDF_TIER_WEIGHT: Record<string, number> = {
  'explore': 2,
  'contribute': 3,
  'weekly_backer': 4,
  'backer': 4,
};

// Follower: anyone in members table with no paid order (subscriber/other status)
// gets weight 1
```

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/add_luma_auto_review.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Luma auto-review log and sync job review stats.

CREATE TABLE IF NOT EXISTS luma_review_log (
  id                  BIGSERIAL PRIMARY KEY,
  job_id              BIGINT REFERENCES luma_sync_jobs(id) ON DELETE CASCADE,
  event_api_id        TEXT NOT NULL,
  email               TEXT NOT NULL,
  member_id           BIGINT REFERENCES members(id) ON DELETE SET NULL,
  luma_guest_api_id   TEXT,
  previous_status     TEXT NOT NULL,
  new_status          TEXT NOT NULL,
  reason              TEXT NOT NULL,
  consumed_no_show_event_api_id TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_luma_review_log_job ON luma_review_log (job_id);
CREATE INDEX IF NOT EXISTS idx_luma_review_log_email ON luma_review_log (email);
CREATE INDEX IF NOT EXISTS idx_luma_review_log_email_reason ON luma_review_log (email, reason);

ALTER TABLE luma_review_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE luma_review_log FORCE ROW LEVEL SECURITY;

-- Review statistics on sync jobs
ALTER TABLE luma_sync_jobs ADD COLUMN IF NOT EXISTS review_approved INTEGER NOT NULL DEFAULT 0;
ALTER TABLE luma_sync_jobs ADD COLUMN IF NOT EXISTS review_declined INTEGER NOT NULL DEFAULT 0;
ALTER TABLE luma_sync_jobs ADD COLUMN IF NOT EXISTS review_waitlisted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE luma_sync_jobs ADD COLUMN IF NOT EXISTS review_skipped INTEGER NOT NULL DEFAULT 0;
```

- [ ] **Step 2: Apply migration**

Run: `npx supabase migration up` or apply via Supabase dashboard SQL editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/add_luma_auto_review.sql
git commit -m "feat(db): add luma_review_log table and review stats columns"
```

---

### Task 2: Luma API — Guest Status Update

**Files:**
- Modify: `lib/lumaApi.ts` (add after line 116)

- [ ] **Step 1: Add `updateGuestStatus` function**

Add to `lib/lumaApi.ts` after the existing `fetchEventGuests` function:

```typescript
export async function updateGuestStatus(
  cookie: string,
  eventApiId: string,
  rsvpApiId: string,
  approvalStatus: 'approved' | 'declined' | 'waitlist',
): Promise<void> {
  await lumaFetch(
    'https://api2.luma.com/event/admin/update-guest-status',
    cookie,
    {
      method: 'POST',
      body: JSON.stringify({
        event_api_id: eventApiId,
        rsvp_api_id: rsvpApiId,
        approval_status: approvalStatus,
        should_refund: false,
        event_ticket_type_api_id: null,
      }),
    },
  );
}
```

- [ ] **Step 2: Modify `lumaFetch` to accept request options**

The current `lumaFetch` only does GET. Update its signature at line 48:

```typescript
async function lumaFetch(url: string, cookie: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...BASE_HEADERS,
      Cookie: cookie,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
    cache: 'no-store',
  });
  if (res.status === 401 || res.status === 403) {
    throw new LumaAuthError(res.status);
  }
  if (!res.ok) {
    throw new Error(`luma_http_${res.status}`);
  }
  return res.json();
}
```

Existing callers (`fetchCalendarItems`, `fetchEventGuests`, `probeCookie`) pass no `init` so they continue to work as GET requests.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add lib/lumaApi.ts
git commit -m "feat(luma): add updateGuestStatus API and support POST in lumaFetch"
```

---

### Task 3: Core Auto-Review Logic

**Files:**
- Create: `lib/lumaAutoReview.ts`

- [ ] **Step 1: Create `lib/lumaAutoReview.ts`**

```typescript
import { supabaseServer } from '@/lib/supabaseServer';
import { updateGuestStatus, LumaAuthError } from '@/lib/lumaApi';

const SLEEP_MS_BETWEEN_UPDATES = 300;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function db() {
  if (!supabaseServer) throw new Error('db_not_configured');
  return supabaseServer;
}

// --- Constants ---

const LUMA_TICKET_WEIGHT: Record<string, number> = {
  'TDF Follower': 1,
  'TDF Explorer': 2,
  'TDF Contributor': 3,
  'TDF Backer': 4,
};

const TDF_TIER_WEIGHT: Record<string, number> = {
  explore: 2,
  contribute: 3,
  weekly_backer: 4,
  backer: 4,
};

// Sorting weight for review priority: higher weight = processed first
function reviewPriority(tier: string | null): number {
  if (!tier) return 0;
  return TDF_TIER_WEIGHT[tier] ?? 0;
}

// --- Types ---

interface PendingGuest {
  event_api_id: string;
  email: string;
  luma_guest_api_id: string | null;
  ticket_type_name: string | null;
  member_id: number | null;
  event_start_at: string | null;
}

interface MembershipInfo {
  highest_ticket_tier: string | null;
  status: string;
  // All paid orders with validity info for weekly_backer check
  orders: Array<{
    ticket_tier: string;
    valid_from: string | null;
    valid_until: string | null;
  }>;
}

type ReviewDecision = {
  status: 'approved' | 'declined' | 'waitlist';
  reason: string;
  consumedNoShowEventApiId?: string;
};

// --- Membership Lookup ---

async function getMembershipMap(emails: string[]): Promise<Map<string, MembershipInfo>> {
  const supa = db();
  const map = new Map<string, MembershipInfo>();
  if (emails.length === 0) return map;

  // Get highest_ticket_tier and status from members_enriched
  const { data: members } = await supa
    .from('members_enriched')
    .select('email, highest_ticket_tier, status')
    .in('email', emails);

  // Get all paid orders with validity for these emails
  const { data: orders } = await supa
    .from('orders')
    .select('customer_email, ticket_tier, valid_from, valid_until')
    .eq('status', 'paid')
    .in('customer_email', emails);

  const ordersByEmail = new Map<string, MembershipInfo['orders']>();
  for (const o of orders ?? []) {
    const email = (o.customer_email as string).trim().toLowerCase();
    if (!ordersByEmail.has(email)) ordersByEmail.set(email, []);
    ordersByEmail.get(email)!.push({
      ticket_tier: o.ticket_tier,
      valid_from: o.valid_from,
      valid_until: o.valid_until,
    });
  }

  for (const m of members ?? []) {
    map.set(m.email, {
      highest_ticket_tier: m.highest_ticket_tier,
      status: m.status,
      orders: ordersByEmail.get(m.email) ?? [],
    });
  }

  // Emails not in members_enriched → no membership
  for (const email of emails) {
    if (!map.has(email)) {
      map.set(email, { highest_ticket_tier: null, status: 'other', orders: [] });
    }
  }

  return map;
}

// --- No-Show Calculation ---

async function getNoShowData(emails: string[]): Promise<Map<string, { noShowEventIds: string[]; consumedCount: number }>> {
  const supa = db();
  const map = new Map<string, { noShowEventIds: string[]; consumedCount: number }>();
  if (emails.length === 0) return map;

  // Past events where guest was approved but didn't check in
  const { data: noShows } = await supa
    .from('luma_guests')
    .select('email, event_api_id, luma_events!inner(start_at)')
    .eq('activity_status', 'approved')
    .is('checked_in_at', null)
    .lt('luma_events.start_at', new Date().toISOString())
    .in('email', emails);

  for (const ns of noShows ?? []) {
    if (!map.has(ns.email)) map.set(ns.email, { noShowEventIds: [], consumedCount: 0 });
    map.get(ns.email)!.noShowEventIds.push(ns.event_api_id);
  }

  // Count previously consumed no-show penalties
  const { data: consumed } = await supa
    .from('luma_review_log')
    .select('email')
    .eq('reason', 'waitlist:no_show_penalty')
    .in('email', emails);

  const consumedCounts = new Map<string, number>();
  for (const c of consumed ?? []) {
    consumedCounts.set(c.email, (consumedCounts.get(c.email) ?? 0) + 1);
  }
  for (const [email, data] of map) {
    data.consumedCount = consumedCounts.get(email) ?? 0;
  }

  return map;
}

// --- Decision Logic ---

function decide(
  guest: PendingGuest,
  membership: MembershipInfo,
  noShowInfo: { noShowEventIds: string[]; consumedCount: number } | undefined,
): ReviewDecision {
  // Step 1: No membership (no paid order and not even a subscriber with follower access)
  const tier = membership.highest_ticket_tier;
  const memberWeight = tier ? (TDF_TIER_WEIGHT[tier] ?? 0) : 0;
  const isFollower = !tier && (membership.status === 'subscriber' || membership.status === 'other');

  // Determine effective member weight (follower = 1, paid tiers use TDF_TIER_WEIGHT)
  const effectiveWeight = memberWeight > 0 ? memberWeight : isFollower ? 1 : 0;

  if (effectiveWeight === 0) {
    return { status: 'declined', reason: 'declined:no_membership' };
  }

  // Step 2: Ticket type mismatch
  const lumaTicket = guest.ticket_type_name ?? '';
  const requiredWeight = LUMA_TICKET_WEIGHT[lumaTicket];

  if (requiredWeight !== undefined && effectiveWeight < requiredWeight) {
    return { status: 'declined', reason: 'declined:tier_mismatch' };
  }

  // Step 3: Weekly backer validity check
  if (tier === 'weekly_backer' && guest.event_start_at) {
    const eventDate = guest.event_start_at.slice(0, 10); // YYYY-MM-DD
    const weeklyOrders = membership.orders.filter((o) => o.ticket_tier === 'weekly_backer');
    const inRange = weeklyOrders.some(
      (o) => o.valid_from && o.valid_until && eventDate >= o.valid_from && eventDate <= o.valid_until,
    );
    // Also check if they have a higher tier (backer) that covers the date
    const hasFullMonthHigher = membership.orders.some(
      (o) => o.ticket_tier === 'backer' && o.valid_from && o.valid_until && eventDate >= o.valid_from && eventDate <= o.valid_until,
    );
    if (!inRange && !hasFullMonthHigher) {
      return { status: 'declined', reason: 'declined:weekly_out_of_range' };
    }
  }

  // Step 4: No-show penalty
  if (noShowInfo) {
    const remaining = noShowInfo.noShowEventIds.length - noShowInfo.consumedCount;
    if (remaining > 0) {
      // Find the earliest unconsumed no-show event
      const consumedEventId = noShowInfo.noShowEventIds[noShowInfo.consumedCount];
      return {
        status: 'waitlist',
        reason: 'waitlist:no_show_penalty',
        consumedNoShowEventApiId: consumedEventId,
      };
    }
  }

  // Step 5: Approved
  return { status: 'approved', reason: 'approved:eligible' };
}

// --- Main Entry Point ---

export async function runAutoReview(jobId: number, cookie: string): Promise<void> {
  const supa = db();

  // Fetch all pending_approval guests with event start_at
  const { data: pendingRaw, error: fetchErr } = await supa
    .from('luma_guests')
    .select('event_api_id, email, luma_guest_api_id, ticket_type_name, member_id, luma_events!inner(start_at)')
    .eq('activity_status', 'pending_approval');

  if (fetchErr) {
    await supa.from('luma_sync_jobs').update({ error_summary: `review_fetch_failed: ${fetchErr.message}` }).eq('id', jobId);
    return;
  }

  const pending: PendingGuest[] = (pendingRaw ?? []).map((r: Record<string, unknown>) => ({
    event_api_id: r.event_api_id as string,
    email: r.email as string,
    luma_guest_api_id: r.luma_guest_api_id as string | null,
    ticket_type_name: r.ticket_type_name as string | null,
    member_id: r.member_id as number | null,
    event_start_at: (r.luma_events as Record<string, unknown>)?.start_at as string | null,
  }));

  if (pending.length === 0) {
    await supa.from('luma_sync_jobs').update({ review_skipped: 0 }).eq('id', jobId);
    return;
  }

  // Batch lookups
  const emails = [...new Set(pending.map((g) => g.email))];
  const [membershipMap, noShowMap] = await Promise.all([
    getMembershipMap(emails),
    getNoShowData(emails),
  ]);

  // Sort by review priority: backer first, then contributor, explorer, follower
  pending.sort((a, b) => {
    const ma = membershipMap.get(a.email);
    const mb = membershipMap.get(b.email);
    return reviewPriority(mb?.highest_ticket_tier ?? null) - reviewPriority(ma?.highest_ticket_tier ?? null);
  });

  // Process each guest
  let approved = 0;
  let declined = 0;
  let waitlisted = 0;
  let skipped = 0;

  for (const guest of pending) {
    if (!guest.luma_guest_api_id) {
      skipped += 1;
      continue;
    }

    const membership = membershipMap.get(guest.email) ?? { highest_ticket_tier: null, status: 'other', orders: [] };
    const noShowInfo = noShowMap.get(guest.email);
    const decision = decide(guest, membership, noShowInfo);

    // Call Luma API
    try {
      await updateGuestStatus(cookie, guest.event_api_id, guest.luma_guest_api_id, decision.status);
    } catch (err) {
      if (err instanceof LumaAuthError) throw err; // bubble up auth errors
      skipped += 1;
      continue;
    }

    // Update local luma_guests
    await supa
      .from('luma_guests')
      .update({ activity_status: decision.status })
      .eq('event_api_id', guest.event_api_id)
      .eq('email', guest.email);

    // Log the decision
    await supa.from('luma_review_log').insert({
      job_id: jobId,
      event_api_id: guest.event_api_id,
      email: guest.email,
      member_id: guest.member_id,
      luma_guest_api_id: guest.luma_guest_api_id,
      previous_status: 'pending_approval',
      new_status: decision.status,
      reason: decision.reason,
      consumed_no_show_event_api_id: decision.consumedNoShowEventApiId ?? null,
    });

    // Track no-show consumption for subsequent guests with same email
    if (decision.reason === 'waitlist:no_show_penalty' && noShowInfo) {
      noShowInfo.consumedCount += 1;
    }

    switch (decision.status) {
      case 'approved': approved += 1; break;
      case 'declined': declined += 1; break;
      case 'waitlist': waitlisted += 1; break;
    }

    await sleep(SLEEP_MS_BETWEEN_UPDATES);
  }

  // Update job stats
  await supa
    .from('luma_sync_jobs')
    .update({
      review_approved: approved,
      review_declined: declined,
      review_waitlisted: waitlisted,
      review_skipped: skipped,
    })
    .eq('id', jobId);
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add lib/lumaAutoReview.ts
git commit -m "feat(luma): add auto-review logic for pending registrations"
```

---

### Task 4: Integrate Auto-Review into Sync Worker

**Files:**
- Modify: `lib/lumaSyncWorker.ts` (add import at top, call after sync loop)

- [ ] **Step 1: Add import**

At the top of `lib/lumaSyncWorker.ts`, add:

```typescript
import { runAutoReview } from '@/lib/lumaAutoReview';
```

- [ ] **Step 2: Call `runAutoReview` after sync completes**

In `runSyncJob()`, after the final status update (around line 221-231), add the auto-review call. Replace the final block:

```typescript
  const finalStatus = failed === 0 ? 'succeeded' : processed > 0 ? 'partial' : 'failed';
  await supa
    .from('luma_sync_jobs')
    .update({
      status: finalStatus,
      finished_at: new Date().toISOString(),
      processed_events: processed,
      failed_events: failed,
      total_guests_upserted: totalGuestsUpserted,
    })
    .eq('id', jobId);
```

With:

```typescript
  const finalStatus = failed === 0 ? 'succeeded' : processed > 0 ? 'partial' : 'failed';
  await supa
    .from('luma_sync_jobs')
    .update({
      status: finalStatus,
      finished_at: new Date().toISOString(),
      processed_events: processed,
      failed_events: failed,
      total_guests_upserted: totalGuestsUpserted,
    })
    .eq('id', jobId);

  // Phase 2: Auto-review pending registrations
  if (finalStatus !== 'failed' && cookie) {
    try {
      await runAutoReview(jobId, cookie);
    } catch (err) {
      // Log but don't fail the entire job — sync data is already saved
      const msg = (err as Error).message ?? 'unknown';
      await supa
        .from('luma_sync_jobs')
        .update({ error_summary: `review_error: ${msg}` })
        .eq('id', jobId);
    }
  }
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add lib/lumaSyncWorker.ts
git commit -m "feat(luma): run auto-review after sync completes"
```

---

### Task 5: Update Types and Registration Shaping

**Files:**
- Modify: `lib/lumaSyncTypes.ts` (add `reviewReason` to `Registration`, review stats to `SyncJob`)
- Modify: `lib/lumaSyncConfig.ts` (include `reviewReason` in `shapeRegistrations`)

- [ ] **Step 1: Update `Registration` type in `lib/lumaSyncTypes.ts`**

Add `reviewReason` field to the `Registration` interface (after `stale` on line 55):

```typescript
export interface Registration {
  eventApiId: string;
  eventName: string;
  startAt: string | null;
  endAt: string | null;
  url: string | null;
  activityStatus: string | null;
  paid: boolean;
  checkedInAt: string | null;
  registeredAt: string | null;
  ticketTypeName: string | null;
  amountCents: number | null;
  currency: string | null;
  stale: boolean;
  reviewReason: string | null;
}
```

- [ ] **Step 2: Update `SyncJob` type in `lib/lumaSyncTypes.ts`**

Add review stats to `SyncJob` (after `created_at` on line 16):

```typescript
export interface SyncJob {
  id: number;
  trigger: 'manual' | 'cron';
  status: SyncJobStatus;
  started_at: string | null;
  finished_at: string | null;
  total_events: number;
  processed_events: number;
  failed_events: number;
  total_guests_upserted: number;
  error_summary: string | null;
  triggered_by: string | null;
  created_at: string;
  review_approved: number;
  review_declined: number;
  review_waitlisted: number;
  review_skipped: number;
}
```

- [ ] **Step 3: Update `LumaGuestRow` and `shapeRegistrations` in `lib/lumaSyncConfig.ts`**

The `shapeRegistrations` function needs to accept review reason data. Update the function to accept an optional review reasons map:

```typescript
export async function shapeRegistrations(
  rows: LumaGuestRow[],
  reviewReasons?: Map<string, string>,
): Promise<Registration[]> {
  let staleCutoff: number | null = null;
  if (supabaseServer) {
    const { data: lastJob } = await supabaseServer
      .from('luma_sync_jobs')
      .select('started_at')
      .in('status', ['succeeded', 'partial'])
      .order('started_at', { ascending: false })
      .limit(1);
    const ts = lastJob?.[0]?.started_at;
    if (ts) staleCutoff = new Date(ts).getTime() - 24 * 60 * 60 * 1000;
  }

  return rows.map((r) => ({
    eventApiId: r.event_api_id,
    eventName: r.luma_events?.name ?? r.event_api_id,
    startAt: r.luma_events?.start_at ?? null,
    endAt: r.luma_events?.end_at ?? null,
    url: r.luma_events?.url ?? null,
    activityStatus: r.activity_status,
    paid: r.paid,
    checkedInAt: r.checked_in_at,
    registeredAt: r.registered_at,
    ticketTypeName: r.ticket_type_name,
    amountCents: r.amount_cents,
    currency: r.currency,
    stale: staleCutoff !== null && new Date(r.last_synced_at).getTime() < staleCutoff,
    reviewReason: reviewReasons?.get(r.event_api_id) ?? null,
  }));
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/lumaSyncTypes.ts lib/lumaSyncConfig.ts
git commit -m "feat(luma): add reviewReason to Registration type and review stats to SyncJob"
```

---

### Task 6: Update Registrations API to Include Review Data

**Files:**
- Modify: `app/api/auth/luma-registrations/route.ts`

- [ ] **Step 1: Query review reasons and no-show stats**

Replace the GET handler in `app/api/auth/luma-registrations/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabaseServer';
import { shapeRegistrations, type LumaGuestRow } from '@/lib/lumaSyncConfig';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'db' }, { status: 500 });

  const email = session.email.trim().toLowerCase();
  const { data, error } = await supabaseServer
    .from('luma_guests')
    .select(`
      event_api_id, activity_status, paid, checked_in_at, registered_at,
      ticket_type_name, amount_cents, currency, last_synced_at,
      luma_events ( name, start_at, end_at, url )
    `)
    .eq('email', email)
    .order('registered_at', { ascending: false, nullsFirst: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch review reasons for this user's registrations
  const { data: reviews } = await supabaseServer
    .from('luma_review_log')
    .select('event_api_id, reason')
    .eq('email', email)
    .order('created_at', { ascending: false });

  // Build map: event_api_id → most recent reason
  const reviewReasons = new Map<string, string>();
  for (const r of reviews ?? []) {
    if (!reviewReasons.has(r.event_api_id)) {
      reviewReasons.set(r.event_api_id, r.reason);
    }
  }

  // Count no-show penalty stats
  const noShowTotal = (reviews ?? []).filter((r) => r.reason === 'waitlist:no_show_penalty').length;

  const registrations = await shapeRegistrations(
    (data ?? []) as unknown as LumaGuestRow[],
    reviewReasons,
  );

  return NextResponse.json({ registrations, noShowConsumedCount: noShowTotal });
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/luma-registrations/route.ts
git commit -m "feat(luma): return review reasons and no-show stats in registrations API"
```

---

### Task 7: Update Member Dashboard UI

**Files:**
- Modify: `components/member/UpcomingEvents.tsx`

- [ ] **Step 1: Update Props to accept `noShowConsumedCount`**

Update the `Props` interface (line 15) and the component signature:

```typescript
interface Props {
  registrations: Registration[];
  lang: 'en' | 'zh';
  noShowConsumedCount: number;
}
```

Update the component:

```typescript
export default function UpcomingEvents({ registrations, lang, noShowConsumedCount }: Props) {
```

- [ ] **Step 2: Update the no-show footer section**

Replace the no-show warning in the footer (lines 185-194):

```typescript
      {noShowCount > 0 && (
          <div className="px-5 py-2.5 bg-red-50/50 border-b border-red-100/60 flex items-center gap-2">
            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-red-400" aria-hidden />
            <p className="text-[11px] text-red-600/90 leading-snug">
              {lang === 'zh'
                ? `${noShowCount} 次未到場${noShowConsumedCount > 0 ? `，已消化 ${noShowConsumedCount} 次` : ''}${noShowCount - noShowConsumedCount > 0 ? `（剩餘 ${noShowCount - noShowConsumedCount} 次待消化）` : '（已全部消化）'}`
                : `${noShowCount} no-show${noShowCount > 1 ? 's' : ''}${noShowConsumedCount > 0 ? ` — ${noShowConsumedCount} consumed` : ''}${noShowCount - noShowConsumedCount > 0 ? ` (${noShowCount - noShowConsumedCount} remaining)` : ' (all consumed)'}`}
            </p>
          </div>
        )}
```

- [ ] **Step 3: Update waitlist status display to show reason**

In the `STATUS_LABELS` map (line 20), the status label for `waitlist` already exists. The distinction will be in the `EventRow` component. Update `EventRow` to show the reason when it's a no-show penalty:

Add a helper above `EventRow`:

```typescript
function getWaitlistLabel(reg: Registration, lang: 'en' | 'zh'): { label: string; tone: 'pos' | 'warn' | 'neutral' | 'neg' } | null {
  if (reg.activityStatus !== 'waitlist') return null;
  if (reg.reviewReason === 'waitlist:no_show_penalty') {
    return {
      label: lang === 'zh' ? '候補中（消化未到場）' : 'Waitlisted (no-show)',
      tone: 'warn',
    };
  }
  return { label: lang === 'zh' ? '候補中' : 'Waitlist', tone: 'warn' };
}
```

In `EventRow`, replace the status badge rendering (around line 283-288):

```typescript
          {/* Approval status badge — inline with title for upcoming */}
          {!past && (() => {
            const waitlistOverride = getWaitlistLabel(reg, lang);
            if (waitlistOverride) {
              return (
                <span className={`shrink-0 text-[10px] px-1.5 py-[1px] rounded-full font-medium leading-none ${TONE_CLASSES[waitlistOverride.tone]}`}>
                  {waitlistOverride.label}
                </span>
              );
            }
            if (status) {
              return (
                <span className={`shrink-0 text-[10px] px-1.5 py-[1px] rounded-full font-medium leading-none ${TONE_CLASSES[status.tone]}`}>
                  {status[lang]}
                </span>
              );
            }
            return null;
          })()}
```

- [ ] **Step 4: Update the parent component that renders `UpcomingEvents`**

Find the parent that passes `registrations` to `UpcomingEvents` and ensure it also passes `noShowConsumedCount`. Search for `<UpcomingEvents` in the codebase and update the prop.

The API response now returns `{ registrations, noShowConsumedCount }`, so the parent needs to extract and pass both.

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add components/member/UpcomingEvents.tsx
git commit -m "feat(member): show no-show penalty consumption and waitlist reasons"
```

---

### Task 8: Update Admin Sync Job Display (if applicable)

**Files:**
- Check and modify any admin component that displays sync job details to show review stats

- [ ] **Step 1: Find admin sync components**

Search for components that display `SyncJob` data (likely in `components/admin/`). Update them to show `review_approved`, `review_declined`, `review_waitlisted`, `review_skipped` counts.

- [ ] **Step 2: Add review stats row to the job detail display**

Add a row showing: "Auto-review: N approved, N declined, N waitlisted, N skipped"

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add components/admin/
git commit -m "feat(admin): show auto-review stats in sync job details"
```

---

### Task 9: Final Integration Test

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: Clean build, no errors.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: No lint errors.

- [ ] **Step 3: Manual test plan**

Test the following scenarios via the admin panel:
1. Trigger a manual Luma sync
2. Verify sync completes and auto-review runs
3. Check `luma_review_log` table for entries
4. Check `luma_sync_jobs` for review stats
5. Log in as a member and check the UpcomingEvents component
6. Verify no-show penalty display works correctly

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(luma): complete auto-review integration"
```
