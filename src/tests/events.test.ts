import { describe, expect, it } from 'vitest';
import { eventAlerts, nextOccurrence, occurrenceSubtitle, pastEvents, upcomingEvents } from '../utils/events';
import { makeEvent, makePerson } from './fixtures';

const TODAY = '2026-10-15';

describe('nextOccurrence', () => {
  it('rolls recurring dates to this year or the next and counts the years', () => {
    expect(nextOccurrence('1966-10-16', true, TODAY)).toEqual({ date: '2026-10-16', years: 60 });
    expect(nextOccurrence('1966-10-15', true, TODAY)).toEqual({ date: '2026-10-15', years: 60 });
    expect(nextOccurrence('1966-10-14', true, TODAY)).toEqual({ date: '2027-10-14', years: 61 });
  });

  it('keeps one-off dates only while they are in the future', () => {
    expect(nextOccurrence('2026-10-22', false, TODAY)).toEqual({ date: '2026-10-22' });
    expect(nextOccurrence('2026-10-01', false, TODAY)).toBeNull();
  });

  it('does not report "0 years" for something created this year', () => {
    expect(nextOccurrence('2026-12-01', true, TODAY)?.years).toBeUndefined();
  });
});

describe('upcomingEvents', () => {
  const people = [
    makePerson({ id: 'p-carlos', firstName: 'Carlos', birthDate: '1998-10-18' }),
    makePerson({ id: 'p-ana', firstName: 'Ana', birthDate: '2000-01-05' }),
    makePerson({ id: 'p-sin', firstName: 'Sin fecha' }),
  ];

  it('merges explicit events with birthdays derived from people, soonest first', () => {
    const list = upcomingEvents(
      [makeEvent({ id: 'e-ani', title: 'Aniversario de los abuelos', date: '1966-10-16' })],
      people,
      TODAY,
    );
    expect(list.map((e) => [e.title, e.daysUntil])).toEqual([
      ['Aniversario de los abuelos', 1],
      ['Cumpleaños de Carlos', 3],
      ['Cumpleaños de Ana', 82],
    ]);
    expect(list[1].years).toBe(28);
  });

  it('does not duplicate a birthday that already has an explicit event', () => {
    const list = upcomingEvents(
      [makeEvent({ id: 'e-cumple', type: 'cumpleanos', title: 'Cumple de Carlos', date: '1998-10-18', personIds: ['p-carlos'] })],
      people,
      TODAY,
    );
    expect(list.filter((e) => e.personIds.includes('p-carlos'))).toHaveLength(1);
  });

  it('only alerts within a week, and lists past one-off events', () => {
    const events = [
      makeEvent({ id: 'a', date: '2026-10-22', recurring: false, title: 'Comunión' }),
      makeEvent({ id: 'b', date: '2026-10-23', recurring: false, title: 'Lejos' }),
      makeEvent({ id: 'c', date: '2026-09-01', recurring: false, title: 'Pasado' }),
    ];
    expect(eventAlerts(upcomingEvents(events, [], TODAY)).map((e) => e.title)).toEqual(['Comunión']);
    expect(pastEvents(events, TODAY).map((e) => e.title)).toEqual(['Pasado']);
  });

  it('builds human subtitles', () => {
    const [birthday] = upcomingEvents([], [people[0]], TODAY);
    expect(occurrenceSubtitle(birthday, people)).toBe('Carlos cumple 28');
  });
});
