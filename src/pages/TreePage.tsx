import { FamilyTree } from '../components/FamilyTree';
import { EmptyState, LinkButton } from '../components/ui';
import { useChannel } from '../hooks/channel-context';
import { PeopleViewSwitch } from './PeopleViewSwitch';
import { ui } from '../components/ui-styles';
import { humansOnly } from '../utils/people';

/** Family tree of a family channel (Personas › Árbol). */
export function TreePage() {
  const { snapshot, isAdmin } = useChannel();
  const { channel, partnerships, me } = snapshot;
  // The family tree is about people (pets have their own list).
  const people = humansOnly(snapshot.people);
  const viewer = people.find((p) => p.id === me.personId);

  return (
    <div className={[ui.page, ui.pageWide].join(' ')}>
      <div className={ui.pageHeader}>
        <h1>Árbol familiar</h1>
        <PeopleViewSwitch channelId={channel.id} active="arbol" />
      </div>
      {people.length === 0 ? (
        <EmptyState>
          <p>Añade personas al canal para empezar el árbol.</p>
          {isAdmin && <LinkButton to={`/c/${channel.id}/personas/nueva`}>Añadir persona</LinkButton>}
        </EmptyState>
      ) : (
        <>
          <FamilyTree
            people={people}
            partnerships={partnerships}
            viewerPersonId={viewer?.id}
            personHref={(p) => `/c/${channel.id}/personas/${p.id}`}
          />
        </>
      )}
    </div>
  );
}
