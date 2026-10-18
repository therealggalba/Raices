// Supabase Edge Function «send-feedback»: a signed-in user's suggestion,
// screened (screen.ts), logged and e-mailed to the app's owner.
//
// Secrets (Supabase › Edge Functions › Secrets; never in the repo):
//   FEEDBACK_TO          owner's address that receives the suggestions
//   FEEDBACK_SMTP_USER   Gmail account that sends them
//   FEEDBACK_SMTP_PASS   its app password
//   FEEDBACK_SMTP_HOST   optional, default smtp.gmail.com (port 465, TLS)
// SUPABASE_URL, SUPABASE_ANON_KEY and the service key are provided by Supabase.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';
import { feedbackLengthError, screenFeedback } from './screen.ts';

const ALLOWED_ORIGINS = new Set([
  'https://localhost', // Android app (Capacitor)
  'http://localhost:5196', // development
  'https://galbahub-v2.vercel.app',
]);
const PER_HOUR = 2;
const PER_DAY = 5;

function cors(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://localhost',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function reply(status: number, body: Record<string, unknown>, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== 'POST') return reply(405, { error: 'Método no permitido' }, origin);

  // Who is writing (must be signed in).
  const url = Deno.env.get('SUPABASE_URL')!;
  const authHeader = req.headers.get('Authorization') ?? '';
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
  const { data: auth } = await asUser.auth.getUser();
  const user = auth.user;
  if (!user) return reply(401, { error: 'Inicia sesión para enviar sugerencias' }, origin);

  let payload: { subject?: unknown; message?: unknown };
  try {
    payload = await req.json();
  } catch {
    return reply(400, { error: 'Mensaje no válido' }, origin);
  }
  const lengthError = feedbackLengthError(payload.subject, payload.message);
  if (lengthError) return reply(400, { error: lengthError }, origin);
  const subject = String(payload.subject).trim();
  const message = String(payload.message).trim();

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Rate limit per user.
  const since = (ms: number) => new Date(Date.now() - ms).toISOString();
  const count = async (from: string) =>
    (await admin.from('feedback_messages').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', from))
      .count ?? 0;
  if ((await count(since(3600_000))) >= PER_HOUR || (await count(since(86_400_000))) >= PER_DAY) {
    return reply(429, { error: 'Has enviado varias sugerencias seguidas. Inténtalo más tarde.' }, origin);
  }

  const screening = screenFeedback(subject, message);
  await admin.from('feedback_messages').insert({
    user_id: user.id,
    subject,
    message,
    verdict: screening.verdict,
    reasons: screening.reasons,
  });
  if (screening.verdict === 'reject') {
    return reply(422, { error: 'El mensaje no se puede enviar: no debe incluir código ni contenido ajeno a la app.' }, origin);
  }

  const { data: profile } = await admin.from('profiles').select('username, display_name').eq('id', user.id).maybeSingle();
  const lines = [
    `De: ${profile?.display_name ?? '—'} (@${profile?.username ?? '—'}) <${user.email ?? 'sin correo'}>`,
    `Fecha: ${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}`,
    screening.verdict === 'review' ? `Revisar: ${screening.reasons.join(', ')}` : 'Revisión automática: sin incidencias',
    '',
    `Asunto: ${subject}`,
    '',
    message,
  ];

  const client = new SMTPClient({
    connection: {
      hostname: Deno.env.get('FEEDBACK_SMTP_HOST') ?? 'smtp.gmail.com',
      port: 465,
      tls: true,
      auth: { username: Deno.env.get('FEEDBACK_SMTP_USER')!, password: Deno.env.get('FEEDBACK_SMTP_PASS')! },
    },
  });
  try {
    await client.send({
      from: `Raíces <${Deno.env.get('FEEDBACK_SMTP_USER')}>`,
      to: Deno.env.get('FEEDBACK_TO')!,
      replyTo: user.email ?? undefined,
      subject: `[Raíces]${screening.verdict === 'review' ? ' [REVISAR]' : ''} ${subject}`,
      content: lines.join('\n'),
    });
  } catch {
    return reply(502, { error: 'No se ha podido enviar ahora. Inténtalo más tarde.' }, origin);
  } finally {
    await client.close();
  }
  return reply(200, { ok: true }, origin);
});
