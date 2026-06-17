import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// PREMISE: every statistic on this page is scoped to "email contacts" — the
// people we hold an email for. The `members` table is the canonical, email-
// keyed contact registry (≈ the union of orders/subscriptions/luma guests),
// so it defines the universe. Anonymous website traffic is intentionally NOT
// counted here.
//
// Country is attributed per contact by joining their email -> orders /
// newsletter_subscriptions.visitor_fingerprint -> visitors.country. Contacts
// without an attributable country are excluded from country breakdowns.
//
// Money is normalised to TWD. Orders/Luma payments are charged in USD (see
// app/api/checkout/route.ts -> currency: 'usd'); accommodation is already in
// whole TWD (stay_*.{price,booked_price}_twd).
// ---------------------------------------------------------------------------
const DEFAULT_DAILY_SPEND_TWD = 2500; // 餐飲＋交通＋在地體驗＋購物 推估
const DEFAULT_STAY_DAYS = 7; // fallback when no visa-profile data exists
const DEFAULT_USD_TWD = 32; // USD -> TWD conversion for ticket revenue

// Stripe/Luma amounts are stored in the smallest unit (cents); the rest of the
// admin UI divides by 100 regardless of currency, so we follow suit.
const CENTS = 100;

type OrderRow = {
  amount_total: number | string | null;
  amount_refunded: number | string | null;
  currency: string | null;
  status: string;
  created_at: string;
  customer_email: string | null;
  visitor_fingerprint: string | null;
};

type SubRow = {
  email: string | null;
  unsubscribed_at: string | null;
  visitor_fingerprint: string | null;
};

type GuestRow = {
  event_api_id: string;
  email: string;
  activity_status: string | null;
  paid: boolean;
  checked_in_at: string | null;
  registered_at: string | null;
  ticket_type_name: string | null;
  amount_cents: number | null;
  currency: string | null;
};

const ACTIVE_STATUSES = new Set(['approved', 'going']);

function num(v: number | string | null | undefined): number {
  return Number(v || 0);
}
function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}
function norm(email: string | null | undefined): string {
  return (email || '').trim().toLowerCase();
}

/** Pull every row of a table in 1000-row pages (PostgREST hard cap). */
async function fetchAll<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  build: (from: number, to: number) => any
): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await build(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    out.push(...(data as T[]));
    if (data.length < PAGE) break;
  }
  return out;
}

/**
 * Like fetchAll but fires every page concurrently after a single count probe.
 * Use for large tables (e.g. visitors) where sequential paging is the long
 * pole. Read-only analytics: a row inserted mid-scan may be missed, which is
 * acceptable here.
 */
async function fetchAllParallel<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  count: () => any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: (from: number, to: number) => any
): Promise<T[]> {
  const PAGE = 1000;
  const { count: total, error } = await count();
  if (error) throw new Error(error.message);
  const pages = Math.ceil((total ?? 0) / PAGE);
  if (pages === 0) return [];
  const results = await Promise.all(
    Array.from({ length: pages }, (_, i) => page(i * PAGE, i * PAGE + PAGE - 1))
  );
  const out: T[] = [];
  for (const r of results) {
    if (r.error) throw new Error(r.error.message);
    if (r.data) out.push(...(r.data as T[]));
  }
  return out;
}

