import type { Video } from '../types/domain';
import { formatDuration, formatPartialDate } from '../utils/dates';
import { CATEGORY_LABELS } from '../utils/labels';
import { Thumbnail } from './Thumbnail';
import { LinkButton } from './ui';
import styles from './Hero.module.scss';

export function Hero({ video, kicker }: { video: Video; kicker: string }) {
  const to = `/v/${video.id}`;
  return (
    <section className={styles.hero} aria-label="Destacado">
      <div className={styles.backdrop}>
        <Thumbnail video={video} showTitle={false} />
      </div>
      <div className={styles.content}>
        <span className={styles.kicker}>{kicker}</span>
        <h1 className={styles.title}>{video.title}</h1>
        <p className={styles.meta}>
          <span>{formatPartialDate(video.eventDate)}</span>
          <span>{CATEGORY_LABELS[video.category]}</span>
          {video.durationSeconds && <span>{formatDuration(video.durationSeconds)}</span>}
        </p>
        {video.description && <p className={styles.description}>{video.description}</p>}
        <div className={styles.actions}>
          <LinkButton to={to} state={{ autoplay: true }} variant="play">
            ▶ Reproducir
          </LinkButton>
          <LinkButton to={to}>ⓘ Más información</LinkButton>
        </div>
      </div>
    </section>
  );
}
