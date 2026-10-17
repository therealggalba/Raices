-- =============================================================================
-- Raíces — initial schema (Supabase / PostgreSQL)
--
-- Multi-tenant by CHANNEL: every row belongs to a channel and Row Level
-- Security only lets members read their channels; only channel admins write
-- channel content. Per-user data (favourites, progress, cromo copies, packs)
-- is visible to its owner only. Sensitive operations (create channel,
-- invitations, roles, packs) are SECURITY DEFINER functions with their own
-- checks, so the client can never bypass the rules.
--
-- Run once in: Supabase Dashboard > SQL Editor (as the project owner).
-- Safe to read top to bottom; nothing here deletes existing data.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Helpers
-- ---------------------------------------------------------------------------

-- Partial dates ("1998", "1998-07", "1998-07-14") as used by videos/cromos.
create or replace function public.is_partial_date(value text)
returns boolean language sql immutable as $$
  select value ~ '^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$'
$$;

-- ---------------------------------------------------------------------------
-- 1. Users
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Invitado' check (char_length(display_name) between 1 and 40),
  created_at timestamptz not null default now()
);

-- A profile is created automatically for every new account.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(split_part(new.email, '@', 1), ''), 'Invitado'))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. Channels, members, invitations
-- ---------------------------------------------------------------------------

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '' check (char_length(description) <= 2000),
  kind text not null default 'familia' check (kind in ('familia', 'amigos', 'viajes', 'otros')),
  pack_theme text not null default 'clasico'
    check (pack_theme in ('clasico', 'atardecer', 'oceano', 'bosque', 'vintage', 'galaxia')),
  cover_url text check (cover_url is null or cover_url ~ '^https://'),
  -- Last cromo number issued (numbers are never reused).
  card_sequence integer not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id)
);

create table public.channel_members (
  channel_id uuid not null references public.channels (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  invitation_id uuid,
  primary key (channel_id, user_id)
);
create index on public.channel_members (user_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels (id) on delete cascade,
  code text not null unique check (code ~ '^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$'),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references public.profiles (id),
  revoked_at timestamptz,
  check (expires_at > created_at and expires_at <= created_at + interval '90 days')
);
create index on public.invitations (channel_id);

-- Membership checks used by every policy. SECURITY DEFINER so they can read
-- channel_members without recursing into its own policies.
create or replace function public.is_member(p_channel uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from channel_members where channel_id = p_channel and user_id = auth.uid())
$$;

create or replace function public.is_admin(p_channel uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from channel_members where channel_id = p_channel and user_id = auth.uid() and role = 'admin'
  )
$$;

-- ---------------------------------------------------------------------------
-- 3. Channel content
-- ---------------------------------------------------------------------------

create table public.people (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels (id) on delete cascade,
  first_name text not null check (char_length(first_name) between 1 and 80),
  last_name text not null default '' check (char_length(last_name) <= 80),
  birth_date date,
  photo_url text check (photo_url is null or photo_url ~ '^https://'),
  relationship text not null default '' check (char_length(relationship) <= 60),
  biography text not null default '' check (char_length(biography) <= 4000),
  notes text not null default '' check (char_length(notes) <= 2000),
  -- Family tree: up to two parents of the same channel (checked by trigger).
  parent_ids uuid[] not null default '{}' check (cardinality(parent_ids) <= 2)
);
create index on public.people (channel_id);

create table public.partnerships (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels (id) on delete cascade,
  person_a uuid not null references public.people (id) on delete cascade,
  person_b uuid not null references public.people (id) on delete cascade,
  since date,
  until date,
  check (person_a < person_b),
  check (until is null or since is null or until >= since),
  unique (channel_id, person_a, person_b)
);

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  media_url text not null check (media_url ~ '^https://' and char_length(media_url) <= 2000),
  thumbnail_url text check (thumbnail_url is null or thumbnail_url ~ '^https://'),
  event_date text not null check (public.is_partial_date(event_date)),
  uploaded_at timestamptz not null default now(),
  duration_seconds integer check (duration_seconds is null or duration_seconds between 1 and 86400),
  category text not null check (
    category in ('vacaciones', 'cumpleanos', 'navidad', 'boda', 'comunion', 'bautizo', 'reunion', 'otros')
  ),
  tags text[] not null default '{}' check (cardinality(tags) <= 12),
  person_ids uuid[] not null default '{}' check (cardinality(person_ids) <= 50),
  author_id uuid not null references public.profiles (id)
);
create index on public.videos (channel_id);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels (id) on delete cascade,
  type text not null check (type in ('cumpleanos', 'aniversario', 'comunion', 'bautizo', 'boda', 'otro')),
  title text not null check (char_length(title) between 1 and 120),
  date date not null,
  person_ids uuid[] not null default '{}' check (cardinality(person_ids) <= 50),
  notes text not null default '' check (char_length(notes) <= 2000)
);
create index on public.events (channel_id);

