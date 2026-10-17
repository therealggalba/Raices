import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AlbumCard,
  ChannelSnapshot,
  EventInput,
  PersonInput,
  VideoInput,
  ChannelSummary,
  Library,
  PackPull,
  PackStatus,
  ValidationResult,
} from '../types/domain';
import { PACKS_PER_DAY } from '../types/domain';
import { decideProgress } from '../utils/progress';
import {
  isId,
  validateCardInput,
  validateChannelInput,
  validateDisplayName,
  validateEventInput,
  validatePartnershipInput,
  validatePersonInput,
  validateVideoInput,
} from '../utils/validation';
import type { MemoriesRepository } from './repository';
import { RepositoryError } from './repository';
import type {
  CardRow,
  ChannelRow,
  EventRow,
  InvitationRow,
  MemberRow,
  PartnershipRow,
  PersonRow,
  PostgrestLikeError,
  VideoRow,
} from './supabaseMappers';
import {
  COLUMNS,
  sortedPair,
  toCard,
  toChannel,
  toEvent,
  toInvitation,
  toMember,
  toPartnership,
  toPerson,
  toRepositoryError,
  toVideo,
  userTimeZone,
} from './supabaseMappers';

// Supabase backend: real accounts, data shared between the members of each
// channel. Authorization lives in the database (RLS + SECURITY DEFINER
// functions, see supabase/migrations); the checks here only give friendlier
// messages earlier. Inputs are validated with the same rules as the local
// backend before they are sent.

/** Signed URLs for private storage images (cromos) last this long. */
const SIGNED_URL_SECONDS = 60 * 60;

interface Result<T> {
  data: T | null;
  error: PostgrestLikeError | null;
}

/** Unwraps a Supabase response, turning errors into RepositoryError. */
function must<T>({ data, error }: Result<T>): T {
  if (error) throw toRepositoryError(error);
  return data as T;
}

function ensure<T>(result: ValidationResult<T>): T {
  if (!result.ok) throw new RepositoryError('invalid', 'Revisa los datos', result.errors);
  return result.value;
}

function requireId(id: string, what: string): void {
  if (!isId(id)) throw new RepositoryError('not-found', `${what} no existe`);
}

/** Updates/deletes that matched no row: missing, or hidden by RLS. */
function ensureAffected(rows: unknown[] | null, what: string): void {
  if (!rows || rows.length === 0) throw new RepositoryError('not-found', `${what} no existe o no tienes permiso`);
}

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name, 'es');

