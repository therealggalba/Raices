// The app's look follows the season of the real calendar (northern
// hemisphere, astronomical dates rounded to the usual days).

export const SEASONS = ['primavera', 'verano', 'otono', 'invierno'] as const;
export type Season = (typeof SEASONS)[number];

/** Spring from 20 March, summer from 21 June, autumn from 23 September, winter from 21 December. */
export function seasonOf(date: Date): Season {
  const md = (date.getMonth() + 1) * 100 + date.getDate();
  if (md >= 1221 || md < 320) return 'invierno';
  if (md < 621) return 'primavera';
  if (md < 923) return 'verano';
  return 'otono';
}

/** Puts the current season on <html> (the CSS picks its colours). */
export function applySeason(now: Date = new Date()): Season {
  const season = seasonOf(now);
  document.documentElement.dataset.season = season;
  return season;
}
