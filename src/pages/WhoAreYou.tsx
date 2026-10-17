import { useState } from 'react';
import { Button, ErrorBanner, LinkButton } from '../components/ui';
import { ui } from '../components/ui-styles';
import { useChannel } from '../hooks/channel-context';
import { useAction } from '../hooks/useAction';
import { confirmAction } from '../hooks/useConfirm';
import { repository } from '../services';
import { fullName, sortPeople } from '../utils/people';
import styles from './WhoAreYou.module.scss';

/**
 * Required before using a channel when the member has no person yet (the
 * creator, or someone invited before invitations named a person): they pick
 * who they are, once. Admins can also create their own card.
 */
export function WhoAreYou() {
  const { snapshot, isAdmin, reload } = useChannel();
  const { channel, people, members, me } = snapshot;
  const { run, pending, error } = useAction();
  const [selected, setSelected] = useState('');
  const taken = new Set(members.map((m) => m.personId).filter(Boolean));
  const free = sortPeople(people).filter((p) => !taken.has(p.id));

  return (
    <div className={[ui.page, styles.page].join(' ')}>
      <h1>¿Quién eres en {channel.name}?</h1>
      <p className={ui.muted}>Elige tu ficha. Después solo podrá cambiarla un administrador.</p>

      {free.length > 0 && (
        <ul className={styles.list}>
          {free.map((p) => (
            <li key={p.id}>
              <label className={[styles.option, selected === p.id ? styles.selected : ''].join(' ')}>
                <input type="radio" name="who" value={p.id} checked={selected === p.id} onChange={() => setSelected(p.id)} />
                <span>
                  <strong>{fullName(p)}</strong>
                  {p.birthDate && <span className={ui.muted}> · {p.birthDate.slice(0, 4)}</span>}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <ErrorBanner message={error} />
      <div className={styles.actions}>
        {free.length > 0 && (
          <Button
            variant="primary"
            disabled={!selected || pending}
            onClick={async () => {
              const person = people.find((p) => p.id === selected);
              if (!person || !confirmAction(`¿Eres ${fullName(person)}?`)) return;
              await run(async () => {
                await repository.linkMemberPerson(channel.id, me.userId, selected);
                await reload();
                return true;
              });
            }}
          >
            Soy yo
          </Button>
        )}
        {isAdmin ? (
          <LinkButton to={`/c/${channel.id}/personas/nueva?soyyo=1`} variant={free.length ? 'ghost' : 'primary'}>
            No estoy en la lista: crear mi ficha
          </LinkButton>
        ) : (
          free.length === 0 && <p className={ui.muted}>Pide a un administrador del canal que añada tu ficha.</p>
        )}
      </div>
    </div>
  );
}
