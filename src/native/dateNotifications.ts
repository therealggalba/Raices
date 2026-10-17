import type { IsoDate, Library } from '../types/domain';
import { upcomingEvents } from '../utils/events';
import { isNativeApp, scheduleNativeNotifications } from './nativeBridge';
import { planDateNotifications } from './notificationPlan';

/**
 * Android app: (re)schedules the reminders of every important date of the
 * user's channels for the next year. No-op on the web or without permission.
 */
export async function syncDateNotifications(library: Library, today: IsoDate): Promise<void> {
  if (!isNativeApp()) return;
  const names = new Map(library.channels.map((c) => [c.id, c.name]));
  const plan = planDateNotifications(upcomingEvents(library.events, library.people, today), new Date(), (id) => names.get(id));
  try {
    await scheduleNativeNotifications(plan);
  } catch {
    // Never break the app because of reminders.
  }
}
