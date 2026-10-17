import { useEffect, useRef } from 'react';
import { Icon } from '../components/Icon';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CardThumb } from '../components/CardThumb';
import { PersonAvatar } from '../components/PersonAvatar';
import { ProgressMeter } from '../components/ProgressMeter';
import { EmptyState, LinkButton } from '../components/ui';
import { useLibrary } from '../hooks/library-context';
import { useScrollArrows } from '../hooks/useScrollArrows';
import { albumProgress, albumSections, ownedCardIds } from '../utils/album';
import styles from './AlbumPage.module.scss';

/**
 * One channel's album. The full-width row of people (a carousel when they
 * don't fit) picks the category; only that person's cromos are shown below.
 * The selected person lives in the URL (?persona=) so «back» keeps it.
 */
export function AlbumPage() {
  const { channelId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const { library, channelById } = useLibrary();
  const channel = channelById(channelId);
  const cards = library.cards.filter((c) => c.channelId === channelId);
  const people = library.people.filter((p) => p.channelId === channelId);
  const unlocked = ownedCardIds(library.cardCopies);
  // People without cromos have nothing to show yet.
  const sections = albumSections(cards, people).filter((s) => s.cards.length > 0);
  const selectedId = params.get('persona');
  const selected = sections.find((s) => s.id === selectedId) ?? sections[0];
  const { ref: tabsRef, canPrev, canNext, step, reveal } = useScrollArrows<HTMLDivElement>([sections.length]);
  const selectedTab = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    reveal(selectedTab.current);
  }, [selected?.id, reveal]);

  if (!channel) {
    return (
      <EmptyState>
        <p>Este álbum no existe o ya no tienes acceso a él.</p>
        <LinkButton to="/albumes">Ver mis álbumes</LinkButton>
      </EmptyState>
    );
  }

  const isAdmin = channel.role === 'admin';
  const progress = albumProgress(cards, unlocked);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <Link to="/albumes" className={styles.back}>
            ‹ Álbumes
          </Link>
          {isAdmin && (
            <LinkButton
              to={`/c/${channel.id}/album/nuevo${selected?.person ? `?persona=${selected.person.id}` : ''}`}
              variant="primary"
              small
            >
              + Añadir cromo
            </LinkButton>
          )}
        </div>
        <h1>{channel.name}</h1>
        <ProgressMeter progress={progress} />
        {library.packs.remaining > 0 && cards.length > 0 && (
          <LinkButton to={`/sobres/${channel.id}`} variant="secondary" small className={styles.packButton}>
            Abrir un sobre ({library.packs.remaining} hoy)
          </LinkButton>
        )}
      </header>

      {sections.length === 0 ? (
        <EmptyState>
          <p>Este álbum todavía no tiene cromos.</p>
        </EmptyState>
      ) : (
        <>
          <div className={styles.tabsViewport}>
            <div className={styles.tabs} ref={tabsRef} role="tablist" aria-label="Personas del álbum">
              {sections.map((s) => {
                const p = albumProgress(s.cards, unlocked);
                const active = s.id === selected?.id;
                return (
                  <button
                    key={s.id}
                    ref={active ? selectedTab : undefined}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={[styles.tab, active ? styles.tabActive : ''].join(' ')}
                    onClick={() => setParams({ persona: s.id }, { replace: true })}
                  >
                    {s.person ? <PersonAvatar person={s.person} size={44} /> : <span className={styles.various}>
                        <Icon name="people" size={22} />
                      </span>}
                    <span className={styles.tabName}>{s.person ? s.person.firstName : 'Varios'}</span>
                    <span className={styles.tabCount}>
                      {p.unlocked}/{p.total}
                    </span>
                  </button>
                );
              })}
            </div>
            {canPrev && (
              <button type="button" className={[styles.arrow, styles.prev].join(' ')} onClick={() => step(-1)} aria-label="Personas anteriores">
                ‹
              </button>
            )}
            {canNext && (
              <button type="button" className={[styles.arrow, styles.next].join(' ')} onClick={() => step(1)} aria-label="Más personas">
                ›
              </button>
            )}
          </div>

          {selected && (
            <section role="tabpanel" aria-label={selected.person ? selected.person.firstName : 'Varios'} className={styles.panel}>
              <ProgressMeter progress={albumProgress(selected.cards, unlocked)} compact />
              <div className={styles.grid}>
                {selected.cards.map((card) => (
                  <CardThumb
                    key={card.id}
                    card={card}
                    locked={!unlocked.has(card.id)}
                    copies={library.cardCopies[card.id] ?? 0}
                    to={`/albumes/${channel.id}/${card.id}`}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
