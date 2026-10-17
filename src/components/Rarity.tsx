import type { Rarity } from '../types/domain';
import { RARITY_LABELS, RARITY_STARS } from '../utils/labels';
import styles from './Rarity.module.scss';

/** ★ x n, or a crown for legendary cromos (as in the original Android app). */
export function RarityMark({ rarity, size = 'md' }: { rarity: Rarity; size?: 'sm' | 'md' }) {
  const stars = RARITY_STARS[rarity];
  return (
    <span className={[styles.mark, styles[size]].join(' ')} title={RARITY_LABELS[rarity]} aria-label={RARITY_LABELS[rarity]}>
      {stars === 0 ? '👑' : '★'.repeat(stars)}
    </span>
  );
}
