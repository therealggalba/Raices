import { VIDEO_CATEGORIES } from '../types/domain';
import type { Video, VideoCategory } from '../types/domain';
import { partialDateSortKey, yearOf } from './dates';
import { CATEGORY_LABELS } from './labels';

// Read-side organisation of a channel's videos: the VOD home rows, the
// chronology and search. Pure functions so every frontend reuses them.

export interface CatalogRow {
  id: string;
  title: string;
  videos: Video[];
}

export const RECENT_LIMIT = 12;

/** Most recently uploaded first. */
export function byUploadDesc(videos: readonly Video[]): Video[] {
  return [...videos].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

/** Oldest moment first (the order of the chronology). */
export function byEventDateAsc(videos: readonly Video[]): Video[] {
  return [...videos].sort(
    (a, b) =>
      partialDateSortKey(a.eventDate).localeCompare(partialDateSortKey(b.eventDate)) ||
      a.title.localeCompare(b.title, 'es'),
  );
}

/**
 * Home rows, in order: Recientes, Favoritos, then one row per category that
 * has videos (fixed category order). Empty rows are omitted.
 */
export function buildCatalogRows(videos: readonly Video[], favoriteIds: readonly string[]): CatalogRow[] {
  const rows: CatalogRow[] = [];
  if (videos.length) rows.push({ id: 'recientes', title: 'Recientes', videos: byUploadDesc(videos).slice(0, RECENT_LIMIT) });

  const favSet = new Set(favoriteIds);
  const favorites = byUploadDesc(videos.filter((v) => favSet.has(v.id)));
  if (favorites.length) rows.push({ id: 'favoritos', title: 'Mis favoritos', videos: favorites });

  for (const category of VIDEO_CATEGORIES) {
    const inCategory = byEventDateAsc(videos.filter((v) => v.category === category));
    if (inCategory.length) rows.push({ id: category, title: CATEGORY_LABELS[category], videos: inCategory });
  }
  return rows;
}

/** Video featured in the hero: the latest upload. */
export function featuredVideo(videos: readonly Video[]): Video | null {
  return byUploadDesc(videos)[0] ?? null;
}

export interface TimelineYear {
  year: number;
  videos: Video[];
}

/** Videos grouped by the year they happened, oldest year first. */
export function buildTimeline(videos: readonly Video[]): TimelineYear[] {
  const groups = new Map<number, Video[]>();
  for (const video of byEventDateAsc(videos)) {
    const year = yearOf(video.eventDate);
    if (year === null) continue;
    const list = groups.get(year) ?? [];
    list.push(video);
    groups.set(year, list);
  }
  return [...groups.entries()].sort(([a], [b]) => a - b).map(([year, list]) => ({ year, videos: list }));
}

function fold(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Accent-insensitive search on title, description, tags and people names. */
export function searchVideos(
  videos: readonly Video[],
  query: string,
  personNames: Readonly<Record<string, string>> = {},
): Video[] {
  const terms = fold(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return byUploadDesc(
    videos.filter((v) => {
      const haystack = fold(
        [v.title, v.description, ...v.tags, ...v.personIds.map((id) => personNames[id] ?? '')].join(' '),
      );
      return terms.every((t) => haystack.includes(t));
    }),
  );
}

export function videosOfPerson(videos: readonly Video[], personId: string): Video[] {
  return byEventDateAsc(videos.filter((v) => v.personIds.includes(personId)));
}

export function categoryOf(value: string): VideoCategory | null {
  return (VIDEO_CATEGORIES as readonly string[]).includes(value) ? (value as VideoCategory) : null;
}
