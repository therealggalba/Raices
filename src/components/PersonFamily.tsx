import { Link } from 'react-router-dom';
import { useChannel } from '../hooks/channel-context';
import type { Person } from '../types/domain';
import { formatPartialDate } from '../utils/dates';
import { relativesOf } from '../utils/familyTree';
import { PersonAvatar } from './PersonAvatar';
import { ui } from './ui-styles';
import styles from './PersonFamily.module.scss';

/** «Familia» section of a person (read only: links are edited in «Editar»). */
export function PersonFamily({ person }: { person: Person }) {
  const { snapshot, isOwner } = useChannel();
  const { channel, people, partnerships } = snapshot;
  const family = relativesOf(person, people, partnerships);
  const empty = !family.parents.length && !family.partners.length && !family.children.length && !family.siblings.length;

  const chip = (p: Person, extra?: string) => (
    <Link key={p.id} to={`/c/${channel.id}/personas/${p.id}`} className={styles.chip}>
      <PersonAvatar person={p} size={32} />
      <span>
        {p.firstName}
        {extra && <small>{extra}</small>}
      </span>
    </Link>
  );

  const group = (title: string, list: Person[]) =>
    list.length > 0 && (
      <div className={styles.group}>
        <h3>{title}</h3>
        <div className={styles.chips}>{list.map((p) => chip(p))}</div>
      </div>
    );

  return (
    <section className={ui.section}>
      <div className={styles.head}>
        <h2>Familia</h2>
        <Link to={`/c/${channel.id}/arbol`} className={styles.treeLink}>
          Ver en el árbol ›
        </Link>
      </div>
      {empty && !isOwner && <p className={ui.muted}>Todavía no tiene vínculos en el árbol.</p>}
      {group(family.parents.length === 1 ? 'Progenitor' : 'Padres', family.parents)}

      {family.partners.length > 0 && (
        <div className={styles.group}>
          <h3>Pareja</h3>
          <div className={styles.chips}>
            {family.partners.map(({ person: partner, partnership }) =>
              chip(
                partner,
                [
                  partnership.since && `desde ${formatPartialDate(partnership.since)}`,
                  partnership.until && `separados ${formatPartialDate(partnership.until)}`,
                ]
                  .filter(Boolean)
                  .join(' · ') || undefined,
              ),
            )}
          </div>
        </div>
      )}

      {group('Hijos', family.children)}
      {group('Hermanos', family.siblings)}
    </section>
  );
}
