import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { getRecipients, type RecipientGroup, type TicketTier } from '@/lib/recipients';

const VALID_GROUPS: RecipientGroup[] = ['orders', 'subscribers', 'test'];
const VALID_TIERS: TicketTier[] = ['explore', 'contribute', 'weekly_backer', 'backer'];

export async function GET(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const groupsParam = searchParams.get('groups');
  const tiersParam = searchParams.get('tiers');

  if (!groupsParam) {
    return NextResponse.json({ error: 'groups parameter is required' }, { status: 400 });
  }

  const groups = groupsParam.split(',').filter((g): g is RecipientGroup =>
    VALID_GROUPS.includes(g as RecipientGroup)
  );

  if (groups.length === 0) {
    return NextResponse.json({ error: 'At least one valid group is required' }, { status: 400 });
  }

  const tiers = tiersParam
    ? tiersParam.split(',').filter((t): t is TicketTier =>
        VALID_TIERS.includes(t as TicketTier)
      )
    : undefined;

  try {
    const result = await getRecipients(groups, tiers, session.email);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Admin Recipients]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch recipients' },
      { status: 500 }
    );
  }
}
