import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabaseConfigured } from '../config';
import { selectBackend } from '../services';
import { getSupabase } from '../services/supabaseClient';
import { sessionExpired } from './account';
import { AuthContext } from './auth-context';
import { clearLastUsed, lastUsed, markUsed } from './devicePrefs';
import type { AuthState, AuthStatus } from './auth-context';

/**
 * Decides who is using the app: a signed-in account (Supabase backend), a
 * visitor browsing the demo (local backend, in memory only) or nobody yet
 * (login screen). Builds without Supabase credentials always run the demo.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>(supabaseConfigured ? 'loading' : 'demo');
  const holding = useRef(false);

  const apply = useCallback((next: Session | null) => {
    if (holding.current) return;
    setSession(next);
    setStatus((current) => (next ? 'signed-in' : current === 'demo' ? 'demo' : 'signed-out'));
  }, []);

  useEffect(() => {
    const client = getSupabase();
    if (!client) return;
    let cancelled = false;
    void client.auth.getSession().then(async ({ data }) => {
      let session = data.session;
      // Too long without using the app: the session ends (30 days).
      if (session && sessionExpired(lastUsed(), Date.now())) {
        await client.auth.signOut();
        session = null;
      }
      if (!cancelled) apply(session);
    });
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      if (!cancelled) apply(next);
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [apply]);

  // While signed in, remember when the app was last used (on open, every few
  // minutes and whenever it comes back to the foreground).
  useEffect(() => {
    if (status !== 'signed-in') return;
    markUsed();
    const onVisible = () => {
      if (document.visibilityState === 'visible') markUsed();
    };
    const timer = window.setInterval(markUsed, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [status]);

  const enterDemo = useCallback(() => setStatus('demo'), []);
  const leaveDemo = useCallback(() => setStatus(supabaseConfigured ? 'signed-out' : 'demo'), []);
  const signOut = useCallback(async () => {
    await getSupabase()?.auth.signOut();
    clearLastUsed();
  }, []);
  const stayOnLogin = useCallback(
    async (task: () => Promise<boolean>): Promise<boolean> => {
      holding.current = true;
      let done = false;
      try {
        done = await task();
      } finally {
        const current = (await getSupabase()?.auth.getSession())?.data.session ?? null;
        if (done || !current) {
          holding.current = false;
          apply(current);
        }
      }
      return done;
    },
    [apply],
  );

  // The backend must be in place before any screen below reads data.
  if (status === 'signed-in') selectBackend('supabase');
  else if (status === 'demo') selectBackend('local');

  const value = useMemo<AuthState>(
    () => ({
      status,
      configured: supabaseConfigured,
      email: session?.user.email,
      userId: session?.user.id,
      enterDemo,
      leaveDemo,
      signOut,
      stayOnLogin,
    }),
    [status, session, enterDemo, leaveDemo, signOut, stayOnLogin],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
