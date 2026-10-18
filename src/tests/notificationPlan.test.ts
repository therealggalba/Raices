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

  it('caps the queue and uses stable, positive ids', () => {
    const many = Array.from({ length: 80 }, (_, i) => occ(`p${i}`, '2027-01-01'));
    expect(planDateNotifications(many, now)).toHaveLength(MAX_SCHEDULED);
    expect(notificationId('a', '2027-01-01')).toBe(notificationId('a', '2027-01-01'));
    expect(notificationId('a', '2027-01-01')).not.toBe(notificationId('a', '2028-01-01'));
    expect(notificationId('x', 'y')).toBeGreaterThan(0);
  });
});
