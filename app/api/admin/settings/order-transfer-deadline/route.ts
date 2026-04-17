import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import {
  getTransferDeadlineRaw,
  setTransferDeadline,
  OrderTransferError,
} from '@/lib/orderTransfer';

export async function GET(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const value = await getTransferDeadlineRaw();
  return NextResponse.json({ value });
}

export async function PATCH(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const value = typeof body.value === 'string' ? body.value : '';

  if (!value) {
    return NextResponse.json({ error: 'value required' }, { status: 400 });
  }

  try {
    const saved = await setTransferDeadline(value, session.email);
    return NextResponse.json({ value: saved });
  } catch (err) {
    if (err instanceof OrderTransferError) {
      return NextResponse.json({ error: err.message }, { status: err.httpStatus });
    }
    console.error('[PATCH settings/order-transfer-deadline]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
