import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PhotoField } from '../components/PhotoField';
import { Button, EmptyState, ErrorBanner, Field, LinkButton } from '../components/ui';
import { ui } from '../components/ui-styles';
import { useChannel } from '../hooks/channel-context';
import { useAction } from '../hooks/useAction';
import { repository } from '../services';
import type { CardInput, UploadedPhoto } from '../types/domain';
import { fullName, sortPeople } from '../utils/people';

/** Add (/album/nuevo[?persona=]) or edit (/album/:cardId/editar) a cromo. Admins only. */
export function CardFormPage() {
  const { cardId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { snapshot, isAdmin, reload } = useChannel();
  const { run, pending, error } = useAction();
  const { channel, cards, people } = snapshot;
  const existing = cardId ? cards.find((c) => c.id === cardId) : undefined;
  const presetPerson = params.get('persona') ?? '';

  // A link typed by hand, or a photo uploaded from the phone (stored file).
  const [imageUrl, setImageUrl] = useState(existing && !existing.imagePath ? existing.imageUrl : '');
  const [stored, setStored] = useState<UploadedPhoto | null>(
    existing?.imagePath
      ? { path: existing.imagePath, blurredPath: existing.blurredPath, previewUrl: existing.imageUrl }
      : null,
  );
  const [title, setTitle] = useState(existing?.title ?? '');
  const [personId, setPersonId] = useState(
    existing ? (existing.personId ?? '') : people.some((p) => p.id === presetPerson) ? presetPerson : (sortPeople(people)[0]?.id ?? ''),
  );
  const [takenAt, setTakenAt] = useState(existing?.takenAt ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');

  if (!isAdmin) {
    return (
      <EmptyState>
        <p>Solo los administradores del canal pueden añadir o editar cromos.</p>
      </EmptyState>
    );
  }
  if (cardId && !existing) {
    return (
      <EmptyState>
        <p>Este cromo no existe.</p>
      </EmptyState>
    );
  }

  const albumUrl = `/albumes/${channel.id}`;
  const back = existing ? `${albumUrl}/${existing.id}` : albumUrl;

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1>{existing ? `Editar cromo #${existing.number}` : 'Añadir cromo'}</h1>
        <LinkButton to={back} variant="ghost" small>
          Cancelar
        </LinkButton>
      </div>
      <form
        className={ui.form}
        onSubmit={async (e) => {
          e.preventDefault();
          const input: CardInput = {
            title,
            description,
            imageUrl: stored ? '' : imageUrl.trim(),
            ...(stored ? { imagePath: stored.path, blurredPath: stored.blurredPath } : {}),
            takenAt: takenAt.trim(),
            ...(personId ? { personId } : {}),
          };
          const id = await run(async () => {
            if (existing) {
              await repository.updateCard(channel.id, existing.id, input);
              return existing.id;
            }
            return (await repository.addCard(channel.id, input)).id;
          });
          if (id) {
            await reload();
            navigate(`${albumUrl}/${id}`, { replace: true });
          }
        }}
      >
        <PhotoField
          label="Foto del cromo"
          channelId={channel.id}
          kind="cromo"
          aspect="3 / 4"
          previewUrl={stored?.previewUrl}
          url={imageUrl}
          onUrlChange={(url) => {
            setImageUrl(url);
            if (url) setStored(null);
          }}
          onUploaded={(photo) => {
            setStored(photo);
            setImageUrl('');
          }}
          onClear={() => setStored(null)}
        />
        <Field label="Título" htmlFor="title">
          <input
            id="title"
            className={ui.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej.: Tocando la batería"
            maxLength={120}
            required
          />
        </Field>
        <Field label="Persona (categoría del álbum)" htmlFor="personId">
          <select id="personId" className={ui.input} value={personId} onChange={(e) => setPersonId(e.target.value)}>
            {sortPeople(people).map((p) => (
              <option key={p.id} value={p.id}>
                {fullName(p)}
              </option>
            ))}
            <option value="">Varios (foto de grupo)</option>
          </select>
        </Field>
        <Field label="¿Cuándo se hizo la foto?" htmlFor="takenAt" hint="AAAA, AAAA-MM o AAAA-MM-DD">
          <input
            id="takenAt"
            className={ui.input}
            value={takenAt}
            onChange={(e) => setTakenAt(e.target.value)}
            placeholder="2011-12"
            inputMode="numeric"
            pattern="\d{4}(-\d{2}(-\d{2})?)?"
            required
          />
        </Field>
        <Field label="Descripción (opcional)" htmlFor="description">
          <textarea
            id="description"
            className={ui.input}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
          />
        </Field>
        <ErrorBanner message={error} />
        <div className={ui.formActions}>
          <Button type="submit" variant="primary" disabled={pending}>
            {existing ? 'Guardar cambios' : 'Añadir cromo'}
          </Button>
        </div>
      </form>
    </div>
  );
}
