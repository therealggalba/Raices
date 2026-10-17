import { useState } from 'react';
import type { AlbumCard, Person } from '../types/domain';
import { formatPartialDate } from '../utils/dates';
import { RarityMark } from './Rarity';
import styles from './Cromo.module.scss';

/** Full-size cromo, styled after the original FamilyHub Android card. */
export function Cromo({ card, person }: { card: AlbumCard; person?: Person }) {
  const [failed, setFailed] = useState(false);
  return (
    <article className={[styles.cromo, styles[card.rarity]].join(' ')} aria-label={`Cromo #${card.number}: ${card.title}`}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <span className={styles.number}>#&nbsp;{card.number}</span>
          <h1 className={styles.title}>{card.title}</h1>
        </header>
        <div className={styles.photo}>
          {failed ? (
            <span className={styles.broken}>No se pudo cargar la imagen</span>
          ) : (
            <img src={card.imageUrl} alt={card.title} onError={() => setFailed(true)} />
          )}
        </div>
        <p className={styles.person}>{person ? person.firstName : 'Varios'}</p>
        <footer className={styles.footer}>
          <RarityMark rarity={card.rarity} />
          <span className={styles.date}>{formatPartialDate(card.takenAt)}</span>
        </footer>
      </div>
    </article>
  );
}