create table public.album_cards (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels (id) on delete cascade,
  -- Assigned by trigger from channels.card_sequence (never reused).
  number integer not null,
  person_id uuid references public.people (id) on delete set null,
  title text not null check (char_length(title) between 1 and 120),
  -- Hidden until the cromo is unlocked (column not readable directly, see 6).
  description text not null default '' check (char_length(description) <= 2000),
  -- Either an external https image or a file in the private "cromos" bucket.
  image_url text check (image_url is null or image_url ~ '^https://'),
  image_path text,
  -- Small, already blurred copy shown while the cromo is locked.
  blurred_path text,
  taken_at text not null check (public.is_partial_date(taken_at)),
  created_at timestamptz not null default now(),
  author_id uuid not null references public.profiles (id),
  check (image_url is not null or image_path is not null),
  unique (channel_id, number)
);
create index on public.album_cards (channel_id);

-- ---------------------------------------------------------------------------
-- 4. Per-user data
-- ---------------------------------------------------------------------------

create table public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  channel_id uuid not null references public.channels (id) on delete cascade,
  primary key (user_id, video_id)
);

create table public.video_views (
  id bigint generated always as identity primary key,
  channel_id uuid not null references public.channels (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  viewed_at timestamptz not null default now()
);
create index on public.video_views (video_id);

create table public.watch_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  channel_id uuid not null references public.channels (id) on delete cascade,
  position_seconds integer not null check (position_seconds >= 0),
  duration_seconds integer not null check (duration_seconds > 0 and duration_seconds <= 86400),
  updated_at timestamptz not null default now(),
  primary key (user_id, video_id)
);

create table public.card_copies (
  user_id uuid not null references public.profiles (id) on delete cascade,
  card_id uuid not null references public.album_cards (id) on delete cascade,
  channel_id uuid not null references public.channels (id) on delete cascade,
  count integer not null check (count >= 1),
  first_obtained_at timestamptz not null default now(),
  primary key (user_id, card_id)
);

create table public.pack_openings (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Local calendar day of the user (daily allowance).
  opened_on date not null,
  opened_at timestamptz not null default now(),
  card_ids uuid[] not null
);
create index on public.pack_openings (user_id, opened_on);

-- ---------------------------------------------------------------------------
-- 5. Integrity triggers
-- ---------------------------------------------------------------------------

-- Parents: same channel, not oneself, no ancestry loops.
create or replace function public.check_person_parents()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.id = any (new.parent_ids) then
    raise exception 'Una persona no puede ser su propio progenitor' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(new.parent_ids) as p(id)
    where not exists (select 1 from people where people.id = p.id and people.channel_id = new.channel_id)
  ) then
    raise exception 'Los progenitores deben ser personas del mismo canal' using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' and exists (
    with recursive descendants(id) as (
      select id from people where new.id = any (parent_ids)
      union
      select p.id from people p join descendants d on d.id = any (p.parent_ids)
    )
    select 1 from descendants where id = any (new.parent_ids)
  ) then
    raise exception 'Una persona no puede ser antepasada de sí misma' using errcode = '22023';
  end if;
  return new;
