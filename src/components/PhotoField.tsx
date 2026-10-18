import { useId, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { repository } from '../services';
import { errorMessage } from '../services/repository';
import type { PhotoKind, UploadedPhoto } from '../types/domain';
import { isNativeApp, pickNativePhoto } from '../native/nativeBridge';
import { PHOTO_MAX_SIDE, blurredCopy } from '../utils/imageCompress';
import { PhotoCropper } from './PhotoCropper';
import { FramePicker } from './FramePicker';
import { canPickFrames } from '../utils/media';
import type { MediaSource } from '../utils/media';
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
  /** Without a person yet (new card): the framed photo waits until there is one. */
  onFileWaiting?(photo: Blob): void;
  /** Shape of the preview (cromos are portrait, covers landscape…). */
  aspect?: string;
  /** Video covers: the video, to choose one of its frames. */
  video?: MediaSource | null;
}

/** Shape of each kind of photo in the app. */
const ASPECTS: Record<PhotoKind, number> = { cromo: 3 / 4, persona: 1, miniatura: 16 / 9 };

/**
 * A photo for a cromo, a person or a video cover: take it with the camera
 * or pick it from the gallery, frame it, and it is uploaded (compressed in
 * the app first). A link can still be pasted instead.
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
  video,
}: Props) {
  const galleryId = useId();
  const cameraId = useId();
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [toCrop, setToCrop] = useState<Blob | null>(null);
  const [pickingFrame, setPickingFrame] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLink, setShowLink] = useState(!!url);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const shown = localPreview ?? previewUrl ?? (url || undefined);

  // 1) a photo from the camera or the gallery → 2) framed → 3) uploaded.
  const choose = async (source: 'camera' | 'gallery') => {
    setError(null);
    if (isNativeApp()) {
      const photo = await pickNativePhoto(source);
      if (photo) setToCrop(photo);
      return;
    }
    (source === 'camera' ? cameraRef : galleryRef).current?.click();
  };

  const upload = async (framed: Blob) => {
    setToCrop(null);
    setError(null);
    if (kind === 'persona' && !personId && onFileWaiting) {
      // New person: uploaded right after saving them (it goes in their folder).
      setLocalPreview(URL.createObjectURL(framed));
      onFileWaiting(framed);
      return;
    }
    setBusy(true);
    try {
      const blurred = kind === 'cromo' ? await blurredCopy(framed) : undefined;
      const uploaded = await repository.uploadPhoto(channelId, kind, framed, { personId, blurred });
      setLocalPreview(null);
      onUploaded(uploaded);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const onInput = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) setToCrop(file);
  };

  return (
    <div className={styles.field}>
      <span className={styles.label}>{label}</span>
      <div className={styles.row}>
        <span className={styles.preview} style={{ aspectRatio: aspect }}>
          {shown ? <FitImage src={shown} /> : <span className={styles.empty}>Sin foto</span>}
        </span>
        <div className={styles.actions}>
          <input ref={galleryRef} id={galleryId} type="file" accept="image/*" className={styles.file} onChange={onInput} />
          <input
            ref={cameraRef}
            id={cameraId}
            type="file"
            accept="image/*"
            capture="environment"
            className={styles.file}
            onChange={onInput}
          />
          <div className={styles.sources}>
            <Button small disabled={busy} onClick={() => void choose('camera')}>
              <Icon name="camera" size={18} />
              Cámara
            </Button>
            <Button small disabled={busy} onClick={() => void choose('gallery')}>
              <Icon name="upload" size={18} />
              {busy ? 'Subiendo…' : 'Galería'}
            </Button>
            {canPickFrames(video ?? null) && (
              <Button small disabled={busy} onClick={() => setPickingFrame(true)}>
                <Icon name="videos" size={18} />
                Del vídeo
              </Button>
            )}
          </div>
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
      {pickingFrame && video && (
        <FramePicker
          media={video}
          onPickUrl={(frameUrl) => {
            setPickingFrame(false);
            onClear();
            onUrlChange(frameUrl);
          }}
          onPickFrame={(frame) => {
            setPickingFrame(false);
            setToCrop(frame);
          }}
          onClose={() => setPickingFrame(false)}
        />
      )}
      {toCrop && (
        <PhotoCropper
          file={toCrop}
          aspect={ASPECTS[kind]}
          maxSide={PHOTO_MAX_SIDE[kind]}
          onDone={(framed) => void upload(framed)}
          onCancel={() => setToCrop(null)}
        />
      )}
    </div>
  );
}
