import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { getSessionFromRequest } from '@/lib/auth';
import { checkUserTransferEligibility } from '@/lib/orderTransfer';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!supabaseServer) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const { data: order, error } = await supabaseServer
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.customer_email?.toLowerCase() !== session.email.toLowerCase()) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const transfer = await checkUserTransferEligibility(order);

    // History rows the signed-in user is a party to (sender or recipient).
    const sessionEmail = session.email.toLowerCase();
    const { data: transfersRaw } = await supabaseServer
      .from('order_transfers')
      .select('id, from_email, to_email, initiated_by, transferred_at, parent_transfer_id')
      .eq('order_id', id)
      .order('transferred_at', { ascending: false });
    const transfers = (transfersRaw ?? []).filter(
      (t) =>
        t.from_email?.toLowerCase() === sessionEmail ||
        t.to_email?.toLowerCase() === sessionEmail,
    );

    return NextResponse.json({ order, transfer, transfers });
  } catch (error) {
    console.error('[Auth/Orders] Error fetching order detail:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
