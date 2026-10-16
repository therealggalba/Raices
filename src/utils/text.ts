/** Lowercase without accents, for accent-insensitive search ("Cádiz" ~ "cadiz"). */
export function foldText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
