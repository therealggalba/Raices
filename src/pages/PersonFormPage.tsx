import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button, EmptyState, ErrorBanner, Field, LinkButton } from '../components/ui';
import { ui } from '../components/ui-styles';
import { useChannel } from '../hooks/channel-context';
import { useAction } from '../hooks/useAction';
import { confirmAction } from '../hooks/useConfirm';
import { repository } from '../services';
import { SPECIES } from '../types/domain';
import type { Gender, PersonInput, Species, UploadedPhoto } from '../types/domain';
import { descendantsOf, partnerChanges } from '../utils/familyTree';
import { fullName, humansOnly, sortPeople } from '../utils/people';
import { guessGender } from '../utils/genderNames';
import { PhotoField } from '../components/PhotoField';
import { SPECIES_LABELS } from '../utils/labels';
import { PartnersEditor } from '../components/PartnersEditor';
import type { PartnerRow } from '../utils/familyTree';
import styles from './PersonFormPage.module.scss';

/** Add (/personas/nueva) or edit (/personas/:personId/editar) a person. Admins only. */
export function PersonFormPage() {
  const { personId } = useParams();
  // «No estoy en la lista»: the owner creating their own card.
  const [params] = useSearchParams();
  const isSelf = !personId && params.get('soyyo') === '1';
  // A pet (?tipo=mascota, or an existing one): no surname, gender or parents.
  const navigate = useNavigate();
  const { snapshot, isOwner, reload, personById } = useChannel();
  const { run, pending, error } = useAction();
  const existing = personId ? personById(personId) : undefined;
  const pet = existing ? existing.kind === 'mascota' : params.get('tipo') === 'mascota';
  const [species, setSpecies] = useState<Species>(existing?.species ?? 'perro');
  const channelId = snapshot.channel.id;
  const isFamily = snapshot.channel.kind === 'familia';

  const [firstName, setFirstName] = useState(existing?.firstName ?? '');
  const [lastName, setLastName] = useState(existing?.lastName ?? '');
  const [birthDate, setBirthDate] = useState(existing?.birthDate ?? '');
  const [deathDate, setDeathDate] = useState(existing?.deathDate ?? '');
  // Gender is guessed from the first name; it's only asked when the name
  // doesn't tell, or when someone wants to change it.
  const [chosenGender, setGender] = useState<Gender | '' | null>(existing ? (existing.gender ?? '') : null);
  const [askGender, setAskGender] = useState(false);
  // Photo: a link, a file already uploaded, or (new person) a file that is
  // uploaded right after saving them, into their own folder.
  const [photoUrl, setPhotoUrl] = useState(existing && !existing.photoPath ? (existing.photoUrl ?? '') : '');
  const [photoStored, setPhotoStored] = useState<UploadedPhoto | null>(
    existing?.photoPath ? { path: existing.photoPath, previewUrl: existing.photoUrl ?? '' } : null,
  );
  const [pendingPhoto, setPendingPhoto] = useState<Blob | null>(null);
  const [biography, setBiography] = useState(existing?.biography ?? '');
  const [parent1, setParent1] = useState(existing?.parentIds[0] ?? '');
  const [parent2, setParent2] = useState(existing?.parentIds[1] ?? '');
  // Couples, edited here (the profile only shows them).
  const originalPartners = existing ? snapshot.partnerships.filter((c) => c.personIds.includes(existing.id)) : [];
  const [partners, setPartners] = useState<PartnerRow[]>(() =>
    originalPartners.map((c) => ({
      id: c.id,
      partnerId: c.personIds.find((pid) => pid !== existing?.id)!,
      since: c.since ?? '',
      until: c.until ?? '',
    })),
  );
  const withCouples = isFamily && !pet;
  /** Saves the couples once the person exists. */
  const saveCouples = async (personId: string) => {
    if (!withCouples) return;
    const { add, update, remove } = partnerChanges(personId, originalPartners, partners);
    for (const id of remove) await repository.deletePartnership(channelId, id);
    for (const { id, input } of update) await repository.updatePartnership(channelId, id, input);
    for (const input of add) await repository.addPartnership(channelId, input);
  };

  // Members may correct their own card (the tree links stay with the owner).
  const selfMode = !isOwner && !!existing && existing.id === snapshot.me.personId;
  if (!isOwner && !selfMode) {
    return (
      <EmptyState>
        <p>Solo el creador del canal puede gestionar personas.</p>
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

  const guessed = guessGender(firstName);
  const gender: Gender | '' = chosenGender ?? guessed ?? '';
  const showGenderSelect = askGender || (chosenGender === null && !guessed) || (chosenGender !== null && !gender);

  // Anyone but the person and their descendants (no one is their own ancestor).
  const below = existing ? descendantsOf(snapshot.people, existing.id) : new Set<string>();
  const parentCandidates = sortPeople(humansOnly(snapshot.people)).filter(
    (p) => p.id !== existing?.id && !below.has(p.id),
  );
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
                : pet
                  ? 'Añadir mascota'
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
            ...(pet ? { kind: 'mascota' as const, species } : {}),
            firstName,
            lastName,
            // Kinship comes from the family tree; old free text is kept as it was.
            relationship: existing?.relationship ?? '',
            biography,
            ...(birthDate ? { birthDate } : {}),
            ...(deathDate ? { deathDate } : {}),
            ...(gender ? { gender } : {}),
            ...(photoStored ? { photoPath: photoStored.path } : photoUrl.trim() ? { photoUrl: photoUrl.trim() } : {}),
            parentIds: [parent1, parent2].filter(Boolean),
          };
          const id = await run(async () => {
            if (selfMode && existing) {
              const { firstName: f, lastName: l, biography: b, birthDate: d, gender: g, photoUrl: u, photoPath: ph } = input;
              await repository.updateMyPerson(channelId, {
                firstName: f,
                lastName: l,
                biography: b,
                ...(d ? { birthDate: d } : {}),
                ...(g ? { gender: g } : {}),
                ...(u ? { photoUrl: u } : {}),
                ...(ph ? { photoPath: ph } : {}),
              });
              return existing.id;
            }
            if (existing) {
              await repository.updatePerson(channelId, existing.id, input);
              await saveCouples(existing.id);
              return existing.id;
            }
            const added = await repository.addPerson(channelId, input);
            if (pendingPhoto) {
              const photo = await repository.uploadPhoto(channelId, 'persona', pendingPhoto, { personId: added.id });
              await repository.updatePerson(channelId, added.id, { ...input, photoUrl: undefined, photoPath: photo.path });
            }
            await saveCouples(added.id);
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
        {pet ? (
          <Field label="Especie" htmlFor="species">
            <select id="species" className={ui.input} value={species} onChange={(e) => setSpecies(e.target.value as Species)}>
              {SPECIES.map((sp) => (
                <option key={sp} value={sp}>
                  {SPECIES_LABELS[sp]}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="Apellidos" htmlFor="lastName">
            <input
              id="lastName"
              className={ui.input}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              maxLength={80}
            />
          </Field>
        )}
        {pet ? null : showGenderSelect ? (
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
        ) : (
          gender && (
            <p className={styles.genderLine}>
              {gender === 'hombre' ? 'Hombre' : 'Mujer'}
              <button type="button" className={styles.change} onClick={() => setAskGender(true)}>
                Cambiar
              </button>
            </p>
          )
        )}
        {isFamily && !selfMode && !pet && (
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
        {withCouples && !selfMode && (
          <PartnersEditor
            candidates={sortPeople(humansOnly(snapshot.people)).filter((p) => p.id !== existing?.id)}
            rows={partners}
            onChange={setPartners}
          />
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
        <PhotoField
          label="Foto"
          channelId={channelId}
          kind="persona"
          aspect="1 / 1"
          personId={existing?.id}
          previewUrl={photoStored?.previewUrl}
          url={photoUrl}
          onUrlChange={(url) => {
            setPhotoUrl(url);
            if (url) setPhotoStored(null);
          }}
          onUploaded={(photo) => {
            setPhotoStored(photo);
            setPhotoUrl('');
          }}
          onClear={() => {
            setPhotoStored(null);
            setPendingPhoto(null);
          }}
          onFileWaiting={setPendingPhoto}
        />
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
