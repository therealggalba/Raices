import { describe, expect, it } from 'vitest';
import type { DateOccurrence } from '../types/domain';
import { MAX_SCHEDULED, notificationId, planDateNotifications } from '../native/notificationPlan';

const occ = (key: string, date: string, years = 31): DateOccurrence => ({
  key,
  channelId: 'fam',
  channelIds: ['fam'],
  type: 'cumpleanos',
  title: `Cumpleaños de ${key}`,
  date,
  originDate: '1995-03-30',
  years,
  daysUntil: 0,
  personIds: [],
});

describe('planDateNotifications', () => {
  const now = new Date(2026, 9, 17, 10, 0); // 17 Oct 2026, 10:00 local

  it('schedules each date at 9:00 local, skipping today once 9:00 has passed', () => {
    const plan = planDateNotifications([occ('hoy', '2026-10-17'), occ('Gonzalo', '2027-03-30')], now, () => 'Familia');
    expect(plan).toHaveLength(1);
    expect(plan[0].at).toEqual(new Date(2027, 2, 30, 9, 0, 0));
    expect(plan[0].title).toBe('Hoy: Cumpleaños de Gonzalo');
    expect(plan[0].body).toBe('Cumple 31 · Familia');
  });

  it("fires at each channel's time; shared dates at the earliest of them", () => {
    const times: Record<string, string> = { fam: '20:30', uni: '08:15' };
    const shared = { ...occ('Ana', '2027-03-30'), channelIds: ['fam', 'uni'] };
    const plan = planDateNotifications([occ('Gonzalo', '2027-03-29'), shared], now, () => undefined, (id) => times[id]);
    expect(plan[0].at).toEqual(new Date(2027, 2, 29, 20, 30, 0));
    expect(plan[1].at).toEqual(new Date(2027, 2, 30, 8, 15, 0));
    // Today's reminder is still ahead when the channel's time hasn't come yet.
    expect(planDateNotifications([occ('hoy', '2026-10-17')], now, () => undefined, () => '20:30')).toHaveLength(1);
    // A malformed time falls back to 9:00.
    expect(planDateNotifications([occ('x', '2027-01-01')], now, () => undefined, () => '99:99')[0].at.getHours()).toBe(9);
  });

  it('caps the queue and uses stable, positive ids', () => {
    const many = Array.from({ length: 80 }, (_, i) => occ(`p${i}`, '2027-01-01'));
    expect(planDateNotifications(many, now)).toHaveLength(MAX_SCHEDULED);
    expect(notificationId('a', '2027-01-01')).toBe(notificationId('a', '2027-01-01'));
    expect(notificationId('a', '2027-01-01')).not.toBe(notificationId('a', '2028-01-01'));
    expect(notificationId('x', 'y')).toBeGreaterThan(0);
  });
});
