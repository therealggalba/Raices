import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { MediaPlayer } from '../components/MediaPlayer';
import { PersonAvatar } from '../components/PersonAvatar';
import { Button, EmptyState, ErrorBanner, LinkButton } from '../components/ui';
import { ui } from '../components/ui-styles';
import { VideoRow } from '../components/VideoRow';
import { useChannel } from '../hooks/channel-context';
import { useAction } from '../hooks/useAction';
import { confirmAction } from '../hooks/useConfirm';
import { repository } from '../services';
import type { Person } from '../types/domain';
import { byEventDateAsc } from '../utils/catalog';
import { formatDuration, formatPartialDate } from '../utils/dates';
import { CATEGORY_LABELS } from '../utils/labels';
import styles from './VideoPage.module.scss';

export function VideoPage() {
  const { videoId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { snapshot, isAdmin, reload, personById } = useChannel();
  const { run, pending, error } = useAction();
  const { channel, videos, members, favoriteVideoIds } = snapshot;
  const video = videos.find((v) => v.id === videoId);

  if (!video) {
    return (
      <EmptyState icon="🔍">
        <p>Este vídeo no existe o ha sido eliminado.</p>
        <LinkButton to={`/c/${channel.id}`}>Volver al inicio</LinkButton>
      </EmptyState>
    );
  }

  const autoPlay = (location.state as { autoplay?: boolean } | null)?.autoplay === true;
  const favorite = favoriteVideoIds.includes(video.id);
  const tagged = video.personIds.map(personById).filter((p): p is Person => !!p);
  const author = members.find((m) => m.userId === video.authorId)?.displayName ?? 'Un antiguo miembro';
  const related = byEventDateAsc(videos.filter((v) => v.id !== video.id && v.category === video.category));

  return (
    <div className={styles.page}>
      <div className={styles.player}>
        <MediaPlayer key={video.id} video={video} autoPlay={autoPlay} />
      </div>
      <div className={styles.info}>
        <h1 className={styles.title}>{video.title}</h1>
        <p className={styles.meta}>
          <Link to={`/c/${channel.id}/cronologia#y${video.eventDate.slice(0, 4)}`}>{formatPartialDate(video.eventDate)}</Link>
          <span>{CATEGORY_LABELS[video.category]}</span>
          {video.durationSeconds && <span>{formatDuration(video.durationSeconds)}</span>}
        </p>
        <div className={styles.actions}>
          <Button
            variant={favorite ? 'primary' : 'secondary'}
            aria-pressed={favorite}
            disabled={pending}
            onClick={() => run(async () => {
              await repository.toggleFavorite(channel.id, video.id);
              await reload();
            })}
          >
            {favorite ? '♥ En favoritos' : '♡ Añadir a favoritos'}
          </Button>
          {isAdmin && (
            <>
              <LinkButton to={`/c/${channel.id}/v/${video.id}/editar`}>Editar</LinkButton>
              <Button
                variant="danger"
                disabled={pending}
                onClick={async () => {
                  if (!confirmAction(`¿Eliminar «${video.title}» del canal?`)) return;
                  const done = await run(async () => {
                    await repository.deleteVideo(channel.id, video.id);
                    return true;
                  });
                  if (done) {
                    await reload();
                    navigate(`/c/${channel.id}`, { replace: true });
                  }
                }}
              >
                Eliminar
              </Button>
            </>
          )}
        </div>
        <ErrorBanner message={error} />
        {video.description && <p className={styles.description}>{video.description}</p>}

        {tagged.length > 0 && (
          <section className={ui.section}>
            <h2>Aparecen</h2>
            <div className={styles.people}>
              {tagged.map((person) => (
                <Link key={person.id} to={`/c/${channel.id}/personas/${person.id}`} className={styles.person}>
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
              <Link key={tag} to={`/c/${channel.id}/buscar?q=${encodeURIComponent(tag)}`} className={ui.chip}>
                #{tag}
              </Link>
            ))}
          </div>
        )}

        <p className={styles.footnote}>
          Añadido por {author} el {new Date(video.uploadedAt).toLocaleDateString('es-ES', { dateStyle: 'long' })}
        </p>
      </div>

      {related.length > 0 && (
        <VideoRow
          title={`Más de ${CATEGORY_LABELS[video.category].toLowerCase()}`}
          videos={related}
          channelId={channel.id}
          favoriteIds={favoriteVideoIds}
        />
      )}
    </div>
  );
}
