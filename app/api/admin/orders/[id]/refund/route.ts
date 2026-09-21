import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { refundOrder, OrderActionError } from '@/lib/orderActions';

const VALID_REASONS = ['requested_by_customer', 'duplicate', 'fraudulent'] as const;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  if (!body?.reason || !VALID_REASONS.includes(body.reason)) {
    return NextResponse.json({ error: 'Invalid reason' }, { status: 400 });
  }
  if (body.amount !== undefined && (typeof body.amount !== 'number' || body.amount <= 0)) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
  }

  try {
    const order = await refundOrder(
      id,
      { amount: body.amount, reason: body.reason, note: body.note },
      session.email,
    );
    return NextResponse.json({ order });
  } catch (err) {
    if (err instanceof OrderActionError) {
      return NextResponse.json({ error: err.message, stripe_code: err.stripeCode }, { status: err.httpStatus });
    }
    console.error('[POST refund]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
