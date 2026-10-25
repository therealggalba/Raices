-- =============================================================================
-- Raíces — creator, admins and members; content approval; reminder time
--
-- Roles in a channel:
--   owner  (the creator; exactly one per channel) manages everything:
--          invitations, settings, members, the family tree, everyone's data,
--          and approves what the others upload. Can hand the channel over.
--   admin  uploads videos and cromos of anyone; edits their own data.
--   member uploads videos and cromos in which they appear; edits their own data.
-- What admins and members upload (or edit) waits for the owner's approval.
-- Anyone edits the important dates in which they appear.
--
-- is_admin() keeps its name (every policy and function of 0001-0008 uses it)
-- but from now on means «manages the channel», i.e. is its owner.
--
-- Run once in: Supabase Dashboard > SQL Editor, after 0008_deletion.sql.
-- Safe to run more than once.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Roles: one owner per channel
-- ---------------------------------------------------------------------------

alter table public.channel_members drop constraint if exists channel_members_role_check;
alter table public.channel_members add constraint channel_members_role_check
  check (role in ('owner', 'admin', 'member'));

-- Each channel's owner: its creator if still an admin there, otherwise its
-- oldest admin, otherwise its oldest member.
update public.channel_members m set role = 'owner'
from (
  select distinct on (cm.channel_id) cm.channel_id, cm.user_id
  from public.channel_members cm join public.channels c on c.id = cm.channel_id
  where not exists (select 1 from public.channel_members o where o.channel_id = cm.channel_id and o.role = 'owner')
  order by cm.channel_id,
    (cm.user_id = c.created_by and cm.role = 'admin') desc,
    (cm.role = 'admin') desc,
    cm.joined_at
) pick
where m.channel_id = pick.channel_id and m.user_id = pick.user_id;

create unique index if not exists channel_members_one_owner on public.channel_members (channel_id) where role = 'owner';

create or replace function public.is_owner(p_channel uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from channel_members where channel_id = p_channel and user_id = auth.uid() and role = 'owner'
  )
$$;

