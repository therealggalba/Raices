import { useState } from 'react';
import type { Video, VideoCategory } from '../types/domain';
import { CATEGORY_ICONS } from '../utils/labels';
import { thumbnailFor } from '../utils/media';
import { FitImage } from './FitImage';
import styles from './Thumbnail.module.scss';

const PALETTES: Record<VideoCategory, [string, string]> = {
  vacaciones: ['#1f6f8b', '#f2b45a'],
  cumpleanos: ['#b8336a', '#f6a04d'],
  navidad: ['#1e5631', '#c0392b'],
  boda: ['#6d5a8c', '#e8c39e'],
  comunion: ['#4a6fa5', '#e3e7f1'],
  bautizo: ['#5fa8a0', '#f3e1c7'],
  reunion: ['#8c4a2f', '#f2b45a'],
  otros: ['#3b3552', '#a46b9a'],
};

function hash(value: string): number {
  let h = 0;
  for (const c of value) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

/** Video thumbnail; videos without one get a generated, category-themed cover. */
export function Thumbnail({ video, showTitle = true }: { video: Video; showTitle?: boolean }) {
  const src = thumbnailFor(video);
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return <FitImage className={styles.image} src={src} onError={() => setFailed(true)} />;
  }

  const [a, b] = PALETTES[video.category];
  const angle = hash(video.id) % 360;
  return (
    <div className={styles.placeholder} style={{ background: `linear-gradient(${angle}deg, ${a}, ${b})` }} aria-hidden>
      <span className={styles.icon}>{CATEGORY_ICONS[video.category]}</span>
      {showTitle && <span className={styles.title}>{video.title}</span>}
    </div>
  );
}