end $$;

create trigger people_parents_check
  before insert or update of parent_ids on public.people
  for each row execute function public.check_person_parents();

-- When a person is deleted: unlink them from children, videos and events.
create or replace function public.unlink_deleted_person()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update people set parent_ids = array_remove(parent_ids, old.id)
    where channel_id = old.channel_id and old.id = any (parent_ids);
  update videos set person_ids = array_remove(person_ids, old.id)
    where channel_id = old.channel_id and old.id = any (person_ids);
  update events set person_ids = array_remove(person_ids, old.id)
    where channel_id = old.channel_id and old.id = any (person_ids);
  return old;
end $$;

create trigger people_unlink_on_delete
  after delete on public.people
  for each row execute function public.unlink_deleted_person();

-- Partnerships only between people of their channel.
create or replace function public.check_partnership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from people where id in (new.person_a, new.person_b) and channel_id = new.channel_id) <> 2 then
    raise exception 'La pareja debe ser de dos personas del canal' using errcode = '22023';
  end if;
  return new;
end $$;

create trigger partnerships_check
  before insert or update on public.partnerships
  for each row execute function public.check_partnership();

-- Cromo numbers: next of the channel's sequence, never reused.
create or replace function public.assign_card_number()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update channels set card_sequence = card_sequence + 1 where id = new.channel_id
    returning card_sequence into new.number;
  return new;
end $$;

create trigger album_cards_number
  before insert on public.album_cards
  for each row execute function public.assign_card_number();

-- Content rows keep their channel and author (no moving data between channels).
create or replace function public.freeze_channel_id()
returns trigger language plpgsql as $$
begin
  if new.channel_id <> old.channel_id then
    raise exception 'No se puede cambiar el canal de un elemento' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger people_freeze before update on public.people for each row execute function public.freeze_channel_id();
create trigger videos_freeze before update on public.videos for each row execute function public.freeze_channel_id();
create trigger events_freeze before update on public.events for each row execute function public.freeze_channel_id();
create trigger cards_freeze before update on public.album_cards for each row execute function public.freeze_channel_id();
create trigger partnerships_freeze before update on public.partnerships for each row execute function public.freeze_channel_id();

-- ---------------------------------------------------------------------------
-- 6. Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.channels enable row level security;
alter table public.channel_members enable row level security;
alter table public.invitations enable row level security;
alter table public.people enable row level security;
alter table public.partnerships enable row level security;
alter table public.videos enable row level security;
alter table public.events enable row level security;
alter table public.album_cards enable row level security;
alter table public.favorites enable row level security;
alter table public.video_views enable row level security;
alter table public.watch_progress enable row level security;
alter table public.card_copies enable row level security;
alter table public.pack_openings enable row level security;

-- Nothing is readable without an account.
revoke all on all tables in schema public from anon;

-- Profiles: your own, and those of people you share a channel with.
create policy "profiles: own or co-members" on public.profiles for select to authenticated using (
  id = auth.uid() or exists (
    select 1 from channel_members mine join channel_members theirs using (channel_id)
    where mine.user_id = auth.uid() and theirs.user_id = profiles.id
  )
);
create policy "profiles: update own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Channels: members read, admins edit. Created/left only through functions.
create policy "channels: members read" on public.channels for select to authenticated using (public.is_member(id));
create policy "channels: admins update" on public.channels for update to authenticated
  using (public.is_admin(id)) with check (public.is_admin(id));

create policy "members: read own channels" on public.channel_members for select to authenticated
  using (public.is_member(channel_id));

create policy "invitations: admins read" on public.invitations for select to authenticated
  using (public.is_admin(channel_id));

