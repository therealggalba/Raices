import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { Partnership, Person } from '../types/domain';
import { formatPartialDate } from '../utils/dates';
import { DEFAULT_TREE_SIZES, layoutTree } from '../utils/familyTree';
import { kinship, capitalize } from '../utils/kinship';
import { fullName } from '../utils/people';
import styles from './FamilyTree.module.scss';

const PAD = 28;
const { cardWidth: W, cardHeight: H } = DEFAULT_TREE_SIZES;

interface Props {
  people: readonly Person[];
  partnerships: readonly Partnership[];
  /** Link for a person's card. */
  personHref(person: Person): string;
  /** The viewer's own person («Yo»): kinship is shown relative to them and the tree starts centred on them. */
  viewerPersonId?: string;
}

/** «n. 12 mar 1941» or «1941 – ✝ 2020». */
function lifeLine(person: Person): string {
  if (person.deathDate) {
    const born = person.birthDate ? person.birthDate.slice(0, 4) : '?';
    return `${born} – ✝ ${person.deathDate.slice(0, 4)}`;
  }
  return person.birthDate ? `n. ${formatPartialDate(person.birthDate)}` : 'Fecha desconocida';
}

/**
 * Generations top to bottom. Couples are joined by a line with a ring
 * (dashed when separated); arrows go down from the parents to each child.
 * Each card: kinship to the viewer (when they said who they are), full
 * name and dates. Scrolls in both directions.
 */
export function FamilyTree({ people, partnerships, personHref, viewerPersonId }: Props) {
  const layout = layoutTree(people, partnerships);
  const width = layout.width + PAD * 2;
  const height = layout.height + PAD * 2;
  const scroller = useRef<HTMLDivElement>(null);

  // Start centred on the viewer's card, or on the middle of the tree.
  const viewerNode = layout.nodes.find((n) => n.person.id === viewerPersonId);
  const focusX = viewerNode ? PAD + viewerNode.x + W / 2 : width / 2;
  const focusY = viewerNode ? PAD + viewerNode.y + H / 2 : 0;
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollLeft = focusX - el.clientWidth / 2;
    el.scrollTop = viewerNode ? focusY - el.clientHeight / 2 : 0;
  }, [focusX, focusY, viewerNode]);

  return (
    <div className={styles.scroller} ref={scroller}>
      <div className={styles.canvas} style={{ width, height }}>
        <svg className={styles.lines} width={width} height={height} aria-hidden>
          <defs>
            <marker id="tree-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" className={styles.arrowHead} />
            </marker>
          </defs>
          <g transform={`translate(${PAD} ${PAD})`}>
            {layout.families.map((f) => {
              const xs = [f.fromX, ...f.children.map((c) => c.x)];
              return (
                <g key={f.key} className={styles.family}>
                  <path d={`M${f.fromX},${f.fromY} V${f.busY}`} />
                  <path d={`M${Math.min(...xs)},${f.busY} H${Math.max(...xs)}`} />
                  {f.children.map((c) => (
                    <path key={`${c.x}-${c.y}`} d={`M${c.x},${f.busY} V${c.y - 3}`} markerEnd="url(#tree-arrow)" />
                  ))}
                </g>
              );
            })}
            {layout.couples.map((c) => (
              <line
                key={c.partnership.id}
                x1={c.x1}
                x2={c.x2}
                y1={c.y}
                y2={c.y}
                className={[styles.couple, c.separated ? styles.separated : ''].join(' ')}
              />
            ))}
          </g>
        </svg>


        {layout.nodes.map(({ person, x, y }) => {
          const relation = viewerPersonId ? kinship(viewerPersonId, person.id, people, partnerships) : null;
          const isMe = person.id === viewerPersonId;
          return (
            <Link
              key={person.id}
              to={personHref(person)}
              className={[styles.card, isMe ? styles.me : '', person.deathDate ? styles.deceased : ''].join(' ')}
              style={{ left: PAD + x, top: PAD + y, width: W, height: H }}
            >
              {relation && <span className={[styles.relation, 'one-line'].join(' ')}>{capitalize(relation)}</span>}
              <span className={[styles.name, 'one-line'].join(' ')}>{fullName(person)}</span>
              <span className={[styles.birth, 'one-line'].join(' ')}>{lifeLine(person)}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
