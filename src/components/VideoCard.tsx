import { useContext } from 'react';
import { Icon } from './Icon';
import { Link } from 'react-router-dom';
import { LibraryContext } from '../hooks/library-context';
import type { Video } from '../types/domain';
import { formatPartialDate } from '../utils/dates';
import { progressRatio } from '../utils/progress';
import { Thumbnail } from './Thumbnail';
import styles from './VideoCard.module.scss';

interface Props {
  video: Video;
  favorite?: boolean;
  /** Big rank number on the left, like a "Top 10" row. */
  rank?: number;
  /** Title (and optional subtitle) under the frame instead of over the cover. */
  caption?: string;
}

export function VideoCard({ video, favorite, rank, caption }: Props) {
  // Optional: per-channel pages render cards outside the global library.
  const ratio = progressRatio(useContext(LibraryContext)?.library.progress[video.id]);
  return (
    <Link
      to={`/v/${video.id}`}
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
        {ratio > 0 && (
          <span className={styles.progress} aria-label="Visto en parte">
            <span style={{ width: `${ratio * 100}%` }} />
          </span>
        )}
        {favorite && (
          <span className={styles.favorite} aria-label="En favoritos">
            <Icon name="heartFilled" size={16} />
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
