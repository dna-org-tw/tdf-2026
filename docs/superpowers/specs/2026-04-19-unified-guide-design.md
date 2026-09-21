# Unified Guide Design Spec

## Overview

Replace the current `/guide` tabbed FAQ page with a unified long-form guide that combines:

- the existing public event guide
- the existing member-system guide
- the newly launched partner stay booking system
- the newly launched visa support document flow

The new page should keep `/guide` as a single public route, but upgrade it from a tabbed FAQ container into a product guide page with clear section navigation, deep links, and explicit boundaries around partially complete functionality.

This spec supersedes the older `/guide` page design in [2026-04-12-guide-page-design.md](/Users/kkshyu/Repos/tdf-2026/docs/superpowers/specs/2026-04-12-guide-page-design.md) by expanding the scope from event FAQ only to a full-site guide.

## Goal

Turn `/guide` into the canonical source of truth for how the TDF 2026 site works, covering both public participation information and member-facing product capabilities, without losing the existing event FAQ value for first-time visitors.

## Non-Goals

- Do not introduce a CMS, markdown pipeline, or remote content system.
- Do not create additional guide routes such as `/member-guide` or `/stay-guide`.
- Do not redesign homepage information architecture beyond updating `/guide` deep links.
- Do not claim incomplete flows are fully launched.

## Product Decisions

### 1. Single Route, Unified Page

Keep `/guide` as one route. Do not split the guide across multiple pages. The page should present all guide content in one long-form document with deep-linkable sections.

### 2. Dual Entry at the Top

The hero area should present two large entry cards:

- `活動指南 / Event Guide`
- `會員指南 / Member Guide`

These are same-page anchor links, not tabs and not separate pages. They help users choose a reading path without fragmenting the content model.

### 3. Reading Order

The main page order should be:

1. Hero
2. Entry cards
3. Sticky quick navigation
4. Event guide sections
5. Member guide sections
6. Partner stay sections
7. Visa support section
8. Limitations and notes

This preserves the current public expectation that `/guide` is a visitor-facing destination first, while still incorporating the newer member product documentation.

### 4. Limitations Handling

Known gaps should not interrupt the main guide flow. Stable abilities belong in the main sections; incomplete or boundary-setting details belong in a dedicated limitations section at the end.

## Information Architecture

## Top-Level Guide Groups

The guide should be organized into four top-level groups:

1. Event
2. Member
3. Stay
4. Visa

These groups drive the sticky quick nav and the `group` field in the guide data model.

## Event Guide Sections

The event guide preserves the existing public information, rewritten from tabbed FAQ into section-based content:

- `event-guide` — group landing section for event information
- `event-tickets` — ticket tiers, participation rules, order lookup basics
- `event-registration` — event registration, approval timing, no-show policy
- `event-accommodation` — accommodation options, living budget, housing channels
- `event-transportation` — travel to Taitung, local transport, Hualien logistics
- `event-hualien` — Hualien trip cost and lodging details
- `event-speakers` — speaker and side-event information
- `event-visa-contact` — public visa FAQ, proof-of-participation contact path, contact references

## Member Guide Sections

The member guide should follow conceptual understanding order instead of raw feature inventory:

- `member-guide` — group landing section for member features
- `member-basics` — `users` vs `members`, `member_no`, who counts as a member
- `member-auth-passport` — email verification login, dashboard, identity card, tier resolution
- `member-profile-card` — editable card fields, avatar upload, public/private toggle, public profile page, QR sharing
- `member-collections` — collecting other members, privacy rules, `/me/collections`
- `member-activity-orders` — upcoming/past events, Luma registrations, grouped orders, order detail pages
- `member-transfers` — self-service paid-order transfer behavior and audit trail
- `member-preferences` — email preference management
- `member-upgrade` — self-service tier upgrade flow, described conservatively

## Stay Guide Sections

The partner stay system is a distinct product area and should not be buried inside event lodging FAQ or member-only sections:

- `stay-overview` — what the partner stay system is and who it is for
- `stay-booking` — public `/stay` page, visible inventory, week selection, guest details, single-occupancy rule, invite-code path, Stripe card guarantee path
- `stay-after-booking` — summary in `/me`, modify/transfer/waitlist/reconcile capabilities, described carefully based on current UI maturity
- `stay-rules` — no-show charging, waitlist timing, transfer timing, operational notes

## Visa Guide Section

The visa support flow should be documented as its own product section rather than mixed into public visa FAQ:

- `visa-support` — self-service visa support letter flow on `/me`

This section should cover what it is, how members use it, and the constraints around paid-order selection and support-letter scope.

