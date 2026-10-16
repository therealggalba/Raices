import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, ErrorBanner, Field } from '../components/ui';
import { ui } from '../components/ui-styles';
import { useChannel } from '../hooks/channel-context';
import { useAction } from '../hooks/useAction';
import { confirmAction } from '../hooks/useConfirm';
import { repository } from '../services';
import { CHANNEL_KINDS } from '../types/domain';
import type { ChannelKind, Invitation, Member } from '../types/domain';
import { EXPIRY_OPTIONS_DAYS, STATUS_LABELS, invitationStatus } from '../utils/invitations';
import { CHANNEL_KIND_LABELS, ROLE_LABELS } from '../utils/labels';
import styles from './ChannelSettingsPage.module.scss';

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Channel info, members and invitations (admins manage; members can only leave). */
export function ChannelSettingsPage() {
  const { snapshot, isAdmin } = useChannel();
  const { channel, me, members } = snapshot;

  return (
    <div className={ui.page}>
      <h1>{channel.name}</h1>
      {isAdmin ? <ChannelInfoForm /> : channel.description && <p className={styles.text}>{channel.description}</p>}
      <MembersSection />
      {isAdmin && <InvitationsSection />}
      <LeaveSection lastAdmin={me.role === 'admin' && members.filter((m) => m.role === 'admin').length === 1} />
    </div>
  );
}

function ChannelInfoForm() {
  const { snapshot, reload } = useChannel();
  const { channel } = snapshot;
  const { run, pending, error } = useAction();
  const [name, setName] = useState(channel.name);
  const [description, setDescription] = useState(channel.description);
  const [kind, setKind] = useState<ChannelKind>(channel.kind);
  const [coverUrl, setCoverUrl] = useState(channel.coverUrl ?? '');
  const [saved, setSaved] = useState(false);

  return (
    <form
      className={[ui.form, ui.card].join(' ')}
      onSubmit={async (e) => {
        e.preventDefault();
        setSaved(false);
        const done = await run(async () => {
          await repository.updateChannel(channel.id, { name, description, kind, ...(coverUrl.trim() ? { coverUrl } : {}) });
          return true;
        });
        if (done) {
          await reload();
          setSaved(true);
        }
      }}
    >
      <h2>Datos del canal</h2>
      <Field label="Nombre" htmlFor="name">
        <input id="name" className={ui.input} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
      </Field>
      <Field label="Tipo de canal" htmlFor="kind" hint="Inicio solo mezcla en una misma fila vídeos de canales del mismo tipo">
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
      <Field label="Portada (opcional)" htmlFor="coverUrl" hint="Enlace https a una imagen">
        <input id="coverUrl" className={ui.input} type="url" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://" />
      </Field>
      <ErrorBanner message={error} />
      <div className={ui.formActions}>
        {saved && <span className={styles.saved}>✓ Guardado</span>}
        <Button type="submit" variant="primary" disabled={pending}>
          Guardar
        </Button>
      </div>
    </form>
  );
}

function MembersSection() {
  const { snapshot, isAdmin, reload } = useChannel();
  const { channel, me, members, invitations } = snapshot;
  const { run, pending, error } = useAction();
  const sorted = [...members].sort((a, b) => (a.role === b.role ? a.displayName.localeCompare(b.displayName, 'es') : a.role === 'admin' ? -1 : 1));

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
    <section className={ui.section}>
      <h2>Miembros ({members.length})</h2>
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
                {isAdmin && joinedVia(m)}
              </span>
            </div>
            {isAdmin && m.userId !== me.userId && (
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
    </section>
  );
}

function InvitationsSection() {
  const { snapshot, reload } = useChannel();
  const { channel, members } = snapshot;
  const { run, pending, error } = useAction();
  const [days, setDays] = useState<number>(7);
  const [created, setCreated] = useState<Invitation | null>(null);
  const [copied, setCopied] = useState(false);
  const [now] = useState(() => new Date().toISOString());
  const nameOf = (userId?: string) => members.find((m) => m.userId === userId)?.displayName ?? 'alguien que ya no está';
  const list = [...snapshot.invitations].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <section className={ui.section}>
      <h2>Invitaciones</h2>
      <p className={ui.muted}>Cada código sirve para una sola persona y caduca. Compártelo por un canal privado.</p>
      <div className={[ui.card, styles.create].join(' ')}>
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
          disabled={pending}
          onClick={async () => {
            setCopied(false);
            const invitation = await run(() => repository.createInvitation(channel.id, days));
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
                try {
                  await navigator.clipboard.writeText(created.code);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? '✓ Copiado' : 'Copiar'}
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
    </section>
  );
}

function LeaveSection({ lastAdmin }: { lastAdmin: boolean }) {
  const { snapshot } = useChannel();
  const navigate = useNavigate();
  const { run, pending, error } = useAction();
  const alone = snapshot.members.length === 1;

  return (
    <section className={ui.section}>
      <h2>Salir del canal</h2>
      <p className={ui.muted}>
        {alone
          ? 'Eres el único miembro: si sales, el canal y todos sus recuerdos se borrarán.'
          : lastAdmin
            ? 'Eres el único administrador: nombra a otro antes de salir.'
            : 'Dejarás de ver sus recuerdos. Para volver necesitarás una nueva invitación.'}
      </p>
      <ErrorBanner message={error} />
      <div>
        <Button
          variant="danger"
          disabled={pending || (lastAdmin && !alone)}
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
    </section>
  );
}
