import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Hero } from '../components/Hero';
import { EmptyState, LinkButton } from '../components/ui';
import { UpcomingStrip } from '../components/UpcomingStrip';
import { VideoRow } from '../components/VideoRow';
import { useLibrary } from '../hooks/library-context';
import { featuredVideo } from '../utils/catalog';
import { upcomingEvents } from '../utils/events';
import { packStatusText } from '../utils/packs';
import { buildHomeRows } from '../utils/home';
import styles from './HomePage.module.scss';

/** How many upcoming dates «No te olvides» shows. */
const UPCOMING_SHOWN = 3;

/**
 * Global home: a curated selection of every channel's videos, mixed. The
 * complete list (with filters) is the catalog.
 */
export function HomePage() {
  const { library, today, channelById } = useLibrary();
  const { videos, people, events, favoriteVideoIds } = library;
  // New remix on every visit to the home screen.
  const [remixSeed] = useState(() => Math.floor(Math.random() * 2 ** 31));

  if (!library.channels.length) {
    return (
      <EmptyState>
        <h1>Bienvenido a Raíces</h1>
        <p>Únete al canal de tu familia con un código de invitación o crea uno nuevo.</p>
        <div className={styles.emptyActions}>
          <LinkButton to="/unirse">Unirme con código</LinkButton>
          <LinkButton to="/nuevo" variant="primary">
            Crear canal
          </LinkButton>
        </div>
      </EmptyState>
    );
  }

  const hero = featuredVideo(videos);
  const rows = buildHomeRows(library, today, remixSeed);
  const upcoming = upcomingEvents(events, people, today).slice(0, UPCOMING_SHOWN);
  const hasAlbums = library.cards.length > 0;

  return (
    <div className={styles.home}>
      {hero ? (
        <Hero video={hero} kicker={`${channelById(hero.channelId)?.name ?? ''} · último recuerdo añadido`} />
      ) : (
        <EmptyState>
          <p>Tus canales todavía no tienen vídeos.</p>
        </EmptyState>
      )}

      {(upcoming.length > 0 || hasAlbums) && (
        <section className={styles.alerts} aria-label="No te olvides">
          <div className={styles.rowHead}>
            <h2 className={styles.rowTitle}>No te olvides</h2>
            <Link to="/fechas" className={styles.more}>
              Todas las fechas ›
            </Link>
          </div>
          {hasAlbums && (
            <Link
              to="/sobres"
              className={[styles.packs, library.packs.remaining === 0 ? styles.packsDone : ''].join(' ')}
            >
              <span className={styles.packsText}>
                <strong>{packStatusText(library.packs)}</strong>
                {library.packs.remaining > 0 && <span>Elige álbum y descubre nuevos cromos</span>}
              </span>
              {library.packs.remaining > 0 && <span className={styles.packsCta}>Abrir ›</span>}
            </Link>
          )}
          {upcoming.length > 0 && <UpcomingStrip events={upcoming} />}
        </section>
      )}

      {rows.map((row) => (
        <VideoRow
          key={row.id}
          title={row.title}
          videos={row.videos}
          favoriteIds={favoriteVideoIds}
          ranked={row.ranked}
          moreTo={row.catalogQuery !== undefined ? `/catalogo?${row.catalogQuery}` : undefined}
        />
      ))}

      {videos.length > 0 && (
        <div className={styles.catalogCta}>
          <LinkButton to="/catalogo" variant="secondary">
            Explorar el catálogo completo · {videos.length} vídeos
          </LinkButton>
        </div>
      )}
    </div>
  );
}
