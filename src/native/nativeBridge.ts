import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Share } from '@capacitor/share';
import { StatusBar, Style } from '@capacitor/status-bar';
import type { PlannedNotification } from './notificationPlan';

// Everything that only exists inside the Android app (Capacitor). On the web
// these helpers fall back to browser behaviour or do nothing.

export const isNativeApp = (): boolean => Capacitor.isNativePlatform();

/** Status bar in the app colours. */
export async function setupStatusBar(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await StatusBar.setStyle({ style: Style.Dark }); // light icons on a dark app
    await StatusBar.setBackgroundColor({ color: '#0e0d12' });
  } catch {
    // Not available on every Android version (edge-to-edge): harmless.
  }
}

/**
 * Hardware back button: go back through the app's screens; on the home
 * screen (nothing to go back to) leave the app.
 */
export function listenBackButton(goBack: () => void): () => void {
  if (!isNativeApp()) return () => {};
  const handle = App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) goBack();
    else void App.exitApp();
  });
  return () => void handle.then((h) => h.remove());
}

export type NotificationPermission = 'granted' | 'denied' | 'prompt';

export async function nativeNotificationPermission(): Promise<NotificationPermission> {
  const { display } = await LocalNotifications.checkPermissions();
  return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'prompt';
}

export async function requestNativeNotifications(): Promise<boolean> {
  const { display } = await LocalNotifications.requestPermissions();
  return display === 'granted';
}

/**
 * Replaces the scheduled date reminders with `plan`. Works with the app
 * closed: Android fires them at the planned time.
 */
export async function scheduleNativeNotifications(plan: readonly PlannedNotification[]): Promise<void> {
  if (!isNativeApp() || (await nativeNotificationPermission()) !== 'granted') return;
  const { notifications: pending } = await LocalNotifications.getPending();
  if (pending.length) await LocalNotifications.cancel({ notifications: pending.map((n) => ({ id: n.id })) });
  if (!plan.length) return;
  await LocalNotifications.schedule({
    notifications: plan.map((n) => ({ id: n.id, title: n.title, body: n.body, schedule: { at: n.at, allowWhileIdle: true } })),
  });
}

/**
 * Shares a text: native share sheet in the app (WhatsApp, Telegram…), Web
 * Share where the browser has it, clipboard otherwise.
 */
export async function shareText(title: string, text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (isNativeApp()) {
      await Share.share({ title, text, dialogTitle: title });
      return 'shared';
    }
    if (typeof navigator.share === 'function') {
      await navigator.share({ title, text });
      return 'shared';
    }
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
