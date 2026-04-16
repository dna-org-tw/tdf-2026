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

export type EmailCategory = 'newsletter' | 'events' | 'award';
export const EMAIL_CATEGORIES: readonly EmailCategory[] = ['newsletter', 'events', 'award'] as const;

interface RecipientsQuery {
  statuses?: MemberStatus[];
  memberTiers?: MemberTier[];
  ticketTiers?: TicketTier[];
  groups?: RecipientGroup[]; // legacy
  legacyTicketTiers?: TicketTier[]; // legacy: old `tiers` param
  adminEmail?: string;
  // When set, exclude addresses whose newsletter_subscriptions row has the
  // matching pref_<category> = false or unsubscribed_at IS NOT NULL. Addresses
  // with no subscription row pass through (treated as opted-in by default).
  category?: EmailCategory;
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
  // Explicit cap to avoid supabase-js's 1000-row default truncating bulk-send audiences.
  query = query.limit(50000);

  const { data, error } = await query;
  if (error) {
    console.error('[Recipients] Error fetching members_enriched:', error);
    throw new Error('Failed to fetch recipients');
  }

  const candidateEmails: string[] = [];
  for (const row of data || []) {
    if (row.email) candidateEmails.push(String(row.email).trim().toLowerCase());
  }

  // Category filter: drop addresses whose newsletter_subscriptions row has the
  // matching pref turned off, or that have unsubscribed_at set. Addresses with
  // no subscription row pass through (treated as opted-in by default).
  if (q.category && candidateEmails.length > 0) {
    const prefColumn = `pref_${q.category}` as 'pref_newsletter' | 'pref_events' | 'pref_award';
    // Batch the .in() lookup — a single 990-email IN list overflows the
    // PostgREST URL/payload limit. 200/batch keeps the URL well under 16KB.
    const BATCH_SIZE = 200;
    const subs: Array<Record<string, unknown>> = [];
    for (let i = 0; i < candidateEmails.length; i += BATCH_SIZE) {
      const chunk = candidateEmails.slice(i, i + BATCH_SIZE);
      const { data, error: subsErr } = await supabaseServer
        .from('newsletter_subscriptions')
        .select(`email, ${prefColumn}, unsubscribed_at`)
        .in('email', chunk);
      if (subsErr) {
        console.error('[Recipients] Error fetching subscription preferences:', subsErr);
        throw new Error('Failed to fetch recipient preferences');
      }
      if (data) subs.push(...(data as Array<Record<string, unknown>>));
    }
    const blocked = new Set<string>();
    for (const sRow of subs) {
      const e = String(sRow.email ?? '').trim().toLowerCase();
      if (!e) continue;
      const prefValue = sRow[prefColumn];
      const unsub = sRow.unsubscribed_at;
      if (unsub || prefValue === false) blocked.add(e);
    }
    for (const e of candidateEmails) {
      if (!blocked.has(e)) emailSet.add(e);
    }
  } else {
    for (const e of candidateEmails) emailSet.add(e);
  }

  const emails = Array.from(emailSet);
  return { emails, count: emails.length };
}
