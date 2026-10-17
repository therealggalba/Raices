import type { Gender, Partnership, Person } from '../types/domain';

// Kinship of anyone in a channel relative to the viewer («Yo»), derived from
// parents and couples only. Spanish words depend on the gender of the person
// described; without it, the double form is used («tío/a»).

/** [masculine, feminine, unknown]. */
type Word = readonly [string, string, string];

const w = (m: string, f: string, n: string): Word => [m, f, n];

const ANCESTORS: Word[] = [
  w('padre', 'madre', 'padre/madre'),
  w('abuelo', 'abuela', 'abuelo/a'),
  w('bisabuelo', 'bisabuela', 'bisabuelo/a'),
  w('tatarabuelo', 'tatarabuela', 'tatarabuelo/a'),
];
const DESCENDANTS: Word[] = [
  w('hijo', 'hija', 'hijo/a'),
  w('nieto', 'nieta', 'nieto/a'),
  w('bisnieto', 'bisnieta', 'bisnieto/a'),
  w('tataranieto', 'tataranieta', 'tataranieto/a'),
];
const SIBLING = w('hermano', 'hermana', 'hermano/a');
/** Brother/sister of an ancestor at depth 1, 2, 3. */
const UNCLES: Word[] = [w('tío', 'tía', 'tío/a'), w('tío abuelo', 'tía abuela', 'tío/a abuelo/a'), w('tío bisabuelo', 'tía bisabuela', 'tío/a bisabuelo/a')];
/** Descendant of a sibling at depth 1, 2, 3. */
const NEPHEWS: Word[] = [w('sobrino', 'sobrina', 'sobrino/a'), w('sobrino nieto', 'sobrina nieta', 'sobrino/a nieto/a'), w('sobrino bisnieto', 'sobrina bisnieta', 'sobrino/a bisnieto/a')];
const COUSINS: Word[] = [w('primo', 'prima', 'primo/a'), w('primo segundo', 'prima segunda', 'primo/a segundo/a'), w('primo tercero', 'prima tercera', 'primo/a tercero/a')];
const FAMILY = w('familiar', 'familiar', 'familiar');

const STEP_PARENT = w('padrastro', 'madrastra', 'padrastro/madrastra');
const STEP_CHILD = w('hijastro', 'hijastra', 'hijastro/a');
const CHILD_IN_LAW = w('yerno', 'nuera', 'yerno/nuera');
const PARENT_IN_LAW = w('suegro', 'suegra', 'suegro/a');
const SIBLING_IN_LAW = w('cuñado', 'cuñada', 'cuñado/a');
const CO_PARENT_IN_LAW = w('consuegro', 'consuegra', 'consuegro/a');
const SPOUSE = w('marido', 'mujer', 'esposo/a');
const PARTNER = w('pareja', 'pareja', 'pareja');
const EX_PARTNER = w('expareja', 'expareja', 'expareja');

const pick = (word: Word, gender: Gender | undefined) =>
  gender === 'hombre' ? word[0] : gender === 'mujer' ? word[1] : word[2];

const political = (word: Word): Word => [`${word[0]} político`, `${word[1]} política`, `${word[2]} político/a`];

type Blood = { kind: 'self' } | { kind: 'blood'; up: number; down: number };

class FamilyGraph {
  private readonly parents = new Map<string, string[]>();
  private readonly partners = new Map<string, { id: string; partnership: Partnership }[]>();

  constructor(people: readonly Person[], partnerships: readonly Partnership[]) {
    const ids = new Set(people.map((p) => p.id));
    for (const p of people) this.parents.set(p.id, p.parentIds.filter((id) => ids.has(id)));
    for (const c of partnerships) {
      const [a, b] = c.personIds;
      if (!ids.has(a) || !ids.has(b)) continue;
      this.partners.set(a, [...(this.partners.get(a) ?? []), { id: b, partnership: c }]);
      this.partners.set(b, [...(this.partners.get(b) ?? []), { id: a, partnership: c }]);
    }
  }

  /** Every ancestor (and the person, at 0) with the shortest number of steps up. */
  private ancestors(id: string): Map<string, number> {
    const dist = new Map([[id, 0]]);
    const queue = [id];
    while (queue.length) {
      const current = queue.shift()!;
      for (const parent of this.parents.get(current) ?? []) {
        if (dist.has(parent)) continue;
        dist.set(parent, dist.get(current)! + 1);
        queue.push(parent);
      }
    }
    return dist;
  }

