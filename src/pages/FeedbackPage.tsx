import { useState } from 'react';
import { Button, ErrorBanner, Field, LinkButton } from '../components/ui';
import { ui } from '../components/ui-styles';
import { useAction } from '../hooks/useAction';
import { repository } from '../services';
import { LIMITS } from '../../supabase/functions/send-feedback/screen';

/** A suggestion or a problem, straight to the app's author. */
export function FeedbackPage() {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const { run, pending, error } = useAction();

  if (sent) {
    return (
      <div className={ui.page}>
        <h1>¡Gracias!</h1>
        <p className={ui.muted}>Tu sugerencia ha llegado. La leeremos con calma.</p>
        <LinkButton to="/" variant="primary">
          Volver al inicio
        </LinkButton>
      </div>
    );
  }

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1>Enviar una sugerencia</h1>
        <LinkButton to="/" variant="ghost" small>
          Cancelar
        </LinkButton>
      </div>
      <p className={ui.muted}>Ideas, fallos o cualquier cosa que mejoraría la app.</p>
      <form
        className={ui.form}
        onSubmit={async (e) => {
          e.preventDefault();
          const done = await run(async () => {
            await repository.sendFeedback(subject, message);
            return true;
          });
          if (done) setSent(true);
        }}
      >
        <Field label="Asunto" htmlFor="subject">
          <input
            id="subject"
            className={ui.input}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            minLength={LIMITS.subjectMin}
            maxLength={LIMITS.subjectMax}
            required
          />
        </Field>
        <Field label="Mensaje" htmlFor="message">
          <textarea
            id="message"
            className={ui.input}
            rows={8}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            minLength={LIMITS.messageMin}
            maxLength={LIMITS.messageMax}
            required
          />
        </Field>
        <ErrorBanner message={error} />
        <div className={ui.formActions}>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? 'Enviando…' : 'Enviar'}
          </Button>
        </div>
      </form>
    </div>
  );
}
