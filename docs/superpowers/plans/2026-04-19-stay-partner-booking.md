# /stay Partner Stay Booking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立單一合作住宿 `/stay` 功能，支援整週訂房、整數 TWD 報價、信用卡擔保、招待碼免費住宿、三天前截止、候補、轉讓與後台管理。

**Architecture:** 住宿功能使用獨立的 Supabase schema 與 `lib/stay*` service layer，不沿用 `orders`。前台 `/stay`、會員 `/me` 摘要、轉讓接受頁與 `/admin/stay` 都透過 dedicated App Router APIs 讀寫同一組 stay 狀態機；Stripe 僅用於 SetupIntent + 後續 off-session charge，不做長時間 manual capture。

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Supabase service role, Stripe Node SDK + Stripe Elements (`@stripe/react-stripe-js`, `@stripe/stripe-js`), Tailwind 4, Playwright.

**Testing note:** Repo 已有 Playwright runner。此計畫以 `npm run lint`、`npm run build`、targeted Playwright smoke tests，以及少量手動 Stripe 測試取代新增單元測試框架。

**Reference spec:** `docs/superpowers/specs/2026-04-19-stay-partner-booking-design.md`

---

## File Structure

**Create:**
- `supabase/migrations/20260419_create_stay_booking_tables.sql`
- `lib/stayTypes.ts`
- `lib/stayTime.ts`
- `lib/stayPricing.ts`
- `lib/stayQueries.ts`
- `lib/stayBooking.ts`
- `lib/stayTransfer.ts`
- `lib/stayWaitlist.ts`
- `lib/stayReconcile.ts`
- `lib/stayEmail.ts`
- `lib/stayStripe.ts`
- `app/stay/page.tsx`
- `components/stay/StayPageContent.tsx`
- `components/stay/StayHero.tsx`
- `components/stay/StayInventoryGrid.tsx`
- `components/stay/StayPolicyNotice.tsx`
- `components/stay/StayBookingPanel.tsx`
- `components/stay/StayGuaranteeStep.tsx`
- `components/stay/StayManagementPanel.tsx`
- `components/member/StaySummaryCard.tsx`
- `app/stay/transfer/[id]/page.tsx`
- `app/api/stay/weeks/route.ts`
- `app/api/stay/quote/route.ts`
- `app/api/stay/setup-intent/route.ts`
- `app/api/stay/invite-code/validate/route.ts`
- `app/api/stay/bookings/route.ts`
- `app/api/stay/bookings/[id]/route.ts`
- `app/api/stay/bookings/[id]/modify/route.ts`
- `app/api/stay/bookings/[id]/transfer/route.ts`
- `app/api/stay/transfers/[id]/accept/route.ts`
- `app/api/stay/waitlist/route.ts`
- `app/api/stay/waitlist/[id]/route.ts`
- `app/api/cron/stay-reconcile/route.ts`
- `app/admin/stay/page.tsx`
- `app/admin/stay/bookings/page.tsx`
- `app/admin/stay/bookings/[id]/page.tsx`
- `app/admin/stay/weeks/page.tsx`
- `app/admin/stay/invite-codes/page.tsx`
- `app/api/admin/stay/summary/route.ts`
- `app/api/admin/stay/bookings/route.ts`
- `app/api/admin/stay/bookings/[id]/route.ts`
- `app/api/admin/stay/invite-codes/batch/route.ts`
- `app/api/admin/stay/weeks/[id]/route.ts`
- `app/api/admin/stay/transfers/[id]/resend/route.ts`
- `app/api/admin/stay/waitlist/[id]/offer/route.ts`
- `app/api/admin/stay/bookings/[id]/no-show/route.ts`
- `app/api/admin/stay/bookings/[id]/comp/route.ts`
- `tests/e2e/stay.spec.ts`

**Modify:**
- `package.json`
- `.env.example`
- `data/content.ts`
- `app/me/page.tsx`
- `app/admin/layout.tsx`

**Keep as-is but reuse:**
- `lib/taipeiTime.ts` — 只保留既有 helper；住宿截止時間另做 `lib/stayTime.ts`
- `lib/email.ts` / `lib/emailLog.ts` — stay email 沿用同一組 Mailgun / email log 基礎設施

---

## Task 1: 建立住宿 schema、價格與時間 helper

**Files:**
- Create: `supabase/migrations/20260419_create_stay_booking_tables.sql`
- Create: `lib/stayTypes.ts`
- Create: `lib/stayTime.ts`
- Create: `lib/stayPricing.ts`

- [ ] **Step 1: 寫 migration，建立 stay domain tables**

```sql
CREATE TABLE stay_weeks (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  price_twd INTEGER NOT NULL,
  room_capacity INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'sold_out', 'closed')),
  waitlist_offer_expires_in_minutes INTEGER NOT NULL DEFAULT 120,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE stay_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'confirmed', 'partially_transferred', 'transferred', 'cancelled', 'completed')),
  booking_type TEXT NOT NULL CHECK (booking_type IN ('guaranteed', 'complimentary')),
  primary_guest_name TEXT NOT NULL,
  primary_guest_email TEXT NOT NULL,
  primary_guest_phone TEXT NOT NULL,
  guest_count INTEGER NOT NULL CHECK (guest_count IN (1, 2)),
  second_guest_name TEXT,
  internal_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE stay_booking_weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES stay_bookings(id) ON DELETE CASCADE,
  member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  week_id BIGINT NOT NULL REFERENCES stay_weeks(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('confirmed', 'modified_out', 'modified_in', 'pending_transfer', 'transferred', 'cancelled', 'no_show', 'completed')),
  booked_price_twd INTEGER NOT NULL,
  hold_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (booking_id, week_id)
);

CREATE UNIQUE INDEX stay_booking_weeks_one_room_per_member_per_week
  ON stay_booking_weeks(member_id, week_id)
  WHERE status IN ('confirmed', 'modified_in', 'pending_transfer');

CREATE TABLE stay_guarantees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES stay_bookings(id) ON DELETE CASCADE,
  guarantee_type TEXT NOT NULL CHECK (guarantee_type IN ('stripe_card', 'complimentary')),
  stripe_customer_id TEXT,
  stripe_setup_intent_id TEXT,
  stripe_payment_method_id TEXT,
  card_brand TEXT,
  card_last4 TEXT,
  consented_at TIMESTAMPTZ,
  replaced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE stay_invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('active', 'reserved', 'used', 'disabled')),
  used_by_member_id BIGINT REFERENCES members(id) ON DELETE SET NULL,
  used_by_booking_id UUID REFERENCES stay_bookings(id) ON DELETE SET NULL,
  batch_label TEXT,
  notes TEXT,
  created_by TEXT,
  reserved_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE stay_waitlist_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id BIGINT NOT NULL REFERENCES stay_weeks(id) ON DELETE CASCADE,
  member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('active', 'offered', 'accepted', 'expired', 'declined', 'removed')),
  position INTEGER NOT NULL,
  offered_at TIMESTAMPTZ,
  offer_expires_at TIMESTAMPTZ,
  accepted_booking_week_id UUID REFERENCES stay_booking_weeks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (week_id, member_id)
);

CREATE TABLE stay_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_week_id UUID NOT NULL REFERENCES stay_booking_weeks(id) ON DELETE CASCADE,
  from_member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  to_member_id BIGINT REFERENCES members(id) ON DELETE RESTRICT,
  to_email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending_acceptance', 'accepted', 'expired', 'revoked')),
  booking_type TEXT NOT NULL CHECK (booking_type IN ('guaranteed', 'complimentary')),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE stay_charge_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_week_id UUID NOT NULL REFERENCES stay_booking_weeks(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('cancellation', 'no_show')),
  amount_twd INTEGER NOT NULL,
  stripe_payment_intent_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed')),
  created_by TEXT NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO stay_weeks (code, starts_on, ends_on, price_twd, room_capacity, status)
VALUES
  ('2026-w1', DATE '2026-04-30', DATE '2026-05-07', 6125, 30, 'active'),
  ('2026-w2', DATE '2026-05-07', DATE '2026-05-14', 4904, 40, 'active'),
  ('2026-w3', DATE '2026-05-14', DATE '2026-05-21', 5026, 40, 'active'),
  ('2026-w4', DATE '2026-05-21', DATE '2026-05-28', 5120, 40, 'active')
ON CONFLICT (code) DO NOTHING;
```

