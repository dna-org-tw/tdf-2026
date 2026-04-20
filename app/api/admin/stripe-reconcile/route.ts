import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { runReconcile } from '@/lib/stripeReconcile';

export async function GET(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const force = req.nextUrl.searchParams.get('force') === '1';
  try {
    const result = await runReconcile({ force });
    return NextResponse.json(result);
  } catch (err) {
    console.error('[Reconcile Route] Unexpected error:', err);
    return NextResponse.json({ error: 'Reconciliation failed' }, { status: 500 });
  }
}
