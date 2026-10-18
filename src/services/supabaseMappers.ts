import type {
  AlbumCard,
  Channel,
  ChannelKind,
  ChannelNotification,
  FieldChange,
  NotificationKind,
  EventType,
  FamilyEvent,
  Gender,
  Invitation,
  Member,
  PackTheme,
  Partnership,
  Person,
  Role,
  Video,
  VideoCategory,
} from '../types/domain';
import { RepositoryError } from './repository';

// Database rows (snake_case, as stored in Supabase) <-> domain objects.
// Pure functions: unit-tested in tests/supabaseMappers.test.ts.

export interface ChannelRow {
  id: string;
  name: string;
  description: string;
  kind: ChannelKind;
  pack_theme: PackTheme;
  cover_url: string | null;
  created_at: string;
  created_by: string;
}
export interface MemberRow {
  channel_id: string;
  user_id: string;
  display_name: string;
  role: Role;
  joined_at: string;
  invitation_id: string | null;
  person_id: string | null;
}
export interface InvitationRow {
  id: string;
  channel_id: string;
  code: string;
  created_by: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  used_by: string | null;
  revoked_at: string | null;
  person_id: string | null;
}
export interface PersonRow {
  id: string;
  channel_id: string;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  death_date: string | null;
  gender: Gender | null;
  photo_url: string | null;
  photo_path: string | null;
  relationship: string;
  biography: string;
  parent_ids: string[];
}
export interface PartnershipRow {
  id: string;
  channel_id: string;
  person_a: string;
  person_b: string;
  since: string | null;
  until: string | null;
}
export interface VideoRow {
  id: string;
  channel_id: string;
  title: string;
  description: string;
  media_url: string;
  thumbnail_url: string | null;
  thumbnail_path: string | null;
  event_date: string;
  uploaded_at: string;
  duration_seconds: number | null;
  category: VideoCategory;
  tags: string[];
  person_ids: string[];
  author_id: string;
}
export interface EventRow {
  id: string;
  channel_id: string;
  type: EventType;
  title: string;
  date: string;
  person_ids: string[];
  notes: string;
}
/** album_cards without `description` (not readable directly: see unlocked_card_descriptions). */
export interface CardRow {
  id: string;
  channel_id: string;
  number: number;
  person_id: string | null;
  title: string;
  image_url: string | null;
  image_path: string | null;
  blurred_path: string | null;
  taken_at: string;
  created_at: string;
  author_id: string;
}

export interface NotificationRow {
  id: string;
  channel_id: string;
  kind: NotificationKind;
  actor_id: string | null;
  actor_name: string;
  person_id: string | null;
  changes: FieldChange[] | null;
  created_at: string;
  read_at: string | null;
}

/** Columns to select for each table (album_cards cannot be read with `*`). */
export const COLUMNS = {
  channels: 'id,name,description,kind,pack_theme,cover_url,created_at,created_by',
  members: 'channel_id,user_id,display_name,role,joined_at,invitation_id,person_id',
  invitations: 'id,channel_id,code,created_by,created_at,expires_at,used_at,used_by,revoked_at,person_id',
  people:
    'id,channel_id,first_name,last_name,birth_date,death_date,gender,photo_url,photo_path,relationship,biography,parent_ids',
  partnerships: 'id,channel_id,person_a,person_b,since,until',
  videos:
    'id,channel_id,title,description,media_url,thumbnail_url,thumbnail_path,event_date,uploaded_at,duration_seconds,category,tags,person_ids,author_id',
  events: 'id,channel_id,type,title,date,person_ids,notes',
  cards: 'id,channel_id,number,person_id,title,image_url,image_path,blurred_path,taken_at,created_at,author_id',
  notifications: 'id,channel_id,kind,actor_id,actor_name,person_id,changes,created_at,read_at',
} as const;

const opt = <T>(value: T | null | undefined): T | undefined => (value === null ? undefined : value);

export function toChannel(r: ChannelRow): Channel {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    kind: r.kind,
    packTheme: r.pack_theme,
    ...(r.cover_url ? { coverUrl: r.cover_url } : {}),
    createdAt: r.created_at,
    createdBy: r.created_by,
  };
}

export function toMember(r: MemberRow): Member {
  return {
    channelId: r.channel_id,
    userId: r.user_id,
    displayName: r.display_name,
    role: r.role,
    joinedAt: r.joined_at,
    ...(r.invitation_id ? { invitationId: r.invitation_id } : {}),
    ...(r.person_id ? { personId: r.person_id } : {}),
  };
}

export function toInvitation(r: InvitationRow): Invitation {
  return {
    id: r.id,
    channelId: r.channel_id,
    code: r.code,
    createdBy: r.created_by,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    usedAt: opt(r.used_at),
    usedBy: opt(r.used_by),
    revokedAt: opt(r.revoked_at),
    ...(r.person_id ? { personId: r.person_id } : {}),
  };
}

