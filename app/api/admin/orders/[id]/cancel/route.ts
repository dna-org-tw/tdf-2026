import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { cancelOrder, OrderActionError } from '@/lib/orderActions';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const order = await cancelOrder(id, session.email);
    return NextResponse.json({ order });
  } catch (err) {
    if (err instanceof OrderActionError) {
      return NextResponse.json({ error: err.message, stripe_code: err.stripeCode }, { status: err.httpStatus });
    }
    console.error('[POST cancel]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
