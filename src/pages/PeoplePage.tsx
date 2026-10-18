import { Link, useSearchParams } from 'react-router-dom';
import { PersonAvatar } from '../components/PersonAvatar';
import { EmptyState, LinkButton } from '../components/ui';
import { ui } from '../components/ui-styles';
import { useChannel } from '../hooks/channel-context';
import { SPECIES_LABELS } from '../utils/labels';
import { fullName, isPet, lifeAge, relationTo, sortPeople } from '../utils/people';
import type { Person } from '../types/domain';
import styles from './PeoplePage.module.scss';
import { PeopleViewSwitch } from './PeopleViewSwitch';

export function PeoplePage() {
  const { snapshot, today, isAdmin } = useChannel();
  const { channel, people, videos, partnerships, me } = snapshot;

  // «Personas» or «Mascotas» (?ver=mascotas), chosen in the header.
  const [params, setParams] = useSearchParams();
  const pets = params.get('ver') === 'mascotas';
  const sorted = sortPeople(people).filter((p) => isPet(p) === pets);
  const alive = sorted.filter((p) => !p.deathDate);
  const deceased = sorted.filter((p) => p.deathDate);

  const card = (person: Person) => {
    const age = lifeAge(person, today);
    const relation = isPet(person)
      ? SPECIES_LABELS[person.species ?? 'otro']
      : channel.kind === 'familia' && me.personId
        ? relationTo(person, me.personId, people, partnerships)
        : '';
    const count = videos.filter((v) => v.personIds.includes(person.id)).length;
    return (
      <Link key={person.id} to={`/c/${channel.id}/personas/${person.id}`} className={styles.card}>
        <PersonAvatar person={person} size={64} />
        <span className={styles.body}>
          <strong className="one-line">
            {fullName(person)}
            {person.deathDate && <span title="Fallecido/a"> ✝</span>}
          </strong>
          {relation && <span className={[ui.muted, 'one-line'].join(' ')}>{relation}</span>}
          <span className={[styles.meta, 'one-line'].join(' ')}>
            {age !== null && (age.deceased ? `✝ a los ${age.years} · ` : `${age.years} años · `)}
            {count} {count === 1 ? 'vídeo' : 'vídeos'}
          </span>
        </span>
      </Link>
    );
  };

  return (
    <div className={[ui.page, ui.pageWide].join(' ')}>
      <div className={ui.pageHeader}>
        <h1>{pets ? 'Mascotas' : 'Personas'}</h1>
        <div className={ui.chips}>
          {channel.kind === 'familia' && !pets && <PeopleViewSwitch channelId={channel.id} active="lista" />}
          <select
            className={[ui.input, styles.kindSelect].join(' ')}
            value={pets ? 'mascotas' : 'personas'}
            onChange={(e) => setParams(e.target.value === 'mascotas' ? { ver: 'mascotas' } : {}, { replace: true })}
            aria-label="Ver personas o mascotas"
          >
            <option value="personas">Personas</option>
            <option value="mascotas">Mascotas</option>
          </select>
          {isAdmin && (
            <LinkButton to={`/c/${channel.id}/personas/nueva${pets ? '?tipo=mascota' : ''}`} variant="primary" small>
              Añadir
            </LinkButton>
          )}
        </div>
      </div>
      {sorted.length === 0 ? (
        <EmptyState>
          <p>{pets ? 'Todavía no hay mascotas en este canal.' : 'Todavía no hay personas en este canal.'}</p>
        </EmptyState>
      ) : (
        <>
          <div className={styles.grid}>{alive.map(card)}</div>
          {deceased.length > 0 && (
            // People who passed away: kept for the tree and the videos, out of the way.
            <details className={styles.deceased}>
              <summary>Fallecidos ({deceased.length})</summary>
              <div className={styles.grid}>{deceased.map(card)}</div>
            </details>
          )}
        </>
      )}
    </div>
  );
}
