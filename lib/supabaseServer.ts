import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseServer: SupabaseClient | null = null;

if (supabaseUrl && supabaseServiceRoleKey) {
  supabaseServer = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  
  // 在開發環境中輸出連接資訊（不包含敏感資訊）
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.log('[Supabase] 客戶端已初始化:', {
      url: supabaseUrl,
      hasServiceRoleKey: !!supabaseServiceRoleKey,
      keyLength: supabaseServiceRoleKey?.length || 0,
    });
  }
} else if (process.env.NODE_ENV === 'development') {
  // eslint-disable-next-line no-console
  console.warn(
    '[Supabase] 服務端環境變數缺失:',
    {
      hasUrl: !!supabaseUrl,
      hasServiceRoleKey: !!supabaseServiceRoleKey,
      message: 'NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY 缺失，Newsletter API 將無法運作。'
    }
  );
}

export { supabaseServer };
