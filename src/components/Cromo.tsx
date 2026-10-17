import { useState } from 'react';
import { Icon } from './Icon';
import type { AlbumCard, Person } from '../types/domain';
import { formatPartialDate } from '../utils/dates';
import { FitImage } from './FitImage';
import styles from './Cromo.module.scss';

/** Full-size cromo, styled after the original FamilyHub Android card. */
interface Props {
  card: AlbumCard;
  person?: Person;
  locked: boolean;
  /** Copies owned (×N badge when repeated). */
  copies?: number;
  /** Corner ribbon, e.g. «¡NUEVA!» when just pulled from a pack. */
  ribbon?: string;
}

export function Cromo({ card, person, locked, copies = 0, ribbon }: Props) {
  const [failed, setFailed] = useState(false);
  return (
    <article
      className={[styles.cromo, locked ? styles.locked : ''].join(' ')}
      aria-label={`Cromo #${card.number}: ${card.title}${locked ? ' (bloqueado)' : ''}`}
    >
      {ribbon && <span className={styles.ribbon}>{ribbon}</span>}
      <div className={styles.inner}>
        <header className={styles.header}>
          <span className={styles.number}>#&nbsp;{card.number}</span>
          <h1 className={styles.title}>{card.title}</h1>
        </header>
        <div className={styles.photo}>
          {failed ? (
            <span className={styles.broken}>No se pudo cargar la imagen</span>
          ) : (
            <FitImage className={styles.image} src={card.imageUrl} alt={locked ? '' : card.title} loading="eager" onError={() => setFailed(true)} />
          )}
          {locked && (
            <span className={styles.lock}>
              <Icon name="lock" size={22} />
              Cromo bloqueado
            </span>
          )}
        </div>
        <p className={styles.person}>{person ? person.firstName : 'Varios'}</p>
        <footer className={styles.footer}>
          <span className={styles.copies}>{copies > 1 ? `×${copies} copias` : ''}</span>
          <span className={styles.date}>{formatPartialDate(card.takenAt)}</span>
        </footer>
      </div>
    </article>
  );
}
