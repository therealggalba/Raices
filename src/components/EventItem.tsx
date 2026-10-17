import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { DateOccurrence, Person } from '../types/domain';
import { formatDaysUntil, monthShort } from '../utils/dates';
import { ALERT_WINDOW_DAYS, anniversaryLabel } from '../utils/events';
import { EVENT_LABELS } from '../utils/labels';
import styles from './EventItem.module.scss';

interface Props {
  event: DateOccurrence;
  people: readonly Person[];
  /** Shown when dates of several channels are listed together. */
  channelName?: string;
  /** Extra controls (edit/delete) for admins. */
  actions?: ReactNode;
}

/** One important date: day block, description, anniversary number and countdown. */
export function EventItem({ event, people, channelName, actions }: Props) {
  const label = anniversaryLabel(event);
  const tagged = event.personIds.map((id) => people.find((p) => p.id === id)).filter((p): p is Person => !!p);
  const state =
    event.daysUntil === 0 ? styles.today : event.daysUntil < 0 ? styles.past : event.daysUntil <= ALERT_WINDOW_DAYS ? styles.soon : '';
  const day = Number(event.date.slice(8, 10));
  const month = Number(event.date.slice(5, 7));

  return (
    <article className={[styles.item, state].join(' ')}>
      <span className={styles.dateBlock} aria-hidden>
        <span className={styles.day}>{day}</span>
        <span className={styles.month}>{monthShort(month)}</span>
      </span>
      <div className={styles.body}>
        <h3 className={styles.title}>
          {event.title}
        </h3>
        <p className={styles.meta}>
          {label ? <strong className={styles.number}>{label}</strong> : EVENT_LABELS[event.type]}
          {channelName && <span> · {channelName}</span>}
          {tagged.length > 0 && (
            <span>
              {' · '}
              {tagged.map((p, i) => (
                <span key={p.id}>
                  {i > 0 && ', '}
                  <Link to={`/c/${p.channelId}/personas/${p.id}`}>{p.firstName}</Link>
                </span>
              ))}
            </span>
          )}
        </p>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
      <span className={styles.when}>{formatDaysUntil(event.daysUntil)}</span>
    </article>
  );
}
