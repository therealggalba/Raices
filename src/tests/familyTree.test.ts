import { describe, expect, it } from 'vitest';
import type { Partnership, Person } from '../types/domain';
import { descendantsOf, generations, layoutTree, relativesOf, wouldCreateCycle } from '../utils/familyTree';
import { makePerson } from './fixtures';

const p = (id: string, birthDate: string, parentIds: string[] = []): Person =>
  makePerson({ id, firstName: id, lastName: '', birthDate, parentIds });
const couple = (a: string, b: string, until?: string): Partnership => ({
  id: `${a}+${b}`,
  channelId: 'c1',
  personIds: [a, b].sort() as [string, string],
  ...(until ? { until } : {}),
});

// Grandparents A+B -> C (married to D, from outside) and E; C+D -> F, G.
const people = [
  p('A', '1940-01-01'),
  p('B', '1942-01-01'),
  p('C', '1965-01-01', ['A', 'B']),
  p('D', '1966-01-01'),
  p('E', '1970-01-01', ['A', 'B']),
  p('F', '1995-01-01', ['C', 'D']),
  p('G', '1998-01-01', ['C', 'D']),
];
const couples = [couple('A', 'B'), couple('C', 'D')];

describe('ancestry checks', () => {
  it('finds descendants and refuses loops', () => {
    expect([...descendantsOf(people, 'A')].sort()).toEqual(['C', 'E', 'F', 'G']);
    expect(wouldCreateCycle(people, 'A', ['F'])).toBe(true);
    expect(wouldCreateCycle(people, 'A', ['A'])).toBe(true);
    expect(wouldCreateCycle(people, 'D', ['E'])).toBe(false);
  });
});

describe('generations', () => {
  it('puts children below parents and partners on the same row', () => {
    const gen = generations(people, couples);
    expect(Object.fromEntries(gen)).toEqual({ A: 0, B: 0, C: 1, D: 1, E: 1, F: 2, G: 2 });
  });

  it("lifts someone who married into a younger generation to their partner's row", () => {
    const gen = generations([...people, p('H', '1990-01-01')], [...couples, couple('H', 'F')]);
    expect(gen.get('H')).toBe(2);
  });
});

describe('layoutTree', () => {
  const layout = layoutTree(people, couples, { cardWidth: 100, cardHeight: 50, gapX: 20, gapY: 60 });
  const node = (id: string) => layout.nodes.find((n) => n.person.id === id)!;

  it('places rows top to bottom with partners side by side and no overlaps', () => {
    expect([node('A').y, node('C').y, node('F').y]).toEqual([0, 110, 220]);
    expect(Math.abs(node('C').x - node('D').x)).toBe(120);
    for (const row of [0, 110, 220]) {
      const xs = layout.nodes.filter((n) => n.y === row).map((n) => n.x).sort((a, b) => a - b);
      xs.slice(1).forEach((x, i) => expect(x - xs[i]).toBeGreaterThanOrEqual(120));
    }
  });

  it('centres each couple over the span of their children', () => {
    const centre = (...ids: string[]) => {
      const xs = ids.map((id) => node(id).x + 50);
      return (Math.min(...xs) + Math.max(...xs)) / 2;
    };
    expect(centre('A', 'B')).toBeCloseTo(centre('C', 'E'), 5);
    expect(centre('C', 'D')).toBeCloseTo(centre('F', 'G'), 5);
  });

  it('draws a ring line per couple and arrows from each set of parents', () => {
    expect(layout.couples).toHaveLength(2);
    const ab = layout.families.find((f) => f.key === 'A+B')!;
    expect(ab.children.map((c) => c.y)).toEqual([110, 110]);
    expect(ab.fromY).toBe(25); // from the line joining A and B
    expect(ab.busY).toBe(80);
    const cd = layout.families.find((f) => f.key === 'C+D')!;
    expect(cd.children).toHaveLength(2);
  });

  it('marks separated couples', () => {
    const l = layoutTree(people, [couple('A', 'B', '1980-01-01')]);
    expect(l.couples[0].separated).toBe(true);
  });

  it('copes with an empty channel', () => {
    expect(layoutTree([], [])).toEqual({ nodes: [], couples: [], families: [], width: 0, height: 0 });
  });
});

