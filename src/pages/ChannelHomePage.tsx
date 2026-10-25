import { Link } from 'react-router-dom';
import { EventItem } from '../components/EventItem';
import { Hero } from '../components/Hero';
import { PendingSection } from '../components/PendingSection';
import { PersonAvatar } from '../components/PersonAvatar';
import { EmptyState, LinkButton } from '../components/ui';
import { VideoRow } from '../components/VideoRow';
import { useChannel } from '../hooks/channel-context';
import { buildCatalogRows, featuredVideo } from '../utils/catalog';
import { ALERT_WINDOW_DAYS, upcomingEvents } from '../utils/events';
import { canUpload } from '../utils/permissions';
import { isPet, sortPeople } from '../utils/people';
import styles from './ChannelHomePage.module.scss';

/** One channel's videos: hero, upcoming-event alerts, rows by category, people. */
export function ChannelHomePage() {
  const { snapshot, today, readOnly } = useChannel();
  const { channel, videos, people, events, favoriteVideoIds } = snapshot;
  const hero = featuredVideo(videos);
  const rows = buildCatalogRows(videos, favoriteVideoIds);
  const alerts = upcomingEvents(events, people, today, ALERT_WINDOW_DAYS);
  // Living people (oldest first), then living pets; those who passed away
  // only appear in the full list of people.
  const living = sortPeople(people).filter((p) => !p.deathDate);
  const shown = [...living.filter((p) => !isPet(p)), ...living.filter(isPet)];

  return (
    <div className={styles.home}>
      {hero ? (
        <Hero video={hero} kicker={`${channel.name} · último recuerdo añadido`} />
      ) : (
        <EmptyState>
          <h1>{channel.name}</h1>
          <p>Este canal todavía no tiene recuerdos.</p>
          {canUpload(snapshot.me) && !readOnly && (
            <LinkButton to={`/c/${channel.id}/subir`} variant="primary">
              Añadir el primer vídeo
            </LinkButton>
          )}
        </EmptyState>
      )}

      <PendingSection />

      {alerts.length > 0 && (
        <section className={styles.alerts} aria-label="Próximos eventos">
          <h2 className={styles.rowTitle}>No te olvides</h2>
          <div className={styles.alertList}>
            {alerts.map((event) => (
              <EventItem key={event.key} event={event} people={people} />
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

      {shown.length > 0 && (
        <section className={styles.people} aria-label="Personas">
          <h2 className={styles.rowTitle}>Las personas del canal</h2>
          <div className={styles.peopleScroller}>
            {shown.map((person) => (
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
