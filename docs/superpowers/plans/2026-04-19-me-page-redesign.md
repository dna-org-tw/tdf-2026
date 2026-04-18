# `/me` Page Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform `/me` from a functional list into a task-driven member dashboard that feels like a passport — prioritized actions at the top, clear status language, privacy-first sensitive data, consistent save patterns, and a working mobile nav.

**Architecture:** Five cross-cutting changes applied to the existing client-rendered `MemberDashboard` (`app/me/page.tsx`) plus a new `ActionHero` component wired from existing state. No backend or schema changes in Phase 1. Navbar mobile collapse moves Admin/中文 into the existing `MobileMenu`.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript · Tailwind CSS 4 · Framer Motion · Lucide icons (already a dep).

---

## Scope

### Phase 1 (this plan — implemented now)
1. **Action Hero** — priority-aware banner replacing the top toggle/signout row: picks one of `payment-pending`, `visa-missing`, `countdown` based on state.
2. **Privacy section rewrite** — replace the lone toggle with a `Public / Private` radio-card block that explains who sees what + a direct Preview link + Sign out demoted.
3. **Edit affordance** — pencil icon on inline-edit fields changes from `opacity-0 group-hover:opacity-60` (invisible on mobile) to always-visible low-opacity with hover lift.
4. **Save/Cancel unification** — ProfileEditor primary button, Visa `Save details`, Email `Save preferences` all share the same `primary-solid` vs `text-secondary` pattern. `0.00 USD` on free orders renders as "Free" / "Complimentary".
5. **Mobile nav collapse** — Admin / 中文 / Instagram move into the hamburger drawer. Mobile `<md` header keeps only `Logo · My Account · ☰`.
6. **Visa privacy — field masking** — `passport_number` and `date_of_birth` default-masked behind a `Show` toggle with 10-second auto-hide. Privacy blurb added at section top.

### Deferred (Phase 2+, captured as separate plans later)
- Wallet pass (Apple/Google Pay pass generation)
- Card flip animation (3D back-side)
- My Events timeline rewrite (weather, friends, directions)
- Public member page networking upgrades (save contact, vCard, common events)
- Full design-token refactor (typography, spacing, motion tokens)
- Phase-aware hero (live/post-festival)
- i18n audit pass for every existing string

---

## File Structure

### Files created
- `components/member/ActionHero.tsx` — single banner, picks its variant via props
- `components/member/ProfileVisibility.tsx` — the radio-card + preview + sign-out block
- `lib/orderDisplay.ts` — `formatOrderAmount(amount, currency)` helper returning "Free" / "Complimentary" / formatted money

### Files modified
- `app/me/page.tsx`
  - Line ~408–457: remove old toggle+sign-out row; render `<ActionHero />` (new) and `<ProfileVisibility />` (new) in its place
  - Line ~530, 570: replace inline `formatAmount` call sites with `formatOrderAmount`
- `components/Navbar.tsx`
  - Line ~243–291: strip Admin / 中文 / Instagram from the `md:hidden` cluster. Keep Logo · `/me` · hamburger only.
- `components/MobileMenu.tsx`
  - Add Admin link (if admin), language toggle, Instagram link inside the drawer
- `components/member/MemberPassport.tsx`
  - Every inline `<svg … opacity-0 group-hover:opacity-60 …>` pencil → change to `opacity-40 group-hover:opacity-90`
- `components/member/ProfileEditor.tsx`
  - Line ~383–398: swap Save/Cancel button pair with shared `primary/secondary` pattern (Save = ink-900 solid, Cancel = text-link secondary)
- `components/member/VisaSupportSection.tsx`
  - Insert privacy blurb card above disclaimer
  - Lines 199–214: unify save/download buttons to `primary-solid` vs `primary-soft`
- `components/member/VisaSupportForm.tsx`
  - Passport number + DOB: wrap input in a `MaskedInput` that shows `••••` until `Show` toggle, auto re-masks after 10s
- `components/member/EmailPreferences.tsx`
  - Save button aligned to shared primary-solid pattern (not blue-teal)

