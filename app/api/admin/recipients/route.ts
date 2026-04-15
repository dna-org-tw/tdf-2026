import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { getRecipients, type RecipientGroup } from '@/lib/recipients';
import {
  type MemberStatus,
  type MemberTier,
  type TicketTier,
  MEMBER_STATUSES,
  MEMBER_TIERS,
  TICKET_TIERS,
} from '@/lib/members';

const VALID_GROUPS: RecipientGroup[] = ['orders', 'subscribers', 'test'];

function parseList<T extends string>(raw: string | null, allowed: readonly T[]): T[] | undefined {
  if (!raw) return undefined;
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean) as T[];
  const filtered = list.filter((v) => (allowed as readonly string[]).includes(v));
  return filtered.length ? filtered : undefined;
}

export async function GET(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);

  const groupsRaw = searchParams.get('groups');
  const groups = groupsRaw
    ? (groupsRaw.split(',').filter((g): g is RecipientGroup =>
        VALID_GROUPS.includes(g as RecipientGroup)))
    : undefined;

  // Legacy `tiers` query param (meant ticket tier). New API uses `ticketTiers`.
  const legacyTicketTiers = parseList<TicketTier>(searchParams.get('tiers'), TICKET_TIERS);
  const statuses = parseList<MemberStatus>(searchParams.get('statuses'), MEMBER_STATUSES);
  const memberTiers = parseList<MemberTier>(searchParams.get('memberTiers'), MEMBER_TIERS);
  const ticketTiers = parseList<TicketTier>(searchParams.get('ticketTiers'), TICKET_TIERS);

  const VALID_CATEGORIES = ['newsletter', 'events', 'award'] as const;
  const categoryRaw = searchParams.get('category');
  const category = (VALID_CATEGORIES as readonly string[]).includes(categoryRaw ?? '')
    ? (categoryRaw as 'newsletter' | 'events' | 'award')
    : undefined;

  if (!groups && !statuses && !memberTiers && !ticketTiers) {
    return NextResponse.json(
      { error: 'At least one of groups, statuses, memberTiers, or ticketTiers is required' },
      { status: 400 },
    );
  }

  try {
    const result = await getRecipients({
      groups,
      statuses,
      memberTiers,
      ticketTiers,
      legacyTicketTiers,
      adminEmail: session.email,
      category,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Admin Recipients]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch recipients' },
      { status: 500 },
    );
  }
}
