import { Link } from 'react-router-dom';
import type { Video } from '../types/domain';
import { formatPartialDate } from '../utils/dates';
import { Thumbnail } from './Thumbnail';
import styles from './VideoCard.module.scss';

interface Props {
  video: Video;
  channelId: string;
  favorite?: boolean;
  /** Big rank number on the left, like a "Top 10" row. */
  rank?: number;
  /** Title (and optional subtitle) under the frame instead of over the cover. */
  caption?: string;
}

export function VideoCard({ video, channelId, favorite, rank, caption }: Props) {
  return (
    <Link
      to={`/c/${channelId}/v/${video.id}`}
      className={[styles.card, rank ? styles.ranked : '', caption !== undefined ? styles.captioned : ''].join(' ')}
      aria-label={`${video.title}, ${formatPartialDate(video.eventDate)}`}
    >
      {rank && (
        <span className={styles.rank} aria-hidden>
          {rank}
        </span>
      )}
      <span className={styles.frame}>
        <Thumbnail video={video} showTitle={caption === undefined} />
        <span className={styles.date}>{formatPartialDate(video.eventDate)}</span>
        {favorite && (
          <span className={styles.favorite} aria-hidden>
            ♥
          </span>
        )}
      </span>
      {caption !== undefined && (
        <span className={styles.caption}>
          <strong>{video.title}</strong>
          {caption && <span>{caption}</span>}
        </span>
      )}
    </Link>
  );
}
