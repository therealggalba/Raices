import { describe, expect, it } from 'vitest';
import type { PackOpening } from '../types/domain';
import { drawPack, packStatus, packStatusText } from '../utils/packs';

/** Cycles through fixed values in [0, 1). */
const sequence = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('drawPack', () => {
  const pool = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

  it('draws 5 different cromos when the album has enough', () => {
    const pack = drawPack(pool, sequence(0.99, 0, 0.5, 0.2, 0.7));
    expect(pack).toHaveLength(5);
    expect(new Set(pack).size).toBe(5);
    expect(pack[0]).toBe('g');
  });

  it('repeats cromos in small albums', () => {
    expect(drawPack(['a', 'b'], sequence(0, 0.6))).toEqual(['a', 'b', 'a', 'b', 'a']);
    expect(drawPack([], Math.random)).toEqual([]);
  });

  it('gives every cromo the same odds', () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 4000; i++) for (const c of drawPack(pool)) counts[c] = (counts[c] ?? 0) + 1;
    const expected = (4000 * 5) / pool.length;
    for (const c of pool) expect(Math.abs(counts[c] - expected) / expected).toBeLessThan(0.08);
  });
});

describe('packStatus', () => {
  const opening = (userId: string, date: string): PackOpening => ({
    id: `${userId}-${date}-${Math.random()}`,
    channelId: 'c',
    userId,
    date,
    openedAt: `${date}T10:00:00Z`,
    cardIds: [],
  });

  it('counts only today\'s packs of this user', () => {
    const openings = [opening('me', '2026-10-17'), opening('me', '2026-10-16'), opening('other', '2026-10-17')];
    expect(packStatus(openings, 'me', '2026-10-17')).toEqual({ perDay: 3, openedToday: 1, remaining: 2 });
  });

  it('never goes below zero and explains itself', () => {
    const many = Array.from({ length: 5 }, () => opening('me', '2026-10-17'));
    const status = packStatus(many, 'me', '2026-10-17');
    expect(status.remaining).toBe(0);
    expect(packStatusText(status)).toContain('Mañana');
    expect(packStatusText({ perDay: 3, openedToday: 2, remaining: 1 })).toBe('Te queda 1 sobre por abrir hoy');
    expect(packStatusText({ perDay: 3, openedToday: 0, remaining: 3 })).toBe('Te quedan 3 sobres por abrir hoy');
  });
});