## Limitations Section

The page ends with a dedicated limitations and notes area:

- `limitations`

This section documents gaps and boundary-setting statements that should not be presented as core functionality.

## Content Strategy By Section Type

## Event Sections

Event sections remain mostly FAQ-driven, because the existing content is already shaped as participant questions and answers.

Preferred block types:

- `faq`
- `table`
- `callout`

## Member Sections

Member sections should read more like product documentation than FAQ.

Preferred block types:

- `feature-list`
- `steps`
- `callout`
- `faq` only when the information is naturally question-driven

## Stay Sections

Stay sections should mix product explanation with policy explanation.

Preferred block types:

- `feature-list`
- `steps`
- `callout`
- `checklist`

## Visa Section

The visa section should emphasize the self-service flow and its limitations.

Preferred block types:

- `steps`
- `feature-list`
- `callout`

## Page Structure

## Hero

The top of the page should contain:

- a broader title than the current event-only guide title
- a subtitle explaining that the page combines event participation information, member features, partner stay, and visa support documents

Recommended copy direction:

- zh: `完整指南` or `參與指南`
- en: `Complete Guide` or `Festival Guide`

The final copy should signal that the page now covers more than event FAQ.

## Entry Cards

Immediately below the hero:

- card 1: Event Guide
- card 2: Member Guide

Each card includes:

- short label
- one-sentence description
- anchor target id

Stay and Visa do not need their own hero cards because they are subdomains of the broader product and will already appear in the sticky nav.

## Sticky Quick Navigation

The quick nav should:

- remain visible while scrolling
- be horizontally scrollable on mobile
- group links by `Event`, `Member`, `Stay`, and `Visa`
- behave like anchor navigation, not tabs

It should not swap content panels. Its only job is to help readers jump around the long page.

## Section Rendering

Each guide section should render:

- group label / eyebrow
- title
- short intro
- one or more structured content blocks

Section ids must match URL hashes exactly so homepage links and future internal links remain stable.

## Limitations Rendering

The limitations area should be visually distinct from the main guide body. It should use warning-style cards or clearly separated note blocks, each with:

- title
- short explanation

This keeps the page honest without turning the whole guide into a bug list.

## Deep Link Rules

The old `/guide#tab-id` behavior should be replaced with section-based anchors.

Examples:

- `/guide#event-guide`
- `/guide#event-tickets`
- `/guide#member-guide`
- `/guide#member-basics`
- `/guide#member-profile-card`
- `/guide#stay-booking`
- `/guide#visa-support`
- `/guide#limitations`

Behavior rules:

- loading `/guide` without a hash lands at the top
- loading `/guide#...` scrolls to the matching section if it exists
- invalid hashes should fail quietly and leave the reader at the top of the page

## Data Model

The bilingual `guideContent` object should stay in `data/guide.ts`, but the internal structure should be upgraded from tabs to sections.

Recommended structure:

```ts
export interface GuideEntryCard {
  id: string;
  label: string;
  description: string;
  targetId: string;
}

export interface GuideNavItem {
  id: string;
  label: string;
}

export interface GuideNavGroup {
  id: string;
  label: string;
  items: GuideNavItem[];
}

export type GuideBlock =
  | { type: 'faq'; items: { question: string; answer: string }[] }
  | { type: 'feature-list'; items: { title: string; body: string }[] }
  | { type: 'steps'; items: { title: string; body: string }[] }
  | { type: 'table'; columns: string[]; rows: string[][] }
  | { type: 'callout'; tone: 'info' | 'warning'; title?: string; body: string }
  | { type: 'checklist'; items: string[] };

export interface GuideSection {
  id: string;
  group: 'event' | 'member' | 'stay' | 'visa';
  label: string;
  title: string;
  intro?: string;
  blocks: GuideBlock[];
}

export interface GuideLimitationItem {
  title: string;
  body: string;
}

export interface HomeFAQItem {
  question: string;
  summary: string;
  guideSection: string;
}

export interface GuideContent {
  pageTitle: string;
  pageDescription: string;
  entryCards: GuideEntryCard[];
  navGroups: GuideNavGroup[];
  sections: GuideSection[];
  limitations: {
    title: string;
    items: GuideLimitationItem[];
  };
  homeFaqTitle: string;
  homeFaqCta: string;
  homeFaq: HomeFAQItem[];
}
```

## Why This Model

- It keeps content in-source and bilingual, matching current repo conventions.
- It avoids `dangerouslySetInnerHTML` for most of the new content.
- It supports both FAQ content and product-guide content without forcing everything into one format.
- It gives the renderer enough structure to produce consistent section layouts.

