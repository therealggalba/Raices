import { CHANNEL_KINDS, ROLES, SCHEMA_VERSION } from '../types/domain';
import type {
  Channel,
  ChannelSnapshot,
  ChannelSummary,
  FamilyEvent,
  Favorite,
  Invitation,
  Library,
  Member,
  Person,
  User,
  ValidationResult,
  Video,
  ViewRecord,
  WatchProgress,
} from '../types/domain';
import { newId } from '../utils/ids';
import { decideProgress } from '../utils/progress';
import {
  MAX_EXPIRY_DAYS,
  expiryFrom,
  generateInvitationCode,
  invitationStatus,
  normalizeInvitationCode,
} from '../utils/invitations';
import {
  isId,
  isRecord,
  validateChannelInput,
  validateDisplayName,
  validateEventInput,
  validatePersonInput,
  validateVideoInput,
} from '../utils/validation';
import type { MemoriesRepository } from './repository';
import { RepositoryError } from './repository';
import { buildDemoDb } from './seed';

// Local backend for the public phase-1 MVP: the whole dataset lives in one
// JSON document in the browser. It still behaves like a server: it checks
// roles on every call, validates every input and never hands out references
// to its internal state.

export const STORAGE_KEY = 'family-memories:v1';

export interface Db {
  schemaVersion: number;
  currentUserId: string;
  users: User[];
  channels: Channel[];
  members: Member[];
  people: Person[];
  videos: Video[];
  events: FamilyEvent[];
  invitations: Invitation[];
  favorites: Favorite[];
  views: ViewRecord[];
  progress: WatchProgress[];
}

export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export function memoryStore(initial: Record<string, string> = {}): KeyValueStore {
  const data = new Map(Object.entries(initial));
  return { get: (k) => data.get(k) ?? null, set: (k, v) => void data.set(k, v) };
}

/** localStorage when available (it can throw in private windows), memory otherwise. */
export function browserStore(): KeyValueStore {
  const fallback = memoryStore();
  return {
    get(key) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return fallback.get(key);
      }
    },
    set(key, value) {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        fallback.set(key, value);
      }
    },
  };
}

const COLLECTIONS = [
  'users',
  'channels',
  'members',
  'people',
  'videos',
  'events',
  'invitations',
  'favorites',
  'views',
  'progress',
] as const;

/** Kinds given to channels created before kinds existed (schema v1). */
const V1_KINDS: Record<string, Db['channels'][number]['kind']> = {
  'demo-familia-montero': 'familia',
  'demo-amigos-uni': 'amigos',
};

/** Upgrades older stored documents in place; returns null when unknown. */
export function migrateDb(data: Record<string, unknown>): Record<string, unknown> | null {
  if (data.schemaVersion === 1) {
    if (!Array.isArray(data.channels)) return null;
    data.channels = data.channels.map((c: unknown) =>
      isRecord(c) ? { ...c, kind: (typeof c.id === 'string' && V1_KINDS[c.id]) || 'otros' } : c,
    );
    data.views = [];
    data.schemaVersion = 2;
  }
  if (data.schemaVersion === 2) {
    data.progress = [];
    data.schemaVersion = 3;
  }
  if (data.schemaVersion === 3) {
    // Every important date now repeats yearly: the flag is gone.
    if (!Array.isArray(data.events)) return null;
    data.events = data.events.map((e: unknown) => {
      if (!isRecord(e)) return e;
      const { recurring: _recurring, ...rest } = e;
      return rest;
    });
    data.schemaVersion = 4;
  }
  return data.schemaVersion === SCHEMA_VERSION ? data : null;
}

/** Structural check of a stored document; anything off means "start over". */
export function parseDb(raw: string | null): Db | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data)) return null;
  data = migrateDb(data);
  if (!data || !isRecord(data) || !isId(data.currentUserId)) return null;
  for (const key of COLLECTIONS) {
    const list = data[key];
    if (!Array.isArray(list) || !list.every(isRecord)) return null;
  }
  const db = data as unknown as Db;
  if (!db.users.some((u) => u.id === db.currentUserId)) return null;
  if (!db.members.every((m) => (ROLES as readonly string[]).includes(m.role))) return null;
  if (!db.channels.every((c) => (CHANNEL_KINDS as readonly string[]).includes(c.kind))) return null;
  return db;
}

