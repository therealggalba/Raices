import { Link } from 'react-router-dom';
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

/** Netflix-style horizontal row with scroll snapping (swipe on mobile). */
export function VideoRow({ title, videos, favoriteIds, ranked, moreTo }: Props) {
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
      <div className={styles.scroller}>
        {videos.map((video, i) => (
          <VideoCard
            key={video.id}
            video={video}
            favorite={favs.has(video.id)}
            rank={ranked ? i + 1 : undefined}
          />
        ))}
      </div>
    </section>
  );
}
