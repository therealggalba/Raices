import { useParams } from 'react-router-dom';
import { EventItem } from '../components/EventItem';
import { PersonAvatar } from '../components/PersonAvatar';
import { PersonFamily } from '../components/PersonFamily';
import { EmptyState, LinkButton } from '../components/ui';
import { ui } from '../components/ui-styles';
import { VideoRow } from '../components/VideoRow';
import { useChannel } from '../hooks/channel-context';
import { videosOfPerson } from '../utils/catalog';
import { formatPartialDate } from '../utils/dates';
import { upcomingEvents } from '../utils/events';
import { ageOn, fullName } from '../utils/people';
import styles from './PersonPage.module.scss';

export function PersonPage() {
  const { personId } = useParams();
  const { snapshot, today, isAdmin, personById } = useChannel();
  const { channel, videos, events, people, favoriteVideoIds } = snapshot;
  const person = personId ? personById(personId) : undefined;

  if (!person) {
    return (
      <EmptyState icon="🔍">
        <p>Esta persona no existe.</p>
        <LinkButton to={`/c/${channel.id}/personas`}>Ver todas las personas</LinkButton>
      </EmptyState>
    );
  }

  const age = ageOn(person.birthDate, today);
  const theirVideos = videosOfPerson(videos, person.id);
  const theirEvents = upcomingEvents(events, people, today).filter((e) => e.personIds.includes(person.id));

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <PersonAvatar person={person} size={112} />
        <div className={styles.identity}>
          {person.relationship && <span className={styles.relationship}>{person.relationship}</span>}
          <h1>{fullName(person)}</h1>
          {person.birthDate && (
            <p className={ui.muted}>
              Nació el {formatPartialDate(person.birthDate)}
              {age !== null && ` · ${age} años`}
            </p>
          )}
          {isAdmin && (
            <LinkButton to={`/c/${channel.id}/personas/${person.id}/editar`} small>
              Editar
            </LinkButton>
          )}
        </div>
      </header>

      <div className={styles.content}>
        {channel.kind === 'familia' && <PersonFamily key={person.id} person={person} />}
        {person.biography && (
          <section className={ui.section}>
            <h2>Biografía</h2>
            <p className={styles.text}>{person.biography}</p>
          </section>
        )}
        {person.notes && (
          <section className={ui.section}>
            <h2>Notas</h2>
            <p className={styles.text}>{person.notes}</p>
          </section>
        )}
        {theirEvents.length > 0 && (
          <section className={ui.section}>
            <h2>Próximas fechas</h2>
            {theirEvents.map((event) => (
              <EventItem key={event.key} event={event} people={people} />
            ))}
          </section>
        )}
      </div>

      {theirVideos.length > 0 ? (
        <VideoRow
          title={`Recuerdos con ${person.firstName}`}
          videos={theirVideos}
          favoriteIds={favoriteVideoIds}
        />
      ) : (
        <p className={[ui.muted, styles.content].join(' ')}>Todavía no aparece en ningún vídeo.</p>
      )}
    </div>
  );
}
