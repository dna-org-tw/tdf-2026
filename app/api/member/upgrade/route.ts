import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabaseServer';
import { upgradeOrder, OrderActionError } from '@/lib/orderActions';
import { getUpgradePriceCents } from '@/lib/ticketPricing';
import { TICKET_TIER_RANK, type TicketTier } from '@/lib/members';
import type { Order } from '@/lib/types/order';

export async function POST(req: NextRequest) {
  try {
    // 1. Auth: verify session
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse body
    const body = await req.json();
    const { order_id, target_tier, target_week } = body as {
      order_id: string;
      target_tier: TicketTier;
      target_week?: string;
    };

    if (!order_id || !target_tier) {
      return NextResponse.json({ error: 'order_id and target_tier are required' }, { status: 400 });
    }

    // 3. Fetch the order and verify ownership
    if (!supabaseServer) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const { data: order, error: orderErr } = await supabaseServer
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const typedOrder = order as Order;

    // 4. Verify the order belongs to this user
    if (typedOrder.customer_email !== session.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // 5. Verify the order is eligible for upgrade
    if (typedOrder.status !== 'paid' && typedOrder.status !== 'partially_refunded') {
      return NextResponse.json({ error: 'Only paid orders can be upgraded' }, { status: 400 });
    }
    if (typedOrder.parent_order_id) {
      return NextResponse.json({ error: 'Cannot upgrade an upgrade order' }, { status: 400 });
    }

    // 6. Validate upgrade path (target must be higher rank)
    if (!TICKET_TIER_RANK[target_tier]) {
      return NextResponse.json({ error: 'Invalid target tier' }, { status: 400 });
    }
    if (TICKET_TIER_RANK[target_tier] <= TICKET_TIER_RANK[typedOrder.ticket_tier]) {
      return NextResponse.json({ error: 'Target tier must be higher than current tier' }, { status: 400 });
    }

    // 7. Server-side price difference calculation
    const priceCents = getUpgradePriceCents(typedOrder.ticket_tier, target_tier);
    if (priceCents == null || priceCents <= 0) {
      return NextResponse.json({ error: 'Invalid upgrade price' }, { status: 400 });
    }

    // 8. Delegate to existing upgradeOrder
    const result = await upgradeOrder(order_id, {
      target_tier,
      target_week: target_week as 'week1' | 'week2' | 'week3' | 'week4' | undefined,
      mode: 'invoice',
      amount_cents: priceCents,
      description: `Self-service upgrade: ${typedOrder.ticket_tier} → ${target_tier}`,
      note: `Self-service upgrade by ${session.email}`,
    }, session.email);

    return NextResponse.json({
      success: true,
      hosted_invoice_url: result.hosted_invoice_url,
      upgrade_order_id: result.order.id,
    });
  } catch (err) {
    if (err instanceof OrderActionError) {
      return NextResponse.json({ error: err.message }, { status: err.httpStatus });
    }
    console.error('[Member/Upgrade] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
