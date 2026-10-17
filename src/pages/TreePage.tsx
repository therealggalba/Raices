import { FamilyTree } from '../components/FamilyTree';
import { EmptyState, LinkButton } from '../components/ui';
import { useChannel } from '../hooks/channel-context';
import { PeopleViewSwitch } from './PeopleViewSwitch';
import { ui } from '../components/ui-styles';

/** Family tree of a family channel (Personas › Árbol). */
export function TreePage() {
  const { snapshot, isAdmin } = useChannel();
  const { channel, people, partnerships } = snapshot;

  return (
    <div className={[ui.page, ui.pageWide].join(' ')}>
      <div className={ui.pageHeader}>
        <h1>Árbol familiar</h1>
        <PeopleViewSwitch channelId={channel.id} active="arbol" />
      </div>
      {people.length === 0 ? (
        <EmptyState icon="🌳">
          <p>Añade personas al canal para empezar el árbol.</p>
          {isAdmin && <LinkButton to={`/c/${channel.id}/personas/nueva`}>Añadir persona</LinkButton>}
        </EmptyState>
      ) : (
        <>
          <p className={ui.muted}>
            💍 une a las parejas y las flechas bajan de padres a hijos.
            {isAdmin && ' Los vínculos se editan en la ficha de cada persona.'}
          </p>
          <FamilyTree people={people} partnerships={partnerships} personHref={(p) => `/c/${channel.id}/personas/${p.id}`} />
        </>
      )}
    </div>
  );
}
