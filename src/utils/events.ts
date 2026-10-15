import type { FamilyEvent, IsoDate, Person, UpcomingEvent } from '../types/domain';
import { daysBetween, parsePartialDate, sameDayInYear } from './dates';
import { fullName } from './people';

/** Alerts are shown for anything happening within this many days. */
export const ALERT_WINDOW_DAYS = 7;

interface Occurrence {
  date: IsoDate;
  years?: number;
}

/**
 * Next occurrence of `date` on or after `today`. Recurring dates roll over to
 * the next year; one-off dates in the past have no next occurrence.
 */
export function nextOccurrence(date: IsoDate, recurring: boolean, today: IsoDate): Occurrence | null {
  const origin = parsePartialDate(date);
  const now = parsePartialDate(today);
  if (!origin?.day || !now?.day) return null;
  if (!recurring) return daysBetween(today, date) >= 0 ? { date } : null;
  let next = sameDayInYear(date, now.year);
  if (daysBetween(today, next) < 0) next = sameDayInYear(date, now.year + 1);
  const years = Number(next.slice(0, 4)) - origin.year;
  return { date: next, years: years > 0 ? years : undefined };
}

/**
 * Upcoming events: explicit events plus birthdays derived from people's birth
 * dates (unless an explicit birthday event already covers that person).
 */
export function upcomingEvents(
  events: readonly FamilyEvent[],
  people: readonly Person[],
  today: IsoDate,
  horizonDays = 366,
): UpcomingEvent[] {
  const result: UpcomingEvent[] = [];
  const coveredBirthdays = new Set(
    events.filter((e) => e.type === 'cumpleanos').flatMap((e) => e.personIds),
  );

  for (const event of events) {
    const next = nextOccurrence(event.date, event.recurring, today);
    if (!next) continue;
    result.push({
      key: `event:${event.id}`,
      eventId: event.id,
      type: event.type,
      title: event.title,
      date: next.date,
      daysUntil: daysBetween(today, next.date),
      years: next.years,
      personIds: event.personIds,
    });
  }

  for (const person of people) {
    if (!person.birthDate || coveredBirthdays.has(person.id)) continue;
    const next = nextOccurrence(person.birthDate, true, today);
    if (!next) continue;
    result.push({
      key: `birthday:${person.id}`,
      type: 'cumpleanos',
      title: `Cumpleaños de ${person.firstName}`,
      date: next.date,
      daysUntil: daysBetween(today, next.date),
      years: next.years,
      personIds: [person.id],
    });
  }

  return result
    .filter((e) => e.daysUntil <= horizonDays)
    .sort((a, b) => a.daysUntil - b.daysUntil || a.title.localeCompare(b.title, 'es'));
}

export function eventAlerts(upcoming: readonly UpcomingEvent[]): UpcomingEvent[] {
  return upcoming.filter((e) => e.daysUntil <= ALERT_WINDOW_DAYS);
}

/** Past one-off events (most recent first), e.g. last year's communion. */
export function pastEvents(events: readonly FamilyEvent[], today: IsoDate): FamilyEvent[] {
  return events
    .filter((e) => !e.recurring && daysBetween(today, e.date) < 0)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** "Carlos cumple 28" style subtitle for an occurrence, when it applies. */
export function occurrenceSubtitle(event: UpcomingEvent, people: readonly Person[]): string | null {
  if (!event.years) return null;
  if (event.type === 'cumpleanos') {
    const person = people.find((p) => p.id === event.personIds[0]);
    return person ? `${person.firstName} cumple ${event.years}` : `Cumple ${event.years}`;
  }
  if (event.type === 'aniversario') return `${event.years} años`;
  const names = event.personIds
    .map((id) => people.find((p) => p.id === id))
    .filter((p): p is Person => !!p)
    .map(fullName);
  return names.length ? `${event.years} años · ${names.join(', ')}` : `${event.years} años`;
}
