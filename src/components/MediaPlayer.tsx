import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { config } from '../config';
import { allowRotation, lockPortrait, prefersFullscreenVideo } from '../native/nativeBridge';
import type { Video } from '../types/domain';
import { resolveMedia } from '../utils/media';
import { SAVE_INTERVAL_SECONDS } from '../utils/progress';
import { Thumbnail } from './Thumbnail';
import styles from './MediaPlayer.module.scss';

interface Props {
  video: Video;
  /** Start playing straight away (e.g. "Reproducir" from the hero). */
  autoPlay?: boolean;
  /** Resume from this second (continue watching). */
  startAt?: number;
  /** Label of the play button on the cover. */
  playLabel?: string;
  /** Called once per mount, when playback actually starts (counts a view). */
  onStart?(): void;
  /** Where the viewer is: every few seconds while playing, on pause, on end and on leave. */
  onProgress?(positionSeconds: number, durationSeconds: number): void;
}

const YOUTUBE_ORIGINS = new Set(['https://www.youtube-nocookie.com', 'https://www.youtube.com']);

/**
 * Reports playback positions: throttled while playing, immediately when
 * forced (pause/end), and a last time when the player goes away.
 */
function useProgressReporter(onProgress: Props['onProgress']) {
  const last = useRef<{ position: number; duration: number } | null>(null);
  // The <video> element, kept outside React's ref handling: React clears
  // element refs before unmount cleanups run, and the final save needs it.
  const element = useRef<HTMLVideoElement | null>(null);
  const lastSentAt = useRef(0);
  const callback = useRef(onProgress);
  useEffect(() => {
    callback.current = onProgress;
  }, [onProgress]);

  const report = useCallback((position: number, duration: number, force = false) => {
    if (!Number.isFinite(position) || !Number.isFinite(duration) || duration <= 0) return;
    last.current = { position, duration };
    const now = Date.now();
    if (force || now - lastSentAt.current >= SAVE_INTERVAL_SECONDS * 1000) {
      lastSentAt.current = now;
      callback.current?.(position, duration);
    }
  }, []);

  // Flush on leave: closing the tab, or navigating away inside the app.
  useEffect(() => {
    const flush = () => {
      const el = element.current;
      const live = el && el.readyState > 0 ? { position: el.currentTime, duration: el.duration } : null;
      const final = live ?? last.current;
      if (final) callback.current?.(final.position, final.duration);
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);

  const attach = useCallback((el: HTMLVideoElement) => {
    element.current = el;
  }, []);

  return { report, attach };
}

/**
 * Plays the external link a video points to. It shows the cover with a play
 * button first: embeds are only loaded on demand and starting playback is
 * the moment a view is counted. Only URLs that resolveMedia() recognised
 * become embeds (fixed provider hosts, ids validated by regex); anything else
 * is offered as an external link.
 *
 * Continue watching works with direct files (including Google Drive through
 * the API key) and YouTube (iframe API); the Drive and Vimeo viewers expose no
 * position, so they always start from the beginning.
 */
export function MediaPlayer({ video, autoPlay = false, startAt, playLabel, onStart, onProgress }: Props) {
  const media = resolveMedia(video.mediaUrl, { googleApiKey: config.googleApiKey });
  const playable = !!media && media.kind !== 'link';
  // Hero "Reproducir" starts straight away; otherwise the cover is shown first.
  const [started, setStarted] = useState(autoPlay && playable);
  const counted = useRef(false);
  const { report, attach } = useProgressReporter(onProgress);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const resumeFrom = startAt && startAt > 0 ? Math.floor(startAt) : 0;

  const countView = () => {
    if (counted.current) return;
    counted.current = true;
    onStart?.();
  };

  // Count the view once playback starts (the ref also absorbs StrictMode's
  // double effect run in development).
  useEffect(() => {
    if (started) countView();
  });

  // YouTube iframe API: positions arrive as postMessage "infoDelivery" events.
  const isYoutube = media?.kind === 'youtube';
  useEffect(() => {
    if (!started || !isYoutube) return;
    const state = { time: 0, duration: 0 };
    const onMessage = (event: MessageEvent) => {
      if (!YOUTUBE_ORIGINS.has(event.origin) || event.source !== iframeRef.current?.contentWindow) return;
      let data: unknown;
      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (typeof data !== 'object' || data === null) return;
      const info = (data as { info?: unknown }).info;
      if (typeof info !== 'object' || info === null) return;
      const { currentTime, duration, playerState } = info as Record<string, unknown>;
      if (typeof duration === 'number' && duration > 0) state.duration = duration;
      if (typeof currentTime === 'number') state.time = currentTime;
      // 0 = ended, 2 = paused: save right away.
      const force = playerState === 0 || playerState === 2;
      if (state.duration > 0 && (typeof currentTime === 'number' || force)) report(state.time, state.duration, force);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [started, isYoutube, report]);

  // Full screen on phones: the player frame goes full screen when playback
  // starts and the app may rotate to landscape until it leaves full screen.
  const enterFullscreen = () => {
    const el = frameRef.current;
    if (!el || !prefersFullscreenVideo() || document.fullscreenElement) return;
    el.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {
      // Not allowed (e.g. no user gesture): the player stays inline.
    });
  };
  const exitFullscreen = () => {
    if (document.fullscreenElement === frameRef.current) void document.exitFullscreen().catch(() => {});
  };

  useEffect(() => {
    const frame = frameRef.current;
    const onChange = () => {
      if (frame && document.fullscreenElement === frame) void allowRotation();
      else void lockPortrait();
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      if (frame && document.fullscreenElement === frame) {
        void document.exitFullscreen().catch(() => {});
        void lockPortrait();
      }
    };
  }, []);

  // «Reproducir» from the hero starts here without a tap on the player: try.
  useEffect(() => {
    if (autoPlay && playable) enterFullscreen();
    // Only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = () => {
    enterFullscreen(); // inside the tap: browsers only allow full screen from a gesture
    setStarted(true);
  };

  let content;
  if (!media || media.kind === 'link' || !started) {
    const external = !media || media.kind === 'link';
    content = (
      <>
        <Thumbnail video={video} showTitle={false} />
        {external ? (
          <a
            className={styles.cover}
            href={media?.kind === 'link' ? media.href : undefined}
            target="_blank"
            rel="noopener noreferrer"
            onClick={countView}
          >
            <span className={styles.playIcon}>
              <Icon name="external" size={26} />
            </span>
            <span>Abrir el vídeo en una pestaña nueva</span>
          </a>
        ) : (
          <button type="button" className={styles.cover} onClick={start} aria-label={playLabel ?? `Reproducir ${video.title}`}>
            <span className={styles.playIcon}>
              <Icon name="play" size={30} />
            </span>
            {playLabel && <span className={styles.playLabel}>{playLabel}</span>}
          </button>
        )}
      </>
    );
  } else if (media.kind === 'file' || (media.kind === 'drive' && media.streamUrl)) {
    const fileSrc = media.kind === 'file' ? media.src : media.streamUrl;
    content = (
      <video
        className={styles.media}
        src={fileSrc}
        controls
        playsInline
        autoPlay
        preload="auto"
        onLoadedMetadata={(e) => {
          const el = e.currentTarget;
          attach(el);
          if (resumeFrom && resumeFrom < el.duration) el.currentTime = resumeFrom;
        }}
        onTimeUpdate={(e) => report(e.currentTarget.currentTime, e.currentTarget.duration)}
        onPause={(e) => report(e.currentTarget.currentTime, e.currentTarget.duration, true)}
        onEnded={(e) => {
          report(e.currentTarget.duration, e.currentTarget.duration, true);
          exitFullscreen();
        }}
      >
        Tu navegador no puede reproducir este vídeo.
      </video>
    );
  } else {
    let src = media.embedUrl;
    const youtubeOrigin = media.kind === 'youtube' ? new URL(media.embedUrl).origin : null;
    if (media.kind === 'youtube') {
      const params = new URLSearchParams({ autoplay: '1', enablejsapi: '1', origin: window.location.origin });
      if (resumeFrom) params.set('start', String(resumeFrom));
      src = `${media.embedUrl}?${params}`;
    } else if (media.kind === 'vimeo') {
      src = `${media.embedUrl}?autoplay=1`;
    }

    content = (
      <iframe
        ref={iframeRef}
        className={styles.media}
        src={src}
        title={video.title}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
        onLoad={() => {
          // Ask the YouTube player to start sending its state (iframe API).
          if (youtubeOrigin) {
            iframeRef.current?.contentWindow?.postMessage(
              JSON.stringify({ event: 'listening', id: video.id, channel: 'widget' }),
              youtubeOrigin,
            );
          }
        }}
      />
    );
  }

  return (
    <div ref={frameRef} className={styles.frame}>
      {content}
      {started && (
        <button type="button" className={styles.closeFullscreen} onClick={exitFullscreen} aria-label="Salir de pantalla completa">
          <Icon name="close" />
        </button>
      )}
    </div>
  );
}
