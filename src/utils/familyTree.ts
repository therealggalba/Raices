import type { Partnership, PartnershipInput, Person } from '../types/domain';
import { sortPeople } from './people';

// Family tree of a channel. Only parents (up to two) and partnerships are
// stored; generations, order and drawing are derived here, as pure
// functions so every frontend can reuse them.

export const MAX_PARENTS = 2;

type ParentLinks = Pick<Person, 'id' | 'parentIds'>;

/** Everyone below `personId` (children, grandchildren…). */
export function descendantsOf(people: readonly ParentLinks[], personId: string): Set<string> {
  const children = new Map<string, string[]>();
  for (const p of people) for (const parent of p.parentIds) children.set(parent, [...(children.get(parent) ?? []), p.id]);
  const out = new Set<string>();
  const stack = [...(children.get(personId) ?? [])];
  while (stack.length) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    stack.push(...(children.get(id) ?? []));
  }
  return out;
}

/** True when giving `personId` these parents would make someone their own ancestor. */
export function wouldCreateCycle(people: readonly ParentLinks[], personId: string, parentIds: readonly string[]): boolean {
  if (parentIds.includes(personId)) return true;
  const below = descendantsOf(people, personId);
  return parentIds.some((id) => below.has(id));
}

export function partnershipKey(a: string, b: string): string {
  return [a, b].sort().join('+');
}

/**
 * Generation (row) of each person: 0 at the top. A child is always below
 * both parents and partners share a row (the lower of the two).
 */
