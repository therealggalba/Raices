import { Link } from 'react-router-dom';
import { PackArt } from '../components/PackArt';
import { ProgressMeter } from '../components/ProgressMeter';
import { EmptyState } from '../components/ui';
import { useLibrary } from '../hooks/library-context';
import { albumProgress, ownedCardIds } from '../utils/album';
import { packStatusText } from '../utils/packs';
import styles from './PacksPage.module.scss';

/** «Sobres»: today's allowance and the albums a pack can be opened from. */
export function PacksPage() {
  const { library } = useLibrary();
  const { packs } = library;
  const owned = ownedCardIds(library.cardCopies);
  const albums = library.channels
    .map((channel) => {
      const cards = library.cards.filter((c) => c.channelId === channel.id);
      return { channel, cards, progress: albumProgress(cards, owned) };
    })
    .filter((a) => a.cards.length > 0);
  const canOpen = packs.remaining > 0;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Sobres</h1>
        <div className={styles.allowance} aria-label={packStatusText(packs)}>
          {Array.from({ length: packs.perDay }, (_, i) => (
            <span key={i} className={i < packs.remaining ? styles.full : styles.used} aria-hidden>
              🎁
            </span>
          ))}
        </div>
        <p className={styles.status}>{packStatusText(packs)}</p>
        {canOpen && <p className={styles.hint}>Elige de qué álbum quieres abrir el sobre.</p>}
      </header>

      {albums.length === 0 ? (
        <EmptyState icon="🃏">
          <p>Ninguno de tus canales tiene cromos todavía.</p>
        </EmptyState>
      ) : (
        <div className={styles.grid}>
          {albums.map(({ channel, progress }) => {
            const content = (
              <>
                <PackArt theme={channel.packTheme} title={channel.name} className={styles.pack} />
                <span className={styles.name}>{channel.name}</span>
                <ProgressMeter progress={progress} compact />
              </>
            );
            return canOpen ? (
              <Link key={channel.id} to={`/sobres/${channel.id}`} className={styles.option}>
                {content}
              </Link>
            ) : (
              <div key={channel.id} className={[styles.option, styles.disabled].join(' ')} aria-disabled="true">
                {content}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
