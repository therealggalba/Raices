import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button, EmptyState, ErrorBanner, Field, LinkButton } from '../components/ui';
import { ui } from '../components/ui-styles';
import { useChannel } from '../hooks/channel-context';
import { useAction } from '../hooks/useAction';
import { confirmAction } from '../hooks/useConfirm';
import { repository } from '../services';
import type { Gender, PersonInput } from '../types/domain';
import { descendantsOf } from '../utils/familyTree';
import { fullName, sortPeople } from '../utils/people';
import styles from './PersonFormPage.module.scss';

/** Add (/personas/nueva) or edit (/personas/:personId/editar) a person. Admins only. */
export function PersonFormPage() {
  const { personId } = useParams();
  // «No estoy en la lista»: the admin creating their own card.
  const [params] = useSearchParams();
  const isSelf = !personId && params.get('soyyo') === '1';
  const navigate = useNavigate();
  const { snapshot, isAdmin, reload, personById } = useChannel();
  const { run, pending, error } = useAction();
  const existing = personId ? personById(personId) : undefined;
  const channelId = snapshot.channel.id;
  const isFamily = snapshot.channel.kind === 'familia';

  const [firstName, setFirstName] = useState(existing?.firstName ?? '');
  const [lastName, setLastName] = useState(existing?.lastName ?? '');
  const [birthDate, setBirthDate] = useState(existing?.birthDate ?? '');
  const [deathDate, setDeathDate] = useState(existing?.deathDate ?? '');
  const [gender, setGender] = useState<Gender | ''>(existing?.gender ?? '');
  const [relationship, setRelationship] = useState(existing?.relationship ?? '');
  const [photoUrl, setPhotoUrl] = useState(existing?.photoUrl ?? '');
  const [biography, setBiography] = useState(existing?.biography ?? '');
  const [parent1, setParent1] = useState(existing?.parentIds[0] ?? '');
  const [parent2, setParent2] = useState(existing?.parentIds[1] ?? '');

  // Members may correct their own card (the tree links stay with the admins).
  const selfMode = !isAdmin && !!existing && existing.id === snapshot.me.personId;
  if (!isAdmin && !selfMode) {
    return (
      <EmptyState>
        <p>Solo los administradores pueden gestionar personas.</p>
      </EmptyState>
    );
  }
  if (personId && !existing) {
    return (
      <EmptyState>
        <p>Esta persona no existe.</p>
      </EmptyState>
    );
  }

  // Anyone but the person and their descendants (no one is their own ancestor).
  const below = existing ? descendantsOf(snapshot.people, existing.id) : new Set<string>();
  const parentCandidates = sortPeople(snapshot.people).filter((p) => p.id !== existing?.id && !below.has(p.id));
  const back = existing ? `/c/${channelId}/personas/${existing.id}` : `/c/${channelId}/personas`;

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1>
          {selfMode
            ? 'Mis datos'
            : existing
              ? `Editar a ${existing.firstName}`
              : isSelf
                ? 'Tu ficha'
                : 'Añadir persona'}
        </h1>
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
            // Only family channels use it.
            relationship: isFamily ? relationship : '',
            biography,
            ...(birthDate ? { birthDate } : {}),
            ...(deathDate ? { deathDate } : {}),
            ...(gender ? { gender } : {}),
            ...(photoUrl.trim() ? { photoUrl: photoUrl.trim() } : {}),
            parentIds: [parent1, parent2].filter(Boolean),
          };
          const id = await run(async () => {
            if (selfMode && existing) {
              const { firstName: f, lastName: l, biography: b, birthDate: d, gender: g, photoUrl: u } = input;
              await repository.updateMyPerson(channelId, {
                firstName: f,
                lastName: l,
                biography: b,
                ...(d ? { birthDate: d } : {}),
                ...(g ? { gender: g } : {}),
                ...(u ? { photoUrl: u } : {}),
              });
              return existing.id;
            }
            if (existing) {
              await repository.updatePerson(channelId, existing.id, input);
              return existing.id;
            }
            const added = await repository.addPerson(channelId, input);
            if (isSelf) await repository.linkMemberPerson(channelId, snapshot.me.userId, added.id);
            return added.id;
          });
          if (id) {
            await reload();
            navigate(`/c/${channelId}/personas/${id}`, { replace: true });
          }
        }}
      >
        <Field label="Nombre" htmlFor="firstName">
          <input
            id="firstName"
            className={ui.input}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            maxLength={80}
            required
          />
        </Field>
        <Field label="Apellidos" htmlFor="lastName">
          <input
            id="lastName"
            className={ui.input}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            maxLength={80}
          />
        </Field>
        <Field label="Género" htmlFor="gender">
          <select
            id="gender"
            className={ui.input}
            value={gender}
            onChange={(e) => setGender(e.target.value as Gender | '')}
          >
            <option value="">Sin indicar</option>
            <option value="hombre">Hombre</option>
            <option value="mujer">Mujer</option>
          </select>
        </Field>
        {isFamily && !selfMode && (
          <Field
            label="Relación familiar"
            htmlFor="relationship"
            hint="Si no está en el árbol: amiga de la familia, vecino…"
          >
            <input
              id="relationship"
              className={ui.input}
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              maxLength={60}
            />
          </Field>
        )}
        {isFamily && !selfMode && (
          <fieldset className={styles.parents}>
            <legend>Progenitores (árbol familiar)</legend>
            {[
              ['parent1', parent1, setParent1, parent2],
              ['parent2', parent2, setParent2, parent1],
            ].map(([id, value, set, other]) => (
              <select
                key={id as string}
                id={id as string}
                aria-label={id === 'parent1' ? 'Progenitor 1' : 'Progenitor 2'}
                className={ui.input}
                value={value as string}
                onChange={(e) => (set as (v: string) => void)(e.target.value)}
              >
                <option value="">— Sin indicar —</option>
                {parentCandidates
                  .filter((p) => p.id !== other)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {fullName(p)}
                    </option>
                  ))}
              </select>
            ))}
          </fieldset>
        )}
        <Field label="Fecha de nacimiento" htmlFor="birthDate">
          <input
            id="birthDate"
            className={ui.input}
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
          />
        </Field>
        {!selfMode && (
          <Field label="Fecha de fallecimiento" htmlFor="deathDate">
            <input
              id="deathDate"
              className={ui.input}
              type="date"
              value={deathDate}
              min={birthDate || undefined}
              onChange={(e) => setDeathDate(e.target.value)}
            />
          </Field>
        )}
        <Field label="Fotografía (opcional)" htmlFor="photoUrl">
          <input
            id="photoUrl"
            className={ui.input}
            type="url"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="https://"
          />
        </Field>
        <Field label="Biografía" htmlFor="biography">
          <textarea
            id="biography"
            className={ui.input}
            value={biography}
            onChange={(e) => setBiography(e.target.value)}
            maxLength={4000}
          />
        </Field>
        <ErrorBanner message={error} />
        <div className={ui.formActions}>
          {existing && !selfMode && (
            <Button
              variant="danger"
              disabled={pending}
              onClick={async () => {
                if (!confirmAction(`¿Eliminar a ${fullName(existing)}? Se quitará también de los vídeos y eventos.`))
                  return;
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
