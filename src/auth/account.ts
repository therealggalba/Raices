// Account form rules (same as the database: supabase/migrations/0002_usernames.sql).

export const USERNAME_RE = /^[a-z0-9._]{3,20}$/;
export const PASSWORD_MIN = 8;
/** bcrypt only uses the first 72 bytes. */
export const PASSWORD_MAX = 72;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function usernameError(value: string): string | null {
  const name = normalizeUsername(value);
  if (name.length < 3 || name.length > 20) return 'El usuario debe tener entre 3 y 20 caracteres';
  if (!USERNAME_RE.test(name)) return 'El usuario solo puede llevar letras sin tildes, números, punto y guion bajo';
  return null;
}

export function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  return email.length <= 254 && EMAIL_RE.test(email) ? email : null;
}

export function passwordError(value: string): string | null {
  if (value.length < PASSWORD_MIN) return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`;
  if (new TextEncoder().encode(value).length > PASSWORD_MAX) return 'La contraseña es demasiado larga';
  if (!/\p{L}/u.test(value) || !/\d/.test(value)) return 'La contraseña debe combinar letras y números';
  return null;
}

/** Digits only; null unless it looks like a whole code (6 digits by default, up to 10). */
export function normalizeOtp(value: string): string | null {
  const code = value.replace(/\D/g, '');
  return code.length >= 6 && code.length <= 10 ? code : null;
}

export interface SignUpForm {
  username: string;
  email: string;
  password: string;
  repeat: string;
}

/** Every problem of the sign-up form (empty = ready to send). */
export function signUpErrors(form: SignUpForm): string[] {
  const errors: string[] = [];
  const user = usernameError(form.username);
  if (user) errors.push(user);
  if (!normalizeEmail(form.email)) errors.push('Escribe un correo electrónico válido');
  const pass = passwordError(form.password);
  if (pass) errors.push(pass);
  else if (form.password !== form.repeat) errors.push('Las contraseñas no coinciden');
  return errors;
}

/** "Usuario o correo" field of the login form. */
export function parseLogin(value: string): { kind: 'email'; email: string } | { kind: 'username'; username: string } | null {
  if (value.includes('@')) {
    const email = normalizeEmail(value);
    return email ? { kind: 'email', email } : null;
  }
  const username = normalizeUsername(value);
  return USERNAME_RE.test(username) ? { kind: 'username', username } : null;
}
