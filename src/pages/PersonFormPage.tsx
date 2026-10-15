import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, EmptyState, ErrorBanner, Field, LinkButton } from '../components/ui';
import { ui } from '../components/ui-styles';
import { useChannel } from '../hooks/channel-context';
import { useAction } from '../hooks/useAction';
import { confirmAction } from '../hooks/useConfirm';
import { repository } from '../services';
import type { PersonInput } from '../types/domain';
import { fullName } from '../utils/people';

/** Add (/personas/nueva) or edit (/personas/:personId/editar) a person. Admins only. */
export function PersonFormPage() {
  const { personId } = useParams();
  const navigate = useNavigate();
  const { snapshot, isAdmin, reload, personById } = useChannel();
  const { run, pending, error } = useAction();
  const existing = personId ? personById(personId) : undefined;
  const channelId = snapshot.channel.id;

  const [firstName, setFirstName] = useState(existing?.firstName ?? '');
  const [lastName, setLastName] = useState(existing?.lastName ?? '');
  const [birthDate, setBirthDate] = useState(existing?.birthDate ?? '');
  const [relationship, setRelationship] = useState(existing?.relationship ?? '');
  const [photoUrl, setPhotoUrl] = useState(existing?.photoUrl ?? '');
  const [biography, setBiography] = useState(existing?.biography ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');

  if (!isAdmin) {
    return (
      <EmptyState icon="🔒">
        <p>Solo los administradores pueden gestionar personas.</p>
      </EmptyState>
    );
  }
  if (personId && !existing) {
    return (
      <EmptyState icon="🔍">
        <p>Esta persona no existe.</p>
      </EmptyState>
    );
  }

  const back = existing ? `/c/${channelId}/personas/${existing.id}` : `/c/${channelId}/personas`;

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1>{existing ? `Editar a ${existing.firstName}` : 'Añadir persona'}</h1>
        <LinkButton to={back} variant="ghost" small>
          Cancelar
        </LinkButton>
      </div>
      <form
        className={ui.form}
        onSubmit={async (e) => {
          e.preventDefault();
          const input: PersonInput = {
            firstName,
            lastName,
            relationship,
            biography,
            notes,
            ...(birthDate ? { birthDate } : {}),
            ...(photoUrl.trim() ? { photoUrl: photoUrl.trim() } : {}),
          };
          const id = await run(async () => {
            if (existing) {
              await repository.updatePerson(channelId, existing.id, input);
              return existing.id;
            }
            return (await repository.addPerson(channelId, input)).id;
          });
          if (id) {
            await reload();
            navigate(`/c/${channelId}/personas/${id}`, { replace: true });
          }
        }}
      >
        <Field label="Nombre" htmlFor="firstName">
          <input id="firstName" className={ui.input} value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={80} required />
        </Field>
        <Field label="Apellidos" htmlFor="lastName">
          <input id="lastName" className={ui.input} value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={80} />
        </Field>
        <Field label="Relación familiar" htmlFor="relationship" hint="Ej.: Abuela paterna, Primo, Amiga de la familia">
          <input id="relationship" className={ui.input} value={relationship} onChange={(e) => setRelationship(e.target.value)} maxLength={60} />
        </Field>
        <Field label="Fecha de nacimiento" htmlFor="birthDate" hint="Con ella se crea su cumpleaños automáticamente">
          <input id="birthDate" className={ui.input} type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        </Field>
        <Field label="Fotografía (opcional)" htmlFor="photoUrl" hint="Enlace https a una imagen">
          <input id="photoUrl" className={ui.input} type="url" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://" />
        </Field>
        <Field label="Biografía" htmlFor="biography">
          <textarea id="biography" className={ui.input} value={biography} onChange={(e) => setBiography(e.target.value)} maxLength={4000} />
        </Field>
        <Field label="Notas" htmlFor="notes">
          <textarea id="notes" className={ui.input} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
        </Field>
        <ErrorBanner message={error} />
        <div className={ui.formActions}>
          {existing && (
            <Button
              variant="danger"
              disabled={pending}
              onClick={async () => {
                if (!confirmAction(`¿Eliminar a ${fullName(existing)}? Se quitará también de los vídeos y eventos.`)) return;
                const done = await run(async () => {
                  await repository.deletePerson(channelId, existing.id);
                  return true;
                });
                if (done) {
                  await reload();
                  navigate(`/c/${channelId}/personas`, { replace: true });
                }
              }}
            >
              Eliminar
            </Button>
          )}
          <Button type="submit" variant="primary" disabled={pending}>
            Guardar
          </Button>
        </div>
      </form>
    </div>
  );
}
