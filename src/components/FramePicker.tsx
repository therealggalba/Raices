import { useEffect, useState } from 'react';
import type { MediaSource } from '../utils/media';
import { Button } from './ui';
import styles from './FramePicker.module.scss';

/** Where in the video the frames are taken (share of its length). */
const POINTS = [0.08, 0.22, 0.36, 0.5, 0.64, 0.78];
const FRAME_WIDTH = 960;

interface Props {
  media: MediaSource;
  /** YouTube: one of its own frames (a link). */
  onPickUrl(url: string): void;
  /** A frame taken from the video itself (then framed and uploaded). */
  onPickFrame(frame: Blob): void;
  onClose(): void;
}

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = () => {
      video.removeEventListener('seeked', done);
      resolve();
    };
    video.addEventListener('seeked', done);
    video.addEventListener('error', () => reject(new Error('video')), { once: true });
    video.currentTime = time;
  });
}

/** Six frames spread over the video, as images (needs the server to allow it: CORS). */
async function captureFrames(src: string): Promise<Blob[]> {
  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = src;
  await new Promise<void>((resolve, reject) => {
    video.addEventListener('loadeddata', () => resolve(), { once: true });
    video.addEventListener('error', () => reject(new Error('video')), { once: true });
    setTimeout(() => reject(new Error('timeout')), 20000);
  });
  const width = Math.min(FRAME_WIDTH, video.videoWidth);
  const height = Math.round((video.videoHeight / video.videoWidth) * width);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const frames: Blob[] = [];
  for (const point of POINTS) {
    await seek(video, video.duration * point);
    ctx.drawImage(video, 0, 0, width, height);
    // Throws if the video's server doesn't allow reading its pixels.
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9));
    if (!blob) throw new Error('frame');
    frames.push(blob);
  }
  video.removeAttribute('src');
  video.load();
  return frames;
}

/** Choose the video's cover among frames of the video itself. */
export function FramePicker({ media, onPickUrl, onPickFrame, onClose }: Props) {
  const [frames, setFrames] = useState<{ blob: Blob; url: string }[] | null>(null);
  const [failed, setFailed] = useState(false);

  const youtube =
    media.kind === 'youtube'
      ? ['mqdefault', 'mq1', 'mq2', 'mq3'].map((name) => `https://i.ytimg.com/vi/${media.id}/${name}.jpg`)
      : null;

  useEffect(() => {
    if (media.kind === 'youtube') return;
    const src = media.kind === 'file' ? media.src : media.kind === 'drive' ? media.streamUrl : undefined;
    if (!src) return;
    let cancelled = false;
    let made: { blob: Blob; url: string }[] = [];
    captureFrames(src).then(
      (blobs) => {
        made = blobs.map((blob) => ({ blob, url: URL.createObjectURL(blob) }));
        if (cancelled) made.forEach((f) => URL.revokeObjectURL(f.url));
        else setFrames(made);
      },
      () => !cancelled && setFailed(true),
    );
    return () => {
      cancelled = true;
      made.forEach((f) => URL.revokeObjectURL(f.url));
    };
  }, [media]);

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Elegir un fotograma">
      <div className={styles.sheet}>
        <h2 className={styles.title}>Elige un fotograma</h2>
        {youtube ? (
          <div className={styles.grid}>
            {youtube.map((url) => (
              <button key={url} type="button" className={styles.option} onClick={() => onPickUrl(url)}>
                <img src={url} alt="" referrerPolicy="no-referrer" />
              </button>
            ))}
          </div>
        ) : failed ? (
          <p className={styles.note}>
            Este vídeo no deja sacar fotogramas desde la app. Puedes hacer una captura y subirla desde la galería.
          </p>
        ) : !frames ? (
          <p className={styles.note}>Sacando fotogramas del vídeo…</p>
        ) : (
          <div className={styles.grid}>
            {frames.map((f) => (
              <button key={f.url} type="button" className={styles.option} onClick={() => onPickFrame(f.blob)}>
                <img src={f.url} alt="" />
              </button>
            ))}
          </div>
        )}
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}
