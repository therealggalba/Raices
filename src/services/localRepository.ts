import { CHANNEL_KINDS, ROLES, SCHEMA_VERSION } from '../types/domain';
import type {
  AlbumCard,
  CardCopy,
  Channel,
  ChannelNotification,
  FieldChange,
  ChannelSnapshot,
  ChannelSummary,
  FamilyEvent,
  Favorite,
  Invitation,
  Library,
  PackOpening,
  PackPull,
  Partnership,
  Member,
  Person,
  User,
  ValidationResult,
  Video,
  ViewRecord,
  WatchProgress,
} from '../types/domain';
import { nextCardNumber } from '../utils/album';
import { selfChanges } from '../utils/people';
import { partnershipKey, wouldCreateCycle } from '../utils/familyTree';
import { newId } from '../utils/ids';
import { drawPack, packStatus, cryptoRandom } from '../utils/packs';
import type { RandomFn } from '../utils/packs';
import { toIsoDate } from '../utils/dates';
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
  validateCardInput,
  validateChannelInput,
  validatePartnershipInput,
  validateDisplayName,
  validateEventInput,
  validatePersonInput,
  validateSelfPersonInput,
  validateVideoInput,
} from '../utils/validation';
import type { MemoriesRepository } from './repository';
import { RepositoryError } from './repository';
import { DEMO_PACK_THEMES, addDemoAlbum, addDemoFamilyTree, buildDemoDb, demoUnlocks, extraDemoCopies } from './seed';
import type { LegacyUnlock } from './seed';

// Local backend for the public phase-1 MVP: the whole dataset lives in one
// JSON document in the browser. It still behaves like a server: it checks
// roles on every call, validates every input and never hands out references
// to its internal state.

export const STORAGE_KEY = 'raices:v1';

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
  cards: AlbumCard[];
  /** Channel id -> last album number issued (never goes back). */
  cardSequence: Record<string, number>;
  copies: CardCopy[];
  packs: PackOpening[];
  partnerships: Partnership[];
  notifications: ChannelNotification[];
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
  'cards',
  'copies',
  'packs',
  'partnerships',
  'notifications',
] as const;

/** Kinds given to channels created before kinds existed (schema v1). */
const V1_KINDS: Record<string, Db['channels'][number]['kind']> = {
  'demo-familia-montero': 'familia',
  'demo-amigos-uni': 'amigos',
};

