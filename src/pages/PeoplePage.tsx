import { Link } from 'react-router-dom';
import { PersonAvatar } from '../components/PersonAvatar';
import { EmptyState, LinkButton } from '../components/ui';
import { ui } from '../components/ui-styles';
import { useChannel } from '../hooks/channel-context';
import { ageOn, fullName, sortPeople } from '../utils/people';
import styles from './PeoplePage.module.scss';

export function PeoplePage() {
  const { snapshot, today, isAdmin } = useChannel();
  const { channel, people, videos } = snapshot;

  return (
    <div className={[ui.page, ui.pageWide].join(' ')}>
      <div className={ui.pageHeader}>
        <h1>Personas</h1>
        {isAdmin && (
          <LinkButton to={`/c/${channel.id}/personas/nueva`} variant="primary" small>
            + Añadir persona
          </LinkButton>
        )}
      </div>
      {people.length === 0 ? (
        <EmptyState icon="☺">
          <p>Todavía no hay personas en este canal.</p>
        </EmptyState>
      ) : (
        <div className={styles.grid}>
          {sortPeople(people).map((person) => {
            const age = ageOn(person.birthDate, today);
            const count = videos.filter((v) => v.personIds.includes(person.id)).length;
            return (
              <Link key={person.id} to={`/c/${channel.id}/personas/${person.id}`} className={styles.card}>
                <PersonAvatar person={person} size={64} />
                <span className={styles.body}>
                  <strong>{fullName(person)}</strong>
                  {person.relationship && <span className={ui.muted}>{person.relationship}</span>}
                  <span className={styles.meta}>
                    {age !== null && `${age} años · `}
                    {count} {count === 1 ? 'vídeo' : 'vídeos'}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