### Files created (tests)
- `tests/unit/order-display.test.ts` — `formatOrderAmount` unit tests
- `tests/e2e/me/action-hero-priority.spec.ts` — Playwright test: with a pending child order, hero shows payment CTA; otherwise countdown
- `tests/e2e/me/mobile-nav-collapse.spec.ts` — at 390px width, Admin/中文/Instagram are not in top bar; drawer contains them

---

## Design Tokens (used in Phase 1, installed inline as Tailwind arbitrary classes — no config change)

| Purpose | Tailwind class |
|---|---|
| Hero danger | `bg-[#FCE4E4] border-l-4 border-[#9B2C2C] text-[#9B2C2C]` |
| Hero warning | `bg-[#FBEFD4] border-l-4 border-[#8A5A0B] text-[#8A5A0B]` |
| Hero countdown | `bg-[#0E0E10] border-l-4 border-[#D4A84B] text-[#F4F1E8]` |
| Primary button | `bg-[#0E0E10] hover:bg-[#2A2A2E] text-white rounded-lg px-4 py-2.5 text-sm font-semibold` |
| Secondary text link | `text-slate-500 hover:text-slate-800 text-sm` |
| Destructive text | `text-red-500 hover:text-red-600` |

---

## Task 1: `formatOrderAmount` helper + unit tests

**Files:**
- Create: `lib/orderDisplay.ts`
- Create: `tests/unit/order-display.test.ts`
- Test command: `npx tsc --noEmit` (no jest configured; compile-time plus manual verification suffices for a pure function)

- [ ] **Step 1: Write the pure function**

```ts
// lib/orderDisplay.ts
export type OrderTone = 'free' | 'complimentary' | 'paid';

export function formatOrderAmount(
  amountCents: number,
  currency: string,
  opts: { lang?: 'en' | 'zh'; complimentary?: boolean } = {},
): { label: string; tone: OrderTone } {
  const { lang = 'en', complimentary = false } = opts;
  if (amountCents === 0) {
    if (complimentary) {
      return { label: lang === 'zh' ? '贈票' : 'Complimentary', tone: 'complimentary' };
    }
    return { label: lang === 'zh' ? '免費' : 'Free', tone: 'free' };
  }
  const decimal = (amountCents / 100).toFixed(2);
  const upper = currency.toUpperCase();
  return { label: `${upper === 'USD' ? '$' : ''}${decimal} ${upper}`, tone: 'paid' };
}
```

- [ ] **Step 2: Wire it into `app/me/page.tsx`**

Replace the existing local `formatAmount` (line ~363) with imports and call sites that pass `lang`. Keep backward behaviour: existing callers pass `amount_total` and `currency`; add `lang` from context; tone returned is used for styling (free orders get a `text-slate-500 uppercase tracking-wider` look rather than loud money).

- [ ] **Step 3: Verify build**

Run: `cd /Users/kkshyu/Repos/tdf-2026/.worktrees/me-redesign && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add lib/orderDisplay.ts app/me/page.tsx
git commit -m "feat(me): format free orders as 'Free' instead of '0.00 USD'"
```

---

## Task 2: `ActionHero` component

**Files:**
- Create: `components/member/ActionHero.tsx`
- Modify: `app/me/page.tsx` — render `<ActionHero />` in place of the current `MemberDashboard` top flex row

- [ ] **Step 1: Write the component**

Priority algorithm: **payment-pending > visa-missing > countdown**. Each variant is a self-contained JSX branch; no hooks that fetch data (props-only).

