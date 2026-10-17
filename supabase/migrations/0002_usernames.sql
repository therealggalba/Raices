-- =============================================================================
-- Raíces — accounts with username + email + password
--
-- Every account has a unique username (chosen at sign-up) besides its email.
-- People sign in with "username or email" + password. Turning a username into
-- the email Supabase Auth needs happens in login_email(), which only answers
-- when the password is right: usernames never reveal anybody's email, and
-- failed attempts per username are throttled.
--
-- Run once in: Supabase Dashboard > SQL Editor, after 0001_init.sql.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Usernames
-- ---------------------------------------------------------------------------

-- 3-20 characters: lowercase letters, digits, dot and underscore.
create or replace function public.is_username(value text)
returns boolean language sql immutable as $$
  select coalesce(value ~ '^[a-z0-9._]{3,20}$', false)
$$;

alter table public.profiles add column username text;
-- Accounts created before this migration get a provisional one.
update public.profiles set username = 'usuario_' || right(replace(id::text, '-', ''), 10) where username is null;
alter table public.profiles alter column username set not null;
alter table public.profiles add constraint profiles_username_format check (public.is_username(username));
create unique index profiles_username_key on public.profiles (username);

-- New accounts: username and display name come from the sign-up form
-- (user metadata). A username that is already taken makes the sign-up fail;
-- accounts created without one (e.g. from the dashboard) get a provisional one.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_username text := lower(btrim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  v_name text := left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 40);
begin
  if v_username = '' then
    v_username := 'usuario_' || right(replace(new.id::text, '-', ''), 10);
  elsif not public.is_username(v_username) then
    raise exception 'Nombre de usuario no válido' using errcode = '22023';
  elsif exists (select 1 from profiles where username = v_username) then
    raise exception 'Ese nombre de usuario ya está cogido' using errcode = '23505';
  end if;
  insert into public.profiles (id, display_name, username)
  values (new.id, coalesce(nullif(v_name, ''), v_username), v_username)
  on conflict (id) do nothing;
  return new;
end $$;

-- Usernames are fixed once chosen (only the display name can change).
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Sign-up and sign-in helpers (callable without a session)
-- ---------------------------------------------------------------------------

-- Live check in the sign-up form.
create or replace function public.username_available(p_username text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_username(lower(btrim(coalesce(p_username, ''))))
     and not exists (select 1 from profiles where username = lower(btrim(p_username)))
$$;

-- Failed username sign-ins (no policies: only these functions touch it).
create table public.login_attempts (
  username text not null,
  attempted_at timestamptz not null default now()
);
create index on public.login_attempts (username, attempted_at);
alter table public.login_attempts enable row level security;
revoke all on public.login_attempts from anon, authenticated;

-- The email of a username, ONLY when the password is right (null otherwise).
-- The app then signs in with Supabase Auth as usual (which checks again).
-- 10 failed attempts per username every 15 minutes at most.
create or replace function public.login_email(p_username text, p_password text)
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  v_username text := lower(btrim(coalesce(p_username, '')));
  v_email text;
  v_hash text;
  -- Compared against when the username doesn't exist, so both cases take
  -- the same time (no way to find out which usernames exist by timing).
  -- Hash of a throwaway string, not of any real password.
  v_dummy constant text := '$2a$10$S4zUV2mifRjxyUtSiEsy8e0OKG2esPxzYMF/jrAfsXV9IS4hafb1y';
begin
  if not public.is_username(v_username) or p_password is null or char_length(p_password) > 72 then
    return null;
  end if;
  delete from login_attempts where attempted_at < now() - interval '1 day';
  if (select count(*) from login_attempts
      where username = v_username and attempted_at > now() - interval '15 minutes') >= 10 then
    raise exception 'Demasiados intentos fallidos. Espera unos minutos y vuelve a probar.' using errcode = '54000';
  end if;
  select u.email, u.encrypted_password into v_email, v_hash
    from auth.users u join profiles p on p.id = u.id
    where p.username = v_username;
  if v_hash is null or v_hash = '' then
    perform extensions.crypt(p_password, v_dummy);
    insert into login_attempts (username) values (v_username);
    return null;
  end if;
  if extensions.crypt(p_password, v_hash) <> v_hash then
    insert into login_attempts (username) values (v_username);
    return null;
  end if;
  return v_email;
end $$;

revoke execute on function public.is_username(text), public.username_available(text), public.login_email(text, text)
  from public, anon, authenticated;
grant execute on function public.is_username(text) to authenticated;
grant execute on function public.username_available(text), public.login_email(text, text) to anon, authenticated;
