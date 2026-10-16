// FamilyMemories domain model (MVP phase 1).
//
//   User ──< Member >── Channel ──< Video
//                          ├──< Person
//                          ├──< FamilyEvent
//                          └──< Invitation
//
// A channel is a private community (a family, a group of friends…). Members
// join through single-use invitations and hold a role inside each channel.
// Dates that describe *when something happened* use PartialDate, because
// families often only remember the year or the month of an old video.

export const SCHEMA_VERSION = 4;

/**
 * What a channel is about. Thematic home rows only mix videos from channels
 * of the same kind (family Christmases are not mixed with friends' trips).
 */
export const CHANNEL_KINDS = ['familia', 'amigos', 'viajes', 'otros'] as const;
export type ChannelKind = (typeof CHANNEL_KINDS)[number];

export const ROLES = ['admin', 'member'] as const;
export type Role = (typeof ROLES)[number];

/** VOD catalog categories, in the order the home screen shows them. */
export const VIDEO_CATEGORIES = [
  'vacaciones',
  'cumpleanos',
  'navidad',
  'boda',
  'comunion',
  'bautizo',
  'reunion',
  'otros',
] as const;
export type VideoCategory = (typeof VIDEO_CATEGORIES)[number];

export const EVENT_TYPES = ['cumpleanos', 'aniversario', 'comunion', 'bautizo', 'boda', 'otro'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** "YYYY", "YYYY-MM" or "YYYY-MM-DD". */
export type PartialDate = string;
/** Full calendar date, "YYYY-MM-DD". */
export type IsoDate = string;
/** Full timestamp, ISO 8601. */
export type IsoDateTime = string;

export interface User {
  id: string;
  name: string;
}

export interface Channel {
  id: string;
  name: string;
  description: string;
  kind: ChannelKind;
  /** Optional https image used as the channel cover. */
  coverUrl?: string;
  createdAt: IsoDateTime;
  createdBy: string;
}

export interface Member {
  channelId: string;
  userId: string;
  displayName: string;
  role: Role;
  joinedAt: IsoDateTime;
  /** Invitation used to join (traceability). Absent for the channel creator. */
  invitationId?: string;
}

export interface Person {
  id: string;
  channelId: string;
  firstName: string;
  lastName: string;
  birthDate?: IsoDate;
  photoUrl?: string;
  /** Free text: "Abuelo materno", "Prima", "Amigo de la familia"… */
  relationship: string;
  biography: string;
  notes: string;
}

export interface Video {
  id: string;
  channelId: string;
  title: string;
  description: string;
  /** External media link (YouTube, Vimeo, Google Drive or a direct file). */
  mediaUrl: string;
  thumbnailUrl?: string;
  /** When the recorded moment actually happened. */
  eventDate: PartialDate;
  uploadedAt: IsoDateTime;
  durationSeconds?: number;
  category: VideoCategory;
  tags: string[];
  /** People appearing in the video. */
  personIds: string[];
  authorId: string;
}

/**
 * An important date contributed by a channel. Every date repeats yearly on
 * the same day; the anniversary number is derived from the origin date
 * (Cumpleaños de Gonzalo, 1995-03-30 -> on 2026-03-30 he turns 31).
 */
export interface FamilyEvent {
  id: string;
  channelId: string;
  type: EventType;
  /** Description shown everywhere ("Cumpleaños de Gonzalo"). */
  title: string;
  /** Origin date (the day it first happened). */
  date: IsoDate;
  personIds: string[];
  notes: string;
}

export interface Invitation {
  id: string;
  channelId: string;
  code: string;
  createdBy: string;
  createdAt: IsoDateTime;
  expiresAt: IsoDateTime;
  usedAt?: IsoDateTime;
  usedBy?: string;
  revokedAt?: IsoDateTime;
}

export type InvitationStatus = 'active' | 'used' | 'expired' | 'revoked';

/** One playback of a video by a member ("Lo más visto"). */
export interface ViewRecord {
  channelId: string;
  userId: string;
  videoId: string;
  at: IsoDateTime;
}

/** Where a member left a video, to continue watching from there. */
export interface WatchProgress {
  channelId: string;
  userId: string;
  videoId: string;
  positionSeconds: number;
  durationSeconds: number;
  updatedAt: IsoDateTime;
}

export interface Favorite {
  channelId: string;
  userId: string;
  videoId: string;
}

// ---------------------------------------------------------------------------
// Inputs (what forms send to the repository; ids and audit fields are added
// by the repository itself).

export interface ChannelInput {
  name: string;
  description: string;
  kind: ChannelKind;
  coverUrl?: string;
}

export interface PersonInput {
  firstName: string;
  lastName: string;
  birthDate?: IsoDate;
  photoUrl?: string;
  relationship: string;
  biography: string;
  notes: string;
}

export interface VideoInput {
  title: string;
  description: string;
  mediaUrl: string;
  thumbnailUrl?: string;
  eventDate: PartialDate;
  durationSeconds?: number;
  category: VideoCategory;
  tags: string[];
  personIds: string[];
}

export interface EventInput {
  type: EventType;
  title: string;
  date: IsoDate;
  personIds: string[];
  notes: string;
}

// ---------------------------------------------------------------------------
// Read models.

export interface ChannelSummary {
  channel: Channel;
  role: Role;
  memberCount: number;
  videoCount: number;
}

/** Everything a member can see of one channel. */
export interface ChannelSnapshot {
  channel: Channel;
  me: Member;
  members: Member[];
  people: Person[];
  videos: Video[];
  events: FamilyEvent[];
  /** Only filled for admins. */
  invitations: Invitation[];
  favoriteVideoIds: string[];
}

/**
 * One yearly occurrence of an important date: a stored FamilyEvent or a
 * birthday derived from a person's birth date.
 */
export interface DateOccurrence {
  key: string;
  channelId: string;
  type: EventType;
  title: string;
  /** Day of this occurrence. */
  date: IsoDate;
  /** Day it first happened. */
  originDate: IsoDate;
  /** Anniversary number (age, years married…). 0 = the year it happens. */
  years: number;
  /** Days from today (negative = already passed). */
  daysUntil: number;
  personIds: string[];
  /** Id of the stored FamilyEvent; absent for birthdays derived from people. */
  eventId?: string;
}

/** Filters of the yearly «Fechas» list (empty lists mean "any"). */
export interface DateFilters {
  channelIds: string[];
  /** 1-12. */
  months: number[];
  types: EventType[];
  /** Free text: description or the name of a person involved. */
  query: string;
}

export interface LibraryChannel {
  id: string;
  name: string;
  kind: ChannelKind;
  role: Role;
}

/**
 * Everything the current user can watch, across all their channels: feeds
 * the global home (mixed rows) and the full catalog.
 */
export interface Library {
  channels: LibraryChannel[];
  videos: Video[];
  people: Person[];
  events: FamilyEvent[];
  /** Video id -> total playbacks by every member. */
  viewCounts: Record<string, number>;
  favoriteVideoIds: string[];
  /** Video id -> where the current user left it (unfinished videos only). */
  progress: Record<string, { positionSeconds: number; durationSeconds: number }>;
}

export const CATALOG_SORTS = ['added', 'memory-desc', 'memory-asc', 'views', 'title'] as const;
export type CatalogSort = (typeof CATALOG_SORTS)[number];

/** Full-catalog filters (all optional; empty lists mean "any"). */
export interface CatalogFilters {
  query: string;
  channelIds: string[];
  categories: VideoCategory[];
  personId?: string;
  /** First year of the decade, e.g. 1990. */
  decade?: number;
  favoritesOnly: boolean;
  sort: CatalogSort;
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };
