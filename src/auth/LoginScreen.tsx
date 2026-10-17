import { useEffect, useState } from 'react';
import { BrandMark } from '../components/BrandMark';
import { Icon } from '../components/Icon';
import type { ComponentProps, FormEvent, ReactNode } from 'react';
import { Button, ErrorBanner } from '../components/ui';
import { ui } from '../components/ui-styles';
import { errorMessage } from '../services/repository';
import { getSupabase } from '../services/supabaseClient';
import { toRepositoryError } from '../services/supabaseMappers';
import {
  normalizeEmail,
  normalizeOtp,
  normalizeUsername,
  parseLogin,
  passwordError,
  signUpErrors,
  usernameError,
} from './account';
import { useAuth } from './auth-context';
import { authErrorMessage } from './authErrors';
import { rememberedLogin, setRememberedLogin } from './devicePrefs';
import styles from './LoginScreen.module.scss';

type Step = 'login' | 'signup' | 'verify' | 'forgot' | 'reset';

/** Seconds before another email can be requested. */
const RESEND_SECONDS = 60;

/**
 * Accounts: username + email + password. The email is confirmed once with a
 * 6-digit code when the account is created (typed here, no links: works the
 * same inside the Android app) and lets people reset a forgotten password.
 * The fictional demo is reachable from a discreet link at the bottom.
 */
