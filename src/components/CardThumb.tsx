import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { AlbumCard } from '../types/domain';
import { formatPartialDate } from '../utils/dates';
import { FitImage } from './FitImage';
import styles from './CardThumb.module.scss';

/** Small cromo for the album grid; locked ones show a blurred photo. */
interface Props {
  card: AlbumCard;
  to: string;
  locked: boolean;
  /** Copies owned; shown as ×N when repeated. */
  copies?: number;
}

export function CardThumb({ card, to, locked, copies = 0 }: Props) {
  const [failed, setFailed] = useState(false);
  return (
    <Link
      to={to}
      className={[styles.thumb, locked ? styles.locked : ''].join(' ')}
      aria-label={`#${card.number} ${card.title}${locked ? ' (bloqueado)' : ''}`}
    >
      <span className={styles.inner}>
        <span className={styles.top}>
          <span className={styles.number}>#{card.number}</span>
          {copies > 1 && (
            <span className={styles.copies} title={`Tienes ${copies} copias`}>
              ×{copies}
            </span>
          )}
        </span>
        <span className={styles.photo}>
          {failed ? (
            <span className={styles.badge} aria-hidden>
              🖼️
            </span>
          ) : (
            <FitImage src={card.imageUrl} onError={() => setFailed(true)} />
          )}
          {locked && (
            <span className={styles.badge} aria-hidden>
              🔒
            </span>
          )}
        </span>
        <span className={styles.title}>{card.title}</span>
        <span className={styles.date}>{formatPartialDate(card.takenAt)}</span>
      </span>
    </Link>
  );
}
