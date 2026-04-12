import { supabaseServer } from '@/lib/supabaseServer';

export type RecipientGroup = 'orders' | 'subscribers' | 'test';
export type TicketTier = 'explore' | 'contribute' | 'weekly_backer' | 'backer';

interface RecipientsResult {
  emails: string[];
  count: number;
}

export async function getRecipients(
  groups: RecipientGroup[],
  tiers?: TicketTier[],
  adminEmail?: string
): Promise<RecipientsResult> {
  if (!supabaseServer) {
    throw new Error('Supabase not configured');
  }

  const emailSet = new Set<string>();

  if (groups.includes('test') && adminEmail) {
    emailSet.add(adminEmail.trim().toLowerCase());
  }

  if (groups.includes('orders')) {
    let query = supabaseServer
      .from('orders')
      .select('customer_email')
      .eq('status', 'paid')
      .not('customer_email', 'is', null);

    if (tiers && tiers.length > 0) {
      query = query.in('ticket_tier', tiers);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[Recipients] Error fetching orders:', error);
      throw new Error('Failed to fetch paid members');
    }
    for (const row of data || []) {
      if (row.customer_email) {
        emailSet.add(row.customer_email.trim().toLowerCase());
      }
    }
  }

  if (groups.includes('subscribers')) {
    const { data, error } = await supabaseServer
      .from('newsletter_subscriptions')
      .select('email');

    if (error) {
      console.error('[Recipients] Error fetching subscribers:', error);
      throw new Error('Failed to fetch subscribers');
    }
    for (const row of data || []) {
      if (row.email) {
        emailSet.add(row.email.trim().toLowerCase());
      }
    }
  }

  const emails = Array.from(emailSet);
  return { emails, count: emails.length };
}
