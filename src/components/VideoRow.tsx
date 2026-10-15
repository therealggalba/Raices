import type { Video } from '../types/domain';
import { VideoCard } from './VideoCard';
import styles from './VideoRow.module.scss';

interface Props {
  title: string;
  videos: Video[];
  channelId: string;
  favoriteIds: readonly string[];
  ranked?: boolean;
}

/** Netflix-style horizontal row with scroll snapping (swipe on mobile). */
export function VideoRow({ title, videos, channelId, favoriteIds, ranked }: Props) {
  const favs = new Set(favoriteIds);
  return (
    <section className={styles.row} aria-label={title}>
      <h2 className={styles.title}>{title}</h2>
      <div className={styles.scroller}>
        {videos.map((video, i) => (
          <VideoCard
            key={video.id}
            video={video}
            channelId={channelId}
            favorite={favs.has(video.id)}
            rank={ranked ? i + 1 : undefined}
          />
        ))}
      </div>
    </section>
  );
}
