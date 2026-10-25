import type {
  AccountDeletionPlan,
  AlbumCard,
  ChannelNotification,
  CardInput,
  ChannelInput,
  ChannelSnapshot,
  ChannelSummary,
  ContentKind,
  EventInput,
  FamilyEvent,
  Invitation,
  Library,
  PackPull,
  Partnership,
  PartnershipInput,
  PhotoKind,
  Person,
  PersonInput,
  Role,
  SelfPersonInput,
  UploadedPhoto,
  User,
  Video,
  VideoInput,
} from '../types/domain';

/**
 * Storage backend contract. Phase 1 ships a local implementation (browser
 * storage, public demo); the privacy phase will add a Supabase one behind the
 * same interface. Implementations own authorization (role checks) and
 * validation: callers are never trusted, exactly like a server would be.
 *
 * Every method acts on behalf of the current user.
 */
export interface MemoriesRepository {
  readonly mode: 'local' | 'supabase';

  getCurrentUser(): Promise<User>;
  renameCurrentUser(name: string): Promise<User>;

  listChannels(): Promise<ChannelSummary[]>;
  /** Every video (plus related data) of every channel the user belongs to. */
  loadLibrary(): Promise<Library>;
  /** Registers one playback of a video by the current user. */
  recordView(videoId: string): Promise<void>;
  /**
   * Saves where the current user is in a video. Positions at the very start
   * or end clear it instead (nothing to resume).
   */
  saveProgress(videoId: string, positionSeconds: number, durationSeconds: number): Promise<void>;
  /** Creates a channel; the creator becomes its owner. */
  createChannel(input: ChannelInput): Promise<string>;
  loadChannel(channelId: string): Promise<ChannelSnapshot>;
  updateChannel(channelId: string, input: ChannelInput): Promise<void>;
  /** Owner: local time («HH:MM») of the channel's date reminders. */
  setNotifyTime(channelId: string, time: string): Promise<void>;
  /** Owners hand the channel over before leaving; ex-owners stay as admins. */
  leaveChannel(channelId: string): Promise<void>;
  /** Owner: another member becomes the owner; the current one stays as admin. */
  transferOwnership(channelId: string, userId: string): Promise<void>;

  /** Joins the channel the code belongs to, as the person it was made for. Returns its id. */
  redeemInvitation(code: string, displayName: string): Promise<string>;
  /** Invitation for one person of the channel (not yet linked to any member). */
  createInvitation(channelId: string, expiresInDays: number, personId: string): Promise<Invitation>;
  revokeInvitation(channelId: string, invitationId: string): Promise<void>;

  setMemberRole(channelId: string, userId: string, role: Role): Promise<void>;
  /**
   * Which person of the channel a member is (kinship is shown relative to
   * them). Normally set by the invitation; a member without one must pick
   * theirs once (they can't change it later); the owner can set or clear anyone's.
   * One member per person.
   */
  linkMemberPerson(channelId: string, userId: string, personId: string | null): Promise<void>;
  removeMember(channelId: string, userId: string): Promise<void>;

  /**
   * Videos and cromos: the owner and admins upload content of anyone,
   * members only content in which they appear. What isn't the owner's waits
   * for approval (pending); editing it sends it back. Authors and the owner
   * edit and delete it.
   */
  addVideo(channelId: string, input: VideoInput): Promise<Video>;
  updateVideo(channelId: string, videoId: string, input: VideoInput): Promise<void>;
  deleteVideo(channelId: string, videoId: string): Promise<void>;
  toggleFavorite(channelId: string, videoId: string): Promise<boolean>;

  addPerson(channelId: string, input: PersonInput): Promise<Person>;
  updatePerson(channelId: string, personId: string, input: PersonInput): Promise<void>;
  deletePerson(channelId: string, personId: string): Promise<void>;

  /** Family tree: a couple (wedding / separation dates optional). */
  /**
   * A member corrects their own card (the person they are in the channel).
   * The channel's owner gets a notification with what changed (unless it's them).
   */
  updateMyPerson(channelId: string, input: SelfPersonInput): Promise<void>;

  /** Owner: the channel's inbox, newest first. */
  listNotifications(channelId: string): Promise<ChannelNotification[]>;
  /** Owner: marks every notification of the channel as read. */
  markNotificationsRead(channelId: string): Promise<void>;

  addPartnership(channelId: string, input: PartnershipInput): Promise<Partnership>;
  updatePartnership(channelId: string, partnershipId: string, input: PartnershipInput): Promise<void>;
  deletePartnership(channelId: string, partnershipId: string): Promise<void>;

  /** Important dates: the owner, or anyone who appears in them (and stays in them). */
  addEvent(channelId: string, input: EventInput): Promise<FamilyEvent>;
  updateEvent(channelId: string, eventId: string, input: EventInput): Promise<void>;
  deleteEvent(channelId: string, eventId: string): Promise<void>;

  /**
   * Opens one of today's packs of a channel's album: PACK_SIZE cromos, same
   * odds for all, duplicates accumulate. Consumes the pack immediately.
   */
  openPack(channelId: string): Promise<PackPull[]>;

  /** Owner: publishes pending content (cromos get their album number). Rejecting is deleting it. */
  approveContent(channelId: string, kind: ContentKind, id: string): Promise<void>;

  addCard(channelId: string, input: CardInput): Promise<AlbumCard>;
  updateCard(channelId: string, cardId: string, input: CardInput): Promise<void>;
  deleteCard(channelId: string, cardId: string): Promise<void>;

  /**
   * Stores a photo already compressed by the app (WebP). Cromos also need
   * their tiny blurred copy; a person's photo goes in that person's folder
   * (members may only upload their own). Returns where it is and a preview URL;
   * the caller then saves the path in the card, person or video.
   */
  uploadPhoto(
    channelId: string,
    kind: PhotoKind,
    image: Blob,
    options?: { personId?: string; blurred?: Blob },
  ): Promise<UploadedPhoto>;

  /** A suggestion for the app's owner (screened and e-mailed by the server). */
  sendFeedback(subject: string, message: string): Promise<void>;

  /** Owner: deletes the channel for good, with its stored photos and all its content. */
  deleteChannel(channelId: string): Promise<void>;
  /** What deleting the current account would do (channel names). */
  accountDeletionPlan(): Promise<AccountDeletionPlan>;
  /** Deletes the current account for good (see accountDeletionPlan). */
  deleteAccount(): Promise<void>;

  /** Local mode only: wipes everything and restores the demo data. */
  resetDemo(): Promise<void>;
}

/** User-facing error: the message is safe to show as-is. */
export class RepositoryError extends Error {
  readonly code: 'not-found' | 'forbidden' | 'invalid' | 'conflict';
  readonly details: string[];

  constructor(code: RepositoryError['code'], message: string, details: string[] = []) {
    super(message);
    this.name = 'RepositoryError';
    this.code = code;
    this.details = details;
  }
}

/** Message to show for any error thrown by a repository call. */
export function errorMessage(error: unknown): string {
  if (error instanceof RepositoryError) {
    return error.details.length ? `${error.message}: ${error.details.join(' · ')}` : error.message;
  }
  return 'Ha ocurrido un error inesperado. Inténtalo de nuevo.';
}