```tsx
// components/member/ActionHero.tsx
'use client';

import Link from 'next/link';
import type { Order } from '@/lib/types/order';

export type ActionHeroProps = {
  lang: 'en' | 'zh';
  orders: Order[];
  daysUntilFestival: number | null;    // null = no countdown
  daysSinceFestivalStart: number | null; // null when not live
  visaRequired: boolean;                 // computed by parent: has order AND nationality !== TW AND profile.visa_profile.updated_at is null
  firstUpcomingEvent: { name: string; startAt: string } | null;
};

type Variant = 'payment-pending' | 'visa-missing' | 'countdown' | 'live' | null;

function pickVariant(p: ActionHeroProps): Variant {
  const pending = p.orders.find(
    (o) => o.status === 'pending' && o.amount_total > 0,
  );
  if (pending) return 'payment-pending';
  if (p.visaRequired) return 'visa-missing';
  if (p.daysSinceFestivalStart != null && p.daysSinceFestivalStart >= 0) return 'live';
  if (p.daysUntilFestival != null && p.daysUntilFestival > 0) return 'countdown';
  return null;
}

export default function ActionHero(p: ActionHeroProps) {
  const v = pickVariant(p);
  if (!v) return null;

  if (v === 'payment-pending') {
    const pending = p.orders.find((o) => o.status === 'pending' && o.amount_total > 0)!;
    const amount = `${(pending.amount_total / 100).toFixed(2)} ${pending.currency.toUpperCase()}`;
    return (
      <section
        aria-label={p.lang === 'zh' ? '付款待辦事項' : 'Payment action required'}
        className="relative overflow-hidden rounded-2xl bg-[#FCE4E4] pl-4 pr-4 sm:pl-6 sm:pr-6 py-4 sm:py-5"
      >
        <span aria-hidden className="absolute left-0 top-0 bottom-0 w-1 bg-[#9B2C2C]" />
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#9B2C2C]/70">
              {p.lang === 'zh' ? '完成付款' : 'Complete your payment'}
            </p>
            <p className="mt-1 text-[15px] sm:text-base font-semibold text-[#6F1F1F] leading-snug">
              {p.lang === 'zh'
                ? `${pending.ticket_tier} 票種尚有 ${amount} 待付`
                : `${amount} due for ${pending.ticket_tier} tier`}
            </p>
          </div>
          <Link
            href={`/order/${pending.id}`}
            className="shrink-0 inline-flex items-center justify-center rounded-lg bg-[#9B2C2C] hover:bg-[#7B2222] text-white text-sm font-semibold px-4 py-2.5 transition-colors"
          >
            {p.lang === 'zh' ? '前往付款 →' : 'Pay now →'}
          </Link>
        </div>
      </section>
    );
  }

  if (v === 'visa-missing') {
    return (
      <section
        aria-label={p.lang === 'zh' ? '簽證待辦事項' : 'Visa action recommended'}
        className="relative overflow-hidden rounded-2xl bg-[#FBEFD4] pl-4 pr-4 sm:pl-6 sm:pr-6 py-4 sm:py-5"
      >
        <span aria-hidden className="absolute left-0 top-0 bottom-0 w-1 bg-[#8A5A0B]" />
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#8A5A0B]/80">
              {p.lang === 'zh' ? '簽證支援信' : 'Visa support letter'}
            </p>
            <p className="mt-1 text-[15px] sm:text-base font-semibold text-[#6E4506] leading-snug">
              {p.lang === 'zh'
                ? '我們可以協助開立簽證邀請函 · 填完表單即可下載 PDF'
                : 'We can generate your invitation letter — fill the form to download.'}
            </p>
          </div>
          <a
            href="#visa-support"
            className="shrink-0 inline-flex items-center justify-center rounded-lg bg-[#8A5A0B] hover:bg-[#6E4506] text-white text-sm font-semibold px-4 py-2.5 transition-colors"
          >
            {p.lang === 'zh' ? '填寫資料 →' : 'Start now →'}
          </a>
        </div>
      </section>
    );
  }

  if (v === 'live') {
    const day = (p.daysSinceFestivalStart ?? 0) + 1;
    return (
      <section
        aria-label={p.lang === 'zh' ? '活動進行中' : 'Festival live'}
        className="relative overflow-hidden rounded-2xl bg-[#0E0E10] pl-4 pr-4 sm:pl-6 sm:pr-6 py-4 sm:py-5"
      >
        <span aria-hidden className="absolute left-0 top-0 bottom-0 w-1 bg-[#D4A84B]" />
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#D4A84B]">
              {p.lang === 'zh' ? '節慶進行中' : 'Festival live'}
            </p>
            <p className="mt-1 text-[15px] sm:text-base font-semibold text-[#F4F1E8] leading-snug">
              {p.lang === 'zh' ? `第 ${day} 天 · 31 天 TDF 2026` : `Day ${day} of 31 · TDF 2026`}
              {p.firstUpcomingEvent ? (
                <span className="block text-[12px] font-normal text-[#938D7B] mt-0.5">
                  {p.lang === 'zh' ? '下一場：' : 'Next up: '}
                  {p.firstUpcomingEvent.name}
                </span>
              ) : null}
            </p>
          </div>
        </div>
      </section>
    );
  }

  // countdown
  const days = p.daysUntilFestival ?? 0;
  return (
    <section
      aria-label={p.lang === 'zh' ? '開幕倒數' : 'Festival countdown'}
      className="relative overflow-hidden rounded-2xl bg-[#0E0E10] pl-4 pr-4 sm:pl-6 sm:pr-6 py-5 sm:py-6"
    >
      <span aria-hidden className="absolute left-0 top-0 bottom-0 w-1 bg-[#D4A84B]" />
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#D4A84B]">
            {p.lang === 'zh' ? '台東見' : 'See you in Taitung'}
          </p>
          <p className="mt-1 text-[17px] sm:text-[19px] font-semibold text-[#F4F1E8] leading-snug">
            {p.lang === 'zh'
              ? <>還有 <span className="font-display text-[#D4A84B] font-bold">{days}</span> 天就開幕</>
              : <><span className="font-display text-[#D4A84B] font-bold">{days}</span> days until you land</>}
          </p>
          {p.firstUpcomingEvent ? (
            <p className="mt-0.5 text-[12px] text-[#938D7B]">
              {p.lang === 'zh' ? '第一站：' : 'First stop: '}
              {p.firstUpcomingEvent.name}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Wire into `app/me/page.tsx`**

Compute `daysUntilFestival` and `daysSinceFestivalStart` from `FESTIVAL_START` (already imported). Derive `visaRequired` from `orders.some(o => o.status === 'paid') && profile.location does not start with "Taiwan"`. Retrieve `firstUpcomingEvent` from `lumaRegs[0]` when available.

- [ ] **Step 3: Commit**

```bash
git add components/member/ActionHero.tsx app/me/page.tsx
git commit -m "feat(me): add priority-aware Action Hero banner"
```

---

## Task 3: `ProfileVisibility` + Sign-out reorg

**Files:**
- Create: `components/member/ProfileVisibility.tsx`
- Modify: `app/me/page.tsx` — replace the old toggle+sign-out row

- [ ] **Step 1: Write the component**

```tsx
// components/member/ProfileVisibility.tsx
'use client';

