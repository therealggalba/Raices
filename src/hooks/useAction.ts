import { useCallback, useState } from 'react';
import { errorMessage } from '../services/repository';

/**
 * Runs a repository call with pending/error state. Returns the call's result,
 * or undefined when it failed (the error message is then in `error`).
 */
export function useAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
    setPending(true);
    setError(null);
    try {
      return await action();
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[family-memories]', e);
      setError(errorMessage(e));
      return undefined;
    } finally {
      setPending(false);
    }
  }, []);

  return { run, pending, error, setError };
}
