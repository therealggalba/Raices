import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { Share } from '@capacitor/share';
import { StatusBar, Style } from '@capacitor/status-bar';
import type { PlannedNotification } from './notificationPlan';

// Everything that only exists inside the Android app (Capacitor). On the web
// these helpers fall back to browser behaviour or do nothing.

export const isNativeApp = (): boolean => Capacitor.isNativePlatform();

const SCHEME = '(prefers-color-scheme: dark)';

/** Status bar in the app colours, following the phone's light / dark mode. */
export async function setupStatusBar(): Promise<void> {
  if (!isNativeApp()) return;
  const apply = async () => {
    const dark = window.matchMedia(SCHEME).matches;
    try {
      // Style.Dark = light icons (for a dark app); Style.Light = dark icons.
      await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
      // The season's background (CSS variable), so the bar blends with the app.
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
      await StatusBar.setBackgroundColor({ color: bg || (dark ? '#121010' : '#fbf8f4') });
    } catch {
      // Not available on every Android version (edge-to-edge): harmless.
    }
  };
  await apply();
  window.matchMedia(SCHEME).addEventListener('change', () => void apply());
}

/**
 * Hardware back button: go back through the app's screens; on the home
 * screen (nothing to go back to) leave the app.
 */
export function listenBackButton(onBack: (canGoBack: boolean) => void): () => void {
  if (!isNativeApp()) return () => {};
  const handle = App.addListener('backButton', ({ canGoBack }) => onBack(canGoBack));
  return () => void handle.then((h) => h.remove());
}

/** Closes the app (Android back button on the first screen). */
export function exitApp(): void {
  if (isNativeApp()) void App.exitApp();
}

/** Videos in full screen may rotate to landscape; the rest of the app stays portrait. */
export async function allowRotation(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await ScreenOrientation.unlock();
  } catch {
    // ignore
  }
}

export async function lockPortrait(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await ScreenOrientation.lock({ orientation: 'portrait' });
  } catch {
    // ignore
  }
}

/** Phones and tablets (the app, or a touch browser): videos open in full screen. */
export function prefersFullscreenVideo(): boolean {
  return isNativeApp() || (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches);
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

/**
 * In the Android app: take a photo with the camera or pick one from the
 * gallery (the plugin asks for camera permission when it needs it).
 * Null when cancelled, or in the browser (the page uses file inputs there).
 */
export async function pickNativePhoto(source: 'camera' | 'gallery'): Promise<Blob | null> {
  if (!isNativeApp()) return null;
  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
  try {
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
      quality: 92,
      correctOrientation: true,
    });
    if (!photo.webPath) return null;
    return await (await fetch(photo.webPath)).blob();
  } catch {
    // Cancelled, or permission refused.
    return null;
  }
}
