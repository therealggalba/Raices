// Raíces domain model.
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

export const SCHEMA_VERSION = 9;

/**
 * What a channel is about. Thematic home rows only mix videos from channels
 * of the same kind (family Christmases are not mixed with friends' trips).
 */
export const CHANNEL_KINDS = ['familia', 'amigos', 'viajes', 'otros'] as const;
export type ChannelKind = (typeof CHANNEL_KINDS)[number];

/** Visual design of a channel's card packs (chosen in the channel settings). */
export const PACK_THEMES = ['clasico', 'atardecer', 'oceano', 'bosque', 'vintage', 'galaxia'] as const;
export type PackTheme = (typeof PACK_THEMES)[number];

/** Daily packs per user, across all albums. */
export const PACKS_PER_DAY = 3;
/** Cromos per pack. */
export const PACK_SIZE = 5;

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

/** A channel's cards are people or pets (pets: own dates and videos, no family tree, never members). */
export const PERSON_KINDS = ['persona', 'mascota'] as const;
export type PersonKind = (typeof PERSON_KINDS)[number];

export const SPECIES = ['perro', 'gato', 'ave', 'conejo', 'roedor', 'pez', 'reptil', 'caballo', 'otro'] as const;
export type Species = (typeof SPECIES)[number];

/** Optional, used for gendered kinship words (tío / tía). */
export const GENDERS = ['hombre', 'mujer'] as const;
export type Gender = (typeof GENDERS)[number];

export const EVENT_TYPES = [
  'cumpleanos',
  'aniversario',
  'comunion',
  'bautizo',
  'boda',
  'fallecimiento',
  'santo',
  'dia_senalado',
  'otro',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/**
 * Yearly dates that didn't start on a given year (a saint's day, a family
 * tradition…): only day and month matter, no count of years.
 */
export const DAY_ONLY_EVENT_TYPES: readonly EventType[] = ['santo', 'dia_senalado'];
/** Year stored for day-and-month-only dates (a leap year, so 29 February fits). */
export const DAY_ONLY_YEAR = 2000;

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
  /** Design of the channel's card packs. */
  packTheme: PackTheme;
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
  /** The person of the channel this member is («Esta persona soy yo»): kinship is shown relative to them. */
  personId?: string;
}

export interface Person {
  id: string;
  channelId: string;
  /** Absent = a person. */
  kind?: PersonKind;
  /** Pets only. */
  species?: Species;
  firstName: string;
  lastName: string;
  birthDate?: IsoDate;
  /** Shown with a cross (✝). */
  deathDate?: IsoDate;
  gender?: Gender;
  /** Photo to show: an https link or, for uploaded photos, a temporary signed URL. */
  photoUrl?: string;
  /** Uploaded photo in storage («<channel>/<person>/<file>.webp»). */
  photoPath?: string;
  /** Free text: "Abuelo materno", "Prima", "Amigo de la familia"… */
  relationship: string;
  biography: string;
  /** Up to two parents, people of the same channel (family tree). */
  parentIds: string[];
}

/** Two people of a channel who are (or were) a couple. */
export interface Partnership {
  id: string;
  channelId: string;
  /** Always two different people, stored sorted. */
  personIds: [string, string];
  /** Wedding / start date. */
  since?: IsoDate;
  /** Separation date (the couple is shown as separated). */
  until?: IsoDate;
}