  /** Blood relation through the closest common ancestor. */
  blood(from: string, to: string): Blood | null {
    if (from === to) return { kind: 'self' };
    const mine = this.ancestors(from);
    const theirs = this.ancestors(to);
    let best: { up: number; down: number } | null = null;
    for (const [id, up] of mine) {
      const down = theirs.get(id);
      if (down === undefined) continue;
      if (!best || up + down < best.up + best.down) best = { up, down };
    }
    return best ? { kind: 'blood', ...best } : null;
  }

  partnersOf(id: string) {
    return this.partners.get(id) ?? [];
  }

  parentsOf(id: string) {
    return this.parents.get(id) ?? [];
  }
}

/** Word for a blood relation, or null when it is too distant to have a usual name. */
function bloodWord(rel: { up: number; down: number }): Word | null {
  const { up, down } = rel;
  if (down === 0) return ANCESTORS[up - 1] ?? null;
  if (up === 0) return DESCENDANTS[down - 1] ?? null;
  if (up === 1 && down === 1) return SIBLING;
  if (down === 1) return UNCLES[up - 2] ?? null;
  if (up === 1) return NEPHEWS[down - 2] ?? null;
  if (up === down) return COUSINS[up - 2] ?? null;
  return FAMILY;
}

/**
 * How `targetId` is related to `viewerId` («tío», «suegra», «prima segunda»…),
 * or null when they are not related through the tree.
 */
export function kinship(
  viewerId: string,
  targetId: string,
  people: readonly Person[],
  partnerships: readonly Partnership[],
): string | null {
  const byId = new Map(people.map((p) => [p.id, p]));
  const target = byId.get(targetId);
  if (!target || !byId.has(viewerId)) return null;
  const gender = target.gender;
  const graph = new FamilyGraph(people, partnerships);

  const blood = graph.blood(viewerId, targetId);
  if (blood?.kind === 'self') return 'Yo';
  if (blood) {
    const word = bloodWord(blood);
    return word ? pick(word, gender) : null;
  }

  // Couples: my partner…
  const mine = graph.partnersOf(viewerId).find((p) => p.id === targetId);
  if (mine) {
    const { since, until } = mine.partnership;
    return pick(until ? EX_PARTNER : since ? SPOUSE : PARTNER, gender);
  }

  // …the partner of one of my blood relatives…
  for (const { id: partnerId, partnership } of graph.partnersOf(targetId)) {
    if (partnership.until) continue;
    const rel = graph.blood(viewerId, partnerId);
    if (rel?.kind !== 'blood') continue;
    if (rel.up === 1 && rel.down === 0) return pick(STEP_PARENT, gender);
    if (rel.up === 0 && rel.down === 1) return pick(CHILD_IN_LAW, gender);
    if (rel.up === 1 && rel.down === 1) return pick(SIBLING_IN_LAW, gender);
    const word = bloodWord(rel);
    if (word && word !== FAMILY) return pick(political(word), gender);
  }

  // …a blood relative of my partner…
  for (const { id: partnerId, partnership } of graph.partnersOf(viewerId)) {
    if (partnership.until) continue;
    const rel = graph.blood(partnerId, targetId);
    if (rel?.kind !== 'blood') continue;
    if (rel.up === 0 && rel.down === 1) return pick(STEP_CHILD, gender);
    if (rel.up === 1 && rel.down === 0) return pick(PARENT_IN_LAW, gender);
    if (rel.up === 1 && rel.down === 1) return pick(SIBLING_IN_LAW, gender);
    const word = bloodWord(rel);
    if (word && word !== FAMILY) return pick(political(word), gender);
  }

  // …or the parent of my child's partner.
  for (const child of people.filter((p) => graph.parentsOf(p.id).includes(viewerId))) {
    for (const { id: inLaw } of graph.partnersOf(child.id)) {
      if (graph.parentsOf(inLaw).includes(targetId)) return pick(CO_PARENT_IN_LAW, gender);
    }
  }
  return null;
}

/** «tío abuelo» -> «Tío abuelo». */
export function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase('es') + text.slice(1);
}