describe('relativesOf', () => {
  it('lists parents, partners, children and siblings', () => {
    const r = relativesOf(people[2], people, couples);
    expect(r.parents.map((x) => x.id)).toEqual(['A', 'B']);
    expect(r.partners.map((x) => x.person.id)).toEqual(['D']);
    expect(r.children.map((x) => x.id)).toEqual(['F', 'G']);
    expect(r.siblings.map((x) => x.id)).toEqual(['E']);
  });
});

describe('children centred under their parents', () => {
  const sizes = { cardWidth: 100, cardHeight: 50, gapX: 20, gapY: 60 };
  const unionCentre = (l: ReturnType<typeof layoutTree>, a: string, b: string) => {
    const xs = [a, b].map((id) => l.nodes.find((n) => n.person.id === id)!.x + 50);
    return (xs[0] + xs[1]) / 2;
  };
  const centreOf = (l: ReturnType<typeof layoutTree>, id: string) => l.nodes.find((n) => n.person.id === id)!.x + 50;
  const parents = [p('M', '1950-01-01'), p('N', '1951-01-01')];

  it('puts a single child right under the union', () => {
    const l = layoutTree([...parents, p('K1', '1980-01-01', ['M', 'N'])], [couple('M', 'N')], sizes);
    expect(centreOf(l, 'K1')).toBeCloseTo(unionCentre(l, 'M', 'N'), 5);
  });

  it('puts two children at the same distance on each side', () => {
    const l = layoutTree([...parents, p('K1', '1980-01-01', ['M', 'N']), p('K2', '1982-01-01', ['M', 'N'])], [couple('M', 'N')], sizes);
    const c = unionCentre(l, 'M', 'N');
    expect(c - centreOf(l, 'K1')).toBeCloseTo(centreOf(l, 'K2') - c, 5);
  });

  it('centres the union between the first and the last of three or more, even with in-laws', () => {
    const l = layoutTree(
      [
        ...parents,
        p('K1', '1980-01-01', ['M', 'N']),
        p('S1', '1979-01-01'),
        p('K2', '1982-01-01', ['M', 'N']),
        p('K3', '1985-01-01', ['M', 'N']),
        p('S3', '1984-01-01'),
      ],
      [couple('M', 'N'), couple('K1', 'S1'), couple('K3', 'S3')],
      sizes,
    );
    expect(unionCentre(l, 'M', 'N')).toBeCloseTo((centreOf(l, 'K1') + centreOf(l, 'K3')) / 2, 5);
    // In-laws go outside: S1 left of K1, S3 right of K3.
    expect(centreOf(l, 'S1')).toBeLessThan(centreOf(l, 'K1'));
    expect(centreOf(l, 'S3')).toBeGreaterThan(centreOf(l, 'K3'));
    // Nobody overlaps on the same row.
    const rows = new Map<number, number[]>();
    for (const n of l.nodes) rows.set(n.y, [...(rows.get(n.y) ?? []), n.x].sort((a, b) => a - b));
    for (const xs of rows.values()) xs.slice(1).forEach((v, i) => expect(v - xs[i]).toBeGreaterThanOrEqual(100));
  });
});

describe('partnerChanges', () => {
  it('works out what to add, change and remove', async () => {
    const { partnerChanges } = await import('../utils/familyTree');
    const original = [couple('A', 'B'), { ...couple('A', 'C'), since: '1990-01-01' }];
    const result = partnerChanges('A', original, [
      { id: 'A+C', partnerId: 'C', since: '1990-01-01', until: '2000-05-05' },
      { partnerId: 'D', since: '', until: '' },
    ]);
    expect(result.remove).toEqual(['A+B']);
    expect(result.update).toEqual([{ id: 'A+C', input: { personIds: ['A', 'C'], since: '1990-01-01', until: '2000-05-05' } }]);
    expect(result.add).toEqual([{ personIds: ['A', 'D'] }]);
  });
});