/** Upgrades older stored documents in place; returns null when unknown. */
export function migrateDb(data: Record<string, unknown>, now: Date = new Date()): Record<string, unknown> | null {
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
  if (data.schemaVersion === 4) {
    data.cards = [];
    data.cardSequence = {};
    data.schemaVersion = 5;
    // Demo channels get their example album (only the ones still present).
    if (Array.isArray(data.channels) && Array.isArray(data.people) && Array.isArray(data.events)) {
      addDemoAlbum(data as unknown as Db, now);
    }
  }
  if (data.schemaVersion === 5) {
    // Rarities are gone (every cromo is equal); per-user unlocks appear.
    if (!Array.isArray(data.cards)) return null;
    data.cards = data.cards.map((c: unknown) => {
      if (!isRecord(c)) return c;
      const { rarity: _rarity, ...rest } = c;
      return rest;
    });
    data.unlocks = isId(data.currentUserId)
      ? demoUnlocks(data.cards as AlbumCard[], data.currentUserId, now)
      : [];
    data.schemaVersion = 6;
  }
  if (data.schemaVersion === 6) {
    // Unlocks become copy counters (duplicates accumulate); daily packs and
    // a pack design per channel appear.
    if (!Array.isArray(data.unlocks) || !Array.isArray(data.channels)) return null;
    data.copies = (data.unlocks as LegacyUnlock[]).filter(isRecord).map((u) => ({
      channelId: u.channelId,
      userId: u.userId,
      cardId: u.cardId,
      count: 1 + extraDemoCopies(u.cardId),
      firstObtainedAt: u.unlockedAt,
    }));
    delete data.unlocks;
    data.packs = [];
    data.channels = data.channels.map((c: unknown) =>
      isRecord(c) ? { ...c, packTheme: (typeof c.id === 'string' && DEMO_PACK_THEMES[c.id]) || 'clasico' } : c,
    );
    data.schemaVersion = 7;
  }
  if (data.schemaVersion === 7) {
    // Family tree: parents on each person, couples in their own collection.
    if (!Array.isArray(data.people)) return null;
    data.people = data.people.map((p: unknown) => (isRecord(p) ? { ...p, parentIds: [] } : p));
    data.partnerships = [];
    addDemoFamilyTree(data as unknown as Db);
    data.schemaVersion = 8;
  }
  if (data.schemaVersion === 8) {
    // Admins' inbox.
    data.notifications = [];
    data.schemaVersion = 9;
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
  if (!isRecord(data.cardSequence) || !Object.values(data.cardSequence).every((n) => Number.isInteger(n))) return null;
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
  /** Pack draws (tests inject a deterministic one). */
  random?: RandomFn;
}

export function createLocalRepository({
  store = browserStore(),
  now = () => new Date(),
  random = cryptoRandom,
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
    db.cards = inChannel(db.cards);
    delete db.cardSequence[channelId];
    db.copies = inChannel(db.copies);
    db.packs = inChannel(db.packs);
    db.partnerships = inChannel(db.partnerships);
    db.notifications = inChannel(db.notifications);
  }

  /** Tells the channel's admins (inbox). */
  function notify(channelId: string, kind: ChannelNotification['kind'], member: Member, changes: FieldChange[] = []) {
    db.notifications.push({
      id: newId(),
      channelId,
      kind,
      actorId: member.userId,
      actorName: member.displayName,
      ...(member.personId ? { personId: member.personId } : {}),
      changes,
      createdAt: nowIso(),
    });
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
            return { id: c.id, name: c.name, kind: c.kind, packTheme: c.packTheme, role: m.role };
          })
          .sort((a, b) => a.name.localeCompare(b.name, 'es')),
        videos: inMine(db.videos),
        people: inMine(db.people),
        events: inMine(db.events),
        viewCounts,
        favoriteVideoIds: inMine(db.favorites)
          .filter((f) => f.userId === db.currentUserId)
          .map((f) => f.videoId),
        cards: inMine(db.cards),
        cardCopies: Object.fromEntries(
          inMine(db.copies)
            .filter((c) => c.userId === db.currentUserId && c.count > 0)
            .map((c) => [c.cardId, c.count]),
        ),
        packs: packStatus(db.packs, db.currentUserId, toIsoDate(now())),
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
      db.channels.push({ id, ...value, packTheme: value.packTheme ?? 'clasico', createdAt, createdBy: db.currentUserId });
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
        cards: of(db.cards),
        partnerships: of(db.partnerships),
        invitations: member.role === 'admin' ? of(db.invitations) : [],
        unreadNotifications: member.role === 'admin' ? of(db.notifications).filter((n) => !n.readAt).length : 0,
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
      channel.packTheme = value.packTheme ?? 'clasico';
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
        notify(channelId, 'member_left', member);
        db.favorites = db.favorites.filter((f) => !(f.channelId === channelId && f.userId === member.userId));
        db.progress = db.progress.filter((p) => !(p.channelId === channelId && p.userId === member.userId));
        db.copies = db.copies.filter((c) => !(c.channelId === channelId && c.userId === member.userId));
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
      const personId = invitation.personId;
      const personFree =
        !!personId &&
        db.people.some((p) => p.id === personId && p.channelId === invitation.channelId) &&
        !db.members.some((m) => m.channelId === invitation.channelId && m.personId === personId);
      db.members.push({
        channelId: invitation.channelId,
        userId: db.currentUserId,
        displayName: name,
        role: 'member',
        joinedAt: at,
        invitationId: invitation.id,
        ...(personFree ? { personId } : {}),
      });
      notify(invitation.channelId, 'member_joined', db.members[db.members.length - 1]);
      commit();
      return invitation.channelId;
    },

    async createInvitation(channelId, expiresInDays, personId) {
      requireAdmin(channelId);
      if (!isId(personId)) throw new RepositoryError('invalid', 'Elige para quién es la invitación');
      const person = findIn(db.people, channelId, personId, 'La persona');
      if (person.deathDate) throw new RepositoryError('invalid', 'No se puede invitar a una persona fallecida');
      const member = db.members.find((m) => m.channelId === channelId && m.personId === personId);
      if (member) throw new RepositoryError('conflict', `Esa persona ya está en el canal (${member.displayName})`);
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
        personId,
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

    async linkMemberPerson(channelId, userId, personId) {
      const me = requireMember(channelId);
      const target = db.members.find((m) => m.channelId === channelId && m.userId === userId);
      if (!target) throw new RepositoryError('not-found', 'Ese miembro no existe');
      // Admins set anyone's; a member only picks their own, once.
      const choosingOwn = userId === me.userId && !target.personId && personId !== null;
      if (me.role !== 'admin' && !choosingOwn) {
        throw new RepositoryError('forbidden', 'Solo un administrador puede cambiar quién es cada miembro');
      }
      if (personId !== null) {
        findIn(db.people, channelId, personId, 'La persona');
        const taken = db.members.find((m) => m.channelId === channelId && m.personId === personId && m.userId !== userId);
        if (taken) throw new RepositoryError('conflict', `Esta persona ya está enlazada con ${taken.displayName}`);
        target.personId = personId;
      } else {
        delete target.personId;
      }
      commit();
    },

    async removeMember(channelId, userId) {
      const admin = requireAdmin(channelId);
      if (userId === admin.userId) throw new RepositoryError('conflict', 'Para salir del canal usa «Salir del canal»');
      const removed = db.members.find((m) => m.channelId === channelId && m.userId === userId);
      if (!removed) throw new RepositoryError('not-found', 'Ese miembro no existe');
      notify(channelId, 'member_removed', removed);
      db.members = db.members.filter((m) => !(m.channelId === channelId && m.userId === userId));
      db.favorites = db.favorites.filter((f) => !(f.channelId === channelId && f.userId === userId));
      db.progress = db.progress.filter((p) => !(p.channelId === channelId && p.userId === userId));
      db.copies = db.copies.filter((c) => !(c.channelId === channelId && c.userId === userId));
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
      const value = ensure(validatePersonInput(input));
      checkPeople(channelId, value.parentIds ?? []);
      const person: Person = { id: newId(), channelId, ...value, parentIds: value.parentIds ?? [] };
      db.people.push(person);
      commit();
      return clone(person);
    },

    async updatePerson(channelId, personId, input) {
      requireAdmin(channelId);
      const person = findIn(db.people, channelId, personId, 'La persona');
      const value = ensure(validatePersonInput(input));
      const parentIds = value.parentIds ?? [];
      checkPeople(channelId, parentIds);
      const inChannel = db.people.filter((p) => p.channelId === channelId);
      if (wouldCreateCycle(inChannel, person.id, parentIds)) {
        throw new RepositoryError('invalid', 'Revisa los datos', [
          'Progenitores: una persona no puede ser antepasada de sí misma',
        ]);
      }
      const index = db.people.indexOf(person);
      db.people[index] = { id: person.id, channelId, ...value, parentIds };
      commit();
    },

    async deletePerson(channelId, personId) {
      requireAdmin(channelId);
      findIn(db.people, channelId, personId, 'La persona');
      db.people = db.people.filter((p) => p.id !== personId);
      const unlink = (ids: string[]) => ids.filter((id) => id !== personId);
      for (const v of db.videos) if (v.channelId === channelId) v.personIds = unlink(v.personIds);
      for (const e of db.events) if (e.channelId === channelId) e.personIds = unlink(e.personIds);
      for (const p of db.people) if (p.channelId === channelId) p.parentIds = unlink(p.parentIds);
      db.partnerships = db.partnerships.filter((c) => !c.personIds.includes(personId));
      for (const m of db.members) if (m.channelId === channelId && m.personId === personId) delete m.personId;
      // Their cromos stay in the album, under "Varios".
      for (const c of db.cards) if (c.channelId === channelId && c.personId === personId) delete c.personId;
      commit();
    },

    async updateMyPerson(channelId, input) {
      const me = requireMember(channelId);
      if (!me.personId) throw new RepositoryError('forbidden', 'Primero elige quién eres en este canal');
      const person = findIn(db.people, channelId, me.personId, 'Tu ficha');
      const value = ensure(validateSelfPersonInput(input));
      const changes = selfChanges(person, value);
      if (changes.length === 0) return;
      const index = db.people.indexOf(person);
      const updated: Person = { ...person, firstName: value.firstName, lastName: value.lastName, biography: value.biography };
      for (const key of ['birthDate', 'gender', 'photoUrl', 'photoPath'] as const) {
        if (value[key]) (updated as unknown as Record<string, unknown>)[key] = value[key];
        else delete updated[key];
      }
      db.people[index] = updated;
      // Admins edit cards anyway: only members' corrections are reported.
      if (me.role !== 'admin') notify(channelId, 'person_edited', me, changes);
      commit();
    },

    async listNotifications(channelId) {
      requireAdmin(channelId);
      return clone(
        db.notifications.filter((n) => n.channelId === channelId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
    },

    async markNotificationsRead(channelId) {
      requireAdmin(channelId);
      const at = nowIso();
      for (const n of db.notifications) if (n.channelId === channelId && !n.readAt) n.readAt = at;
      commit();
    },

    async addPartnership(channelId, input) {
      requireAdmin(channelId);
      const value = ensure(validatePartnershipInput(input));
      checkPeople(channelId, value.personIds);
      const key = partnershipKey(...value.personIds);
      if (db.partnerships.some((c) => c.channelId === channelId && partnershipKey(...c.personIds) === key)) {
        throw new RepositoryError('conflict', 'Esa pareja ya está registrada');
      }
      const partnership: Partnership = { id: newId(), channelId, ...value };
      db.partnerships.push(partnership);
      commit();
      return clone(partnership);
    },

    async updatePartnership(channelId, partnershipId, input) {
      requireAdmin(channelId);
      const current = findIn(db.partnerships, channelId, partnershipId, 'La pareja');
      const value = ensure(validatePartnershipInput(input));
      if (partnershipKey(...value.personIds) !== partnershipKey(...current.personIds)) {
        throw new RepositoryError('invalid', 'No se pueden cambiar las personas de una pareja');
      }
      db.partnerships[db.partnerships.indexOf(current)] = { id: current.id, channelId, ...value };
      commit();
    },

    async deletePartnership(channelId, partnershipId) {
      requireAdmin(channelId);
      findIn(db.partnerships, channelId, partnershipId, 'La pareja');
      db.partnerships = db.partnerships.filter((c) => c.id !== partnershipId);
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

    async openPack(channelId) {
      requireMember(channelId);
      const today = toIsoDate(now());
      if (packStatus(db.packs, db.currentUserId, today).remaining === 0) {
        throw new RepositoryError('conflict', 'Ya has abierto todos los sobres de hoy. ¡Vuelve mañana!');
      }
      const pool = db.cards.filter((c) => c.channelId === channelId);
      if (pool.length === 0) throw new RepositoryError('conflict', 'Este álbum todavía no tiene cromos');
      const drawn = drawPack(pool, random);
      const at = nowIso();
      const pulls: PackPull[] = drawn.map((card) => {
        let copy = db.copies.find((c) => c.cardId === card.id && c.userId === db.currentUserId);
        const isNew = !copy || copy.count === 0;
        if (!copy) {
          copy = { channelId, userId: db.currentUserId, cardId: card.id, count: 0, firstObtainedAt: at };
          db.copies.push(copy);
        }
        copy.count += 1;
        return { card, isNew, copies: copy.count };
      });
      db.packs.push({ id: newId(), channelId, userId: db.currentUserId, date: today, openedAt: at, cardIds: drawn.map((c) => c.id) });
      commit();
      return clone(pulls);
    },

    async addCard(channelId, input) {
      requireAdmin(channelId);
      const value = ensure(validateCardInput(input));
      if (value.personId) checkPeople(channelId, [value.personId]);
      const card: AlbumCard = {
        id: newId(),
        channelId,
        number: nextCardNumber(
          db.cards.filter((c) => c.channelId === channelId),
          db.cardSequence[channelId],
        ),
        ...value,
        createdAt: nowIso(),
        authorId: db.currentUserId,
      };
      db.cards.push(card);
      db.cardSequence[channelId] = card.number;
      commit();
      return clone(card);
    },

    async updateCard(channelId, cardId, input) {
      requireAdmin(channelId);
      const card = findIn(db.cards, channelId, cardId, 'El cromo');
      const value = ensure(validateCardInput(input));
      if (value.personId) checkPeople(channelId, [value.personId]);
      const { id, number, createdAt, authorId } = card;
      db.cards[db.cards.indexOf(card)] = { id, channelId, number, createdAt, authorId, ...value };
      commit();
    },

    async deleteCard(channelId, cardId) {
      requireAdmin(channelId);
      findIn(db.cards, channelId, cardId, 'El cromo');
      db.cards = db.cards.filter((c) => c.id !== cardId);
      db.copies = db.copies.filter((c) => c.cardId !== cardId);
      commit();
    },

    async uploadPhoto() {
      throw new RepositoryError('invalid', 'Subir fotos solo está disponible con una cuenta');
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
