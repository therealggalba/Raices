import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';

// Security test of the Supabase schema: applies every migration to an
// in-memory PostgreSQL (PGlite) with a minimal Supabase environment (auth,
// storage, roles) and checks the RLS rules and server functions with real
// users. Run: npm run test:db
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
const migration = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
  .map((f) => readFileSync(join(migrationsDir, f), 'utf8')).join('\n');
process.on('unhandledRejection', (e) => { console.log('ERROR:', e.message, e.query ? '\n  en: ' + e.query.slice(0, 200) : ''); process.exit(2); });
const db = await PGlite.create({ extensions: { pgcrypto } });

// --- Minimal Supabase environment -------------------------------------------
await db.exec(`
  create schema extensions; create extension pgcrypto schema extensions;
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid default auth.uid());
  alter table storage.objects enable row level security;
  grant usage on schema public, auth, storage, extensions to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant select, insert, update, delete on storage.objects to authenticated;
  -- Supabase's default privileges on public
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
`);
await db.exec(migration);
console.log('✓ migración aplicada sin errores');

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const C = '00000000-0000-0000-0000-00000000000c';
await db.exec(`insert into auth.users values ('${A}','ana@example.com'),('${B}','beto@example.com'),('${C}','carla@example.com')`);

let failures = 0;
const ok = (cond, msg) => { if (cond) console.log('✓', msg); else { failures++; console.log('✗', msg); } };

// Runs SQL as a signed-in user (or anon) inside a transaction.
async function as(user, sql, params = []) {
  return db.transaction(async (tx) => {
    await tx.exec(user ? `set local role authenticated; select set_config('request.jwt.claim.sub', '${user}', true);`
                       : `set local role anon; select set_config('request.jwt.claim.sub', '', true);`);
    return (await tx.query(sql, params)).rows;
  });
}
async function fails(user, sql, params = []) {
  try { await as(user, sql, params); return null; } catch (e) { return e.message; }
}

ok((await db.query(`select count(*)::int n from public.profiles`)).rows[0].n === 3, 'se crea un perfil por cada cuenta nueva');

// Channel + content (A is admin)
const ch = (await as(A, `select public.create_channel('Familia Prueba','', 'familia', 'oceano') id`))[0].id;
ok(!!ch, 'A crea un canal y queda como admin');
const [abuelo] = await as(A, `insert into public.people (channel_id, first_name) values ($1,'Abuelo') returning id`, [ch]);
const [hijo] = await as(A, `insert into public.people (channel_id, first_name, parent_ids) values ($1,'Hijo', array[$2::uuid]) returning id`, [ch, abuelo.id]);
await as(A, `insert into public.videos (channel_id, title, media_url, event_date, category, author_id) values ($1,'Boda','https://x.test/a.mp4','1998-07','boda',$2)`, [ch, A]);
for (let i = 1; i <= 6; i++) {
  await as(A, `insert into public.album_cards (channel_id, title, description, image_path, blurred_path, taken_at, author_id)
               values ($1::uuid, $2, 'secreto ' || $2, $4 || '/c' || $2 || '.webp', $4 || '/c' || $2 || '_blur.webp', '2001', $3)`, [ch, String(i), A, ch]);
}
const nums = (await as(A, `select number from public.album_cards where channel_id=$1 order by number`, [ch])).map((r) => r.number);
ok(nums.join() === '1,2,3,4,5,6', 'los cromos se numeran solos (1..6)');

// Isolation
ok((await as(B, `select * from public.channels`)).length === 0, 'B (no miembro) no ve el canal');
ok((await as(B, `select id, title from public.album_cards`)).length === 0, 'B (no miembro) no ve los cromos');
ok(!!(await fails(null, `select * from public.channels`)), 'sin sesión no se puede leer nada');
ok(!!(await fails(B, `insert into public.channels (name, created_by) values ('x', $1)`, [B])), 'nadie crea canales saltándose la función');

// Invitations
const inv = (await as(A, `select * from public.create_invitation($1, 7)`, [ch]))[0];
ok(/^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/.test(inv.code), `código de invitación válido (${inv.code})`);
ok(!!(await fails(B, `select * from public.create_invitation($1, 7)`, [ch])), 'un no-admin no puede crear invitaciones');
const typed = inv.code.toLowerCase().replace(/-/g, ' ');
ok((await as(B, `select public.redeem_invitation($1, 'Beto') id`, [typed]))[0].id === ch, 'B se une escribiendo el código en minúsculas y con espacios');
ok((await fails(C, `select public.redeem_invitation($1, 'Carla')`, [inv.code])) ?.includes('no es válida'), 'el código ya usado no sirve (un solo uso)');
ok((await fails(C, `select public.redeem_invitation('ZZZZ-ZZZZ-ZZZZ', 'Carla')`))?.includes('no es válida'), 'código inexistente: mismo mensaje');
ok((await as(B, `select * from public.channels`)).length === 1, 'B ya ve el canal');
ok((await as(B, `select * from public.invitations`)).length === 0, 'un miembro no ve las invitaciones');

// Permissions of a plain member
ok(!!(await fails(B, `insert into public.videos (channel_id, title, media_url, event_date, category, author_id) values ($1,'x','https://x.test/b.mp4','2000','otros',$2)`, [ch, B])), 'un miembro no puede añadir vídeos');
ok((await as(B, `update public.channels set name='Hackeado' where id=$1 returning id`, [ch])).length === 0, 'un miembro no puede editar el canal');
ok(!!(await fails(A, `update public.album_cards set number = 99 where channel_id=$1`, [ch])), 'ni un admin puede cambiar el número de un cromo');
ok(!!(await fails(A, `update public.channels set card_sequence = 0 where id=$1`, [ch])), 'ni un admin puede tocar el contador de cromos');

