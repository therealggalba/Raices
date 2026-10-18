import { describe, expect, it } from 'vitest';
import { seasonOf } from '../utils/season';

describe('seasonOf', () => {
  it('follows the calendar (northern hemisphere)', () => {
    expect(seasonOf(new Date(2026, 9, 18))).toBe('otono');
    expect(seasonOf(new Date(2026, 11, 21))).toBe('invierno');
    expect(seasonOf(new Date(2027, 0, 15))).toBe('invierno');
    expect(seasonOf(new Date(2027, 2, 20))).toBe('primavera');
    expect(seasonOf(new Date(2027, 5, 21))).toBe('verano');
    expect(seasonOf(new Date(2027, 8, 22))).toBe('verano');
    expect(seasonOf(new Date(2027, 8, 23))).toBe('otono');
  });
});
