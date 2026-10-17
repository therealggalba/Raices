import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useChannel } from '../hooks/channel-context';
import { useAction } from '../hooks/useAction';
import { confirmAction } from '../hooks/useConfirm';
import { repository } from '../services';
import type { Partnership, Person } from '../types/domain';
import { formatPartialDate } from '../utils/dates';
import { relativesOf } from '../utils/familyTree';
import { fullName, sortPeople } from '../utils/people';
import { PersonAvatar } from './PersonAvatar';
import { Button, ErrorBanner, Field } from './ui';
import { ui } from './ui-styles';
import styles from './PersonFamily.module.scss';

/** «Familia» section of a person: parents, partners, children and siblings. */
export function PersonFamily({ person }: { person: Person }) {
  const { snapshot, isAdmin, reload } = useChannel();
  const { channel, people, partnerships } = snapshot;
  const { run, pending, error } = useAction();
  const [form, setForm] = useState<{ partnership?: Partnership } | null>(null);
  const family = relativesOf(person, people, partnerships);
  const empty = !family.parents.length && !family.partners.length && !family.children.length && !family.siblings.length;

  const chip = (p: Person, extra?: string) => (
    <Link key={p.id} to={`/c/${channel.id}/personas/${p.id}`} className={styles.chip}>
      <PersonAvatar person={p} size={32} />
      <span>
        {p.firstName}
        {extra && <small>{extra}</small>}
      </span>
    </Link>
  );

  const group = (title: string, list: Person[]) =>
    list.length > 0 && (
      <div className={styles.group}>
        <h3>{title}</h3>
        <div className={styles.chips}>{list.map((p) => chip(p))}</div>
      </div>
    );

  return (
    <section className={ui.section}>
      <div className={styles.head}>
        <h2>Familia</h2>
        <Link to={`/c/${channel.id}/arbol`} className={styles.treeLink}>
          Ver en el árbol ›
        </Link>
      </div>
      {empty && !isAdmin && <p className={ui.muted}>Todavía no tiene vínculos en el árbol.</p>}
      {group(family.parents.length === 1 ? 'Progenitor' : 'Padres', family.parents)}

      {(family.partners.length > 0 || isAdmin) && (
        <div className={styles.group}>
          <h3>Pareja</h3>
          <div className={styles.partners}>
            {family.partners.map(({ person: partner, partnership }) => (
              <div key={partnership.id} className={styles.partner}>
                {chip(
                  partner,
                  [
                    partnership.since && `💍 ${formatPartialDate(partnership.since)}`,
                    partnership.until && `separados ${formatPartialDate(partnership.until)}`,
                  ]
                    .filter(Boolean)
                    .join(' · ') || undefined,
                )}
                {isAdmin && (
                  <span className={styles.partnerActions}>
                    <Button small variant="ghost" onClick={() => setForm({ partnership })}>
                      Fechas
                    </Button>
                    <Button
                      small
                      variant="ghost"
                      disabled={pending}
                      onClick={() => {
                        if (!confirmAction(`¿Quitar la relación de pareja con ${partner.firstName}?`)) return;
                        void run(async () => {
                          await repository.deletePartnership(channel.id, partnership.id);
                          await reload();
                        });
                      }}
                    >
                      Quitar
                    </Button>
                  </span>
                )}
              </div>
            ))}
            {isAdmin && !form && (
              <Button small onClick={() => setForm({})}>
                💍 Añadir pareja
              </Button>
            )}
          </div>
          {form && (
            <PartnerForm
              key={form.partnership?.id ?? 'new'}
              person={person}
              candidates={sortPeople(people).filter(
                (p) => p.id !== person.id && !family.partners.some((r) => r.person.id === p.id),
              )}
              partnership={form.partnership}
              onDone={async () => {
                setForm(null);
                await reload();
              }}
              onCancel={() => setForm(null)}
            />
          )}
        </div>
      )}

      {group('Hijos', family.children)}
      {group('Hermanos', family.siblings)}
      <ErrorBanner message={error} />
      {isAdmin && family.parents.length === 0 && (
        <p className={ui.hint}>Sus padres se eligen en «Editar» (Progenitores).</p>
      )}
    </section>
  );
}

function PartnerForm({
  person,
  candidates,
  partnership,
  onDone,
  onCancel,
}: {
  person: Person;
  candidates: Person[];
  partnership?: Partnership;
  onDone(): Promise<void>;
  onCancel(): void;
}) {
  const { snapshot } = useChannel();
  const { run, pending, error } = useAction();
  const [partnerId, setPartnerId] = useState(
    partnership ? partnership.personIds.find((id) => id !== person.id)! : (candidates[0]?.id ?? ''),
  );
  const [since, setSince] = useState(partnership?.since ?? '');
  const [until, setUntil] = useState(partnership?.until ?? '');
  const channelId = snapshot.channel.id;

  return (
    <form
      className={[ui.form, ui.card, styles.form].join(' ')}
      onSubmit={async (e) => {
        e.preventDefault();
        const input = {
          personIds: [person.id, partnerId] as [string, string],
          ...(since ? { since } : {}),
          ...(until ? { until } : {}),
        };
        const done = await run(async () => {
          if (partnership) await repository.updatePartnership(channelId, partnership.id, input);
          else await repository.addPartnership(channelId, input);
          return true;
        });
        if (done) await onDone();
      }}
    >
      {!partnership && (
        <Field label={`Pareja de ${person.firstName}`} htmlFor="partner">
          <select id="partner" className={ui.input} value={partnerId} onChange={(e) => setPartnerId(e.target.value)} required>
            {candidates.map((p) => (
              <option key={p.id} value={p.id}>
                {fullName(p)}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Fecha de boda o inicio (opcional)" htmlFor="since">
        <input id="since" className={ui.input} type="date" value={since} onChange={(e) => setSince(e.target.value)} />
      </Field>
      <Field label="Fecha de separación (opcional)" htmlFor="until" hint="Si se separaron, en el árbol se verán con línea discontinua">
        <input id="until" className={ui.input} type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
      </Field>
      <ErrorBanner message={error} />
      <div className={ui.formActions}>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={pending || !partnerId}>
          Guardar
        </Button>
      </div>
    </form>
  );
}
