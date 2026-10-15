import { describe, expect, it } from 'vitest';
import { buildCatalogRows, buildTimeline, featuredVideo, searchVideos, videosOfPerson } from '../utils/catalog';
import { makeVideo } from './fixtures';

const videos = [
  makeVideo({ id: 'a', title: 'Navidad 1999', category: 'navidad', eventDate: '1999-12', uploadedAt: '2026-01-03T00:00:00Z' }),
  makeVideo({ id: 'b', title: 'Playa de Cádiz', category: 'vacaciones', eventDate: '1985-08', uploadedAt: '2026-01-01T00:00:00Z', tags: ['playa'], personIds: ['p1'] }),
  makeVideo({ id: 'c', title: 'Nochebuena', category: 'navidad', eventDate: '1999', uploadedAt: '2026-01-02T00:00:00Z', personIds: ['p1'] }),
];

describe('catalog rows', () => {
  it('builds Recientes, Favoritos and one row per non-empty category in fixed order', () => {
    const rows = buildCatalogRows(videos, ['b']);
    expect(rows.map((r) => r.id)).toEqual(['recientes', 'favoritos', 'vacaciones', 'navidad']);
    expect(rows[0].videos.map((v) => v.id)).toEqual(['a', 'c', 'b']);
    expect(rows[3].videos.map((v) => v.id)).toEqual(['c', 'a']);
  });

  it('returns no rows and no hero for an empty channel', () => {
    expect(buildCatalogRows([], [])).toEqual([]);
    expect(featuredVideo([])).toBeNull();
    expect(featuredVideo(videos)?.id).toBe('a');
  });
});

describe('timeline', () => {
  it('groups by year, oldest first', () => {
    const timeline = buildTimeline(videos);
    expect(timeline.map((y) => [y.year, y.videos.map((v) => v.id)])).toEqual([
      [1985, ['b']],
      [1999, ['c', 'a']],
    ]);
  });
});

describe('search', () => {
  it('is accent and case insensitive and matches tags and people', () => {
    expect(searchVideos(videos, 'cadiz').map((v) => v.id)).toEqual(['b']);
    expect(searchVideos(videos, 'PLAYA').map((v) => v.id)).toEqual(['b']);
    expect(searchVideos(videos, 'carlos', { p1: 'Carlos Montero' }).map((v) => v.id)).toEqual(['c', 'b']);
    expect(searchVideos(videos, '   ')).toEqual([]);
    expect(videosOfPerson(videos, 'p1').map((v) => v.id)).toEqual(['b', 'c']);
  });
});
