import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';
import { editOrder, OrderActionError } from '@/lib/orderActions';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'DB not configured' }, { status: 500 });

  const { id } = await params;

  const [orderRes, actionsRes] = await Promise.all([
    supabaseServer.from('orders').select('*').eq('id', id).maybeSingle(),
    supabaseServer.from('order_actions').select('*').eq('order_id', id).order('created_at', { ascending: false }),
  ]);

  if (orderRes.error || !orderRes.data) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  return NextResponse.json({
    order: orderRes.data,
    actions: actionsRes.data ?? [],
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  try {
    const order = await editOrder(
      id,
      { customer_name: body.customer_name, customer_email: body.customer_email },
      session.email,
    );
    return NextResponse.json({ order });
  } catch (err) {
    if (err instanceof OrderActionError) {
      return NextResponse.json({ error: err.message, stripe_code: err.stripeCode }, { status: err.httpStatus });
    }
    console.error('[PATCH order]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
