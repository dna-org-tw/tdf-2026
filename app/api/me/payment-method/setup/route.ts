import { NextRequest, NextResponse } from 'next/server';
import { resolveMemberFromSession } from '@/lib/memberSession';
import { createOffSessionSetupIntent } from '@/lib/stripeOffSession';

export const dynamic = 'force-dynamic';

// Create a SetupIntent for the current member. The client uses the returned
// `clientSecret` with Stripe Elements to collect card details. Once the
// SetupIntent succeeds client-side, the client POSTs to /api/me/payment-method
// with the setupIntentId so we can persist the PaymentMethod.
export async function POST(req: NextRequest) {
  const ctx = await resolveMemberFromSession(req);
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const { customer, setupIntent } = await createOffSessionSetupIntent(ctx.email);
    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id,
      customerId: customer.id,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'setup_intent_failed', detail: (err as Error).message },
      { status: 500 },
    );
  }
}
