import { describe, expect, it } from 'vitest';
import type { Library } from '../types/domain';
import { buildHomeRows, mostViewed, sameMonthInPastYears } from '../utils/home';
import { makeVideo } from './fixtures';

const TODAY = '2026-10-16';

function library(overrides: Partial<Library> = {}): Library {
  return {
    channels: [
      { id: 'fam', name: 'Familia', kind: 'familia', role: 'admin' },
      { id: 'primos', name: 'Primos', kind: 'familia', role: 'member' },
      { id: 'uni', name: 'Uni', kind: 'amigos', role: 'member' },
    ],
    videos: [
      makeVideo({ id: 'f1', channelId: 'fam', category: 'navidad', eventDate: '1999-12', uploadedAt: '2026-01-03T00:00:00Z' }),
      makeVideo({ id: 'p1', channelId: 'primos', category: 'navidad', eventDate: '1994-12', uploadedAt: '2026-01-01T00:00:00Z' }),
      makeVideo({ id: 'u1', channelId: 'uni', category: 'navidad', eventDate: '2010-10-20', uploadedAt: '2026-01-02T00:00:00Z' }),
      makeVideo({ id: 'u2', channelId: 'uni', category: 'vacaciones', eventDate: '2019-10', uploadedAt: '2026-01-04T00:00:00Z' }),
    ],
    people: [],
    events: [],
    viewCounts: { f1: 3, u1: 5 },
    favoriteVideoIds: ['p1'],
    ...overrides,
  };
}

describe('buildHomeRows', () => {
  it('starts with the general rows, then thematic rows per channel kind', () => {
    const rows = buildHomeRows(library(), TODAY);
    expect(rows.map((r) => r.title)).toEqual([
      'Añadidos recientemente',
      'Lo más visto',
      'Mis favoritos',
      'Recuerdos de octubre',
      'Navidades en familia',
    ]);
  });

  it('never mixes channels of different kinds in a thematic row', () => {
    const rows = buildHomeRows(library(), TODAY);
    const familyXmas = rows.find((r) => r.id === 'navidad-familia')!;
    expect(familyXmas.videos.map((v) => v.id)).toEqual(['p1', 'f1']);
    expect(familyXmas.catalogQuery).toBe('tipo=navidad&canal=fam&canal=primos&orden=memory-asc');
  });

  it('ranks the most viewed and skips unwatched videos', () => {
    const top = buildHomeRows(library(), TODAY).find((r) => r.id === 'top')!;
    expect(top.ranked).toBe(true);
    expect(top.videos.map((v) => v.id)).toEqual(['u1', 'f1']);
    expect(mostViewed(library().videos, {})).toEqual([]);
  });

  it('drops the kind suffix when every channel has the same kind', () => {
    const lib = library({ channels: [{ id: 'fam', name: 'F', kind: 'familia', role: 'admin' }] });
    lib.videos = lib.videos.filter((v) => v.channelId === 'fam');
    lib.videos.push(makeVideo({ id: 'f2', channelId: 'fam', category: 'navidad', eventDate: '2001-12' }));
    expect(buildHomeRows(lib, TODAY).map((r) => r.title)).toContain('Navidades');
  });

  it('shows nothing for an empty library', () => {
    expect(buildHomeRows(library({ videos: [] }), TODAY)).toEqual([]);
  });

  it('finds memories from this month in previous years only', () => {
    const videos = [
      makeVideo({ id: 'a', eventDate: '2010-10-20' }),
      makeVideo({ id: 'b', eventDate: '2019-10' }),
      makeVideo({ id: 'c', eventDate: '2026-10-01' }),
      makeVideo({ id: 'd', eventDate: '2019' }),
    ];
    expect(sameMonthInPastYears(videos, TODAY).map((v) => v.id)).toEqual(['b', 'a']);
  });
});