export function generations(people: readonly ParentLinks[], partnerships: readonly Pick<Partnership, 'personIds'>[]): Map<string, number> {
  const ids = new Set(people.map((p) => p.id));
  const gen = new Map(people.map((p) => [p.id, 0]));
  // Relaxation; at most one pass per person is ever needed (no cycles).
  for (let pass = 0; pass <= people.length + 1; pass++) {
    let changed = false;
    for (const p of people) {
      for (const parent of p.parentIds) {
        if (!ids.has(parent)) continue;
        const want = gen.get(parent)! + 1;
        if (gen.get(p.id)! < want) {
          gen.set(p.id, want);
          changed = true;
        }
      }
    }
    for (const { personIds: [a, b] } of partnerships) {
      if (!ids.has(a) || !ids.has(b)) continue;
      const level = Math.max(gen.get(a)!, gen.get(b)!);
      if (gen.get(a) !== level || gen.get(b) !== level) {
        gen.set(a, level);
        gen.set(b, level);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return gen;
}

export interface TreeSizes {
  cardWidth: number;
  cardHeight: number;
  /** Horizontal space between cards. */
  gapX: number;
  /** Vertical space between generations. */
  gapY: number;
}

export const DEFAULT_TREE_SIZES: TreeSizes = { cardWidth: 136, cardHeight: 80, gapX: 28, gapY: 84 };

export interface TreeNode {
  person: Person;
  level: number;
  /** Top-left corner. */
  x: number;
  y: number;
}

export interface CoupleLink {
  partnership: Partnership;
  /** Centre of the line between the two cards (where the ring goes). */
  x1: number;
  x2: number;
  y: number;
  separated: boolean;
}

/** Arrows from one or two parents down to their children. */
export interface FamilyLink {
  key: string;
  /** Where the line starts (between the parents, or below a single one). */
  fromX: number;
  fromY: number;
  /** Horizontal "bus" the arrows hang from. */
  busY: number;
  /** Top centre of each child card. */
  children: { x: number; y: number }[];
}

export interface TreeLayout {
  nodes: TreeNode[];
  couples: CoupleLink[];
  families: FamilyLink[];
  width: number;
  height: number;
}

/**
 * Lays the tree out as nested blocks: each "unit" (a person plus the
 * partners who married into the family) sits centred over the block taken
 * by all its descendants, so blocks never overlap and parents are always
 * above the middle of their children. Rows are generations.
 */
export function layoutTree(
  people: readonly Person[],
  partnerships: readonly Partnership[],
  sizes: TreeSizes = DEFAULT_TREE_SIZES,
): TreeLayout {
  const { cardWidth: W, cardHeight: H, gapX, gapY } = sizes;
  const ids = new Set(people.map((p) => p.id));
  const byId = new Map(people.map((p) => [p.id, p]));
  const couples = partnerships.filter((c) => ids.has(c.personIds[0]) && ids.has(c.personIds[1]));
  const gen = generations(people, couples);
  const partnersOf = new Map<string, string[]>();
  for (const { personIds: [a, b] } of couples) {
    partnersOf.set(a, [...(partnersOf.get(a) ?? []), b]);
    partnersOf.set(b, [...(partnersOf.get(b) ?? []), a]);
  }
  const hasParents = (p: Person) => p.parentIds.some((id) => ids.has(id));

  // Units: a head plus the partners without parents in the tree (married in).
  interface Unit {
    members: string[];
    children: Unit[];
  }
  const unitOf = new Map<string, Unit>();
  const makeUnit = (head: Person): Unit => {
    const members = [head.id];
    unitOf.set(head.id, null as unknown as Unit);
    for (const partnerId of partnersOf.get(head.id) ?? []) {
      const partner = byId.get(partnerId)!;
      if (!unitOf.has(partnerId) && !hasParents(partner)) {
        members.push(partnerId);
        unitOf.set(partnerId, null as unknown as Unit);
      }
    }
    const unit: Unit = { members, children: [] };
    for (const id of members) unitOf.set(id, unit);
    return unit;
  };

  // Roots: people without parents in the tree, oldest first; a root couple
  // forms a single unit.
  const roots: Unit[] = [];
  for (const p of sortPeople(people)) {
    if (!hasParents(p) && !unitOf.has(p.id)) {
      // Married-in partners join their partner's unit later (when it is created).
      const partnerWithParents = (partnersOf.get(p.id) ?? []).some((id) => hasParents(byId.get(id)!));
      if (!partnerWithParents) roots.push(makeUnit(p));
    }
  }
  // Children heads, generation by generation, attached to their first parent's unit.
  const pending = sortPeople(people.filter(hasParents)).sort((a, b) => gen.get(a.id)! - gen.get(b.id)!);
  for (const child of pending) {
    if (unitOf.has(child.id)) continue;
    const parentUnit = child.parentIds.map((id) => unitOf.get(id)).find((u): u is Unit => !!u);
    const unit = makeUnit(child);
    if (parentUnit) parentUnit.children.push(unit);
    else roots.push(unit);
  }
  // Anyone left (e.g. married into someone not placed yet) becomes a root.
  for (const p of sortPeople(people)) if (!unitOf.has(p.id)) roots.push(makeUnit(p));

  const membersWidth = (u: Unit) => u.members.length * W + (u.members.length - 1) * gapX;
  const levels = [...new Set(gen.values())].sort((a, b) => a - b);
  const rowOfLevel = new Map(levels.map((l, i) => [l, i]));

  // Each unit is laid out on its own (relative x from 0) and returns its width
  // and where its head person's centre is. Children are packed side by side
  // and the parents' union (the middle of the couple) sits exactly over the
  // middle of their children: one child right below it, two at the same
  // distance on each side, more spread evenly from the first to the last.
  // Married-in partners go on the outer side (left for the siblings on the
  // left half), so brothers and sisters stay together.
  interface Placed {
    width: number;
    x: Map<string, number>;
    headCentre: number;
  }
  const layoutUnit = (u: Unit, partnersOnLeft: boolean): Placed => {
    const order = partnersOnLeft ? [...u.members.slice(1).reverse(), u.members[0]] : u.members;
    const span = membersWidth(u);
    const x = new Map<string, number>();
    if (u.children.length === 0) {
      order.forEach((id, i) => x.set(id, i * (W + gapX)));
      return { width: span, x, headCentre: x.get(u.members[0])! + W / 2 };
    }
    const kids = u.children.map((child, i) => layoutUnit(child, i < (u.children.length - 1) / 2));
    const offsets: number[] = [];
    let cursor = 0;
    for (const kid of kids) {
      offsets.push(cursor);
      cursor += kid.width + gapX;
    }
    const kidsWidth = cursor - gapX;
    const heads = kids.map((kid, i) => offsets[i] + kid.headCentre);
    const centre = (heads[0] + heads[heads.length - 1]) / 2;
    const membersLeft = centre - span / 2;
    // Parents wider than their children: shift everything right.
    const shift = Math.max(0, -membersLeft);
    kids.forEach((kid, i) => kid.x.forEach((value, id) => x.set(id, value + offsets[i] + shift)));
    order.forEach((id, i) => x.set(id, membersLeft + shift + i * (W + gapX)));
    return {
      width: Math.max(kidsWidth + shift, membersLeft + shift + span),
      x,
      headCentre: x.get(u.members[0])! + W / 2,
    };
  };

  const x = new Map<string, number>();
  let rootLeft = 0;
  for (const root of roots) {
    const placed = layoutUnit(root, false);
    placed.x.forEach((value, id) => x.set(id, value + rootLeft));
    rootLeft += placed.width + gapX * 2;
  }

  // Start at 0 (a block's free side may have stayed empty).
  const minX = x.size ? Math.min(...x.values()) : 0;
  const nodes: TreeNode[] = people.map((person) => ({
    person,
    level: gen.get(person.id)!,
    x: x.get(person.id)! - minX,
    y: rowOfLevel.get(gen.get(person.id)!)! * (H + gapY),
  }));
  const pos = new Map(nodes.map((n) => [n.person.id, n]));

  const coupleLinks: CoupleLink[] = couples
    .map((c) => {
      const [a, b] = c.personIds.map((id) => pos.get(id)!).sort((m, n) => m.x - n.x);
      return { partnership: c, x1: a.x + W, x2: b.x, y: a.y + H / 2, separated: !!c.until };
    })
    .filter((l) => l.y === pos.get(l.partnership.personIds[1])!.y + H / 2);

  // One family link per distinct set of parents.
  const groups = new Map<string, Person[]>();
  for (const p of people) {
    const parents = p.parentIds.filter((id) => pos.has(id)).sort();
    if (!parents.length) continue;
    const key = parents.join('+');
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  const families: FamilyLink[] = [...groups.entries()].map(([key, kids]) => {
    const parents = key.split('+').map((id) => pos.get(id)!);
    const centres = parents.map((n) => n.x + W / 2);
    const fromX = centres.reduce((s, v) => s + v, 0) / centres.length;
    const parentBottom = Math.max(...parents.map((n) => n.y)) + H;
    // Two parents side by side: start from the line joining them.
    const fromY = parents.length === 2 && parents[0].y === parents[1].y ? parentBottom - H / 2 : parentBottom;
    const childTop = Math.min(...kids.map((k) => pos.get(k.id)!.y));
    return {
      key,
      fromX,
      fromY,
      busY: childTop - gapY / 2,
      children: kids.map((k) => ({ x: pos.get(k.id)!.x + W / 2, y: pos.get(k.id)!.y })),
    };
  });

  const width = nodes.length ? Math.max(...nodes.map((n) => n.x)) + W : 0;
  const height = nodes.length ? Math.max(...nodes.map((n) => n.y)) + H : 0;
  return { nodes, couples: coupleLinks, families, width, height };
}

export interface Relatives {
  parents: Person[];
  partners: { person: Person; partnership: Partnership }[];
  children: Person[];
  siblings: Person[];
}

/** Direct family of a person (for their card / page). */
export function relativesOf(person: Person, people: readonly Person[], partnerships: readonly Partnership[]): Relatives {
  const byId = new Map(people.map((p) => [p.id, p]));
  const parents = person.parentIds.map((id) => byId.get(id)).filter((p): p is Person => !!p);
  const partners = partnerships
    .filter((c) => c.personIds.includes(person.id))
    .map((c) => ({ partnership: c, person: byId.get(c.personIds.find((id) => id !== person.id)!) }))
    .filter((r): r is { partnership: Partnership; person: Person } => !!r.person);
  const children = sortPeople(people.filter((p) => p.parentIds.includes(person.id)));
  const siblings = sortPeople(
    people.filter((p) => p.id !== person.id && p.parentIds.some((id) => person.parentIds.includes(id))),
  );
  return { parents, partners, children, siblings };
}

/** One couple as edited in the person form. */
export interface PartnerRow {
  /** Existing partnership, if any. */
  id?: string;
  partnerId: string;
  since: string;
  until: string;
}

/** What to save after editing a person's couples (new, changed and removed ones). */
export function partnerChanges(
  personId: string,
  original: readonly Partnership[],
  rows: readonly PartnerRow[],
): { add: PartnershipInput[]; update: { id: string; input: PartnershipInput }[]; remove: string[] } {
  const input = (row: PartnerRow): PartnershipInput => ({
    personIds: [personId, row.partnerId],
    ...(row.since ? { since: row.since } : {}),
    ...(row.until ? { until: row.until } : {}),
  });
  const kept = new Set(rows.map((r) => r.id).filter(Boolean));
  return {
    add: rows.filter((r) => !r.id && r.partnerId).map(input),
    update: rows
      .filter((r) => r.id)
      .filter((r) => {
        const before = original.find((p) => p.id === r.id);
        return !!before && ((before.since ?? '') !== r.since || (before.until ?? '') !== r.until);
      })
      .map((r) => ({ id: r.id!, input: input(r) })),
    remove: original.filter((p) => !kept.has(p.id)).map((p) => p.id),
  };
}
