import type { DateOccurrence } from '../types/domain';
import { formatDayMonthShort, formatDaysUntilShort } from '../utils/dates';
import { ALERT_WINDOW_DAYS } from '../utils/events';
import styles from './UpcomingStrip.module.scss';

/**
 * The nearest dates: one row each on phones (so every title fits on one
 * line), side by side across the full width on wider screens.
 */
export function UpcomingStrip({ events }: { events: readonly DateOccurrence[] }) {
  return (
    <ol className={styles.strip} style={{ ['--columns' as string]: events.length }}>
      {events.map((event) => (
        <li
          key={event.key}
          className={[styles.item, event.daysUntil <= ALERT_WINDOW_DAYS ? styles.soon : ''].join(' ')}
        >
          <span className={styles.top}>
            <span className={styles.when}>{formatDaysUntilShort(event.daysUntil)}</span>
          </span>
          <span className={[styles.title, 'one-line'].join(' ')}>{event.title}</span>
          <span className={[styles.date, 'one-line'].join(' ')}>
            {formatDayMonthShort(event.date)}
            {event.years > 0
              ? ` · ${event.type === 'cumpleanos' ? `${event.years} años` : event.type === 'fallecimiento' ? `hace ${event.years} años` : `${event.years}.º aniv.`}`
              : ''}
          </span>
        </li>
      ))}
    </ol>
  );
}
