import { DAY_ONLY_EVENT_TYPES } from '../types/domain';
import type { DateFilters, DateOccurrence, EventType, FamilyEvent, IsoDate, Person } from '../types/domain';
import { daysBetween, parsePartialDate, sameDayInYear } from './dates';
import { fullName } from './people';
import { isEventType, isId } from './validation';
import { foldText } from './text';

// Important dates. Every date repeats yearly on the same day; its anniversary
// number comes from the origin date. Birthdays are also derived from people's
// birth dates (unless an explicit birthday already covers that person), and
// people who passed away are remembered on the day they died instead.

/** Home strip highlight / "pronto" window. */
export const ALERT_WINDOW_DAYS = 7;

interface DateSource {
  key: string;
  channelId: string;
  type: EventType;
  title: string;
  originDate: IsoDate;
  personIds: string[];
  eventId?: string;
}

function sources(events: readonly FamilyEvent[], people: readonly Person[]): DateSource[] {
  const covered = new Set(events.filter((e) => e.type === 'cumpleanos').flatMap((e) => e.personIds));
  const list: DateSource[] = events.map((e) => ({
    key: `event:${e.id}`,
    channelId: e.channelId,
    type: e.type,
    title: e.title,
    originDate: e.date,
    personIds: e.personIds,
    eventId: e.id,
  }));
  const remembered = new Set(events.filter((e) => e.type === 'fallecimiento').flatMap((e) => e.personIds));
  for (const person of people) {
    // Someone who passed away is remembered on the day they died, not on their birthday.
    if (person.deathDate) {
      if (remembered.has(person.id)) continue;
      list.push({
        key: `death:${person.id}`,
        channelId: person.channelId,
        type: 'fallecimiento',
        title: `En memoria de ${person.firstName}`,
        originDate: person.deathDate,
        personIds: [person.id],
      });
      continue;
    }
    if (!person.birthDate || covered.has(person.id)) continue;
    list.push({
      key: `birthday:${person.id}`,
      channelId: person.channelId,
      type: 'cumpleanos',
      title: `Cumpleaños de ${person.firstName}`,
      originDate: person.birthDate,
      personIds: [person.id],
    });
  }
  return list;
}

/** The occurrence of a date in `year`; null before the year it first happened. */
export function occurrenceIn(originDate: IsoDate, year: number): { date: IsoDate; years: number } | null {
  const origin = parsePartialDate(originDate);
  if (!origin?.day || year < origin.year) return null;
  return { date: sameDayInYear(originDate, year), years: year - origin.year };
}

function toOccurrence(source: DateSource, year: number, today: IsoDate): DateOccurrence | null {
  const occ = occurrenceIn(source.originDate, year);
  if (!occ) return null;
  // Saints' days and the like don't count years.
  const years = DAY_ONLY_EVENT_TYPES.includes(source.type) ? 0 : occ.years;
  return { ...source, date: occ.date, years, daysUntil: daysBetween(today, occ.date) };
}

function byDate(a: DateOccurrence, b: DateOccurrence): number {
  return a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'es');
}

/** Every date of `year` (past and future), in calendar order. */
export function occurrencesInYear(
  events: readonly FamilyEvent[],
  people: readonly Person[],
  year: number,
  today: IsoDate,
): DateOccurrence[] {
  return sources(events, people)
    .map((s) => toOccurrence(s, year, today))
    .filter((o): o is DateOccurrence => o !== null)
    .sort(byDate);
}

/** Next occurrence of each date (today included), soonest first. */
export function upcomingEvents(
  events: readonly FamilyEvent[],
  people: readonly Person[],
  today: IsoDate,
  horizonDays = 366,
): DateOccurrence[] {
  const year = parsePartialDate(today)?.year;
  if (!year) return [];
  const result: DateOccurrence[] = [];
  for (const source of sources(events, people)) {
    const origin = parsePartialDate(source.originDate);
    if (!origin?.day) continue;
    // A date first happening in a future year shows up on that day.
    let occ = toOccurrence(source, Math.max(year, origin.year), today);
    if (occ && occ.daysUntil < 0) occ = toOccurrence(source, year + 1, today);
    if (occ && occ.daysUntil <= horizonDays) result.push(occ);
  }
  return result.sort((a, b) => a.daysUntil - b.daysUntil || a.title.localeCompare(b.title, 'es'));
}

export function todaysEvents(events: readonly FamilyEvent[], people: readonly Person[], today: IsoDate): DateOccurrence[] {
  return upcomingEvents(events, people, today, 0);
}

/** "Cumple 31", "31.º aniversario", "Hace 12 años" (deaths), or null the year it first happens. */
export function anniversaryLabel(occurrence: Pick<DateOccurrence, 'type' | 'years'>): string | null {
  if (occurrence.years <= 0) return null;
  if (occurrence.type === 'cumpleanos') return `Cumple ${occurrence.years}`;
  if (occurrence.type === 'fallecimiento') return `Hace ${occurrence.years} ${occurrence.years === 1 ? 'año' : 'años'}`;
  return `${occurrence.years}.º aniversario`;
}


export const DEFAULT_DATE_FILTERS: DateFilters = { channelIds: [], months: [], types: [], query: '' };

export function filterDates(
  occurrences: readonly DateOccurrence[],
  filters: DateFilters,
  people: readonly Person[],
): DateOccurrence[] {
  const names = new Map(people.map((p) => [p.id, fullName(p)]));
  const channels = new Set(filters.channelIds);
  const months = new Set(filters.months);
  const types = new Set(filters.types);
  const terms = foldText(filters.query).split(/\s+/).filter(Boolean);
  return occurrences.filter((o) => {
    if (channels.size && !channels.has(o.channelId)) return false;
    if (months.size && !months.has(Number(o.date.slice(5, 7)))) return false;
    if (types.size && !types.has(o.type)) return false;
    if (terms.length) {
      const haystack = foldText([o.title, ...o.personIds.map((id) => names.get(id) ?? '')].join(' '));
      if (!terms.every((t) => haystack.includes(t))) return false;
    }
    return true;
  });
}

/** URL -> filters (?canal=&mes=&tipo=&q=); anything malformed is ignored. */
export function parseDateParams(params: URLSearchParams): DateFilters {
  const months = params
    .getAll('mes')
    .map(Number)
    .filter((m) => Number.isInteger(m) && m >= 1 && m <= 12);
  return {
    channelIds: [...new Set(params.getAll('canal').filter(isId))],
    months: [...new Set(months)].sort((a, b) => a - b),
    types: [...new Set(params.getAll('tipo').filter(isEventType))],
    query: (params.get('q') ?? '').slice(0, 80),
  };
}

export function dateParams(filters: DateFilters, year?: number): URLSearchParams {
  const params = new URLSearchParams();
  if (year !== undefined) params.set('anio', String(year));
  for (const id of filters.channelIds) params.append('canal', id);
  for (const m of filters.months) params.append('mes', String(m));
  for (const t of filters.types) params.append('tipo', t);
  if (filters.query.trim()) params.set('q', filters.query.trim().slice(0, 80));
  return params;
}

export function parseYearParam(params: URLSearchParams, fallback: number): number {
  const year = Number(params.get('anio'));
  return Number.isInteger(year) && year >= 1900 && year <= 2200 ? year : fallback;
}
