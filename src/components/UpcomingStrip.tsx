import type { UpcomingEvent } from '../types/domain';
import { formatDayMonthShort, formatDaysUntilShort } from '../utils/dates';
import { ALERT_WINDOW_DAYS } from '../utils/events';
import { EVENT_ICONS } from '../utils/labels';
import styles from './UpcomingStrip.module.scss';

/** Compact strip with the nearest dates, side by side across the full width. */
export function UpcomingStrip({ events }: { events: readonly UpcomingEvent[] }) {
  return (
    <ol className={styles.strip} style={{ gridTemplateColumns: `repeat(${events.length}, minmax(0, 1fr))` }}>
      {events.map((event) => (
        <li
          key={event.key}
          className={[styles.item, event.daysUntil <= ALERT_WINDOW_DAYS ? styles.soon : ''].join(' ')}
        >
          <span className={styles.top}>
            <span className={styles.icon} aria-hidden>
              {EVENT_ICONS[event.type]}
            </span>
            <span className={styles.when}>{formatDaysUntilShort(event.daysUntil)}</span>
          </span>
          <span className={styles.title}>{event.title}</span>
          <span className={styles.date}>
            {formatDayMonthShort(event.date)}
            {event.years ? ` · ${event.years} años` : ''}
          </span>
        </li>
      ))}
    </ol>
  );
}
