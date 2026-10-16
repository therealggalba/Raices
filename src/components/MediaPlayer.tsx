import { useEffect, useRef, useState } from 'react';
import type { Video } from '../types/domain';
import { resolveMedia } from '../utils/media';
import { Thumbnail } from './Thumbnail';
import styles from './MediaPlayer.module.scss';

interface Props {
  video: Video;
  /** Start playing straight away (e.g. "Reproducir" from the hero). */
  autoPlay?: boolean;
  /** Called once per mount, when playback actually starts (counts a view). */
  onStart?(): void;
}

/**
 * Plays the external link a video points to. It shows the cover with a play
 * button first: embeds are only loaded on demand and starting playback is
 * the moment a view is counted. Only URLs that resolveMedia() recognised
 * become embeds (fixed provider hosts, ids validated by regex); anything else
 * is offered as an external link.
 */
export function MediaPlayer({ video, autoPlay = false, onStart }: Props) {
  const media = resolveMedia(video.mediaUrl);
  const playable = !!media && media.kind !== 'link';
  // Hero "Reproducir" starts straight away; otherwise the cover is shown first.
  const [started, setStarted] = useState(autoPlay && playable);
  const counted = useRef(false);

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

  const start = () => setStarted(true);

  if (!media || media.kind === 'link' || !started) {
    const external = !media || media.kind === 'link';
    return (
      <div className={styles.frame}>
        <Thumbnail video={video} showTitle={false} />
        {external ? (
          <a
            className={styles.cover}
            href={media?.kind === 'link' ? media.href : undefined}
            target="_blank"
            rel="noopener noreferrer"
            onClick={countView}
          >
            <span className={styles.playIcon} aria-hidden>
              ↗
            </span>
            <span>Abrir el vídeo en una pestaña nueva</span>
          </a>
        ) : (
          <button type="button" className={styles.cover} onClick={start} aria-label={`Reproducir ${video.title}`}>
            <span className={styles.playIcon} aria-hidden>
              ▶
            </span>
          </button>
        )}
      </div>
    );
  }

  if (media.kind === 'file') {
    return (
      <div className={styles.frame}>
        <video className={styles.media} src={media.src} controls playsInline autoPlay preload="auto">
          Tu navegador no puede reproducir este vídeo.
        </video>
      </div>
    );
  }

  return (
    <div className={styles.frame}>
      <iframe
        className={styles.media}
        src={media.kind === 'drive' ? media.embedUrl : `${media.embedUrl}?autoplay=1`}
        title={video.title}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
      />
    </div>
  );
}
