import type { IsoDate, Library } from '../types/domain';
import { upcomingEvents } from '../utils/events';
import { isNativeApp, scheduleNativeNotifications } from './nativeBridge';
import { planDateNotifications } from './notificationPlan';

/** Last plan handed to Android: the library refreshes every minute, mostly unchanged. */
let lastPlan = '';

/**
 * Android app: (re)schedules the reminders of every important date of the
 * user's channels for the next year, each at its channel's time. No-op on
 * the web or without permission.
 */

export async function syncDateNotifications(library: Library, today: IsoDate): Promise<void> {
  if (!isNativeApp()) return;
  const channels = new Map(library.channels.map((c) => [c.id, c]));
  const plan = planDateNotifications(
    upcomingEvents(library.events, library.people, today),
    new Date(),
    (id) => channels.get(id)?.name,
    (id) => channels.get(id)?.notifyAt,
  );
  const signature = JSON.stringify(plan);
  if (signature === lastPlan) return;
  try {
    await scheduleNativeNotifications(plan);
    lastPlan = signature;
  } catch {
    // Never break the app because of reminders.
  }
}
