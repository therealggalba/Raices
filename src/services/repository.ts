import type {
  AlbumCard,
  CardInput,
  ChannelInput,
  ChannelSnapshot,
  ChannelSummary,
  EventInput,
  FamilyEvent,
  Invitation,
  Library,
  PackPull,
  Partnership,
  PartnershipInput,
  Person,
  PersonInput,
  Role,
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
  /** Creates a channel; the creator becomes its first admin. */
  createChannel(input: ChannelInput): Promise<string>;
  loadChannel(channelId: string): Promise<ChannelSnapshot>;
  updateChannel(channelId: string, input: ChannelInput): Promise<void>;
  leaveChannel(channelId: string): Promise<void>;

  /** Joins the channel the code belongs to. Returns its id. */
  redeemInvitation(code: string, displayName: string): Promise<string>;
  createInvitation(channelId: string, expiresInDays: number): Promise<Invitation>;
  revokeInvitation(channelId: string, invitationId: string): Promise<void>;

  setMemberRole(channelId: string, userId: string, role: Role): Promise<void>;
  /**
   * «Esta persona soy yo»: links a member to a person of the channel (kinship
   * is then shown relative to them). Members link themselves; an admin can
   * only undo someone else's link (personId null). One member per person.
   */
  linkMemberPerson(channelId: string, userId: string, personId: string | null): Promise<void>;
  removeMember(channelId: string, userId: string): Promise<void>;

  addVideo(channelId: string, input: VideoInput): Promise<Video>;
  updateVideo(channelId: string, videoId: string, input: VideoInput): Promise<void>;
  deleteVideo(channelId: string, videoId: string): Promise<void>;
  toggleFavorite(channelId: string, videoId: string): Promise<boolean>;

  addPerson(channelId: string, input: PersonInput): Promise<Person>;
  updatePerson(channelId: string, personId: string, input: PersonInput): Promise<void>;
  deletePerson(channelId: string, personId: string): Promise<void>;

  /** Family tree: a couple (wedding / separation dates optional). */
  addPartnership(channelId: string, input: PartnershipInput): Promise<Partnership>;
  updatePartnership(channelId: string, partnershipId: string, input: PartnershipInput): Promise<void>;
  deletePartnership(channelId: string, partnershipId: string): Promise<void>;

  addEvent(channelId: string, input: EventInput): Promise<FamilyEvent>;
  updateEvent(channelId: string, eventId: string, input: EventInput): Promise<void>;
  deleteEvent(channelId: string, eventId: string): Promise<void>;

  /**
   * Opens one of today's packs of a channel's album: PACK_SIZE cromos, same
   * odds for all, duplicates accumulate. Consumes the pack immediately.
   */
  openPack(channelId: string): Promise<PackPull[]>;

  addCard(channelId: string, input: CardInput): Promise<AlbumCard>;
  updateCard(channelId: string, cardId: string, input: CardInput): Promise<void>;
  deleteCard(channelId: string, cardId: string): Promise<void>;

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
