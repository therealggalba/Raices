import { describe, expect, it } from 'vitest';
import type { Library } from '../types/domain';
import {
  DEFAULT_FILTERS,
  activeFilterCount,
  availableDecades,
  catalogParams,
  filterCatalog,
  parseCatalogParams,
} from '../utils/catalogFilters';
import { makePerson, makeVideo } from './fixtures';

const lib: Library = {
  channels: [
    { id: 'fam', name: 'Familia Montero', kind: 'familia', packTheme: 'clasico', role: 'admin' },
    { id: 'uni', name: 'Amigos Uni', kind: 'amigos', packTheme: 'clasico', role: 'member' },
  ],
  videos: [
    makeVideo({ id: 'a', channelId: 'fam', title: 'Navidad 1999', category: 'navidad', eventDate: '1999-12', uploadedAt: '2026-01-01T00:00:00Z', personIds: ['p1'] }),
    makeVideo({ id: 'b', channelId: 'fam', title: 'Playa de Cádiz', category: 'vacaciones', eventDate: '1985-08', uploadedAt: '2026-01-03T00:00:00Z' }),
    makeVideo({ id: 'c', channelId: 'uni', title: 'Interrail', category: 'vacaciones', eventDate: '2004-07', uploadedAt: '2026-01-02T00:00:00Z' }),
  ],
  people: [makePerson({ id: 'p1', firstName: 'Antonio', lastName: 'Montero' })],
  events: [],
  viewCounts: { c: 4, a: 1 },
  favoriteVideoIds: ['b'],
  progress: {},
  cards: [],
  cardCopies: {},
  packs: { perDay: 3, openedToday: 0, remaining: 3 },
};

const ids = (filters: Partial<typeof DEFAULT_FILTERS>) => filterCatalog(lib, { ...DEFAULT_FILTERS, ...filters }).map((v) => v.id);

describe('filterCatalog', () => {
  it('returns every video by default, latest upload first', () => {
    expect(ids({})).toEqual(['b', 'c', 'a']);
  });

  it('filters by channel, category, person, decade and favourites', () => {
    expect(ids({ channelIds: ['uni'] })).toEqual(['c']);
    expect(ids({ categories: ['vacaciones'] })).toEqual(['b', 'c']);
    expect(ids({ categories: ['vacaciones'], channelIds: ['fam'] })).toEqual(['b']);
    expect(ids({ personId: 'p1' })).toEqual(['a']);
    expect(ids({ decade: 1980 })).toEqual(['b']);
    expect(ids({ favoritesOnly: true })).toEqual(['b']);
  });

  it('searches titles, channel names and people, ignoring accents', () => {
    expect(ids({ query: 'cadiz' })).toEqual(['b']);
    expect(ids({ query: 'amigos' })).toEqual(['c']);
    expect(ids({ query: 'antonio navidad' })).toEqual(['a']);
  });

  it('sorts by memory date, views and title', () => {
    expect(ids({ sort: 'memory-asc' })).toEqual(['b', 'a', 'c']);
    expect(ids({ sort: 'memory-desc' })).toEqual(['c', 'a', 'b']);
    expect(ids({ sort: 'views' })).toEqual(['c', 'a', 'b']);
    expect(ids({ sort: 'title' })).toEqual(['c', 'a', 'b']);
  });

  it('lists the decades that have videos', () => {
    expect(availableDecades(lib.videos)).toEqual([1980, 1990, 2000]);
  });
});

describe('catalog URL params', () => {
  it('round-trips filters and omits defaults', () => {
    const filters = { ...DEFAULT_FILTERS, query: 'playa', channelIds: ['fam'], categories: ['vacaciones' as const], decade: 1980, favoritesOnly: true, sort: 'views' as const };
    const params = catalogParams(filters);
    expect(params.toString()).toBe('q=playa&canal=fam&tipo=vacaciones&decada=1980&fav=1&orden=views');
    expect(parseCatalogParams(params)).toEqual(filters);
    expect(catalogParams(DEFAULT_FILTERS).toString()).toBe('');
    expect(activeFilterCount(filters)).toBe(4);
  });

  it('ignores malformed values', () => {
    const parsed = parseCatalogParams(new URLSearchParams('canal=../x&tipo=fiesta&decada=1985&orden=hack&persona=<b>'));
    expect(parsed).toEqual(DEFAULT_FILTERS);
  });
});
