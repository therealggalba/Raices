import styles from './FitImage.module.scss';

interface Props {
  src: string;
  alt?: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  onError?(): void;
}

/**
 * A photo that always fills its frame (any orientation): it is scaled to
 * cover the whole frame, centred, cropping whatever doesn't fit — never side
 * bands. The parent sets the frame size (e.g. aspect-ratio).
 *
 * No referrer is sent: Google's image servers (Drive thumbnails) reject
 * hot-linked requests that carry another site's referrer.
 */
export function FitImage({ src, alt = '', className, loading = 'lazy', onError }: Props) {
  return (
    <span className={[styles.fit, className].filter(Boolean).join(' ')}>
      <img src={src} alt={alt} loading={loading} draggable={false} referrerPolicy="no-referrer" onError={onError} />
    </span>
  );
}
