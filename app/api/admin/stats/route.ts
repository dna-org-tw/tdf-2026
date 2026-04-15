import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';

type OrderRow = {
  id: string;
  amount_total: number | string | null;
  currency: string | null;
  ticket_tier: 'explore' | 'contribute' | 'weekly_backer' | 'backer';
  status: string;
  customer_email: string | null;
  customer_name: string | null;
  created_at: string;
  parent_order_id: string | null;
};

type SubRow = {
  email: string;
  created_at: string;
  unsubscribed_at: string | null;
  pref_newsletter: boolean;
  pref_events: boolean;
  pref_award: boolean;
};

type EmailLogRow = {
  status: 'sent' | 'failed';
  created_at: string;
};

const TIER_GROUPS = {
  explore: ['explore'] as const,
  contribute: ['contribute'] as const,
  backer: ['backer', 'weekly_backer'] as const,
};

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  try {
    const [{ data: orders }, { data: subs }, { data: emailLogs }] = await Promise.all([
      supabaseServer
        .from('orders')
        .select(
          'id, amount_total, currency, ticket_tier, status, customer_email, customer_name, created_at, parent_order_id'
        )
        .limit(50000),
      supabaseServer
        .from('newsletter_subscriptions')
        .select('email, created_at, unsubscribed_at, pref_newsletter, pref_events, pref_award')
        .limit(50000),
      supabaseServer
        .from('email_logs')
        .select('status, created_at')
        .gte('created_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
        .limit(20000),
    ]);

    const O = (orders || []) as OrderRow[];
    const S = (subs || []) as SubRow[];
    const E = (emailLogs || []) as EmailLogRow[];

    const paid = O.filter((o) => o.status === 'paid');

    // ---- Tier counts (paid vs complimentary) ----
    const tierStats: Record<'explore' | 'contribute' | 'backer', { paid: number; comp: number; total: number }> = {
      explore: { paid: 0, comp: 0, total: 0 },
      contribute: { paid: 0, comp: 0, total: 0 },
      backer: { paid: 0, comp: 0, total: 0 },
    };
    for (const o of paid) {
      let group: keyof typeof tierStats | null = null;
      if (TIER_GROUPS.explore.includes(o.ticket_tier as 'explore')) group = 'explore';
      else if (TIER_GROUPS.contribute.includes(o.ticket_tier as 'contribute')) group = 'contribute';
      else if ((TIER_GROUPS.backer as readonly string[]).includes(o.ticket_tier)) group = 'backer';
      if (!group) continue;
      const isComp = Number(o.amount_total || 0) === 0;
      if (isComp) tierStats[group].comp += 1;
      else tierStats[group].paid += 1;
      tierStats[group].total += 1;
    }

    // ---- Unique emails (union orders + subscriptions) ----
    const emailSet = new Set<string>();
    for (const o of O) if (o.customer_email) emailSet.add(o.customer_email.toLowerCase());
    for (const s of S) if (s.email) emailSet.add(s.email.toLowerCase());

    // ---- Revenue ----
    const totalRevenue = paid.reduce((sum, o) => sum + Number(o.amount_total || 0), 0);
    const currency = paid[0]?.currency || 'usd';

    const now = Date.now();
    const d7 = 7 * 24 * 60 * 60 * 1000;
    const last7Revenue = paid
      .filter((o) => now - new Date(o.created_at).getTime() < d7)
      .reduce((sum, o) => sum + Number(o.amount_total || 0), 0);
    const prev7Revenue = paid
      .filter((o) => {
        const t = now - new Date(o.created_at).getTime();
        return t >= d7 && t < 2 * d7;
      })
      .reduce((sum, o) => sum + Number(o.amount_total || 0), 0);

    // ---- 14-day trend (orders + subscriptions per day) ----
    const days: string[] = [];
    for (let i = 13; i >= 0; i--) {
      days.push(ymd(new Date(now - i * 24 * 60 * 60 * 1000)));
    }
    const ordersByDay: Record<string, number> = Object.fromEntries(days.map((d) => [d, 0]));
    const subsByDay: Record<string, number> = Object.fromEntries(days.map((d) => [d, 0]));
    for (const o of paid) {
      const d = ymd(new Date(o.created_at));
      if (d in ordersByDay) ordersByDay[d] += 1;
    }
    for (const s of S) {
      const d = ymd(new Date(s.created_at));
      if (d in subsByDay) subsByDay[d] += 1;
    }
    const trend = days.map((d) => ({ date: d, orders: ordersByDay[d], subs: subsByDay[d] }));

    // ---- Subscription preferences ----
    const activeSubs = S.filter((s) => !s.unsubscribed_at);
    const prefs = {
      active: activeSubs.length,
      unsubscribed: S.length - activeSubs.length,
      newsletter: activeSubs.filter((s) => s.pref_newsletter).length,
      events: activeSubs.filter((s) => s.pref_events).length,
      award: activeSubs.filter((s) => s.pref_award).length,
    };

    // ---- Action list (needs attention) ----
    const oneHourAgo = now - 60 * 60 * 1000;
    const sevenDaysAgo = now - d7;
    const pendingStale = O.filter(
      (o) => o.status === 'pending' && new Date(o.created_at).getTime() < oneHourAgo
    ).length;
    const failed = O.filter((o) => o.status === 'failed').length;
    const expired = O.filter((o) => o.status === 'expired').length;
    const refunded = O.filter((o) => o.status === 'refunded').length;
    const recentUnsubs = S.filter(
      (s) => s.unsubscribed_at && new Date(s.unsubscribed_at).getTime() > sevenDaysAgo
    ).length;
    const recentEmailFailures = E.filter((e) => e.status === 'failed').length;

    // ---- Tier × Status matrix (all orders) ----
    const matrixTiers = ['explore', 'contribute', 'weekly_backer', 'backer'] as const;
    const matrixStatuses = ['paid', 'pending', 'failed', 'expired', 'cancelled', 'refunded'] as const;
    const matrix: Record<string, Record<string, number>> = {};
    for (const t of matrixTiers) {
      matrix[t] = Object.fromEntries(matrixStatuses.map((s) => [s, 0])) as Record<string, number>;
    }
    for (const o of O) {
      if (matrix[o.ticket_tier] && o.status in matrix[o.ticket_tier]) {
        matrix[o.ticket_tier][o.status] += 1;
      }
    }

    // ---- Recent activity feed ----
    type Activity =
      | { kind: 'order'; at: string; email: string | null; name: string | null; tier: string; amount: number; isComp: boolean; upgrade: boolean }
      | { kind: 'sub'; at: string; email: string }
      | { kind: 'unsub'; at: string; email: string };

    const activities: Activity[] = [];
    for (const o of paid.slice(0, 500)) {
      activities.push({
        kind: 'order',
        at: o.created_at,
        email: o.customer_email,
        name: o.customer_name,
        tier: o.ticket_tier,
        amount: Number(o.amount_total || 0),
        isComp: Number(o.amount_total || 0) === 0,
        upgrade: Boolean(o.parent_order_id),
      });
    }
    for (const s of S.slice(0, 500)) {
      activities.push({ kind: 'sub', at: s.created_at, email: s.email });
      if (s.unsubscribed_at) {
        activities.push({ kind: 'unsub', at: s.unsubscribed_at, email: s.email });
      }
    }
    activities.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    const recentActivity = activities.slice(0, 12);

    return NextResponse.json({
      uniqueEmails: emailSet.size,
      tiers: tierStats,
      revenue: {
        total: totalRevenue,
        currency,
        last7: last7Revenue,
        prev7: prev7Revenue,
        paidCount: paid.length,
        avgOrder: paid.length > 0 ? Math.round(totalRevenue / paid.length) : 0,
      },
      trend,
      prefs,
      attention: {
        pendingStale,
        failed,
        expired,
        refunded,
        recentUnsubs,
        recentEmailFailures,
      },
      matrix,
      recentActivity,
      subscribers: { total: S.length, active: activeSubs.length },
      orders: { total: O.length, paid: paid.length },
    });
  } catch (error) {
    console.error('[Admin Stats]', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
