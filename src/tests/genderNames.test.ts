import { describe, expect, it } from 'vitest';
import { guessGender } from '../utils/genderNames';

describe('guessGender', () => {
  it('knows common Spanish names, with or without accents', () => {
    expect(guessGender('Gonzalo')).toBe('hombre');
    expect(guessGender('Lucía')).toBe('mujer');
    expect(guessGender('ÁLVARO')).toBe('hombre');
    expect(guessGender('Begoña')).toBe('mujer');
  });

  it('decides compound names by their first name', () => {
    expect(guessGender('María José')).toBe('mujer');
    expect(guessGender('José María')).toBe('hombre');
    expect(guessGender('Juan-Carlos')).toBe('hombre');
  });

  it('uses the usual endings for names it does not know, and gives up otherwise', () => {
    expect(guessGender('Aldonza')).toBe('mujer');
    expect(guessGender('Teodosio')).toBe('hombre');
    expect(guessGender('Noa')).toBe('mujer');
    expect(guessGender('Sasha')).toBe('mujer');
    expect(guessGender('Alex')).toBe('hombre');
    expect(guessGender('Chris')).toBeUndefined();
    expect(guessGender('')).toBeUndefined();
  });
});