export function LoginScreen() {
  const { enterDemo, stayOnLogin } = useAuth();
  const [step, setStep] = useState<Step>('login');
  const [login, setLogin] = useState(() => rememberedLogin() ?? '');
  const [remember, setRemember] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  // Username availability while signing up ('unknown' = couldn't check).
  const [available, setAvailable] = useState<'checking' | 'free' | 'taken' | 'unknown'>('checking');
  // Recovery: the code was accepted, only the new password is left to save.
  const [codeAccepted, setCodeAccepted] = useState(false);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  // Live "is this username free?" while signing up.
  useEffect(() => {
    if (step !== 'signup' || usernameError(username)) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const { data, error: failure } = (await getSupabase()?.rpc('username_available', {
        p_username: normalizeUsername(username),
      })) ?? { data: null, error: null };
      if (!cancelled) setAvailable(failure ? 'unknown' : data === true ? 'free' : 'taken');
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [step, username]);

  const go = (next: Step, message: string | null = null) => {
    setStep(next);
    setError(null);
    setNotice(message);
    setCode('');
    if (next !== 'reset') setCodeAccepted(false);
    if (next === 'login' || next === 'signup' || next === 'reset') {
      setPassword('');
      setRepeat('');
    }
  };

  /** Runs one request with the busy state and a friendly error. */
  const attempt = async (task: () => Promise<string | null | void>) => {
    setPending(true);
    setError(null);
    try {
      const failure = await task();
      if (failure) setError(failure);
    } catch {
      setError('No hay conexión. Comprueba internet y vuelve a intentarlo.');
    } finally {
      setPending(false);
    }
  };

  const client = getSupabase();
  if (!client) return null;

  const submitLogin = (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseLogin(login);
    if (!parsed || !password) {
      setError('Escribe tu usuario (o correo) y tu contraseña.');
      return;
    }
    void attempt(async () => {
      let address: string;
      if (parsed.kind === 'email') {
        address = parsed.email;
      } else {
        const { data, error: failure } = await client.rpc('login_email', {
          p_username: parsed.username,
          p_password: password,
        });
        if (failure) return errorMessage(toRepositoryError(failure));
        if (typeof data !== 'string' || !data) return 'Usuario o contraseña incorrectos.';
        address = data;
      }
      const { error: failure } = await client.auth.signInWithPassword({ email: address, password });
      if (!failure) {
        setRememberedLogin(remember ? login.trim() : null);
        return null; // the auth listener opens the app
      }
      if (failure.code === 'email_not_confirmed') {
        setEmail(address);
        go('verify', 'Antes de entrar, confirma tu correo con el código que te enviamos al crear la cuenta.');
        return null;
      }
      return authErrorMessage(failure, 'login');
    });
  };

  const submitSignUp = (e: FormEvent) => {
    e.preventDefault();
    const problems = signUpErrors({ username, email, password, repeat });
    if (available === 'taken') problems.unshift('Ese nombre de usuario ya está cogido');
    if (problems.length) {
      setError(problems.join(' · '));
      return;
    }
    const address = normalizeEmail(email)!;
    const name = normalizeUsername(username);
    void attempt(async () => {
      const { data, error: failure } = await client.auth.signUp({
        email: address,
        password,
        options: { data: { username: name, display_name: name } },
      });
      if (failure) return authErrorMessage(failure, 'signup');
      // Supabase answers "ok" without sending anything when the email already
      // has a confirmed account (it has no identities then).
      if (data.user && data.user.identities?.length === 0) {
        return 'Ese correo ya tiene una cuenta. Entra con ella o recupera la contraseña.';
      }
      setEmail(address);
      setLogin(name);
      setWait(RESEND_SECONDS);
      go('verify', `Te hemos enviado un código de 6 dígitos a ${address}. Puede tardar un minuto; mira también en spam.`);
    });
  };

  const submitVerify = (e: FormEvent) => {
    e.preventDefault();
    const token = normalizeOtp(code);
    if (!token) {
      setError('Escribe el código de 6 dígitos que te ha llegado por correo.');
      return;
    }
    void attempt(async () => {
      const { error: failure } = await client.auth.verifyOtp({ email, token, type: 'signup' });
      // On success the account is confirmed and signed in: the app opens.
      return failure ? authErrorMessage(failure, 'verify') : null;
    });
  };

  const resendSignUp = () =>
    void attempt(async () => {
      const { error: failure } = await client.auth.resend({ type: 'signup', email });
      if (failure) return authErrorMessage(failure, 'send');
      setWait(RESEND_SECONDS);
      setNotice(`Código reenviado a ${email}.`);
    });

  const submitForgot = (e: FormEvent) => {
    e.preventDefault();
    const address = normalizeEmail(email);
    if (!address) {
      setError('Escribe el correo de tu cuenta.');
      return;
    }
    void attempt(async () => {
      const { error: failure } = await client.auth.resetPasswordForEmail(address);
      if (failure) return authErrorMessage(failure, 'send');
      setEmail(address);
      setWait(RESEND_SECONDS);
      go('reset', `Si ${address} tiene una cuenta, te llegará un código para crear una contraseña nueva.`);
    });
  };

  const submitReset = (e: FormEvent) => {
    e.preventDefault();
    const token = normalizeOtp(code);
    const problem = passwordError(password) ?? (password !== repeat ? 'Las contraseñas no coinciden' : null);
    if (!codeAccepted && !token) {
      setError('Escribe el código de 6 dígitos que te ha llegado por correo.');
      return;
    }
    if (problem) {
      setError(problem);
      return;
    }
    void attempt(async () => {
      let failureMessage: string | null = null;
      await stayOnLogin(async () => {
        if (!codeAccepted) {
          const { error: failure } = await client.auth.verifyOtp({ email, token: token!, type: 'recovery' });
          if (failure) {
            failureMessage = authErrorMessage(failure, 'reset');
            return false;
          }
          setCodeAccepted(true);
        }
        const { error: failure } = await client.auth.updateUser({ password });
        if (failure) {
          failureMessage = authErrorMessage(failure, 'reset');
          return false;
        }
        return true; // the app opens with the new password saved
      });
      return failureMessage;
    });
  };

  const usernameHint = (() => {
    if (!username) return '3-20 caracteres: letras sin tildes, números, punto o guion bajo.';
    const problem = usernameError(username);
    if (problem) return problem;
    if (available === 'free') return 'Disponible';
    if (available === 'taken') return 'Ya está cogido';
    return available === 'checking' ? 'Comprobando…' : '3-20 caracteres: letras sin tildes, números, punto o guion bajo.';
  })();

  return (
    <main className={styles.screen}>
      <div className={styles.box}>
        <BrandMark size={48} className={styles.brand} />
        <h1 className={styles.title}>FamilyMemories</h1>

        {step === 'login' && (
          <form className={[ui.form, styles.form].join(' ')} onSubmit={submitLogin}>
            <h2 className={styles.formTitle}>Entrar</h2>
            <LabeledInput
              id="login-user"
              label="Usuario o correo"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={254}
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
            />
            <PasswordInput
              id="login-password"
              label="Contraseña"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <label className={styles.check}>
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              Recordarme en este dispositivo
            </label>
            <Button type="submit" variant="primary" block disabled={pending}>
              {pending ? 'Entrando…' : 'Entrar'}
            </Button>
            <button type="button" className={styles.link} onClick={() => go('forgot')}>
              ¿Has olvidado la contraseña?
            </button>
          </form>
        )}

        {step === 'signup' && (
          <form className={[ui.form, styles.form].join(' ')} onSubmit={submitSignUp}>
            <h2 className={styles.formTitle}>Crear cuenta</h2>
            <LabeledInput
              id="signup-user"
              label="Nombre de usuario"
              hint={usernameHint}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={20}
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setAvailable('checking');
              }}
              required
            />
            <LabeledInput
              id="signup-email"
              label="Correo electrónico"
              hint="Te enviaremos un código para confirmarlo. Sirve para recuperar la contraseña."
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <PasswordInput
              id="signup-password"
              label="Contraseña"
              hint="Mínimo 8 caracteres, con letras y números."
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <PasswordInput
              id="signup-repeat"
              label="Repite la contraseña"
              autoComplete="new-password"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
            />
            <Button type="submit" variant="primary" block disabled={pending}>
              {pending ? 'Creando cuenta…' : 'Crear cuenta'}
            </Button>
          </form>
        )}

        {step === 'verify' && (
          <form className={[ui.form, styles.form].join(' ')} onSubmit={submitVerify}>
            <h2 className={styles.formTitle}>Confirma tu correo</h2>
            {notice && <p className={styles.notice}>{notice}</p>}
            <CodeInput value={code} onChange={setCode} />
            <Button type="submit" variant="primary" block disabled={pending}>
              {pending ? 'Comprobando…' : 'Confirmar y entrar'}
            </Button>
            <div className={styles.row}>
              <Button variant="ghost" small onClick={() => go('login')}>
                Volver
              </Button>
              <Button variant="ghost" small disabled={pending || wait > 0} onClick={resendSignUp}>
                {wait > 0 ? `Reenviar (${wait} s)` : 'Reenviar código'}
              </Button>
            </div>
          </form>
        )}

        {step === 'forgot' && (
          <form className={[ui.form, styles.form].join(' ')} onSubmit={submitForgot}>
            <h2 className={styles.formTitle}>Recuperar contraseña</h2>
            <LabeledInput
              id="forgot-email"
              label="Correo de tu cuenta"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" variant="primary" block disabled={pending || wait > 0}>
              {pending ? 'Enviando…' : wait > 0 ? `Espera ${wait} s` : 'Enviarme un código'}
            </Button>
            <button type="button" className={styles.link} onClick={() => go('login')}>
              Volver a entrar
            </button>
          </form>
        )}

        {step === 'reset' && (
          <form className={[ui.form, styles.form].join(' ')} onSubmit={submitReset}>
            <h2 className={styles.formTitle}>Nueva contraseña</h2>
            {notice && <p className={styles.notice}>{notice}</p>}
            {!codeAccepted && <CodeInput value={code} onChange={setCode} />}
            <PasswordInput
              id="reset-password"
              label="Nueva contraseña"
              hint="Mínimo 8 caracteres, con letras y números."
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <PasswordInput
              id="reset-repeat"
              label="Repite la contraseña"
              autoComplete="new-password"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
            />
            <Button type="submit" variant="primary" block disabled={pending}>
              {pending ? 'Guardando…' : 'Guardar y entrar'}
            </Button>
            {!codeAccepted && (
              <button type="button" className={styles.link} onClick={() => go('forgot')}>
                Pedir otro código
              </button>
            )}
          </form>
        )}

        <ErrorBanner message={error} />

        {(step === 'login' || step === 'signup') && (
          <p className={styles.switch}>
            {step === 'login' ? '¿Aún no tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
            <button type="button" className={styles.link} onClick={() => go(step === 'login' ? 'signup' : 'login')}>
              {step === 'login' ? 'Crear cuenta' : 'Entrar'}
            </button>
          </p>
        )}
      </div>

      <button type="button" className={styles.demo} onClick={enterDemo}>
        Demo del portfolio
      </button>
    </main>
  );
}

