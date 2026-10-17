import { Link } from 'react-router-dom';
import { ProgressMeter } from '../components/ProgressMeter';
import { EmptyState, LinkButton } from '../components/ui';
import { useLibrary } from '../hooks/library-context';
import { albumProgress, ownedCardIds, sortCards } from '../utils/album';
import { CHANNEL_KIND_LABELS } from '../utils/labels';
import styles from './AlbumsPage.module.scss';

const COVER_CARDS = 3;

/** «Álbumes»: one album per channel that has cromos, with its progress. */
export function AlbumsPage() {
  const { library } = useLibrary();
  const unlocked = ownedCardIds(library.cardCopies);
  const albums = library.channels
    .map((channel) => {
      const cards = library.cards.filter((c) => c.channelId === channel.id);
      // Cover: the latest unlocked photos (locked ones would spoil the surprise).
      const cover = sortCards(cards.filter((c) => unlocked.has(c.id))).slice(-COVER_CARDS).reverse();
      return { channel, cards, cover, progress: albumProgress(cards, unlocked) };
    })
    .filter((a) => a.cards.length > 0);

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <h1>Álbumes</h1>
        {albums.length > 0 && (
          <LinkButton to="/sobres" variant={library.packs.remaining ? 'primary' : 'secondary'} small>
            🎁 Sobres ({library.packs.remaining}/{library.packs.perDay})
          </LinkButton>
        )}
      </div>
      {albums.length === 0 ? (
        <EmptyState icon="🃏">
          <p>Ninguno de tus canales tiene cromos todavía.</p>
        </EmptyState>
      ) : (
        <div className={styles.grid}>
          {albums.map(({ channel, cards, cover, progress }) => (
            <Link key={channel.id} to={`/albumes/${channel.id}`} className={styles.album}>
              <span className={styles.cover} aria-hidden>
                {cover.length ? (
                  cover.map((card) => (
                    <img key={card.id} src={card.imageUrl} alt="" loading="lazy" />
                  ))
                ) : (
                  <span className={styles.coverEmpty}>🔒</span>
                )}
              </span>
              <span className={styles.body}>
                <span className={styles.name}>{channel.name}</span>
                <span className={styles.meta}>
                  {CHANNEL_KIND_LABELS[channel.kind]} · {cards.length} {cards.length === 1 ? 'cromo' : 'cromos'}
                </span>
                <ProgressMeter progress={progress} compact />
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
