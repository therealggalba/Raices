import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PeoplePicker } from '../components/PeoplePicker';
import { Button, EmptyState, ErrorBanner, Field, LinkButton } from '../components/ui';
import { ui } from '../components/ui-styles';
import { useChannel } from '../hooks/channel-context';
import { useAction } from '../hooks/useAction';
import { repository } from '../services';
import { VIDEO_CATEGORIES } from '../types/domain';
import type { VideoCategory, VideoInput } from '../types/domain';
import { formatDuration } from '../utils/dates';
import { CATEGORY_LABELS } from '../utils/labels';
import { resolveMedia } from '../utils/media';
import { parseDurationInput, parseTagsInput } from '../utils/validation';

const PROVIDER_LABELS = {
  youtube: 'YouTube',
  vimeo: 'Vimeo',
  drive: 'Google Drive',
  file: 'Archivo de vídeo',
  link: 'Enlace externo (se abrirá en otra pestaña)',
} as const;

/** Add (/subir) or edit (/v/:videoId/editar) a video. Admins only. */
export function VideoFormPage() {
  const { videoId } = useParams();
  const navigate = useNavigate();
  const { snapshot, isAdmin, reload } = useChannel();
  const { run, pending, error, setError } = useAction();
  const { channel, people } = snapshot;
  const existing = videoId ? snapshot.videos.find((v) => v.id === videoId) : undefined;

  const [mediaUrl, setMediaUrl] = useState(existing?.mediaUrl ?? '');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [eventDate, setEventDate] = useState(existing?.eventDate ?? '');
  const [category, setCategory] = useState<VideoCategory>(existing?.category ?? 'reunion');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [thumbnailUrl, setThumbnailUrl] = useState(existing?.thumbnailUrl ?? '');
  const [duration, setDuration] = useState(
    existing?.durationSeconds ? secondsToInput(existing.durationSeconds) : '',
  );
  const [tags, setTags] = useState(existing?.tags.join(', ') ?? '');
  const [personIds, setPersonIds] = useState<string[]>(existing?.personIds ?? []);

  if (!isAdmin) {
    return (
      <EmptyState icon="🔒">
        <p>Solo los administradores del canal pueden añadir o editar vídeos.</p>
      </EmptyState>
    );
  }
  if (videoId && !existing) {
    return (
      <EmptyState icon="🔍">
        <p>Este vídeo no existe.</p>
      </EmptyState>
    );
  }

  const media = mediaUrl.trim() ? resolveMedia(mediaUrl) : null;
  const durationSeconds = parseDurationInput(duration);
  const back = existing ? `/c/${channel.id}/v/${existing.id}` : `/c/${channel.id}`;

  async function submit() {
    if (Number.isNaN(durationSeconds)) {
      setError('Duración: usa segundos (90), m:ss (5:12) o h:mm:ss');
      return;
    }
    const input: VideoInput = {
      title,
      description,
      mediaUrl,
      eventDate: eventDate.trim(),
      category,
      tags: parseTagsInput(tags),
      personIds,
      ...(thumbnailUrl.trim() ? { thumbnailUrl: thumbnailUrl.trim() } : {}),
      ...(durationSeconds ? { durationSeconds } : {}),
    };
    const id = await run(async () => {
      if (existing) {
        await repository.updateVideo(channel.id, existing.id, input);
        return existing.id;
      }
      return (await repository.addVideo(channel.id, input)).id;
    });
    if (id) {
      await reload();
      navigate(`/c/${channel.id}/v/${id}`, { replace: true });
    }
  }

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1>{existing ? 'Editar vídeo' : 'Añadir vídeo'}</h1>
        <LinkButton to={back} variant="ghost" small>
          Cancelar
        </LinkButton>
      </div>
      <form
        className={ui.form}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field
          label="Enlace del vídeo"
          htmlFor="mediaUrl"
          hint={
            media
              ? `Detectado: ${PROVIDER_LABELS[media.kind]}`
              : 'YouTube (puede ser oculto), Vimeo, Google Drive o un enlace directo a un .mp4'
          }
        >
          <input
            id="mediaUrl"
            className={ui.input}
            type="url"
            inputMode="url"
            value={mediaUrl}
            onChange={(e) => setMediaUrl(e.target.value)}
            placeholder="https://"
            required
          />
        </Field>
        <Field label="Título" htmlFor="title">
          <input id="title" className={ui.input} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
        </Field>
        <Field label="¿Cuándo ocurrió?" htmlFor="eventDate" hint="AAAA, AAAA-MM o AAAA-MM-DD si lo sabes exacto">
          <input
            id="eventDate"
            className={ui.input}
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            placeholder="1998-07"
            inputMode="numeric"
            pattern="\d{4}(-\d{2}(-\d{2})?)?"
            required
          />
        </Field>
        <Field label="Categoría" htmlFor="category">
          <select
            id="category"
            className={ui.input}
            value={category}
            onChange={(e) => setCategory(e.target.value as VideoCategory)}
          >
            {VIDEO_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Descripción" htmlFor="description" hint="¿Qué pasó ese día? ¿Quién grabó?">
          <textarea
            id="description"
            className={ui.input}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
          />
        </Field>
        <Field label="Personas que aparecen" htmlFor="people">
          <PeoplePicker people={people} value={personIds} onChange={setPersonIds} />
        </Field>
        <Field
          label="Miniatura (opcional)"
          htmlFor="thumbnailUrl"
          hint={media?.kind === 'youtube' ? 'Si la dejas vacía se usa la de YouTube' : 'Enlace https a una imagen'}
        >
          <input
            id="thumbnailUrl"
            className={ui.input}
            type="url"
            value={thumbnailUrl}
            onChange={(e) => setThumbnailUrl(e.target.value)}
            placeholder="https://"
          />
        </Field>
        <Field
          label="Duración (opcional)"
          htmlFor="duration"
          hint={durationSeconds && !Number.isNaN(durationSeconds) ? formatDuration(durationSeconds) : 'Ej.: 5:12'}
        >
          <input id="duration" className={ui.input} value={duration} onChange={(e) => setDuration(e.target.value)} />
        </Field>
        <Field label="Etiquetas (opcional)" htmlFor="tags" hint="Separadas por comas">
          <input
            id="tags"
            className={ui.input}
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="playa, abuelos"
          />
        </Field>
        <ErrorBanner message={error} />
        <div className={ui.formActions}>
          <Button type="submit" variant="primary" disabled={pending}>
            {existing ? 'Guardar cambios' : 'Añadir vídeo'}
          </Button>
        </div>
      </form>
    </div>
  );
}

function secondsToInput(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}
