import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, EmptyState, ErrorBanner, LinkButton, Spinner } from '../components/ui';
import { ui } from '../components/ui-styles';
import { useAction } from '../hooks/useAction';
import { confirmAction } from '../hooks/useConfirm';
import { repository } from '../services';
import type { ChannelSummary, User } from '../types/domain';
import { ROLE_LABELS } from '../utils/labels';
import styles from './ChannelsPage.module.scss';

/** Entry point: the channels (private communities) the user belongs to. */
export function ChannelsPage() {
  const [channels, setChannels] = useState<ChannelSummary[] | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState('');
  const { run, pending, error } = useAction();

  async function load() {
    const [list, me] = await Promise.all([repository.listChannels(), repository.getCurrentUser()]);
    setChannels(list);
    setUser(me);
    setName(me.name);
  }

  useEffect(() => {
    void run(load);
  }, [run]);

  if (!channels || !user) return error ? <ErrorBanner message={error} /> : <Spinner />;

  return (
    <div className={[ui.page, ui.pageWide].join(' ')}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.logo} aria-hidden>
            ▶
          </span>
          <span>FamilyMemories</span>
        </div>
        {editingName ? (
          <form
            className={styles.nameForm}
            onSubmit={async (e) => {
              e.preventDefault();
              const updated = await run(() => repository.renameCurrentUser(name));
              if (updated) {
                setUser(updated);
                setEditingName(false);
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
          <Button variant="ghost" small onClick={() => setEditingName(true)}>
            Hola, {user.name} ✎
          </Button>
        )}
      </header>

      <section className={styles.intro}>
        <h1>Recordar, redescubrir, conectar y preservar.</h1>
        <p className={ui.muted}>
          Cada canal es un espacio privado para una familia o un grupo: sus vídeos, su cronología, sus personas y las
          fechas que nadie debería olvidar.
        </p>
      </section>

      <p className={ui.notice}>
        Versión de demostración: los datos se guardan solo en este navegador y los canales de ejemplo son ficticios.
      </p>
      <ErrorBanner message={error} />

      <section className={ui.section}>
        <div className={ui.pageHeader}>
          <h2>Mis canales</h2>
          <div className={ui.chips}>
            <LinkButton to="/unirse" small>
              Unirme con código
            </LinkButton>
            <LinkButton to="/nuevo" variant="primary" small>
              + Crear canal
            </LinkButton>
          </div>
        </div>
        {channels.length === 0 ? (
          <EmptyState icon="📼">
            <p>Todavía no perteneces a ningún canal.</p>
          </EmptyState>
        ) : (
          <div className={styles.grid}>
            {channels.map(({ channel, role, memberCount, videoCount }) => (
              <Link key={channel.id} to={`/c/${channel.id}`} className={styles.card}>
                <span
                  className={styles.cover}
                  style={channel.coverUrl ? { backgroundImage: `url("${encodeURI(channel.coverUrl)}")` } : undefined}
                >
                  <span className={styles.initial} aria-hidden>
                    {channel.coverUrl ? '' : channel.name.charAt(0)}
                  </span>
                </span>
                <span className={styles.cardBody}>
                  <span className={styles.cardTitle}>{channel.name}</span>
                  <span className={styles.cardMeta}>
                    {videoCount} vídeos · {memberCount} miembros
                  </span>
                  <span className={[ui.tag, role === 'admin' ? styles.admin : ''].join(' ')}>{ROLE_LABELS[role]}</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <footer className={styles.footer}>
        <Button
          variant="ghost"
          small
          disabled={pending}
          onClick={async () => {
            if (!confirmAction('Se borrarán todos los cambios hechos en este navegador y se restaurará la demo. ¿Continuar?')) return;
            await run(async () => {
              await repository.resetDemo();
              await load();
            });
          }}
        >
          Restaurar datos de demostración
        </Button>
      </footer>
    </div>
  );
}
