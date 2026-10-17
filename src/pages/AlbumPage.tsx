import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CardThumb } from '../components/CardThumb';
import { PersonAvatar } from '../components/PersonAvatar';
import { RarityMark } from '../components/Rarity';
import { EmptyState, LinkButton } from '../components/ui';
import { useChannel } from '../hooks/channel-context';
import { RARITIES } from '../types/domain';
import { NO_PERSON, albumSections, rarityCounts } from '../utils/album';
import { fullName } from '../utils/people';
import styles from './AlbumPage.module.scss';

/** The channel's cromo album: one section per person (category). */
export function AlbumPage() {
  const { snapshot, isAdmin } = useChannel();
  const { hash } = useLocation();
  const { channel, cards, people } = snapshot;
  const sections = albumSections(cards, people);
  const counts = rarityCounts(cards);
  const base = `/c/${channel.id}/album`;

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [hash]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Álbum de cromos</h1>
          <p className={styles.total}>
            {cards.length} {cards.length === 1 ? 'cromo' : 'cromos'} · {people.length}{' '}
            {people.length === 1 ? 'persona' : 'personas'}
          </p>
        </div>
        {isAdmin && (
          <LinkButton to={`${base}/nuevo`} variant="primary" small>
            + Añadir cromo
          </LinkButton>
        )}
      </header>

      {cards.length > 0 && (
        <ul className={styles.rarities} aria-label="Cromos por rareza">
          {RARITIES.map((r) => (
            <li key={r}>
              <RarityMark rarity={r} size="sm" /> <b>{counts[r]}</b>
            </li>
          ))}
        </ul>
      )}

      {sections.length === 0 ? (
        <EmptyState icon="🃏">
          <p>El álbum se organiza por personas: añade primero las personas del canal.</p>
          {isAdmin && <LinkButton to={`/c/${channel.id}/personas/nueva`}>Añadir persona</LinkButton>}
        </EmptyState>
      ) : (
        <>
          <nav className={styles.people} aria-label="Ir a la persona">
            {sections.map((s) => (
              <a key={s.id} href={`#album-${s.id}`} className={styles.personChip}>
                {s.person ? <PersonAvatar person={s.person} size={40} /> : <span className={styles.various}>👥</span>}
                <span>{s.person ? s.person.firstName : 'Varios'}</span>
                <span className={styles.count}>{s.cards.length}</span>
              </a>
            ))}
          </nav>

          {sections.map((s) => (
            <section key={s.id} id={`album-${s.id}`} className={styles.section} aria-label={s.person ? fullName(s.person) : 'Varios'}>
              <h2 className={styles.sectionTitle}>
                {s.person ? fullName(s.person) : 'Varios'}
                <span>{s.cards.length}</span>
              </h2>
              {s.cards.length === 0 ? (
                <p className={styles.empty}>
                  Todavía no hay cromos.{' '}
                  {isAdmin && s.person && <Link to={`${base}/nuevo?persona=${s.person.id}`}>Añadir el primero</Link>}
                </p>
              ) : (
                <div className={styles.grid}>
                  {s.cards.map((card) => (
                    <CardThumb key={card.id} card={card} to={`${base}/${card.id}`} />
                  ))}
                </div>
              )}
              {s.id === NO_PERSON && <p className={styles.empty}>Cromos de personas que ya no están en el canal o de grupo.</p>}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
