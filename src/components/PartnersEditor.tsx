import type { Person } from '../types/domain';
import type { PartnerRow } from '../utils/familyTree';
import { fullName } from '../utils/people';
import { Button } from './ui';
import { ui } from './ui-styles';
import styles from './PartnersEditor.module.scss';

interface Props {
  /** Who can be a partner (people of the channel, not this person). */
  candidates: Person[];
  rows: PartnerRow[];
  onChange(rows: PartnerRow[]): void;
}

/** The person form's «Pareja» section: couples with their wedding and separation dates. */
export function PartnersEditor({ candidates, rows, onChange }: Props) {
  const used = new Set(rows.map((r) => r.partnerId));
  const set = (i: number, patch: Partial<PartnerRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const free = candidates.filter((p) => !used.has(p.id));

  return (
    <fieldset className={styles.box}>
      <legend>Pareja</legend>
      {rows.map((row, i) => {
        const partner = candidates.find((p) => p.id === row.partnerId);
        return (
          <div key={row.id ?? `new-${i}`} className={styles.row}>
            {row.id && partner ? (
              <strong className="one-line">{fullName(partner)}</strong>
            ) : (
              <select
                className={ui.input}
                value={row.partnerId}
                onChange={(e) => set(i, { partnerId: e.target.value })}
                aria-label="Pareja"
                required
              >
                <option value="">Elige a la pareja</option>
                {candidates
                  .filter((p) => p.id === row.partnerId || !used.has(p.id))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {fullName(p)}
                    </option>
                  ))}
              </select>
            )}
            <div className={styles.dates}>
              <label>
                <span className="one-line">Boda o inicio</span>
                <input className={ui.input} type="date" value={row.since} onChange={(e) => set(i, { since: e.target.value })} />
              </label>
              <label>
                <span className="one-line">Separación</span>
                <input
                  className={ui.input}
                  type="date"
                  value={row.until}
                  min={row.since || undefined}
                  onChange={(e) => set(i, { until: e.target.value })}
                />
              </label>
            </div>
            <Button small variant="ghost" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
              Quitar
            </Button>
          </div>
        );
      })}
      {free.length > 0 && (
        <Button small onClick={() => onChange([...rows, { partnerId: '', since: '', until: '' }])}>
          Añadir pareja
        </Button>
      )}
    </fieldset>
  );
}
