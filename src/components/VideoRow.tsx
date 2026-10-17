import { Link } from 'react-router-dom';
import { useScrollArrows } from '../hooks/useScrollArrows';
import type { Video } from '../types/domain';
import { VideoCard } from './VideoCard';
import styles from './VideoRow.module.scss';

interface Props {
  title: string;
  videos: Video[];
  favoriteIds: readonly string[];
  ranked?: boolean;
  /** "Ver todo" link (usually the catalog, pre-filtered). */
  moreTo?: string;
}

/**
 * Netflix-style row. Edge arrows move it one card per click; on touch
 * screens each swipe also advances exactly one card (scroll-snap-stop).
 */
export function VideoRow({ title, videos, favoriteIds, ranked, moreTo }: Props) {
  const { ref: scroller, canPrev, canNext, step } = useScrollArrows<HTMLDivElement>([videos.length]);
  const favs = new Set(favoriteIds);

  return (
    <section className={styles.row} aria-label={title}>
      <div className={styles.head}>
        <h2 className={styles.title}>{title}</h2>
        {moreTo && (
          <Link to={moreTo} className={styles.more} aria-label={`Ver todo: ${title}`}>
            Ver todo ›
          </Link>
        )}
      </div>
      <div className={styles.viewport}>
        <div className={styles.scroller} ref={scroller}>
          {videos.map((video, i) => (
            <VideoCard key={video.id} video={video} favorite={favs.has(video.id)} rank={ranked ? i + 1 : undefined} />
          ))}
        </div>
        {canPrev && (
          <button type="button" className={[styles.arrow, styles.prev].join(' ')} onClick={() => step(-1)} aria-label={`Anterior en ${title}`}>
            <span aria-hidden>‹</span>
          </button>
        )}
        {canNext && (
          <button type="button" className={[styles.arrow, styles.next].join(' ')} onClick={() => step(1)} aria-label={`Siguiente en ${title}`}>
            <span aria-hidden>›</span>
          </button>
        )}
      </div>
    </section>
  );
}
