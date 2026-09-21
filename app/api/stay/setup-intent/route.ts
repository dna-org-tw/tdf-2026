import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { createStaySetupIntent } from '@/lib/stayStripe';

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { customer, setupIntent } = await createStaySetupIntent(session.email);
  return NextResponse.json({
    customerId: customer.id,
    setupIntentId: setupIntent.id,
    clientSecret: setupIntent.client_secret,
  });
}
