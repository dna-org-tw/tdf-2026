# Member Card Collections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let logged-in members collect each other's cards — browsing public cards on `/members/[memberNo]` or exchanging private cards on-site via a short-lived QR token. Surface "my collections" and "who collected me" in a dedicated `/me/collections` page, with an unread badge entry on `/me`.

**Architecture:** New `member_collections` table + `collections_last_viewed_at` column on `member_profiles`. Stateless HS256 JWT (via existing `jose` dep) for 5-min QR tokens. Six new API routes under `/api/member/...` and one extension to `/api/members/[memberNo]`. Three new UI components (`QrShareModal`, `CollectButton`, `CollectionList`) plus a new `/me/collections` page and small edits to `/me` and `/members/[memberNo]`.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (server-side with service role), `jose` for JWT, `qrcode.react` (`QRCodeSVG`) for QR rendering — all already installed.

**Testing note:** This project has no test framework (per `CLAUDE.md`). "Verify" steps are manual checks against the local dev server (`npm run dev`) or Supabase SQL. Screenshots for UI work go under `.screenshots/2026-04-17/`.

---

## File Structure

### New files

| Path | Responsibility |
|---|---|
| `supabase/migrations/zzzzzzz_create_member_collections.sql` | Table, indexes, RLS, and the `collections_last_viewed_at` column |
| `lib/memberCollections.ts` | JWT issue/verify + Supabase helpers (list, create, delete, mark-viewed) + shared types |
| `app/api/member/qr-token/route.ts` | `POST` — issue 5-min JWT for caller |
| `app/api/member/collections/route.ts` | `GET` list + `POST` create |
| `app/api/member/collections/[memberNo]/route.ts` | `DELETE` remove |
| `app/api/member/collections/mark-viewed/route.ts` | `POST` update timestamp |
| `components/member/QrShareModal.tsx` | Modal shown by "Show my QR" button |
| `components/member/CollectButton.tsx` | Button rendered on `/members/[memberNo]` |
| `components/member/CollectionList.tsx` | List item + list rendering used on `/me/collections` |
| `app/me/collections/page.tsx` | The two-section page |

### Modified files

| Path | Change |
|---|---|
| `app/api/members/[memberNo]/route.ts` | Accept optional `?t=<jwt>`; return private profile when token validates |
| `app/me/page.tsx` | Add collections entry row with unread badge; add "Show my QR" button |
| `app/members/[memberNo]/page.tsx` | Render `<CollectButton>` below passport; forward `?t=` from URL |
| `data/content.ts` | Add `collections` i18n block in both `en` and `zh` |
| `.env.example` | Document `MEMBER_QR_SECRET` |

---

## Task 1: Database migration

**Files:**
- Create: `supabase/migrations/zzzzzzz_create_member_collections.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Member card collections: one-way bookmark between two members.
-- Collector saves the collected person's card; collected person sees
-- an entry in their "collectors" list.

CREATE TABLE IF NOT EXISTS member_collections (
  id                       BIGSERIAL PRIMARY KEY,
  collector_member_id      BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  collected_member_id      BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  source                   TEXT NOT NULL CHECK (source IN ('public', 'qr')),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT member_collections_unique UNIQUE (collector_member_id, collected_member_id),
  CONSTRAINT member_collections_not_self CHECK (collector_member_id <> collected_member_id)
);

CREATE INDEX IF NOT EXISTS idx_member_collections_collector
  ON member_collections(collector_member_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_member_collections_collected
  ON member_collections(collected_member_id, created_at DESC);

ALTER TABLE member_collections ENABLE ROW LEVEL SECURITY;

ALTER TABLE member_profiles
  ADD COLUMN IF NOT EXISTS collections_last_viewed_at TIMESTAMPTZ;
```

- [ ] **Step 2: Apply the migration**

The project uses Supabase; migrations are applied via `mcp__claude_ai_Supabase__apply_migration` or the Supabase CLI. Apply against the dev project referenced in `.env.local`:

```
# via MCP (preferred for this repo):
mcp__claude_ai_Supabase__apply_migration  name=create_member_collections  query=<paste SQL above>
```

- [ ] **Step 3: Verify schema**

Run in SQL editor (or via `execute_sql`):

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'member_collections' ORDER BY ordinal_position;

SELECT column_name FROM information_schema.columns
WHERE table_name = 'member_profiles' AND column_name = 'collections_last_viewed_at';
```

Expected: `member_collections` has 5 columns (`id`, `collector_member_id`, `collected_member_id`, `source`, `created_at`). `member_profiles` query returns one row.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/zzzzzzz_create_member_collections.sql
git commit -m "feat(db): add member_collections table and last_viewed_at column"
```

---

## Task 2: Collections library helpers

**Files:**
- Create: `lib/memberCollections.ts`

- [ ] **Step 1: Write the helpers**

