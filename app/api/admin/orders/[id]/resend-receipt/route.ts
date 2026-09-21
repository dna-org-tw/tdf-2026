import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { resendReceipt, OrderActionError } from '@/lib/orderActions';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    await resendReceipt(id, session.email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof OrderActionError) {
      return NextResponse.json({ error: err.message, stripe_code: err.stripeCode }, { status: err.httpStatus });
    }
    console.error('[POST resend-receipt]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
