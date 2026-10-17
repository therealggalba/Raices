import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { AlbumCard } from '../types/domain';
import { formatPartialDate } from '../utils/dates';
import styles from './CardThumb.module.scss';

/** Small cromo for the album grid; locked ones show a blurred photo. */
export function CardThumb({ card, to, locked }: { card: AlbumCard; to: string; locked: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <Link
      to={to}
      className={[styles.thumb, locked ? styles.locked : ''].join(' ')}
      aria-label={`#${card.number} ${card.title}${locked ? ' (bloqueado)' : ''}`}
    >
      <span className={styles.inner}>
        <span className={styles.number}>#{card.number}</span>
        <span className={styles.photo}>
          {failed ? (
            <span className={styles.badge} aria-hidden>
              🖼️
            </span>
          ) : (
            <img src={card.imageUrl} alt="" loading="lazy" draggable={false} onError={() => setFailed(true)} />
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