export interface Video {
  id: string;
  channelId: string;
  title: string;
  description: string;
  /** External media link (YouTube, Vimeo, Google Drive or a direct file). */
  mediaUrl: string;
  /** Cover to show: an https link or, for uploaded covers, a temporary signed URL. */
  thumbnailUrl?: string;
  /** Uploaded cover in storage («<channel>/<file>.webp»). */
  thumbnailPath?: string;
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

/**
 * A collectible card (cromo) of the channel's album. The album is organised
 * by person: each person of the channel is a category. Cards are open-ended:
 * admins keep adding photos over time. All cromos are equal: no rarities
 * (a family photo is not "worth" more than another), same odds in packs.
 */
export interface AlbumCard {
  id: string;
  channelId: string;
  /** Album number (#49), assigned on creation, unique and stable per channel. */
  number: number;
  /** Category; absent when the person was deleted ("Varios"). */
  personId?: string;
  title: string;
  description: string;
  /** Image to show: an https link or, for uploaded photos, a temporary signed URL. */
  imageUrl: string;
  /** Uploaded photo and its blurred copy (shown while locked) in storage. */
  imagePath?: string;
  blurredPath?: string;
  /** When the photo was taken. */
  takenAt: PartialDate;
  createdAt: IsoDateTime;
  authorId: string;
}

/**
 * How many copies of a cromo a member owns. One copy unlocks it (photo and
 * story visible); duplicates accumulate for future uses (trading…).
 */
export interface CardCopy {
  channelId: string;
  userId: string;
  cardId: string;
  count: number;
  firstObtainedAt: IsoDateTime;
}

/** One opened pack (also what limits the packs per day). */
export interface PackOpening {
  id: string;
  channelId: string;
  userId: string;
  /** Local calendar day it was opened (daily allowance). */
  date: IsoDate;
  openedAt: IsoDateTime;
  cardIds: string[];
}

export interface PackStatus {
  perDay: number;
  openedToday: number;
  remaining: number;
}

/** A cromo just pulled from a pack. */
export interface PackPull {
  card: AlbumCard;
  /** First copy ever: the cromo just got unlocked. */
  isNew: boolean;
  /** Copies owned after this pack. */
  copies: number;
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
  /** Who the invitation is for: whoever uses it becomes this person of the channel. */
  personId?: string;
}

export type InvitationStatus = 'active' | 'used' | 'expired' | 'revoked';

/** What deleting one's account does to each channel. */
export interface AccountDeletionPlan {
  /** Channels where the user is alone: deleted with everything in them. */
  deleted: string[];
  /** Channels the user just leaves. */
  left: string[];
  /** Channels where the user is the only admin and others remain: name another admin first. */
  blocked: string[];
}

/** What a channel's admins are told about in their inbox. */
export const NOTIFICATION_KINDS = ['person_edited', 'member_joined', 'member_left', 'member_removed'] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** One field changed by a member on their own card. */
export interface FieldChange {
  /** photoUrl stands for the photo, whether linked or uploaded. */
  field: 'firstName' | 'lastName' | 'birthDate' | 'gender' | 'photoUrl' | 'biography';
  before: string;
  after: string;
}

export interface ChannelNotification {
  id: string;
  channelId: string;
  kind: NotificationKind;
  /** The member concerned (who edited, joined, left or was removed). */
  actorId?: string;
  actorName: string;
  /** Their person in the channel, when there is one. */
  personId?: string;
  /** Only for person_edited. */
  changes: FieldChange[];
  createdAt: IsoDateTime;
  readAt?: IsoDateTime;
}

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
  /** Defaults to 'clasico' when omitted. */
  packTheme?: PackTheme;
  coverUrl?: string;
}

export interface PersonInput {
  /** Absent = a person. Pets have no surname, gender or parents. */
  kind?: PersonKind;
  species?: Species;
  firstName: string;
  lastName: string;
  birthDate?: IsoDate;
  deathDate?: IsoDate;
  gender?: Gender;
  photoUrl?: string;
  /** Uploaded photo (wins over photoUrl). */
  photoPath?: string;
  relationship: string;
  biography: string;
  /** Up to two parents (omitted = none). */
  parentIds?: string[];
}

/** What a member may correct on their own card (the tree links stay with the admins). */
export interface SelfPersonInput {
  firstName: string;
  lastName: string;
  birthDate?: IsoDate;
  gender?: Gender;
  photoUrl?: string;
  photoPath?: string;
  biography: string;
}

export interface PartnershipInput {
  personIds: [string, string];
  since?: IsoDate;
  until?: IsoDate;
}

export interface VideoInput {
  title: string;
  description: string;
  mediaUrl: string;
  thumbnailUrl?: string;
  /** Uploaded cover (wins over thumbnailUrl). */
  thumbnailPath?: string;
  eventDate: PartialDate;
  durationSeconds?: number;
  category: VideoCategory;
  tags: string[];
  personIds: string[];
}

export interface CardInput {
  personId?: string;
  title: string;
  description: string;
  /** https link; ignored when the photo was uploaded (imagePath). */
  imageUrl: string;
  imagePath?: string;
  blurredPath?: string;
  takenAt: PartialDate;
}

/** Where an uploaded photo goes. */
export const PHOTO_KINDS = ['cromo', 'persona', 'miniatura'] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];

/** A photo just uploaded: where it is stored and a URL to preview it. */
export interface UploadedPhoto {
  path: string;
  /** Cromos only: the tiny blurred copy shown while locked. */
  blurredPath?: string;
  previewUrl: string;
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
  cards: AlbumCard[];
  partnerships: Partnership[];
  /** Only filled for admins. */
  invitations: Invitation[];
  /** Admins: notifications not read yet (0 for members). */
  unreadNotifications: number;
  favoriteVideoIds: string[];
}

/**
 * One yearly occurrence of an important date: a stored FamilyEvent or a
 * birthday derived from a person's birth date.
 */
export interface DateOccurrence {
  key: string;
  /** First channel where it is; channelIds has all of them (the same date in several channels shows once). */
  channelId: string;
  channelIds: string[];
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
  packTheme: PackTheme;
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
  /** Every cromo of every album. */
  cards: AlbumCard[];
  /** Card id -> copies the current user owns (absent = locked). */
  cardCopies: Record<string, number>;
  /** Today's pack allowance. */
  packs: PackStatus;
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
