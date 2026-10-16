import { Link } from 'react-router-dom';
import { EventItem } from '../components/EventItem';
import { Hero } from '../components/Hero';
import { PersonAvatar } from '../components/PersonAvatar';
import { EmptyState, LinkButton } from '../components/ui';
import { VideoRow } from '../components/VideoRow';
import { useChannel } from '../hooks/channel-context';
import { buildCatalogRows, featuredVideo } from '../utils/catalog';
import { eventAlerts, upcomingEvents } from '../utils/events';
import { sortPeople } from '../utils/people';
import styles from './ChannelHomePage.module.scss';

/** One channel's videos: hero, upcoming-event alerts, rows by category, people. */
export function ChannelHomePage() {
  const { snapshot, today, isAdmin } = useChannel();
  const { channel, videos, people, events, favoriteVideoIds } = snapshot;
  const hero = featuredVideo(videos);
  const rows = buildCatalogRows(videos, favoriteVideoIds);
  const alerts = eventAlerts(upcomingEvents(events, people, today));

  return (
    <div className={styles.home}>
      {hero ? (
        <Hero video={hero} kicker={`${channel.name} · último recuerdo añadido`} />
      ) : (
        <EmptyState icon="📼">
          <h1>{channel.name}</h1>
          <p>Este canal todavía no tiene recuerdos.</p>
          {isAdmin && (
            <LinkButton to={`/c/${channel.id}/subir`} variant="primary">
              Añadir el primer vídeo
            </LinkButton>
          )}
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
        />
      ))}

      {people.length > 0 && (
        <section className={styles.people} aria-label="Personas">
          <h2 className={styles.rowTitle}>Las personas del canal</h2>
          <div className={styles.peopleScroller}>
            {sortPeople(people).map((person) => (
              <Link key={person.id} to={`/c/${channel.id}/personas/${person.id}`} className={styles.person}>
                <PersonAvatar person={person} size={72} />
                <span>{person.firstName}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