- [ ] **Step 2: 建立共用型別與價格 / 截止 helper**

`lib/stayTypes.ts`
```ts
export type StayBookingType = 'guaranteed' | 'complimentary';
export type StayBookingStatus = 'draft' | 'confirmed' | 'partially_transferred' | 'transferred' | 'cancelled' | 'completed';
export type StayBookingWeekStatus =
  | 'confirmed'
  | 'modified_out'
  | 'modified_in'
  | 'pending_transfer'
  | 'transferred'
  | 'cancelled'
  | 'no_show'
  | 'completed';

export interface StayWeekRow {
  id: number;
  code: string;
  starts_on: string;
  ends_on: string;
  price_twd: number;
  room_capacity: number;
  status: 'active' | 'sold_out' | 'closed';
  waitlist_offer_expires_in_minutes: number;
}
```

`lib/stayPricing.ts`
```ts
export const STAY_PRICE_REFERENCE = {
  '2026-w1': { quoted: 6124.8, rounded: 6125, usdApprox: 194.77 },
  '2026-w2': { quoted: 4904.0, rounded: 4904, usdApprox: 155.95 },
  '2026-w3': { quoted: 5025.6, rounded: 5026, usdApprox: 159.82 },
  '2026-w4': { quoted: 5120.0, rounded: 5120, usdApprox: 162.82 },
} as const;

export function roundStayPriceTwd(value: number): number {
  return Math.ceil(value);
}
```

`lib/stayTime.ts`
```ts
export function getStayBookingDeadlineAt(startsOn: string): Date {
  const [y, m, d] = startsOn.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - 3, 15, 59, 59, 999));
}

export function isStayBookable(startsOn: string, now = new Date()): boolean {
  return now.getTime() <= getStayBookingDeadlineAt(startsOn).getTime();
}
```

- [ ] **Step 3: 套用 migration 並驗證 schema**

Run:
```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/20260419_create_stay_booking_tables.sql
psql "$SUPABASE_DB_URL" -c "select code, price_twd, room_capacity from stay_weeks order by starts_on"
```
Expected:
- `stay_weeks` / `stay_bookings` / `stay_booking_weeks` / `stay_guarantees` / `stay_invite_codes` / `stay_waitlist_entries` / `stay_transfers` / `stay_charge_attempts` 全部建立成功
- `stay_weeks` 回傳 4 筆 seeded rows，價格分別為 `6125`, `4904`, `5026`, `5120`

- [ ] **Step 4: 跑靜態檢查**

Run:
```bash
npx tsc --noEmit
npm run lint lib/stayTypes.ts lib/stayTime.ts lib/stayPricing.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260419_create_stay_booking_tables.sql lib/stayTypes.ts lib/stayTime.ts lib/stayPricing.ts
git commit -m "feat(stay): add stay schema and shared helpers"
```

---

## Task 2: 建立 `/stay` 公開頁與庫存讀取 API

**Files:**
- Create: `app/stay/page.tsx`
- Create: `components/stay/StayPageContent.tsx`
- Create: `components/stay/StayHero.tsx`
- Create: `components/stay/StayInventoryGrid.tsx`
- Create: `components/stay/StayPolicyNotice.tsx`
- Create: `components/stay/StayBookingPanel.tsx`
- Create: `app/api/stay/weeks/route.ts`
- Modify: `data/content.ts`

- [ ] **Step 1: 在 `data/content.ts` 新增 `stay` 文案區塊**

```ts
stay: {
  title: 'Partner Stay',
  subtitle: 'Book Norden Ruder at the partner rate for TDF 2026.',
  badges: {
    memberOnly: 'Members only',
    weeklyOnly: 'Weekly booking only',
    singleProperty: 'Single partner stay',
  },
  policyTitle: 'Important booking rule',
  policyBody: 'Any cancellation or no-show will be charged for the full booked week.',
  cutoffNote: 'Booking closes at 23:59 (Taiwan time), 3 calendar days before check-in.',
  complimentaryNote: 'Invitation code bookings are complimentary and do not require card binding.',
  usdApproxNote: 'USD is approximate only. Final settlement follows bank FX rates.',
  ctaBook: 'Book stay',
  ctaWaitlist: 'Join waitlist',
  ctaManage: 'Manage stay',
}
```

- [ ] **Step 2: 建立週次讀取 API，直接回傳 rounded price 與 cutoff 狀態**

`app/api/stay/weeks/route.ts`
```ts
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { getStayBookingDeadlineAt, isStayBookable } from '@/lib/stayTime';

export async function GET() {
  if (!supabaseServer) return NextResponse.json({ error: 'db' }, { status: 500 });

  const { data, error } = await supabaseServer
    .from('stay_weeks')
    .select('*')
    .order('starts_on', { ascending: true });

  if (error) return NextResponse.json({ error: 'weeks_failed' }, { status: 500 });

  const weeks = (data ?? []).map((week) => ({
    ...week,
    booking_deadline_at: getStayBookingDeadlineAt(week.starts_on).toISOString(),
    booking_open: week.status === 'active' && isStayBookable(week.starts_on),
  }));

  return NextResponse.json({ weeks });
}
```

- [ ] **Step 3: 建立 `/stay` 頁面骨架與 light-only section**

`app/stay/page.tsx`
```tsx
import { Suspense } from 'react';
import StayPageContent from '@/components/stay/StayPageContent';

export const metadata = {
  title: 'Partner Stay | Taiwan Digital Fest 2026',
  description: 'Book the Norden Ruder partner stay for TDF 2026.',
};

export default function StayPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-stone-50" />}>
      <StayPageContent />
    </Suspense>
  );
}
```