function ensure<T>(result: ValidationResult<T>): T {
  if (!result.ok) throw new RepositoryError('invalid', 'Revisa los datos', result.errors);
  return result.value;
}

export interface LocalRepositoryOptions {
  store?: KeyValueStore;
  now?: () => Date;
}

export function createLocalRepository({
  store = browserStore(),
  now = () => new Date(),
}: LocalRepositoryOptions = {}): MemoriesRepository {
  let db: Db = load();

  function load(): Db {
    const parsed = parseDb(store.get(STORAGE_KEY));
    if (parsed) return parsed;
    const fresh = buildDemoDb(now());
    store.set(STORAGE_KEY, JSON.stringify(fresh));
    return fresh;
  }

  function commit() {
    store.set(STORAGE_KEY, JSON.stringify(db));
  }

  const clone = <T>(value: T): T => structuredClone(value);
  const nowIso = () => now().toISOString();
  const me = () => db.users.find((u) => u.id === db.currentUserId)!;

  function findChannel(channelId: string): Channel {
    const channel = db.channels.find((c) => c.id === channelId);
    if (!channel) throw new RepositoryError('not-found', 'Este canal no existe');
    return channel;
  }

  /** The current user's membership; non-members get the same "not found" as a missing channel. */
  function requireMember(channelId: string): Member {
    findChannel(channelId);
    const member = db.members.find((m) => m.channelId === channelId && m.userId === db.currentUserId);
    if (!member) throw new RepositoryError('not-found', 'Este canal no existe');
    return member;
  }

  function requireAdmin(channelId: string): Member {
    const member = requireMember(channelId);
    if (member.role !== 'admin') throw new RepositoryError('forbidden', 'Solo un administrador puede hacer esto');
    return member;
  }

  function admins(channelId: string): Member[] {
    return db.members.filter((m) => m.channelId === channelId && m.role === 'admin');
  }

  function checkPeople(channelId: string, personIds: readonly string[]) {
    const known = new Set(db.people.filter((p) => p.channelId === channelId).map((p) => p.id));
    if (personIds.some((id) => !known.has(id))) {
      throw new RepositoryError('invalid', 'Revisa los datos', ['Personas: alguna no pertenece al canal']);
    }
  }

  function findIn<T extends { id: string; channelId: string }>(list: T[], channelId: string, id: string, what: string): T {
    const item = list.find((x) => x.id === id && x.channelId === channelId);
    if (!item) throw new RepositoryError('not-found', `${what} no existe`);
    return item;
  }

  function deleteChannelData(channelId: string) {
    const inChannel = <T extends { channelId: string }>(list: T[]) => list.filter((x) => x.channelId !== channelId);
    db.channels = db.channels.filter((c) => c.id !== channelId);
    db.members = inChannel(db.members);
    db.people = inChannel(db.people);
    db.videos = inChannel(db.videos);
    db.events = inChannel(db.events);
    db.invitations = inChannel(db.invitations);
    db.favorites = inChannel(db.favorites);
    db.views = inChannel(db.views);
    db.progress = inChannel(db.progress);
  }

  const repo: MemoriesRepository = {
    mode: 'local',

    async getCurrentUser() {
      return clone(me());
    },

    async renameCurrentUser(name) {
      const value = ensure(validateDisplayName(name));
      me().name = value;
      commit();
      return clone(me());
    },

    async listChannels() {
      const summaries: ChannelSummary[] = db.members
        .filter((m) => m.userId === db.currentUserId)
        .map((m) => ({
          channel: findChannel(m.channelId),
          role: m.role,
          memberCount: db.members.filter((x) => x.channelId === m.channelId).length,
          videoCount: db.videos.filter((v) => v.channelId === m.channelId).length,
        }));
      return clone(summaries.sort((a, b) => a.channel.name.localeCompare(b.channel.name, 'es')));
    },

    async loadLibrary() {
      const mine = db.members.filter((m) => m.userId === db.currentUserId);
      const ids = new Set(mine.map((m) => m.channelId));
      const inMine = <T extends { channelId: string }>(list: T[]) => list.filter((x) => ids.has(x.channelId));
      const viewCounts: Record<string, number> = {};
      for (const view of inMine(db.views)) viewCounts[view.videoId] = (viewCounts[view.videoId] ?? 0) + 1;
      const library: Library = {
        channels: mine
          .map((m) => {
            const c = findChannel(m.channelId);
            return { id: c.id, name: c.name, kind: c.kind, role: m.role };
          })
          .sort((a, b) => a.name.localeCompare(b.name, 'es')),
        videos: inMine(db.videos),
        people: inMine(db.people),
        events: inMine(db.events),
        viewCounts,
        favoriteVideoIds: inMine(db.favorites)
          .filter((f) => f.userId === db.currentUserId)
          .map((f) => f.videoId),
        progress: Object.fromEntries(
          inMine(db.progress)
            .filter((p) => p.userId === db.currentUserId)
            .map((p) => [p.videoId, { positionSeconds: p.positionSeconds, durationSeconds: p.durationSeconds }]),
        ),
      };
      return clone(library);
    },

    async recordView(videoId) {
      const video = db.videos.find((v) => v.id === videoId);
      if (!video) throw new RepositoryError('not-found', 'El vídeo no existe');
      requireMember(video.channelId);
      db.views.push({ channelId: video.channelId, videoId, userId: db.currentUserId, at: nowIso() });
      commit();
    },

    async saveProgress(videoId, positionSeconds, durationSeconds) {
      const video = db.videos.find((v) => v.id === videoId);
      if (!video) throw new RepositoryError('not-found', 'El vídeo no existe');
      requireMember(video.channelId);
      const decision = decideProgress(positionSeconds, durationSeconds);
      if (!decision) throw new RepositoryError('invalid', 'Posición de reproducción inválida');
      const isMine = (p: WatchProgress) => p.videoId === videoId && p.userId === db.currentUserId;
      db.progress = db.progress.filter((p) => !isMine(p));
      if (decision.action === 'save') {
        db.progress.push({
          channelId: video.channelId,
          userId: db.currentUserId,
          videoId,
          positionSeconds: decision.positionSeconds,
          durationSeconds: decision.durationSeconds,
          updatedAt: nowIso(),
        });
      }
      commit();
    },

    async createChannel(input) {
      const value = ensure(validateChannelInput(input));
      const id = newId();
      const createdAt = nowIso();
      db.channels.push({ id, ...value, createdAt, createdBy: db.currentUserId });
      db.members.push({ channelId: id, userId: db.currentUserId, displayName: me().name, role: 'admin', joinedAt: createdAt });
      commit();
      return id;
    },

    async loadChannel(channelId) {
      const member = requireMember(channelId);
      const of = <T extends { channelId: string }>(list: T[]) => list.filter((x) => x.channelId === channelId);
      const snapshot: ChannelSnapshot = {
        channel: findChannel(channelId),
        me: member,
        members: of(db.members),
        people: of(db.people),
        videos: of(db.videos),
        events: of(db.events),
        invitations: member.role === 'admin' ? of(db.invitations) : [],
        favoriteVideoIds: of(db.favorites)
          .filter((f) => f.userId === db.currentUserId)
          .map((f) => f.videoId),
      };
      return clone(snapshot);
    },

    async updateChannel(channelId, input) {
      requireAdmin(channelId);
      const value = ensure(validateChannelInput(input));
      const channel = findChannel(channelId);
      channel.name = value.name;
      channel.description = value.description;
      channel.kind = value.kind;
      if (value.coverUrl) channel.coverUrl = value.coverUrl;
      else delete channel.coverUrl;
      commit();
    },

    async leaveChannel(channelId) {
      const member = requireMember(channelId);
      const others = db.members.filter((m) => m.channelId === channelId && m.userId !== member.userId);
      if (others.length === 0) {
        deleteChannelData(channelId);
      } else {
        if (member.role === 'admin' && admins(channelId).length === 1) {
          throw new RepositoryError('conflict', 'Nombra a otro administrador antes de salir del canal');
        }
        db.members = db.members.filter((m) => m !== member);
        db.favorites = db.favorites.filter((f) => !(f.channelId === channelId && f.userId === member.userId));
        db.progress = db.progress.filter((p) => !(p.channelId === channelId && p.userId === member.userId));
      }
      commit();
    },

    async redeemInvitation(code, displayName) {
      const name = ensure(validateDisplayName(displayName));
      const normalized = normalizeInvitationCode(code);
      const invitation = normalized ? db.invitations.find((i) => i.code === normalized) : undefined;
      // Same message for unknown, used, expired and revoked codes: no oracle.
      const invalid = new RepositoryError('invalid', 'La invitación no es válida o ha caducado');
      if (!invitation || invitationStatus(invitation, nowIso()) !== 'active') throw invalid;
      const already = db.members.some((m) => m.channelId === invitation.channelId && m.userId === db.currentUserId);
      if (already) throw new RepositoryError('conflict', 'Ya formas parte de este canal');
      const at = nowIso();
      invitation.usedAt = at;
      invitation.usedBy = db.currentUserId;
      db.members.push({
        channelId: invitation.channelId,
        userId: db.currentUserId,
        displayName: name,
        role: 'member',
        joinedAt: at,
        invitationId: invitation.id,
      });
      commit();
      return invitation.channelId;
    },

    async createInvitation(channelId, expiresInDays) {
      requireAdmin(channelId);
      if (!Number.isInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > MAX_EXPIRY_DAYS) {
        throw new RepositoryError('invalid', `La caducidad debe estar entre 1 y ${MAX_EXPIRY_DAYS} días`);
      }
      const taken = new Set(db.invitations.map((i) => i.code));
      let code = generateInvitationCode();
      while (taken.has(code)) code = generateInvitationCode();
      const invitation: Invitation = {
        id: newId(),
        channelId,
        code,
        createdBy: db.currentUserId,
        createdAt: nowIso(),
        expiresAt: expiryFrom(now(), expiresInDays),
      };
      db.invitations.push(invitation);
      commit();
      return clone(invitation);
    },

    async revokeInvitation(channelId, invitationId) {
      requireAdmin(channelId);
      const invitation = findIn(db.invitations, channelId, invitationId, 'La invitación');
      if (invitationStatus(invitation, nowIso()) !== 'active') {
        throw new RepositoryError('conflict', 'Solo se pueden revocar invitaciones activas');
      }
      invitation.revokedAt = nowIso();
      commit();
    },

    async setMemberRole(channelId, userId, role) {
      requireAdmin(channelId);
      if (!(ROLES as readonly string[]).includes(role)) throw new RepositoryError('invalid', 'Rol inválido');
      const target = db.members.find((m) => m.channelId === channelId && m.userId === userId);
      if (!target) throw new RepositoryError('not-found', 'Ese miembro no existe');
      if (target.role === 'admin' && role !== 'admin' && admins(channelId).length === 1) {
        throw new RepositoryError('conflict', 'El canal necesita al menos un administrador');
      }
      target.role = role;
      commit();
    },

    async removeMember(channelId, userId) {
      const admin = requireAdmin(channelId);
      if (userId === admin.userId) throw new RepositoryError('conflict', 'Para salir del canal usa «Salir del canal»');
      const exists = db.members.some((m) => m.channelId === channelId && m.userId === userId);
      if (!exists) throw new RepositoryError('not-found', 'Ese miembro no existe');
      db.members = db.members.filter((m) => !(m.channelId === channelId && m.userId === userId));
      db.favorites = db.favorites.filter((f) => !(f.channelId === channelId && f.userId === userId));
      db.progress = db.progress.filter((p) => !(p.channelId === channelId && p.userId === userId));
      commit();
    },

    async addVideo(channelId, input) {
      requireAdmin(channelId);
      const value = ensure(validateVideoInput(input));
      checkPeople(channelId, value.personIds);
      const video: Video = { id: newId(), channelId, ...value, uploadedAt: nowIso(), authorId: db.currentUserId };
      db.videos.push(video);
      commit();
      return clone(video);
    },

    async updateVideo(channelId, videoId, input) {
      requireAdmin(channelId);
      const video = findIn(db.videos, channelId, videoId, 'El vídeo');
      const value = ensure(validateVideoInput(input));
      checkPeople(channelId, value.personIds);
      Object.assign(video, value);
      if (!value.thumbnailUrl) delete video.thumbnailUrl;
      if (!value.durationSeconds) delete video.durationSeconds;
      commit();
    },

    async deleteVideo(channelId, videoId) {
      requireAdmin(channelId);
      findIn(db.videos, channelId, videoId, 'El vídeo');
      db.videos = db.videos.filter((v) => v.id !== videoId);
      db.favorites = db.favorites.filter((f) => f.videoId !== videoId);
      db.views = db.views.filter((v) => v.videoId !== videoId);
      db.progress = db.progress.filter((p) => p.videoId !== videoId);
      commit();
    },

    async toggleFavorite(channelId, videoId) {
      requireMember(channelId);
      findIn(db.videos, channelId, videoId, 'El vídeo');
      const isMine = (f: Favorite) => f.channelId === channelId && f.videoId === videoId && f.userId === db.currentUserId;
      const exists = db.favorites.some(isMine);
      if (exists) db.favorites = db.favorites.filter((f) => !isMine(f));
      else db.favorites.push({ channelId, videoId, userId: db.currentUserId });
      commit();
      return !exists;
    },

    async addPerson(channelId, input) {
      requireAdmin(channelId);
      const person: Person = { id: newId(), channelId, ...ensure(validatePersonInput(input)) };
      db.people.push(person);
      commit();
      return clone(person);
    },

    async updatePerson(channelId, personId, input) {
      requireAdmin(channelId);
      const person = findIn(db.people, channelId, personId, 'La persona');
      const value = ensure(validatePersonInput(input));
      const index = db.people.indexOf(person);
      db.people[index] = { id: person.id, channelId, ...value };
      commit();
    },

    async deletePerson(channelId, personId) {
      requireAdmin(channelId);
      findIn(db.people, channelId, personId, 'La persona');
      db.people = db.people.filter((p) => p.id !== personId);
      const unlink = (ids: string[]) => ids.filter((id) => id !== personId);
      for (const v of db.videos) if (v.channelId === channelId) v.personIds = unlink(v.personIds);
      for (const e of db.events) if (e.channelId === channelId) e.personIds = unlink(e.personIds);
      commit();
    },

    async addEvent(channelId, input) {
      requireAdmin(channelId);
      const value = ensure(validateEventInput(input));
      checkPeople(channelId, value.personIds);
      const event: FamilyEvent = { id: newId(), channelId, ...value };
      db.events.push(event);
      commit();
      return clone(event);
    },

    async updateEvent(channelId, eventId, input) {
      requireAdmin(channelId);
      const event = findIn(db.events, channelId, eventId, 'El evento');
      const value = ensure(validateEventInput(input));
      checkPeople(channelId, value.personIds);
      Object.assign(event, value);
      commit();
    },

    async deleteEvent(channelId, eventId) {
      requireAdmin(channelId);
      findIn(db.events, channelId, eventId, 'El evento');
      db.events = db.events.filter((e) => e.id !== eventId);
      commit();
    },

    async resetDemo() {
      db = buildDemoDb(now());
      commit();
    },
  };

  // Re-read storage before every call: another tab (or a page that just
  // flushed its playback position) may have written since this instance
  // last looked, and writing a stale copy back would lose those changes.
  const synced = {} as MemoriesRepository;
  for (const [key, value] of Object.entries(repo) as [keyof MemoriesRepository, unknown][]) {
    (synced as unknown as Record<string, unknown>)[key] =
      typeof value === 'function'
        ? (...args: unknown[]) => {
            db = load();
            return (value as (...a: unknown[]) => unknown)(...args);
          }
        : value;
  }
  return synced;
}
