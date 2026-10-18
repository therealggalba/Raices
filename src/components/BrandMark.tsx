/** The Raíces mark: a white tree with roots and a play button in its canopy, on the season's colour. */
export function BrandMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 100 100" aria-hidden focusable="false">
      <rect width="100" height="100" rx="22" fill="#e46c16" />
      <g transform="translate(50 51) scale(0.9) translate(-50 -51)">
        <g fill="#fff">
          <circle cx="50" cy="35" r="19" />
          <circle cx="33" cy="41" r="12.5" />
          <circle cx="67" cy="41" r="12.5" />
          <circle cx="40" cy="25" r="12" />
          <circle cx="60" cy="25" r="12" />
          <circle cx="50" cy="46" r="12" />
        </g>
        <path d="M46 52 C46.5 58 46 63 43.5 68 L56.5 68 C54 63 53.5 58 54 52 Z" fill="#fff" />
        <path d="M27 68 H73" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        <g fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M47 68 C45 74 38 76 31 81" />
          <path d="M48.5 68 C47.5 75 44 79 41.5 86" />
          <path d="M50 68 V89" />
          <path d="M51.5 68 C52.5 75 56 79 58.5 86" />
          <path d="M53 68 C55 74 62 76 69 81" />
        </g>
        <path d="M44.5 26 v18 l15-9 z" fill="var(--accent, #e46c16)" stroke="var(--accent, #e46c16)" strokeWidth="2.4" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