`components/stay/StayPageContent.tsx`
```tsx
'use client';

import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/contexts/AuthContext';
import StayHero from './StayHero';
import StayInventoryGrid from './StayInventoryGrid';
import StayPolicyNotice from './StayPolicyNotice';
import StayBookingPanel from './StayBookingPanel';

export default function StayPageContent() {
  const { t, lang } = useTranslation();
  const { user } = useAuth();
  const [weeks, setWeeks] = useState([]);

  useEffect(() => {
    fetch('/api/stay/weeks').then((r) => r.json()).then((d) => setWeeks(d.weeks ?? []));
  }, []);

  return (
    <div className="min-h-screen bg-stone-50 text-slate-900">
      <Navbar />
      <main className="pt-24 pb-16 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.9fr)]">
          <section className="space-y-6">
            <StayHero stay={t.stay} lang={lang} />
            <StayPolicyNotice stay={t.stay} />
            <StayInventoryGrid weeks={weeks} stay={t.stay} />
          </section>
          <aside className="lg:sticky lg:top-24 h-fit">
            <StayBookingPanel weeks={weeks} memberEmail={user?.email ?? null} />
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}
```

`components/stay/StayHero.tsx`
```tsx
export default function StayHero({ stay }: { stay: any }) {
  return (
    <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">Norden Ruder x TDF</p>
      <h1 className="mt-3 text-4xl font-bold text-slate-900">{stay.title}</h1>
      <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">{stay.subtitle}</p>
    </section>
  );
}
```

`components/stay/StayPolicyNotice.tsx`
```tsx
export default function StayPolicyNotice({ stay }: { stay: any }) {
  return (
    <section className="rounded-[24px] border border-rose-200 bg-rose-50 p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-rose-800">{stay.policyTitle}</h2>
      <p className="mt-2 text-sm leading-6 text-rose-700">{stay.policyBody}</p>
      <p className="mt-2 text-xs font-medium text-rose-600">{stay.cutoffNote}</p>
    </section>
  );
}
```

`components/stay/StayInventoryGrid.tsx`
```tsx
export default function StayInventoryGrid({ weeks, stay }: { weeks: any[]; stay: any }) {
  return (
    <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Weekly inventory</h2>
      <div className="mt-4 grid gap-3">
        {weeks.map((week) => (
          <article key={week.code} className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-medium text-slate-900">{week.starts_on} – {week.ends_on}</div>
                <div className="text-sm text-slate-500">Capacity {week.room_capacity}</div>
              </div>
              <div className="text-right">
                <div className="text-xl font-semibold text-slate-900">NT${week.price_twd.toLocaleString()}</div>
                <div className="text-xs text-slate-500">{stay.usdApproxNote}</div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
```

`components/stay/StayBookingPanel.tsx`
```tsx
'use client';

export default function StayBookingPanel({ weeks, memberEmail }: { weeks: any[]; memberEmail: string | null }) {
  if (!memberEmail) {
    return (
      <div className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Sign in to book</h2>
        <p className="mt-2 text-sm text-slate-500">Only members can reserve the partner stay.</p>
      </div>
    );
  }

  return (
    <div className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Reserve your stay</h2>
      <p className="mt-2 text-sm text-slate-500">{weeks.length} weeks available for selection.</p>
    </div>
  );
}
```

- [ ] **Step 4: Lint 與瀏覽器 smoke check**

Run:
```bash
npm run lint app/stay/page.tsx components/stay app/api/stay/weeks/route.ts data/content.ts
npm run dev
```
Manual check:
- 開 `http://localhost:3000/stay?lang=zh`
- 首屏看到警示文案
- 4 個週次顯示 `NT$6,125 / 4,904 / 5,026 / 5,120`
- 整頁沒有任何 dark mode 區塊

- [ ] **Step 5: Commit**

```bash
git add app/stay/page.tsx components/stay/StayPageContent.tsx components/stay/StayHero.tsx components/stay/StayInventoryGrid.tsx components/stay/StayPolicyNotice.tsx components/stay/StayBookingPanel.tsx app/api/stay/weeks/route.ts data/content.ts
git commit -m "feat(stay): add public stay landing page"
```

---

## Task 3: 接上 Stripe SetupIntent、招待碼驗證與建立 booking

**Files:**
- Create: `lib/stayQueries.ts`
- Create: `lib/stayStripe.ts`
- Create: `lib/stayBooking.ts`
- Create: `components/stay/StayGuaranteeStep.tsx`
- Create: `app/api/stay/quote/route.ts`
- Create: `app/api/stay/setup-intent/route.ts`
- Create: `app/api/stay/invite-code/validate/route.ts`
- Create: `app/api/stay/bookings/route.ts`
- Modify: `components/stay/StayBookingPanel.tsx`
- Modify: `package.json`
- Modify: `.env.example`

- [ ] **Step 1: 補前端 Stripe 套件與 env example**

`package.json`
```json
{
  "dependencies": {
    "@stripe/react-stripe-js": "^3.7.0",
    "@stripe/stripe-js": "^4.8.0"
  }
}
```

`.env.example`
```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxx
CRON_SECRET=replace_with_a_shared_cron_secret
```

Run:
```bash
npm install
```
Expected: `package-lock.json` updated, install succeeds.

- [ ] **Step 2: 建立 booking service 與 SetupIntent route**

`lib/stayStripe.ts`
```ts
import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

export const stayStripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: '2025-12-15.clover' })
  : null;

export async function findOrCreateStayCustomer(customerEmail: string) {
  if (!stayStripe) throw new Error('stripe_not_configured');
  const existing = await stayStripe.customers.list({ email: customerEmail, limit: 1 });
  if (existing.data[0]) return existing.data[0];
  return stayStripe.customers.create({ email: customerEmail });
}

export async function createStaySetupIntent(customerEmail: string) {
  if (!stayStripe) throw new Error('stripe_not_configured');
  const customer = await findOrCreateStayCustomer(customerEmail);
  const setupIntent = await stayStripe.setupIntents.create({
    customer: customer.id,
    usage: 'off_session',
    payment_method_types: ['card'],
  });

  return { customer, setupIntent };
}

export async function chargeStayNoShow(input: {
  customerId: string;
  paymentMethodId: string;
  amountTwd: number;
  statementDescriptorSuffix: string;
}) {
  if (!stayStripe) throw new Error('stripe_not_configured');

  return stayStripe.paymentIntents.create({
    amount: input.amountTwd * 100,
    currency: 'twd',
    customer: input.customerId,
    payment_method: input.paymentMethodId,
    off_session: true,
    confirm: true,
    statement_descriptor_suffix: input.statementDescriptorSuffix,
  });
}
```

