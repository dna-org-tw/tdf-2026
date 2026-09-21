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

  const { searchParams } = new URL(req.url);
  const days = Math.min(90, Math.max(7, parseInt(searchParams.get('days') || '30')));

  try {
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Revenue from all paid orders before the range.
    // amount_total is BIGINT -> returned as string by supabase-js; Number() coerces for math.
    const { data: priorOrders } = await supabaseServer
      .from('orders')
      .select('amount_total')
      .eq('status', 'paid')
      .lt('created_at', since.toISOString())
      .limit(50000);

    const priorRevenue = (priorOrders || []).reduce((sum, o) => sum + Number(o.amount_total || 0), 0);

    const { data: orders, error } = await supabaseServer
      .from('orders')
      .select('amount_total, status, created_at')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: true })
      .limit(50000);

    if (error) {
      console.error('[Admin Daily]', error);
      return NextResponse.json({ error: 'Failed to fetch daily data' }, { status: 500 });
    }

    // Aggregate by date
    const dailyMap = new Map<string, { date: string; orders: number; paid: number; revenue: number }>();

    // Fill all dates in range
    for (let d = new Date(since); d <= new Date(); d.setDate(d.getDate() + 1)) {
      const key = d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }); // YYYY-MM-DD
      dailyMap.set(key, { date: key, orders: 0, paid: 0, revenue: 0 });
    }

    for (const o of orders || []) {
      const date = new Date(o.created_at).toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
      const entry = dailyMap.get(date);
      if (entry) {
        entry.orders += 1;
        if (o.status === 'paid') {
          entry.paid += 1;
          entry.revenue += Number(o.amount_total || 0);
        }
      }
    }

    const daily = Array.from(dailyMap.values());

    return NextResponse.json({ daily, priorRevenue });
  } catch (error) {
    console.error('[Admin Daily]', error);
    return NextResponse.json({ error: 'Failed to fetch daily data' }, { status: 500 });
  }
}