-- Channel content: members read, admins write.
do $$
declare t text;
begin
  foreach t in array array['people', 'partnerships', 'videos', 'events', 'album_cards'] loop
    execute format('create policy "%1$s: members read" on public.%1$I for select to authenticated using (public.is_member(channel_id))', t);
    execute format('create policy "%1$s: admins insert" on public.%1$I for insert to authenticated with check (public.is_admin(channel_id))', t);
    execute format('create policy "%1$s: admins update" on public.%1$I for update to authenticated using (public.is_admin(channel_id)) with check (public.is_admin(channel_id))', t);
    execute format('create policy "%1$s: admins delete" on public.%1$I for delete to authenticated using (public.is_admin(channel_id))', t);
  end loop;
end $$;

-- Authors are always the caller.
create policy "videos: author is caller" on public.videos as restrictive for insert to authenticated
  with check (author_id = auth.uid());
create policy "album_cards: author is caller" on public.album_cards as restrictive for insert to authenticated
  with check (author_id = auth.uid());

-- Only meaningful fields are editable (no moving numbers, authors, counters).
revoke update on public.channels, public.videos, public.album_cards from authenticated;
grant update (name, description, kind, pack_theme, cover_url) on public.channels to authenticated;
grant update (title, description, media_url, thumbnail_url, event_date, duration_seconds, category, tags, person_ids)
  on public.videos to authenticated;
grant update (person_id, title, description, image_url, image_path, blurred_path, taken_at)
  on public.album_cards to authenticated;

-- A cromo's description is a reward: not readable directly (see
-- unlocked_card_descriptions()). Every other column is.
revoke select on public.album_cards from authenticated;
grant select (id, channel_id, number, person_id, title, image_url, image_path, blurred_path, taken_at, created_at, author_id)
  on public.album_cards to authenticated;

-- Per-user data: only the owner, only in their channels.
create policy "favorites: own" on public.favorites for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_member(channel_id));
create policy "progress: own" on public.watch_progress for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_member(channel_id));
-- Views: members see all views of their channels ("Lo más visto"), insert their own.
create policy "views: members read" on public.video_views for select to authenticated using (public.is_member(channel_id));
create policy "views: insert own" on public.video_views for insert to authenticated
  with check (user_id = auth.uid() and public.is_member(channel_id));
-- Copies and packs: read your own; written only by open_pack().
create policy "copies: own" on public.card_copies for select to authenticated using (user_id = auth.uid());
create policy "packs: own" on public.pack_openings for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 7. Server functions (RPC)
-- ---------------------------------------------------------------------------

create or replace function public.require_user()
returns uuid language plpgsql stable as $$
begin
  if auth.uid() is null then
    raise exception 'Inicia sesión para continuar' using errcode = '42501';
  end if;
  return auth.uid();
end $$;

-- Creates a channel; the caller becomes its first admin.
create or replace function public.create_channel(
  p_name text, p_description text, p_kind text, p_pack_theme text default 'clasico', p_cover_url text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_user uuid := public.require_user(); v_id uuid; v_name text;
begin
  select display_name into v_name from profiles where id = v_user;
  insert into channels (name, description, kind, pack_theme, cover_url, created_by)
    values (btrim(p_name), coalesce(p_description, ''), p_kind, coalesce(p_pack_theme, 'clasico'), nullif(p_cover_url, ''), v_user)
    returning id into v_id;
  insert into channel_members (channel_id, user_id, display_name, role) values (v_id, v_user, coalesce(v_name, 'Invitado'), 'admin');
  return v_id;
end $$;

-- Single-use invitation code (unambiguous alphabet, CSPRNG), 1-90 days.
create or replace function public.create_invitation(p_channel uuid, p_days integer)
returns public.invitations language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := public.require_user();
  v_alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text; v_bytes bytea; v_row invitations;
begin
  if not public.is_admin(p_channel) then raise exception 'Solo un administrador puede hacer esto' using errcode = '42501'; end if;
  if p_days is null or p_days < 1 or p_days > 90 then raise exception 'La caducidad debe estar entre 1 y 90 días' using errcode = '22023'; end if;
  loop
    v_code := '';
    -- Rejection sampling: bytes >= 248 (= 8 * 31) are skipped so every
    -- character has exactly the same probability.
    while char_length(replace(v_code, '-', '')) < 12 loop
      v_bytes := extensions.gen_random_bytes(16);
      for i in 0..15 loop
        exit when char_length(replace(v_code, '-', '')) = 12;
        continue when get_byte(v_bytes, i) >= 248;
        v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 31) + 1, 1);
        if char_length(v_code) in (4, 9) then v_code := v_code || '-'; end if;
      end loop;
    end loop;
    exit when not exists (select 1 from invitations where code = v_code);
  end loop;
  insert into invitations (channel_id, code, created_by, expires_at)
    values (p_channel, v_code, v_user, now() + make_interval(days => p_days))
    returning * into v_row;
  return v_row;
