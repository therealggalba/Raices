import { describe, expect, it } from 'vitest';
import { isHttpsUrl, resolveMedia, thumbnailFor } from '../utils/media';

describe('resolveMedia', () => {
  it('recognises the usual YouTube URL shapes', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://m.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    ]) {
      const media = resolveMedia(url);
      expect(media?.kind).toBe('youtube');
      if (media?.kind === 'youtube') expect(media.embedUrl).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    }
  });

  it('recognises Vimeo, Google Drive and direct files', () => {
    expect(resolveMedia('https://vimeo.com/76979871')).toMatchObject({
      kind: 'vimeo',
      embedUrl: 'https://player.vimeo.com/video/76979871',
    });
    expect(resolveMedia('https://drive.google.com/file/d/1AbCdEfGhIjKlMn/view?usp=sharing')).toMatchObject({
      kind: 'drive',
      embedUrl: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMn/preview',
    });
    expect(resolveMedia('https://example.com/videos/boda.MP4')).toEqual({
      kind: 'file',
      src: 'https://example.com/videos/boda.MP4',
    });
  });

  it('falls back to a plain link for unknown hosts and rejects unsafe schemes', () => {
    expect(resolveMedia('https://example.com/album')).toEqual({ kind: 'link', href: 'https://example.com/album' });
    expect(resolveMedia('http://example.com/video.mp4')).toBeNull();
    expect(resolveMedia('javascript:alert(1)')).toBeNull();
    expect(resolveMedia('data:text/html,hi')).toBeNull();
    expect(resolveMedia('not a url')).toBeNull();
  });

  it('does not accept a malformed YouTube id as an embed', () => {
    expect(resolveMedia('https://youtube.com/watch?v=<script>')?.kind).toBe('link');
  });
});

describe('thumbnailFor', () => {
  it('prefers the explicit thumbnail, then YouTube, then nothing', () => {
    expect(thumbnailFor({ thumbnailUrl: 'https://img.test/a.jpg', mediaUrl: 'https://youtu.be/dQw4w9WgXcQ' })).toBe(
      'https://img.test/a.jpg',
    );
    expect(thumbnailFor({ mediaUrl: 'https://youtu.be/dQw4w9WgXcQ' })).toBe(
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    );
    expect(thumbnailFor({ mediaUrl: 'https://example.com/a.mp4' })).toBeNull();
    expect(isHttpsUrl('https://ok.test')).toBe(true);
  });
});
