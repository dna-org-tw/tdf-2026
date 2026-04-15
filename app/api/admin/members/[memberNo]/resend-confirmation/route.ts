import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';
import { resolveMember } from '@/lib/adminMembers';
import { sendOrderEmail } from '@/lib/sendOrderEmail';

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ memberNo: string }> },
) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'Database not configured' }, { status: 500 });

  const { memberNo } = await ctx.params;
  const member = await resolveMember(memberNo);
  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const orderId = String(body.orderId || '').trim();
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 });

  const { data: order, error } = await supabaseServer
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();
  if (error || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  if ((order.customer_email || '').toLowerCase().trim() !== member.email) {
    return NextResponse.json({ error: 'Order does not belong to member' }, { status: 403 });
  }
  if (order.status !== 'paid') {
    return NextResponse.json({ error: 'Order not paid' }, { status: 400 });
  }

  // Bypass sendOrderEmail's idempotency guard — admin resend is intentional.
  await supabaseServer
    .from('email_logs')
    .delete()
    .eq('email_type', 'order_success')
    .eq('status', 'sent')
    .contains('metadata', { order_id: orderId });

  const result = await sendOrderEmail(
    {
      id: order.id,
      payment_status: order.status,
      amount_total: order.amount_total,
      currency: order.currency,
      customer_email: order.customer_email,
      customer_name: order.customer_name,
      ticket_tier: order.ticket_tier,
      created: order.created_at ? Math.floor(new Date(order.created_at).getTime() / 1000) : null,
    },
    'success',
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error || 'Send failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, messageId: result.messageId });
}
