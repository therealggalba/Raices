import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { useAction } from '../hooks/useAction';
import { confirmAction } from '../hooks/useConfirm';
import { repository } from '../services';
import type { ChannelSummary, User } from '../types/domain';
import { CHANNEL_KIND_LABELS, ROLE_LABELS } from '../utils/labels';
import { initials } from '../utils/people';
import { Button, ErrorBanner } from './ui';
import { ui } from './ui-styles';
import styles from './OptionsMenu.module.scss';

/**
 * Right-hand header menu: profile, channels and the less frequent actions
 * (create, join, account) that stay out of the way of watching.
 */
export function OptionsMenu() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const { run, pending, error } = useAction();
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const { pathname, search } = useLocation();
  const auth = useAuth();
  const isDemo = auth.status !== 'signed-in';

  // Profile initial in the button, refreshed whenever the menu opens.
  useEffect(() => {
    let cancelled = false;
    const load = open
      ? Promise.all([repository.getCurrentUser(), repository.listChannels()])
      : repository.getCurrentUser().then((u) => [u, null] as const);
    load.then(
      ([u, list]) => {
        if (cancelled) return;
        setUser(u);
        if (list) setChannels(list);
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Close on navigation.
  const [lastRoute, setLastRoute] = useState(pathname + search);
  if (lastRoute !== pathname + search) {
    setLastRoute(pathname + search);
    setOpen(false);
    setEditing(false);
  }

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Opciones"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.avatar} aria-hidden>
          {user ? initials(user.name) || '?' : ''}
        </span>
        <span className={styles.caret} aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div id={panelId} className={styles.panel} role="dialog" aria-label="Opciones">
          <section className={styles.profile}>
            {isDemo ? (
              <div className={styles.profileButton}>
                <span className={styles.bigAvatar} aria-hidden>
                  {user ? initials(user.name) : ''}
                </span>
                <span>
                  <strong>{user?.name}</strong>
                  <span className={styles.hint}>Visitante de la demo</span>
                </span>
              </div>
            ) : editing ? (
              <form
                className={styles.nameForm}
                onSubmit={async (e) => {
                  e.preventDefault();
                  const updated = await run(() => repository.renameCurrentUser(name));
                  if (updated) {
                    setUser(updated);
                    setEditing(false);
                  }
                }}
              >
                <input
                  className={ui.input}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-label="Tu nombre"
                  maxLength={40}
                  autoFocus
                />
                <Button type="submit" variant="primary" small disabled={pending}>
                  Guardar
                </Button>
              </form>
            ) : (
              <button
                type="button"
                className={styles.profileButton}
                onClick={() => {
                  setName(user?.name ?? '');
                  setEditing(true);
                }}
              >
                <span className={styles.bigAvatar} aria-hidden>
                  {user ? initials(user.name) : ''}
                </span>
                <span>
                  <strong>{user?.name}</strong>
                  <span className={styles.hint}>Cambiar nombre</span>
                </span>
              </button>
            )}
          </section>

          <section className={styles.group}>
            <h2 className={styles.groupTitle}>Mis canales</h2>
            {channels.length === 0 ? (
              <p className={styles.hint}>Todavía no perteneces a ningún canal.</p>
            ) : (
              <ul className={styles.channelList}>
                {channels.map(({ channel, role, videoCount }) => (
                  <li key={channel.id}>
                    <Link to={`/c/${channel.id}`} className={styles.item}>
                      <span className={styles.channelInitial} aria-hidden>
                        {channel.name.charAt(0)}
                      </span>
                      <span className={styles.itemText}>
                        <span>{channel.name}</span>
                        <span className={styles.hint}>
                          {CHANNEL_KIND_LABELS[channel.kind]} · {ROLE_LABELS[role]} · {videoCount} vídeos
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={styles.group}>
            {isDemo ? (
              <Link to="/saber-mas" className={styles.item}>
                <span className={styles.icon} aria-hidden>
                  ?
                </span>
                Saber más
              </Link>
            ) : (
              <>
                <Link to="/nuevo" className={styles.item}>
                  <span className={styles.icon} aria-hidden>
                    ＋
                  </span>
                  Crear canal
                </Link>
                <Link to="/unirse" className={styles.item}>
                  <span className={styles.icon} aria-hidden>
                    ⎆
                  </span>
                  Unirme con código
                </Link>
              </>
            )}
            {auth.status === 'signed-in' && (
              <button
                type="button"
                className={styles.item}
                disabled={pending}
                onClick={async () => {
                  if (!confirmAction('¿Cerrar la sesión en este dispositivo?')) return;
                  await run(async () => {
                    await auth.signOut();
                    return true;
                  });
                }}
              >
                <span className={styles.icon} aria-hidden>
                  ⏻
                </span>
                Cerrar sesión
              </button>
            )}
            {isDemo && auth.configured && (
              <button type="button" className={styles.item} onClick={auth.leaveDemo}>
                <span className={styles.icon} aria-hidden>
                  ✉
                </span>
                Entrar con mi cuenta
              </button>
            )}
          </section>
          <ErrorBanner message={error} />
          <p className={styles.footnote}>
            {isDemo
              ? 'Demo del portfolio: una familia ficticia que solo se puede mirar.'
              : `Sesión iniciada como ${auth.email ?? 'usuario'}. Solo los miembros de cada canal ven su contenido.`}
          </p>
        </div>
      )}
    </div>
  );
}
