import { useState } from 'react';
import { EventItem } from '../components/EventItem';
import { PeoplePicker } from '../components/PeoplePicker';
import { Button, EmptyState, ErrorBanner, Field } from '../components/ui';
import { ui } from '../components/ui-styles';
import { useChannel } from '../hooks/channel-context';
import { useAction } from '../hooks/useAction';
import { confirmAction } from '../hooks/useConfirm';
import { repository } from '../services';
import { EVENT_TYPES } from '../types/domain';
import type { EventInput, EventType, FamilyEvent } from '../types/domain';
import { formatPartialDate } from '../utils/dates';
import { ALERT_WINDOW_DAYS, pastEvents, upcomingEvents } from '../utils/events';
import { EVENT_ICONS, EVENT_LABELS } from '../utils/labels';
import styles from './EventsPage.module.scss';

const RECURRING_BY_DEFAULT: ReadonlySet<EventType> = new Set(['cumpleanos', 'aniversario']);

export function EventsPage() {
  const { snapshot, today, isAdmin, reload } = useChannel();
  const { run, pending, error } = useAction();
  const [editing, setEditing] = useState<FamilyEvent | 'new' | null>(null);
  const { channel, events, people } = snapshot;
  const upcoming = upcomingEvents(events, people, today);
  const past = pastEvents(events, today);

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1>Eventos importantes</h1>
        {isAdmin && !editing && (
          <Button variant="primary" small onClick={() => setEditing('new')}>
            + Nuevo evento
          </Button>
        )}
      </div>
      <p className={ui.muted}>
        Cumpleaños, aniversarios y celebraciones del próximo año. Los cumpleaños se calculan solos a partir de la fecha
        de nacimiento de cada persona.
      </p>

      {editing && (
        <EventForm
          key={editing === 'new' ? 'new' : editing.id}
          initial={editing === 'new' ? undefined : editing}
          onCancel={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await reload();
          }}
        />
      )}
      <ErrorBanner message={error} />

      {upcoming.length === 0 ? (
        <EmptyState icon="📅">
          <p>No hay eventos próximos.</p>
        </EmptyState>
      ) : (
        <section className={ui.section}>
          <h2>Próximamente</h2>
          <div className={styles.list}>
            {upcoming.map((event) => {
              const stored = event.eventId ? events.find((e) => e.id === event.eventId) : undefined;
              return (
                <div key={event.key} className={styles.row}>
                  <EventItem
                    event={event}
                    people={people}
                    channelId={channel.id}
                    highlight={event.daysUntil <= ALERT_WINDOW_DAYS}
                  />
                  {isAdmin && stored && (
                    <div className={styles.rowActions}>
                      <Button variant="ghost" small onClick={() => setEditing(stored)}>
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
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section className={ui.section}>
          <h2>Ya celebrados</h2>
          <ul className={styles.past}>
            {past.map((event) => (
              <li key={event.id}>
                <span aria-hidden>{EVENT_ICONS[event.type]}</span> {event.title}
                <span className={ui.muted}> · {formatPartialDate(event.date)}</span>
              </li>
            ))}
          </ul>
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
  const { snapshot } = useChannel();
  const { run, pending, error } = useAction();
  const [type, setType] = useState<EventType>(initial?.type ?? 'cumpleanos');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [date, setDate] = useState(initial?.date ?? '');
  const [recurring, setRecurring] = useState(initial?.recurring ?? true);
  const [personIds, setPersonIds] = useState<string[]>(initial?.personIds ?? []);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const channelId = snapshot.channel.id;

  return (
    <form
      className={[ui.form, ui.card].join(' ')}
      onSubmit={async (e) => {
        e.preventDefault();
        const input: EventInput = { type, title, date, recurring, personIds, notes };
        const done = await run(async () => {
          if (initial) await repository.updateEvent(channelId, initial.id, input);
          else await repository.addEvent(channelId, input);
          return true;
        });
        if (done) await onSaved();
      }}
    >
      <h2>{initial ? 'Editar evento' : 'Nuevo evento'}</h2>
      <Field label="Tipo" htmlFor="type">
        <select
          id="type"
          className={ui.input}
          value={type}
          onChange={(e) => {
            const next = e.target.value as EventType;
            setType(next);
            if (!initial) setRecurring(RECURRING_BY_DEFAULT.has(next));
          }}
        >
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {EVENT_ICONS[t]} {EVENT_LABELS[t]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Título" htmlFor="title">
        <input
          id="title"
          className={ui.input}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ej.: Comunión de Natalia"
          maxLength={120}
          required
        />
      </Field>
      <Field label="Fecha" htmlFor="date" hint="Para aniversarios, la fecha original (año incluido)">
        <input id="date" className={ui.input} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </Field>
      <label className={styles.check}>
        <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
        Se repite cada año
      </label>
      <Field label="Personas" htmlFor="people">
        <PeoplePicker people={snapshot.people} value={personIds} onChange={setPersonIds} />
      </Field>
      <Field label="Notas" htmlFor="notes">
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
