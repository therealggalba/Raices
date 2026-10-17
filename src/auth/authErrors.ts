// Supabase Auth errors -> short Spanish messages (never raw server text).

export interface AuthErrorLike {
  status?: number;
  code?: string;
  message?: string;
}

export type AuthStep = 'login' | 'signup' | 'verify' | 'send' | 'reset';

export function authErrorMessage(error: AuthErrorLike, step: AuthStep): string {
  const code = error.code ?? '';
  const text = `${code} ${error.message ?? ''}`;
  if (error.status === 429 || /rate.?limit|too many|security purposes/i.test(text)) {
    return 'Demasiados intentos seguidos. Espera un minuto y vuelve a probar.';
  }
  if (/fetch|network/i.test(text)) return 'No hay conexión. Comprueba internet y vuelve a intentarlo.';
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(text)) {
    return 'Usuario o contraseña incorrectos.';
  }
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(text)) {
    return 'Todavía no has confirmado tu correo.';
  }
  if (code === 'user_already_exists' || code === 'email_exists' || /already registered/i.test(text)) {
    return 'Ese correo ya tiene una cuenta. Entra con ella o recupera la contraseña.';
  }
  if (code === 'weak_password' || /password should|weak password/i.test(text)) {
    return 'La contraseña es demasiado débil: usa al menos 8 caracteres con letras y números.';
  }
  if (/error sending .*email/i.test(text)) {
    return 'No se ha podido enviar el correo con el código. Inténtalo de nuevo más tarde.';
  }
  if (step === 'signup' && /database error saving new user/i.test(text)) {
    return 'Ese nombre de usuario no está disponible. Prueba con otro.';
  }
  if (code === 'same_password') return 'La nueva contraseña debe ser distinta de la anterior.';
  if ((step === 'verify' || step === 'reset') && (code === 'otp_expired' || /expired|invalid|token/i.test(text))) {
    return 'El código no es correcto o ha caducado. Revisa el último correo o pide uno nuevo.';
  }
  if (/email.*(invalid|not valid)|invalid.*email/i.test(text)) return 'Ese correo no parece válido.';
  switch (step) {
    case 'signup':
      return 'No se ha podido crear la cuenta. Prueba con otro nombre de usuario o inténtalo más tarde.';
    case 'send':
      return 'No se ha podido enviar el correo. Inténtalo de nuevo en un momento.';
    case 'login':
      return 'No se ha podido entrar. Inténtalo de nuevo.';
    default:
      return 'No se ha podido completar. Inténtalo de nuevo.';
  }
}
