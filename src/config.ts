// Build-time configuration (Vite env vars). Everything here ends up in the
// public bundle: never put secrets in it. The Google API key is meant to be
// public but must be restricted (Drive API only + HTTP referrers) in Google
// Cloud Console. The Supabase publishable (anon) key is public by design:
// data is protected by Row Level Security, never by hiding this key.
const env = (value: unknown) => (typeof value === 'string' && value.trim()) || undefined;

export const config = {
  googleApiKey: env(import.meta.env.VITE_GOOGLE_API_KEY),
  supabaseUrl: env(import.meta.env.VITE_SUPABASE_URL),
  supabaseAnonKey: env(import.meta.env.VITE_SUPABASE_ANON_KEY),
} as const;

/** Real accounts are available (otherwise the app only runs the local demo). */
export const supabaseConfigured = !!(config.supabaseUrl && config.supabaseAnonKey);
