import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { MediaPlayer } from '../components/MediaPlayer';
import { PersonAvatar } from '../components/PersonAvatar';
import { Button, EmptyState, ErrorBanner, LinkButton } from '../components/ui';
import { ui } from '../components/ui-styles';
import { VideoRow } from '../components/VideoRow';
import { useLibrary } from '../hooks/library-context';
import { useAction } from '../hooks/useAction';
import { confirmAction } from '../hooks/useConfirm';
import { repository } from '../services';
import type { Person } from '../types/domain';
import { byEventDateAsc } from '../utils/catalog';
import { formatDuration, formatPartialDate } from '../utils/dates';
import { CATEGORY_LABELS } from '../utils/labels';
import { formatTimestamp, progressRatio } from '../utils/progress';
import styles from './VideoPage.module.scss';

const RELATED_LIMIT = 15;

export function VideoPage() {
  const { videoId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { library, reload, channelById, personById } = useLibrary();
  const { run, pending, error } = useAction();
  const { videos, favoriteVideoIds, viewCounts } = library;
  const video = videos.find((v) => v.id === videoId);
  const channel = video ? channelById(video.channelId) : undefined;
  // «Empezar desde el principio» remounts the player without a resume point.
  const [restartKey, setRestartKey] = useState(0);
  // Bumped synchronously on restart so the discarded player's last report
  // (sent while it unmounts) cannot bring the old position back.
  const playerSession = useRef(0);

  // Progress is saved silently while watching; refresh the library (cards,
  // progress bars) once the viewer leaves this page.
  useEffect(() => () => void reload(), [videoId, reload]);

  if (!video || !channel) {
    return (
      <EmptyState>
        <p>Este vídeo no existe o ya no tienes acceso a él.</p>
        <LinkButton to="/">Volver al inicio</LinkButton>
      </EmptyState>
    );
  }

  const isAdmin = channel.role === 'admin';
  const progress = restartKey === 0 ? library.progress[video.id] : undefined;
  const resumeAt = progress?.positionSeconds;
  const autoPlay = (location.state as { autoplay?: boolean } | null)?.autoplay === true;
  const favorite = favoriteVideoIds.includes(video.id);
  const views = viewCounts[video.id] ?? 0;
  const tagged = video.personIds.map(personById).filter((p): p is Person => !!p);
  // Related: same theme, only from channels of the same kind (same rule as the home rows).
  const sameKind = new Set(library.channels.filter((c) => c.kind === channel.kind).map((c) => c.id));
  const related = byEventDateAsc(
    videos.filter((v) => v.id !== video.id && v.category === video.category && sameKind.has(v.channelId)),
  ).slice(0, RELATED_LIMIT);

  return (
    <div className={styles.page}>
      <div className={styles.player}>
        <MediaPlayer
          key={`${video.id}:${restartKey}`}
          video={video}
          autoPlay={autoPlay || restartKey > 0}
          startAt={resumeAt}
          playLabel={resumeAt ? `Continuar desde ${formatTimestamp(resumeAt)}` : undefined}
          onProgress={(position, duration) => {
            if (restartKey !== playerSession.current) return;
            repository.saveProgress(video.id, position, duration).catch(() => {});
          }}
          onStart={() => {
            void run(async () => {
              await repository.recordView(video.id);
              await reload();
            });
          }}
        />
      </div>
      <div className={styles.info}>
        <Link to={`/c/${channel.id}`} className={styles.channel}>
          {channel.name}
        </Link>
        <h1 className={styles.title}>{video.title}</h1>
        <p className={styles.meta}>
          <span>{formatPartialDate(video.eventDate)}</span>
          <Link to={`/catalogo?tipo=${video.category}`}>{CATEGORY_LABELS[video.category]}</Link>
          {video.durationSeconds && <span>{formatDuration(video.durationSeconds)}</span>}
          <span>
            {views} {views === 1 ? 'reproducción' : 'reproducciones'}
          </span>
        </p>
        <div className={styles.actions}>
          <Button
            variant={favorite ? 'primary' : 'secondary'}
            aria-pressed={favorite}
            disabled={pending}
            onClick={() =>
              run(async () => {
                await repository.toggleFavorite(channel.id, video.id);
                await reload();
              })
            }
          >
            <Icon name={favorite ? 'heartFilled' : 'heart'} size={18} />
            {favorite ? 'En favoritos' : 'Añadir a favoritos'}
          </Button>
          {isAdmin && (
            <>
              <LinkButton to={`/c/${channel.id}/v/${video.id}/editar`}>Editar</LinkButton>
              <Button
                variant="danger"
                disabled={pending}
                onClick={async () => {
                  if (!confirmAction(`¿Eliminar «${video.title}» del canal ${channel.name}?`)) return;
                  const done = await run(async () => {
                    await repository.deleteVideo(channel.id, video.id);
                    return true;
                  });
                  if (done) {
                    await reload();
                    navigate('/', { replace: true });
                  }
                }}
              >
                Eliminar
              </Button>
            </>
          )}
        </div>
        <ErrorBanner message={error} />
        {progress && (
          <div className={styles.resume}>
            <span className={styles.resumeBar} aria-hidden>
              <span style={{ width: `${progressRatio(progress) * 100}%` }} />
            </span>
            <span className={styles.resumeText}>
              Lo dejaste en {formatTimestamp(progress.positionSeconds)} de {formatTimestamp(progress.durationSeconds)}
            </span>
            <Button
              small
              variant="ghost"
              onClick={() => {
                playerSession.current += 1;
                repository.saveProgress(video.id, 0, progress.durationSeconds).catch(() => {});
                setRestartKey(playerSession.current);
              }}
            >
              Empezar desde el principio
            </Button>
          </div>
        )}
        {video.description && <p className={styles.description}>{video.description}</p>}

        {tagged.length > 0 && (
          <section className={ui.section}>
            <h2>Aparecen</h2>
            <div className={styles.people}>
              {tagged.map((person) => (
                <Link key={person.id} to={`/c/${person.channelId}/personas/${person.id}`} className={styles.person}>
                  <PersonAvatar person={person} size={40} />
                  <span>{person.firstName}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {video.tags.length > 0 && (
          <div className={ui.chips}>
            {video.tags.map((tag) => (
              <Link key={tag} to={`/catalogo?q=${encodeURIComponent(tag)}`} className={ui.chip}>
                #{tag}
              </Link>
            ))}
          </div>
        )}

        <p className={styles.footnote}>
          Añadido el {new Date(video.uploadedAt).toLocaleDateString('es-ES', { dateStyle: 'long' })}
        </p>
      </div>

      {related.length > 0 && (
        <VideoRow
          title={`Más de ${CATEGORY_LABELS[video.category].toLowerCase()}`}
          videos={related}
          favoriteIds={favoriteVideoIds}
          moreTo={`/catalogo?tipo=${video.category}&${[...sameKind].map((id) => `canal=${id}`).join('&')}`}
        />
      )}
    </div>
  );
}
