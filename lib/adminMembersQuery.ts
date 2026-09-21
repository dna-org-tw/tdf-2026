import {
  type MemberStatus,
  type MemberTier,
  type TicketTier,
  type MemberIdentity,
  type DisplayStatus,
  MEMBER_STATUSES,
  MEMBER_TIERS,
  TICKET_TIERS,
  MEMBER_IDENTITIES,
  DISPLAY_STATUSES,
  DISPLAY_STATUS_TO_DB,
} from '@/lib/members';

export interface MemberFilter {
  search?: string;
  statuses?: MemberStatus[];
  tiers?: MemberTier[];
  ticketTiers?: TicketTier[];
  identities?: MemberIdentity[];
  displayStatuses?: DisplayStatus[];
  repeatOnly?: boolean;
}

function parseList<T extends string>(raw: string | null, allowed: readonly T[]): T[] | undefined {
  if (!raw) return undefined;
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean) as T[];
  const filtered = list.filter((v) => (allowed as readonly string[]).includes(v));
  return filtered.length ? filtered : undefined;
}

export function parseMemberFilter(searchParams: URLSearchParams): MemberFilter {
  return {
    search: searchParams.get('search')?.trim() || undefined,
    statuses: parseList<MemberStatus>(searchParams.get('status'), MEMBER_STATUSES),
    tiers: parseList<MemberTier>(searchParams.get('tier'), MEMBER_TIERS),
    ticketTiers: parseList<TicketTier>(searchParams.get('ticketTier'), TICKET_TIERS),
    identities: parseList<MemberIdentity>(searchParams.get('identity'), MEMBER_IDENTITIES),
    displayStatuses: parseList<DisplayStatus>(searchParams.get('displayStatus'), DISPLAY_STATUSES),
    repeatOnly: searchParams.get('repeat') === '1',
  };
}

function resolveIdentityFilter(identities: MemberIdentity[] | undefined): {
  ticketTiersFromIdentity?: TicketTier[];
  includeNullTier?: boolean;
} {
  if (!identities) return {};
  const tiers: TicketTier[] = [];
  let includeNullTier = false;
  for (const id of identities) {
    if (id === 'backer') tiers.push('backer', 'weekly_backer');
    else if (id === 'contributor') tiers.push('contribute');
    else if (id === 'explorer') tiers.push('explore');
    else if (id === 'follower') includeNullTier = true;
  }
  return {
    ticketTiersFromIdentity: tiers.length ? tiers : undefined,
    includeNullTier,
  };
}

function resolveDisplayStatusFilter(
  displayStatuses: DisplayStatus[] | undefined,
  statuses: MemberStatus[] | undefined
): MemberStatus[] | undefined {
  if (!displayStatuses) return statuses;
  const dbStatuses: MemberStatus[] = [];
  for (const ds of displayStatuses) {
    dbStatuses.push(...DISPLAY_STATUS_TO_DB[ds]);
  }
  return dbStatuses.length ? dbStatuses : undefined;
}

/**
 * Apply the shared member filter to a Supabase `members_enriched` query builder.
 *
 * Generic passthrough: the input builder's static type is preserved on the output,
 * so callers keep full type inference on subsequent `.order()` / `.range()` /
 * destructured `{ data, count, error }` results. Internally we cast to `any` to
 * sidestep Supabase's nested builder generics, which don't compose cleanly across
 * module boundaries.
 */
export function applyMemberFilter<T>(query: T, filter: MemberFilter): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = query;
  if (filter.search) {
    q = q.or(`email.ilike.%${filter.search}%,name.ilike.%${filter.search}%`);
  }
  const resolvedStatuses = resolveDisplayStatusFilter(filter.displayStatuses, filter.statuses);
  if (resolvedStatuses) q = q.in('status', resolvedStatuses);
  if (filter.tiers) q = q.in('tier', filter.tiers);
  if (filter.ticketTiers) q = q.in('highest_ticket_tier', filter.ticketTiers);
  const { ticketTiersFromIdentity, includeNullTier } = resolveIdentityFilter(filter.identities);
  if (ticketTiersFromIdentity && includeNullTier) {
    q = q.or(
      `highest_ticket_tier.in.(${ticketTiersFromIdentity.join(',')}),highest_ticket_tier.is.null`
    );
  } else if (ticketTiersFromIdentity) {
    q = q.in('highest_ticket_tier', ticketTiersFromIdentity);
  } else if (includeNullTier) {
    q = q.is('highest_ticket_tier', null);
  }
  if (filter.repeatOnly) q = q.gt('paid_order_count', 1);
  return q as T;
}
