import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLibrary } from '../hooks/library-context';
import type { DateOccurrence } from '../types/domain';
import { syncDateNotifications } from '../native/dateNotifications';
import { isNativeApp, nativeNotificationPermission, requestNativeNotifications } from '../native/nativeBridge';
import { anniversaryLabel, todaysEvents } from '../utils/events';
import { EVENT_ICONS } from '../utils/labels';
import { Button } from './ui';
import styles from './TodayPopup.module.scss';

// Per-browser memory of what was already shown today (a convenience: if
// storage is unavailable the pop-up simply shows again).
const SEEN_KEY = 'family-memories:hoy';

interface Seen {
  date: string;
  dismissed: string[];
  notified: string[];
}

function readSeen(today: string): Seen {
  try {
    const raw = JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? 'null') as Partial<Seen> | null;
    if (raw && raw.date === today && Array.isArray(raw.dismissed) && Array.isArray(raw.notified)) {
      return { date: today, dismissed: raw.dismissed.map(String), notified: raw.notified.map(String) };
    }
  } catch {
    // ignore
  }
  return { date: today, dismissed: [], notified: [] };
}

function writeSeen(seen: Seen) {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    // ignore
  }
}

function notificationText(o: DateOccurrence, channelName?: string): { title: string; body: string } {
  const label = anniversaryLabel(o);
  return {
    title: `${EVENT_ICONS[o.type]} ${o.title}`,
    body: [label ? `¡Hoy! ${label}` : '¡Es hoy!', channelName].filter(Boolean).join(' · '),
  };
}

const supportsNotifications = () => typeof window !== 'undefined' && 'Notification' in window;

/** Sends a system notification for each of today's dates not yet notified. */
function notifySystem(list: readonly DateOccurrence[], today: string, channelName: (id: string) => string | undefined) {
  if (!supportsNotifications() || Notification.permission !== 'granted') return;
  const seen = readSeen(today);
  const icon = `${import.meta.env.BASE_URL}favicon.svg`;
  for (const o of list) {
    if (seen.notified.includes(o.key)) continue;
    const { title, body } = notificationText(o, channelName(o.channelId));
    try {
      // Desktop browsers. On Android, notifications need a service worker
      // (push phase), so this may throw: the in-app pop-up still shows.
      new Notification(title, { body, icon, tag: `${today}:${o.key}` });
      seen.notified.push(o.key);
    } catch {
      break;
    }
  }
  writeSeen(seen);
}

/** «Hoy es un día especial»: today's dates, once a day, in-app and (optionally) as system notifications. */
export function TodayPopup() {
  const { library, today, channelById } = useLibrary();
  const list = useMemo(() => todaysEvents(library.events, library.people, today), [library, today]);
  const [open, setOpen] = useState(() => list.some((o) => !readSeen(today).dismissed.includes(o.key)));
  const native = isNativeApp();
  const [permission, setPermission] = useState<string>(() =>
    native ? 'unknown' : supportsNotifications() ? Notification.permission : 'denied',
  );
  // Android app: reminders are native, scheduled ahead (they work with the app closed).
  useEffect(() => {
    if (native) void nativeNotificationPermission().then((p) => setPermission(p === 'prompt' ? 'default' : p));
  }, [native]);
  const closeRef = useRef<HTMLButtonElement>(null);
  const channelName = (id: string) => channelById(id)?.name;

  useEffect(() => {
    // Safe to re-run: already-notified dates are remembered for the day.
    if (list.length && !native) notifySystem(list, today, (id) => channelById(id)?.name);
  }, [list, today, channelById, native]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  if (!open || list.length === 0) return null;

  function dismiss() {
    const seen = readSeen(today);
    writeSeen({ ...seen, dismissed: [...new Set([...seen.dismissed, ...list.map((o) => o.key)])] });
    setOpen(false);
  }

  return (
    <div className={styles.backdrop} onClick={dismiss}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="today-title"
        onClick={(e) => e.stopPropagation()}
      >
        <span className={styles.confetti} aria-hidden>
          🎉
        </span>
        <h2 id="today-title">Hoy es un día especial</h2>
        <ul className={styles.list}>
          {list.map((o) => {
            const label = anniversaryLabel(o);
            return (
              <li key={o.key} className={styles.item}>
                <span className={styles.icon} aria-hidden>
                  {EVENT_ICONS[o.type]}
                </span>
                <span className={styles.text}>
                  <strong>{o.title}</strong>
                  <span>
                    {label ? <b>{label}</b> : '¡Es hoy!'}
                    {channelName(o.channelId) && ` · ${channelName(o.channelId)}`}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
        <div className={styles.actions}>
          <Button ref={closeRef} variant="primary" block onClick={dismiss}>
            ¡Entendido!
          </Button>
          {permission === 'default' && (
            <Button
              variant="ghost"
              small
              onClick={async () => {
                if (native) {
                  const granted = await requestNativeNotifications();
                  setPermission(granted ? 'granted' : 'denied');
                  if (granted) await syncDateNotifications(library, today);
                  return;
                }
                const result = await Notification.requestPermission();
                setPermission(result);
                if (result === 'granted') notifySystem(list, today, channelName);
              }}
            >
              {native
                ? '🔔 Avisarme en el móvil de las próximas fechas'
                : '🔔 Avisarme también con notificaciones del navegador'}
            </Button>
          )}
          <Link to="/fechas" className={styles.link} onClick={dismiss}>
            Ver todas las fechas
          </Link>
        </div>
      </div>
    </div>
  );
}
