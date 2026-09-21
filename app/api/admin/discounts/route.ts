import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';

interface OrderRow {
  id: string;
  ticket_tier: string;
  status: string;
  amount_total: number | null;
  amount_subtotal: number | null;
  amount_discount: number | null;
  amount_refunded: number | null;
  currency: string | null;
  discount_code: string | null;
  created_at: string;
}

interface TierBreakdown {
  explore: number;
  contribute: number;
  weekly_backer: number;
  backer: number;
}

interface DiscountStats {
  code: string;
  uses: number;
  paid_uses: number;
  total_discount: number;
  net_revenue: number;
  gross_revenue: number;
  refunded: number;
  avg_discount: number;
  discount_rate: number;
  first_used_at: string | null;
  last_used_at: string | null;
  currency: string;
  tier_breakdown: TierBreakdown;
}

const PAID_STATUSES = new Set(['paid', 'refunded', 'partially_refunded']);

export async function GET(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');

  let query = supabaseServer
    .from('orders')
    .select(
      'id, ticket_tier, status, amount_total, amount_subtotal, amount_discount, amount_refunded, currency, discount_code, created_at'
    )
    .not('discount_code', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5000);

  if (fromParam) query = query.gte('created_at', fromParam);
  if (toParam) query = query.lte('created_at', toParam);

  const { data, error } = await query;
  if (error) {
    console.error('[Admin Discounts]', error);
    return NextResponse.json({ error: 'Failed to fetch discount usage' }, { status: 500 });
  }

  const rows = (data || []) as OrderRow[];
  const byCode = new Map<string, DiscountStats>();

  for (const row of rows) {
    const code = row.discount_code;
    if (!code) continue;

    const existing =
      byCode.get(code) ||
      ({
        code,
        uses: 0,
        paid_uses: 0,
        total_discount: 0,
        net_revenue: 0,
        gross_revenue: 0,
        refunded: 0,
        avg_discount: 0,
        discount_rate: 0,
        first_used_at: null,
        last_used_at: null,
        currency: row.currency || 'usd',
        tier_breakdown: { explore: 0, contribute: 0, weekly_backer: 0, backer: 0 },
      } satisfies DiscountStats);

    existing.uses += 1;
    if (PAID_STATUSES.has(row.status)) {
      existing.paid_uses += 1;
      existing.total_discount += row.amount_discount || 0;
      existing.gross_revenue += row.amount_total || 0;
      existing.refunded += row.amount_refunded || 0;
      existing.net_revenue += (row.amount_total || 0) - (row.amount_refunded || 0);
      const tier = row.ticket_tier as keyof TierBreakdown;
      if (tier in existing.tier_breakdown) {
        existing.tier_breakdown[tier] += 1;
      }
    }

    if (!existing.first_used_at || row.created_at < existing.first_used_at) {
      existing.first_used_at = row.created_at;
    }
    if (!existing.last_used_at || row.created_at > existing.last_used_at) {
      existing.last_used_at = row.created_at;
    }

    byCode.set(code, existing);
  }

  const discounts = Array.from(byCode.values()).map((d) => {
    const avg = d.paid_uses > 0 ? d.total_discount / d.paid_uses : 0;
    const subtotal = d.gross_revenue + d.total_discount; // gross_revenue already excludes discount
    const rate = subtotal > 0 ? d.total_discount / subtotal : 0;
    return { ...d, avg_discount: avg, discount_rate: rate };
  });

  discounts.sort((a, b) => b.paid_uses - a.paid_uses || b.total_discount - a.total_discount);

  const totals = discounts.reduce(
    (acc, d) => ({
      codes: acc.codes + 1,
      uses: acc.uses + d.uses,
      paid_uses: acc.paid_uses + d.paid_uses,
      total_discount: acc.total_discount + d.total_discount,
      net_revenue: acc.net_revenue + d.net_revenue,
    }),
    { codes: 0, uses: 0, paid_uses: 0, total_discount: 0, net_revenue: 0 }
  );

  return NextResponse.json({ discounts, totals });
}