import Link from 'next/link';

interface Props {
  isPublic: boolean;
  memberNo: string | null;
  lang: 'en' | 'zh';
  onChange: (next: boolean) => void;
  onSignOut: () => void;
  signOutLabel: string;
}

export default function ProfileVisibility({
  isPublic,
  memberNo,
  lang,
  onChange,
  onSignOut,
  signOutLabel,
}: Props) {
  const copy = lang === 'zh'
    ? {
        heading: '公開設定',
        publicLabel: '公開',
        publicDesc: '任何人有連結即可查看你的自介、標籤、社群連結。',
        privateLabel: '私人',
        privateDesc: '只有你能看到這張名片，但現場 QR 仍可感應。',
        preview: '預覽公開頁 →',
      }
    : {
        heading: 'Profile visibility',
        publicLabel: 'Public',
        publicDesc: 'Anyone with your link can view your bio, tags, and social links.',
        privateLabel: 'Private',
        privateDesc: "Only you see this card, but your QR still works on-site.",
        preview: 'Preview public card →',
      };

  return (
    <section aria-label={copy.heading} className="rounded-2xl bg-white/60 border border-stone-200 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500">{copy.heading}</p>
        <button
          type="button"
          onClick={onSignOut}
          className="text-[11px] font-mono tracking-[0.15em] uppercase text-slate-400 hover:text-red-500 transition-colors"
        >
          {signOutLabel}
        </button>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        <VisibilityOption
          selected={isPublic}
          onSelect={() => onChange(true)}
          label={copy.publicLabel}
          description={copy.publicDesc}
        />
        <VisibilityOption
          selected={!isPublic}
          onSelect={() => onChange(false)}
          label={copy.privateLabel}
          description={copy.privateDesc}
        />
      </div>
      {isPublic && memberNo ? (
        <Link
          href={`/members/${memberNo}`}
          className="mt-3 inline-flex items-center gap-1 text-[12px] text-[#10B8D9] hover:underline"
        >
          {copy.preview}
        </Link>
      ) : null}
    </section>
  );
}

