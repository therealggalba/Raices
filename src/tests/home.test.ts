import { describe, expect, it } from 'vitest';
import type { Library } from '../types/domain';
import { RECENT_LIMIT, buildHomeRows, mostViewed, remix, sameMonthInPastYears } from '../utils/home';
import { makeVideo } from './fixtures';

const TODAY = '2026-10-16';
const SEED = 42;

function library(overrides: Partial<Library> = {}): Library {
  return {
    channels: [
      { id: 'fam', name: 'Familia', kind: 'familia', role: 'admin' },
      { id: 'uni', name: 'Uni', kind: 'amigos', role: 'member' },
    ],
    videos: [
      makeVideo({ id: 'f1', channelId: 'fam', category: 'navidad', eventDate: '1999-12', uploadedAt: '2026-01-03T00:00:00Z' }),
      makeVideo({ id: 'f2', channelId: 'fam', category: 'navidad', eventDate: '1994-12', uploadedAt: '2026-01-01T00:00:00Z' }),
      makeVideo({ id: 'u1', channelId: 'uni', category: 'navidad', eventDate: '2010-10-20', uploadedAt: '2026-01-02T00:00:00Z' }),
      makeVideo({ id: 'u2', channelId: 'uni', category: 'vacaciones', eventDate: '2019-10', uploadedAt: '2026-01-04T00:00:00Z' }),
    ],
    people: [],
    events: [],
    viewCounts: { f1: 3, u1: 5 },
    favoriteVideoIds: ['f2'],
    progress: {},
    cards: [],
    unlockedCardIds: [],
    ...overrides,
  };
}

describe('buildHomeRows', () => {
  it('shows only the curated rows, in order', () => {
    expect(buildHomeRows(library(), TODAY, SEED).map((r) => r.title)).toEqual([
      'Añadidos recientemente',
      'Lo más visto',
      'Mis favoritos',
      'Recuerdos de octubre',
      'Un poco de todo',
    ]);
  });

  it('limits "Añadidos recientemente" to the last 10 uploads across channels', () => {
    const videos = Array.from({ length: 14 }, (_, i) =>
      makeVideo({ id: `v${i}`, uploadedAt: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z` }),
    );
    const recent = buildHomeRows(library({ videos }), TODAY, SEED)[0];
    expect(recent.videos).toHaveLength(RECENT_LIMIT);
    expect(recent.videos[0].id).toBe('v13');
  });

  it('ranks the most viewed and skips unwatched videos', () => {
    const top = buildHomeRows(library(), TODAY, SEED).find((r) => r.id === 'top')!;
    expect(top.ranked).toBe(true);
    expect(top.videos.map((v) => v.id)).toEqual(['u1', 'f1']);
    expect(mostViewed(library().videos, {})).toEqual([]);
  });

  it('omits empty rows and shows nothing for an empty library', () => {
    const rows = buildHomeRows(library({ viewCounts: {}, favoriteVideoIds: [] }), TODAY, SEED);
    expect(rows.map((r) => r.id)).toEqual(['recientes', 'este-mes', 'remix']);
    expect(buildHomeRows(library({ videos: [] }), TODAY, SEED)).toEqual([]);
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

describe('remix', () => {
  const videos = ['navidad', 'navidad', 'navidad', 'boda', 'boda', 'vacaciones', 'cumpleanos'].map((category, i) =>
    makeVideo({ id: `v${i}`, category: category as 'navidad' }),
  );

  it('is deterministic for a seed and changes with another seed', () => {
    const ids = (seed: number) => remix(videos, seed).map((v) => v.id);
    expect(ids(1)).toEqual(ids(1));
    const distinct = new Set([1, 2, 3, 4, 5].map((s) => ids(s).join()));
    expect(distinct.size).toBeGreaterThan(1);
  });

  it('includes each video once and respects the limit', () => {
    expect(new Set(remix(videos, 7).map((v) => v.id)).size).toBe(videos.length);
    expect(remix(videos, 7, 3)).toHaveLength(3);
  });

  it('keeps it varied: the first cards come from different categories', () => {
    for (const seed of [1, 2, 3, 99]) {
      const firstFour = remix(videos, seed).slice(0, 4).map((v) => v.category);
      expect(new Set(firstFour).size).toBe(4);
    }
  });
});
