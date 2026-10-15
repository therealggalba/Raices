import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { EmptyState, LinkButton, Spinner } from '../components/ui';
import { ChannelContext } from '../hooks/channel-context';
import type { ChannelContextValue } from '../hooks/channel-context';
import { repository } from '../services';
import { errorMessage } from '../services/repository';
import type { ChannelSnapshot } from '../types/domain';
import { toIsoDate } from '../utils/dates';
import styles from './ChannelLayout.module.scss';

const NAV = [
  { to: '', label: 'Inicio', icon: '⌂', end: true },
  { to: 'cronologia', label: 'Cronología', icon: '◷' },
  { to: 'eventos', label: 'Eventos', icon: '✦' },
  { to: 'personas', label: 'Personas', icon: '☺' },
  { to: 'canal', label: 'Canal', icon: '⚙' },
];

/** Loads one channel and provides it to every page under /c/:channelId. */
export function ChannelLayout() {
  const { channelId = '' } = useParams();
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState<ChannelSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [today] = useState(() => toIsoDate(new Date()));

  const reload = useCallback(async () => {
    try {
      setSnapshot(await repository.loadChannel(channelId));
      setError(null);
    } catch (e) {
      setSnapshot(null);
      setError(errorMessage(e));
    }
  }, [channelId]);

  useEffect(() => {
    let cancelled = false;
    repository.loadChannel(channelId).then(
      (loaded) => {
        if (cancelled) return;
        setSnapshot(loaded);
        setError(null);
      },
      (e: unknown) => {
        if (cancelled) return;
        setSnapshot(null);
        setError(errorMessage(e));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [channelId]);

  const value = useMemo<ChannelContextValue | null>(() => {
    if (!snapshot) return null;
    const people = new Map(snapshot.people.map((p) => [p.id, p]));
    return {
      snapshot,
      today,
      isAdmin: snapshot.me.role === 'admin',
      reload,
      personById: (id) => people.get(id),
    };
  }, [snapshot, reload, today]);

  if (error) {
    return (
      <EmptyState icon="🔒">
        <p>{error}</p>
        <LinkButton to="/" variant="primary">
          Volver a mis canales
        </LinkButton>
      </EmptyState>
    );
  }
  if (!value) return <Spinner />;

  const base = `/c/${channelId}`;
  return (
    <ChannelContext.Provider value={value}>
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <Link to="/" className={styles.brand} aria-label="Mis canales">
            <span className={styles.logo} aria-hidden>
              ▶
            </span>
          </Link>
          <span className={styles.channelName}>{value.snapshot.channel.name}</span>
          <form
            className={styles.search}
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              if (query.trim()) navigate(`${base}/buscar?q=${encodeURIComponent(query.trim())}`);
            }}
          >
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar recuerdos"
              aria-label="Buscar recuerdos"
              maxLength={80}
            />
          </form>
          {value.isAdmin && (
            <LinkButton to={`${base}/subir`} variant="primary" small aria-label="Añadir vídeo">
              + <span className={styles.hideSm}>Añadir</span>
            </LinkButton>
          )}
        </header>
        <main className={styles.main}>
          <Outlet />
        </main>
        <nav className={styles.bottomnav} aria-label="Secciones del canal">
          {NAV.map((item) => (
            <NavLink
              key={item.label}
              to={item.to ? `${base}/${item.to}` : base}
              end={item.end}
              className={({ isActive }) => [styles.navItem, isActive ? styles.active : ''].join(' ')}
            >
              <span className={styles.navIcon} aria-hidden>
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </ChannelContext.Provider>
  );
}
