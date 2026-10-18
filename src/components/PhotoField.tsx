import { useId, useRef, useState } from 'react';
import { repository } from '../services';
import { errorMessage } from '../services/repository';
import type { PhotoKind, UploadedPhoto } from '../types/domain';
import { PHOTO_MAX_SIDE, blurredCopy, compressPhoto } from '../utils/imageCompress';
import { FitImage } from './FitImage';
import { Icon } from './Icon';
import { Button } from './ui';
import { ui } from './ui-styles';
import styles from './PhotoField.module.scss';

interface Props {
  label: string;
  channelId: string;
  kind: PhotoKind;
  /** Person whose photo it is (kind «persona»). */
  personId?: string;
  /** What is shown now (link or temporary URL of the stored file). */
  previewUrl?: string;
  /** Link typed by hand (kept as an alternative to uploading). */
  url: string;
  onUrlChange(url: string): void;
  onUploaded(photo: UploadedPhoto): void;
  onClear(): void;
  /** Without a person yet (new card): the file waits until there is one. */
  onFileWaiting?(file: File): void;
  /** Shape of the preview (cromos are portrait, covers landscape…). */
  aspect?: string;
}

/**
 * A photo for a cromo, a person or a video cover: upload it from the phone
 * (compressed in the app before sending) or paste a link.
 */
export function PhotoField({
  label,
  channelId,
  kind,
  personId,
  previewUrl,
  url,
  onUrlChange,
  onUploaded,
  onClear,
  onFileWaiting,
  aspect = '4 / 3',
}: Props) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLink, setShowLink] = useState(!!url);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const shown = localPreview ?? previewUrl ?? (url || undefined);

  const pick = async (file: File) => {
    setError(null);
    if (kind === 'persona' && !personId && onFileWaiting) {
      // New person: upload after saving it (the photo goes in their folder).
      setLocalPreview(URL.createObjectURL(file));
      onFileWaiting(file);
      return;
    }
    setBusy(true);
    try {
      const image = await compressPhoto(file, PHOTO_MAX_SIDE[kind]);
      const blurred = kind === 'cromo' ? await blurredCopy(file) : undefined;
      const uploaded = await repository.uploadPhoto(channelId, kind, image, { personId, blurred });
      setLocalPreview(null);
      onUploaded(uploaded);
    } catch (e) {
      setError(
        e instanceof Error && /not-an-image|no-webp|no-canvas|decode/i.test(e.message)
          ? 'No se ha podido leer esa imagen. Prueba con otra foto.'
          : errorMessage(e),
      );
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className={styles.field}>
      <span className={styles.label}>{label}</span>
      <div className={styles.row}>
        <span className={styles.preview} style={{ aspectRatio: aspect }}>
          {shown ? <FitImage src={shown} /> : <span className={styles.empty}>Sin foto</span>}
        </span>
        <div className={styles.actions}>
          <input
            ref={fileRef}
            id={inputId}
            type="file"
            accept="image/*"
            className={styles.file}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void pick(file);
            }}
          />
          <label htmlFor={inputId} className={[ui.button, ui.secondary, ui.small, busy ? styles.disabled : ''].join(' ')}>
            <Icon name="upload" size={18} />
            {busy ? 'Subiendo…' : shown ? 'Cambiar foto' : 'Subir foto'}
          </label>
          {shown && (
            <Button
              small
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setLocalPreview(null);
                onUrlChange('');
                onClear();
              }}
            >
              Quitar
            </Button>
          )}
          {!showLink && (
            <button type="button" className={styles.link} onClick={() => setShowLink(true)}>
              o usar un enlace
            </button>
          )}
        </div>
      </div>
      {showLink && (
        <input
          className={ui.input}
          type="url"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder="https://"
          aria-label={`${label}: enlace`}
        />
      )}
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
