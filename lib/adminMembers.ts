import { supabaseServer } from '@/lib/supabaseServer';

export interface MemberRow {
  id: number;
  member_no: string;
  email: string;
  first_seen_at: string;
  created_at: string;
}

const MEMBER_NO_PATTERN = /^M\d+$/;

/**
 * Look up a member by slug — either member_no (M00042) or URL-encoded email.
 * Emails are normalised to lower+trim for the lookup.
 */
export async function resolveMember(slug: string): Promise<MemberRow | null> {
  if (!supabaseServer) return null;

  const raw = decodeURIComponent(slug || '').trim();
  if (!raw) return null;

  if (MEMBER_NO_PATTERN.test(raw)) {
    const { data } = await supabaseServer
      .from('members')
      .select('id, member_no, email, first_seen_at, created_at')
      .eq('member_no', raw)
      .maybeSingle();
    return (data as MemberRow | null) ?? null;
  }

  const email = raw.toLowerCase();
  const { data } = await supabaseServer
    .from('members')
    .select('id, member_no, email, first_seen_at, created_at')
    .eq('email', email)
    .maybeSingle();
  return (data as MemberRow | null) ?? null;
}
