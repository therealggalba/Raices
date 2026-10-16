import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorBanner, LinkButton, Spinner } from '../components/ui';
import { ui } from '../components/ui-styles';
import { useAction } from '../hooks/useAction';
import { repository } from '../services';
import type { ChannelSummary } from '../types/domain';
import { CHANNEL_KIND_LABELS, ROLE_LABELS } from '../utils/labels';
import styles from './ChannelsPage.module.scss';

/** All the channels (private communities) the user belongs to. */
export function ChannelsPage() {
  const [channels, setChannels] = useState<ChannelSummary[] | null>(null);
  const { run, error } = useAction();

  useEffect(() => {
    void run(async () => setChannels(await repository.listChannels()));
  }, [run]);

  if (!channels) return error ? <ErrorBanner message={error} /> : <Spinner />;

  return (
    <div className={[ui.page, ui.pageWide].join(' ')}>
      <div className={ui.pageHeader}>
        <h1>Mis canales</h1>
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
                  {CHANNEL_KIND_LABELS[channel.kind]} · {videoCount} vídeos · {memberCount} miembros
                </span>
                <span className={[ui.tag, role === 'admin' ? styles.admin : ''].join(' ')}>{ROLE_LABELS[role]}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
