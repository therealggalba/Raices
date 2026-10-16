import type { IsoDate, PartialDate } from '../types/domain';

// Calendar helpers. Calendar dates ("YYYY-MM-DD") are handled as plain
// year/month/day numbers in UTC so time zones and DST never shift a birthday.

const PARTIAL_RE = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTHS_LONG = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
const DAY_MS = 86_400_000;

export interface DateParts {
  year: number;
  month?: number;
  day?: number;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Parses "YYYY", "YYYY-MM" or "YYYY-MM-DD"; null when malformed or impossible. */
export function parsePartialDate(value: string): DateParts | null {
  const match = PARTIAL_RE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  if (year < 1800 || year > 2200) return null;
  if (match[2] === undefined) return { year };
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  if (match[3] === undefined) return { year, month };
  const day = Number(match[3]);
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function isPartialDate(value: unknown): value is PartialDate {
  return typeof value === 'string' && parsePartialDate(value) !== null;
}

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string') return false;
  const parts = parsePartialDate(value);
  return parts?.day !== undefined;
}

/** Local calendar date of `now` as "YYYY-MM-DD". */
export function toIsoDate(now: Date): IsoDate {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toUtc(parts: { year: number; month: number; day: number }): number {
  return Date.UTC(parts.year, parts.month - 1, parts.day);
}

/** Whole days from `from` to `to` (both "YYYY-MM-DD"). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  const a = parsePartialDate(from);
  const b = parsePartialDate(to);
  if (!a?.day || !b?.day) throw new Error('daysBetween expects full dates');
  return Math.round((toUtc(b as Required<DateParts>) - toUtc(a as Required<DateParts>)) / DAY_MS);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const p = parsePartialDate(date);
  if (!p?.day) throw new Error('addDays expects a full date');
  const d = new Date(toUtc(p as Required<DateParts>) + days * DAY_MS);
  return d.toISOString().slice(0, 10);
}

/**
 * The same month/day in `year`. February 29th falls back to the 28th in
 * non-leap years so leap-day birthdays are never skipped.
 */
export function sameDayInYear(date: IsoDate, year: number): IsoDate {
  const p = parsePartialDate(date);
  if (!p?.day || !p.month) throw new Error('sameDayInYear expects a full date');
  const day = Math.min(p.day, daysInMonth(year, p.month));
  return `${year}-${String(p.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Sort key that places "1999" before "1999-01" before "1999-01-01". */
export function partialDateSortKey(value: PartialDate): string {
  const p = parsePartialDate(value);
  if (!p) return '0000-00-00';
  return `${p.year}-${String(p.month ?? 0).padStart(2, '0')}-${String(p.day ?? 0).padStart(2, '0')}`;
}

/** "1998", "jul 1998" or "14 jul 1998". */
export function formatPartialDate(value: PartialDate): string {
  const p = parsePartialDate(value);
  if (!p) return value;
  if (p.month === undefined) return String(p.year);
  const month = MONTHS[p.month - 1];
  return p.day === undefined ? `${month} ${p.year}` : `${p.day} ${month} ${p.year}`;
}

/** "octubre" for 10. */
export function monthName(month: number): string {
  return MONTHS_LONG[month - 1] ?? '';
}

/** "14 de julio". */
export function formatDayMonth(value: IsoDate): string {
  const p = parsePartialDate(value);
  if (!p?.month || !p.day) return value;
  return `${p.day} de ${MONTHS_LONG[p.month - 1]}`;
}

/** Human countdown used by event alerts. */
export function formatDaysUntil(days: number): string {
  if (days === 0) return 'hoy';
  if (days === 1) return 'mañana';
  if (days === 7) return 'dentro de una semana';
  return `en ${days} días`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return s ? `${m} min ${s} s` : `${m} min`;
  return `${s} s`;
}

export function yearOf(value: PartialDate): number | null {
  return parsePartialDate(value)?.year ?? null;
}
