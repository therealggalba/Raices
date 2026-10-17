/**
 * Provisional app mark (orange rounded square with a play triangle) until the
 * final logo is chosen.
 */
export function BrandMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 32 32" aria-hidden focusable="false">
      <rect width="32" height="32" rx="8" fill="var(--accent, #e46c16)" />
      <path d="M13 10.5v11l9-5.5z" fill="#fff" />
    </svg>
  );
}
