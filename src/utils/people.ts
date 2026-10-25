import type { FieldChange, IsoDate, Partnership, Person, SelfPersonInput } from '../types/domain';
import { capitalize, kinship } from './kinship';
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

/** Age reached: today's age, or the age at death (with `deceased`). */
export function lifeAge(person: Pick<Person, 'birthDate' | 'deathDate'>, today: IsoDate): { years: number; deceased: boolean } | null {
  const years = ageOn(person.birthDate, person.deathDate ?? today);
  return years === null ? null : { years, deceased: !!person.deathDate };
}

/** What a person is to the viewer («Tío», «Yo»…), from the family tree; '' when unrelated or unknown. */
export function relationTo(
  person: Person,
  viewerPersonId: string | undefined,
  people: readonly Person[],
  partnerships: readonly Partnership[],
): string {
  const derived = viewerPersonId ? kinship(viewerPersonId, person.id, people, partnerships) : null;
  return derived ? capitalize(derived) : '';
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

const SELF_FIELDS = ['firstName', 'lastName', 'birthDate', 'gender', 'photoUrl', 'biography'] as const;

/** What a member changed on their own card (for the owner's inbox). */
export function selfChanges(before: Person, after: SelfPersonInput): FieldChange[] {
  return SELF_FIELDS.flatMap((field) => {
    // The photo counts as one field, linked or uploaded.
    const old = (field === 'photoUrl' ? (before.photoPath ?? before.photoUrl) : before[field]) ?? '';
    const now = (field === 'photoUrl' ? (after.photoPath ?? after.photoUrl) : after[field]) ?? '';
    return old === now ? [] : [{ field, before: old, after: now }];
  });
}

export const isPet = (p: Pick<Person, 'kind'>): boolean => p.kind === 'mascota';
/** People only (the family tree, kinship, members and invitations ignore pets). */
export const humansOnly = <T extends Pick<Person, 'kind'>>(list: readonly T[]): T[] => list.filter((p) => !isPet(p));
