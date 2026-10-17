import { RARITIES } from '../types/domain';
import type { AlbumCard, Person, Rarity } from '../types/domain';
import { partialDateSortKey } from './dates';
import { sortPeople } from './people';

// The channel's cromo album, organised by person (each person is a
// category). Cards without a person (deleted person) go to "Varios".

export const NO_PERSON = 'varios';

export interface AlbumSection {
  /** Person id, or NO_PERSON. */
  id: string;
  person: Person | null;
  cards: AlbumCard[];
}

/** Oldest photo first; same date: album number. */
export function sortCards(cards: readonly AlbumCard[]): AlbumCard[] {
  return [...cards].sort(
    (a, b) => partialDateSortKey(a.takenAt).localeCompare(partialDateSortKey(b.takenAt)) || a.number - b.number,
  );
}

/**
 * One section per person of the channel (oldest person first), including
 * people without cards yet, then "Varios" if any card has no person.
 */
export function albumSections(cards: readonly AlbumCard[], people: readonly Person[]): AlbumSection[] {
  const known = new Set(people.map((p) => p.id));
  const sections: AlbumSection[] = sortPeople(people).map((person) => ({
    id: person.id,
    person,
    cards: sortCards(cards.filter((c) => c.personId === person.id)),
  }));
  const orphans = cards.filter((c) => !c.personId || !known.has(c.personId));
  if (orphans.length) sections.push({ id: NO_PERSON, person: null, cards: sortCards(orphans) });
  return sections;
}

/**
 * Next album number: one more than the highest ever used, so numbers of
 * deleted cromos are never reused. `lastIssued` is the channel's counter.
 */
export function nextCardNumber(cards: readonly AlbumCard[], lastIssued = 0): number {
  return cards.reduce((max, c) => Math.max(max, c.number), lastIssued) + 1;
}

/** Previous/next card inside the same section (for swiping through a person's cromos). */
export function cardNeighbours(section: AlbumSection, cardId: string): { prev?: AlbumCard; next?: AlbumCard } {
  const i = section.cards.findIndex((c) => c.id === cardId);
  if (i < 0) return {};
  return { prev: section.cards[i - 1], next: section.cards[i + 1] };
}

export function rarityCounts(cards: readonly AlbumCard[]): Record<Rarity, number> {
  const counts = Object.fromEntries(RARITIES.map((r) => [r, 0])) as Record<Rarity, number>;
  for (const card of cards) counts[card.rarity] += 1;
  return counts;
}
