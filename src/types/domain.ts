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

export const SCHEMA_VERSION = 1;

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

export interface FamilyEvent {
  id: string;
  channelId: string;
  type: EventType;
  title: string;
  date: IsoDate;
  /** Repeats every year on the same day (birthdays, anniversaries…). */
  recurring: boolean;
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
  recurring: boolean;
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

/** One future occurrence of an event (explicit or derived from a birthday). */
export interface UpcomingEvent {
  key: string;
  type: EventType;
  title: string;
  date: IsoDate;
  daysUntil: number;
  /** Years since the original date (age, years married…), when meaningful. */
  years?: number;
  personIds: string[];
  /** Id of the stored FamilyEvent; absent for birthdays derived from people. */
  eventId?: string;
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };
