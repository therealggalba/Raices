import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, ErrorBanner, Field } from '../components/ui';
import { ui } from '../components/ui-styles';
import { useChannel } from '../hooks/channel-context';
import { fullName, humansOnly, sortPeople } from '../utils/people';
import { useAction } from '../hooks/useAction';
import { confirmAction } from '../hooks/useConfirm';
import { shareText } from '../native/nativeBridge';
import { repository } from '../services';
import { CHANNEL_KINDS, PACK_THEMES } from '../types/domain';
import type { ChannelInput, ChannelKind, Invitation, Member, PackTheme } from '../types/domain';
import { Accordion } from '../components/Accordion';
import type { AccordionPanel } from '../components/Accordion';
import { PackArt } from '../components/PackArt';
import { PACK_LOOKS } from '../components/pack-looks';
import { EXPIRY_OPTIONS_DAYS, STATUS_LABELS, invitationStatus } from '../utils/invitations';
import { CHANNEL_KIND_LABELS, ROLE_LABELS } from '../utils/labels';
import { InboxSection } from './InboxSection';
import styles from './ChannelSettingsPage.module.scss';

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * The channel's settings, folded: one section open at a time. The owner
 * manages everything; the rest see the info, the members and can leave.
 */
export function ChannelSettingsPage() {
  const { snapshot, isOwner } = useChannel();
  const { channel, members } = snapshot;
  const owner = members.find((m) => m.role === 'owner');

  const panels: (AccordionPanel | false)[] = [
    isOwner && { id: 'buzon', title: 'Buzón', badge: snapshot.unreadNotifications, content: <InboxSection /> },
    {
      id: 'info',
      title: 'Información',
      content: isOwner ? (
        <ChannelInfoForm />
      ) : (
        <>
          {channel.description && <p className={styles.text}>{channel.description}</p>}
          <p className={ui.muted}>
            {CHANNEL_KIND_LABELS[channel.kind]}
            {owner && ` · creado por ${owner.displayName}`}
          </p>
        </>
      ),
    },
    isOwner && { id: 'sobres', title: 'Diseño de los sobres', content: <PackDesignForm /> },
    { id: 'avisos', title: 'Avisos de fechas', content: <NotifyTimeSection /> },
    { id: 'miembros', title: `Miembros (${members.length})`, content: <MembersSection /> },
    isOwner && { id: 'invitaciones', title: 'Invitaciones', content: <InvitationsSection /> },
    isOwner && members.length > 1 && { id: 'ceder', title: 'Ceder el canal', content: <TransferSection /> },
    { id: 'salir', title: 'Salir del canal', content: <LeaveSection /> },
    isOwner && { id: 'eliminar', title: 'Eliminar el canal', tone: 'danger', content: <DeleteChannelSection /> },
  ];

  return (
    <div className={ui.page}>
      <h1>{channel.name}</h1>
      <Accordion panels={panels.filter((p): p is AccordionPanel => !!p)} />
    </div>
  );
}

/** Saves the channel with some fields changed (the rest as they are). */
function useSaveChannel() {
  const { snapshot, reload } = useChannel();
  const { channel } = snapshot;
  const action = useAction();
  const [saved, setSaved] = useState(false);
  const save = async (changes: Partial<ChannelInput>) => {
    setSaved(false);
    const done = await action.run(async () => {
      const { name, description, kind, packTheme, coverUrl } = { ...channel, ...changes };
      await repository.updateChannel(channel.id, { name, description, kind, packTheme, ...(coverUrl?.trim() ? { coverUrl } : {}) });
      return true;
    });
    if (done) {
      await reload();
      setSaved(true);
    }
  };
  return { ...action, saved, save };
}

