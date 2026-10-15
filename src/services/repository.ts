import type {
  ChannelInput,
  ChannelSnapshot,
  ChannelSummary,
  EventInput,
  FamilyEvent,
  Invitation,
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
  removeMember(channelId: string, userId: string): Promise<void>;

  addVideo(channelId: string, input: VideoInput): Promise<Video>;
  updateVideo(channelId: string, videoId: string, input: VideoInput): Promise<void>;
  deleteVideo(channelId: string, videoId: string): Promise<void>;
  toggleFavorite(channelId: string, videoId: string): Promise<boolean>;

  addPerson(channelId: string, input: PersonInput): Promise<Person>;
  updatePerson(channelId: string, personId: string, input: PersonInput): Promise<void>;
  deletePerson(channelId: string, personId: string): Promise<void>;

  addEvent(channelId: string, input: EventInput): Promise<FamilyEvent>;
  updateEvent(channelId: string, eventId: string, input: EventInput): Promise<void>;
  deleteEvent(channelId: string, eventId: string): Promise<void>;

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