```ts
// lib/memberCollections.ts
import { SignJWT, jwtVerify } from 'jose';
import { supabaseServer } from './supabaseServer';

const QR_TOKEN_TTL_SECONDS = 300;

let cachedQrSecret: Uint8Array | null = null;

function getQrSecret(): Uint8Array {
  if (cachedQrSecret) return cachedQrSecret;
  const secret = process.env.MEMBER_QR_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('MEMBER_QR_SECRET environment variable is required in production');
    }
    // Dev fallback: reuse AUTH_SECRET so tokens survive process restarts while developing
    const fallback = process.env.AUTH_SECRET ?? 'dev-member-qr-secret';
    console.warn('[memberCollections] MEMBER_QR_SECRET not set — using fallback. Set it for production.');
    cachedQrSecret = new TextEncoder().encode(fallback);
    return cachedQrSecret;
  }
  cachedQrSecret = new TextEncoder().encode(secret);
  return cachedQrSecret;
}

export interface QrTokenPayload {
  member_no: string;
  exp: number;
}

export async function issueQrToken(memberNo: string): Promise<{ token: string; expiresAt: string }> {
  const expSeconds = Math.floor(Date.now() / 1000) + QR_TOKEN_TTL_SECONDS;
  const token = await new SignJWT({ member_no: memberNo })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(expSeconds)
    .sign(getQrSecret());
  return { token, expiresAt: new Date(expSeconds * 1000).toISOString() };
}

export async function verifyQrToken(token: string): Promise<QrTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getQrSecret());
    if (typeof payload.member_no !== 'string') return null;
    if (typeof payload.exp !== 'number') return null;
    return { member_no: payload.member_no, exp: payload.exp };
  } catch {
    return null;
  }
}

export interface CollectionEntry {
  member_no: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  tags: string[];
  tier: string;
  collected_at: string;
  source: 'public' | 'qr';
  is_unread?: boolean;
}

// Resolves the caller's member id from an email (session.email is the source of truth).
export async function getMemberIdByEmail(email: string): Promise<number | null> {
  if (!supabaseServer) return null;
  const { data } = await supabaseServer
    .from('members')
    .select('id')
    .ilike('email', email)
    .maybeSingle();
  return data?.id ?? null;
}

export async function getMemberIdByNo(memberNo: string): Promise<number | null> {
  if (!supabaseServer) return null;
  const { data } = await supabaseServer
    .from('members')
    .select('id')
    .eq('member_no', memberNo)
    .maybeSingle();
  return data?.id ?? null;
}

interface RawProfileRow {
  member_id: number;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  tags: string[] | null;
  is_public: boolean;
}

async function hydrateEntries(
  rows: Array<{ member_id: number; created_at: string; source: 'public' | 'qr' }>,
  opts: { unreadSince?: string | null } = {},
): Promise<CollectionEntry[]> {
  if (!supabaseServer || rows.length === 0) return [];
  const memberIds = rows.map((r) => r.member_id);

  const { data: members } = await supabaseServer
    .from('members')
    .select('id, member_no')
    .in('id', memberIds);
  const idToNo = new Map<number, string>((members ?? []).map((m) => [m.id, m.member_no]));

  const { data: profiles } = await supabaseServer
    .from('member_profiles')
    .select('member_id, display_name, avatar_url, bio, location, tags, is_public')
    .in('member_id', memberIds);
  const profileByMemberId = new Map<number, RawProfileRow>(
    (profiles ?? []).map((p) => [p.member_id, p as RawProfileRow]),
  );

  const memberNos = Array.from(idToNo.values()).filter(Boolean);
  const { data: enriched } = await supabaseServer
    .from('members_enriched')
    .select('member_no, highest_ticket_tier')
    .in('member_no', memberNos);
  const tierByNo = new Map<string, string>(
    (enriched ?? []).map((e) => [e.member_no, e.highest_ticket_tier || 'follower']),
  );

  const unreadSinceMs = opts.unreadSince ? new Date(opts.unreadSince).getTime() : null;

  return rows.map((r) => {
    const memberNo = idToNo.get(r.member_id) ?? '';
    const profile = profileByMemberId.get(r.member_id);
    const entry: CollectionEntry = {
      member_no: memberNo,
      display_name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      bio: profile?.bio ?? null,
      location: profile?.location ?? null,
      tags: profile?.tags ?? [],
      tier: tierByNo.get(memberNo) ?? 'follower',
      collected_at: r.created_at,
      source: r.source,
    };
    if (unreadSinceMs !== null) {
      entry.is_unread = new Date(r.created_at).getTime() > unreadSinceMs;
    } else if (opts.unreadSince === null) {
      // No last_viewed_at on file → treat every collector as unread
      entry.is_unread = true;
    }
    return entry;
  });
}

export async function fetchCollectionsForMember(memberId: number) {
  if (!supabaseServer) {
    return { collected: [], collectors: [], unreadCount: 0 };
  }

  const [collectedRes, collectorsRes, profileRes] = await Promise.all([
    supabaseServer
      .from('member_collections')
      .select('collected_member_id, created_at, source')
      .eq('collector_member_id', memberId)
      .order('created_at', { ascending: false }),
    supabaseServer
      .from('member_collections')
      .select('collector_member_id, created_at, source')
      .eq('collected_member_id', memberId)
      .order('created_at', { ascending: false }),
    supabaseServer
      .from('member_profiles')
      .select('collections_last_viewed_at')
      .eq('member_id', memberId)
      .maybeSingle(),
  ]);

  const collectedRows = (collectedRes.data ?? []).map((r) => ({
    member_id: r.collected_member_id,
    created_at: r.created_at,
    source: r.source,
  }));
  const collectorRows = (collectorsRes.data ?? []).map((r) => ({
    member_id: r.collector_member_id,
    created_at: r.created_at,
    source: r.source,
  }));

  const lastViewedAt = profileRes.data?.collections_last_viewed_at ?? null;

  const [collected, collectors] = await Promise.all([
    hydrateEntries(collectedRows),
    hydrateEntries(collectorRows, { unreadSince: lastViewedAt }),
  ]);

  const unreadCount = collectors.filter((c) => c.is_unread).length;
  return { collected, collectors, unreadCount };
}

export async function createCollection(params: {
  collectorMemberId: number;
  collectedMemberId: number;
  source: 'public' | 'qr';
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!supabaseServer) return { ok: false, error: 'no_db' };
  if (params.collectorMemberId === params.collectedMemberId) {
    return { ok: false, error: 'self_collect' };
  }
  // Upsert on the unique constraint — keep the first source on re-collect.
  const { error } = await supabaseServer
    .from('member_collections')
    .upsert(
      {
        collector_member_id: params.collectorMemberId,
        collected_member_id: params.collectedMemberId,
        source: params.source,
      },
      { onConflict: 'collector_member_id,collected_member_id', ignoreDuplicates: true },
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function removeCollection(params: {
  collectorMemberId: number;
  collectedMemberId: number;
}): Promise<void> {
  if (!supabaseServer) return;
  await supabaseServer
    .from('member_collections')
    .delete()
    .eq('collector_member_id', params.collectorMemberId)
    .eq('collected_member_id', params.collectedMemberId);
}

export async function markCollectionsViewed(memberId: number): Promise<void> {
  if (!supabaseServer) return;
  await supabaseServer
    .from('member_profiles')
    .upsert(
      { member_id: memberId, collections_last_viewed_at: new Date().toISOString() },
      { onConflict: 'member_id' },
    );
}

// Checks if the target profile allows public collection (i.e., is_public = true).
export async function isMemberPublic(memberId: number): Promise<boolean> {
  if (!supabaseServer) return false;
  const { data } = await supabaseServer
    .from('member_profiles')
    .select('is_public')
    .eq('member_id', memberId)
    .maybeSingle();
  return !!data?.is_public;
}
```

