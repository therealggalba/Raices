// Resolves the external links videos are stored as (phase 1 has no uploads:
// media lives in YouTube, Vimeo, Google Drive or any direct https file) into
// something the player can render. Anything unrecognised is shown as a plain
// external link, never injected as an embed.

export type MediaSource =
  | { kind: 'youtube'; id: string; embedUrl: string; thumbnailUrl: string }
  | { kind: 'vimeo'; id: string; embedUrl: string }
  | { kind: 'drive'; id: string; embedUrl: string }
  | { kind: 'file'; src: string }
  | { kind: 'link'; href: string };

const YT_ID_RE = /^[\w-]{11}$/;
const NUMERIC_RE = /^\d{1,12}$/;
const DRIVE_ID_RE = /^[\w-]{10,100}$/;
const FILE_RE = /\.(mp4|webm|m4v|mov|ogv|ogg)$/i;

/** Parses an absolute https URL; anything else (http, javascript:, data:…) is null. */
export function parseHttpsUrl(value: string): URL | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' && url.hostname ? url : null;
  } catch {
    return null;
  }
}

export function isHttpsUrl(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 2000 && parseHttpsUrl(value) !== null;
}

function youtubeId(url: URL): string | null {
  const host = url.hostname.replace(/^(www|m|music)\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = url.pathname.split('/')[1] ?? null;
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else {
      const [, kind, value] = url.pathname.split('/');
      if (kind === 'embed' || kind === 'shorts' || kind === 'live') id = value ?? null;
    }
  }
  return id && YT_ID_RE.test(id) ? id : null;
}

function vimeoId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, '');
  const parts = url.pathname.split('/').filter(Boolean);
  if (host === 'vimeo.com') return parts.find((p) => NUMERIC_RE.test(p)) ?? null;
  if (host === 'player.vimeo.com' && parts[0] === 'video' && NUMERIC_RE.test(parts[1] ?? '')) return parts[1];
  return null;
}

function driveId(url: URL): string | null {
  if (url.hostname !== 'drive.google.com') return null;
  const parts = url.pathname.split('/').filter(Boolean);
  const id = parts[0] === 'file' && parts[1] === 'd' ? parts[2] : url.searchParams.get('id');
  return id && DRIVE_ID_RE.test(id) ? id : null;
}

export function resolveMedia(value: string): MediaSource | null {
  const url = parseHttpsUrl(value);
  if (!url) return null;

  const yt = youtubeId(url);
  if (yt) {
    return {
      kind: 'youtube',
      id: yt,
      embedUrl: `https://www.youtube-nocookie.com/embed/${yt}`,
      thumbnailUrl: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`,
    };
  }
  const vimeo = vimeoId(url);
  if (vimeo) return { kind: 'vimeo', id: vimeo, embedUrl: `https://player.vimeo.com/video/${vimeo}` };
  const drive = driveId(url);
  if (drive) return { kind: 'drive', id: drive, embedUrl: `https://drive.google.com/file/d/${drive}/preview` };
  if (FILE_RE.test(url.pathname)) return { kind: 'file', src: url.href };
  return { kind: 'link', href: url.href };
}

/** Explicit thumbnail first, then the one the provider exposes (YouTube). */
export function thumbnailFor(video: { thumbnailUrl?: string; mediaUrl: string }): string | null {
  if (video.thumbnailUrl && isHttpsUrl(video.thumbnailUrl)) return video.thumbnailUrl;
  const media = resolveMedia(video.mediaUrl);
  return media?.kind === 'youtube' ? media.thumbnailUrl : null;
}
