import { describe, expect, it } from 'vitest';
import {
  anniversaryLabel,
  dateParams,
  filterDates,
  occurrenceIn,
  occurrencesInYear,
  parseDateParams,
  parseYearParam,
  todaysEvents,
  upcomingEvents,
} from '../utils/events';
import { makeEvent, makePerson } from './fixtures';

const TODAY = '2026-10-16';

describe('occurrenceIn', () => {
  it('gives the same day each year with its anniversary number', () => {
    expect(occurrenceIn('1995-03-30', 2026)).toEqual({ date: '2026-03-30', years: 31 });
    expect(occurrenceIn('1995-03-30', 1995)).toEqual({ date: '1995-03-30', years: 0 });
  });

  it('does not exist before the year it first happened', () => {
    expect(occurrenceIn('2030-05-01', 2026)).toBeNull();
  });

  it('moves February 29th to the 28th in non-leap years', () => {
    expect(occurrenceIn('2000-02-29', 2027)).toEqual({ date: '2027-02-28', years: 27 });
  });
});

describe('upcomingEvents', () => {
  const people = [
    makePerson({ id: 'p-carlos', firstName: 'Carlos', birthDate: '1998-10-18' }),
    makePerson({ id: 'p-ana', firstName: 'Ana', birthDate: '2000-01-05' }),
    makePerson({ id: 'p-sin', firstName: 'Sin fecha' }),
  ];

  it('merges stored dates with birthdays derived from people, soonest first', () => {
    const list = upcomingEvents([makeEvent({ id: 'e-ani', title: 'Aniversario de los abuelos', date: '1966-10-17' })], people, TODAY);
    expect(list.map((e) => [e.title, e.daysUntil, e.years])).toEqual([
      ['Aniversario de los abuelos', 1, 60],
      ['Cumpleaños de Carlos', 2, 28],
      ['Cumpleaños de Ana', 81, 27],
    ]);
  });

  it('rolls a date already passed this year over to next year', () => {
    const [next] = upcomingEvents([makeEvent({ date: '1990-10-15' })], [], TODAY);
    expect(next).toMatchObject({ date: '2027-10-15', years: 37, daysUntil: 364 });
  });

  it('shows a date first happening in the future on that day, with number 0', () => {
    const [next] = upcomingEvents([makeEvent({ type: 'comunion', date: '2026-10-23' })], [], TODAY);
    expect(next).toMatchObject({ date: '2026-10-23', years: 0, daysUntil: 7 });
    expect(anniversaryLabel(next)).toBeNull();
  });

  it('does not duplicate a birthday that already has a stored date', () => {
    const list = upcomingEvents(
      [makeEvent({ id: 'e-cumple', type: 'cumpleanos', title: 'Cumple de Carlos', date: '1998-10-18', personIds: ['p-carlos'] })],
      people,
      TODAY,
    );
    expect(list.filter((e) => e.personIds.includes('p-carlos'))).toHaveLength(1);
  });

  it('finds today\'s dates for the pop-up', () => {
    const list = todaysEvents([makeEvent({ title: 'Hoy', date: '1982-10-16' }), makeEvent({ id: 'e2', date: '1982-10-17' })], [], TODAY);
    expect(list.map((e) => [e.title, e.years])).toEqual([['Hoy', 44]]);
  });
});

describe('anniversaryLabel', () => {
  it('reads as an age for birthdays and as an anniversary otherwise', () => {
    expect(anniversaryLabel({ type: 'cumpleanos', years: 31 })).toBe('Cumple 31');
    expect(anniversaryLabel({ type: 'boda', years: 18 })).toBe('18.º aniversario');
  });
});

describe('yearly list and filters', () => {
  const people = [makePerson({ id: 'p1', channelId: 'fam', firstName: 'Gonzalo', lastName: 'Galba', birthDate: '1995-03-30' })];
  const events = [
    makeEvent({ id: 'a', channelId: 'fam', type: 'aniversario', title: 'Aniversario de los abuelos', date: '1966-10-17' }),
    makeEvent({ id: 'b', channelId: 'uni', type: 'boda', title: 'Boda de Javi', date: '2015-09-19' }),
    makeEvent({ id: 'c', channelId: 'uni', type: 'otro', title: 'Fundación', date: '2027-01-01' }),
  ];
  const year = occurrencesInYear(events, people, 2026, TODAY);

  it('lists every date of the year in calendar order, past ones included', () => {
    expect(year.map((o) => [o.date, o.title, o.daysUntil < 0])).toEqual([
      ['2026-03-30', 'Cumpleaños de Gonzalo', true],
      ['2026-09-19', 'Boda de Javi', true],
      ['2026-10-17', 'Aniversario de los abuelos', false],
    ]);
  });

  it('filters by channel, month, type and person name', () => {
    const titles = (f: Partial<Parameters<typeof filterDates>[1]>) =>
      filterDates(year, { channelIds: [], months: [], types: [], query: '', ...f }, people).map((o) => o.title);
    expect(titles({ channelIds: ['uni'] })).toEqual(['Boda de Javi']);
    expect(titles({ months: [3, 10] })).toEqual(['Cumpleaños de Gonzalo', 'Aniversario de los abuelos']);
    expect(titles({ types: ['boda'] })).toEqual(['Boda de Javi']);
    expect(titles({ query: 'galba' })).toEqual(['Cumpleaños de Gonzalo']);
    expect(titles({ query: 'ABUELOS' })).toEqual(['Aniversario de los abuelos']);
  });

  it('round-trips filters through the URL and ignores garbage', () => {
    const filters = { channelIds: ['uni'], months: [3, 10], types: ['boda' as const], query: 'javi' };
    const params = dateParams(filters, 2025);
    expect(params.toString()).toBe('anio=2025&canal=uni&mes=3&mes=10&tipo=boda&q=javi');
    expect(parseDateParams(params)).toEqual(filters);
    expect(parseYearParam(params, 2026)).toBe(2025);
    expect(parseDateParams(new URLSearchParams('mes=13&mes=x&tipo=fiesta&canal=../a'))).toEqual({
      channelIds: [],
      months: [],
      types: [],
      query: '',
    });
    expect(parseYearParam(new URLSearchParams('anio=abc'), 2026)).toBe(2026);
  });
});

describe('people who passed away', () => {
  it('are remembered on the day they died, never with a birthday', () => {
    const grandpa = makePerson({ id: 'g', firstName: 'Manuel', birthDate: '1912-06-03', deathDate: '1989-01-27' });
    const list = upcomingEvents([], [grandpa], '2026-01-20', 366);
    expect(list.map((o) => o.type)).toEqual(['fallecimiento']);
    expect(list[0]).toMatchObject({ title: 'En memoria de Manuel', date: '2026-01-27', years: 37 });
    expect(anniversaryLabel(list[0])).toBe('Hace 37 años');
  });
});

describe('day-only dates (saints, family traditions)', () => {
  it('come back every year without counting years', () => {
    const santo = makeEvent({ id: 's', type: 'santo', title: 'Santo de Antonio', date: '2000-06-13' });
    const [next] = upcomingEvents([santo], [], '2026-06-01', 30);
    expect(next).toMatchObject({ date: '2026-06-13', years: 0 });
    expect(anniversaryLabel(next)).toBeNull();
  });
});
