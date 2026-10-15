import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LinkProps } from 'react-router-dom';
import { ui as styles } from './ui-styles';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'play';

interface StyleProps {
  variant?: Variant;
  small?: boolean;
  block?: boolean;
}

function buttonClass({ variant = 'secondary', small, block }: StyleProps, extra?: string): string {
  return [styles.button, styles[variant], small && styles.small, block && styles.block, extra].filter(Boolean).join(' ');
}

export function Button({
  variant,
  small,
  block,
  className,
  type = 'button',
  ...rest
}: StyleProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={buttonClass({ variant, small, block }, className)} {...rest} />;
}

export function LinkButton({ variant, small, block, className, ...rest }: StyleProps & LinkProps) {
  return <Link className={buttonClass({ variant, small, block }, className)} {...rest} />;
}

export function Spinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className={styles.spinner} role="status">
      <span className={styles.spinnerDot} aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ icon = '🎞️', children }: { icon?: string; children: ReactNode }) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon} aria-hidden>
        {icon}
      </span>
      {children}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className={styles.error} role="alert">
      {message}
    </p>
  );
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}
