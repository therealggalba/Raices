import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EventItem } from '../components/EventItem';
import { PeoplePicker } from '../components/PeoplePicker';
import { Button, EmptyState, ErrorBanner, Field, LinkButton } from '../components/ui';
import { ui } from '../components/ui-styles';
import { useChannel } from '../hooks/channel-context';
import { useAction } from '../hooks/useAction';
import { confirmAction } from '../hooks/useConfirm';
import { repository } from '../services';
import { EVENT_TYPES } from '../types/domain';
import type { EventInput, EventType, FamilyEvent } from '../types/domain';
import { addDays, parsePartialDate } from '../utils/dates';
import { occurrenceIn, upcomingEvents } from '../utils/events';
import { EVENT_ICONS, EVENT_LABELS } from '../utils/labels';

/**
 * A channel's important dates: where they are added and edited. The yearly
 * list of every channel together lives in the global «Fechas» page.
 * ?nueva=1 opens the form; ?editar=<id> opens it on an existing date.
 */
export function EventsPage() {
  const { snapshot, today, isAdmin, reload } = useChannel();
  const { run, pending, error } = useAction();
  const [params, setParams] = useSearchParams();
  const { channel, events, people } = snapshot;
  const upcoming = upcomingEvents(events, people, today);

  const editId = params.get('editar');
  const editing: FamilyEvent | 'new' | null = !isAdmin
    ? null
    : params.get('nueva') === '1'
      ? 'new'
      : (events.find((e) => e.id === editId) ?? null);
  const openForm = (value: FamilyEvent | 'new' | null) =>
    setParams(value === null ? {} : value === 'new' ? { nueva: '1' } : { editar: value.id }, { replace: true });

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1>Fechas importantes</h1>
        <div className={ui.chips}>
          <LinkButton to={`/fechas?canal=${channel.id}`} small>
            Ver el año completo
          </LinkButton>
          {isAdmin && !editing && (
            <Button variant="primary" small onClick={() => openForm('new')}>
              + Añadir fecha
            </Button>
          )}
        </div>
      </div>
      <p className={ui.muted}>
        Cada fecha vuelve cada año y muestra su número de aniversario. Los cumpleaños de las personas del canal se añaden
        solos a partir de su fecha de nacimiento.
      </p>

      {editing && (
        <EventForm
          key={editing === 'new' ? 'new' : editing.id}
          initial={editing === 'new' ? undefined : editing}
          onCancel={() => openForm(null)}
          onSaved={async () => {
            openForm(null);
            await reload();
          }}
        />
      )}
      <ErrorBanner message={error} />

      {upcoming.length === 0 ? (
        <EmptyState icon="📅">
          <p>Este canal todavía no tiene fechas.</p>
        </EmptyState>
      ) : (
        <section className={ui.section}>
          <h2>Próximas</h2>
          {upcoming.map((event) => {
            const stored = event.eventId ? events.find((e) => e.id === event.eventId) : undefined;
            return (
              <EventItem
                key={event.key}
                event={event}
                people={people}
                actions={
                  isAdmin && stored ? (
                    <>
                      <Button variant="ghost" small onClick={() => openForm(stored)}>
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        small
                        disabled={pending}
                        onClick={async () => {
                          if (!confirmAction(`¿Eliminar «${stored.title}»?`)) return;
                          await run(async () => {
                            await repository.deleteEvent(channel.id, stored.id);
                            await reload();
                          });
                        }}
                      >
                        Eliminar
                      </Button>
                    </>
                  ) : undefined
                }
              />
            );
          })}
        </section>
      )}
    </div>
  );
}

function EventForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial?: FamilyEvent;
  onCancel(): void;
  onSaved(): Promise<void>;
}) {
  const { snapshot, today } = useChannel();
  const { run, pending, error } = useAction();
  const [type, setType] = useState<EventType>(initial?.type ?? 'cumpleanos');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [date, setDate] = useState(initial?.date ?? '');
  const [personIds, setPersonIds] = useState<string[]>(initial?.personIds ?? []);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const channelId = snapshot.channel.id;

  // Live preview of what the date will show this year / next time.
  const thisYear = parsePartialDate(today)?.year ?? 0;
  const preview = parsePartialDate(date)?.day ? occurrenceIn(date, Math.max(thisYear, Number(date.slice(0, 4)))) : null;

  return (
    <form
      className={[ui.form, ui.card].join(' ')}
      onSubmit={async (e) => {
        e.preventDefault();
        const input: EventInput = { type, title, date, personIds, notes };
        const done = await run(async () => {
          if (initial) await repository.updateEvent(channelId, initial.id, input);
          else await repository.addEvent(channelId, input);
          return true;
        });
        if (done) await onSaved();
      }}
    >
      <h2>{initial ? 'Editar fecha' : 'Nueva fecha'}</h2>
      <Field label="Tipo de evento" htmlFor="type">
        <select id="type" className={ui.input} value={type} onChange={(e) => setType(e.target.value as EventType)}>
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {EVENT_ICONS[t]} {EVENT_LABELS[t]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Descripción" htmlFor="title">
        <input
          id="title"
          className={ui.input}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ej.: Cumpleaños de Gonzalo"
          maxLength={120}
          required
        />
      </Field>
      <Field
        label="Fecha de origen"
        htmlFor="date"
        hint={
          preview
            ? preview.years > 0
              ? `Este año: ${preview.years}.º ${type === 'cumpleanos' ? 'cumpleaños' : 'aniversario'}`
              : 'Aún no ha ocurrido: aparecerá ese día'
            : 'El día en que ocurrió por primera vez (año incluido)'
        }
      >
        <input
          id="date"
          className={ui.input}
          type="date"
          value={date}
          max={addDays(today, 3650)}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </Field>
      <Field label="Personas (opcional)" htmlFor="people">
        <PeoplePicker people={snapshot.people} value={personIds} onChange={setPersonIds} />
      </Field>
      <Field label="Notas (opcional)" htmlFor="notes">
        <textarea id="notes" className={ui.input} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
      </Field>
      <ErrorBanner message={error} />
      <div className={ui.formActions}>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          Guardar
        </Button>
      </div>
    </form>
  );
}
