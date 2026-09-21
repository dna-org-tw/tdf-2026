import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { upgradeOrder, OrderActionError } from '@/lib/orderActions';

const VALID_TIERS = ['explore', 'contribute', 'weekly_backer', 'backer'] as const;
const VALID_WEEKS = ['week1', 'week2', 'week3', 'week4'] as const;
const VALID_MODES = ['comp', 'invoice'] as const;

type Tier = (typeof VALID_TIERS)[number];
type Week = (typeof VALID_WEEKS)[number];
type Mode = (typeof VALID_MODES)[number];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  if (!VALID_TIERS.includes(body.target_tier)) {
    return NextResponse.json({ error: 'invalid target_tier' }, { status: 400 });
  }
  if (!VALID_MODES.includes(body.mode)) {
    return NextResponse.json({ error: 'invalid mode' }, { status: 400 });
  }
  if (body.target_tier === 'weekly_backer' && !VALID_WEEKS.includes(body.target_week)) {
    return NextResponse.json({ error: 'target_week required for weekly_backer' }, { status: 400 });
  }
  if (body.mode === 'invoice') {
    const amt = Number(body.amount_cents);
    if (!Number.isFinite(amt) || amt <= 0) {
      return NextResponse.json({ error: 'amount_cents > 0 required for invoice mode' }, { status: 400 });
    }
  }

  try {
    const result = await upgradeOrder(
      id,
      {
        target_tier: body.target_tier as Tier,
        target_week: body.target_week as Week | undefined,
        mode: body.mode as Mode,
        amount_cents: body.mode === 'invoice' ? Number(body.amount_cents) : undefined,
        description: typeof body.description === 'string' ? body.description : undefined,
        note: typeof body.note === 'string' ? body.note : undefined,
      },
      session.email,
    );
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof OrderActionError) {
      return NextResponse.json({ error: err.message, stripe_code: err.stripeCode }, { status: err.httpStatus });
    }
    console.error('[POST upgrade]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
