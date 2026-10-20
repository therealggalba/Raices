-- =============================================================================
-- Raíces — permanent deletion of a channel or of one's own account
--
-- Channel: an admin deletes it with everything in it (the app first removes
-- its stored photos from Storage; video links are only links).
-- Account: the channels where the user is alone are deleted, the user leaves
-- the others, and the account (auth user + profile + personal data) is
-- removed. Being the only admin of a channel with other members blocks it
-- until someone else is named admin (nobody is left without an admin).
-- Content the user added to shared channels stays there, without an author.
--
-- Run once in: Supabase Dashboard > SQL Editor, after 0007_pets_feedback.sql.
-- Safe to run more than once.
-- =============================================================================

-- Content keeps existing when its author deletes their account.
alter table public.channels alter column created_by drop not null;
alter table public.channels drop constraint if exists channels_created_by_fkey;
alter table public.channels add constraint channels_created_by_fkey
  foreign key (created_by) references public.profiles (id) on delete set null;

alter table public.invitations alter column created_by drop not null;
alter table public.invitations drop constraint if exists invitations_created_by_fkey;
alter table public.invitations add constraint invitations_created_by_fkey
  foreign key (created_by) references public.profiles (id) on delete set null;
alter table public.invitations drop constraint if exists invitations_used_by_fkey;
alter table public.invitations add constraint invitations_used_by_fkey
  foreign key (used_by) references public.profiles (id) on delete set null;

alter table public.videos alter column author_id drop not null;
alter table public.videos drop constraint if exists videos_author_id_fkey;
alter table public.videos add constraint videos_author_id_fkey
  foreign key (author_id) references public.profiles (id) on delete set null;

alter table public.album_cards alter column author_id drop not null;
alter table public.album_cards drop constraint if exists album_cards_author_id_fkey;
alter table public.album_cards add constraint album_cards_author_id_fkey
  foreign key (author_id) references public.profiles (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Delete a channel (admins). Stored files are removed by the app beforehand.
-- ---------------------------------------------------------------------------
create or replace function public.delete_channel(p_channel uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_user();
  if not public.is_admin(p_channel) then raise exception 'Solo un administrador puede eliminar el canal' using errcode = '42501'; end if;
  delete from channels where id = p_channel;
end $$;

-- ---------------------------------------------------------------------------
-- What deleting the account would do, channel by channel:
--   delete  = the user is its only member: the channel goes too
--   blocked = the user is its only admin and there are other members
--   leave   = the user just leaves it
-- ---------------------------------------------------------------------------
create or replace function public.account_deletion_plan()
returns table (channel_id uuid, channel_name text, outcome text)
language sql stable security definer set search_path = public as $$
  select c.id, c.name,
    case
      when (select count(*) from channel_members x where x.channel_id = c.id) = 1 then 'delete'
      when m.role = 'admin'
        and (select count(*) from channel_members x where x.channel_id = c.id and x.role = 'admin') = 1 then 'blocked'
      else 'leave'
    end
  from channel_members m join channels c on c.id = m.channel_id
  where m.user_id = auth.uid()
  order by c.name
$$;

-- Deletes the caller's account for good.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := public.require_user(); v_blocked text;
begin
  select string_agg(channel_name, ', ') into v_blocked from public.account_deletion_plan() where outcome = 'blocked';
  if v_blocked is not null then
    raise exception 'Antes de eliminar tu cuenta, nombra a otro administrador en: %', v_blocked using errcode = '23514';
  end if;
  -- Channels where the user is alone go with the account.
  delete from channels where id in (select channel_id from public.account_deletion_plan() where outcome = 'delete');
  -- Leave the rest (the admins' inbox records it) and drop personal data.
  delete from favorites where user_id = v_user;
  delete from watch_progress where user_id = v_user;
  delete from card_copies where user_id = v_user;
  delete from channel_members where user_id = v_user;
  -- The account itself (the profile and the rest of its rows follow).
  delete from auth.users where id = v_user;
end $$;

revoke execute on function public.delete_channel(uuid), public.account_deletion_plan(), public.delete_my_account()
  from public, anon;
grant execute on function public.delete_channel(uuid), public.account_deletion_plan(), public.delete_my_account()
  to authenticated;
