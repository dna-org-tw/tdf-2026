import { supabaseServer } from '@/lib/supabaseServer';
import { addSuppression } from '@/lib/emailCompliance';

/**
 * Soft-unsubscribe: mark newsletter_subscriptions row AND insert into the
 * global email_suppressions list so every bulk-send path honors the opt-out.
 *
 * Used by /api/newsletter/unsubscribe (token links, one-click POST) and
 * /api/admin/members/[memberNo]/unsubscribe (manual admin action).
 *
 * Returns null on success or an Error describing the failure.
 */
export async function applyUnsubscribe(
  email: string,
  source: string,
): Promise<Error | null> {
  if (!supabaseServer) return new Error('Supabase not configured');

  const normalized = email.trim().toLowerCase();
  if (!normalized) return new Error('Empty email');

  const { error } = await supabaseServer
    .from('newsletter_subscriptions')
    .update({ unsubscribed_at: new Date().toISOString() })
    .ilike('email', normalized)
    .is('unsubscribed_at', null);

  if (error) return error;

  await addSuppression(normalized, 'unsubscribed', source);
  return null;
}