export function createSupabaseRepository(client: SupabaseClient): MemoriesRepository {
  // Signed URL handed out for each stored cromo image: when a form sends the
  // same URL back, the stored file is kept instead of saving the temporary URL.
  const signedImages = new Map<string, string>();

  async function userId(): Promise<string> {
    const { data } = await client.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new RepositoryError('forbidden', 'Inicia sesión para continuar');
    return id;
  }

  /** Card rows -> cromos as the current user sees them (description and image). */
  async function hydrateCards(rows: CardRow[]): Promise<AlbumCard[]> {
    if (rows.length === 0) return [];
    // Unlocked by the user, or any card of a channel they administer.
    const unlocked = must(await client.rpc('unlocked_card_descriptions')) as { card_id: string; description: string }[];
    const descriptions = new Map(unlocked.map((d) => [d.card_id, d.description]));
    const pathOf = (r: CardRow) => (r.image_url ? null : descriptions.has(r.id) ? r.image_path : r.blurred_path);
    const paths = [...new Set(rows.map(pathOf).filter((p): p is string => !!p))];
    const signed = new Map<string, string>();
    if (paths.length) {
      const { data } = await client.storage.from('cromos').createSignedUrls(paths, SIGNED_URL_SECONDS);
      for (const item of data ?? []) if (item.path && item.signedUrl) signed.set(item.path, item.signedUrl);
    }
    return rows.map((r) => {
      const path = pathOf(r);
      const imageUrl = r.image_url ?? (path ? (signed.get(path) ?? '') : '');
      if (!r.image_url && imageUrl) signedImages.set(r.id, imageUrl);
      return toCard(r, imageUrl, descriptions.get(r.id) ?? '');
    });
  }

  async function packStatus(): Promise<PackStatus> {
    const rows = must(await client.rpc('pack_status', { p_tz: userTimeZone() })) as {
      per_day: number;
      opened_today: number;
      remaining: number;
    }[];
    const row = rows[0];
    return row
      ? { perDay: row.per_day, openedToday: row.opened_today, remaining: row.remaining }
      : { perDay: PACKS_PER_DAY, openedToday: 0, remaining: PACKS_PER_DAY };
  }

  async function videoChannel(videoId: string): Promise<string> {
    requireId(videoId, 'El vídeo');
    const row = must(await client.from('videos').select('channel_id').eq('id', videoId).maybeSingle());
    if (!row) throw new RepositoryError('not-found', 'El vídeo no existe');
    return (row as { channel_id: string }).channel_id;
  }

  const repo: MemoriesRepository = {
    mode: 'supabase',

    async getCurrentUser() {
      const id = await userId();
      const row = must(await client.from('profiles').select('id,display_name').eq('id', id).maybeSingle()) as {
        id: string;
        display_name: string;
      } | null;
      return { id, name: row?.display_name ?? 'Invitado' };
    },

    async renameCurrentUser(name) {
      const value = ensure(validateDisplayName(name));
      const id = await userId();
      ensureAffected(must(await client.from('profiles').update({ display_name: value }).eq('id', id).select('id')), 'El perfil');
      return { id, name: value };
    },

    async listChannels() {
      const me = await userId();
      const [channels, members, videos] = await Promise.all([
        client.from('channels').select(COLUMNS.channels),
        client.from('channel_members').select(COLUMNS.members),
        client.from('videos').select('channel_id'),
      ]);
      const memberRows = must(members) as MemberRow[];
      const videoRows = must(videos) as { channel_id: string }[];
      const summaries: ChannelSummary[] = (must(channels) as ChannelRow[]).flatMap((row) => {
        const mine = memberRows.find((m) => m.channel_id === row.id && m.user_id === me);
        if (!mine) return [];
        return [
          {
            channel: toChannel(row),
            role: mine.role,
            memberCount: memberRows.filter((m) => m.channel_id === row.id).length,
            videoCount: videoRows.filter((v) => v.channel_id === row.id).length,
          },
        ];
      });
      return summaries.sort((a, b) => byName(a.channel, b.channel));
    },

    async loadLibrary() {
      const me = await userId();
      const [members, channels, videos, people, events, favorites, views, cards, copies, progress, packs] =
        await Promise.all([
          client.from('channel_members').select('channel_id,role').eq('user_id', me),
          client.from('channels').select(COLUMNS.channels),
          client.from('videos').select(COLUMNS.videos),
          client.from('people').select(COLUMNS.people),
          client.from('events').select(COLUMNS.events),
          client.from('favorites').select('video_id'),
          client.rpc('video_view_counts'),
          client.from('album_cards').select(COLUMNS.cards).order('number'),
          client.from('card_copies').select('card_id,count'),
          client.from('watch_progress').select('video_id,position_seconds,duration_seconds'),
          packStatus(),
        ]);
      const roles = new Map((must(members) as { channel_id: string; role: MemberRow['role'] }[]).map((m) => [m.channel_id, m.role]));
      const library: Library = {
        channels: (must(channels) as ChannelRow[])
          .filter((c) => roles.has(c.id))
          .map((c) => ({ id: c.id, name: c.name, kind: c.kind, packTheme: c.pack_theme, role: roles.get(c.id)! }))
          .sort(byName),
        videos: (must(videos) as VideoRow[]).map(toVideo),
        people: (must(people) as PersonRow[]).map(toPerson),
        events: (must(events) as EventRow[]).map(toEvent),
        viewCounts: Object.fromEntries(
          (must(views) as { video_id: string; views: number }[]).map((v) => [v.video_id, Number(v.views)]),
        ),
        favoriteVideoIds: (must(favorites) as { video_id: string }[]).map((f) => f.video_id),
        cards: await hydrateCards(must(cards) as CardRow[]),
        cardCopies: Object.fromEntries((must(copies) as { card_id: string; count: number }[]).map((c) => [c.card_id, c.count])),
        packs,
        progress: Object.fromEntries(
          (must(progress) as { video_id: string; position_seconds: number; duration_seconds: number }[]).map((p) => [
            p.video_id,
            { positionSeconds: p.position_seconds, durationSeconds: p.duration_seconds },
          ]),
        ),
      };
      return library;
    },

    async recordView(videoId) {
      const channelId = await videoChannel(videoId);
      must(await client.from('video_views').insert({ channel_id: channelId, video_id: videoId, user_id: await userId() }));
    },

    async saveProgress(videoId, positionSeconds, durationSeconds) {
      const decision = decideProgress(positionSeconds, durationSeconds);
      if (!decision) throw new RepositoryError('invalid', 'Posición de reproducción inválida');
      const channelId = await videoChannel(videoId);
      const me = await userId();
      if (decision.action === 'clear') {
        must(await client.from('watch_progress').delete().eq('user_id', me).eq('video_id', videoId));
        return;
      }
      must(
        await client.from('watch_progress').upsert({
          user_id: me,
          video_id: videoId,
          channel_id: channelId,
          position_seconds: decision.positionSeconds,
          duration_seconds: decision.durationSeconds,
          updated_at: new Date().toISOString(),
        }),
      );
    },

    async createChannel(input) {
      const value = ensure(validateChannelInput(input));
      return must(
        await client.rpc('create_channel', {
          p_name: value.name,
          p_description: value.description,
          p_kind: value.kind,
          p_pack_theme: value.packTheme ?? 'clasico',
          p_cover_url: value.coverUrl ?? null,
        }),
      ) as string;
    },

    async loadChannel(channelId) {
      requireId(channelId, 'El canal');
      const me = await userId();
      const of = <T extends string>(table: string, columns: T) => client.from(table).select(columns).eq('channel_id', channelId);
      const [channel, members, people, videos, events, cards, partnerships, favorites] = await Promise.all([
        client.from('channels').select(COLUMNS.channels).eq('id', channelId).maybeSingle(),
        of('channel_members', COLUMNS.members),
        of('people', COLUMNS.people),
        of('videos', COLUMNS.videos),
        of('events', COLUMNS.events),
        of('album_cards', COLUMNS.cards).order('number'),
        of('partnerships', COLUMNS.partnerships),
        of('favorites', 'video_id'),
      ]);
      const channelRow = must(channel) as ChannelRow | null;
      const memberList = (must(members) as MemberRow[]).map(toMember);
      const mine = memberList.find((m) => m.userId === me);
      if (!channelRow || !mine) throw new RepositoryError('not-found', 'Este canal no existe');
      const invitations =
        mine.role === 'admin'
          ? (must(await of('invitations', COLUMNS.invitations).order('created_at', { ascending: false })) as InvitationRow[]).map(
              toInvitation,
            )
          : [];
      const snapshot: ChannelSnapshot = {
        channel: toChannel(channelRow),
        me: mine,
        members: memberList,
        people: (must(people) as PersonRow[]).map(toPerson),
        videos: (must(videos) as VideoRow[]).map(toVideo),
        events: (must(events) as EventRow[]).map(toEvent),
        cards: await hydrateCards(must(cards) as CardRow[]),
        partnerships: (must(partnerships) as PartnershipRow[]).map(toPartnership),
        invitations,
        favoriteVideoIds: (must(favorites) as { video_id: string }[]).map((f) => f.video_id),
      };
      return snapshot;
    },

    async updateChannel(channelId, input) {
      requireId(channelId, 'El canal');
      const value = ensure(validateChannelInput(input));
      const rows = must(
        await client
          .from('channels')
          .update({
            name: value.name,
            description: value.description,
            kind: value.kind,
            pack_theme: value.packTheme ?? 'clasico',
            cover_url: value.coverUrl ?? null,
          })
          .eq('id', channelId)
          .select('id'),
      );
      ensureAffected(rows, 'El canal');
    },

    async leaveChannel(channelId) {
      requireId(channelId, 'El canal');
      must(await client.rpc('leave_channel', { p_channel: channelId }));
    },

    async redeemInvitation(code, displayName) {
      const name = ensure(validateDisplayName(displayName));
      return must(await client.rpc('redeem_invitation', { p_code: code, p_display_name: name })) as string;
    },

    async createInvitation(channelId, expiresInDays, personId) {
      requireId(channelId, 'El canal');
      if (!isId(personId)) throw new RepositoryError('invalid', 'Elige para quién es la invitación');
      const row = must(
        await client.rpc('create_invitation', { p_channel: channelId, p_days: expiresInDays, p_person: personId }),
      ) as InvitationRow;
      return toInvitation(row);
    },

    async revokeInvitation(channelId, invitationId) {
      requireId(channelId, 'El canal');
      requireId(invitationId, 'La invitación');
      must(await client.rpc('revoke_invitation', { p_invitation: invitationId }));
    },

    async setMemberRole(channelId, memberId, role) {
      requireId(channelId, 'El canal');
      requireId(memberId, 'Ese miembro');
      must(await client.rpc('set_member_role', { p_channel: channelId, p_user: memberId, p_role: role }));
    },

    async linkMemberPerson(channelId, memberId, personId) {
      requireId(channelId, 'El canal');
      requireId(memberId, 'Ese miembro');
      if (personId !== null) requireId(personId, 'La persona');
      must(await client.rpc('set_member_person', { p_channel: channelId, p_user: memberId, p_person: personId }));
    },

    async removeMember(channelId, memberId) {
      requireId(channelId, 'El canal');
      requireId(memberId, 'Ese miembro');
      must(await client.rpc('remove_member', { p_channel: channelId, p_user: memberId }));
    },

    async addVideo(channelId, input) {
      requireId(channelId, 'El canal');
      const value = ensure(validateVideoInput(input));
      const row = must(
        await client
          .from('videos')
          .insert({ channel_id: channelId, author_id: await userId(), ...videoColumns(value) })
          .select(COLUMNS.videos)
          .single(),
      ) as VideoRow;
      return toVideo(row);
    },

    async updateVideo(channelId, videoId, input) {
      requireId(videoId, 'El vídeo');
      const value = ensure(validateVideoInput(input));
      const rows = must(
        await client.from('videos').update(videoColumns(value)).eq('id', videoId).eq('channel_id', channelId).select('id'),
      );
      ensureAffected(rows, 'El vídeo');
    },

    async deleteVideo(channelId, videoId) {
      requireId(videoId, 'El vídeo');
      ensureAffected(
        must(await client.from('videos').delete().eq('id', videoId).eq('channel_id', channelId).select('id')),
        'El vídeo',
      );
    },

    async toggleFavorite(channelId, videoId) {
      requireId(videoId, 'El vídeo');
      const me = await userId();
      const removed = must(await client.from('favorites').delete().eq('user_id', me).eq('video_id', videoId).select('video_id'));
      if (removed && removed.length > 0) return false;
      must(await client.from('favorites').insert({ user_id: me, video_id: videoId, channel_id: channelId }));
      return true;
    },

    async addPerson(channelId, input) {
      requireId(channelId, 'El canal');
      const value = ensure(validatePersonInput(input));
      const row = must(
        await client
          .from('people')
          .insert({ channel_id: channelId, ...personColumns(value) })
          .select(COLUMNS.people)
          .single(),
      ) as PersonRow;
      return toPerson(row);
    },

    async updatePerson(channelId, personId, input) {
      requireId(personId, 'La persona');
      const value = ensure(validatePersonInput(input));
      const rows = must(
        await client.from('people').update(personColumns(value)).eq('id', personId).eq('channel_id', channelId).select('id'),
      );
      ensureAffected(rows, 'La persona');
    },

    async deletePerson(channelId, personId) {
      requireId(personId, 'La persona');
      // Videos, events, children and partnerships are unlinked by the database.
      ensureAffected(
        must(await client.from('people').delete().eq('id', personId).eq('channel_id', channelId).select('id')),
        'La persona',
      );
    },

    async addPartnership(channelId, input) {
      requireId(channelId, 'El canal');
      const value = ensure(validatePartnershipInput(input));
      const [a, b] = sortedPair(value.personIds);
      const result = await client
        .from('partnerships')
        .insert({ channel_id: channelId, person_a: a, person_b: b, since: value.since ?? null, until: value.until ?? null })
        .select(COLUMNS.partnerships)
        .single();
      if (result.error?.code === '23505') throw new RepositoryError('conflict', 'Esa pareja ya está registrada');
      return toPartnership(must(result) as PartnershipRow);
    },

    async updatePartnership(channelId, partnershipId, input) {
      requireId(partnershipId, 'La pareja');
      const value = ensure(validatePartnershipInput(input));
      const [a, b] = sortedPair(value.personIds);
      // The people of a couple can't change: the filter on both makes any
      // attempt match no row.
      const rows = must(
        await client
          .from('partnerships')
          .update({ since: value.since ?? null, until: value.until ?? null })
          .eq('id', partnershipId)
          .eq('channel_id', channelId)
          .eq('person_a', a)
          .eq('person_b', b)
          .select('id'),
      );
      ensureAffected(rows, 'La pareja');
    },

    async deletePartnership(channelId, partnershipId) {
      requireId(partnershipId, 'La pareja');
      ensureAffected(
        must(await client.from('partnerships').delete().eq('id', partnershipId).eq('channel_id', channelId).select('id')),
        'La pareja',
      );
    },

    async addEvent(channelId, input) {
      requireId(channelId, 'El canal');
      const value = ensure(validateEventInput(input));
      const row = must(
        await client
          .from('events')
          .insert({ channel_id: channelId, ...eventColumns(value) })
          .select(COLUMNS.events)
          .single(),
      ) as EventRow;
      return toEvent(row);
    },

    async updateEvent(channelId, eventId, input) {
      requireId(eventId, 'El evento');
      const value = ensure(validateEventInput(input));
      const rows = must(
        await client.from('events').update(eventColumns(value)).eq('id', eventId).eq('channel_id', channelId).select('id'),
      );
      ensureAffected(rows, 'El evento');
    },

    async deleteEvent(channelId, eventId) {
      requireId(eventId, 'El evento');
      ensureAffected(
        must(await client.from('events').delete().eq('id', eventId).eq('channel_id', channelId).select('id')),
        'El evento',
      );
    },

    async openPack(channelId) {
      requireId(channelId, 'El canal');
      const pulls = must(await client.rpc('open_pack', { p_channel: channelId, p_tz: userTimeZone() })) as {
        card_id: string;
        is_new: boolean;
        copies: number;
      }[];
      const ids = [...new Set(pulls.map((p) => p.card_id))];
      const rows = must(await client.from('album_cards').select(COLUMNS.cards).in('id', ids)) as CardRow[];
      const cards = new Map((await hydrateCards(rows)).map((c) => [c.id, c]));
      return pulls.flatMap((p): PackPull[] => {
        const card = cards.get(p.card_id);
        return card ? [{ card, isNew: p.is_new, copies: p.copies }] : [];
      });
    },

    async addCard(channelId, input) {
      requireId(channelId, 'El canal');
      const value = ensure(validateCardInput(input));
      const row = must(
        await client
          .from('album_cards')
          .insert({
            channel_id: channelId,
            author_id: await userId(),
            person_id: value.personId ?? null,
            title: value.title,
            description: value.description,
            image_url: value.imageUrl,
            taken_at: value.takenAt,
          })
          .select(COLUMNS.cards)
          .single(),
      ) as CardRow;
      return toCard(row, value.imageUrl, value.description);
    },

    async updateCard(channelId, cardId, input) {
      requireId(cardId, 'El cromo');
      const value = ensure(validateCardInput(input));
      // A temporary signed URL coming back from the form means "keep the stored file".
      const keepStoredImage = signedImages.get(cardId) === value.imageUrl;
      const rows = must(
        await client
          .from('album_cards')
          .update({
            person_id: value.personId ?? null,
            title: value.title,
            description: value.description,
            taken_at: value.takenAt,
            ...(keepStoredImage ? {} : { image_url: value.imageUrl, image_path: null, blurred_path: null }),
          })
          .eq('id', cardId)
          .eq('channel_id', channelId)
          .select('id'),
      );
      ensureAffected(rows, 'El cromo');
    },

    async deleteCard(channelId, cardId) {
      requireId(cardId, 'El cromo');
      ensureAffected(
        must(await client.from('album_cards').delete().eq('id', cardId).eq('channel_id', channelId).select('id')),
        'El cromo',
      );
    },

    async resetDemo() {
      throw new RepositoryError('forbidden', 'Solo disponible en la demo');
    },
  };
  return repo;
}

function videoColumns(value: VideoInput) {
  return {
    title: value.title,
    description: value.description,
    media_url: value.mediaUrl,
    thumbnail_url: value.thumbnailUrl ?? null,
    event_date: value.eventDate,
    duration_seconds: value.durationSeconds ?? null,
    category: value.category,
    tags: value.tags,
    person_ids: value.personIds,
  };
}

function personColumns(value: PersonInput) {
  return {
    first_name: value.firstName,
    last_name: value.lastName,
    birth_date: value.birthDate ?? null,
    death_date: value.deathDate ?? null,
    gender: value.gender ?? null,
    photo_url: value.photoUrl ?? null,
    relationship: value.relationship,
    biography: value.biography,
    notes: value.notes,
    parent_ids: value.parentIds ?? [],
  };
}

function eventColumns(value: EventInput) {
  return { type: value.type, title: value.title, date: value.date, person_ids: value.personIds, notes: value.notes };
}
