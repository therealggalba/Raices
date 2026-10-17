import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { Partnership, Person } from '../types/domain';
import { formatPartialDate } from '../utils/dates';
import { DEFAULT_TREE_SIZES, layoutTree } from '../utils/familyTree';
import { fullName } from '../utils/people';
import styles from './FamilyTree.module.scss';

const PAD = 28;
const { cardWidth: W, cardHeight: H } = DEFAULT_TREE_SIZES;

interface Props {
  people: readonly Person[];
  partnerships: readonly Partnership[];
  /** Link for a person's card. */
  personHref(person: Person): string;
}

/**
 * Generations top to bottom. Couples are joined by a line with a ring
 * (dashed when separated); arrows go down from the parents to each child.
 * Each card: full name and date of birth. Scrolls in both directions.
 */
export function FamilyTree({ people, partnerships, personHref }: Props) {
  const layout = layoutTree(people, partnerships);
  const width = layout.width + PAD * 2;
  const height = layout.height + PAD * 2;
  const scroller = useRef<HTMLDivElement>(null);

  // Start centred on the oldest generation.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, [width]);

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

        {layout.couples.map((c) => (
          <span
            key={c.partnership.id}
            className={[styles.ring, c.separated ? styles.ringSeparated : ''].join(' ')}
            style={{ left: PAD + (c.x1 + c.x2) / 2, top: PAD + c.y }}
            title={
              [
                c.partnership.since && `Desde ${formatPartialDate(c.partnership.since)}`,
                c.partnership.until && `separados en ${formatPartialDate(c.partnership.until)}`,
              ]
                .filter(Boolean)
                .join(', ') || 'Pareja'
            }
          >
            💍
          </span>
        ))}

        {layout.nodes.map(({ person, x, y }) => (
          <Link
            key={person.id}
            to={personHref(person)}
            className={styles.card}
            style={{ left: PAD + x, top: PAD + y, width: W, height: H }}
          >
            <span className={styles.name}>{fullName(person)}</span>
            <span className={styles.birth}>{person.birthDate ? `n. ${formatPartialDate(person.birthDate)}` : 'Fecha desconocida'}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
