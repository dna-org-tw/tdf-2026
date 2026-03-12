import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let supabaseClient: SupabaseClient | null = null;

if (supabaseUrl && supabasePublishableKey) {
  supabaseClient = createClient(supabaseUrl, supabasePublishableKey);
}

export { supabaseClient };
