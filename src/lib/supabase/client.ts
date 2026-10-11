import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://qfhmlwvkgdvysemitilb.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_tYeClbAcEaCB97cX-fQRZg_oUX6_Wdm';

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