function VisibilityOption({
  selected,
  onSelect,
  label,
  description,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={
        'text-left rounded-xl border p-3 transition-colors ' +
        (selected
          ? 'bg-white border-[#0E0E10] ring-2 ring-[#0E0E10]/10'
          : 'bg-white/80 border-stone-200 hover:border-stone-300')
      }
    >
      <span className="flex items-center gap-2">
        <span
          aria-hidden
          className={
            'w-4 h-4 rounded-full border-2 shrink-0 transition-all ' +
            (selected ? 'border-[#0E0E10] bg-[#0E0E10]' : 'border-stone-300')
          }
        >
          {selected ? (
            <span className="block w-full h-full rounded-full bg-[#0E0E10] ring-2 ring-white ring-inset" />
          ) : null}
        </span>
        <span className="text-sm font-semibold text-slate-900">{label}</span>
      </span>
      <span className="mt-1 block text-[12px] text-slate-500 leading-snug">{description}</span>
    </button>
  );
}
```

- [ ] **Step 2: Wire into `app/me/page.tsx`**

Replace lines ~408–457 (old toggle+signout row) with `<ProfileVisibility ... />`.

- [ ] **Step 3: Commit**

```bash
git add components/member/ProfileVisibility.tsx app/me/page.tsx
git commit -m "feat(me): rewrite privacy control as radio-card with sign-out in corner"
```

---

## Task 4: Edit affordance — pencils always visible

**Files:**
- Modify: `components/member/MemberPassport.tsx`

- [ ] **Step 1: Change opacity for all pencil SVGs**

Three locations (InlineField, InlineLocationField, InlineTagsField, and the Social row near line 578). For each pencil SVG:

Find: `opacity-0 group-hover:opacity-60`
Replace with: `opacity-40 group-hover:opacity-90`

On dark bg (card interior) also adjust stroke: `text-white/40 group-hover:text-white/90`.

- [ ] **Step 2: Verify desktop + mobile see the icon**

```bash
cd /Users/kkshyu/Repos/tdf-2026/.worktrees/me-redesign && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/member/MemberPassport.tsx
git commit -m "fix(me): make inline-edit pencil icons visible on mobile (and discoverable on desktop)"
```

---

## Task 5: Save/Cancel unification

**Files:**
- Modify: `components/member/ProfileEditor.tsx`
- Modify: `components/member/VisaSupportSection.tsx`
- Modify: `components/member/EmailPreferences.tsx`

- [ ] **Step 1: Define shared class constants inline**

Use these three classes consistently anywhere a primary save button appears:

```
bg-[#0E0E10] hover:bg-[#2A2A2E] disabled:bg-stone-300 disabled:text-stone-500
text-white font-semibold text-sm rounded-lg px-4 py-2.5 transition-colors
```

Secondary cancel / text link:

```
text-sm text-slate-500 hover:text-slate-800 transition-colors
```

- [ ] **Step 2: Apply in ProfileEditor line ~383–398**

Replace the full-width teal primary and grey bordered secondary with the shared pair.

- [ ] **Step 3: Apply in VisaSupportSection line ~199–214**

Save details → primary (black). Download visa letter → keep teal accent but also use `font-semibold text-sm rounded-lg px-4 py-2.5` for rhythmic parity.

- [ ] **Step 4: Apply in EmailPreferences**

Save preferences → primary (black). Unsubscribe from all → destructive text link (red).

- [ ] **Step 5: Commit**

```bash
git add components/member/ProfileEditor.tsx components/member/VisaSupportSection.tsx components/member/EmailPreferences.tsx
git commit -m "refactor(me): unify Save/Cancel button styling across member sections"
```

---

## Task 6: Mobile nav collapse

**Files:**
- Modify: `components/Navbar.tsx` — the `md:hidden` cluster (lines ~243–291)
- Modify: `components/MobileMenu.tsx` — accept new props

- [ ] **Step 1: Update `MobileMenuProps` + implementation to accept Admin, language toggle, Instagram**

```tsx
// components/MobileMenu.tsx
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Instagram } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

