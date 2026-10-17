import { FamilyTree } from '../components/FamilyTree';
import { EmptyState, LinkButton } from '../components/ui';
import { useChannel } from '../hooks/channel-context';
import { PeopleViewSwitch } from './PeopleViewSwitch';
import { ui } from '../components/ui-styles';

/** Family tree of a family channel (Personas › Árbol). */
export function TreePage() {
  const { snapshot, isAdmin } = useChannel();
  const { channel, people, partnerships, me } = snapshot;
  const viewer = people.find((p) => p.id === me.personId);

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
            {viewer
              ? ' Cada tarjeta dice qué es de ti.'
              : ' ¿Estás en el árbol? Abre tu ficha y pulsa «Esta persona soy yo» para ver tu parentesco con cada uno.'}
            {isAdmin && ' Los vínculos se editan en la ficha de cada persona.'}
          </p>
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
