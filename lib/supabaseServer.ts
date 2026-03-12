import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

let supabaseServer: SupabaseClient | null = null;

if (supabaseUrl && supabaseSecretKey) {
  supabaseServer = createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.log('[Supabase] 客戶端已初始化:', {
      url: supabaseUrl,
      hasSecretKey: true,
    });
  }
} else if (process.env.NODE_ENV === 'development') {
  // eslint-disable-next-line no-console
  console.warn(
    '[Supabase] 服務端環境變數缺失:',
    {
      hasUrl: !!supabaseUrl,
      hasSecretKey: !!supabaseSecretKey,
      message: 'NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SECRET_KEY 缺失。'
    }
  );
}

export { supabaseServer };