## Existing Content Migration

The current `tabs` data should be migrated into the new `sections` structure instead of preserved as a compatibility layer.

Mapping guidance:

- current `tickets` tab → `event-tickets`
- current `registration` tab → `event-registration`
- current `accommodation` tab → `event-accommodation`
- current `transportation` tab → `event-transportation`
- current `hualien` tab → `event-hualien`
- current `speakers` tab → `event-speakers`
- current `visa` tab → `event-visa-contact`

New sections should be authored directly from current product behavior and recent codebase additions, not inferred from marketing copy alone.

## Feature Coverage Requirements

The unified guide must explicitly include all of the following capability areas.

## Existing Member-System Features

- email verification login and logout on `/me`
- dashboard-style member homepage
- tiered identity card
- editable profile card
- public/private toggle
- QR-based private sharing
- public member directory and profile pages
- collections
- upcoming/past events
- grouped orders and order detail pages
- self-service order transfer
- email preference management
- self-service upgrade flow, described conservatively

## Newly Added Stay Features

Based on the commits merged during the most recent eight-hour window, the guide must cover:

- public `/stay` landing page
- room details and remaining-room visibility
- single-occupancy-only booking rules
- week-based booking flow
- Stripe SetupIntent card guarantee path
- invite-code complimentary path
- member stay summary on `/me`
- underlying waitlist and transfer flows, described without overstating the current member UI
- admin support tooling as operational context only, not as reader-facing guidance

## Newly Added Visa Features

The guide must cover:

- `/me` visa support document section
- editable visa profile data
- country dropdown input improvements
- formal PDF support-letter generation
- paid-order-based eligibility snapshot logic
- rate-limited letter download behavior

## Limitations and Boundary Statements

The end-of-page limitations section must include at least these items.

### Member Profile Editing Gap

`languages` and `timezone` are supported in storage and APIs, and appear on public member pages, but the `/me` front-end editor does not currently expose controls for editing them.

### Weekly Backer Upgrade Gap

The self-service upgrade flow does not currently collect `target_week`, even though the backend requires it for upgrading to `weekly_backer`. The guide must not describe that path as complete.

### Nomad Award Scope Boundary

`Nomad Award` is not a member-only capability. It relies on email, newsletter subscription, and reCAPTCHA, not the `/me` session, so it should not be presented as part of the member product.

### Stay Front-End Maturity Boundary

The partner stay system has substantial backend, booking, waitlist, transfer, reconcile, and admin support in place, but some member-facing management and transfer acceptance UI remains lightweight. The guide should describe current member stay management carefully.

### Visa Letter Scope Boundary

The visa PDF is a support letter, not a promise of visa approval.

## UX Rules

## Hash and Scroll Behavior

- hash links should scroll to matching sections
- quick nav should update location hash when clicked
- unknown hashes should not throw errors

## Accordion Usage

- event FAQ blocks may use accordions
- member, stay, and visa sections should generally render expanded blocks for easier reading

## Homepage FAQ Behavior

The homepage FAQ section should remain event-oriented for now. It should continue to show a small set of event questions, but its links should be updated from old tab hashes to new section hashes.

This avoids turning the homepage into a full-site feature index while still keeping guide links accurate.

## Impacted Files

Expected files to change in implementation:

- `app/guide/page.tsx`
- `data/guide.ts`
- `components/sections/FAQSection.tsx`

Possible new guide-specific components:

- `components/guide/GuideHero.tsx`
- `components/guide/GuideQuickNav.tsx`
- `components/guide/GuideSectionRenderer.tsx`
- `components/guide/GuideBlockRenderer.tsx`
- `components/guide/GuideLimitationsSection.tsx`

Implementation may keep everything inside `app/guide/page.tsx` if the file stays readable, but guide-specific components are preferred if the page becomes too large.

## Verification Strategy

Implementation should be verified with:

- `npm run lint`
- manual validation of `/guide` in both languages
- manual validation of section anchor behavior
- manual validation of homepage FAQ links into the new section ids

Manual checks should include:

- hero entry cards scroll correctly
- sticky nav works on desktop and mobile
- content reads correctly in zh and en
- newly added stay and visa capabilities appear in the guide
- limitations do not overstate incomplete flows

## Success Criteria

The redesign is successful when:

- `/guide` becomes a coherent long-form guide instead of a tabbed FAQ page
- all currently relevant event, member, stay, and visa capabilities are represented
- known gaps are clearly disclosed without overwhelming the main flow
- homepage FAQ links still lead to useful guide destinations
- the page remains readable and navigable on mobile and desktop
