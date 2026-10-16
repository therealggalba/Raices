import { CHANNEL_KINDS, VIDEO_CATEGORIES } from '../types/domain';
import type { ChannelKind, IsoDate, Library, Video } from '../types/domain';
import { byEventDateAsc, byUploadDesc } from './catalog';
import { monthName, parsePartialDate, partialDateSortKey } from './dates';
import { CATEGORY_LABELS, CHANNEL_KIND_ROW_SUFFIX } from './labels';

// Global home: every video the user can watch, mixed across channels. Only a
// curated selection is shown (recent, most viewed, favourites, thematic
// rows); the complete list lives in the catalog. Thematic rows never mix
// channels of different kinds.

export const HOME_ROW_LIMIT = 15;
export const TOP_LIMIT = 10;
/** Thematic rows with fewer videos are left to the catalog. */
export const MIN_THEMATIC_ROW = 2;

export interface HomeRow {
  id: string;
  title: string;
  videos: Video[];
  /** Big rank numbers ("Top 10"). */
  ranked?: boolean;
  /** Catalog query string that shows the whole row ("Ver todo"). */
  catalogQuery?: string;
}

function query(params: Record<string, string | string[]>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const v of Array.isArray(value) ? value : [value]) search.append(key, v);
  }
  return search.toString();
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

/** Channel kind -> ids of the user's channels of that kind (only kinds in use). */
export function channelsByKind(library: Library): Map<ChannelKind, string[]> {
  const groups = new Map<ChannelKind, string[]>();
  for (const kind of CHANNEL_KINDS) {
    const ids = library.channels.filter((c) => c.kind === kind).map((c) => c.id);
    if (ids.length) groups.set(kind, ids);
  }
  return groups;
}

export function buildHomeRows(library: Library, today: IsoDate): HomeRow[] {
  const { videos, viewCounts, favoriteVideoIds } = library;
  const rows: HomeRow[] = [];
  if (!videos.length) return rows;

  rows.push({
    id: 'recientes',
    title: 'Añadidos recientemente',
    videos: byUploadDesc(videos).slice(0, HOME_ROW_LIMIT),
    catalogQuery: query({ orden: 'added' }),
  });

  const top = mostViewed(videos, viewCounts).slice(0, TOP_LIMIT);
  if (top.length) {
    rows.push({ id: 'top', title: 'Lo más visto', videos: top, ranked: true, catalogQuery: query({ orden: 'views' }) });
  }

  const favSet = new Set(favoriteVideoIds);
  const favorites = byUploadDesc(videos.filter((v) => favSet.has(v.id)));
  if (favorites.length) {
    rows.push({ id: 'favoritos', title: 'Mis favoritos', videos: favorites.slice(0, HOME_ROW_LIMIT), catalogQuery: query({ fav: '1' }) });
  }

  const thisMonth = sameMonthInPastYears(videos, today);
  const month = parsePartialDate(today)?.month;
  if (thisMonth.length && month) {
    rows.push({ id: 'este-mes', title: `Recuerdos de ${monthName(month)}`, videos: thisMonth.slice(0, HOME_ROW_LIMIT) });
  }

  const groups = channelsByKind(library);
  const suffixed = groups.size > 1;
  for (const category of VIDEO_CATEGORIES) {
    for (const [kind, channelIds] of groups) {
      const ids = new Set(channelIds);
      const inRow = byEventDateAsc(videos.filter((v) => v.category === category && ids.has(v.channelId)));
      if (inRow.length < MIN_THEMATIC_ROW) continue;
      rows.push({
        id: `${category}-${kind}`,
        title: suffixed ? `${CATEGORY_LABELS[category]} ${CHANNEL_KIND_ROW_SUFFIX[kind]}` : CATEGORY_LABELS[category],
        videos: inRow.slice(0, HOME_ROW_LIMIT),
        catalogQuery: query({ tipo: category, canal: channelIds, orden: 'memory-asc' }),
      });
    }
  }
  return rows;
}
