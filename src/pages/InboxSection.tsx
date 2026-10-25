import { useEffect, useState } from 'react';
import { ErrorBanner, Spinner } from '../components/ui';
import { ui } from '../components/ui-styles';
import { useChannel } from '../hooks/channel-context';
import { repository } from '../services';
import { errorMessage } from '../services/repository';
import type { ChannelNotification, FieldChange } from '../types/domain';
import { formatPartialDate } from '../utils/dates';
import { fullName } from '../utils/people';
import styles from './InboxSection.module.scss';

const FIELD_LABELS: Record<FieldChange['field'], string> = {
  firstName: 'Nombre',
  lastName: 'Apellidos',
  birthDate: 'Nacimiento',
  gender: 'Género',
  photoUrl: 'Foto',
  biography: 'Biografía',
};

function value(change: FieldChange, which: 'before' | 'after'): string {
  const v = change[which];
  if (!v) return '—';
  if (change.field === 'birthDate') return formatPartialDate(v);
  if (change.field === 'gender') return v === 'hombre' ? 'Hombre' : v === 'mujer' ? 'Mujer' : v;
  if (change.field === 'photoUrl') return which === 'after' ? 'foto nueva' : 'foto anterior';
  return v;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * The owner's inbox: who joined, left or was removed, and who corrected
 * their own card. Opening it marks everything as read.
 */
export function InboxSection() {
  const { snapshot, reload, personById } = useChannel();
  const channelId = snapshot.channel.id;
  const [items, setItems] = useState<ChannelNotification[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    repository.listNotifications(channelId).then(
      async (list) => {
        if (cancelled) return;
        setItems(list);
        if (list.some((n) => !n.readAt)) {
          await repository.markNotificationsRead(channelId).catch(() => {});
          if (!cancelled) await reload();
        }
      },
      (e: unknown) => !cancelled && setError(errorMessage(e)),
    );
    return () => {
      cancelled = true;
    };
    // Load once per channel; reload() only refreshes the unread badge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  const describe = (n: ChannelNotification) => {
    const person = n.personId ? personById(n.personId) : undefined;
    switch (n.kind) {
      case 'member_joined':
        return `${n.actorName} se ha unido al canal${person ? ` como ${fullName(person)}` : ''}`;
      case 'member_left':
        return `${n.actorName} ha salido del canal`;
      case 'member_removed':
        return `${n.actorName} ya no es miembro del canal`;
      case 'person_edited':
        return `${n.actorName} ha corregido su ficha`;
    }
  };

  return (
    <>
      <ErrorBanner message={error} />
      {!items && !error && <Spinner />}
      {items && items.length === 0 && <p className={ui.muted}>No hay avisos.</p>}
      {items && items.length > 0 && (
        <ul className={styles.list}>
          {items.map((n) => (
            <li key={n.id} className={[styles.item, n.readAt ? '' : styles.unread].join(' ')}>
              <div className={styles.head}>
                <strong>{describe(n)}</strong>
                <span className={styles.when}>{when(n.createdAt)}</span>
              </div>
              {n.changes.length > 0 && (
                <ul className={styles.changes}>
                  {n.changes.map((c) => (
                    <li key={c.field}>
                      <span className={styles.field}>{FIELD_LABELS[c.field]}:</span> {value(c, 'before')} →{' '}
                      <b>{value(c, 'after')}</b>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
