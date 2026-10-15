import type { Video } from '../types/domain';
import { resolveMedia } from '../utils/media';
import { Thumbnail } from './Thumbnail';
import styles from './MediaPlayer.module.scss';

/**
 * Plays the external link a video points to. Only URLs that resolveMedia()
 * recognised become embeds (fixed provider hosts, ids validated by regex);
 * anything else is offered as a plain external link.
 */
export function MediaPlayer({ video, autoPlay }: { video: Video; autoPlay?: boolean }) {
  const media = resolveMedia(video.mediaUrl);

  if (!media || media.kind === 'link') {
    return (
      <div className={styles.frame}>
        <Thumbnail video={video} showTitle={false} />
        <a className={styles.external} href={media?.href ?? '#'} target="_blank" rel="noopener noreferrer">
          ▶ Abrir el vídeo en una pestaña nueva
        </a>
      </div>
    );
  }

  if (media.kind === 'file') {
    return (
      <div className={styles.frame}>
        <video className={styles.media} src={media.src} controls playsInline autoPlay={autoPlay} preload="metadata">
          Tu navegador no puede reproducir este vídeo.
        </video>
      </div>
    );
  }

  const src = media.kind === 'youtube' && autoPlay ? `${media.embedUrl}?autoplay=1` : media.embedUrl;
  return (
    <div className={styles.frame}>
      <iframe
        className={styles.media}
        src={src}
        title={video.title}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
      />
    </div>
  );
}
