import { PACK_SIZE, PACKS_PER_DAY } from '../types/domain';
import type { IsoDate, PackOpening, PackStatus } from '../types/domain';

// Card packs (sobres): PACKS_PER_DAY per user and local day, across all
// albums; each pack holds PACK_SIZE cromos of its channel, every cromo with
// the same odds (no rarities).

/** Uniform random integer in [0, max) from a [0, 1) source. */
export type RandomFn = () => number;

/** Crypto-backed uniform [0, 1). */
export const cryptoRandom: RandomFn = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

/**
 * Draws a pack. Every cromo has the same probability. Within one pack a
 * cromo is not repeated when the channel has enough of them (draw without
 * replacement); small albums repeat. Duplicates across packs are normal.
 */
export function drawPack<T>(pool: readonly T[], random: RandomFn = cryptoRandom, size = PACK_SIZE): T[] {
  if (pool.length === 0) return [];
  if (pool.length < size) return Array.from({ length: size }, () => pool[Math.floor(random() * pool.length)]);
  const bag = [...pool];
  const out: T[] = [];
  for (let i = 0; i < size; i++) {
    const j = Math.floor(random() * bag.length);
    out.push(bag[j]);
    bag.splice(j, 1);
  }
  return out;
}

export function packStatus(openings: readonly PackOpening[], userId: string, today: IsoDate): PackStatus {
  const openedToday = openings.filter((o) => o.userId === userId && o.date === today).length;
  return { perDay: PACKS_PER_DAY, openedToday, remaining: Math.max(0, PACKS_PER_DAY - openedToday) };
}

/** "Te quedan 2 sobres por abrir hoy" / "Ya has abierto tus 3 sobres de hoy". */
export function packStatusText({ remaining, perDay }: PackStatus): string {
  if (remaining === 0) return `Ya has abierto tus ${perDay} sobres de hoy. Mañana tendrás ${perDay} más.`;
  return remaining === 1 ? 'Te queda 1 sobre por abrir hoy' : `Te quedan ${remaining} sobres por abrir hoy`;
}