`app/api/stay/setup-intent/route.ts`
```ts
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { createStaySetupIntent } from '@/lib/stayStripe';

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { customer, setupIntent } = await createStaySetupIntent(session.email);
  return NextResponse.json({
    customerId: customer.id,
    setupIntentId: setupIntent.id,
    clientSecret: setupIntent.client_secret,
  });
}
```

`lib/stayQueries.ts`
```ts
import { supabaseServer } from '@/lib/supabaseServer';

export async function getStayWeekByCode(code: string) {
  const { data, error } = await supabaseServer.from('stay_weeks').select('*').eq('code', code).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getStayWeeksByCodes(codes: string[]) {
  const { data, error } = await supabaseServer.from('stay_weeks').select('*').in('code', codes).order('starts_on', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getWeekOccupancy(weekId: number) {
  const { count, error } = await supabaseServer
    .from('stay_booking_weeks')
    .select('*', { count: 'exact', head: true })
    .eq('week_id', weekId)
    .in('status', ['confirmed', 'modified_in', 'pending_transfer']);
  if (error) throw error;
  return count ?? 0;
}

export async function getPendingWaitlistHoldCount(weekId: number) {
  const now = new Date().toISOString();
  const { count, error } = await supabaseServer
    .from('stay_waitlist_entries')
    .select('*', { count: 'exact', head: true })
    .eq('week_id', weekId)
    .eq('status', 'offered')
    .gt('offer_expires_at', now);
  if (error) throw error;
  return count ?? 0;
}

export async function getNextWaitlistPosition(weekId: number) {
  const { data, error } = await supabaseServer
    .from('stay_waitlist_entries')
    .select('position')
    .eq('week_id', weekId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.position ?? 0) + 1;
}

export async function getStayBookingForEmail(bookingId: string, email: string) {
  const { data, error } = await supabaseServer
    .from('stay_bookings')
    .select('*, stay_booking_weeks(*, stay_weeks(*)), stay_guarantees(*)')
    .eq('id', bookingId)
    .eq('primary_guest_email', email)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getPendingTransferForRecipient(transferId: string, recipientEmail: string) {
  const { data, error } = await supabaseServer
    .from('stay_transfers')
    .select('*')
    .eq('id', transferId)
    .eq('to_email', recipientEmail)
    .eq('status', 'pending_acceptance')
    .maybeSingle();
  if (error) throw error;
  return data;
}
```

- [ ] **Step 3: 建立 invite code 驗證與 booking 建立 route**

`app/api/stay/invite-code/validate/route.ts`
```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { getSessionFromRequest } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'db' }, { status: 500 });

  const { code } = await req.json();
  const { data } = await supabaseServer
    .from('stay_invite_codes')
    .select('id, status')
    .eq('code', String(code).trim())
    .eq('status', 'active')
    .maybeSingle();

  if (!data) return NextResponse.json({ valid: false }, { status: 404 });
  return NextResponse.json({ valid: true, inviteId: data.id });
}
```

`lib/stayBooking.ts`
```ts
export interface CreateStayBookingInput {
  memberId: number;
  memberEmail: string;
  primaryGuestName: string;
  primaryGuestPhone: string;
  guestCount: 1 | 2;
  secondGuestName?: string | null;
  weekCodes: string[];
  inviteCode?: string | null;
  setupIntentId?: string | null;
}

export async function createStayBooking(input: CreateStayBookingInput) {
  if (!supabaseServer) throw new Error('db_not_configured');

  const weeks = await getStayWeeksByCodes(input.weekCodes);
  if (weeks.length !== input.weekCodes.length) throw new Error('week_not_found');

  for (const week of weeks) {
    if (week.status !== 'active' || !isStayBookable(week.starts_on)) throw new Error('booking_closed');
    const [occupancy, holds] = await Promise.all([
      getWeekOccupancy(week.id),
      getPendingWaitlistHoldCount(week.id),
    ]);
    if (occupancy + holds >= week.room_capacity) throw new Error('week_sold_out');
  }

  const bookingType: StayBookingType = input.inviteCode ? 'complimentary' : 'guaranteed';
  const { data: booking, error: bookingErr } = await supabaseServer
    .from('stay_bookings')
    .insert({
      member_id: input.memberId,
      status: 'confirmed',
      booking_type: bookingType,
      primary_guest_name: input.primaryGuestName,
      primary_guest_email: input.memberEmail,
      primary_guest_phone: input.primaryGuestPhone,
      guest_count: input.guestCount,
      second_guest_name: input.secondGuestName ?? null,
    })
    .select('*')
    .single();
  if (bookingErr || !booking) throw bookingErr ?? new Error('booking_insert_failed');

  const { error: weekErr } = await supabaseServer.from('stay_booking_weeks').insert(
    weeks.map((week) => ({
      booking_id: booking.id,
      member_id: input.memberId,
      week_id: week.id,
      status: 'confirmed',
      booked_price_twd: week.price_twd,
    })),
  );
  if (weekErr) throw weekErr;

  if (bookingType === 'complimentary') {
    const { data: codeRow } = await supabaseServer
      .from('stay_invite_codes')
      .select('id')
      .eq('code', input.inviteCode!)
      .eq('status', 'active')
      .maybeSingle();
    if (!codeRow) throw new Error('invite_code_invalid');

    await supabaseServer.from('stay_invite_codes').update({
      status: 'used',
      used_by_member_id: input.memberId,
      used_by_booking_id: booking.id,
      used_at: new Date().toISOString(),
    }).eq('id', codeRow.id);

    await supabaseServer.from('stay_guarantees').insert({
      booking_id: booking.id,
      guarantee_type: 'complimentary',
    });
    return booking;
  }

  const setupIntent = await stayStripe!.setupIntents.retrieve(input.setupIntentId!, {
    expand: ['payment_method'],
  });
  if (setupIntent.status !== 'succeeded' || typeof setupIntent.payment_method === 'string' || !setupIntent.customer) {
    throw new Error('setup_intent_not_ready');
  }

  await supabaseServer.from('stay_guarantees').insert({
    booking_id: booking.id,
    guarantee_type: 'stripe_card',
    stripe_customer_id: String(setupIntent.customer),
    stripe_setup_intent_id: setupIntent.id,
    stripe_payment_method_id: setupIntent.payment_method.id,
    card_brand: setupIntent.payment_method.card?.brand ?? null,
    card_last4: setupIntent.payment_method.card?.last4 ?? null,
    consented_at: new Date().toISOString(),
  });

  return booking;
}
```

`app/api/stay/bookings/route.ts`
```ts
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { resolveMember } from '@/lib/adminMembers';
import { createStayBooking } from '@/lib/stayBooking';

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const member = await resolveMember(encodeURIComponent(session.email));
  if (!member) return NextResponse.json({ error: 'member_not_found' }, { status: 404 });

  const body = await req.json();
  const booking = await createStayBooking({
    memberId: member.id,
    memberEmail: session.email,
    primaryGuestName: body.primaryGuestName,
    primaryGuestPhone: body.primaryGuestPhone,
    guestCount: body.guestCount,
    secondGuestName: body.secondGuestName ?? null,
    weekCodes: body.weekCodes,
    inviteCode: body.inviteCode ?? null,
    setupIntentId: body.setupIntentId ?? null,
  });

  return NextResponse.json({ booking });
}
```

