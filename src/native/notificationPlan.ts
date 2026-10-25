import type { DateOccurrence } from '../types/domain';
import { anniversaryLabel } from '../utils/events';

// Which local notifications the Android app schedules for important dates.
// Pure (testable); the Capacitor calls live in nativeBridge.ts.

/** Time of day a reminder fires when its channel has none (local time). */
export const DEFAULT_NOTIFY_TIME = '09:00';
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

/** «HH:MM» -> minutes after midnight (the default time when missing or malformed). */
function minutesOf(time: string | undefined): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time ?? '') ?? /^(\d\d):(\d\d)$/.exec(DEFAULT_NOTIFY_TIME);
  return match ? Number(match[1]) * 60 + Number(match[2]) : 9 * 60;
}

/**
 * Each channel chooses when its reminders fire (channelTime, «HH:MM»); a
 * date shared by several channels fires at the earliest of their times.
 */
export function planDateNotifications(
  upcoming: readonly DateOccurrence[],
  now: Date,
  channelName: (channelId: string) => string | undefined = () => undefined,
  channelTime: (channelId: string) => string | undefined = () => undefined,
): PlannedNotification[] {
  const plan: PlannedNotification[] = [];
  for (const o of upcoming) {
    const [y, m, d] = o.date.split('-').map(Number);
    const ids = o.channelIds?.length ? o.channelIds : [o.channelId];
    const minutes = Math.min(...ids.map((id) => minutesOf(channelTime(id))));
    const at = new Date(y, m - 1, d, Math.floor(minutes / 60), minutes % 60, 0);
    if (at <= now) continue; // today's time already passed: the in-app pop-up covers it
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
