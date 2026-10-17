import { useCallback, useEffect, useMemo, useState } from 'react';
import { BrandMark } from '../components/BrandMark';
import { Icon } from '../components/Icon';
import type { IconName } from '../components/Icon';
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { EmptyState, LinkButton, Spinner } from '../components/ui';
import { ChannelContext } from '../hooks/channel-context';
import type { ChannelContextValue } from '../hooks/channel-context';
import { repository } from '../services';
import { errorMessage } from '../services/repository';
import type { ChannelSnapshot } from '../types/domain';
import { toIsoDate } from '../utils/dates';
import { WhoAreYou } from '../pages/WhoAreYou';
import styles from './ChannelLayout.module.scss';

const NAV: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '', label: 'Vídeos', icon: 'videos', end: true },
  { to: 'cronologia', label: 'Cronología', icon: 'clock' },
  { to: 'eventos', label: 'Fechas', icon: 'calendar' },
  { to: 'personas', label: 'Personas', icon: 'people' },
  { to: 'canal', label: 'Canal', icon: 'settings' },
];

/** Loads one channel and provides it to every page under /c/:channelId. */
export function ChannelLayout() {
  const { channelId = '' } = useParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
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
      <EmptyState>
        <p>{error}</p>
        <LinkButton to="/canales" variant="primary">
          Ver mis canales
        </LinkButton>
      </EmptyState>
    );
  }
  if (!value) return <Spinner />;

  const base = `/c/${channelId}`;
  // Nobody uses a channel without saying who they are (admins may first create their own card).
  const mustChoose = !value.snapshot.me.personId && !(value.isAdmin && pathname.endsWith('/personas/nueva'));
  return (
    <ChannelContext.Provider value={value}>
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <Link to="/" className={styles.brand} aria-label="Volver al inicio">
            <BrandMark size={34} />
          </Link>
          <span className={styles.channelName}>{value.snapshot.channel.name}</span>
          <form
            className={styles.search}
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              if (query.trim()) navigate(`/catalogo?canal=${channelId}&q=${encodeURIComponent(query.trim())}`);
            }}
          >
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar en el canal"
              aria-label="Buscar en este canal"
              maxLength={80}
            />
          </form>
          {value.isAdmin && !mustChoose && (
            <LinkButton to={`${base}/subir`} variant="primary" small aria-label="Añadir vídeo">
              + <span className={styles.hideSm}>Añadir</span>
            </LinkButton>
          )}
        </header>
        <main className={styles.main}>{mustChoose ? <WhoAreYou /> : <Outlet />}</main>
        {!mustChoose && (
          <nav className={styles.bottomnav} aria-label="Secciones del canal">
            {NAV.map((item) => (
              <NavLink
                key={item.label}
                to={item.to ? `${base}/${item.to}` : base}
                end={item.end}
                className={({ isActive }) => [styles.navItem, isActive ? styles.active : ''].join(' ')}
              >
                <Icon name={item.icon} size={22} className={styles.navIcon} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}
      </div>
    </ChannelContext.Provider>
  );
}
