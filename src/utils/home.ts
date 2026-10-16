import type { IsoDate, Library, Video } from '../types/domain';
import { byUploadDesc } from './catalog';
import { monthName, parsePartialDate, partialDateSortKey } from './dates';

// Global home: every video the user can watch, mixed across channels. Only a
// short curated selection is shown; finding a specific video is the job of
// the catalog.

export const RECENT_LIMIT = 10;
export const TOP_LIMIT = 10;
export const HOME_ROW_LIMIT = 15;

export interface HomeRow {
  id: string;
  title: string;
  videos: Video[];
  /** Big rank numbers ("Top 10"). */
  ranked?: boolean;
  /** Catalog query string that shows the whole row ("Ver todo"). */
  catalogQuery?: string;
}

/** Most viewed first; unwatched videos are left out. Ties: latest upload first. */
export function mostViewed(videos: readonly Video[], viewCounts: Readonly<Record<string, number>>): Video[] {
  return byUploadDesc(videos.filter((v) => (viewCounts[v.id] ?? 0) > 0)).sort(
    (a, b) => (viewCounts[b.id] ?? 0) - (viewCounts[a.id] ?? 0),
  );
}

/** Videos recorded in the current month of previous years, newest year first. */
export function sameMonthInPastYears(videos: readonly Video[], today: IsoDate): Video[] {
  const now = parsePartialDate(today);
  if (!now?.month) return [];
  return videos
    .filter((v) => {
      const d = parsePartialDate(v.eventDate);
      return !!d && d.month === now.month && d.year < now.year;
    })
    .sort((a, b) => partialDateSortKey(b.eventDate).localeCompare(partialDateSortKey(a.eventDate)));
}

/** Small deterministic PRNG (mulberry32): same seed, same remix. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(list: readonly T[], random: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * "Un poco de todo": a random selection that stays varied. Videos are
 * shuffled, grouped by category and dealt round-robin, so consecutive cards
 * rarely share a category. A new seed gives a new remix.
 */
export function remix(videos: readonly Video[], seed: number, limit = HOME_ROW_LIMIT): Video[] {
  const random = seededRandom(seed);
  const groups = new Map<string, Video[]>();
  for (const video of shuffle(videos, random)) {
    const list = groups.get(video.category) ?? [];
    list.push(video);
    groups.set(video.category, list);
  }
  const queues = shuffle([...groups.values()], random);
  const out: Video[] = [];
  while (out.length < limit && queues.some((q) => q.length)) {
    for (const queue of queues) {
      const next = queue.shift();
      if (next && out.length < limit) out.push(next);
    }
  }
  return out;
}

/**
 * Home rows, in order: Añadidos recientemente, Lo más visto, Mis favoritos,
 * Recuerdos de <mes> and Un poco de todo. Empty rows are omitted.
 */
export function buildHomeRows(library: Library, today: IsoDate, remixSeed: number): HomeRow[] {
  const { videos, viewCounts, favoriteVideoIds } = library;
  const rows: HomeRow[] = [];
  if (!videos.length) return rows;

  rows.push({
    id: 'recientes',
    title: 'Añadidos recientemente',
    videos: byUploadDesc(videos).slice(0, RECENT_LIMIT),
    catalogQuery: 'orden=added',
  });

  const top = mostViewed(videos, viewCounts).slice(0, TOP_LIMIT);
  if (top.length) rows.push({ id: 'top', title: 'Lo más visto', videos: top, ranked: true, catalogQuery: 'orden=views' });

  const favSet = new Set(favoriteVideoIds);
  const favorites = byUploadDesc(videos.filter((v) => favSet.has(v.id)));
  if (favorites.length) {
    rows.push({ id: 'favoritos', title: 'Mis favoritos', videos: favorites.slice(0, HOME_ROW_LIMIT), catalogQuery: 'fav=1' });
  }

  const thisMonth = sameMonthInPastYears(videos, today);
  const month = parsePartialDate(today)?.month;
  if (thisMonth.length && month) {
    rows.push({ id: 'este-mes', title: `Recuerdos de ${monthName(month)}`, videos: thisMonth.slice(0, HOME_ROW_LIMIT) });
  }

  rows.push({ id: 'remix', title: 'Un poco de todo', videos: remix(videos, remixSeed) });
  return rows;
}