- [ ] **Step 2: Sanity-check TypeScript**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add lib/memberCollections.ts
git commit -m "feat(lib): add member collections helpers with QR JWT"
```

---

## Task 3: QR token API route

**Files:**
- Create: `app/api/member/qr-token/route.ts`

- [ ] **Step 1: Write the route**

```ts
// app/api/member/qr-token/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabaseServer';
import { issueQrToken } from '@/lib/memberCollections';

export async function POST(req: NextRequest) {
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: member } = await supabaseServer
    .from('members')
    .select('member_no')
    .ilike('email', session.email)
    .maybeSingle();

  if (!member?.member_no) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  const { token, expiresAt } = await issueQrToken(member.member_no);
  return NextResponse.json({ token, expiresAt });
}
```

- [ ] **Step 2: Verify with curl**

Start dev server in another terminal: `npm run dev`.

Without session (should 401):
```bash
curl -i -X POST http://localhost:3000/api/member/qr-token
```
Expected: `HTTP/1.1 401`.

With session — log in via UI first, copy the `tdf_session` cookie, then:
```bash
curl -i -X POST http://localhost:3000/api/member/qr-token \
  -H "Cookie: tdf_session=<value>"
```
Expected: `200` with `{"token":"eyJ...","expiresAt":"2026-04-17T..."}`.

- [ ] **Step 3: Commit**

```bash
git add app/api/member/qr-token/route.ts
git commit -m "feat(api): issue 5-minute QR tokens for member collections"
```

---

## Task 4: Collections list + create API

**Files:**
- Create: `app/api/member/collections/route.ts`

- [ ] **Step 1: Write the route**

```ts
// app/api/member/collections/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabaseServer';
import { checkRateLimit } from '@/lib/rateLimit';
import {
  createCollection,
  fetchCollectionsForMember,
  getMemberIdByEmail,
  getMemberIdByNo,
  isMemberPublic,
  verifyQrToken,
} from '@/lib/memberCollections';

export async function GET(req: NextRequest) {
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const memberId = await getMemberIdByEmail(session.email);
  if (!memberId) {
    return NextResponse.json({ collected: [], collectors: [], unreadCount: 0 });
  }
  const result = await fetchCollectionsForMember(memberId);
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as { member_no?: string; token?: string } | null;
  if (!body?.member_no || !/^M\d+$/.test(body.member_no)) {
    return NextResponse.json({ error: 'Invalid member_no' }, { status: 400 });
  }

  const collectorId = await getMemberIdByEmail(session.email);
  if (!collectorId) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  const rl = await checkRateLimit(`member_collections_post:${collectorId}`, {
    limit: 60,
    windowSeconds: 3600,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }

  const collectedId = await getMemberIdByNo(body.member_no);
  if (!collectedId) {
    return NextResponse.json({ error: 'Target not found' }, { status: 404 });
  }
  if (collectedId === collectorId) {
    return NextResponse.json({ error: 'Cannot collect yourself' }, { status: 400 });
  }

  const isPublic = await isMemberPublic(collectedId);
  let source: 'public' | 'qr' = 'public';

  if (!isPublic) {
    if (!body.token) {
      return NextResponse.json({ error: 'Token required for private card' }, { status: 403 });
    }
    const payload = await verifyQrToken(body.token);
    if (!payload || payload.member_no !== body.member_no) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    source = 'qr';
  }

  const result = await createCollection({
    collectorMemberId: collectorId,
    collectedMemberId: collectedId,
    source,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, source });
}
```

- [ ] **Step 2: Verify GET with curl**

Log in as a test user first. Then:

```bash
curl -i http://localhost:3000/api/member/collections \
  -H "Cookie: tdf_session=<value>"
```
Expected: `200` with `{"collected":[],"collectors":[],"unreadCount":0}` if the account has no activity.

- [ ] **Step 3: Verify POST against a public card**

Pick a public member (check Supabase: `select member_no from member_profiles mp join members m on mp.member_id=m.id where mp.is_public=true limit 1;`).

```bash
curl -i -X POST http://localhost:3000/api/member/collections \
  -H "Content-Type: application/json" \
  -H "Cookie: tdf_session=<value>" \
  -d '{"member_no":"M000123"}'
```
Expected: `200` `{"ok":true,"source":"public"}`. Second call: still `200` (idempotent).

Then verify in SQL: `select * from member_collections order by id desc limit 1;` → one row with correct ids.

- [ ] **Step 4: Verify POST against a private card without token (should 403)**

Find a member with `is_public=false`. Same curl with their `member_no`. Expected: `403`.

- [ ] **Step 5: Commit**

```bash
git add app/api/member/collections/route.ts
git commit -m "feat(api): list and create member card collections"
```

---

## Task 5: Collections delete API

**Files:**
- Create: `app/api/member/collections/[memberNo]/route.ts`

- [ ] **Step 1: Write the route**

```ts
// app/api/member/collections/[memberNo]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabaseServer';
import {
  getMemberIdByEmail,
  getMemberIdByNo,
  removeCollection,
} from '@/lib/memberCollections';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ memberNo: string }> },
) {
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }
  const { memberNo } = await params;
  if (!/^M\d+$/.test(memberNo)) {
    return NextResponse.json({ error: 'Invalid member_no' }, { status: 400 });
  }

  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const collectorId = await getMemberIdByEmail(session.email);
  if (!collectorId) {
    return NextResponse.json({ ok: true });
  }

  const collectedId = await getMemberIdByNo(memberNo);
  if (!collectedId) {
    return NextResponse.json({ ok: true });
  }

  await removeCollection({ collectorMemberId: collectorId, collectedMemberId: collectedId });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verify with curl**

