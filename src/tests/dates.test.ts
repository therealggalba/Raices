import { describe, expect, it } from 'vitest';
import {
  addDays,
  daysBetween,
  formatDaysUntil,
  formatDaysUntilShort,
  formatDayMonthShort,
  formatDuration,
  formatPartialDate,
  isIsoDate,
  isPartialDate,
  partialDateSortKey,
  sameDayInYear,
} from '../utils/dates';

describe('partial dates', () => {
  it('accepts year, year-month and full dates', () => {
    expect(isPartialDate('1998')).toBe(true);
    expect(isPartialDate('1998-07')).toBe(true);
    expect(isPartialDate('1998-07-14')).toBe(true);
  });

  it('rejects impossible or malformed dates', () => {
    for (const bad of ['98', '1998-13', '1998-02-30', '2023-02-29', '1998/07/14', '', '1700']) {
      expect(isPartialDate(bad)).toBe(false);
    }
    expect(isPartialDate('2024-02-29')).toBe(true);
  });

  it('only treats full dates as ISO dates', () => {
    expect(isIsoDate('1998-07-14')).toBe(true);
    expect(isIsoDate('1998-07')).toBe(false);
    expect(isIsoDate(19980714)).toBe(false);
  });

  it('formats with the precision available', () => {
    expect(formatPartialDate('1998')).toBe('1998');
    expect(formatPartialDate('1998-07')).toBe('jul 1998');
    expect(formatPartialDate('1998-07-04')).toBe('4 jul 1998');
  });

  it('sorts less precise dates first within the same period', () => {
    const sorted = ['1999-01-01', '1999', '1998-12', '1999-01'].sort((a, b) =>
      partialDateSortKey(a).localeCompare(partialDateSortKey(b)),
    );
    expect(sorted).toEqual(['1998-12', '1999', '1999-01', '1999-01-01']);
  });
});

describe('calendar arithmetic', () => {
  it('counts days across months and years', () => {
    expect(daysBetween('2025-12-30', '2026-01-02')).toBe(3);
    expect(daysBetween('2026-01-02', '2025-12-30')).toBe(-3);
    expect(addDays('2026-02-27', 2)).toBe('2026-03-01');
  });

  it('maps February 29th to the 28th in non-leap years', () => {
    expect(sameDayInYear('2000-02-29', 2026)).toBe('2026-02-28');
    expect(sameDayInYear('2000-02-29', 2028)).toBe('2028-02-29');
  });

  it('formats countdowns and durations', () => {
    expect(formatDaysUntil(-1)).toBe('ayer');
    expect(formatDaysUntil(-20)).toBe('hace 20 días');
    expect(formatDaysUntil(0)).toBe('hoy');
    expect(formatDaysUntil(1)).toBe('mañana');
    expect(formatDaysUntil(3)).toBe('en 3 días');
    expect(formatDaysUntil(7)).toBe('dentro de una semana');
    expect(formatDayMonthShort('2026-10-17')).toBe('17 oct');
    expect(formatDaysUntilShort(7)).toBe('en 7 días');
    expect(formatDaysUntilShort(1)).toBe('mañana');
    expect(formatDuration(45)).toBe('45 s');
    expect(formatDuration(312)).toBe('5 min 12 s');
    expect(formatDuration(3720)).toBe('1 h 2 min');
  });
});