end $$;

create or replace function public.revoke_invitation(p_invitation uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_channel uuid;
begin
  perform public.require_user();
  select channel_id into v_channel from invitations where id = p_invitation;
  if v_channel is null or not public.is_admin(v_channel) then raise exception 'Solo un administrador puede hacer esto' using errcode = '42501'; end if;
  update invitations set revoked_at = now()
    where id = p_invitation and used_at is null and revoked_at is null and expires_at > now();
  if not found then raise exception 'Solo se pueden revocar invitaciones activas' using errcode = '22023'; end if;
end $$;

-- Joins the channel of a valid code. Same message for every invalid case.
create or replace function public.redeem_invitation(p_code text, p_display_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_user uuid := public.require_user(); v_inv invitations; v_code text;
begin
  v_code := upper(regexp_replace(coalesce(p_code, ''), '[\s-]', '', 'g'));
  if char_length(v_code) = 12 then
    v_code := substr(v_code, 1, 4) || '-' || substr(v_code, 5, 4) || '-' || substr(v_code, 9, 4);
  end if;
  select * into v_inv from invitations where code = v_code for update;
  if v_inv.id is null or v_inv.used_at is not null or v_inv.revoked_at is not null or v_inv.expires_at <= now() then
    raise exception 'La invitación no es válida o ha caducado' using errcode = '22023';
  end if;
  if exists (select 1 from channel_members where channel_id = v_inv.channel_id and user_id = v_user) then
    raise exception 'Ya formas parte de este canal' using errcode = '23505';
  end if;
  update invitations set used_at = now(), used_by = v_user where id = v_inv.id;
  insert into channel_members (channel_id, user_id, display_name, role, invitation_id)
    values (v_inv.channel_id, v_user, left(btrim(coalesce(nullif(p_display_name, ''), 'Invitado')), 40), 'member', v_inv.id);
  return v_inv.channel_id;
end $$;

-- Role changes and removals keep at least one admin per channel.
create or replace function public.set_member_role(p_channel uuid, p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_user();
  if not public.is_admin(p_channel) then raise exception 'Solo un administrador puede hacer esto' using errcode = '42501'; end if;
  if p_role not in ('admin', 'member') then raise exception 'Rol inválido' using errcode = '22023'; end if;
  if p_role = 'member' and (select role from channel_members where channel_id = p_channel and user_id = p_user) = 'admin'
     and (select count(*) from channel_members where channel_id = p_channel and role = 'admin') = 1 then
    raise exception 'El canal necesita al menos un administrador' using errcode = '23514';
  end if;
  update channel_members set role = p_role where channel_id = p_channel and user_id = p_user;
  if not found then raise exception 'Ese miembro no existe' using errcode = '02000'; end if;
end $$;

create or replace function public.remove_member(p_channel uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.require_user() = p_user then raise exception 'Para salir del canal usa «Salir del canal»' using errcode = '22023'; end if;
  if not public.is_admin(p_channel) then raise exception 'Solo un administrador puede hacer esto' using errcode = '42501'; end if;
  delete from channel_members where channel_id = p_channel and user_id = p_user;
  delete from favorites where channel_id = p_channel and user_id = p_user;
  delete from watch_progress where channel_id = p_channel and user_id = p_user;
  delete from card_copies where channel_id = p_channel and user_id = p_user;
end $$;

-- Leaving: the last member deletes the channel; the last admin must hand over first.
create or replace function public.leave_channel(p_channel uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := public.require_user(); v_role text;
begin
  select role into v_role from channel_members where channel_id = p_channel and user_id = v_user;
  if v_role is null then raise exception 'Este canal no existe' using errcode = '02000'; end if;
  if (select count(*) from channel_members where channel_id = p_channel) = 1 then
    delete from channels where id = p_channel;
    return;
  end if;
  if v_role = 'admin' and (select count(*) from channel_members where channel_id = p_channel and role = 'admin') = 1 then
    raise exception 'Nombra a otro administrador antes de salir del canal' using errcode = '23514';
  end if;
  delete from channel_members where channel_id = p_channel and user_id = v_user;
  delete from favorites where channel_id = p_channel and user_id = v_user;
  delete from watch_progress where channel_id = p_channel and user_id = v_user;
  delete from card_copies where channel_id = p_channel and user_id = v_user;
end $$;

-- Descriptions of the cromos the caller has unlocked (admins: all of their channels).
create or replace function public.unlocked_card_descriptions()
returns table (card_id uuid, description text) language sql stable security definer set search_path = public as $$
  select c.id, c.description from album_cards c
  where exists (select 1 from card_copies cc where cc.card_id = c.id and cc.user_id = auth.uid())
     or public.is_admin(c.channel_id)
$$;

-- «Lo más visto»: views per video in the caller's channels (already counted).
create or replace function public.video_view_counts()
returns table (video_id uuid, views bigint) language sql stable security definer set search_path = public as $$
  select v.video_id, count(*) from video_views v where public.is_member(v.channel_id) group by v.video_id
$$;

-- Today's pack allowance for the caller, in their time zone.
create or replace function public.pack_status(p_tz text)
returns table (per_day integer, opened_today integer, remaining integer)
language plpgsql stable security definer set search_path = public as $$
declare v_today date; v_opened integer;
begin
  perform public.require_user();
  if not exists (select 1 from pg_timezone_names where name = p_tz) then p_tz := 'UTC'; end if;
  v_today := (now() at time zone p_tz)::date;
  select count(*) into v_opened from pack_openings where user_id = auth.uid() and opened_on = v_today;
  return query select 3, v_opened, greatest(0, 3 - v_opened);
end $$;

-- Opens one of today's 3 packs: 5 cromos of the channel, same odds for all,
-- no repeats inside the pack when the album has at least 5. Duplicates
-- accumulate. The pack is consumed here (server side).
create or replace function public.open_pack(p_channel uuid, p_tz text)
returns table (card_id uuid, is_new boolean, copies integer)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := public.require_user();
  v_today date; v_pool integer; v_cards uuid[]; v_card uuid; v_count integer;
begin
  if not public.is_member(p_channel) then raise exception 'Este canal no existe' using errcode = '02000'; end if;
  if not exists (select 1 from pg_timezone_names where name = p_tz) then p_tz := 'UTC'; end if;
  v_today := (now() at time zone p_tz)::date;
  -- Serialise this user's openings so two taps can't exceed the allowance.
  perform pg_advisory_xact_lock(hashtext('open_pack:' || v_user::text));
  if (select count(*) from pack_openings where user_id = v_user and opened_on = v_today) >= 3 then
    raise exception 'Ya has abierto todos los sobres de hoy. ¡Vuelve mañana!' using errcode = '23514';
  end if;
  select count(*) into v_pool from album_cards where channel_id = p_channel;
  if v_pool = 0 then raise exception 'Este álbum todavía no tiene cromos' using errcode = '23514'; end if;
  if v_pool >= 5 then
    select array_agg(id) into v_cards from (select id from album_cards where channel_id = p_channel order by random() limit 5) s;
  else
    select array_agg(c.id) into v_cards from generate_series(1, 5) g
      cross join lateral (select id from album_cards where channel_id = p_channel and g = g order by random() limit 1) c;
  end if;
  insert into pack_openings (channel_id, user_id, opened_on, card_ids) values (p_channel, v_user, v_today, v_cards);
  foreach v_card in array v_cards loop
    select cc.count into v_count from card_copies cc where cc.user_id = v_user and cc.card_id = v_card;
    if v_count is null then
      insert into card_copies (user_id, card_id, channel_id, count) values (v_user, v_card, p_channel, 1);
      card_id := v_card; is_new := true; copies := 1;
    else
      update card_copies cc set count = cc.count + 1 where cc.user_id = v_user and cc.card_id = v_card;
      card_id := v_card; is_new := false; copies := v_count + 1;
    end if;
    return next;
  end loop;
end $$;

-- Functions are callable only by signed-in users.
revoke execute on all functions in schema public from anon, public;
grant execute on function
  public.is_member(uuid), public.is_admin(uuid), public.is_partial_date(text),
  public.create_channel(text, text, text, text, text), public.create_invitation(uuid, integer),
  public.revoke_invitation(uuid), public.redeem_invitation(text, text),
  public.set_member_role(uuid, uuid, text), public.remove_member(uuid, uuid), public.leave_channel(uuid),
  public.unlocked_card_descriptions(), public.video_view_counts(), public.pack_status(text), public.open_pack(uuid, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Storage (private buckets; paths start with the channel id)
--    cromos/<channel>/<card>.webp           original: unlocked owners + admins
--    cromos/<channel>/<card>_blur.webp      blurred: every member
--    personas/<channel>/<person>.webp       members read, admins write
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('cromos', 'cromos', false, 5242880, array['image/webp', 'image/jpeg', 'image/png']),
  ('personas', 'personas', false, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create or replace function public.storage_channel(p_name text)
returns uuid language sql immutable as $$
  select case when split_part(p_name, '/', 1) ~ '^[0-9a-f-]{36}$' then split_part(p_name, '/', 1)::uuid end
$$;
grant execute on function public.storage_channel(text) to authenticated;

create policy "cromos: read blurred, unlocked or admin" on storage.objects for select to authenticated using (
  bucket_id = 'cromos' and public.is_member(public.storage_channel(name)) and (
    name like '%\_blur.webp'
    or public.is_admin(public.storage_channel(name))
    or exists (
      select 1 from public.album_cards c join public.card_copies cc on cc.card_id = c.id
      where c.image_path = storage.objects.name and cc.user_id = auth.uid()
    )
  )
);
create policy "cromos: admins write" on storage.objects for insert to authenticated
  with check (bucket_id = 'cromos' and public.is_admin(public.storage_channel(name)));
create policy "cromos: admins update" on storage.objects for update to authenticated
  using (bucket_id = 'cromos' and public.is_admin(public.storage_channel(name)));
create policy "cromos: admins delete" on storage.objects for delete to authenticated
  using (bucket_id = 'cromos' and public.is_admin(public.storage_channel(name)));

create policy "personas: members read" on storage.objects for select to authenticated
  using (bucket_id = 'personas' and public.is_member(public.storage_channel(name)));
create policy "personas: admins write" on storage.objects for insert to authenticated
  with check (bucket_id = 'personas' and public.is_admin(public.storage_channel(name)));
create policy "personas: admins update" on storage.objects for update to authenticated
  using (bucket_id = 'personas' and public.is_admin(public.storage_channel(name)));
create policy "personas: admins delete" on storage.objects for delete to authenticated
  using (bucket_id = 'personas' and public.is_admin(public.storage_channel(name)));
