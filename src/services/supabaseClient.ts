import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';

let client: SupabaseClient | null = null;

/** The shared Supabase client (null when the app is built without Supabase). */
export function getSupabase(): SupabaseClient | null {
  if (!config.supabaseUrl || !config.supabaseAnonKey) return null;
  client ??= createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Login is a 6-digit code typed in the app: no magic links in URLs.
      detectSessionInUrl: false,
      storageKey: 'raices:auth',
    },
  });
  return client;
}