- [ ] **Step 4: 在 `StayBookingPanel` 接上 guarantee step**

`components/stay/StayGuaranteeStep.tsx`
```tsx
'use client';

import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export function StayGuaranteeStep({ clientSecret, onConfirmed }: { clientSecret: string; onConfirmed: (setupIntentId: string) => void }) {
  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <StayGuaranteeForm onConfirmed={onConfirmed} />
    </Elements>
  );
}

function StayGuaranteeForm({ onConfirmed }: { onConfirmed: (setupIntentId: string) => void }) {
  const stripe = useStripe();
  const elements = useElements();

  async function submit() {
    if (!stripe || !elements) return;
    const result = await stripe.confirmSetup({ elements, redirect: 'if_required' });
    if (result.setupIntent?.id) onConfirmed(result.setupIntent.id);
  }

  return (
    <div className="space-y-4">
      <PaymentElement />
      <button type="button" onClick={submit} className="w-full rounded-xl bg-cyan-500 px-4 py-3 text-white">
        Verify card
      </button>
    </div>
  );
}
```

`components/stay/StayBookingPanel.tsx`
```tsx
const [clientSecret, setClientSecret] = useState<string | null>(null);
const [setupIntentId, setSetupIntentId] = useState<string | null>(null);

async function beginGuarantee() {
  const res = await fetch('/api/stay/setup-intent', { method: 'POST' });
  const data = await res.json();
  setClientSecret(data.clientSecret);
}

async function submitBooking() {
  const res = await fetch('/api/stay/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weekCodes, primaryGuestName, primaryGuestPhone, guestCount, secondGuestName, inviteCode, setupIntentId }),
  });
}
```

- [ ] **Step 5: 驗證 booking happy path**

Run:
```bash
npm run lint package.json app/api/stay lib/stayStripe.ts lib/stayBooking.ts components/stay/StayGuaranteeStep.tsx components/stay/StayBookingPanel.tsx
npm run build
```
Manual check:
- 用測試會員登入 `/stay`
- 一般訂房可進到 card setup
- 招待碼訂房可直接跳過 card setup
- 建立後資料表有 `stay_bookings`、`stay_booking_weeks`、`stay_guarantees`

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .env.example lib/stayQueries.ts lib/stayStripe.ts lib/stayBooking.ts components/stay/StayGuaranteeStep.tsx components/stay/StayBookingPanel.tsx app/api/stay/quote/route.ts app/api/stay/setup-intent/route.ts app/api/stay/invite-code/validate/route.ts app/api/stay/bookings/route.ts
git commit -m "feat(stay): add booking creation and stripe guarantee flow"
```

---

## Task 4: 會員端住宿摘要、明細、改期與發起轉讓

**Files:**
- Create: `components/member/StaySummaryCard.tsx`
- Create: `components/stay/StayManagementPanel.tsx`
- Create: `app/api/stay/bookings/[id]/route.ts`
- Create: `app/api/stay/bookings/[id]/modify/route.ts`
- Create: `app/api/stay/bookings/[id]/transfer/route.ts`
- Modify: `lib/stayBooking.ts`
- Create: `lib/stayTransfer.ts`
- Modify: `app/me/page.tsx`
- Modify: `app/stay/page.tsx`
- Modify: `app/api/stay/bookings/route.ts`

- [ ] **Step 1: 在 `app/api/stay/bookings/route.ts` 加上 GET，回傳我的住宿摘要**

```ts
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const member = await resolveMember(encodeURIComponent(session.email));
  if (!member) return NextResponse.json({ bookings: [], waitlist: [], transfers: [] });

  const summary = await getMemberStaySummary(member.id, session.email);
  return NextResponse.json(summary);
}
```

`lib/stayQueries.ts`
```ts
export async function getMemberStaySummary(memberId: number, email: string) {
  const [{ data: bookings }, { data: waitlist }, { data: transfers }] = await Promise.all([
    supabaseServer.from('stay_bookings').select('*, stay_booking_weeks(*, stay_weeks(*))').eq('member_id', memberId).order('created_at', { ascending: false }),
    supabaseServer.from('stay_waitlist_entries').select('*, stay_weeks(*)').eq('member_id', memberId).in('status', ['active', 'offered']),
    supabaseServer.from('stay_transfers').select('*').ilike('to_email', email).eq('status', 'pending_acceptance'),
  ]);
  return { bookings: bookings ?? [], waitlist: waitlist ?? [], transfers: transfers ?? [] };
}
```

- [ ] **Step 2: 在 `/me` 加入 Stay 摘要卡**

`components/member/StaySummaryCard.tsx`
```tsx
'use client';

import Link from 'next/link';

export default function StaySummaryCard({ summary }: { summary: { bookings: any[]; waitlist: any[]; transfers: any[] } }) {
  const active = summary.bookings.find((b) => ['confirmed', 'partially_transferred'].includes(b.status));
  return (
    <section className="rounded-2xl bg-white shadow-sm p-5 border border-slate-200">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Partner Stay</h2>
          <p className="text-sm text-slate-500">Norden Ruder weekly booking</p>
        </div>
        <Link href="/stay" className="text-sm font-medium text-cyan-600 hover:underline">
          {summary.transfers.length ? 'Accept transfer' : active ? 'Manage stay' : 'Book stay'}
        </Link>
      </div>
    </section>
  );
}
```

`app/me/page.tsx`
```tsx
const [staySummary, setStaySummary] = useState<{ bookings: any[]; waitlist: any[]; transfers: any[] } | null>(null);

