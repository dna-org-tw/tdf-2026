import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { saveNote, OrderActionError } from '@/lib/orderActions';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (typeof body.internal_notes !== 'string') {
    return NextResponse.json({ error: 'internal_notes must be a string' }, { status: 400 });
  }

  try {
    const order = await saveNote(id, body.internal_notes, session.email);
    return NextResponse.json({ order });
  } catch (err) {
    if (err instanceof OrderActionError) {
      return NextResponse.json({ error: err.message, stripe_code: err.stripeCode }, { status: err.httpStatus });
    }
    console.error('[POST notes]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
