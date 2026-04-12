import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';

interface ContactRow {
  customer_email: string;
  customer_name: string | null;
  customer_phone: string | null;
  order_count: number;
  total_spent: number;
  currency: string;
  highest_tier: string;
  last_order_at: string;
}

const TIER_RANK: Record<string, number> = {
  explore: 1,
  contribute: 2,
  weekly_backer: 3,
  backer: 4,
};

export async function GET(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search')?.trim() || '';
  const tier = searchParams.get('tier') || '';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));

  try {
    // Fetch all paid orders to aggregate by customer
    let query = supabaseServer
      .from('orders')
      .select('customer_email, customer_name, customer_phone, ticket_tier, amount_total, currency, created_at')
      .eq('status', 'paid')
      .not('customer_email', 'is', null);

    if (search) {
      query = query.or(`customer_email.ilike.%${search}%,customer_name.ilike.%${search}%`);
    }

    const { data: orders, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('[Admin Contacts]', error);
      return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 });
    }

    // Aggregate by email
    const contactMap = new Map<string, ContactRow>();

    for (const o of orders || []) {
      if (!o.customer_email) continue;
      const email = o.customer_email.toLowerCase();
      const existing = contactMap.get(email);

      if (existing) {
        existing.order_count += 1;
        existing.total_spent += o.amount_total || 0;
        // Keep the most recent name/phone
        if (!existing.customer_name && o.customer_name) {
          existing.customer_name = o.customer_name;
        }
        if (!existing.customer_phone && o.customer_phone) {
          existing.customer_phone = o.customer_phone;
        }
        // Track highest tier
        if ((TIER_RANK[o.ticket_tier] || 0) > (TIER_RANK[existing.highest_tier] || 0)) {
          existing.highest_tier = o.ticket_tier;
        }
        // Track latest order
        if (o.created_at > existing.last_order_at) {
          existing.last_order_at = o.created_at;
        }
      } else {
        contactMap.set(email, {
          customer_email: o.customer_email,
          customer_name: o.customer_name,
          customer_phone: o.customer_phone,
          order_count: 1,
          total_spent: o.amount_total || 0,
          currency: o.currency || 'usd',
          highest_tier: o.ticket_tier,
          last_order_at: o.created_at,
        });
      }
    }

    let contacts = Array.from(contactMap.values());

    // Filter by tier after aggregation
    if (tier) {
      contacts = contacts.filter((c) => c.highest_tier === tier);
    }

    // Sort by last order date descending
    contacts.sort((a, b) => b.last_order_at.localeCompare(a.last_order_at));

    const total = contacts.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paged = contacts.slice(offset, offset + limit);

    return NextResponse.json({
      contacts: paged,
      total,
      page,
      limit,
      totalPages,
    });
  } catch (error) {
    console.error('[Admin Contacts]', error);
    return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 });
  }
}