useEffect(() => {
  if (!user?.email) return;
  fetch('/api/stay/bookings')
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => setStaySummary(d))
    .catch(() => setStaySummary(null));
}, [user?.email]);
```

把 `<StaySummaryCard summary={staySummary} />` 放在 `UpcomingEvents` 與訂單區塊之間。

- [ ] **Step 3: 實作 booking detail、modify、transfer initiate**

`app/api/stay/bookings/[id]/route.ts`
```ts
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const booking = await getStayBookingForEmail(id, session.email);
  if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ booking });
}
```

`app/api/stay/bookings/[id]/modify/route.ts`
```ts
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  const { bookingWeekId, targetWeekCode } = await req.json();
  const result = await modifyStayWeek({ bookingId: id, bookingWeekId, targetWeekCode, ownerEmail: session.email });
  return NextResponse.json({ booking: result });
}
```

`lib/stayBooking.ts`
```ts
export async function modifyStayWeek(input: {
  bookingId: string;
  bookingWeekId: string;
  targetWeekCode: string;
  ownerEmail: string;
}) {
  const booking = await getStayBookingForEmail(input.bookingId, input.ownerEmail);
  if (!booking) throw new Error('booking_not_found');

  const targetWeek = await getStayWeekByCode(input.targetWeekCode);
  if (!targetWeek || !isStayBookable(targetWeek.starts_on)) throw new Error('target_week_closed');

  const occupancy = await getWeekOccupancy(targetWeek.id);
  if (occupancy >= targetWeek.room_capacity) throw new Error('target_week_full');

  const { error: outErr } = await supabaseServer
    .from('stay_booking_weeks')
    .update({ status: 'modified_out', updated_at: new Date().toISOString() })
    .eq('id', input.bookingWeekId)
    .eq('booking_id', input.bookingId);
  if (outErr) throw outErr;

  const { error: inErr } = await supabaseServer
    .from('stay_booking_weeks')
    .insert({
      booking_id: input.bookingId,
      member_id: booking.member_id,
      week_id: targetWeek.id,
      status: 'modified_in',
      booked_price_twd: targetWeek.price_twd,
    });
  if (inErr) throw inErr;

  return getStayBookingForEmail(input.bookingId, input.ownerEmail);
}
```

`app/api/stay/bookings/[id]/transfer/route.ts`
```ts
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  const { bookingWeekId, toEmail } = await req.json();
  const transfer = await createStayTransfer({ bookingId: id, bookingWeekId, fromEmail: session.email, toEmail });
  return NextResponse.json({ transfer });
}
```

`lib/stayTransfer.ts`
```ts
export async function createStayTransfer(input: {
  bookingId: string;
  bookingWeekId: string;
  fromEmail: string;
  toEmail: string;
}) {
  const booking = await getStayBookingForEmail(input.bookingId, input.fromEmail);
  if (!booking) throw new Error('booking_not_found');

  const bookingWeek = booking.stay_booking_weeks.find((week: any) => week.id === input.bookingWeekId);
  if (!bookingWeek) throw new Error('booking_week_not_found');

  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseServer
    .from('stay_transfers')
    .insert({
      booking_week_id: bookingWeek.id,
      from_member_id: booking.member_id,
      to_email: input.toEmail,
      status: 'pending_acceptance',
      booking_type: booking.booking_type,
      expires_at: expiresAt,
    })
    .select('*')
    .single();
  if (error) throw error;

  await supabaseServer
    .from('stay_booking_weeks')
    .update({ status: 'pending_transfer', hold_expires_at: expiresAt })
    .eq('id', bookingWeek.id);

  return data;
}
```

- [ ] **Step 4: 將 `/stay` 右欄切到管理模式**

`components/stay/StayManagementPanel.tsx`
```tsx
export default function StayManagementPanel({ booking }: { booking: any }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Manage your stay</h2>
      <ul className="mt-4 space-y-3">
        {booking.stay_booking_weeks.map((week: any) => (
          <li key={week.id} className="rounded-xl bg-stone-50 p-3">
            <div className="font-medium text-slate-900">{week.stay_weeks.starts_on} – {week.stay_weeks.ends_on}</div>
            <div className="text-sm text-slate-500">{week.status}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 5: 驗證會員端管理流程**

Run:
```bash
npm run lint app/me/page.tsx app/api/stay/bookings/route.ts app/api/stay/bookings/[id] components/member/StaySummaryCard.tsx components/stay/StayManagementPanel.tsx
npm run build
```
Manual check:
- `/me` 出現 Stay 摘要卡
- 已訂房會員打開 `/stay` 會看到管理面板而不是再訂一次
- 可以成功發起改期與轉讓請求

- [ ] **Step 6: Commit**

```bash
git add app/me/page.tsx components/member/StaySummaryCard.tsx components/stay/StayManagementPanel.tsx app/api/stay/bookings/route.ts app/api/stay/bookings/[id]/route.ts app/api/stay/bookings/[id]/modify/route.ts app/api/stay/bookings/[id]/transfer/route.ts lib/stayQueries.ts lib/stayBooking.ts lib/stayTransfer.ts
git commit -m "feat(stay): add member stay management flows"
```

---

## Task 5: 候補、接受轉讓、通知與 reconcile cron

**Files:**
- Create: `lib/stayWaitlist.ts`
- Create: `lib/stayEmail.ts`
- Create: `lib/stayReconcile.ts`
- Modify: `lib/stayTransfer.ts`
- Create: `app/stay/transfer/[id]/page.tsx`
- Create: `app/api/stay/transfers/[id]/accept/route.ts`
- Create: `app/api/stay/waitlist/route.ts`
- Create: `app/api/stay/waitlist/[id]/route.ts`
- Create: `app/api/cron/stay-reconcile/route.ts`

- [ ] **Step 1: 實作 waitlist 加入 / 離開與 offer hold 計算**

`lib/stayWaitlist.ts`
```ts
export async function joinStayWaitlist(input: { weekCode: string; memberId: number }) {
  const week = await getStayWeekByCode(input.weekCode);
  if (!week) throw new Error('week_not_found');
  if (!isStayBookable(week.starts_on)) throw new Error('booking_closed');

  const nextPosition = await getNextWaitlistPosition(week.id);
  const { data, error } = await supabaseServer
    .from('stay_waitlist_entries')
    .insert({
      week_id: week.id,
      member_id: input.memberId,
      status: 'active',
      position: nextPosition,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function leaveStayWaitlist(entryId: string, memberId: number) {
  const { error } = await supabaseServer
    .from('stay_waitlist_entries')
    .update({ status: 'removed', updated_at: new Date().toISOString() })
    .eq('id', entryId)
    .eq('member_id', memberId);
  if (error) throw error;
}
```

- [ ] **Step 2: 實作受讓人接受流程**

`app/api/stay/transfers/[id]/accept/route.ts`
```ts
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json();
  const result = await acceptStayTransfer({
    transferId: id,
    recipientEmail: session.email,
    setupIntentId: body.setupIntentId ?? null,
  });

  return NextResponse.json({ transfer: result });
}
```

`lib/stayTransfer.ts`
```ts
export async function acceptStayTransfer(input: {
  transferId: string;
  recipientEmail: string;
  setupIntentId: string | null;
}) {
  const transfer = await getPendingTransferForRecipient(input.transferId, input.recipientEmail);
  if (!transfer) throw new Error('transfer_not_found');
  if (transfer.booking_type === 'guaranteed' && !input.setupIntentId) throw new Error('setup_intent_required');

  const recipient = await resolveMember(encodeURIComponent(input.recipientEmail));
  if (!recipient) throw new Error('recipient_member_not_found');

  const { data: bookingWeek } = await supabaseServer
    .from('stay_booking_weeks')
    .select('booking_id')
    .eq('id', transfer.booking_week_id)
    .maybeSingle();
  if (!bookingWeek) throw new Error('booking_week_not_found');

  await supabaseServer
    .from('stay_booking_weeks')
    .update({ member_id: recipient.id, status: 'transferred', hold_expires_at: null })
    .eq('id', transfer.booking_week_id);

  if (transfer.booking_type === 'guaranteed') {
    const setupIntent = await stayStripe!.setupIntents.retrieve(input.setupIntentId!, { expand: ['payment_method'] });
    if (setupIntent.status !== 'succeeded' || typeof setupIntent.payment_method === 'string' || !setupIntent.customer) {
      throw new Error('setup_intent_not_ready');
    }

    await supabaseServer
      .from('stay_guarantees')
      .update({
        stripe_customer_id: String(setupIntent.customer),
        stripe_setup_intent_id: setupIntent.id,
        stripe_payment_method_id: setupIntent.payment_method.id,
        card_brand: setupIntent.payment_method.card?.brand ?? null,
        card_last4: setupIntent.payment_method.card?.last4 ?? null,
        replaced_at: new Date().toISOString(),
      })
      .eq('booking_id', bookingWeek.booking_id);
  }

  await supabaseServer
    .from('stay_transfers')
    .update({
      to_member_id: recipient.id,
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    })
    .eq('id', transfer.id);

  return supabaseServer.from('stay_transfers').select('*').eq('id', transfer.id).single();
}
```

- [ ] **Step 3: 建立 stay email helpers 與 reconcile worker**

`lib/stayEmail.ts`
```ts
import formData from 'form-data';
import Mailgun from 'mailgun.js';
import { logEmail } from '@/lib/emailLog';

const mailgunClient = process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN
  ? new Mailgun(formData).client({ username: 'api', key: process.env.MAILGUN_API_KEY })
  : null;

export async function sendStayEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  emailType:
    | 'stay_booking_confirmed'
    | 'stay_booking_complimentary_confirmed'
    | 'stay_transfer_requested'
    | 'stay_transfer_accepted'
    | 'stay_waitlist_offer'
    | 'stay_waitlist_expired'
    | 'stay_modification_confirmed'
    | 'stay_no_show_charged';
}) {
  if (!mailgunClient || !process.env.MAILGUN_DOMAIN) throw new Error('mailgun_not_configured');

  const response = await mailgunClient.messages.create(process.env.MAILGUN_DOMAIN, {
    from: process.env.EMAIL_FROM || `Taiwan Digital Fest <noreply@${process.env.MAILGUN_DOMAIN}>`,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });

  await logEmail({
    to_email: input.to,
    subject: input.subject,
    email_type: input.emailType,
    status: 'sent',
    mailgun_message_id: response.id ?? null,
  });
}
```

`lib/stayReconcile.ts`
```ts
export async function runStayReconcile() {
  await expirePendingTransfers();
  await expireOfferedWaitlistEntries();
  await issueNextWaitlistOffers();
}
```

`app/api/cron/stay-reconcile/route.ts`
```ts
import { NextRequest, NextResponse } from 'next/server';
import { runStayReconcile } from '@/lib/stayReconcile';

export async function POST(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return NextResponse.json({ error: 'cron_disabled' }, { status: 503 });
  if (req.headers.get('authorization') !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await runStayReconcile();
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: 建立轉讓接受頁**

`app/stay/transfer/[id]/page.tsx`
```tsx
'use client';

import { useParams } from 'next/navigation';
import StayGuaranteeStep from '@/components/stay/StayGuaranteeStep';

export default function StayTransferAcceptPage() {
  const params = useParams<{ id: string }>();
  return (
    <main className="min-h-screen bg-stone-50 px-4 py-24">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Accept transferred stay</h1>
        <p className="mt-2 text-sm text-slate-600">If this is a guaranteed booking, verify your card before accepting.</p>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: 驗證候補 / 轉讓 / cron**

Run:
```bash
npm run lint app/api/stay/transfers/[id]/accept/route.ts app/api/stay/waitlist app/api/cron/stay-reconcile/route.ts lib/stayWaitlist.ts lib/stayTransfer.ts lib/stayEmail.ts lib/stayReconcile.ts app/stay/transfer/[id]/page.tsx
npm run build
curl -X POST http://localhost:3000/api/cron/stay-reconcile -H "Authorization: Bearer $CRON_SECRET"
```
Manual check:
- 售罄週次可加入候補
- 一般轉讓要求受讓人先完成 guarantee
- 招待轉讓可直接接受
- 過期 transfer / waitlist offer 會被 reconcile worker 處理

- [ ] **Step 6: Commit**

```bash
git add lib/stayWaitlist.ts lib/stayTransfer.ts lib/stayEmail.ts lib/stayReconcile.ts app/api/stay/transfers/[id]/accept/route.ts app/api/stay/waitlist/route.ts app/api/stay/waitlist/[id]/route.ts app/api/cron/stay-reconcile/route.ts app/stay/transfer/[id]/page.tsx
git commit -m "feat(stay): add waitlist transfer and reconcile flows"
```

---

## Task 6: 建立 `/admin/stay` 後台與批次招待碼工具

**Files:**
- Create: `app/admin/stay/page.tsx`
- Create: `app/admin/stay/bookings/page.tsx`
- Create: `app/admin/stay/bookings/[id]/page.tsx`
- Create: `app/admin/stay/weeks/page.tsx`
- Create: `app/admin/stay/invite-codes/page.tsx`
- Create: `app/api/admin/stay/summary/route.ts`
- Create: `app/api/admin/stay/bookings/route.ts`
- Create: `app/api/admin/stay/bookings/[id]/route.ts`
- Create: `app/api/admin/stay/invite-codes/batch/route.ts`
- Create: `app/api/admin/stay/weeks/[id]/route.ts`
- Create: `app/api/admin/stay/transfers/[id]/resend/route.ts`
- Create: `app/api/admin/stay/waitlist/[id]/offer/route.ts`
- Create: `app/api/admin/stay/bookings/[id]/no-show/route.ts`
- Create: `app/api/admin/stay/bookings/[id]/comp/route.ts`
- Modify: `app/admin/layout.tsx`

- [ ] **Step 1: 在 admin nav 加上 Stay**

`app/admin/layout.tsx`
```tsx
<Link href="/admin/stay" className="text-sm text-slate-300 hover:text-white transition-colors whitespace-nowrap">
  住宿 Stay
</Link>
```

- [ ] **Step 2: 建立 summary 與 bookings APIs**

`app/api/admin/stay/summary/route.ts`
```ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';

export async function GET(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'db' }, { status: 500 });

  const [weeks, bookings, waitlist, transfers] = await Promise.all([
    supabaseServer.from('stay_weeks').select('*').order('starts_on', { ascending: true }),
    supabaseServer.from('stay_booking_weeks').select('week_id, status'),
    supabaseServer.from('stay_waitlist_entries').select('week_id, status'),
    supabaseServer.from('stay_transfers').select('status'),
  ]);

  return NextResponse.json({
    weeks: weeks.data ?? [],
    bookingWeeks: bookings.data ?? [],
    waitlist: waitlist.data ?? [],
    transfers: transfers.data ?? [],
  });
}
```

`app/api/admin/stay/invite-codes/batch/route.ts`
```ts
export async function POST(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { count, prefix, batchLabel } = await req.json();

  const rows = Array.from({ length: count }).map(() => ({
    code: `${prefix}-${crypto.randomUUID().slice(0, 8)}`.toUpperCase(),
    status: 'active',
    batch_label: batchLabel ?? null,
    created_by: session.email,
  }));

  const { data, error } = await supabaseServer.from('stay_invite_codes').insert(rows).select('*');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ codes: data });
}
```

- [ ] **Step 3: 建立 admin pages**

`app/admin/stay/page.tsx`
```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function AdminStayDashboard() {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    fetch('/api/admin/stay/summary').then((r) => r.json()).then(setData);
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">住宿 Stay</h1>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {(data?.weeks ?? []).map((week: any) => (
          <div key={week.code} className="rounded-xl bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">{week.code}</div>
            <div className="mt-2 text-xl font-semibold text-slate-900">NT${week.price_twd}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <Link href="/admin/stay/bookings" className="rounded-lg bg-cyan-500 px-4 py-2 text-white">Bookings</Link>
        <Link href="/admin/stay/weeks" className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700">Weeks</Link>
        <Link href="/admin/stay/invite-codes" className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700">Invite codes</Link>
      </div>
    </div>
  );
}
```

`app/api/admin/stay/bookings/[id]/no-show/route.ts`
```ts
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await ctx.params;

  const { data: bookingWeek } = await supabaseServer
    .from('stay_booking_weeks')
    .select('id, booked_price_twd, booking_id')
    .eq('id', id)
    .maybeSingle();
  if (!bookingWeek) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: guarantee } = await supabaseServer
    .from('stay_guarantees')
    .select('stripe_customer_id, stripe_payment_method_id')
    .eq('booking_id', bookingWeek.booking_id)
    .eq('guarantee_type', 'stripe_card')
    .maybeSingle();
  if (!guarantee?.stripe_customer_id || !guarantee?.stripe_payment_method_id) {
    return NextResponse.json({ error: 'missing_guarantee' }, { status: 400 });
  }

  const paymentIntent = await chargeStayNoShow({
    customerId: guarantee.stripe_customer_id,
    paymentMethodId: guarantee.stripe_payment_method_id,
    amountTwd: bookingWeek.booked_price_twd,
    statementDescriptorSuffix: 'NOSHOW',
  });

  await supabaseServer.from('stay_charge_attempts').insert({
    booking_week_id: bookingWeek.id,
    reason: 'no_show',
    amount_twd: bookingWeek.booked_price_twd,
    stripe_payment_intent_id: paymentIntent.id,
    status: 'succeeded',
    created_by: session.email,
  });

  return NextResponse.json({ charge: paymentIntent });
}
```

- [ ] **Step 4: 驗證後台管理**

Run:
```bash
npm run lint app/admin/stay app/api/admin/stay app/admin/layout.tsx
npm run build
```
Manual check:
- `/admin/stay` 能顯示 4 個週次摘要
- `/admin/stay/invite-codes` 可批次建立 code
- `/admin/stay/bookings/[id]` 可看到 guarantee / transfer / waitlist / charge history

- [ ] **Step 5: Commit**

```bash
git add app/admin/layout.tsx app/admin/stay app/api/admin/stay
git commit -m "feat(admin): add stay dashboard and invite code tooling"
```

---

## Task 7: 補 Playwright smoke tests 與整體驗證

**Files:**
- Create: `tests/e2e/stay.spec.ts`

- [ ] **Step 1: 寫 Playwright smoke tests，直接 mock stay APIs**

`tests/e2e/stay.spec.ts`
```ts
import { test, expect } from '@playwright/test';

test('public stay page renders rounded TWD prices and policy copy', async ({ page }) => {
  await page.route('**/api/stay/weeks', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        weeks: [
          { code: '2026-w1', starts_on: '2026-04-30', ends_on: '2026-05-07', price_twd: 6125, room_capacity: 30, status: 'active', booking_open: true },
          { code: '2026-w2', starts_on: '2026-05-07', ends_on: '2026-05-14', price_twd: 4904, room_capacity: 40, status: 'active', booking_open: true },
        ],
      }),
    });
  });

  await page.goto('/stay?lang=zh');
  await expect(page.getByText(/任何取消或未到都收整週房費/)).toBeVisible();
  await expect(page.getByText(/NT\\$6,125/)).toBeVisible();
  await expect(page.getByText(/NT\\$4,904/)).toBeVisible();
});

test('authenticated member page shows stay summary card', async ({ page }) => {
  await page.route('**/api/stay/bookings', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ bookings: [], waitlist: [], transfers: [] }),
    });
  });

  await page.goto('/me');
  await expect(page.getByText(/Partner Stay|合作住宿/)).toBeVisible({ timeout: 15000 });
});
```

- [ ] **Step 2: 跑 targeted e2e、lint、build**

Run:
```bash
npm run lint tests/e2e/stay.spec.ts
npm run e2e -- tests/e2e/stay.spec.ts
npm run build
```
Expected:
- Playwright 2 tests PASS
- `next build` PASS

- [ ] **Step 3: 最終手動清單**

手動驗證以下高風險情境：

```text
1. 一般訂房：登入 -> 選週 -> SetupIntent -> 建立 booking -> /me 出現管理卡
2. 招待訂房：輸入有效 code -> 跳過綁卡 -> booking_type=complimentary
3. 三天前截止：把一個 week starts_on 改成接近今日，確認超時後不可新訂
4. 候補：把一週 capacity 塞滿 -> 只剩 waitlist CTA
5. 轉讓：一般訂單要求受讓人重新綁卡；招待訂單不要求
6. 後台：可批次建立 invite codes；可手動標記 no-show
7. Email：booking confirmed / transfer requested / waitlist offer 三種通知都有 email_log
```

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/stay.spec.ts
git commit -m "test(stay): add stay smoke coverage"
```

---

## Self-Review

### Spec coverage check

- 單一房源、light mode、整數 TWD 報價：Task 2
- SetupIntent 擔保、招待碼免費住宿：Task 3
- 三天前截止與 server-side 檢查：Task 1 + Task 3
- `/me` 摘要、改期、轉讓：Task 4
- 候補、受讓接受、reconcile：Task 5
- `/admin/stay`、批次招待碼、no-show：Task 6
- e2e smoke 與 final verification：Task 7

### Placeholder scan

- 無 `TBD` / `TODO`
- 所有新增檔案與主要 route 都有明確路徑
- 所有高風險流程都有對應 task

### Type consistency check

- 價格統一使用整數 TWD：`stay_weeks.price_twd`、`stay_booking_weeks.booked_price_twd`、`stay_charge_attempts.amount_twd`
- booking types 統一為 `guaranteed | complimentary`
- transfer statuses 統一為 `pending_acceptance | accepted | expired | revoked`
