-- =============================================================================
-- Raíces — admins' inbox and members correcting their own card
--
-- Each channel has an inbox only its admins can read: who joined, who left or
-- was removed, and which member corrected their own card (with what changed).
-- Members can edit their own card (name, birth date, gender, photo,
-- biography); the tree links and the date of death stay with the admins.
--
-- Run once in: Supabase Dashboard > SQL Editor, after 0004_invitation_person.sql.
-- Safe to run more than once.
-- =============================================================================

create table if not exists public.channel_notifications (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels (id) on delete cascade,
  kind text not null check (kind in ('person_edited', 'member_joined', 'member_left', 'member_removed')),
  -- The member concerned (who edited, joined, left or was removed).
  actor_id uuid references public.profiles (id) on delete set null,
  actor_name text not null default '',
  person_id uuid references public.people (id) on delete set null,
  -- person_edited: [{ "field": "firstName", "before": "Ana", "after": "Anabel" }, …]
  changes jsonb not null default '[]',
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists channel_notifications_channel_idx
  on public.channel_notifications (channel_id, created_at desc);

alter table public.channel_notifications enable row level security;
revoke all on public.channel_notifications from anon, authenticated;
grant select on public.channel_notifications to authenticated;

drop policy if exists "notifications: admins read" on public.channel_notifications;
create policy "notifications: admins read" on public.channel_notifications for select to authenticated
  using (public.is_admin(channel_id));

-- Joins (through an invitation) and departures are recorded automatically.
create or replace function public.notify_member_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    -- The creator of a channel joins without an invitation: nothing to report.
    if new.invitation_id is not null then
      insert into channel_notifications (channel_id, kind, actor_id, actor_name, person_id)
        values (new.channel_id, 'member_joined', new.user_id, new.display_name, new.person_id);
    end if;
    return new;
  end if;
  -- The whole channel is being deleted (last member left): nobody to tell.
  if not exists (select 1 from channels where id = old.channel_id) then
    return old;
  end if;
  insert into channel_notifications (channel_id, kind, actor_id, actor_name, person_id)
    values (
      old.channel_id,
      case when old.user_id = auth.uid() then 'member_left' else 'member_removed' end,
      old.user_id, old.display_name, old.person_id
    );
  return old;
end $$;

drop trigger if exists channel_members_notify on public.channel_members;
create trigger channel_members_notify
  after insert or delete on public.channel_members
  for each row execute function public.notify_member_change();

-- A member corrects their own card; admins are told what changed.
create or replace function public.update_my_person(
  p_channel uuid, p_first_name text, p_last_name text, p_birth_date date, p_gender text,
  p_photo_url text, p_biography text
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
    biography = coalesce(p_biography, '')
  where id = v_member.person_id
  returning * into v_new;

  select coalesce(jsonb_agg(jsonb_build_object('field', f, 'before', b, 'after', a)), '[]') into v_changes
  from (values
    ('firstName', v_old.first_name, v_new.first_name),
    ('lastName', v_old.last_name, v_new.last_name),
    ('birthDate', coalesce(v_old.birth_date::text, ''), coalesce(v_new.birth_date::text, '')),
    ('gender', coalesce(v_old.gender, ''), coalesce(v_new.gender, '')),
    ('photoUrl', coalesce(v_old.photo_url, ''), coalesce(v_new.photo_url, '')),
    ('biography', v_old.biography, v_new.biography)
  ) as c(f, b, a)
  where b is distinct from a;

  -- Admins edit cards anyway: only members' corrections are reported.
  if jsonb_array_length(v_changes) > 0 and v_member.role <> 'admin' then
    insert into channel_notifications (channel_id, kind, actor_id, actor_name, person_id, changes)
      values (p_channel, 'person_edited', v_user, v_member.display_name, v_member.person_id, v_changes);
  end if;
end $$;

-- Admins: mark the whole inbox as read.
create or replace function public.mark_notifications_read(p_channel uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_user();
  if not public.is_admin(p_channel) then raise exception 'Solo un administrador puede hacer esto' using errcode = '42501'; end if;
  update channel_notifications set read_at = now() where channel_id = p_channel and read_at is null;
end $$;

revoke execute on function public.notify_member_change(),
  public.update_my_person(uuid, text, text, date, text, text, text), public.mark_notifications_read(uuid)
  from public, anon, authenticated;
grant execute on function public.update_my_person(uuid, text, text, date, text, text, text),
  public.mark_notifications_read(uuid) to authenticated;
