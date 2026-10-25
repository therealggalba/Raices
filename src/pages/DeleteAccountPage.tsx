import { useEffect, useState } from 'react';
import { useAuth } from '../auth/auth-context';
import { Button, ErrorBanner, Field, LinkButton, Spinner } from '../components/ui';
import { ui } from '../components/ui-styles';
import { useAction } from '../hooks/useAction';
import { confirmAction } from '../hooks/useConfirm';
import { repository } from '../services';
import { errorMessage } from '../services/repository';
import type { AccountDeletionPlan } from '../types/domain';
import styles from './DeleteAccountPage.module.scss';

const WORD = 'ELIMINAR';

/**
 * Delete one's account for good. It first says what happens to each channel
 * and asks for three things: typing ELIMINAR, ticking that it can't be
 * undone, and a last confirmation.
 */
export function DeleteAccountPage() {
  const { email } = useAuth();
  const [plan, setPlan] = useState<AccountDeletionPlan | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [understood, setUnderstood] = useState(false);
  const { run, pending, error } = useAction();

  useEffect(() => {
    repository.accountDeletionPlan().then(setPlan, (e: unknown) => setLoadError(errorMessage(e)));
  }, []);

  if (loadError) return <ErrorBanner message={loadError} />;
  if (!plan) return <Spinner />;
  const blocked = plan.blocked.length > 0;
  const ready = !blocked && typed.trim().toUpperCase() === WORD && understood;

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1>Eliminar mi cuenta</h1>
        <LinkButton to="/" variant="ghost" small>
          Cancelar
        </LinkButton>
      </div>
      <p>
        Se borrará para siempre tu cuenta
        {email && (
          <>
            {' '}
            <strong>{email}</strong>
          </>
        )}
        : tu usuario, tu perfil, tus favoritos, lo que
        llevabas visto y tus cromos conseguidos. No se puede deshacer.
      </p>

      {plan.deleted.length > 0 && (
        <section className={styles.block}>
          <h2>Canales que se eliminan contigo</h2>
          <p className={ui.muted}>Eres su único miembro: desaparecen con todos sus vídeos, fotos y cromos.</p>
          <ul>
            {plan.deleted.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>
      )}
      {plan.left.length > 0 && (
        <section className={styles.block}>
          <h2>Canales que abandonas</h2>
          <p className={ui.muted}>Siguen existiendo para los demás, con lo que subiste.</p>
          <ul>
            {plan.left.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>
      )}
      {blocked && (
        <section className={[styles.block, styles.blocked].join(' ')}>
          <h2>Antes tienes que hacer algo</h2>
          <p>
            Eres el creador de estos canales, que tienen más miembros. Cédelos a otra persona en Canal › Ceder el canal y
            vuelve aquí:
          </p>
          <ul>
            {plan.blocked.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>
      )}

      {!blocked && (
        <form
          className={[ui.form, styles.confirm].join(' ')}
          onSubmit={async (e) => {
            e.preventDefault();
            if (!ready || !confirmAction('Última confirmación: ¿eliminar tu cuenta para siempre?')) return;
            // On success the session ends and the app goes back to the login screen.
            await run(async () => {
              await repository.deleteAccount();
              return true;
            });
          }}
        >
          <Field label={`Escribe ${WORD} para confirmar`} htmlFor="confirm-word">
            <input
              id="confirm-word"
              className={ui.input}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
            />
          </Field>
          <label className={styles.check}>
            <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
            Entiendo que se borra para siempre y no se puede recuperar
          </label>
          <ErrorBanner message={error} />
          <Button type="submit" variant="danger" disabled={!ready || pending}>
            {pending ? 'Eliminando…' : 'Eliminar mi cuenta para siempre'}
          </Button>
        </form>
      )}
    </div>
  );
}
