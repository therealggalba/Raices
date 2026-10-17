import { describe, expect, it } from 'vitest';
import {
  normalizeEmail,
  normalizeOtp,
  parseLogin,
  passwordError,
  signUpErrors,
  usernameError,
} from '../auth/account';
import { authErrorMessage } from '../auth/authErrors';

describe('account rules', () => {
  it('accepts usernames like the database does', () => {
    expect(usernameError('Ana.Montero')).toBeNull();
    expect(usernameError('ab')).toMatch(/entre 3 y 20/);
    expect(usernameError('ana montero')).toMatch(/solo puede/);
    expect(usernameError('añoro')).toMatch(/solo puede/);
  });

  it('requires 8+ characters mixing letters and numbers', () => {
    expect(passwordError('corto1')).toMatch(/al menos 8/);
    expect(passwordError('solamenteletras')).toMatch(/letras y números/);
    expect(passwordError('12345678')).toMatch(/letras y números/);
    expect(passwordError('álbum2026')).toBeNull();
    expect(passwordError('a1'.repeat(40))).toMatch(/demasiado larga/);
  });

  it('lists every problem of the sign-up form', () => {
    expect(signUpErrors({ username: 'ana', email: 'ana@example.com', password: 'clave2026', repeat: 'clave2026' })).toEqual([]);
    expect(signUpErrors({ username: 'a', email: 'x', password: 'clave2026', repeat: 'otra2026' })).toEqual([
      'El usuario debe tener entre 3 y 20 caracteres',
      'Escribe un correo electrónico válido',
      'Las contraseñas no coinciden',
    ]);
  });

  it('tells usernames and emails apart when signing in', () => {
    expect(parseLogin(' Ana.Montero ')).toEqual({ kind: 'username', username: 'ana.montero' });
    expect(parseLogin('Ana@Example.com')).toEqual({ kind: 'email', email: 'ana@example.com' });
    expect(parseLogin('ana@')).toBeNull();
    expect(parseLogin('a b')).toBeNull();
  });

  it('normalizes emails and codes', () => {
    expect(normalizeEmail('  Ana@Example.COM ')).toBe('ana@example.com');
    expect(normalizeEmail(`${'a'.repeat(250)}@x.com`)).toBeNull();
    expect(normalizeOtp('123 456')).toBe('123456');
    expect(normalizeOtp('12345')).toBeNull();
  });
});

describe('authErrorMessage', () => {
  it('maps the usual Supabase Auth errors', () => {
    expect(authErrorMessage({ code: 'invalid_credentials', message: 'Invalid login credentials' }, 'login')).toBe(
      'Usuario o contraseña incorrectos.',
    );
    expect(authErrorMessage({ status: 429, message: 'email rate limit exceeded' }, 'send')).toMatch(/Demasiados/);
    expect(authErrorMessage({ code: 'otp_expired', message: 'Token has expired or is invalid' }, 'verify')).toMatch(
      /no es correcto/,
    );
    expect(authErrorMessage({ code: 'weak_password', message: 'Password should be at least 8 characters' }, 'signup')).toMatch(
      /débil/,
    );
  });

  it('tells email delivery problems apart from taken usernames', () => {
    expect(authErrorMessage({ status: 500, message: 'Error sending confirmation email' }, 'signup')).toMatch(/enviar el correo/);
    expect(authErrorMessage({ status: 500, message: 'Database error saving new user' }, 'signup')).toMatch(/no está disponible/);
  });

  it('never shows raw server text', () => {
    expect(authErrorMessage({ status: 500, message: 'Database error saving new user' }, 'signup')).not.toMatch(/database/i);
    expect(authErrorMessage({ status: 500, message: 'Error sending confirmation email: smtp 535' }, 'send')).not.toMatch(/smtp/i);
    expect(authErrorMessage({ status: 500, message: 'unexpected failure 0x1' }, 'signup')).not.toMatch(/0x1/);
  });
});
