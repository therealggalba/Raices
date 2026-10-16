import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { OptionsMenu } from '../components/OptionsMenu';
import { ErrorBanner, Spinner } from '../components/ui';
import { LibraryContext } from '../hooks/library-context';
import type { LibraryContextValue } from '../hooks/library-context';
import { repository } from '../services';
import { errorMessage } from '../services/repository';
import type { Library } from '../types/domain';
import { toIsoDate } from '../utils/dates';
import styles from './AppLayout.module.scss';

/**
 * Global shell (Inicio, Catálogo, vídeo): loads the user's library — every
 * video of every channel they belong to — and provides it to the pages.
 */
export function AppLayout() {
  const [library, setLibrary] = useState<Library | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [today] = useState(() => toIsoDate(new Date()));

  const reload = useCallback(async () => {
    try {
      setLibrary(await repository.loadLibrary());
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    repository.loadLibrary().then(
      (loaded) => {
        if (!cancelled) setLibrary(loaded);
      },
      (e: unknown) => {
        if (!cancelled) setError(errorMessage(e));
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<LibraryContextValue | null>(() => {
    if (!library) return null;
    const channels = new Map(library.channels.map((c) => [c.id, c]));
    const people = new Map(library.people.map((p) => [p.id, p]));
    return {
      library,
      today,
      reload,
      channelById: (id) => channels.get(id),
      personById: (id) => people.get(id),
    };
  }, [library, today, reload]);

  const navClass = ({ isActive }: { isActive: boolean }) => [styles.tab, isActive ? styles.active : ''].join(' ');

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link to="/" className={styles.brand} aria-label="FamilyMemories, inicio">
          <span className={styles.logo} aria-hidden>
            ▶
          </span>
          <span className={styles.brandName}>FamilyMemories</span>
        </Link>
        <nav className={styles.tabs} aria-label="Principal">
          <NavLink to="/" end className={navClass}>
            Inicio
          </NavLink>
          <NavLink to="/catalogo" className={navClass}>
            Catálogo
          </NavLink>
        </nav>
        <div className={styles.actions}>
          <Link to="/catalogo?buscar=1" className={styles.iconButton} aria-label="Buscar en el catálogo">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
              <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="m20 20-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </Link>
          <OptionsMenu onChanged={reload} />
        </div>
      </header>
      <main className={styles.main}>
        <ErrorBanner message={error} />
        {value ? (
          <LibraryContext.Provider value={value}>
            <Outlet />
          </LibraryContext.Provider>
        ) : (
          !error && <Spinner />
        )}
      </main>
    </div>
  );
}
