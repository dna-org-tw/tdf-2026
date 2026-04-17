# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Taiwan Digital Fest 2026 (TDF 2026) — official website for a month-long digital nomad festival (May 2026, Taitung & Hualien, Taiwan). Bilingual (zh-TW / en) event site with ticketing, event calendar, accommodation map, newsletter, and an Instagram Reels voting system (Nomad Award).

## Commands

- `npm run dev` — Start dev server (Turbopack)
- `npm run build` — Production build
- `npm run lint` — ESLint (flat config, Next.js core-web-vitals + TypeScript rules)
- `npm run analyze` — Bundle analysis (`ANALYZE=true next build`)
- `npm run e2e` — Playwright end-to-end tests (auto-starts dev server on `$PLAYWRIGHT_PORT`, default 3100)
- `npm run e2e:ui` — Playwright UI mode

## Development workflow

### Worktrees

Feature work happens in `.worktrees/<name>/` (gitignored). Use `scripts/worktree-dev.sh <name> [base-branch]` to create a new worktree with `.env.local` copied and deps installed:

```bash
scripts/worktree-dev.sh avatar-hero           # branches from main
scripts/worktree-dev.sh fix-foo origin/develop
```

### UI verification rules (strict)

UI changes need a human-in-the-loop check, but not every route can be driven by a bot.

- **Public routes** (`/`, `/award`, `/members/[memberNo]`, etc.): Claude may run Playwright, take screenshots, and self-verify design, RWD, JS console errors.
- **Authenticated routes** (`/me`, `/admin`, `/order/[id]`): **Claude must not** insert Supabase auth tokens, mock sessions, or mutate prod DB rows to bypass auth. The only path is `/api/auth/dev-signin` (see below). If that isn't wired up for the current task, hand off: run `tsc --noEmit`, `npm run lint`, start the dev server, give the user the URL to open in their own Chrome where they're already logged in.
- **5-step circuit breaker**: If live-preview verification takes more than 5 tool calls from "start dev server" to "see the change", stop. Commit what's ready, surface the blocker, let the user choose: test in their own Chrome, or debug root cause.

### E2E auth (Playwright)

Playwright's `auth.setup.ts` project logs in once via `POST /api/auth/dev-signin` and saves cookies to `.auth/session.json` (gitignored). All authenticated specs reuse that storage state.

`/api/auth/dev-signin` is triple-gated:
1. Returns 404 if `NODE_ENV === 'production'`
2. Returns 404 if `DEV_SIGNIN_SECRET` env var is unset
3. Returns 404 unless request header `x-dev-signin-secret` matches
4. Email must be in the in-code allowlist (`ALLOWED_EMAILS` in the route file)

To run E2E locally: set `DEV_SIGNIN_SECRET=<anything>` in `.env.local`, then `npm run e2e`. Never set this var in `.env.production*`.

### Test data

For manual dev, the only Supabase-facing test account is `kk@dna.org.tw`. Don't modify other users' rows, don't insert rows to bypass auth (use `dev-signin` instead), and clean up anything you do create.

## Screenshots

All E2E / review screenshots (Playwright, browser automation, manual captures) must be saved under `.screenshots/<YYYY-MM-DD>/`. This directory is gitignored — never place screenshots in the repo root or commit them.

## Tech Stack

- **Next.js 16** (App Router, standalone output, ISR with `revalidate`)
- **React 19**, **TypeScript 5** (strict mode)
- **Tailwind CSS 4** (via `@tailwindcss/postcss`)
- **Framer Motion** for animations
- **Supabase** for database (server-side client using service role key)
- **Stripe** for checkout/payments
- **Mailgun** for email (newsletter, transactional)
- **Leaflet / React Leaflet** for interactive maps
- **reCAPTCHA Enterprise** for bot protection

## Architecture

### Routing & Pages

Next.js App Router. Pages: `/` (home), `/award`, `/checkout`, `/order`, `/newsletter/unsubscribe`, `/code-of-conduct`.

The home page (`app/page.tsx`) uses ISR (1hr revalidate) and renders `HomeContent`, which dynamically imports below-the-fold sections for code splitting.

### i18n / Localization

Language is **not** path-based. Middleware (`middleware.ts`) redirects `/zh/*` and `/en/*` to `/?lang=...` and sets an `x-lang` header + cookie. Client-side: `useTranslation()` hook reads `?lang=` search param, falls back to browser language detection. All copy lives in `data/content.ts` as a `{ en, zh }` object.

### Data Flow — Luma Events

Event/speaker data comes from the Luma API, fetched via internal API routes (`/api/luma-data`, `/api/luma-schedule`, `/api/luma-speakers`, `/api/luma-events`, `/api/luma-partners`). `LumaDataContext` (React Context) provides events and speakers to client components, fetched once on mount from `/api/luma-data`.

### API Routes (`app/api/`)

- **checkout/** — Stripe checkout session creation and retrieval
- **webhooks/** — Stripe webhook handler
- **order/** — Order lookup (by session ID or email)
- **newsletter/** — Email subscription with reCAPTCHA verification
- **email/send** — Transactional email via Mailgun
- **award/** — Instagram Reels contest: fetch posts, vote, confirm vote, check follow status
- **events/track** — Server-side event tracking (Meta Pixel)
- **visitors/** — Visitor fingerprinting and storage
- **luma-*/** — Proxy routes for Luma calendar API

### Supabase

Server-only client (`lib/supabaseServer.ts`) using service role key. Tables: subscriptions, orders, email_logs, visitors, award-related tables. Migrations in `supabase/migrations/`.

### Component Organization

- `components/sections/` — Home page sections (Hero, About, Events, Tickets, Accommodation, Team, FollowUs)
- `components/award/` — Award page components (voting UI, post cards, modals)
- `components/` — Shared components (Navbar, Footer, modals, tracking scripts)

### Path Aliases

`@/*` maps to project root (e.g., `@/components/...`, `@/lib/...`).

### Key Patterns

- Below-the-fold sections use `dynamic()` imports with loading skeletons
- Hooks in `hooks/`: `useTranslation`, `useRecaptcha`, `useScrollDepth`, `useSectionTracking`
- Client components marked with `'use client'`; server components are the default
- Fonts: Inter, Outfit, Noto Sans TC (loaded via `next/font/google` with `swap` display)