function ChannelInfoForm() {
  const { snapshot } = useChannel();
  const { channel } = snapshot;
  const { pending, error, saved, save } = useSaveChannel();
  const [name, setName] = useState(channel.name);
  const [description, setDescription] = useState(channel.description);
  const [kind, setKind] = useState<ChannelKind>(channel.kind);
  const [coverUrl, setCoverUrl] = useState(channel.coverUrl ?? '');

  return (
    <form
      className={ui.form}
      onSubmit={(e) => {
        e.preventDefault();
        void save({ name, description, kind, coverUrl });
      }}
    >
      <Field label="Nombre" htmlFor="name">
        <input id="name" className={ui.input} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
      </Field>
      <Field label="Tipo de canal" htmlFor="kind">
        <select id="kind" className={ui.input} value={kind} onChange={(e) => setKind(e.target.value as ChannelKind)}>
          {CHANNEL_KINDS.map((k) => (
            <option key={k} value={k}>
              {CHANNEL_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Descripción" htmlFor="description">
        <textarea id="description" className={ui.input} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
      </Field>
      <Field label="Portada (opcional)" htmlFor="coverUrl">
        <input id="coverUrl" className={ui.input} type="url" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://" />
      </Field>
      <ErrorBanner message={error} />
      <div className={ui.formActions}>
        {saved && <span className={styles.saved}>Guardado</span>}
        <Button type="submit" variant="primary" disabled={pending}>
          Guardar
        </Button>
      </div>
    </form>
  );
}

function PackDesignForm() {
  const { snapshot } = useChannel();
  const { channel } = snapshot;
  const { pending, error, saved, save } = useSaveChannel();
  const [packTheme, setPackTheme] = useState<PackTheme>(channel.packTheme);

  return (
    <form
      className={ui.form}
      onSubmit={(e) => {
        e.preventDefault();
        void save({ packTheme });
      }}
    >
      <fieldset className={styles.packThemes}>
        <legend>Cómo se ven los sobres de cromos de este canal</legend>
        <div className={styles.packGrid}>
          {PACK_THEMES.map((t) => (
            <label key={t} className={[styles.packOption, packTheme === t ? styles.packOptionOn : ''].join(' ')}>
              <input type="radio" name="packTheme" value={t} checked={packTheme === t} onChange={() => setPackTheme(t)} />
              <PackArt theme={t} title={channel.name} />
              <span>{PACK_LOOKS[t].label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <ErrorBanner message={error} />
      <div className={ui.formActions}>
        {saved && <span className={styles.saved}>Guardado</span>}
        <Button type="submit" variant="primary" disabled={pending}>
          Guardar
        </Button>
      </div>
    </form>
  );
}

/** When the date reminders reach the phones (the owner chooses it). */
function NotifyTimeSection() {
  const { snapshot, isOwner, reload } = useChannel();
  const { channel } = snapshot;
  const { run, pending, error } = useAction();
  const [time, setTime] = useState(channel.notifyAt);
  const [saved, setSaved] = useState(false);

  return (
    <>
      <p className={ui.muted}>
        En la app de Android, cada fecha importante de este canal te avisa ese mismo día a las{' '}
        <strong>{channel.notifyAt}</strong> (hora de tu móvil). Si la fecha está en varios de tus canales, avisa a la hora más
        temprana.
      </p>
      {isOwner && (
        <form
          className={[ui.form, styles.inlineForm].join(' ')}
          onSubmit={async (e) => {
            e.preventDefault();
            setSaved(false);
            const done = await run(async () => {
              await repository.setNotifyTime(channel.id, time);
              return true;
            });
            if (done) {
              await reload();
              setSaved(true);
            }
          }}
        >
          <Field label="Hora de los avisos" htmlFor="notify-at">
            <input
              id="notify-at"
              className={ui.input}
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
            />
          </Field>
          <ErrorBanner message={error} />
          <div className={ui.formActions}>
            {saved && <span className={styles.saved}>Guardado</span>}
            <Button type="submit" variant="primary" disabled={pending || time === channel.notifyAt}>
              Guardar
            </Button>
          </div>
        </form>
      )}
    </>
  );
}

const ROLE_ORDER: Record<Member['role'], number> = { owner: 0, admin: 1, member: 2 };

function MembersSection() {
  const { snapshot, isOwner, reload, personById } = useChannel();
  const { channel, me, members, invitations, people } = snapshot;
  const { run, pending, error } = useAction();
  const sorted = [...members].sort(
    (a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.displayName.localeCompare(b.displayName, 'es'),
  );

  const act = (fn: () => Promise<void>) =>
    run(async () => {
      await fn();
      await reload();
    });

  const joinedVia = (m: Member) => {
    const inv = m.invitationId ? invitations.find((i) => i.id === m.invitationId) : undefined;
    return inv ? ` · invitación ${inv.code}` : '';
  };

  return (
    <>
      <p className={ui.muted}>
        <strong>Creador:</strong> gestiona el canal y aprueba lo que suben los demás. <strong>Administrador:</strong> sube
        vídeos y cromos de cualquiera. <strong>Miembro:</strong> sube vídeos y cromos en los que aparece.
      </p>
      <ErrorBanner message={error} />
      <ul className={styles.list}>
        {sorted.map((m) => (
          <li key={m.userId} className={styles.item}>
            <div className={styles.itemBody}>
              <strong>
                {m.displayName}
                {m.userId === me.userId && ' (tú)'}
              </strong>
              <span className={styles.itemMeta}>
                {ROLE_LABELS[m.role]} · desde {new Date(m.joinedAt).toLocaleDateString('es-ES')}
                {isOwner && joinedVia(m)}
              </span>
              {isOwner ? (
                <select
                  className={[ui.input, styles.personSelect].join(' ')}
                  aria-label={`Quién es ${m.displayName}`}
                  value={m.personId ?? ''}
                  disabled={pending}
                  onChange={(e) => {
                    const next = e.target.value || null;
                    const label = next ? fullName(personById(next)!) : 'nadie';
                    if (confirmAction(`¿${m.displayName} es ${label}?`)) {
                      void act(() => repository.linkMemberPerson(channel.id, m.userId, next));
                    }
                  }}
                >
                  <option value="">Sin asignar</option>
                  {sortPeople(humansOnly(people))
                    .filter((p) => p.id === m.personId || !members.some((o) => o.personId === p.id))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {fullName(p)}
                      </option>
                    ))}
                </select>
              ) : (
                m.personId &&
                personById(m.personId) && <span className={styles.itemMeta}>{fullName(personById(m.personId)!)}</span>
              )}
            </div>
            {isOwner && m.role !== 'owner' && (
              <div className={styles.itemActions}>
                <Button
                  small
                  variant="ghost"
                  disabled={pending}
                  onClick={() => act(() => repository.setMemberRole(channel.id, m.userId, m.role === 'admin' ? 'member' : 'admin'))}
                >
                  {m.role === 'admin' ? 'Quitar admin' : 'Hacer admin'}
                </Button>
                <Button
                  small
                  variant="ghost"
                  disabled={pending}
                  onClick={() => {
                    if (confirmAction(`¿Expulsar a ${m.displayName} del canal?`)) void act(() => repository.removeMember(channel.id, m.userId));
                  }}
                >
                  Expulsar
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

/** The owner hands the channel over (and stays as an admin). */
function TransferSection() {
  const { snapshot, reload } = useChannel();
  const { channel, me, members } = snapshot;
  const { run, pending, error } = useAction();
  const others = members
    .filter((m) => m.userId !== me.userId)
    .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.displayName.localeCompare(b.displayName, 'es'));
  const [userId, setUserId] = useState(others[0]?.userId ?? '');
  const target = others.find((m) => m.userId === userId);

  return (
    <>
      <p className={ui.muted}>
        La otra persona pasará a ser la creadora: gestionará el canal y aprobará el contenido. Tú seguirás como
        administrador. Es necesario para salir del canal o borrar tu cuenta.
      </p>
      <Field label="A quién" htmlFor="transfer-to">
        <select id="transfer-to" className={ui.input} value={userId} onChange={(e) => setUserId(e.target.value)}>
          {others.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.displayName} ({ROLE_LABELS[m.role].toLowerCase()})
            </option>
          ))}
        </select>
      </Field>
      <ErrorBanner message={error} />
      <div>
        <Button
          variant="primary"
          disabled={pending || !target}
          onClick={() => {
            if (!target || !confirmAction(`¿Ceder «${channel.name}» a ${target.displayName}? No podrás deshacerlo tú.`)) return;
            void run(async () => {
              await repository.transferOwnership(channel.id, target.userId);
              await reload();
            });
          }}
        >
          Ceder el canal
        </Button>
      </div>
    </>
  );
}

function InvitationsSection() {
  const { snapshot, reload, personById } = useChannel();
  const { channel, members, people } = snapshot;
  const { run, pending, error } = useAction();
  const [days, setDays] = useState<number>(7);
  // Only people who aren't a member yet can be invited.
  const linked = new Set(members.map((m) => m.personId).filter(Boolean));
  // Only living people who aren't members yet.
  const candidates = sortPeople(humansOnly(people)).filter((p) => !linked.has(p.id) && !p.deathDate);
  const [personId, setPersonId] = useState('');
  const forPerson = candidates.some((p) => p.id === personId) ? personId : (candidates[0]?.id ?? '');
  const [created, setCreated] = useState<Invitation | null>(null);
  const [copied, setCopied] = useState(false);
  const [now] = useState(() => new Date().toISOString());
  const nameOf = (userId?: string) => members.find((m) => m.userId === userId)?.displayName ?? 'alguien que ya no está';
  const list = [...snapshot.invitations].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <>
      <div className={styles.create}>
        {candidates.length === 0 ? (
          <p className={ui.muted}>
            Todas las personas del canal ya son miembros. Para invitar a alguien nuevo, añádelo antes en{' '}
            <Link to={`/c/${channel.id}/personas/nueva`}>Personas</Link>.
          </p>
        ) : (
          <Field label="Para quién es" htmlFor="invite-person">
            <select id="invite-person" className={ui.input} value={forPerson} onChange={(e) => setPersonId(e.target.value)}>
              {candidates.map((p) => (
                <option key={p.id} value={p.id}>
                  {fullName(p)}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Caducidad" htmlFor="expiry">
          <select id="expiry" className={ui.input} value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {EXPIRY_OPTIONS_DAYS.map((d) => (
              <option key={d} value={d}>
                {d === 1 ? '24 horas' : `${d} días`}
              </option>
            ))}
          </select>
        </Field>
        <Button
          variant="primary"
          disabled={pending || !forPerson}
          onClick={async () => {
            setCopied(false);
            const invitation = await run(() => repository.createInvitation(channel.id, days, forPerson));
            if (invitation) {
              setCreated(invitation);
              await reload();
            }
          }}
        >
          Generar invitación
        </Button>
        {created && (
          <div className={styles.code}>
            <code>{created.code}</code>
            <Button
              small
              onClick={async () => {
                const result = await shareText(
                  `Invitación a ${channel.name}`,
                  `Únete a «${channel.name}» en Raíces con este código: ${created.code}`,
                );
                setCopied(result === 'copied');
              }}
            >
              {copied ? 'Copiado' : 'Compartir'}
            </Button>
          </div>
        )}
      </div>
      <ErrorBanner message={error} />
      {list.length > 0 && (
        <ul className={styles.list}>
          {list.map((inv) => {
            const status = invitationStatus(inv, now);
            return (
              <li key={inv.id} className={styles.item}>
                <div className={styles.itemBody}>
                  <code className={styles.smallCode}>{inv.code}</code>
                  {inv.personId && personById(inv.personId) && (
                    <span className={styles.itemMeta}>Para {fullName(personById(inv.personId)!)}</span>
                  )}
                  <span className={styles.itemMeta}>
                    <span className={[styles.status, styles[status]].join(' ')}>{STATUS_LABELS[status]}</span>
                    {' · '}
                    {status === 'used' && inv.usedAt
                      ? `usada por ${nameOf(inv.usedBy)} el ${dateTime(inv.usedAt)}`
                      : status === 'revoked' && inv.revokedAt
                        ? `revocada el ${dateTime(inv.revokedAt)}`
                        : `${status === 'expired' ? 'caducó' : 'caduca'} el ${dateTime(inv.expiresAt)}`}
                    {` · creada por ${nameOf(inv.createdBy)}`}
                  </span>
                </div>
                {status === 'active' && (
                  <Button
                    small
                    variant="ghost"
                    disabled={pending}
                    onClick={() =>
                      run(async () => {
                        await repository.revokeInvitation(channel.id, inv.id);
                        if (created?.id === inv.id) setCreated(null);
                        await reload();
                      })
                    }
                  >
                    Revocar
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function LeaveSection() {
  const { snapshot } = useChannel();
  const navigate = useNavigate();
  const { run, pending, error } = useAction();
  const alone = snapshot.members.length === 1;
  const mustHandOver = snapshot.me.role === 'owner' && !alone;

  return (
    <>
      <p className={ui.muted}>
        {alone
          ? 'Eres el único miembro: si sales, el canal y todos sus recuerdos se borrarán.'
          : mustHandOver
            ? 'Eres el creador del canal: cédelo a otro miembro antes de salir («Ceder el canal»).'
            : 'Dejarás de ver sus recuerdos. Para volver necesitarás una nueva invitación.'}
      </p>
      <ErrorBanner message={error} />
      <div>
        <Button
          variant="danger"
          disabled={pending || mustHandOver}
          onClick={async () => {
            if (!confirmAction(alone ? '¿Salir y borrar el canal definitivamente?' : '¿Salir del canal?')) return;
            const done = await run(async () => {
              await repository.leaveChannel(snapshot.channel.id);
              return true;
            });
            if (done) navigate('/', { replace: true });
          }}
        >
          Salir del canal
        </Button>
      </div>
    </>
  );
}

/**
 * The owner: delete the channel for good. Two safety steps: typing the channel's
 * exact name, then a last confirmation.
 */
function DeleteChannelSection() {
  const { snapshot } = useChannel();
  const navigate = useNavigate();
  const { run, pending, error } = useAction();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const name = snapshot.channel.name;
  const matches = typed.trim() === name.trim();

  return (
    <>
      <p className={ui.muted}>
        Se borrará para siempre para todos sus miembros: vídeos, fotos subidas, cromos, personas, fechas y el árbol.
        Los vídeos que estén en Google Drive o YouTube no se tocan allí; solo desaparecen sus enlaces.
      </p>
      {!open ? (
        <div>
          <Button variant="danger" onClick={() => setOpen(true)}>
            Eliminar el canal…
          </Button>
        </div>
      ) : (
        <div className={styles.confirmBox}>
          <Field label={`Escribe «${name}» para confirmar`} htmlFor="confirm-delete">
            <input
              id="confirm-delete"
              className={ui.input}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
            />
          </Field>
          <ErrorBanner message={error} />
          <div className={ui.formActions}>
            <Button variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              disabled={!matches || pending}
              onClick={async () => {
                if (!confirmAction(`Última confirmación: ¿eliminar «${name}» para siempre? No se puede deshacer.`)) return;
                const done = await run(async () => {
                  await repository.deleteChannel(snapshot.channel.id);
                  return true;
                });
                if (done) navigate('/', { replace: true });
              }}
            >
              {pending ? 'Eliminando…' : 'Eliminar para siempre'}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
