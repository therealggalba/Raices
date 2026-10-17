-- =============================================================================
-- FamilyMemories — people details and «Esta persona soy yo»
--
-- People get an optional gender (for kinship words: tío / tía) and date of
-- death. Each member can link themselves to the person of the channel they
-- are, so the family tree shows kinship relative to whoever is looking.
--
-- Run once in: Supabase Dashboard > SQL Editor, after 0002_usernames.sql.
-- =============================================================================

-- Safe to run more than once.
alter table public.people
  add column if not exists death_date date,
  add column if not exists gender text check (gender in ('hombre', 'mujer'));
alter table public.people drop constraint if exists people_death_after_birth;
alter table public.people add constraint people_death_after_birth
  check (death_date is null or birth_date is null or death_date >= birth_date);

-- One person per member and one member per person, inside a channel.
alter table public.channel_members
  add column if not exists person_id uuid references public.people (id) on delete set null;
create unique index if not exists channel_members_person_key on public.channel_members (channel_id, person_id)
  where person_id is not null;

-- Members link themselves; an admin can only undo someone else's link.
create or replace function public.set_member_person(p_channel uuid, p_user uuid, p_person uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := public.require_user(); v_taken text;
begin
  if not public.is_member(p_channel) then raise exception 'Este canal no existe' using errcode = '02000'; end if;
  if p_user <> v_user and (p_person is not null or not public.is_admin(p_channel)) then
    raise exception 'Cada miembro elige quién es; un administrador solo puede deshacerlo' using errcode = '42501';
  end if;
  if p_person is not null then
    if not exists (select 1 from people where id = p_person and channel_id = p_channel) then
      raise exception 'Esa persona no existe en el canal' using errcode = '02000';
    end if;
    select display_name into v_taken from channel_members
      where channel_id = p_channel and person_id = p_person and user_id <> p_user;
    if v_taken is not null then
      raise exception 'Esta persona ya está enlazada con %', v_taken using errcode = '23505';
    end if;
  end if;
  update channel_members set person_id = p_person where channel_id = p_channel and user_id = p_user;
  if not found then raise exception 'Ese miembro no existe' using errcode = '02000'; end if;
end $$;

revoke execute on function public.set_member_person(uuid, uuid, uuid) from public, anon;
grant execute on function public.set_member_person(uuid, uuid, uuid) to authenticated;