export function toPerson(r: PersonRow): Person {
  return {
    id: r.id,
    channelId: r.channel_id,
    firstName: r.first_name,
    lastName: r.last_name,
    ...(r.birth_date ? { birthDate: r.birth_date } : {}),
    ...(r.death_date ? { deathDate: r.death_date } : {}),
    ...(r.gender ? { gender: r.gender } : {}),
    ...(r.photo_url ? { photoUrl: r.photo_url } : {}),
    ...(r.photo_path ? { photoPath: r.photo_path } : {}),
    relationship: r.relationship,
    biography: r.biography,
    parentIds: r.parent_ids ?? [],
  };
}

export function toPartnership(r: PartnershipRow): Partnership {
  return {
    id: r.id,
    channelId: r.channel_id,
    personIds: [r.person_a, r.person_b],
    ...(r.since ? { since: r.since } : {}),
    ...(r.until ? { until: r.until } : {}),
  };
}

export function toVideo(r: VideoRow): Video {
  return {
    id: r.id,
    channelId: r.channel_id,
    title: r.title,
    description: r.description,
    mediaUrl: r.media_url,
    ...(r.thumbnail_url ? { thumbnailUrl: r.thumbnail_url } : {}),
    ...(r.thumbnail_path ? { thumbnailPath: r.thumbnail_path } : {}),
    eventDate: r.event_date,
    uploadedAt: r.uploaded_at,
    ...(r.duration_seconds ? { durationSeconds: r.duration_seconds } : {}),
    category: r.category,
    tags: r.tags ?? [],
    personIds: r.person_ids ?? [],
    authorId: r.author_id,
  };
}

export function toEvent(r: EventRow): FamilyEvent {
  return {
    id: r.id,
    channelId: r.channel_id,
    type: r.type,
    title: r.title,
    date: r.date,
    personIds: r.person_ids ?? [],
    notes: r.notes,
  };
}

/**
 * A cromo for the current user. `imageUrl` is the external image, or a
 * signed URL of the stored file: the original when unlocked (or admin), the
 * blurred copy otherwise. `description` only when the server returned it.
 */
export function toCard(r: CardRow, imageUrl: string, description: string): AlbumCard {
  return {
    id: r.id,
    channelId: r.channel_id,
    number: r.number,
    ...(r.person_id ? { personId: r.person_id } : {}),
    title: r.title,
    description,
    imageUrl,
    ...(r.image_path ? { imagePath: r.image_path } : {}),
    ...(r.blurred_path ? { blurredPath: r.blurred_path } : {}),
    takenAt: r.taken_at,
    createdAt: r.created_at,
    authorId: r.author_id,
  };
}

export function toNotification(r: NotificationRow): ChannelNotification {
  return {
    id: r.id,
    channelId: r.channel_id,
    kind: r.kind,
    ...(r.actor_id ? { actorId: r.actor_id } : {}),
    actorName: r.actor_name,
    ...(r.person_id ? { personId: r.person_id } : {}),
    changes: Array.isArray(r.changes) ? r.changes : [],
    createdAt: r.created_at,
    ...(r.read_at ? { readAt: r.read_at } : {}),
  };
}

/** Partnership person ids are stored sorted (person_a < person_b). */
export function sortedPair(ids: readonly [string, string]): [string, string] {
  return ids[0] < ids[1] ? [ids[0], ids[1]] : [ids[1], ids[0]];
}

export interface PostgrestLikeError {
  code?: string;
  message?: string;
}

/**
 * Turns a Supabase/PostgREST error into a user-facing RepositoryError. The
 * server functions raise Spanish, user-safe messages; everything else gets a
 * generic message (no internal details leak to the UI).
 */
export function toRepositoryError(error: PostgrestLikeError): RepositoryError {
  const code = error.code ?? '';
  const message = error.message ?? '';
  // Messages raised on purpose by our SQL functions/triggers.
  const ours = /[áéíóúñ¡¿]|^(La |El |Ese |Este |Ya |Solo |Nombra |Para |Una |Los |No se |Inicia )/.test(message);
  if (code === '42501' || /row-level security|permission denied/i.test(message)) {
    return new RepositoryError('forbidden', ours ? message : 'No tienes permiso para hacer esto');
  }
  if (code === '02000' || code === 'PGRST116') return new RepositoryError('not-found', ours ? message : 'No se ha encontrado');
  if (code === '23505') return new RepositoryError('conflict', ours ? message : 'Ya existe');
  if (code === '23514' && ours) return new RepositoryError('conflict', message);
  if (code === '22023' || code === '23514' || code === '22P02' || code === '22007' || code === '22008') {
    return new RepositoryError('invalid', ours ? message : 'Revisa los datos');
  }
  return new RepositoryError('conflict', ours ? message : 'No se ha podido completar. Inténtalo de nuevo.');
}

/** The user's IANA time zone (packs reset at their local midnight). */
export function userTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
