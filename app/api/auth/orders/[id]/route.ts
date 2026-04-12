import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { getSessionFromRequest } from '@/lib/auth';

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

    // Verify the order belongs to the authenticated user
    if (order.customer_email?.toLowerCase() !== session.email.toLowerCase()) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (error) {
    console.error('[Auth/Orders] Error fetching order detail:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