export async function GET(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  const supa = supabaseServer;

  const { searchParams } = new URL(req.url);
  const dailySpendTwd = clampNum(searchParams.get('dailySpend'), DEFAULT_DAILY_SPEND_TWD, 0, 100000);
  const usdToTwd = clampNum(searchParams.get('usdRate'), DEFAULT_USD_TWD, 1, 100);
  const stayDaysOverride = searchParams.get('stayDays')
    ? clampNum(searchParams.get('stayDays'), DEFAULT_STAY_DAYS, 1, 365)
    : null;

  try {
    const [orders, guests, visitors, visaProfiles, profiles, bookingWeeks, memberRows, subs, awardVotesCount, awardPostsCount] =
      await Promise.all([
        fetchAll<OrderRow>((f, t) =>
          supa
            .from('orders')
            .select('amount_total, amount_refunded, currency, status, created_at, customer_email, visitor_fingerprint')
            .order('created_at', { ascending: true })
            .range(f, t)
        ),
        fetchAll<GuestRow>((f, t) =>
          supa
            .from('luma_guests')
            .select(
              'event_api_id, email, activity_status, paid, checked_in_at, registered_at, ticket_type_name, amount_cents, currency'
            )
            .order('id', { ascending: true })
            .range(f, t)
        ),
        // Only visitors that carry a country can attribute a contact; skip the
        // rest and fetch pages in parallel (this is the heaviest table).
        fetchAllParallel<{ fingerprint: string; country: string | null }>(
          () => supa.from('visitors').select('fingerprint', { count: 'exact', head: true }).not('country', 'is', null),
          (f, t) => supa.from('visitors').select('fingerprint, country').not('country', 'is', null).range(f, t)
        ),
        fetchAll<{ nationality: string | null; planned_arrival_date: string; planned_departure_date: string }>(
          (f, t) =>
            supa
              .from('member_visa_profiles')
              .select('nationality, planned_arrival_date, planned_departure_date')
              .range(f, t)
        ),
        fetchAll<{ tags: string[] | null; languages: string[] | null; location: string | null }>((f, t) =>
          supa.from('member_profiles').select('tags, languages, location').range(f, t)
        ),
        fetchAll<{ status: string; booked_price_twd: number | null }>((f, t) =>
          supa.from('stay_booking_weeks').select('status, booked_price_twd').range(f, t)
        ),
        fetchAll<{ email: string | null }>((f, t) => supa.from('members').select('email').range(f, t)),
        fetchAll<SubRow>((f, t) =>
          supa.from('newsletter_subscriptions').select('email, unsubscribed_at, visitor_fingerprint').range(f, t)
        ),
        supa.from('award_votes').select('id', { count: 'exact', head: true }).eq('confirmed', true),
        supa.from('ig_posts').select('id', { count: 'exact', head: true }),
      ]);

    // -- Country attribution: email -> country via order/sub fingerprints ---
    const fpCountry = new Map<string, string>();
    for (const v of visitors) {
      const c = v.country?.trim();
      if (v.fingerprint && c) fpCountry.set(v.fingerprint, c);
    }
    const emailCountry = new Map<string, string | null>();
    const seedEmail = (email: string | null) => {
      const e = norm(email);
      if (e && !emailCountry.has(e)) emailCountry.set(e, null);
    };
    const linkCountry = (email: string | null, fp: string | null) => {
      const e = norm(email);
      if (!e || !fp) return;
      const c = fpCountry.get(fp);
      if (c && !emailCountry.get(e)) emailCountry.set(e, c);
    };

    // -- Email-contact universe (members ≈ full union) ----------------------
    const contacts = new Set<string>();
    for (const m of memberRows) {
      const e = norm(m.email);
      if (e) contacts.add(e);
    }
    // Defensive: fold in any order/sub/guest emails not yet in members.
    for (const o of orders) {
      const e = norm(o.customer_email);
      if (e) contacts.add(e);
      seedEmail(o.customer_email);
      linkCountry(o.customer_email, o.visitor_fingerprint);
    }
    for (const s of subs) {
      const e = norm(s.email);
      if (e) contacts.add(e);
      seedEmail(s.email);
      linkCountry(s.email, s.visitor_fingerprint);
    }
    for (const g of guests) {
      const e = norm(g.email);
      if (e) contacts.add(e);
    }

    // Country breakdown across the contact universe (unknowns excluded).
    const countryMap = new Map<string, number>();
    let contactsWithCountry = 0;
    for (const e of contacts) {
      const c = emailCountry.get(e);
      if (c) {
        contactsWithCountry++;
        countryMap.set(c, (countryMap.get(c) ?? 0) + 1);
      }
    }
    const topCountries = [...countryMap.entries()]
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 14);

    // -- Economy: hard revenue ---------------------------------------------
    let ticketTwd = 0;
    for (const o of orders) {
      if (o.status !== 'paid' && o.status !== 'partially_refunded') continue;
      ticketTwd += toTwd((num(o.amount_total) - num(o.amount_refunded)) / CENTS, o.currency, usdToTwd);
    }
    const paidOrders = orders.filter((o) => o.status === 'paid');
    const avgOrderTwd = paidOrders.length
      ? Math.round(
          paidOrders.reduce((s, o) => s + toTwd(num(o.amount_total) / CENTS, o.currency, usdToTwd), 0) /
            paidOrders.length
        )
      : 0;

    let eventTicketTwd = 0;
    for (const g of guests) {
      if (!g.paid || !g.amount_cents) continue;
      eventTicketTwd += toTwd(num(g.amount_cents) / CENTS, g.currency, usdToTwd);
    }

    const STAY_REVENUE_STATUSES = new Set(['confirmed', 'modified_in', 'completed', 'no_show']);
    let accommodationTwd = 0;
    for (const bw of bookingWeeks) {
      if (STAY_REVENUE_STATUSES.has(bw.status)) accommodationTwd += num(bw.booked_price_twd);
    }

    const hardRevenueTwd = Math.round(ticketTwd + eventTicketTwd + accommodationTwd);

    // -- Participation (Luma is the source of truth) -----------------------
    const eventIds = new Set(guests.map((g) => g.event_api_id));
    const activeGuests = guests.filter((g) => ACTIVE_STATUSES.has(g.activity_status ?? ''));
    const checkedInGuests = guests.filter((g) => g.checked_in_at);
    const uniqueAttendeeEmails = new Set<string>();
    for (const g of guests) {
      if (g.checked_in_at || ACTIVE_STATUSES.has(g.activity_status ?? '')) {
        uniqueAttendeeEmails.add(norm(g.email));
      }
    }
    const uniqueAttendees = uniqueAttendeeEmails.size;
    const totalRegistrations = guests.length;
    const activeRegistrations = activeGuests.length;
    const checkedInCount = checkedInGuests.length;
    const checkInRate = activeRegistrations > 0 ? checkedInCount / activeRegistrations : 0;
    const avgEventsPerPerson = uniqueAttendees > 0 ? activeRegistrations / uniqueAttendees : 0;

    const ticketTypeMap = new Map<string, number>();
    for (const g of activeGuests) {
      const name = g.ticket_type_name?.trim() || '一般報名';
      ticketTypeMap.set(name, (ticketTypeMap.get(name) ?? 0) + 1);
    }
    const ticketTypes = [...ticketTypeMap.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const weekMap = new Map<string, number>();
    for (const g of guests) {
      if (!g.registered_at) continue;
      const d = new Date(g.registered_at);
      if (Number.isNaN(d.getTime())) continue;
      const monday = new Date(d);
      const day = (monday.getUTCDay() + 6) % 7;
      monday.setUTCDate(monday.getUTCDate() - day);
      weekMap.set(ymd(monday), (weekMap.get(ymd(monday)) ?? 0) + 1);
    }
    const registrationTrend = [...weekMap.entries()]
      .map(([week, count]) => ({ week, count }))
      .sort((a, b) => a.week.localeCompare(b.week));

    // -- Economy: local spend estimate (derived) ---------------------------
    const stayDurations: number[] = [];
    for (const v of visaProfiles) {
      const a = new Date(v.planned_arrival_date).getTime();
      const dep = new Date(v.planned_departure_date).getTime();
      if (!Number.isNaN(a) && !Number.isNaN(dep) && dep > a) {
        stayDurations.push(Math.round((dep - a) / 86400000));
      }
    }
    const visaAvgStay = stayDurations.length
      ? Math.round(stayDurations.reduce((s, d) => s + d, 0) / stayDurations.length)
      : null;
    const avgStayDays = stayDaysOverride ?? visaAvgStay ?? DEFAULT_STAY_DAYS;
    const avgStayDaysSource = stayDaysOverride ? 'override' : visaAvgStay ? 'visa' : 'default';

    const localSpendEstimateTwd = Math.round(uniqueAttendees * avgStayDays * dailySpendTwd);
    const totalImpactTwd = hardRevenueTwd + localSpendEstimateTwd;

    // -- Participant background (member profiles = email contacts) ----------
    const tagMap = new Map<string, number>();
    const langMap = new Map<string, number>();
    const locationMap = new Map<string, number>();
    let profilesWithTags = 0;
    for (const p of profiles) {
      if (p.tags && p.tags.length) {
        profilesWithTags++;
        for (const t of p.tags) {
          const k = t.trim();
          if (k) tagMap.set(k, (tagMap.get(k) ?? 0) + 1);
        }
      }
      if (p.languages) {
        for (const l of p.languages) {
          const k = l.trim();
          if (k) langMap.set(k, (langMap.get(k) ?? 0) + 1);
        }
      }
      if (p.location?.trim()) {
        locationMap.set(p.location.trim(), (locationMap.get(p.location.trim()) ?? 0) + 1);
      }
    }

    const newsletterActive = subs.filter((s) => !s.unsubscribed_at).length;

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      assumptions: {
        avgStayDays,
        avgStayDaysSource,
        visaAvgStay,
        visaProfileCount: visaProfiles.length,
        dailySpendTwd,
        usdToTwd,
      },
      contacts: {
        total: contacts.size,
        withCountry: contactsWithCountry,
        countryCount: countryMap.size,
      },
      economy: {
        hardRevenueTwd,
        ticketTwd: Math.round(ticketTwd),
        eventTicketTwd: Math.round(eventTicketTwd),
        accommodationTwd: Math.round(accommodationTwd),
        localSpendEstimateTwd,
        totalImpactTwd,
        avgOrderTwd,
        breakdown: [
          { key: 'ticket', label: '票券收入', valueTwd: Math.round(ticketTwd), estimate: false },
          { key: 'event', label: '活動票務', valueTwd: Math.round(eventTicketTwd), estimate: false },
          { key: 'stay', label: '住宿收入', valueTwd: Math.round(accommodationTwd), estimate: false },
          { key: 'local', label: '在地消費推估', valueTwd: localSpendEstimateTwd, estimate: true },
        ],
      },
      participation: {
        eventsCount: eventIds.size,
        totalRegistrations,
        activeRegistrations,
        checkedInCount,
        uniqueAttendees,
        avgEventsPerPerson: Math.round(avgEventsPerPerson * 100) / 100,
        checkInRate: Math.round(checkInRate * 1000) / 1000,
        ticketTypes,
        registrationTrend,
      },
      international: {
        contactsTotal: contacts.size,
        contactsWithCountry,
        countryCount: countryMap.size,
        topCountries,
        avgStayDays,
        visaProfileCount: visaProfiles.length,
      },
      background: {
        profileCount: profiles.length,
        profilesWithTags,
        topTags: mapTop(tagMap, 12, 'tag'),
        topLanguages: mapTop(langMap, 8, 'lang'),
        topLocations: mapTop(locationMap, 8, 'location'),
      },
      voice: {
        newsletterActive,
        awardVotes: awardVotesCount.count ?? 0,
        awardPosts: awardPostsCount.count ?? 0,
      },
      totals: { contacts: contacts.size },
    });
  } catch (error) {
    console.error('[Admin Impact]', error);
    return NextResponse.json({ error: 'Failed to compute impact' }, { status: 500 });
  }
}

function toTwd(amountMajor: number, currency: string | null, usdRate: number): number {
  const c = (currency || 'usd').toLowerCase();
  if (c === 'twd') return amountMajor;
  return amountMajor * usdRate; // orders/luma are charged in USD
}

function clampNum(raw: string | null, fallback: number, min: number, max: number): number {
  const n = raw == null ? NaN : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function mapTop<K extends string>(
  m: Map<string, number>,
  n: number,
  key: K
): Array<Record<K, string> & { count: number }> {
  return [...m.entries()]
    .map(([label, count]) => ({ [key]: label, count }) as Record<K, string> & { count: number })
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}
