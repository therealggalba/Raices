-- =============================================================================
-- Raíces — photos uploaded from the app, yearly day-only dates, no invitations
-- for people who passed away
--
-- Photos are compressed in the app and stored in private buckets:
--   cromos/<channel>/<file>.webp (+ <file>_blur.webp)   already existed
--   personas/<channel>/<person>/<file>.webp             profile photos
--   miniaturas/<channel>/<file>.webp                    video covers (new)
-- Members can upload their own profile photo; everything else, admins.
--
-- Run once in: Supabase Dashboard > SQL Editor, after 0005_inbox_self_edit.sql.
-- Safe to run more than once.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Yearly dates without a count of years (saint's day, family traditions)
-- ---------------------------------------------------------------------------

alter table public.events drop constraint if exists events_type_check;
alter table public.events add constraint events_type_check check (
  type in ('cumpleanos', 'aniversario', 'comunion', 'bautizo', 'boda', 'fallecimiento', 'santo', 'dia_senalado', 'otro')
);

-- ---------------------------------------------------------------------------
-- 2. Stored photos
-- ---------------------------------------------------------------------------

alter table public.people add column if not exists photo_path text;
alter table public.people drop constraint if exists people_photo_path_check;
alter table public.people add constraint people_photo_path_check check (
  photo_path is null
  or (split_part(photo_path, '/', 1) = channel_id::text and split_part(photo_path, '/', 2) = id::text
      and photo_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[A-Za-z0-9_-]{1,64}\.webp$')
);

alter table public.videos add column if not exists thumbnail_path text;
alter table public.videos drop constraint if exists videos_thumbnail_path_check;
alter table public.videos add constraint videos_thumbnail_path_check check (
  thumbnail_path is null
  or (split_part(thumbnail_path, '/', 1) = channel_id::text
      and thumbnail_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{1,64}\.webp$')
);
grant update (thumbnail_path) on public.videos to authenticated;

-- Cromo files must belong to the cromo's channel.
alter table public.album_cards drop constraint if exists album_cards_paths_check;
alter table public.album_cards add constraint album_cards_paths_check check (
  (image_path is null or (split_part(image_path, '/', 1) = channel_id::text
      and image_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{1,64}\.webp$'))
  and (blurred_path is null or (split_part(blurred_path, '/', 1) = channel_id::text
      and blurred_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{1,64}_blur\.webp$'))
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('miniaturas', 'miniaturas', false, 3145728, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

drop policy if exists "miniaturas: members read" on storage.objects;
create policy "miniaturas: members read" on storage.objects for select to authenticated
  using (bucket_id = 'miniaturas' and public.is_member(public.storage_channel(name)));
drop policy if exists "miniaturas: admins write" on storage.objects;
create policy "miniaturas: admins write" on storage.objects for insert to authenticated
  with check (bucket_id = 'miniaturas' and public.is_admin(public.storage_channel(name)));
drop policy if exists "miniaturas: admins update" on storage.objects;
create policy "miniaturas: admins update" on storage.objects for update to authenticated
  using (bucket_id = 'miniaturas' and public.is_admin(public.storage_channel(name)));
drop policy if exists "miniaturas: admins delete" on storage.objects;
create policy "miniaturas: admins delete" on storage.objects for delete to authenticated
  using (bucket_id = 'miniaturas' and public.is_admin(public.storage_channel(name)));

-- A member may upload photos into their own person's folder.
drop policy if exists "personas: members upload own photo" on storage.objects;
create policy "personas: members upload own photo" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'personas' and exists (
      select 1 from public.channel_members m
      where m.channel_id = public.storage_channel(name) and m.user_id = auth.uid()
        and m.person_id::text = split_part(name, '/', 2)
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Own card: now also the uploaded photo
-- ---------------------------------------------------------------------------

drop function if exists public.update_my_person(uuid, text, text, date, text, text, text);

create or replace function public.update_my_person(
  p_channel uuid, p_first_name text, p_last_name text, p_birth_date date, p_gender text,
  p_photo_url text, p_photo_path text, p_biography text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := public.require_user();
  v_member channel_members;
  v_old people;
  v_new people;
  v_changes jsonb := '[]';
begin
  select * into v_member from channel_members where channel_id = p_channel and user_id = v_user;
  if v_member.user_id is null then raise exception 'Este canal no existe' using errcode = '02000'; end if;
  if v_member.person_id is null then raise exception 'Primero elige quién eres en este canal' using errcode = '42501'; end if;
  select * into v_old from people where id = v_member.person_id;

  update people set
    first_name = btrim(coalesce(p_first_name, '')),
    last_name = btrim(coalesce(p_last_name, '')),
    birth_date = p_birth_date,
    gender = nullif(p_gender, ''),
    photo_url = nullif(btrim(coalesce(p_photo_url, '')), ''),
    photo_path = nullif(btrim(coalesce(p_photo_path, '')), ''),
    biography = coalesce(p_biography, '')
  where id = v_member.person_id
  returning * into v_new;

  select coalesce(jsonb_agg(jsonb_build_object('field', f, 'before', b, 'after', a)), '[]') into v_changes
  from (values
    ('firstName', v_old.first_name, v_new.first_name),
    ('lastName', v_old.last_name, v_new.last_name),
    ('birthDate', coalesce(v_old.birth_date::text, ''), coalesce(v_new.birth_date::text, '')),
    ('gender', coalesce(v_old.gender, ''), coalesce(v_new.gender, '')),
    ('photoUrl', coalesce(v_old.photo_path, v_old.photo_url, ''), coalesce(v_new.photo_path, v_new.photo_url, '')),
    ('biography', v_old.biography, v_new.biography)
  ) as c(f, b, a)
  where b is distinct from a;

  if jsonb_array_length(v_changes) > 0 and v_member.role <> 'admin' then
    insert into channel_notifications (channel_id, kind, actor_id, actor_name, person_id, changes)
      values (p_channel, 'person_edited', v_user, v_member.display_name, v_member.person_id, v_changes);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. No invitations for people who passed away
-- ---------------------------------------------------------------------------

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

revoke execute on function public.update_my_person(uuid, text, text, date, text, text, text, text),
  public.create_invitation(uuid, integer, uuid) from public, anon;
grant execute on function public.update_my_person(uuid, text, text, date, text, text, text, text),
  public.create_invitation(uuid, integer, uuid) to authenticated;