-- Managing the channel is the owner's job (see the header).
create or replace function public.is_admin(p_channel uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_owner(p_channel)
$$;

-- May the caller upload content showing these people? Owner and admins:
-- anyone; members: only content in which they appear.
create or replace function public.can_upload_about(p_channel uuid, p_people uuid[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from channel_members
    where channel_id = p_channel and user_id = auth.uid()
      and (role in ('owner', 'admin') or (person_id is not null and person_id = any (coalesce(p_people, '{}'))))
  )
$$;

-- May the caller upload files to the channel at all (before the row exists)?
create or replace function public.can_upload(p_channel uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from channel_members
    where channel_id = p_channel and user_id = auth.uid() and (role in ('owner', 'admin') or person_id is not null)
  )
$$;

-- Does the caller appear in these people (their person in the channel)?
create or replace function public.appears_in(p_channel uuid, p_people uuid[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from channel_members
    where channel_id = p_channel and user_id = auth.uid()
      and person_id is not null and person_id = any (coalesce(p_people, '{}'))
  )
$$;

-- The creator of a new channel is its owner.
create or replace function public.create_channel(
  p_name text, p_description text, p_kind text, p_pack_theme text default 'clasico', p_cover_url text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_user uuid := public.require_user(); v_id uuid; v_name text;
begin
  select display_name into v_name from profiles where id = v_user;
  insert into channels (name, description, kind, pack_theme, cover_url, created_by)
    values (btrim(p_name), coalesce(p_description, ''), p_kind, coalesce(p_pack_theme, 'clasico'), nullif(p_cover_url, ''), v_user)
    returning id into v_id;
  insert into channel_members (channel_id, user_id, display_name, role) values (v_id, v_user, coalesce(v_name, 'Invitado'), 'owner');
  return v_id;
end $$;

-- The owner names admins and members (ownership moves only by handing it over).
create or replace function public.set_member_role(p_channel uuid, p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_user();
  if not public.is_owner(p_channel) then raise exception 'Solo el creador del canal puede hacer esto' using errcode = '42501'; end if;
  if p_role not in ('admin', 'member') then raise exception 'Rol inválido' using errcode = '22023'; end if;
  if exists (select 1 from channel_members where channel_id = p_channel and user_id = p_user and role = 'owner') then
    raise exception 'El creador no cambia de rol: cede el canal a otro miembro' using errcode = '23514';
  end if;
  update channel_members set role = p_role where channel_id = p_channel and user_id = p_user and role <> 'owner';
  if not found then raise exception 'Ese miembro no existe' using errcode = '02000'; end if;
end $$;

-- Hands the channel over to another member; the former owner stays as admin.
create or replace function public.transfer_ownership(p_channel uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := public.require_user();
begin
  if not public.is_owner(p_channel) then raise exception 'Solo el creador del canal puede cederlo' using errcode = '42501'; end if;
  if p_user = v_user then raise exception 'Elige a otro miembro' using errcode = '22023'; end if;
  if not exists (select 1 from channel_members where channel_id = p_channel and user_id = p_user) then
    raise exception 'Ese miembro no existe' using errcode = '02000';
  end if;
  update channel_members set role = 'admin' where channel_id = p_channel and user_id = v_user;
  update channel_members set role = 'owner' where channel_id = p_channel and user_id = p_user;
end $$;

-- Leaving: the last member deletes the channel; the owner hands it over first.
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
  if v_role = 'owner' then
    raise exception 'Cede el canal a otro miembro antes de salir' using errcode = '23514';
  end if;
  delete from channel_members where channel_id = p_channel and user_id = v_user;
  delete from favorites where channel_id = p_channel and user_id = v_user;
  delete from watch_progress where channel_id = p_channel and user_id = v_user;
  delete from card_copies where channel_id = p_channel and user_id = v_user;
end $$;

-- Account deletion: the owner of a channel with other members must hand it over.
create or replace function public.account_deletion_plan()
returns table (channel_id uuid, channel_name text, outcome text)
language sql stable security definer set search_path = public as $$
  select c.id, c.name,
    case
      when (select count(*) from channel_members x where x.channel_id = c.id) = 1 then 'delete'
      when m.role = 'owner' then 'blocked'
      else 'leave'
    end
  from channel_members m join channels c on c.id = m.channel_id
  where m.user_id = auth.uid()
  order by c.name
$$;

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := public.require_user(); v_blocked text;
begin
  select string_agg(channel_name, ', ') into v_blocked from public.account_deletion_plan() where outcome = 'blocked';
  if v_blocked is not null then
    raise exception 'Antes de eliminar tu cuenta, cede estos canales a otro miembro: %', v_blocked using errcode = '23514';
  end if;
  delete from channels where id in (select channel_id from public.account_deletion_plan() where outcome = 'delete');
  delete from favorites where user_id = v_user;
  delete from watch_progress where user_id = v_user;
  delete from card_copies where user_id = v_user;
  delete from channel_members where user_id = v_user;
  delete from auth.users where id = v_user;
end $$;

-- Admins' own corrections are reported too: only the owner skips the inbox.
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

  if jsonb_array_length(v_changes) > 0 and v_member.role <> 'owner' then
    insert into channel_notifications (channel_id, kind, actor_id, actor_name, person_id, changes)
      values (p_channel, 'person_edited', v_user, v_member.display_name, v_member.person_id, v_changes);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Content approval (videos and cromos)
-- ---------------------------------------------------------------------------

alter table public.videos add column if not exists status text not null default 'approved';
alter table public.album_cards add column if not exists status text not null default 'approved';
alter table public.videos drop constraint if exists videos_status_check;
alter table public.videos add constraint videos_status_check check (status in ('pending', 'approved'));
alter table public.album_cards drop constraint if exists album_cards_status_check;
alter table public.album_cards add constraint album_cards_status_check check (status in ('pending', 'approved'));

-- A cromo gets its album number when it is approved.
alter table public.album_cards alter column number drop not null;
grant select (status) on public.album_cards to authenticated;

-- What the owner adds is approved at once; the rest waits. When an author
-- (other than the owner) edits their content, it waits again.
create or replace function public.set_content_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.status := case when public.is_owner(new.channel_id) then 'approved' else 'pending' end;
  elsif not public.is_owner(new.channel_id) then
    -- Only the approve_content() function (as the owner) changes the status.
    new.status := old.status;
    -- (an author deleting their account only clears author_id: no change)
    if auth.uid() = old.author_id and new.author_id is not distinct from old.author_id then
      new.status := 'pending';
    end if;
  end if;
  if tg_table_name = 'album_cards' then
    if new.status = 'approved' and new.number is null then
      update channels set card_sequence = card_sequence + 1 where id = new.channel_id
        returning card_sequence into new.number;
    elsif new.status = 'pending' and tg_op = 'INSERT' then
      new.number := null;
    elsif new.status = 'pending' then
      new.number := old.number;
    end if;
  end if;
  return new;
end $$;

-- A pending cromo that already had a number keeps it (edited after approval).
alter table public.album_cards drop constraint if exists album_cards_number_check;
alter table public.album_cards add constraint album_cards_number_check check (status = 'pending' or number is not null);

drop trigger if exists album_cards_number on public.album_cards;
drop trigger if exists album_cards_status on public.album_cards;
create trigger album_cards_status before insert or update on public.album_cards
  for each row execute function public.set_content_status();
drop trigger if exists videos_status on public.videos;
create trigger videos_status before insert or update on public.videos
  for each row execute function public.set_content_status();

-- The owner approves (rejecting is deleting it).
create or replace function public.approve_content(p_kind text, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_channel uuid;
begin
  perform public.require_user();
  if p_kind = 'video' then
    select channel_id into v_channel from videos where id = p_id;
  elsif p_kind = 'card' then
    select channel_id into v_channel from album_cards where id = p_id;
  else
    raise exception 'Tipo de contenido inválido' using errcode = '22023';
  end if;
  if v_channel is null or not public.is_owner(v_channel) then
    raise exception 'Solo el creador del canal puede aprobar contenido' using errcode = '42501';
  end if;
  if p_kind = 'video' then
    update videos set status = 'approved' where id = p_id;
  else
    update album_cards set status = 'approved' where id = p_id;
  end if;
end $$;

-- Who sees, adds, edits and deletes videos and cromos.
do $$
declare t text;
begin
  foreach t in array array['videos', 'album_cards'] loop
    execute format('drop policy if exists "%1$s: members read" on public.%1$I', t);
    execute format('drop policy if exists "%1$s: admins insert" on public.%1$I', t);
    execute format('drop policy if exists "%1$s: admins update" on public.%1$I', t);
    execute format('drop policy if exists "%1$s: admins delete" on public.%1$I', t);
    execute format('drop policy if exists "%1$s: read approved or own" on public.%1$I', t);
    execute format('drop policy if exists "%1$s: authors delete" on public.%1$I', t);
    execute format('create policy "%1$s: read approved or own" on public.%1$I for select to authenticated using (
      public.is_member(channel_id) and (status = ''approved'' or author_id = auth.uid() or public.is_owner(channel_id)))', t);
    execute format('create policy "%1$s: authors delete" on public.%1$I for delete to authenticated
      using (public.is_owner(channel_id) or (author_id = auth.uid() and public.is_member(channel_id)))', t);
  end loop;
end $$;

drop policy if exists "videos: uploaders insert" on public.videos;
create policy "videos: uploaders insert" on public.videos for insert to authenticated
  with check (public.can_upload_about(channel_id, person_ids));
drop policy if exists "videos: authors update" on public.videos;
create policy "videos: authors update" on public.videos for update to authenticated
  using (public.is_owner(channel_id) or (author_id = auth.uid() and public.is_member(channel_id)))
  with check (public.is_owner(channel_id) or (author_id = auth.uid() and public.can_upload_about(channel_id, person_ids)));

drop policy if exists "album_cards: uploaders insert" on public.album_cards;
create policy "album_cards: uploaders insert" on public.album_cards for insert to authenticated
  with check (public.can_upload_about(channel_id, array[person_id]));
drop policy if exists "album_cards: authors update" on public.album_cards;
create policy "album_cards: authors update" on public.album_cards for update to authenticated
  using (public.is_owner(channel_id) or (author_id = auth.uid() and public.is_member(channel_id)))
  with check (public.is_owner(channel_id) or (author_id = auth.uid() and public.can_upload_about(channel_id, array[person_id])));

-- Important dates: the owner, or anyone who appears in them.
drop policy if exists "events: admins insert" on public.events;
drop policy if exists "events: admins update" on public.events;
drop policy if exists "events: admins delete" on public.events;
drop policy if exists "events: owner or people in it insert" on public.events;
drop policy if exists "events: owner or people in it update" on public.events;
drop policy if exists "events: owner or people in it delete" on public.events;
create policy "events: owner or people in it insert" on public.events for insert to authenticated
  with check (public.is_owner(channel_id) or public.appears_in(channel_id, person_ids));
create policy "events: owner or people in it update" on public.events for update to authenticated
  using (public.is_owner(channel_id) or public.appears_in(channel_id, person_ids))
  with check (public.is_owner(channel_id) or public.appears_in(channel_id, person_ids));
create policy "events: owner or people in it delete" on public.events for delete to authenticated
  using (public.is_owner(channel_id) or public.appears_in(channel_id, person_ids));

-- Authors read the story of their own cromos (approved or not).
create or replace function public.unlocked_card_descriptions()
returns table (card_id uuid, description text) language sql stable security definer set search_path = public as $$
  select c.id, c.description from album_cards c
  where public.is_member(c.channel_id) and (
    (c.status = 'approved' and exists (select 1 from card_copies cc where cc.card_id = c.id and cc.user_id = auth.uid()))
    or public.is_owner(c.channel_id)
    or c.author_id = auth.uid()
  )
$$;

-- Packs only bring approved cromos.
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
  perform pg_advisory_xact_lock(hashtext('open_pack:' || v_user::text));
  if (select count(*) from pack_openings where user_id = v_user and opened_on = v_today) >= 3 then
    raise exception 'Ya has abierto todos los sobres de hoy. ¡Vuelve mañana!' using errcode = '23514';
  end if;
  select count(*) into v_pool from album_cards where channel_id = p_channel and status = 'approved';
  if v_pool = 0 then raise exception 'Este álbum todavía no tiene cromos' using errcode = '23514'; end if;
  if v_pool >= 5 then
    select array_agg(id) into v_cards from (
      select id from album_cards where channel_id = p_channel and status = 'approved' order by random() limit 5
    ) s;
  else
    select array_agg(c.id) into v_cards from generate_series(1, 5) g
      cross join lateral (
        select id from album_cards where channel_id = p_channel and status = 'approved' and g = g order by random() limit 1
      ) c;
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

-- ---------------------------------------------------------------------------
-- 3. Storage: uploaders write cromos and covers; they manage their own files
-- ---------------------------------------------------------------------------

drop policy if exists "cromos: read blurred, unlocked or admin" on storage.objects;
create policy "cromos: read blurred, unlocked or admin" on storage.objects for select to authenticated using (
  bucket_id = 'cromos' and public.is_member(public.storage_channel(name)) and (
    name like '%\_blur.webp'
    or public.is_owner(public.storage_channel(name))
    or owner_id = auth.uid()::text
    or exists (
      select 1 from public.album_cards c join public.card_copies cc on cc.card_id = c.id
      where c.image_path = storage.objects.name and cc.user_id = auth.uid()
    )
  )
);

do $$
declare b text;
begin
  foreach b in array array['cromos', 'miniaturas'] loop
    execute format('drop policy if exists "%1$s: admins write" on storage.objects', b);
    execute format('drop policy if exists "%1$s: admins update" on storage.objects', b);
    execute format('drop policy if exists "%1$s: admins delete" on storage.objects', b);
    execute format('drop policy if exists "%1$s: uploaders write" on storage.objects', b);
    execute format('drop policy if exists "%1$s: owner or uploader update" on storage.objects', b);
    execute format('drop policy if exists "%1$s: owner or uploader delete" on storage.objects', b);
    execute format('create policy "%1$s: uploaders write" on storage.objects for insert to authenticated
      with check (bucket_id = %1$L and public.can_upload(public.storage_channel(name)))', b);
    execute format('create policy "%1$s: owner or uploader update" on storage.objects for update to authenticated
      using (bucket_id = %1$L and (public.is_owner(public.storage_channel(name))
        or (owner_id = auth.uid()::text and public.is_member(public.storage_channel(name)))))', b);
    execute format('create policy "%1$s: owner or uploader delete" on storage.objects for delete to authenticated
      using (bucket_id = %1$L and (public.is_owner(public.storage_channel(name))
        or (owner_id = auth.uid()::text and public.is_member(public.storage_channel(name)))))', b);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Time of the date reminders, per channel (owner)
-- ---------------------------------------------------------------------------

alter table public.channels add column if not exists notify_at text not null default '09:00';
alter table public.channels drop constraint if exists channels_notify_at_check;
alter table public.channels add constraint channels_notify_at_check check (notify_at ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
grant update (notify_at) on public.channels to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Who can call the new functions
-- ---------------------------------------------------------------------------

revoke execute on function public.set_content_status() from public, anon, authenticated;
revoke execute on function public.is_owner(uuid), public.can_upload_about(uuid, uuid[]), public.can_upload(uuid),
  public.appears_in(uuid, uuid[]), public.transfer_ownership(uuid, uuid), public.approve_content(text, uuid)
  from public, anon;
grant execute on function public.is_owner(uuid), public.can_upload_about(uuid, uuid[]), public.can_upload(uuid),
  public.appears_in(uuid, uuid[]), public.transfer_ownership(uuid, uuid), public.approve_content(text, uuid)
  to authenticated;