function Labeled({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      {children}
      {hint && (
        <p className={styles.hint} id={`${id}-hint`}>
          {hint}
        </p>
      )}
    </div>
  );
}

function LabeledInput({ id, label, hint, ...rest }: { id: string; label: string; hint?: string } & ComponentProps<'input'>) {
  return (
    <Labeled id={id} label={label} hint={hint}>
      <input id={id} className={ui.input} aria-describedby={hint ? `${id}-hint` : undefined} {...rest} />
    </Labeled>
  );
}

function PasswordInput({
  id,
  label,
  hint,
  ...rest
}: { id: string; label: string; hint?: string } & Omit<ComponentProps<'input'>, 'type'>) {
  const [visible, setVisible] = useState(false);
  return (
    <Labeled id={id} label={label} hint={hint}>
      <div className={styles.password}>
        <input
          id={id}
          className={ui.input}
          type={visible ? 'text' : 'password'}
          autoCapitalize="none"
          spellCheck={false}
          maxLength={72}
          required
          aria-describedby={hint ? `${id}-hint` : undefined}
          {...rest}
        />
        <button
          type="button"
          className={styles.eye}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
        >
          <Icon name={visible ? 'eyeOff' : 'eye'} size={20} />
        </button>
      </div>
    </Labeled>
  );
}

function CodeInput({ value, onChange }: { value: string; onChange(value: string): void }) {
  return (
    <Labeled id="otp-code" label="Código de 6 dígitos">
      <input
        id="otp-code"
        className={[ui.input, styles.code].join(' ')}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]*"
        maxLength={12}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="123456"
        autoFocus
        required
      />
    </Labeled>
  );
}
