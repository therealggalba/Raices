import type { DateOccurrence } from '../types/domain';
import { anniversaryLabel } from '../utils/events';

// Which local notifications the Android app schedules for important dates.
// Pure (testable); the Capacitor calls live in nativeBridge.ts.

/** Hour of the day the reminder fires (local time). */
export const NOTIFY_HOUR = 9;
/** Android keeps a limited queue of pending alarms: schedule the nearest ones. */
export const MAX_SCHEDULED = 60;

export interface PlannedNotification {
  id: number;
  title: string;
  body: string;
  at: Date;
}

/** Stable positive 31-bit id for an occurrence (same date -> same id). */
export function notificationId(key: string, date: string): number {
  let h = 0;
  for (const c of `${key}@${date}`) h = (Math.imul(h, 31) + c.charCodeAt(0)) | 0;
  return (h & 0x7fffffff) || 1;
}

export function planDateNotifications(
  upcoming: readonly DateOccurrence[],
  now: Date,
  channelName: (channelId: string) => string | undefined = () => undefined,
): PlannedNotification[] {
  const plan: PlannedNotification[] = [];
  for (const o of upcoming) {
    const [y, m, d] = o.date.split('-').map(Number);
    const at = new Date(y, m - 1, d, NOTIFY_HOUR, 0, 0);
    if (at <= now) continue; // today's 9:00 already passed: the in-app pop-up covers it
    const label = anniversaryLabel(o);
    plan.push({
      id: notificationId(o.key, o.date),
      title: `Hoy: ${o.title}`,
      body: [label ?? '¡Es hoy!', channelName(o.channelId)].filter(Boolean).join(' · '),
      at,
    });
    if (plan.length >= MAX_SCHEDULED) break;
  }
  return plan;
}
