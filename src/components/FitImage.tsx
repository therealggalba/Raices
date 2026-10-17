import styles from './FitImage.module.scss';

interface Props {
  src: string;
  alt?: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  onError?(): void;
}

/**
 * Shows a photo of any orientation inside a frame of fixed proportions: the
 * whole photo, never cropped, centred; the spare space is filled with the
 * same photo zoomed and blurred. Every cover/cromo keeps the standard size.
 * The parent sets the frame size (e.g. aspect-ratio).
 */
export function FitImage({ src, alt = '', className, loading = 'lazy', onError }: Props) {
  return (
    <span className={[styles.fit, className].filter(Boolean).join(' ')}>
      <img className={styles.backdrop} src={src} alt="" aria-hidden loading={loading} draggable={false} />
      <img className={styles.main} src={src} alt={alt} loading={loading} draggable={false} onError={onError} />
    </span>
  );
}