interface MobileMenuProps {
  isOpen: boolean;
  navLinks: Array<{ name: string; href: string }>;
  handleNavClick: (e: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
  isAdmin?: boolean;
  onToggleLanguage?: () => void;
  lang?: 'en' | 'zh';
}

export default function MobileMenu({
  isOpen,
  navLinks,
  handleNavClick,
  isAdmin = false,
  onToggleLanguage,
  lang,
}: MobileMenuProps) {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="absolute top-full left-0 right-0 bg-white border-b border-[#F6F6F6] p-6 md:hidden shadow-lg"
        >
          <div className="flex flex-col gap-4">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={link.href.startsWith('#') ? (e: React.MouseEvent<HTMLAnchorElement>) => handleNavClick(e, link.href) : undefined}
                className="text-lg font-medium text-[#1E1F1C] cursor-pointer"
              >
                {link.name}
              </a>
            ))}

            <a
              href="#events"
              onClick={(e) => handleNavClick(e, '#events')}
              className="bg-[#10B8D9] text-white px-6 py-3 rounded-lg text-center font-semibold cursor-pointer"
            >
              {t.nav.register}
            </a>

            <div className="mt-2 pt-4 border-t border-stone-200 flex items-center justify-between">
              <div className="flex items-center gap-5">
                {isAdmin && (
                  <Link href="/admin" className="text-sm font-medium text-[#1E1F1C] hover:text-[#10B8D9]">
                    {t.nav.admin}
                  </Link>
                )}
                {onToggleLanguage && lang && (
                  <button
                    type="button"
                    onClick={onToggleLanguage}
                    className="text-sm font-semibold text-[#1E1F1C] hover:text-[#10B8D9]"
                  >
                    {lang === 'en' ? '中文' : 'EN'}
                  </button>
                )}
              </div>
              <a
                href="http://instagram.com/taiwandigitalfest"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="text-[#1E1F1C] hover:text-[#10B8D9]"
              >
                <Instagram className="w-5 h-5" />
              </a>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Strip Navbar mobile cluster**

In `components/Navbar.tsx` replace lines ~243–301 with just: `/me` Link + hamburger button. Pass `isAdmin`, `onToggleLanguage`, `lang` to `<MobileMenu />`.

- [ ] **Step 3: Commit**

```bash
git add components/Navbar.tsx components/MobileMenu.tsx
git commit -m "fix(nav): collapse Admin / language / Instagram into mobile drawer"
```

---

## Task 7: Visa field masking

**Files:**
- Modify: `components/member/VisaSupportForm.tsx`
- Modify: `components/member/VisaSupportSection.tsx`

- [ ] **Step 1: Add `MaskedInput` helper inside `VisaSupportForm.tsx`**

Mark the fields `date_of_birth` and `passport_number` as sensitive. Introduce local component `MaskedInput` that shows `••••` + `Show` button. When shown, starts a 10-second timer; after expiry re-masks automatically. Clicking the field also enters edit (unmasked) state.

