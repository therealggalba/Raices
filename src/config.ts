// Build-time configuration (Vite env vars). Everything here ends up in the
// public bundle: never put secrets in it. The Google API key is meant to be
// public but must be restricted (Drive API only + HTTP referrers) in Google
// Cloud Console.
export const config = {
  googleApiKey: (import.meta.env.VITE_GOOGLE_API_KEY as string | undefined)?.trim() || undefined,
} as const;
