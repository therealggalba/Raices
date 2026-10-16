import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, ErrorBanner, Field, LinkButton } from '../components/ui';
import { ui } from '../components/ui-styles';
import { useAction } from '../hooks/useAction';
import { repository } from '../services';
import { CHANNEL_KINDS } from '../types/domain';
import type { ChannelKind } from '../types/domain';
import { CHANNEL_KIND_LABELS } from '../utils/labels';

export function NewChannelPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<ChannelKind>('familia');
  const { run, pending, error } = useAction();

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1>Crear canal</h1>
        <LinkButton to="/" variant="ghost" small>
          Cancelar
        </LinkButton>
      </div>
      <p className={ui.muted}>Serás su administrador: podrás añadir vídeos, personas y eventos e invitar a otros.</p>
      <form
        className={[ui.form, ui.card].join(' ')}
        onSubmit={async (e) => {
          e.preventDefault();
          const id = await run(() => repository.createChannel({ name, description, kind }));
          if (id) navigate(`/c/${id}`);
        }}
      >
        <Field label="Nombre" htmlFor="name">
          <input
            id="name"
            className={ui.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej.: Familia Rodríguez"
            maxLength={80}
            required
          />
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
          <textarea
            id="description"
            className={ui.input}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
          />
        </Field>
        <ErrorBanner message={error} />
        <div className={ui.formActions}>
          <Button type="submit" variant="primary" disabled={pending}>
            Crear canal
          </Button>
        </div>
      </form>
    </div>
  );
}
