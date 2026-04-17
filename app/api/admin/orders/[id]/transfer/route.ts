import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { transferOrder, OrderTransferError } from '@/lib/orderTransfer';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const newEmail = typeof body.new_email === 'string' ? body.new_email : '';
  const notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null;

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
      orderId: id,
      newEmail,
      initiator: 'admin',
      actorAdminEmail: session.email,
      notes,
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
      deadline_passed: result.deadlinePassed,
    });
  } catch (err) {
    if (err instanceof OrderTransferError) {
      return NextResponse.json({ error: err.message }, { status: err.httpStatus });
    }
    console.error('[POST /api/admin/orders/:id/transfer]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
