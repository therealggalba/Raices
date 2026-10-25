import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, ErrorBanner, Field, LinkButton } from '../components/ui';
import { ui } from '../components/ui-styles';
import { useAction } from '../hooks/useAction';
import { repository } from '../services';

/** Redeem a single-use invitation code to join a channel. */
export function JoinPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const { run, pending, error } = useAction();

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1>Unirme a un canal</h1>
        <LinkButton to="/" variant="ghost" small>
          Cancelar
        </LinkButton>
      </div>
      <p className={ui.muted}>
        Escribe el código que te ha dado el creador del canal.
      </p>
      <form
        className={[ui.form, ui.card].join(' ')}
        onSubmit={async (e) => {
          e.preventDefault();
          const channelId = await run(() => repository.redeemInvitation(code, name));
          if (channelId) navigate(`/c/${channelId}`);
        }}
      >
        <Field label="Código de invitación" htmlFor="code" hint="Formato XXXX-XXXX-XXXX">
          <input
            id="code"
            className={ui.input}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={20}
            required
            style={{ letterSpacing: '0.15em', textTransform: 'uppercase' }}
          />
        </Field>
        <Field label="Cómo te verán en el canal" htmlFor="name">
          <input
            id="name"
            className={ui.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            placeholder="Ej.: Tía Rosa"
            required
          />
        </Field>
        <ErrorBanner message={error} />
        <div className={ui.formActions}>
          <Button type="submit" variant="primary" disabled={pending}>
            Unirme
          </Button>
        </div>
      </form>
    </div>
  );
}
