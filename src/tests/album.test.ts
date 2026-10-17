import { describe, expect, it } from 'vitest';
import type { AlbumCard } from '../types/domain';
import { NO_PERSON, albumSections, cardNeighbours, nextCardNumber, rarityCounts, sortCards } from '../utils/album';
import { validateCardInput } from '../utils/validation';
import { makePerson } from './fixtures';

const card = (overrides: Partial<AlbumCard>): AlbumCard => ({
  id: 'c',
  channelId: 'fam',
  number: 1,
  title: 'Cromo',
  description: '',
  imageUrl: 'https://img.test/c.jpg',
  takenAt: '2000',
  rarity: 'comun',
  createdAt: '2026-01-01T00:00:00Z',
  authorId: 'u1',
  ...overrides,
});

const people = [
  makePerson({ id: 'p-young', firstName: 'Natalia', birthDate: '2017-02-14' }),
  makePerson({ id: 'p-old', firstName: 'Antonio', birthDate: '1941-03-12' }),
];

const cards = [
  card({ id: 'a', number: 3, personId: 'p-old', takenAt: '1975' }),
  card({ id: 'b', number: 1, personId: 'p-old', takenAt: '1961' }),
  card({ id: 'c', number: 2, personId: 'p-young', takenAt: '2018-03', rarity: 'epico' }),
  card({ id: 'd', number: 7, takenAt: '2004-07', rarity: 'raro' }),
  card({ id: 'e', number: 5, personId: 'p-gone', takenAt: '1990', rarity: 'raro' }),
];

describe('albumSections', () => {
  it('has one section per person (oldest first) plus "Varios" for cards without a person', () => {
    const sections = albumSections(cards, people);
    expect(sections.map((s) => [s.id, s.cards.map((c) => c.id)])).toEqual([
      ['p-old', ['b', 'a']],
      ['p-young', ['c']],
      [NO_PERSON, ['e', 'd']],
    ]);
  });

  it('lists people without cromos yet, and no "Varios" when not needed', () => {
    const sections = albumSections([cards[0]], [...people, makePerson({ id: 'p-new', firstName: 'Hugo' })]);
    expect(sections.map((s) => [s.id, s.cards.length])).toEqual([
      ['p-old', 1],
      ['p-young', 0],
      ['p-new', 0],
    ]);
  });
});

describe('album helpers', () => {
  it('assigns the next number after the highest ever used', () => {
    expect(nextCardNumber([])).toBe(1);
    expect(nextCardNumber(cards)).toBe(8);
    expect(nextCardNumber(cards, 12)).toBe(13);
  });

  it('sorts by photo date, then number', () => {
    expect(sortCards([card({ id: 'x', number: 2, takenAt: '2000' }), card({ id: 'y', number: 1, takenAt: '2000' })]).map((c) => c.id)).toEqual(['y', 'x']);
  });

  it('finds the previous and next cromo of the same person', () => {
    const [old] = albumSections(cards, people);
    expect(cardNeighbours(old, 'b')).toEqual({ prev: undefined, next: old.cards[1] });
    expect(cardNeighbours(old, 'zzz')).toEqual({});
  });

  it('counts cromos by rarity', () => {
    expect(rarityCounts(cards)).toEqual({ comun: 2, 'poco-comun': 0, raro: 2, epico: 1, legendario: 0 });
  });
});

describe('validateCardInput', () => {
  const base = { title: 'Tocando la batería', description: '', imageUrl: 'https://img.test/a.jpg', takenAt: '2011-12', rarity: 'comun' };

  it('accepts a valid cromo, with or without a person', () => {
    expect(validateCardInput(base).ok).toBe(true);
    expect(validateCardInput({ ...base, personId: 'p-carlos' })).toMatchObject({ ok: true, value: { personId: 'p-carlos' } });
  });

  it('rejects bad images, dates, rarities and person ids', () => {
    expect(validateCardInput({ ...base, imageUrl: 'http://img.test/a.jpg' }).ok).toBe(false);
    expect(validateCardInput({ ...base, imageUrl: '' }).ok).toBe(false);
    expect(validateCardInput({ ...base, takenAt: '2011-13' }).ok).toBe(false);
    expect(validateCardInput({ ...base, rarity: 'mitico' }).ok).toBe(false);
    expect(validateCardInput({ ...base, personId: '../x' }).ok).toBe(false);
    expect(validateCardInput({ ...base, title: '  ' }).ok).toBe(false);
  });
});
