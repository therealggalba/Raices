import type { IsoDate, Person } from '../types/domain';
import { parsePartialDate } from './dates';

export function fullName(person: Pick<Person, 'firstName' | 'lastName'>): string {
  return [person.firstName, person.lastName].filter(Boolean).join(' ');
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

/** Age in whole years on `today`; null without a birth date. */
export function ageOn(birthDate: IsoDate | undefined, today: IsoDate): number | null {
  if (!birthDate) return null;
  const b = parsePartialDate(birthDate);
  const t = parsePartialDate(today);
  if (!b?.month || !b.day || !t?.month || !t.day) return null;
  const hadBirthday = t.month > b.month || (t.month === b.month && t.day >= b.day);
  return t.year - b.year - (hadBirthday ? 0 : 1);
}

/** Oldest first; people without a birth date go last, alphabetically. */
export function sortPeople(people: readonly Person[]): Person[] {
  return [...people].sort((a, b) => {
    if (a.birthDate && b.birthDate) return a.birthDate.localeCompare(b.birthDate);
    if (a.birthDate) return -1;
    if (b.birthDate) return 1;
    return fullName(a).localeCompare(fullName(b), 'es');
  });
}
