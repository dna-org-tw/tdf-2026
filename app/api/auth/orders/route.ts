import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { getSessionFromRequest } from '@/lib/auth';
import { getTransferDeadlineRaw } from '@/lib/orderTransfer';

export async function GET(req: NextRequest) {
  try {
    if (!supabaseServer) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const email = req.nextUrl.searchParams.get('email');
    if (!email || email !== session.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: orders, error } = await supabaseServer
      .from('orders')
      .select('*')
      .eq('customer_email', email)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) {
      console.error('[Auth/Orders] Failed to fetch orders:', error);
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }

    const transferDeadline = await getTransferDeadlineRaw();
    let deadlinePassed = false;
    if (transferDeadline) {
      const d = new Date(transferDeadline);
      if (!isNaN(d.getTime())) deadlinePassed = Date.now() > d.getTime();
    }

    // Outgoing transfers — orders this user used to own. Only return the
    // top-level transfer (parent_transfer_id IS NULL); child transfers are
    // implied follow-ons and would be noise for the sender's history view.
    const { data: outgoingRaw } = await supabaseServer
      .from('order_transfers')
      .select('id, order_id, from_email, to_email, initiated_by, transferred_at, parent_transfer_id')
      .ilike('from_email', email)
      .is('parent_transfer_id', null)
      .order('transferred_at', { ascending: false })
      .limit(200);

    const outgoingOrderIds = Array.from(new Set((outgoingRaw ?? []).map((t) => t.order_id)));
    let outgoingOrderMap = new Map<string, { ticket_tier: string | null; amount_total: number | null; currency: string | null }>();
    if (outgoingOrderIds.length > 0) {
      const { data: outgoingOrders } = await supabaseServer
        .from('orders')
        .select('id, ticket_tier, amount_total, currency')
        .in('id', outgoingOrderIds);
      outgoingOrderMap = new Map(
        (outgoingOrders ?? []).map((o) => [
          o.id as string,
          { ticket_tier: o.ticket_tier, amount_total: o.amount_total, currency: o.currency },
        ]),
      );
    }

    const outgoingTransfers = (outgoingRaw ?? []).map((t) => {
      const o = outgoingOrderMap.get(t.order_id);
      return {
        id: t.id,
        order_id: t.order_id,
        to_email: t.to_email,
        initiated_by: t.initiated_by,
        transferred_at: t.transferred_at,
        ticket_tier: o?.ticket_tier ?? null,
        amount_total: o?.amount_total ?? null,
        currency: o?.currency ?? null,
      };
    });

    return NextResponse.json({
      orders: orders ?? [],
      transfer_deadline: transferDeadline,
      deadline_passed: deadlinePassed,
      outgoing_transfers: outgoingTransfers,
    });
  } catch (error) {
    console.error('[Auth/Orders] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
