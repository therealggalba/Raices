import { createContext, useContext } from 'react';

export type AuthStatus = 'loading' | 'signed-out' | 'demo' | 'signed-in';

export interface AuthState {
  status: AuthStatus;
  /** Real accounts are available in this build. */
  configured: boolean;
  email?: string;
  userId?: string;
  /** Browse the fictional demo without an account (nothing is kept). */
  enterDemo(): void;
  /** Back to the login screen (from the demo). */
  leaveDemo(): void;
  signOut(): Promise<void>;
  /**
   * Runs `task` without entering the app when it creates a session (password
   * recovery: the code signs in, but the new password must be saved first).
   * The app opens once `task` returns true; on false it stays on the login
   * screen (a session left by an accepted code stays on hold for a retry).
   */
  stayOnLogin(task: () => Promise<boolean>): Promise<boolean>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
