import { CATALOG_SORTS } from '../types/domain';
import type { CatalogFilters, CatalogSort, Library, Video, VideoCategory } from '../types/domain';
import { byEventDateAsc, byUploadDesc } from './catalog';
import { partialDateSortKey, yearOf } from './dates';
import { fullName } from './people';
import { isId, isVideoCategory } from './validation';
import { foldText } from './text';

// The full catalog: every video of every channel, with filters encoded in the
// URL (?q=&canal=&tipo=&persona=&decada=&fav=1&orden=) so a filtered view can
// be linked to ("Ver todo" from a home row) and survives reloads.

export const DEFAULT_FILTERS: CatalogFilters = {
  query: '',
  channelIds: [],
  categories: [],
  favoritesOnly: false,
  sort: 'added',
};

const MAX_QUERY = 80;

function isSort(value: unknown): value is CatalogSort {
  return typeof value === 'string' && (CATALOG_SORTS as readonly string[]).includes(value);
}

/** URL -> filters. Anything malformed is ignored, never trusted. */
export function parseCatalogParams(params: URLSearchParams): CatalogFilters {
  const decade = Number(params.get('decada'));
  const persona = params.get('persona');
  const sort = params.get('orden');
  return {
    query: (params.get('q') ?? '').slice(0, MAX_QUERY),
    channelIds: [...new Set(params.getAll('canal').filter(isId))],
    categories: [...new Set(params.getAll('tipo').filter(isVideoCategory))],
    ...(persona && isId(persona) ? { personId: persona } : {}),
    ...(Number.isInteger(decade) && decade % 10 === 0 && decade >= 1800 && decade <= 2200 ? { decade } : {}),
    favoritesOnly: params.get('fav') === '1',
    sort: isSort(sort) ? sort : DEFAULT_FILTERS.sort,
  };
}

/** Filters -> URL params (defaults omitted to keep links short). */
export function catalogParams(filters: CatalogFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.query.trim()) params.set('q', filters.query.trim().slice(0, MAX_QUERY));
  for (const id of filters.channelIds) params.append('canal', id);
  for (const c of filters.categories) params.append('tipo', c);
  if (filters.personId) params.set('persona', filters.personId);
  if (filters.decade !== undefined) params.set('decada', String(filters.decade));
  if (filters.favoritesOnly) params.set('fav', '1');
  if (filters.sort !== DEFAULT_FILTERS.sort) params.set('orden', filters.sort);
  return params;
}

export function activeFilterCount(filters: CatalogFilters): number {
  return (
    filters.channelIds.length +
    filters.categories.length +
    (filters.personId ? 1 : 0) +
    (filters.decade !== undefined ? 1 : 0) +
    (filters.favoritesOnly ? 1 : 0)
  );
}


export function decadeOf(video: Video): number | null {
  const year = yearOf(video.eventDate);
  return year === null ? null : Math.floor(year / 10) * 10;
}

/** Decades that actually contain videos, oldest first. */
export function availableDecades(videos: readonly Video[]): number[] {
  const set = new Set(videos.map(decadeOf).filter((d): d is number => d !== null));
  return [...set].sort((a, b) => a - b);
}

/** Categories that actually contain videos, in canonical order. */
export function availableCategories(videos: readonly Video[], order: readonly VideoCategory[]): VideoCategory[] {
  const set = new Set(videos.map((v) => v.category));
  return order.filter((c) => set.has(c));
}

function sortVideos(videos: Video[], sort: CatalogSort, viewCounts: Readonly<Record<string, number>>): Video[] {
  switch (sort) {
    case 'added':
      return byUploadDesc(videos);
    case 'memory-asc':
      return byEventDateAsc(videos);
    case 'memory-desc':
      return byEventDateAsc(videos).reverse();
    case 'views':
      return byUploadDesc(videos).sort((a, b) => (viewCounts[b.id] ?? 0) - (viewCounts[a.id] ?? 0));
    case 'title':
      return [...videos].sort((a, b) => a.title.localeCompare(b.title, 'es') || partialDateSortKey(a.eventDate).localeCompare(partialDateSortKey(b.eventDate)));
  }
}

export function filterCatalog(library: Library, filters: CatalogFilters): Video[] {
  const channelNames = new Map(library.channels.map((c) => [c.id, c.name]));
  const personNames = new Map(library.people.map((p) => [p.id, fullName(p)]));
  const favs = new Set(library.favoriteVideoIds);
  const channels = new Set(filters.channelIds);
  const categories = new Set(filters.categories);
  const terms = foldText(filters.query).split(/\s+/).filter(Boolean);

  const result = library.videos.filter((v) => {
    if (channels.size && !channels.has(v.channelId)) return false;
    if (categories.size && !categories.has(v.category)) return false;
    if (filters.personId && !v.personIds.includes(filters.personId)) return false;
    if (filters.decade !== undefined && decadeOf(v) !== filters.decade) return false;
    if (filters.favoritesOnly && !favs.has(v.id)) return false;
    if (terms.length) {
      const haystack = foldText(
        [
          v.title,
          v.description,
          channelNames.get(v.channelId) ?? '',
          ...v.tags,
          ...v.personIds.map((id) => personNames.get(id) ?? ''),
        ].join(' '),
      );
      if (!terms.every((t) => haystack.includes(t))) return false;
    }
    return true;
  });
  return sortVideos(result, filters.sort, library.viewCounts);
}
