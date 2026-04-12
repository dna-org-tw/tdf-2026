import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';

export async function GET(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  try {
    // Paid orders count + total revenue
    const { data: orders } = await supabaseServer
      .from('orders')
      .select('amount_total, currency, ticket_tier, status');

    const paidOrders = (orders || []).filter((o) => o.status === 'paid');
    const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.amount_total || 0), 0);

    // Count by tier
    const tierCounts: Record<string, number> = {};
    for (const o of paidOrders) {
      tierCounts[o.ticket_tier] = (tierCounts[o.ticket_tier] || 0) + 1;
    }

    // Count by status
    const statusCounts: Record<string, number> = {};
    for (const o of orders || []) {
      statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
    }

    // Subscriber count
    const { count: subscriberCount } = await supabaseServer
      .from('newsletter_subscriptions')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      orders: {
        total: (orders || []).length,
        paid: paidOrders.length,
        totalRevenue,
        currency: paidOrders[0]?.currency || 'usd',
        byTier: tierCounts,
        byStatus: statusCounts,
      },
      subscribers: {
        total: subscriberCount || 0,
      },
    });
  } catch (error) {
    console.error('[Admin Stats]', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