```bash
curl -i -X DELETE http://localhost:3000/api/member/collections/M000123 \
  -H "Cookie: tdf_session=<value>"
```
Expected: `200` `{"ok":true}`. Confirm row removed: `select count(*) from member_collections where collector_member_id = <me>;`

- [ ] **Step 3: Commit**

```bash
git add app/api/member/collections/[memberNo]/route.ts
git commit -m "feat(api): remove a member card from your collection"
```

---

## Task 6: Mark-viewed API

**Files:**
- Create: `app/api/member/collections/mark-viewed/route.ts`

- [ ] **Step 1: Write the route**

```ts
// app/api/member/collections/mark-viewed/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabaseServer';
import { getMemberIdByEmail, markCollectionsViewed } from '@/lib/memberCollections';

export async function POST(req: NextRequest) {
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const memberId = await getMemberIdByEmail(session.email);
  if (!memberId) {
    return NextResponse.json({ ok: true });
  }
  await markCollectionsViewed(memberId);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verify**

```bash
curl -i -X POST http://localhost:3000/api/member/collections/mark-viewed \
  -H "Cookie: tdf_session=<value>"
```
Expected: `200` `{"ok":true}`. Confirm in SQL: `select collections_last_viewed_at from member_profiles where member_id = <me>;` → recent timestamp.

- [ ] **Step 3: Commit**

```bash
git add app/api/member/collections/mark-viewed/route.ts
git commit -m "feat(api): mark member collections as viewed"
```

---

## Task 7: Extend public profile API with token support

**Files:**
- Modify: `app/api/members/[memberNo]/route.ts`

- [ ] **Step 1: Replace the whole file**

```ts
// app/api/members/[memberNo]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { verifyQrToken } from '@/lib/memberCollections';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ memberNo: string }> },
) {
  const { memberNo: member_no } = await params;
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  if (!/^M\d+$/.test(member_no)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get('t');

  try {
    const { data: member, error: mErr } = await supabaseServer
      .from('members')
      .select('id, member_no, first_seen_at, email')
      .eq('member_no', member_no)
      .maybeSingle();
    if (mErr) throw mErr;
    if (!member) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { data: profile, error: pErr } = await supabaseServer
      .from('member_profiles')
      .select('display_name, bio, avatar_url, location, timezone, tags, languages, social_links, is_public')
      .eq('member_id', member.id)
      .maybeSingle();
    if (pErr) throw pErr;

    let allowed = !!profile?.is_public;
    if (!allowed && token) {
      const payload = await verifyQrToken(token);
      if (payload && payload.member_no === member_no) allowed = true;
    }
    if (!allowed) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { data: enriched } = await supabaseServer
      .from('members_enriched')
      .select('highest_ticket_tier')
      .eq('member_no', member_no)
      .maybeSingle();

    let validFrom: string | null = null;
    let validUntil: string | null = null;
    if (member.email) {
      const { data: order } = await supabaseServer
        .from('orders')
        .select('valid_from, valid_until')
        .eq('customer_email', member.email)
        .eq('status', 'paid')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      validFrom = order?.valid_from ?? null;
      validUntil = order?.valid_until ?? null;
    }

    return NextResponse.json({
      member_no: member.member_no,
      first_seen_at: member.first_seen_at,
      display_name: profile?.display_name ?? null,
      bio: profile?.bio ?? null,
      avatar_url: profile?.avatar_url ?? null,
      location: profile?.location ?? null,
      timezone: profile?.timezone ?? null,
      tags: profile?.tags ?? [],
      languages: profile?.languages ?? [],
      social_links: profile?.social_links ?? {},
      tier: enriched?.highest_ticket_tier || 'follower',
      valid_from: validFrom,
      valid_until: validUntil,
      is_public: !!profile?.is_public,
    });
  } catch (e) {
    console.error('[Public Member Profile]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

Note: we also combine the two separate `members` queries (the original code fetched the email row twice) into one; we add `is_public` to the response so the UI can adapt the collect button.

- [ ] **Step 2: Verify public member still works**

```bash
curl -s http://localhost:3000/api/members/M000123 | jq .member_no
```
Expected: `"M000123"`.

- [ ] **Step 3: Verify private returns 404 without token**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/members/<private-no>
```
Expected: `404`.

- [ ] **Step 4: Verify private with a valid token returns data**

Issue a token for the private member by logging in *as them* and hitting `POST /api/member/qr-token`. Grab `token`. Then:

```bash
curl -s http://localhost:3000/api/members/<private-no>?t=<token> | jq .member_no
```
Expected: `"<private-no>"`.

- [ ] **Step 5: Commit**

```bash
git add app/api/members/[memberNo]/route.ts
git commit -m "feat(api): accept QR token on public profile route for private card reveal"
```

---

## Task 8: i18n strings

**Files:**
- Modify: `data/content.ts` (add `collections` block in both `en` and `zh`)

- [ ] **Step 1: Add English block**

Add this inside the `en` object, right after the existing `memberDetail: { ... }` block (around line 66):

```ts
    collections: {
      entryLabel: "Card collections",
      pageTitle: "Card collections",
      pageSubtitle: "People you've saved and people who saved you",
      sectionCollected: "My collections",
      sectionCollectors: "Collected me",
      emptyCollected: "No cards saved yet. Browse /members or scan a QR at the festival.",
      emptyCollectors: "Nobody has saved your card yet.",
      remove: "Remove",
      removeConfirm: "Remove this card from your collection?",
      collect: "Collect card",
      collected: "Collected",
      collecting: "Collecting…",
      loginToCollect: "Log in to collect",
      qrShow: "Show my QR",
      qrTitle: "Share my card",
      qrHelper: "Have them scan this to collect your card",
      qrExpiresIn: "Expires in {mm}:{ss}",
      qrExpired: "Expired — regenerating…",
      qrRegenerate: "Regenerate",
      qrError: "QR expired. Please ask them to regenerate.",
      privacyHint: "After collecting, this person can see your card.",
      newBadge: "New",
      sourcePublic: "Public directory",
      sourceQr: "On-site QR",
      backToMe: "Back to my account",
    },
```

- [ ] **Step 2: Add Traditional Chinese block**

Add this inside the `zh` object, right after the existing `memberDetail: { ... }` block (around line 1103):

```ts
    collections: {
      entryLabel: "名片收藏",
      pageTitle: "名片收藏",
      pageSubtitle: "你收藏的人，以及收藏你的人",
      sectionCollected: "我收藏的",
      sectionCollectors: "收藏我的",
      emptyCollected: "還沒有收藏任何名片。逛逛 /members 或在現場掃描 QR 收藏別人吧！",
      emptyCollectors: "還沒有人收藏你的名片。",
      remove: "移除",
      removeConfirm: "確定要從收藏移除這張名片嗎？",
      collect: "收藏名片",
      collected: "已收藏",
      collecting: "收藏中…",
      loginToCollect: "登入以收藏",
      qrShow: "顯示我的 QR",
      qrTitle: "分享我的名片",
      qrHelper: "請對方掃描此 QR 收藏你的名片",
      qrExpiresIn: "{mm}:{ss} 後過期",
      qrExpired: "已過期，正在重新產生…",
      qrRegenerate: "重新產生",
      qrError: "QR 已過期，請請對方重新產生。",
      privacyHint: "收藏後對方可看到你的名片。",
      newBadge: "新",
      sourcePublic: "公開名片",
      sourceQr: "現場掃碼",
      backToMe: "回到我的帳戶",
    },
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors — the `content.en` and `content.zh` shapes must match.

- [ ] **Step 4: Commit**

```bash
git add data/content.ts
git commit -m "feat(i18n): add card collections strings (en/zh)"
```

---

## Task 9: QrShareModal component

**Files:**
- Create: `components/member/QrShareModal.tsx`

- [ ] **Step 1: Write the component**

```tsx
// components/member/QrShareModal.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface QrShareModalProps {
  open: boolean;
  onClose: () => void;
  memberNo: string;
  lang: 'en' | 'zh';
  labels: {
    qrTitle: string;
    qrHelper: string;
    qrExpiresIn: string;
    qrExpired: string;
    qrRegenerate: string;
  };
}

export default function QrShareModal({ open, onClose, memberNo, lang, labels }: QrShareModalProps) {
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchToken = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/member/qr-token', { method: 'POST' });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setToken(data.token);
      setExpiresAt(data.expiresAt);
    } catch (err) {
      console.error('[QrShareModal] fetch failed', err);
      setError('fetch_failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchToken();
    else { setToken(null); setExpiresAt(null); setError(null); }
  }, [open, fetchToken]);

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [open]);

  const msLeft = expiresAt ? Math.max(0, new Date(expiresAt).getTime() - now) : 0;
  const mm = Math.floor(msLeft / 60000).toString().padStart(2, '0');
  const ss = Math.floor((msLeft % 60000) / 1000).toString().padStart(2, '0');
  const expiredMessage = labels.qrExpiresIn.replace('{mm}', mm).replace('{ss}', ss);
  const isExpired = msLeft === 0 && !!expiresAt;

  // Auto-regenerate once on expiry
  useEffect(() => {
    if (isExpired && !loading) fetchToken();
  }, [isExpired, loading, fetchToken]);

  const qrUrl = useMemo(() => {
    if (!token) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/members/${memberNo}?t=${token}`;
  }, [token, memberNo]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-6 max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900">{labels.qrTitle}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col items-center">
          {qrUrl ? (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <QRCodeSVG value={qrUrl} size={220} level="M" />
            </div>
          ) : (
            <div className="w-[220px] h-[220px] bg-stone-100 rounded-xl animate-pulse" />
          )}

          <p className="text-[12px] text-slate-500 mt-4 text-center">{labels.qrHelper}</p>
          <p
            className={`text-[11px] mt-2 font-mono ${
              isExpired ? 'text-red-500' : 'text-slate-400'
            }`}
          >
            {isExpired ? labels.qrExpired : expiredMessage}
          </p>

          <button
            type="button"
            onClick={fetchToken}
            disabled={loading}
            className="mt-4 text-[12px] text-[#10B8D9] hover:underline disabled:opacity-50"
          >
            {labels.qrRegenerate}
          </button>
          {error && (
            <p className="text-[11px] text-red-500 mt-2">
              {lang === 'zh' ? '產生失敗，請重試。' : 'Failed to generate QR. Try again.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/member/QrShareModal.tsx
git commit -m "feat(member): add QrShareModal with 5-min countdown"
```

---

## Task 10: CollectButton component

**Files:**
- Create: `components/member/CollectButton.tsx`

- [ ] **Step 1: Write the component**

```tsx
// components/member/CollectButton.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface CollectButtonProps {
  memberNo: string;
  token?: string | null;
  lang: 'en' | 'zh';
  labels: {
    collect: string;
    collected: string;
    collecting: string;
    loginToCollect: string;
    privacyHint: string;
    qrError: string;
  };
}

type Status = 'idle' | 'collecting' | 'collected' | 'need-login' | 'error';

export default function CollectButton({ memberNo, token, lang, labels }: CollectButtonProps) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [alreadyCollected, setAlreadyCollected] = useState<boolean>(false);

  useEffect(() => {
    // Lightweight session probe + membership check
    fetch('/api/member/collections')
      .then((r) => {
        if (r.status === 401) { setHasSession(false); return null; }
        setHasSession(true);
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        const found = (data.collected ?? []).some((c: { member_no: string }) => c.member_no === memberNo);
        if (found) { setAlreadyCollected(true); setStatus('collected'); }
      })
      .catch(() => { setHasSession(false); });
  }, [memberNo]);

  const handleClick = async () => {
    if (hasSession === false) {
      router.push('/me');
      return;
    }
    if (status === 'collecting' || status === 'collected') return;
    setStatus('collecting');
    setErrorMessage(null);
    try {
      const res = await fetch('/api/member/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_no: memberNo, token: token ?? undefined }),
      });
      if (res.status === 401) {
        setErrorMessage(labels.qrError);
        setStatus('error');
        return;
      }
      if (!res.ok) {
        setStatus('error');
        setErrorMessage(lang === 'zh' ? '收藏失敗，請稍後再試。' : 'Failed to collect. Try again.');
        return;
      }
      setAlreadyCollected(true);
      setStatus('collected');
    } catch {
      setStatus('error');
      setErrorMessage(lang === 'zh' ? '網路錯誤，請稍後再試。' : 'Network error. Try again.');
    }
  };

  const label =
    hasSession === false ? labels.loginToCollect :
    status === 'collecting' ? labels.collecting :
    alreadyCollected || status === 'collected' ? labels.collected :
    labels.collect;

  return (
    <div className="w-full flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={status === 'collecting' || status === 'collected' || alreadyCollected}
        className={`w-full max-w-xs rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
          alreadyCollected || status === 'collected'
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
            : 'bg-[#10B8D9] text-white hover:bg-[#0EA5C4] disabled:opacity-50'
        }`}
      >
        {label}
      </button>
      {!alreadyCollected && status !== 'collected' && hasSession !== false && (
        <p className="text-[11px] text-slate-400 text-center max-w-xs">
          {labels.privacyHint}
        </p>
      )}
      {errorMessage && (
        <p className="text-[11px] text-red-500 text-center">{errorMessage}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/member/CollectButton.tsx
git commit -m "feat(member): add CollectButton with auto-detect login state"
```

---

## Task 11: CollectionList component + /me/collections page

**Files:**
- Create: `components/member/CollectionList.tsx`
- Create: `app/me/collections/page.tsx`

- [ ] **Step 1: Write `CollectionList.tsx`**

```tsx
// components/member/CollectionList.tsx
'use client';

import Link from 'next/link';
import { TIER_ACCENT, type IdentityTier } from './MemberPassport';
import type { CollectionEntry } from '@/lib/memberCollections';

interface CollectionListProps {
  entries: CollectionEntry[];
  mode: 'collected' | 'collectors';
  labels: {
    remove: string;
    removeConfirm: string;
    newBadge: string;
    empty: string;
  };
  onRemove?: (memberNo: string) => void;
}

export default function CollectionList({ entries, mode, labels, onRemove }: CollectionListProps) {
  if (entries.length === 0) {
    return (
      <p className="text-center text-slate-400 text-sm py-8">{labels.empty}</p>
    );
  }

  return (
    <ul className="space-y-3">
      {entries.map((entry) => {
        const tier = (entry.tier || 'follower') as IdentityTier;
        const accent = TIER_ACCENT[tier] || TIER_ACCENT.follower;
        const initials = entry.display_name
          ? entry.display_name.trim().slice(0, 2).toUpperCase()
          : (entry.member_no || '??').slice(-2);
        const highlight = mode === 'collectors' && entry.is_unread;
        return (
          <li
            key={entry.member_no}
            className={`relative bg-white rounded-xl border p-4 transition-colors ${
              highlight ? 'border-[#10B8D9] bg-cyan-50/30' : 'border-slate-200'
            }`}
          >
            <Link
              href={`/members/${entry.member_no}`}
              className="flex items-start gap-3 group"
            >
              {entry.avatar_url ? (
                <img
                  src={entry.avatar_url}
                  alt={entry.display_name || ''}
                  className="w-12 h-12 rounded-full object-cover shrink-0"
                />
              ) : (
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center font-bold shrink-0 text-sm"
                  style={{ backgroundColor: `${accent}20`, color: accent }}
                >
                  {initials}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-semibold text-slate-900 text-sm truncate group-hover:text-[#10B8D9] transition-colors">
                    {entry.display_name || entry.member_no}
                  </p>
                  {highlight && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#10B8D9] text-white shrink-0">
                      {labels.newBadge}
                    </span>
                  )}
                </div>
                {entry.location && (
                  <p className="text-[12px] text-slate-500 truncate">{entry.location}</p>
                )}
                {entry.bio && (
                  <p className="text-[12px] text-slate-500 mt-1 line-clamp-2">{entry.bio}</p>
                )}
              </div>
            </Link>

            {mode === 'collected' && onRemove && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(labels.removeConfirm)) onRemove(entry.member_no);
                }}
                className="absolute top-2 right-2 text-[11px] text-slate-400 hover:text-red-500 transition-colors"
              >
                {labels.remove}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
```

Note: `TIER_ACCENT` is already exported from `components/member/MemberPassport.tsx` — this is imported.

- [ ] **Step 2: Write `/me/collections/page.tsx`**

```tsx
// app/me/collections/page.tsx
'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/hooks/useTranslation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CollectionList from '@/components/member/CollectionList';
import type { CollectionEntry } from '@/lib/memberCollections';

function CollectionsPage() {
  const { user, loading: authLoading } = useAuth();
  const { t, lang } = useTranslation();
  const [collected, setCollected] = useState<CollectionEntry[]>([]);
  const [collectors, setCollectors] = useState<CollectionEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const labels = t.collections;

  const fetchLists = useCallback(async () => {
    try {
      const res = await fetch('/api/member/collections');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCollected(data.collected ?? []);
      setCollectors(data.collectors ?? []);
    } catch {
      setCollected([]);
      setCollectors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchLists();
    fetch('/api/member/collections/mark-viewed', { method: 'POST' }).catch(() => {});
  }, [user, fetchLists]);

  const handleRemove = async (memberNo: string) => {
    setCollected((prev) => prev.filter((c) => c.member_no !== memberNo));
    await fetch(`/api/member/collections/${memberNo}`, { method: 'DELETE' });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-3 border-[#10B8D9] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Navbar />
        <main className="pt-24 pb-16 px-4 sm:px-6 flex flex-col items-center justify-center min-h-[60vh]">
          <p className="text-slate-500 mb-4">
            {lang === 'zh' ? '請先登入。' : 'Please sign in first.'}
          </p>
          <Link
            href="/me"
            className="inline-block bg-[#10B8D9] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#0EA5C4]"
          >
            {lang === 'zh' ? '前往登入' : 'Go to Sign In'}
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />
      <main className="pt-24 pb-16 px-4 sm:px-6">
        <div className="w-full max-w-2xl mx-auto space-y-8">
          <div>
            <Link
              href="/me"
              className="text-[12px] text-slate-500 hover:text-[#10B8D9] inline-block mb-3"
            >
              ← {labels.backToMe}
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 mb-1">{labels.pageTitle}</h1>
            <p className="text-slate-500 text-sm">{labels.pageSubtitle}</p>
          </div>

          <section>
            <h2 className="text-sm font-semibold text-slate-800 mb-3">
              {labels.sectionCollected} ({collected.length})
            </h2>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 h-20 animate-pulse" />
                ))}
              </div>
            ) : (
              <CollectionList
                entries={collected}
                mode="collected"
                labels={{
                  remove: labels.remove,
                  removeConfirm: labels.removeConfirm,
                  newBadge: labels.newBadge,
                  empty: labels.emptyCollected,
                }}
                onRemove={handleRemove}
              />
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-800 mb-3">
              {labels.sectionCollectors} ({collectors.length})
            </h2>
            {loading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 h-20 animate-pulse" />
                ))}
              </div>
            ) : (
              <CollectionList
                entries={collectors}
                mode="collectors"
                labels={{
                  remove: labels.remove,
                  removeConfirm: labels.removeConfirm,
                  newBadge: labels.newBadge,
                  empty: labels.emptyCollectors,
                }}
              />
            )}
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-stone-50">
          <div className="animate-spin w-8 h-8 border-3 border-[#10B8D9] border-t-transparent rounded-full" />
        </div>
      }
    >
      <CollectionsPage />
    </Suspense>
  );
}
```

- [ ] **Step 3: Type-check + lint**

```bash
npx tsc --noEmit -p tsconfig.json
npm run lint
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/member/CollectionList.tsx app/me/collections/page.tsx
git commit -m "feat(me): add /me/collections page with my cards and collectors"
```

---

## Task 12: /me entry link + QR button

**Files:**
- Modify: `app/me/page.tsx`

- [ ] **Step 1: Add imports and state**

In `app/me/page.tsx`, near the existing imports, add:

```ts
import dynamic from 'next/dynamic';
const QrShareModal = dynamic(() => import('@/components/member/QrShareModal'), { ssr: false });
```

Inside `MemberDashboard()`, add these state declarations alongside the other `useState` calls:

```ts
  const [collectionsUnread, setCollectionsUnread] = useState(0);
  const [qrOpen, setQrOpen] = useState(false);
```

- [ ] **Step 2: Fetch unread count on mount**

Inside the existing `useEffect(..., [user?.email])` hook, append a new fetch block after the `/api/member/profile` fetch:

```ts
    fetch('/api/member/collections')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setCollectionsUnread(d.unreadCount ?? 0))
      .catch(() => {});
```

- [ ] **Step 3: Render entry link and QR button**

Immediately after the `<UpcomingEvents ... />` element (around line 457), insert:

```tsx
      {/* Card collections entry */}
      {me?.memberNo && (
        <div className="flex items-center gap-2">
          <Link
            href="/me/collections"
            className="flex-1 flex items-center justify-between bg-white rounded-xl border border-slate-200 px-4 py-3 hover:border-slate-300 hover:shadow-sm transition-all group"
          >
            <span className="flex items-center gap-3">
              <span className="text-sm font-semibold text-slate-900 group-hover:text-[#10B8D9] transition-colors">
                {t.collections.entryLabel}
              </span>
              {collectionsUnread > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                  {collectionsUnread}
                </span>
              )}
            </span>
            <span className="text-slate-400 group-hover:text-[#10B8D9]">→</span>
          </Link>
          <button
            type="button"
            onClick={() => setQrOpen(true)}
            className="shrink-0 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 hover:text-[#10B8D9] hover:border-[#10B8D9] transition-colors"
          >
            {t.collections.qrShow}
          </button>
        </div>
      )}
```

- [ ] **Step 4: Render the modal near the bottom of the dashboard**

Right before the closing `</div>` of the outer `<div className="w-full max-w-2xl mx-auto space-y-6">` (just after the `transferToast` block), add:

```tsx
      {me?.memberNo && (
        <QrShareModal
          open={qrOpen}
          onClose={() => setQrOpen(false)}
          memberNo={me.memberNo}
          lang={lang}
          labels={{
            qrTitle: t.collections.qrTitle,
            qrHelper: t.collections.qrHelper,
            qrExpiresIn: t.collections.qrExpiresIn,
            qrExpired: t.collections.qrExpired,
            qrRegenerate: t.collections.qrRegenerate,
          }}
        />
      )}
```

- [ ] **Step 5: Type-check + lint**

```bash
npx tsc --noEmit -p tsconfig.json
npm run lint
```
Expected: no errors.

- [ ] **Step 6: Manual smoke test**

Run `npm run dev`, log in, load `/me`:
1. Confirm "名片收藏" row appears between Upcoming Events and Orders.
2. Click "顯示我的 QR" → modal opens, QR renders, countdown ticks.
3. Close modal → reopens fetching a new token.
4. Save a screenshot to `.screenshots/2026-04-17/me-collections-entry.png`.

- [ ] **Step 7: Commit**

```bash
git add app/me/page.tsx
git commit -m "feat(me): add collections entry with unread badge and QR modal"
```

---

## Task 13: /members/[memberNo] collect button wiring

**Files:**
- Modify: `app/members/[memberNo]/page.tsx`

- [ ] **Step 1: Add imports and token extraction**

At the top of the file, add:

```tsx
import { useSearchParams } from 'next/navigation';
import CollectButton from '@/components/member/CollectButton';
```

Inside `PublicMemberCard()`, add after `const { t, lang } = useTranslation();`:

```ts
  const searchParams = useSearchParams();
  const token = searchParams.get('t');
```

Then update the fetch URL in the existing `useEffect` so the token is forwarded when present:

```ts
  useEffect(() => {
    if (!memberNo) return;
    const url = token
      ? `/api/members/${encodeURIComponent(memberNo)}?t=${encodeURIComponent(token)}`
      : `/api/members/${encodeURIComponent(memberNo)}`;
    fetch(url)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => d && setData(d))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [memberNo, token]);
```

- [ ] **Step 2: Render the CollectButton**

In the returned JSX, inside `<div className="w-full max-w-md mx-auto space-y-6">`, after the existing `{/* Timezone */}` block (around line 127) and before the `{/* CTA: get your own card */}` block, insert:

```tsx
          {/* Collect button */}
          <div className="pt-2">
            <CollectButton
              memberNo={data.member_no}
              token={token}
              lang={lang}
              labels={{
                collect: t.collections.collect,
                collected: t.collections.collected,
                collecting: t.collections.collecting,
                loginToCollect: t.collections.loginToCollect,
                privacyHint: t.collections.privacyHint,
                qrError: t.collections.qrError,
              }}
            />
          </div>
```

- [ ] **Step 3: Type-check + lint**

```bash
npx tsc --noEmit -p tsconfig.json
npm run lint
```
Expected: no errors.

- [ ] **Step 4: Manual smoke tests**

With dev server running:
1. Logged out → visit `/members/<some-public-no>` → button reads "Log in to collect"; clicking navigates to `/me`.
2. Log in → same page → button reads "Collect card"; click → success → label becomes "Collected".
3. Reload → label still "Collected".
4. Visit `/me/collections` → the collected member appears under "My collections".
5. Log in as a *different* user → visit `/members/<private-no>?t=<valid-token>` (get a fresh token by logging in as the private user, hit `/api/member/qr-token`, paste the token into URL) → page renders, Collect works.
6. Wait 6 min, reload with same token → page 404s.
7. Screenshots saved to `.screenshots/2026-04-17/collect-*.png`.

- [ ] **Step 5: Commit**

```bash
git add app/members/[memberNo]/page.tsx
git commit -m "feat(members): wire collect button and QR-token-aware profile fetch"
```

---

## Task 14: Env docs + end-to-end smoke

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Document the new env var**

Append to `.env.example` under an existing auth-related section (search for `AUTH_SECRET` and add below it, or if not present, add a new section near the end):

```
# ============================================
# 名片 QR 收藏
# ============================================
# HS256 secret used to sign the 5-minute QR tokens for private-card exchange
MEMBER_QR_SECRET=change-me-to-a-random-32-byte-hex
```

- [ ] **Step 2: Verify `.env.local` has the secret set**

```bash
grep MEMBER_QR_SECRET .env.local || echo "MEMBER_QR_SECRET=$(openssl rand -hex 32)" >> .env.local
```

Restart `npm run dev` if it was running.

- [ ] **Step 3: End-to-end smoke (covers spec's §Testing list)**

With two browser profiles (A and B), verify the following against `http://localhost:3000`:

| # | Scenario | Expected |
|---|---|---|
| 1 | A collects B-public from `/members/<B>` | Success, "Collected" label |
| 2 | A reloads `/me/collections` | B appears under "My collections" |
| 3 | B reloads `/me` | Unread badge shows `1` |
| 4 | B visits `/me/collections` | A appears under "Collected me" with blue border |
| 5 | B reloads `/me` | Unread badge gone |
| 6 | B opens QR modal, A scans (or pastes URL) within 5 min | A sees B-private profile, Collect works |
| 7 | A waits 6 min then tries same URL | 404 |
| 8 | A tampers token query string | 404 |
| 9 | A tries to collect themselves via curl | 400 |
| 10 | A removes B from their collections | Row disappears, B's "Collected me" list also no longer includes A |

Save a gif/screenshots of the happy path to `.screenshots/2026-04-17/collect-e2e.*`.

- [ ] **Step 4: Final commit**

```bash
git add .env.example
git commit -m "chore(env): document MEMBER_QR_SECRET"
```

---

## Self-Review (completed)

1. **Spec coverage:** All spec sections have at least one task:
   - Data model → Task 1
   - QR token mechanism → Task 2 (lib) + Task 3 (route)
   - API endpoints → Tasks 3–7
   - UI (`/me`) → Task 12
   - UI (`/me/collections`) → Task 11
   - UI (`/members/[memberNo]`) → Task 13
   - i18n → Task 8
   - Privacy / rate-limit → Task 4 (rate-limit) + Task 10 (privacy hint) + Task 2 (RLS in Task 1)
   - Env var → Task 14
   - Manual testing checklist → Task 14

2. **Placeholder scan:** No TBDs, every code block is complete, all file paths and commands are concrete.

3. **Type consistency:** `CollectionEntry` defined in Task 2 and used consistently in Tasks 4, 11. `QrTokenPayload` defined in Task 2 and used in Tasks 3 and 7. Label prop shapes match between caller (Tasks 12, 13) and component (Tasks 9, 10).

---
