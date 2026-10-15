import { Link } from 'react-router-dom';
import type { Person, UpcomingEvent } from '../types/domain';
import { formatDayMonth, formatDaysUntil } from '../utils/dates';
import { occurrenceSubtitle } from '../utils/events';
import { EVENT_ICONS } from '../utils/labels';
import styles from './EventItem.module.scss';

interface Props {
  event: UpcomingEvent;
  people: readonly Person[];
  channelId: string;
  highlight?: boolean;
}

export function EventItem({ event, people, channelId, highlight }: Props) {
  const subtitle = occurrenceSubtitle(event, people);
  const tagged = event.personIds.map((id) => people.find((p) => p.id === id)).filter((p): p is Person => !!p);
  return (
    <article className={[styles.item, highlight ? styles.highlight : ''].join(' ')}>
      <span className={styles.icon} aria-hidden>
        {EVENT_ICONS[event.type]}
      </span>
      <div className={styles.body}>
        <h3 className={styles.title}>{event.title}</h3>
        <p className={styles.meta}>
          {formatDayMonth(event.date)}
          {subtitle && ` · ${subtitle}`}
        </p>
        {tagged.length > 0 && (
          <p className={styles.people}>
            {tagged.map((p, i) => (
              <span key={p.id}>
                {i > 0 && ', '}
                <Link to={`/c/${channelId}/personas/${p.id}`}>{p.firstName}</Link>
              </span>
            ))}
          </p>
        )}
      </div>
      <span className={styles.when}>{formatDaysUntil(event.daysUntil)}</span>
    </article>
  );
}