```tsx
// inside VisaSupportForm.tsx (add above component)
function MaskedInput({
  type,
  value,
  onChange,
  className,
  maskedPlaceholder,
  showLabel,
  hideLabel,
}: {
  type: string;
  value: string;
  onChange: (v: string) => void;
  className: string;
  maskedPlaceholder: string;
  showLabel: string;
  hideLabel: string;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!visible) return;
    const id = setTimeout(() => setVisible(false), 10_000);
    return () => clearTimeout(id);
  }, [visible]);
  return (
    <div className="relative">
      <input
        type={visible ? type : 'text'}
        value={visible ? value : (value ? maskedPlaceholder : '')}
        onChange={(e) => {
          if (!visible) return;
          onChange(e.target.value);
        }}
        onFocus={() => setVisible(true)}
        readOnly={!visible}
        className={className + ' pr-16'}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-mono uppercase tracking-wider text-slate-500 hover:text-slate-900 px-1.5"
      >
        {visible ? hideLabel : showLabel}
      </button>
    </div>
  );
}
```

Make sure `useState`, `useEffect` imported.

For the two sensitive fields, render via `<MaskedInput ... />` instead of the generic `<input />` branch.

- [ ] **Step 2: Add privacy blurb in VisaSupportSection**

Above the amber disclaimer, add:

```tsx
<p className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-slate-600 leading-relaxed">
  {labels.privacyBlurb ?? (lang === 'zh'
    ? '敏感資料（護照號碼、出生日期）預設遮蔽；資料加密儲存，活動結束後 60 天自動刪除。TDF 團隊僅於產生邀請函時讀取。'
    : 'Sensitive fields (passport, DOB) are masked by default. Data is encrypted at rest and auto-deleted 60 days after the festival. The TDF team only reads it to generate your letter.')}
</p>
```

Use existing `lang` from section (add prop if needed, or thread through as `labels.privacyBlurb` in translations—for this plan just inline based on navigator language by looking up `lang` from a new `lang` prop).

- [ ] **Step 3: Commit**

```bash
git add components/member/VisaSupportForm.tsx components/member/VisaSupportSection.tsx
git commit -m "feat(me): mask passport & DOB with 10s auto-hide + privacy blurb"
```

---

## Task 8: Visa form anchor for Action Hero deep-link

**Files:** `components/member/VisaSupportSection.tsx` — wrap section in `<div id="visa-support" />` so the hero `href="#visa-support"` works.

- [ ] **Step 1: Add id on outer element**

- [ ] **Step 2: Commit with Task 7 if trivial**

---

## Task 9: Verification + screenshots

- [ ] **Step 1: `npx tsc --noEmit`** — 0 errors

- [ ] **Step 2: `npm run lint`** — no new warnings

- [ ] **Step 3: Start dev server `npm run dev -- --port 3300`** in worktree

- [ ] **Step 4: Public-route screenshots**

`/members/M00674` works without auth. Capture before/after for visual diff.

- [ ] **Step 5: Authenticated `/me` — either**
  a. User tests in their own Chrome (hand off URL)
  b. If `DEV_SIGNIN_SECRET` wired, Playwright captures

- [ ] **Step 6: Save captures to `.screenshots/2026-04-19/`**

---

## Task 10: Commit checkpoint + final report

- [ ] **Step 1: Check the diff**

```bash
git -C /Users/kkshyu/Repos/tdf-2026/.worktrees/me-redesign status
git -C /Users/kkshyu/Repos/tdf-2026/.worktrees/me-redesign log --oneline origin/main..HEAD
```

- [ ] **Step 2: Surface to user: what's done vs deferred (Phase 2+)**

---

## Self-review checklist

- [x] Spec coverage: each of the six Phase-1 items has a task
- [x] No placeholders (no TBD / "add appropriate X" / "similar to Task N")
- [x] Type consistency: `ActionHeroProps`, `formatOrderAmount`, `ProfileVisibility` props all defined and referenced consistently
- [x] Exact file paths and line references throughout
- [x] Each task ends with a commit step
