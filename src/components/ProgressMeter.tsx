import type { AlbumProgress } from '../utils/album';
import styles from './ProgressMeter.module.scss';

/** Unlocked / total, real percentage and a bar. */
export function ProgressMeter({ progress, compact }: { progress: AlbumProgress; compact?: boolean }) {
  const { unlocked, total, percent } = progress;
  return (
    <div className={[styles.meter, compact ? styles.compact : ''].join(' ')}>
      <div className={styles.numbers}>
        <span>
          <b>{unlocked}</b> / {total} {compact ? '' : total === 1 ? 'cromo desbloqueado' : 'cromos desbloqueados'}
        </span>
        <b className={styles.percent}>{percent} %</b>
      </div>
      <div
        className={styles.bar}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={unlocked}
        aria-valuetext={`${unlocked} de ${total} (${percent} %)`}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
