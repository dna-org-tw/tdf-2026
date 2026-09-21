import { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabaseServer';

export type MemberContext = {
  memberId: number;
  email: string;
};

/**
 * Resolve the authenticated session to a `members.id`, creating a members row
 * if the user has a valid session but no member record yet (rare — happens
 * only for accounts that signed in via magic-link before any order/newsletter
 * activity wrote them into members).
 *
 * Returns `null` if no session is present. Throws if Supabase is unconfigured
 * or the lookup itself fails.
 */
export async function resolveMemberFromSession(req: NextRequest): Promise<MemberContext | null> {
  const session = await getSessionFromRequest(req);
  if (!session) return null;
  if (!supabaseServer) throw new Error('database_not_configured');
  const email = session.email.trim().toLowerCase();
  const { data: existing, error: lookupErr } = await supabaseServer
    .from('members')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (lookupErr) throw lookupErr;
  if (existing) return { memberId: existing.id as number, email };

  const { data: created, error: createErr } = await supabaseServer
    .from('members')
    .upsert({ email }, { onConflict: 'email' })
    .select('id')
    .single();
  if (createErr) throw createErr;
  return { memberId: created.id as number, email };
}
