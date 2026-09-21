import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { transferOrder, OrderTransferError } from '@/lib/orderTransfer';

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const orderId = typeof body.order_id === 'string' ? body.order_id.trim() : '';
  const newEmail = typeof body.new_email === 'string' ? body.new_email : '';

  if (!orderId) {
    return NextResponse.json({ error: 'order_id required' }, { status: 400 });
  }
  if (!newEmail) {
    return NextResponse.json({ error: 'new_email required' }, { status: 400 });
  }

  const ipAddress =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    null;
  const userAgent = req.headers.get('user-agent');

  try {
    const result = await transferOrder({
      orderId,
      newEmail,
      initiator: 'user',
      actorUserId: session.userId,
      sessionEmail: session.email,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      order_id: result.parent.id,
      child_order_ids: result.children.map((c) => c.id),
      from_email: result.fromEmail,
      to_email: result.toEmail,
      transferred_at: result.transferredAt,
    });
  } catch (err) {
    if (err instanceof OrderTransferError) {
      return NextResponse.json({ error: err.message }, { status: err.httpStatus });
    }
    console.error('[POST /api/order/transfer]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
