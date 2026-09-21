import { supabaseServer } from './supabaseServer';

export interface VisitorRecord {
  fingerprint: string;
  ip_address: string | null;
  timezone: string | null;
  locale: string | null;
  user_agent: string | null;
  country: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecordVisitorInput {
  fingerprint: string;
  timezone?: string | null;
  locale?: string | null;
  user_agent?: string | null;
  ip_address?: string | null;
  country?: string | null;
}

export interface RecordVisitorResult {
  visitor: VisitorRecord | null;
  error?: string;
}

/**
 * 記錄或更新訪客資訊，以 fingerprint 作為唯一識別
 * 若已存在則更新 IP、時區、語系等，回傳 visitor 記錄
 */
export async function recordVisitor(
  input: RecordVisitorInput
): Promise<RecordVisitorResult> {
  if (!supabaseServer) {
    const msg = 'Supabase client not initialized (check SUPABASE_SECRET_KEY, NEXT_PUBLIC_SUPABASE_URL)';
    console.warn('[Visitors]', msg);
    return { visitor: null, error: msg };
  }

  try {
    const { fingerprint, timezone, locale, user_agent, ip_address, country } =
      input;

    const { data, error } = await supabaseServer
      .from('visitors')
      .upsert(
        {
          fingerprint,
          ip_address: ip_address ?? null,
          timezone: timezone ?? null,
          locale: locale ?? null,
          user_agent: user_agent ?? null,
          country: country ?? null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'fingerprint',
          ignoreDuplicates: false,
        }
      )
      .select()
      .single();

    if (error) {
      const msg = [error.message, error.details].filter(Boolean).join(' ');
      console.error('[Visitors] Error recording visitor:', msg);
      return { visitor: null, error: msg };
    }

    return { visitor: data as VisitorRecord };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Visitors] Exception recording visitor:', err);
    return { visitor: null, error: msg };
  }
}
