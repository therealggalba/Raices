import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EventItem } from '../components/EventItem';
import { Button, EmptyState } from '../components/ui';
import { ui } from '../components/ui-styles';
import { useLibrary } from '../hooks/library-context';
import { EVENT_TYPES } from '../types/domain';
import type { DateFilters, DateOccurrence } from '../types/domain';
import { monthName, monthShort, parsePartialDate } from '../utils/dates';
import { dateParams, filterDates, occurrencesInYear, parseDateParams, parseYearParam } from '../utils/events';
import { EVENT_LABELS } from '../utils/labels';
import styles from './DatesPage.module.scss';

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

/** Every important date of every channel, through the year, with filters. */
export function DatesPage() {
  const { library, today, channelById } = useLibrary();
  const [params, setParams] = useSearchParams();
  const currentYear = parsePartialDate(today)?.year ?? Number(today.slice(0, 4));
  const year = parseYearParam(params, currentYear);
  const filters = parseDateParams(params);
  const all = occurrencesInYear(library.events, library.people, year, today);
  const shown = filterDates(all, filters, library.people);
  const multiChannel = library.channels.length > 1;
  const adminChannels = library.channels.filter((c) => c.role === 'admin');
  const active = filters.channelIds.length + filters.months.length + filters.types.length + (filters.query ? 1 : 0);

  // Same approach as the catalog: chained updates build on the latest URL.
  const latest = useRef(params);
  useEffect(() => {
    latest.current = params;
  }, [params]);
  type Patch = Partial<DateFilters> | ((current: DateFilters) => Partial<DateFilters>);
  const update = (patch: Patch, nextYear = year) => {
    const current = parseDateParams(latest.current);
    const changes = typeof patch === 'function' ? patch(current) : patch;
    const next = dateParams({ ...current, ...changes }, nextYear === currentYear ? undefined : nextYear);
    latest.current = next;
    setParams(next, { replace: true });
  };

  // Open on the current month (this year, unfiltered).
  const scrolled = useRef(false);
  useEffect(() => {
    if (scrolled.current || year !== currentYear || filters.months.length) return;
    scrolled.current = true;
    document.getElementById(`mes-${today.slice(5, 7)}`)?.scrollIntoView({ block: 'start' });
  }, [year, currentYear, filters.months.length, today]);

  const byMonth = new Map<number, DateOccurrence[]>();
  for (const o of shown) {
    const m = Number(o.date.slice(5, 7));
    byMonth.set(m, [...(byMonth.get(m) ?? []), o]);
  }

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div className={styles.titleRow}>
          <h1>Fechas</h1>
          <div className={styles.year}>
            <button type="button" onClick={() => update({}, year - 1)} aria-label="Año anterior">
              ‹
            </button>
            <span aria-live="polite">{year}</span>
            <button type="button" onClick={() => update({}, year + 1)} aria-label="Año siguiente">
              ›
            </button>
          </div>
          {adminChannels.length > 0 && (
            <details className={styles.add}>
              <summary className={styles.addButton}>+ Añadir fecha</summary>
              <div className={styles.addMenu}>
                <span className={styles.addHint}>¿En qué canal?</span>
                {adminChannels.map((c) => (
                  <Link key={c.id} to={`/c/${c.id}/eventos?nueva=1`}>
                    {c.name}
                  </Link>
                ))}
              </div>
            </details>
          )}
        </div>

        <input
          type="search"
          className={[ui.input, styles.search].join(' ')}
          value={filters.query}
          onChange={(e) => update({ query: e.target.value })}
          placeholder="Buscar por descripción o persona…"
          aria-label="Buscar fechas"
          maxLength={80}
        />

        <div className={styles.filters}>
          {multiChannel && (
            <div className={ui.chips} role="group" aria-label="Canales">
              {library.channels.map((c) => {
                const on = filters.channelIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={on}
                    className={[ui.chip, on ? ui.chipActive : ''].join(' ')}
                    onClick={() => update((f) => ({ channelIds: toggle(f.channelIds, c.id) }))}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          )}
          <div className={ui.chips} role="group" aria-label="Tipo de evento">
            {EVENT_TYPES.map((t) => {
              const on = filters.types.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={on}
                  className={[ui.chip, on ? ui.chipActive : ''].join(' ')}
                  onClick={() => update((f) => ({ types: toggle(f.types, t) }))}
                >
                  {EVENT_LABELS[t]}
                </button>
              );
            })}
          </div>
          <div className={styles.months} role="group" aria-label="Meses">
            {MONTHS.map((m) => {
              const on = filters.months.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={on}
                  aria-label={monthName(m)}
                  className={[styles.month, on ? styles.monthOn : ''].join(' ')}
                  onClick={() => update((f) => ({ months: toggle(f.months, m).sort((a, b) => a - b) }))}
                >
                  {monthShort(m)}
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.summary}>
          <span className={ui.muted} role="status">
            {shown.length === all.length ? `${all.length} fechas en ${year}` : `${shown.length} de ${all.length} fechas en ${year}`}
          </span>
          {active > 0 && (
            <Button variant="ghost" small onClick={() => update({ channelIds: [], months: [], types: [], query: '' })}>
              Quitar filtros
            </Button>
          )}
        </div>
      </header>

      {shown.length === 0 ? (
        <EmptyState>
          <p>{all.length ? 'Ninguna fecha coincide con los filtros.' : 'Todavía no hay fechas en tus canales.'}</p>
        </EmptyState>
      ) : (
        <ol className={styles.calendar}>
          {[...byMonth.entries()].map(([m, list]) => (
            <li key={m} id={`mes-${String(m).padStart(2, '0')}`} className={styles.monthGroup}>
              <h2 className={styles.monthTitle}>
                {monthName(m)} <span>{list.length}</span>
              </h2>
              <div className={styles.entries}>
                {list.map((o) => {
                  const channel = channelById(o.channelId);
                  return (
                    <EventItem
                      key={o.key}
                      event={o}
                      people={library.people}
                      channelName={
                        multiChannel
                          ? o.channelIds
                              .map((id) => channelById(id)?.name)
                              .filter(Boolean)
                              .join(', ')
                          : undefined
                      }
                      actions={
                        o.eventId && channel?.role === 'admin' ? (
                          <Link className={styles.edit} to={`/c/${o.channelId}/eventos?editar=${o.eventId}`}>
                            Editar
                          </Link>
                        ) : undefined
                      }
                    />
                  );
                })}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
