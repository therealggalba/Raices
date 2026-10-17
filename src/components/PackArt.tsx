import type { CSSProperties } from 'react';
import type { PackTheme } from '../types/domain';
import { PACK_LOOKS } from './pack-looks';
import styles from './PackArt.module.scss';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

interface Props {
  theme: PackTheme;
  /** Edition name printed on the pack (the channel name). */
  title: string;
  className?: string;
  style?: CSSProperties;
}

/** A card pack, styled after Pokémon TCG Pocket boosters (original artwork). */
export function PackArt({ theme, title, className, style }: Props) {
  const look = PACK_LOOKS[theme];
  return (
    <div
      className={[styles.pack, className].filter(Boolean).join(' ')}
      style={{ ...style, ['--band' as string]: look.band, ['--art' as string]: look.art, ['--accent' as string]: look.accent }}
      role="img"
      aria-label={`Sobre de cromos de ${title} (diseño ${look.label})`}
    >
      <div className={[styles.band, styles.top].join(' ')}>
        <span className={styles.logo}>
          <span aria-hidden>▶</span> FamilyMemories
        </span>
        <span className={styles.code}>{initials(title)}</span>
      </div>
      <div className={styles.art}>
        <span className={styles.motif} aria-hidden>
          {Array.from({ length: 40 }, () => look.motif).join(' ')}
        </span>
        <span className={styles.emblem} aria-hidden>
          {look.emblem}
        </span>
        <div className={styles.titleBox}>
          <span className={styles.kicker}>Sobre de recuerdos</span>
          <span className={styles.title}>{title}</span>
          <span className={styles.count}>5 cromos</span>
        </div>
      </div>
      <div className={[styles.band, styles.bottom].join(' ')} />
      <span className={styles.shine} aria-hidden />
    </div>
  );
}
