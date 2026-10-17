-- =============================================================================
-- Raíces — invitations for a specific person
--
-- Every invitation is made by an admin FOR one person of the channel: whoever
-- redeems it becomes that person (so the admin knows who came in and kinship
-- works from the first minute). Members can't change who they are later; only
-- admins can fix it. People who passed away are remembered on the day they
-- died: new event type «fallecimiento».
--
-- Run once in: Supabase Dashboard > SQL Editor, after 0003_people_details.sql.
-- =============================================================================

-- Safe to run more than once.
alter table public.invitations
  add column if not exists person_id uuid references public.people (id) on delete cascade;

alter table public.events drop constraint if exists events_type_check;
alter table public.events add constraint events_type_check
  check (type in ('cumpleanos', 'aniversario', 'comunion', 'bautizo', 'boda', 'fallecimiento', 'otro'));

drop function if exists public.create_invitation(uuid, integer);

-- Single-use invitation code for one person (unambiguous alphabet, CSPRNG), 1-90 days.
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
  select display_name into v_taken from channel_members where channel_id = p_channel and person_id = p_person;
  if v_taken is not null then
    raise exception 'Esa persona ya está en el canal (%)', v_taken using errcode = '23505';
  end if;
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
  insert into invitations (channel_id, code, created_by, expires_at, person_id)
    values (p_channel, v_code, v_user, now() + make_interval(days => p_days), p_person)
    returning * into v_row;
  return v_row;
end $$;

-- Joins the channel of a valid code as the person it was made for.
create or replace function public.redeem_invitation(p_code text, p_display_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_user uuid := public.require_user(); v_inv invitations; v_code text; v_person uuid;
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
  -- The person, unless someone else took it in the meantime.
  if v_inv.person_id is not null and not exists (
    select 1 from channel_members where channel_id = v_inv.channel_id and person_id = v_inv.person_id
  ) then
    v_person := v_inv.person_id;
  end if;
  update invitations set used_at = now(), used_by = v_user where id = v_inv.id;
  insert into channel_members (channel_id, user_id, display_name, role, invitation_id, person_id)
    values (v_inv.channel_id, v_user, left(btrim(coalesce(nullif(p_display_name, ''), 'Invitado')), 40), 'member', v_inv.id, v_person);
  return v_inv.channel_id;
end $$;

-- Who each member is: admins set or clear anyone's; a member without one
-- picks their own once.
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
    select display_name into v_taken from channel_members
      where channel_id = p_channel and person_id = p_person and user_id <> p_user;
    if v_taken is not null then
      raise exception 'Esta persona ya está enlazada con %', v_taken using errcode = '23505';
    end if;
  end if;
  update channel_members set person_id = p_person where channel_id = p_channel and user_id = p_user;
end $$;

revoke execute on function public.create_invitation(uuid, integer, uuid), public.redeem_invitation(text, text),
  public.set_member_person(uuid, uuid, uuid) from public, anon;
grant execute on function public.create_invitation(uuid, integer, uuid), public.redeem_invitation(text, text),
  public.set_member_person(uuid, uuid, uuid) to authenticated;