// Hidden descriptions + packs
ok(!!(await fails(B, `select description from public.album_cards`)), 'la descripción de los cromos no se puede leer directamente');
ok((await as(B, `select * from public.unlocked_card_descriptions()`)).length === 0, 'B no ve descripciones sin desbloquear');
const pack = await as(B, `select * from public.open_pack($1, 'Europe/Madrid')`, [ch]);
ok(pack.length === 5 && new Set(pack.map((p) => p.card_id)).size === 5, 'un sobre trae 5 cromos distintos');
ok(pack.every((p) => p.is_new && p.copies === 1), 'todos nuevos en el primer sobre');
ok((await as(B, `select * from public.unlocked_card_descriptions()`)).length === 5, 'tras el sobre, B ve 5 descripciones');
await as(B, `select * from public.open_pack($1, 'Europe/Madrid')`, [ch]);
const third = await as(B, `select * from public.open_pack($1, 'Europe/Madrid')`, [ch]);
ok(third.some((p) => !p.is_new && p.copies > 1), 'los repetidos acumulan copias');
ok((await fails(B, `select * from public.open_pack($1, 'Europe/Madrid')`, [ch]))?.includes('todos los sobres de hoy'), 'el 4.º sobre del día se rechaza');
const st = (await as(B, `select * from public.pack_status('Europe/Madrid')`))[0];
ok(st.remaining === 0 && st.opened_today === 3, 'estado de sobres: 0 restantes');
ok(!!(await fails(B, `insert into public.card_copies (user_id, card_id, channel_id, count) select $1, id, channel_id, 99 from public.album_cards limit 1`, [B])), 'nadie se regala copias saltándose el sobre');
ok((await as(A, `select * from public.card_copies`)).length === 0, 'A no ve las copias de B');

// Storage: originals only for unlocked cromos
const owned = new Set((await as(B, `select card_id from public.card_copies`)).map((r) => r.card_id));
await as(A, `insert into storage.objects (bucket_id, name) select 'cromos', image_path from public.album_cards union all select 'cromos', blurred_path from public.album_cards`);
const visible = (await as(B, `select name from storage.objects where bucket_id='cromos'`)).map((r) => r.name);
const originals = visible.filter((n) => !n.endsWith('_blur.webp'));
ok(visible.filter((n) => n.endsWith('_blur.webp')).length === 6, 'B ve las 6 miniaturas desenfocadas');
ok(originals.length === owned.size, `B solo ve las ${owned.size} fotos originales que ha desbloqueado`);
ok((await as(C, `select name from storage.objects`)).length === 0, 'C no ve ninguna imagen');
ok(!!(await fails(B, `insert into storage.objects (bucket_id, name) values ('cromos', $1::text || '/x.webp')`, [ch])), 'un miembro no puede subir cromos');

// D opens a single pack (5 of 6): exactly one cromo stays locked for D.
const Dusr = '00000000-0000-0000-0000-00000000000d';
await db.exec(`insert into auth.users values ('${Dusr}','dani@example.com')`);
const inv2 = (await as(A, `select * from public.create_invitation($1, 1)`, [ch]))[0];
await as(Dusr, `select public.redeem_invitation($1, 'Dani')`, [inv2.code]);
await as(Dusr, `select * from public.open_pack($1, 'America/Mexico_City')`, [ch]);
const dOwned = new Set((await as(Dusr, `select card_id from public.card_copies`)).map((r) => r.card_id));
const lockedForD = (await as(Dusr, `select id, image_path from public.album_cards`)).filter((c) => !dOwned.has(c.id));
const dSees = new Set((await as(Dusr, `select name from storage.objects where bucket_id='cromos'`)).map((r) => r.name));
ok(dOwned.size === 5 && lockedForD.length === 1, 'D tiene 5 cromos y 1 bloqueado');
ok(lockedForD.every((c) => !dSees.has(c.image_path)), 'la foto original del cromo bloqueado NO es accesible para D');
ok(lockedForD.every((c) => dSees.has(c.image_path.replace('.webp', '_blur.webp'))), 'pero sí su miniatura desenfocada');
ok((await as(Dusr, `select * from public.unlocked_card_descriptions()`)).length === 5, 'D solo recibe las 5 descripciones de sus cromos');

// Admin rules
ok((await fails(A, `select public.set_member_role($1, $2, 'member')`, [ch, A]))?.includes('al menos un administrador'), 'no se puede dejar el canal sin admin');
ok((await fails(A, `select public.leave_channel($1)`, [ch]))?.includes('Nombra a otro administrador'), 'el último admin no puede irse sin relevo');
ok(!!(await fails(A, `update public.people set parent_ids = array[$1::uuid] where id = $2`, [hijo.id, abuelo.id])), 'el árbol rechaza que alguien sea antepasado de sí mismo');

// Numbers never reused
await as(A, `delete from public.album_cards where channel_id=$1 and number=6`, [ch]);
const n7 = (await as(A, `insert into public.album_cards (channel_id, title, image_url, taken_at, author_id) values ($1,'Nuevo','https://x.test/i.jpg','2020',$2) returning number`, [ch, A]))[0].number;
ok(n7 === 7, 'tras borrar el #6, el siguiente es el #7 (no se reutiliza)');

// Leaving cleans the member's data
await as(B, `select public.leave_channel($1)`, [ch]);
ok((await as(B, `select * from public.channels`)).length === 0 && (await db.query(`select count(*)::int n from public.card_copies where user_id='${B}'`)).rows[0].n === 0, 'B sale: deja de ver el canal y se borran sus copias');

console.log(failures ? `\n${failures} comprobaciones FALLIDAS` : '\nTodas las comprobaciones correctas');
process.exit(failures ? 1 : 0);
