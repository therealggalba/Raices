import { EventItem } from '../components/EventItem';
import { Hero } from '../components/Hero';
import { EmptyState, LinkButton } from '../components/ui';
import { VideoRow } from '../components/VideoRow';
import { useLibrary } from '../hooks/library-context';
import { featuredVideo } from '../utils/catalog';
import { eventAlerts, upcomingEvents } from '../utils/events';
import { buildHomeRows } from '../utils/home';
import styles from './HomePage.module.scss';

/**
 * Global home: a curated selection of every channel's videos, mixed. The
 * complete list (with filters) is the catalog.
 */
export function HomePage() {
  const { library, today, channelById } = useLibrary();
  const { videos, people, events, favoriteVideoIds } = library;

  if (!library.channels.length) {
    return (
      <EmptyState icon="📼">
        <h1>Bienvenido a FamilyMemories</h1>
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
  const rows = buildHomeRows(library, today);
  const alerts = eventAlerts(upcomingEvents(events, people, today));

  return (
    <div className={styles.home}>
      {hero ? (
        <Hero video={hero} kicker={`${channelById(hero.channelId)?.name ?? ''} · último recuerdo añadido`} />
      ) : (
        <EmptyState icon="📼">
          <p>Tus canales todavía no tienen vídeos.</p>
        </EmptyState>
      )}

      {alerts.length > 0 && (
        <section className={styles.alerts} aria-label="Próximos eventos">
          <h2 className={styles.rowTitle}>No te olvides</h2>
          <div className={styles.alertList}>
            {alerts.map((event) => (
              <EventItem key={event.key} event={event} people={people} highlight />
            ))}
          </div>
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
