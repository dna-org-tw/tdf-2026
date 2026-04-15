// lib/recipients.ts
import { supabaseServer } from '@/lib/supabaseServer';
import {
  type MemberStatus,
  type MemberTier,
  type TicketTier,
} from '@/lib/members';

// Legacy group names still accepted from the send page while it transitions.
export type RecipientGroup = 'orders' | 'subscribers' | 'test';
export type { TicketTier, MemberStatus, MemberTier };

interface RecipientsQuery {
  statuses?: MemberStatus[];
  memberTiers?: MemberTier[];
  ticketTiers?: TicketTier[];
  groups?: RecipientGroup[]; // legacy
  legacyTicketTiers?: TicketTier[]; // legacy: old `tiers` param
  adminEmail?: string;
}

interface RecipientsResult {
  emails: string[];
  count: number;
}

// Map legacy `groups` into status filters.
function groupsToStatuses(groups?: RecipientGroup[]): MemberStatus[] | undefined {
  if (!groups || !groups.length) return undefined;
  const set = new Set<MemberStatus>();
  for (const g of groups) {
    if (g === 'orders') set.add('paid');
    else if (g === 'subscribers') set.add('subscriber');
    // 'test' is handled separately via adminEmail
  }
  return set.size ? Array.from(set) : undefined;
}

export async function getRecipients(q: RecipientsQuery): Promise<RecipientsResult> {
  if (!supabaseServer) {
    throw new Error('Supabase not configured');
  }

  const emailSet = new Set<string>();

  // Test recipient: admin's own email.
  if (q.groups?.includes('test') && q.adminEmail) {
    emailSet.add(q.adminEmail.trim().toLowerCase());
  }

  // Resolve effective filters.
  const statuses = q.statuses ?? groupsToStatuses(q.groups);
  const memberTiers = q.memberTiers;
  const ticketTiers = q.ticketTiers ?? q.legacyTicketTiers;

  // If nothing to query (only test was requested), return test-only set.
  const needsQuery = statuses || memberTiers || ticketTiers;
  if (!needsQuery) {
    const emails = Array.from(emailSet);
    return { emails, count: emails.length };
  }

  let query = supabaseServer
    .from('members_enriched')
    .select('email')
    // Never send to emails on the suppression list (unsubscribed, bounced, complained).
    .eq('suppressed', false);
  if (statuses && statuses.length) query = query.in('status', statuses);
  if (memberTiers && memberTiers.length) query = query.in('tier', memberTiers);
  if (ticketTiers && ticketTiers.length) query = query.in('highest_ticket_tier', ticketTiers);

  const { data, error } = await query;
  if (error) {
    console.error('[Recipients] Error fetching members_enriched:', error);
    throw new Error('Failed to fetch recipients');
  }
  for (const row of data || []) {
    if (row.email) emailSet.add(String(row.email).trim().toLowerCase());
  }

  const emails = Array.from(emailSet);
  return { emails, count: emails.length };
}
