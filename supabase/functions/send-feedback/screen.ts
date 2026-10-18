// Screening of the suggestions sent from the app before they are e-mailed to
// the app's owner. Plain TypeScript (no Deno/Node APIs): the Edge Function
// uses it and the app's tests check it.

export const LIMITS = { subjectMin: 3, subjectMax: 120, messageMin: 10, messageMax: 4000 } as const;

export type Verdict = 'ok' | 'review' | 'reject';

export interface Screening {
  verdict: Verdict;
  /** Why it was flagged (Spanish, for the owner's e-mail). */
  reasons: string[];
}

/** Code, scripts or injection attempts: never sent. */
const ATTACKS: [RegExp, string][] = [
  [/<\s*\/?\s*(script|iframe|object|embed|svg|img|style|link|meta|form)\b/i, 'contiene etiquetas HTML'],
  [/javascript\s*:|data\s*:\s*text\/html|on(error|load|click)\s*=/i, 'contiene código de página web'],
  [/\b(union\s+select|drop\s+table|insert\s+into|delete\s+from|update\s+\w+\s+set|;\s*--|\/\*.*\*\/)/i, 'parece una inyección SQL'],
  [/\$\{|\{\{|<%|%>/, 'contiene plantillas de código'],
  // Control characters (intended).
  // eslint-disable-next-line no-control-regex
  [/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/, 'contiene caracteres de control'],
  [/(.)\1{24,}/, 'texto repetido sin sentido'],
];

/** Fine to send, but worth a look. */
const WARNINGS: [RegExp, string][] = [
  [/https?:\/\/|www\.\w/i, 'incluye enlaces'],
  [/[\w.+-]+@[\w-]+\.[\w.]{2,}/, 'incluye una dirección de correo'],
  [/(\+?\d[\s-]?){9,}/, 'incluye un número de teléfono o de cuenta'],
  [/\b(contraseña|password|tarjeta|iban|dni|nif|pin)\b/i, 'menciona datos sensibles'],
];

/** Words that show the message is about the app. */
const ABOUT_THE_APP =
  /\b(app|aplicaci[oó]n|ra[ií]ces|v[ií]deos?|fotos?|im[aá]gen(es)?|cromos?|sobres?|[aá]lbum(es)?|fechas?|cumplea[nñ]os|[aá]rbol|canal(es)?|personas?|mascotas?|invitaci[oó]n(es)?|c[oó]digo|cuenta|sesi[oó]n|correo|notificaci[oó]n(es)?|bot[oó]n(es)?|pantalla|men[uú]|error(es)?|fallo|falla|bug|mejora|sugerencia|idea|funciona|cargar?|subir|descargar?|demo|familia|recuerdos?|miniatura|portada|perfil|ficha|buz[oó]n)\b/i;

/** Decides whether a suggestion is sent, flagged for review or refused. */
export function screenFeedback(subject: string, message: string): Screening {
  const text = `${subject}\n${message}`;
  const rejectReasons = ATTACKS.filter(([re]) => re.test(text)).map(([, why]) => why);
  if (rejectReasons.length) return { verdict: 'reject', reasons: rejectReasons };
  const reasons = WARNINGS.filter(([re]) => re.test(text)).map(([, why]) => why);
  if (!ABOUT_THE_APP.test(text)) reasons.push('no parece hablar de la app');
  const letters = text.replace(/[^a-záéíóúñ]/gi, '');
  if (letters.length > 20 && letters === letters.toUpperCase()) reasons.push('todo en mayúsculas');
  return { verdict: reasons.length ? 'review' : 'ok', reasons };
}

/** Length checks (the same ones the form applies). Null when fine. */
export function feedbackLengthError(subject: unknown, message: unknown): string | null {
  if (typeof subject !== 'string' || typeof message !== 'string') return 'Faltan el asunto o el mensaje';
  const s = subject.trim();
  const m = message.trim();
  if (s.length < LIMITS.subjectMin || s.length > LIMITS.subjectMax) {
    return `El asunto debe tener entre ${LIMITS.subjectMin} y ${LIMITS.subjectMax} caracteres`;
  }
  if (m.length < LIMITS.messageMin || m.length > LIMITS.messageMax) {
    return `El mensaje debe tener entre ${LIMITS.messageMin} y ${LIMITS.messageMax} caracteres`;
  }
  return null;
}
