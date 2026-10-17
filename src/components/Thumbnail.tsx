import { useState } from 'react';
import type { Video } from '../types/domain';
import { thumbnailFor } from '../utils/media';
import { FitImage } from './FitImage';
import styles from './Thumbnail.module.scss';

/** Video thumbnail; videos without one get a plain cover with their title. */
export function Thumbnail({ video, showTitle = true }: { video: Video; showTitle?: boolean }) {
  const src = thumbnailFor(video);
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return <FitImage className={styles.image} src={src} onError={() => setFailed(true)} />;
  }

  return (
    <div className={styles.placeholder} aria-hidden>
      {showTitle && <span className={styles.title}>{video.title}</span>}
    </div>
  );
}
