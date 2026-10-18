-- =============================================================================
-- Raíces — pets, and the log of suggestions sent to the app's owner
--
-- Pets live in the people table (kind = 'mascota', with a species): they have
-- their own dates, photos and videos, but no family tree, and they can never
-- be members of a channel.
-- Suggestions are written only by the «send-feedback» Edge Function (it
-- screens and e-mails them); no user can read or write the table.
--
-- Run once in: Supabase Dashboard > SQL Editor, after 0006_uploads_dates.sql.
-- Safe to run more than once.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Pets
-- ---------------------------------------------------------------------------

alter table public.people
  add column if not exists kind text not null default 'persona',
  add column if not exists species text;
alter table public.people drop constraint if exists people_kind_check;
alter table public.people add constraint people_kind_check check (
  (kind = 'persona' and species is null)
  or (kind = 'mascota' and species is not null and species in ('perro', 'gato', 'ave', 'conejo', 'roedor', 'pez', 'reptil', 'caballo', 'otro')
      and cardinality(parent_ids) = 0)
);

-- Parents: same channel, people (not pets), not oneself, no ancestry loops.
create or replace function public.check_person_parents()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.id = any (new.parent_ids) then
    raise exception 'Una persona no puede ser su propio progenitor' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(new.parent_ids) as p(id)
    where not exists (
      select 1 from people where people.id = p.id and people.channel_id = new.channel_id and people.kind = 'persona'
    )
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

-- Couples: two people (not pets) of the channel.
create or replace function public.check_partnership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from people
      where id in (new.person_a, new.person_b) and channel_id = new.channel_id and kind = 'persona') <> 2 then
    raise exception 'La pareja debe ser de dos personas del canal' using errcode = '22023';
  end if;
  return new;
end $$;

-- Invitations: living people only.
create or replace function public.create_invitation(p_channel uuid, p_days integer, p_person uuid)
returns public.invitations language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := public.require_user();
  v_alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text; v_bytes bytea; v_row invitations; v_taken text;
begin
  if not public.is_admin(p_channel) then raise exception 'Solo un administrador puede hacer esto' using errcode = '42501'; end if;
  if p_days is null or p_days < 1 or p_days > 90 then raise exception 'La caducidad debe estar entre 1 y 90 días' using errcode = '22023'; end if;
  if p_person is null or not exists (select 1 from people where id = p_person and channel_id = p_channel) then
    raise exception 'Elige para quién es la invitación' using errcode = '22023';
  end if;
  if exists (select 1 from people where id = p_person and kind = 'mascota') then
    raise exception 'Las mascotas no pueden ser miembros del canal' using errcode = '22023';
  end if;
  if exists (select 1 from people where id = p_person and death_date is not null) then
    raise exception 'No se puede invitar a una persona fallecida' using errcode = '22023';
  end if;
  select display_name into v_taken from channel_members where channel_id = p_channel and person_id = p_person;
  if v_taken is not null then
    raise exception 'Esa persona ya está en el canal (%)', v_taken using errcode = '23505';
  end if;
  loop
    v_code := '';
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
  insert into invitations (channel_id, code, created_by, expires_at, person_id)
    values (p_channel, v_code, v_user, now() + make_interval(days => p_days), p_person)
    returning * into v_row;
  return v_row;
end $$;

-- Who each member is: a person, never a pet.
create or replace function public.set_member_person(p_channel uuid, p_user uuid, p_person uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := public.require_user(); v_taken text; v_current uuid;
begin
  if not public.is_member(p_channel) then raise exception 'Este canal no existe' using errcode = '02000'; end if;
  select person_id into v_current from channel_members where channel_id = p_channel and user_id = p_user;
  if not found then raise exception 'Ese miembro no existe' using errcode = '02000'; end if;
  if not public.is_admin(p_channel) and not (p_user = v_user and v_current is null and p_person is not null) then
    raise exception 'Solo un administrador puede cambiar quién es cada miembro' using errcode = '42501';
  end if;
  if p_person is not null then
    if not exists (select 1 from people where id = p_person and channel_id = p_channel) then
      raise exception 'Esa persona no existe en el canal' using errcode = '02000';
    end if;
    if exists (select 1 from people where id = p_person and kind = 'mascota') then
      raise exception 'Un miembro no puede ser una mascota' using errcode = '22023';
    end if;
    select display_name into v_taken from channel_members
      where channel_id = p_channel and person_id = p_person and user_id <> p_user;
    if v_taken is not null then
      raise exception 'Esta persona ya está enlazada con %', v_taken using errcode = '23505';
    end if;
  end if;
  update channel_members set person_id = p_person where channel_id = p_channel and user_id = p_user;
end $$;

revoke execute on function public.create_invitation(uuid, integer, uuid), public.set_member_person(uuid, uuid, uuid)
  from public, anon;
grant execute on function public.create_invitation(uuid, integer, uuid), public.set_member_person(uuid, uuid, uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Suggestions (written by the Edge Function with the service key)
-- ---------------------------------------------------------------------------

create table if not exists public.feedback_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  subject text not null check (char_length(subject) between 3 and 120),
  message text not null check (char_length(message) between 10 and 4000),
  verdict text not null check (verdict in ('ok', 'review', 'reject')),
  reasons text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists feedback_messages_user_idx on public.feedback_messages (user_id, created_at desc);
alter table public.feedback_messages enable row level security;
revoke all on public.feedback_messages from anon, authenticated;
