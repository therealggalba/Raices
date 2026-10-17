import { useParams } from 'react-router-dom';
import { EventItem } from '../components/EventItem';
import { PersonAvatar } from '../components/PersonAvatar';
import { PersonFamily } from '../components/PersonFamily';
import { Button, EmptyState, ErrorBanner, LinkButton } from '../components/ui';
import { ui } from '../components/ui-styles';
import { VideoRow } from '../components/VideoRow';
import { useChannel } from '../hooks/channel-context';
import { useAction } from '../hooks/useAction';
import { repository } from '../services';
import { videosOfPerson } from '../utils/catalog';
import { formatPartialDate } from '../utils/dates';
import { upcomingEvents } from '../utils/events';
import { fullName, lifeAge, relationTo } from '../utils/people';
import styles from './PersonPage.module.scss';

export function PersonPage() {
  const { personId } = useParams();
  const { snapshot, today, isAdmin, personById, reload } = useChannel();
  const { channel, videos, events, people, partnerships, favoriteVideoIds, me, members } = snapshot;
  const { run, pending, error } = useAction();
  const person = personId ? personById(personId) : undefined;

  if (!person) {
    return (
      <EmptyState icon="🔍">
        <p>Esta persona no existe.</p>
        <LinkButton to={`/c/${channel.id}/personas`}>Ver todas las personas</LinkButton>
      </EmptyState>
    );
  }

  const age = lifeAge(person, today);
  const relation = relationTo(person, me.personId, people, partnerships);
  const isMe = me.personId === person.id;
  const linkedMember = members.find((m) => m.personId === person.id);
  const link = (personId: string | null) =>
    run(async () => {
      await repository.linkMemberPerson(channel.id, me.userId, personId);
      await reload();
      return true;
    });
  const theirVideos = videosOfPerson(videos, person.id);
  const theirEvents = upcomingEvents(events, people, today).filter((e) => e.personIds.includes(person.id));

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <PersonAvatar person={person} size={112} />
        <div className={styles.identity}>
          {relation && <span className={styles.relationship}>{relation}</span>}
          <h1>
            {fullName(person)}
            {person.deathDate && (
              <span className={styles.cross} title="Fallecido/a" aria-label="fallecido/a">
                {' '}
                ✝
              </span>
            )}
          </h1>
          {person.birthDate && (
            <p className={ui.muted}>
              Nació el {formatPartialDate(person.birthDate)}
              {age !== null && !age.deceased && ` · ${age.years} años`}
            </p>
          )}
          {person.deathDate && (
            <p className={ui.muted}>
              ✝ Falleció el {formatPartialDate(person.deathDate)}
              {age !== null && ` · a los ${age.years} años`}
            </p>
          )}
          {channel.kind === 'familia' &&
            (isMe ? (
              <p className={styles.me}>
                ✓ Esta persona eres tú: el árbol muestra tu parentesco con cada uno.{' '}
                <Button variant="ghost" small disabled={pending} onClick={() => void link(null)}>
                  No soy yo
                </Button>
              </p>
            ) : linkedMember ? (
              <p className={ui.muted}>
                Es {linkedMember.displayName} en el canal.
                {isAdmin && linkedMember.userId !== me.userId && ' (Si es un error, puedes deshacerlo en Canal › Miembros.)'}
              </p>
            ) : (
              <Button small disabled={pending} onClick={() => void link(person.id)}>
                Esta persona soy yo
              </Button>
            ))}
          <ErrorBanner message={error} />
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
