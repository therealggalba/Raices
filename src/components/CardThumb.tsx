import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { AlbumCard } from '../types/domain';
import { formatPartialDate } from '../utils/dates';
import { RarityMark } from './Rarity';
import styles from './CardThumb.module.scss';

/** Small cromo for the album grid. */
export function CardThumb({ card, to }: { card: AlbumCard; to: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <Link to={to} className={[styles.thumb, styles[card.rarity]].join(' ')} aria-label={`#${card.number} ${card.title}`}>
      <span className={styles.inner}>
        <span className={styles.number}>#{card.number}</span>
        <span className={styles.photo}>
          {failed ? (
            <span className={styles.broken} aria-hidden>
              🖼️
            </span>
          ) : (
            <img src={card.imageUrl} alt="" loading="lazy" onError={() => setFailed(true)} />
          )}
        </span>
        <span className={styles.title}>{card.title}</span>
        <span className={styles.footer}>
          <RarityMark rarity={card.rarity} size="sm" />
          <span className={styles.date}>{formatPartialDate(card.takenAt)}</span>
        </span>
      </span>
    </Link>
  );
}
