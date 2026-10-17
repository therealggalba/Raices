import { useState } from 'react';
import type { AlbumCard, Person } from '../types/domain';
import { formatPartialDate } from '../utils/dates';
import styles from './Cromo.module.scss';

/** Full-size cromo, styled after the original FamilyHub Android card. */
export function Cromo({ card, person, locked }: { card: AlbumCard; person?: Person; locked: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <article
      className={[styles.cromo, locked ? styles.locked : ''].join(' ')}
      aria-label={`Cromo #${card.number}: ${card.title}${locked ? ' (bloqueado)' : ''}`}
    >
      <div className={styles.inner}>
        <header className={styles.header}>
          <span className={styles.number}>#&nbsp;{card.number}</span>
          <h1 className={styles.title}>{card.title}</h1>
        </header>
        <div className={styles.photo}>
          {failed ? (
            <span className={styles.broken}>No se pudo cargar la imagen</span>
          ) : (
            <img src={card.imageUrl} alt={locked ? '' : card.title} draggable={false} onError={() => setFailed(true)} />
          )}
          {locked && (
            <span className={styles.lock}>
              <span aria-hidden>🔒</span>
              Cromo bloqueado
            </span>
          )}
        </div>
        <p className={styles.person}>{person ? person.firstName : 'Varios'}</p>
        <footer className={styles.footer}>
          <span className={styles.date}>{formatPartialDate(card.takenAt)}</span>
        </footer>
      </div>
    </article>
  );
}
