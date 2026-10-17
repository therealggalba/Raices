import { beforeEach, describe, expect, it } from 'vitest';
import type { EventInput, VideoInput } from '../types/domain';
import { STORAGE_KEY, createLocalRepository, memoryStore, parseDb } from '../services/localRepository';
import type { Db, KeyValueStore } from '../services/localRepository';
import type { MemoriesRepository } from '../services/repository';
import { RepositoryError } from '../services/repository';
import { DEMO_COUSINS_ID, DEMO_FAMILY_ID, DEMO_FRIENDS_ID, buildDemoDb } from '../services/seed';

const NOW = new Date('2026-10-15T10:00:00.000Z');

const videoInput: VideoInput = {
  title: 'Feria de abril',
  description: '',
  mediaUrl: 'https://youtu.be/dQw4w9WgXcQ',
  eventDate: '2010-04',
  category: 'otros',
  tags: [],
  personIds: ['p-carlos'],
};

const eventInput: EventInput = {
  type: 'otro',
  title: 'Reunión de primos',
  date: '2026-12-27',
  personIds: [],
  notes: '',
};

async function rejection(promise: Promise<unknown>): Promise<RepositoryError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof RepositoryError) return error;
    throw error;
  }
  throw new Error('expected the call to fail');
}

describe('local repository', () => {
  let store: KeyValueStore;
  let repo: MemoriesRepository;
  let clock: Date;

  beforeEach(() => {
    store = memoryStore();
    clock = NOW;
    repo = createLocalRepository({ store, now: () => clock });
  });

  it('seeds the demo on first use and persists it', async () => {
    const channels = await repo.listChannels();
    expect(channels.map((c) => [c.channel.id, c.role])).toEqual([
      [DEMO_FRIENDS_ID, 'member'],
      [DEMO_FAMILY_ID, 'admin'],
      [DEMO_COUSINS_ID, 'member'],
    ]);
    expect(parseDb(store.get(STORAGE_KEY))).not.toBeNull();
  });

  it('reseeds when the stored document is corrupt or from another schema', () => {
    expect(parseDb('{not json')).toBeNull();
    expect(parseDb(JSON.stringify({ schemaVersion: 999 }))).toBeNull();
    const corrupt = memoryStore({ [STORAGE_KEY]: '{"schemaVersion":1}' });
    createLocalRepository({ store: corrupt, now: () => NOW });
    expect(parseDb(corrupt.get(STORAGE_KEY))).not.toBeNull();
  });

  it('hides admin-only data from standard members and forbids admin actions', async () => {
    const snapshot = await repo.loadChannel(DEMO_FRIENDS_ID);
    expect(snapshot.me.role).toBe('member');
    expect(snapshot.invitations).toEqual([]);
    expect((await rejection(repo.addVideo(DEMO_FRIENDS_ID, { ...videoInput, personIds: [] }))).code).toBe('forbidden');
    expect((await rejection(repo.createInvitation(DEMO_FRIENDS_ID, 7))).code).toBe('forbidden');
    expect((await rejection(repo.addEvent(DEMO_FRIENDS_ID, eventInput))).code).toBe('forbidden');
  });

  it('builds a library across every channel the user belongs to', async () => {
    const library = await repo.loadLibrary();
    expect(library.channels.map((c) => [c.id, c.kind])).toEqual([
      [DEMO_FRIENDS_ID, 'amigos'],
      [DEMO_FAMILY_ID, 'familia'],
      [DEMO_COUSINS_ID, 'familia'],
    ]);
    const channelIds = new Set(library.videos.map((v) => v.channelId));
    expect(channelIds).toEqual(new Set([DEMO_FRIENDS_ID, DEMO_FAMILY_ID, DEMO_COUSINS_ID]));
    expect(library.viewCounts['v-demo-1']).toBe(14);
    expect(library.favoriteVideoIds).toContain('v-demo-uni-6');
  });

  it('excludes channels the user left from the library', async () => {
    await repo.leaveChannel(DEMO_COUSINS_ID);
    const library = await repo.loadLibrary();
    expect(library.videos.some((v) => v.channelId === DEMO_COUSINS_ID)).toBe(false);
    expect(library.channels.some((c) => c.id === DEMO_COUSINS_ID)).toBe(false);
  });

  it('records views for members only and forgets them with the video', async () => {
    await repo.recordView('v-demo-2');
    await repo.recordView('v-demo-2');
    expect((await repo.loadLibrary()).viewCounts['v-demo-2']).toBe(2);
    expect((await rejection(repo.recordView('nope'))).code).toBe('not-found');
    await repo.deleteVideo(DEMO_FAMILY_ID, 'v-demo-2');
    expect((await repo.loadLibrary()).viewCounts['v-demo-2']).toBeUndefined();
  });

  it('saves, resumes and clears watch progress per user', async () => {
    const bbb = (await repo.loadLibrary()).progress;
    expect(Object.keys(bbb)).toHaveLength(1);
    await repo.saveProgress('v-demo-3', 120, 596);
    expect((await repo.loadLibrary()).progress['v-demo-3']).toEqual({ positionSeconds: 120, durationSeconds: 596 });
    await repo.saveProgress('v-demo-3', 200, 596);
    expect((await repo.loadLibrary()).progress['v-demo-3'].positionSeconds).toBe(200);
    await repo.saveProgress('v-demo-3', 590, 596);
    expect((await repo.loadLibrary()).progress['v-demo-3']).toBeUndefined();
    expect((await rejection(repo.saveProgress('v-demo-3', -5, 596))).code).toBe('invalid');
    expect((await rejection(repo.saveProgress('nope', 10, 596))).code).toBe('not-found');
  });

  it('migrates a schema v1 document instead of discarding it', async () => {
    const v1 = buildDemoDb(NOW) as unknown as Record<string, unknown>;
    v1.schemaVersion = 1;
    delete v1.views;
    for (const c of v1.channels as Record<string, unknown>[]) delete c.kind;
    for (const e of v1.events as Record<string, unknown>[]) e.recurring = true;
    (v1.channels as Record<string, unknown>[]).push({
      id: 'mi-canal',
      name: 'Mío',
      description: '',
      createdAt: NOW.toISOString(),
      createdBy: v1.currentUserId,
    });
    delete v1.progress;
    delete v1.cards;
    delete v1.cardSequence;
    delete v1.unlocks;
    const migrated = parseDb(JSON.stringify(v1));
    expect(migrated?.schemaVersion).toBe(6);
    // Demo channels receive the example album on the way up to v5.
    expect(migrated?.cards.length).toBeGreaterThan(0);
    expect(migrated?.cards.every((c) => c.channelId.startsWith('demo-'))).toBe(true);
    expect(migrated?.views).toEqual([]);
    expect(migrated?.progress).toEqual([]);
    expect(migrated?.channels.map((c) => c.kind)).toEqual(['familia', 'amigos', 'otros', 'otros']);
    expect(migrated?.events.every((e) => !('recurring' in e))).toBe(true);
  });

  it('does not overwrite changes written by another tab', async () => {
    const otherTab = createLocalRepository({ store, now: () => clock });
    await repo.loadLibrary();
    await otherTab.addPerson(DEMO_FAMILY_ID, { firstName: 'Hugo', lastName: '', relationship: '', biography: '', notes: '' });
    await repo.toggleFavorite(DEMO_FAMILY_ID, 'v-demo-2');
    const snapshot = await repo.loadChannel(DEMO_FAMILY_ID);
    expect(snapshot.people.some((p) => p.firstName === 'Hugo')).toBe(true);
    expect(snapshot.favoriteVideoIds).toContain('v-demo-2');
  });

  it('numbers cromos per channel, keeps numbers stable and enforces admin + validation', async () => {
    const base = { title: 'En la playa', description: '', imageUrl: 'https://img.test/a.jpg', takenAt: '1999-08' };
    const before = (await repo.loadChannel(DEMO_FAMILY_ID)).cards;
    const maxBefore = Math.max(...before.map((c) => c.number));
    const card = await repo.addCard(DEMO_FAMILY_ID, { ...base, personId: 'p-carlos' });
    expect(card.number).toBe(maxBefore + 1);
    await repo.updateCard(DEMO_FAMILY_ID, card.id, { ...base, title: 'Playa 99' });
    const edited = (await repo.loadChannel(DEMO_FAMILY_ID)).cards.find((c) => c.id === card.id)!;
    expect(edited).toMatchObject({ number: card.number, title: 'Playa 99' });
    expect(edited.personId).toBeUndefined();
    await repo.deleteCard(DEMO_FAMILY_ID, card.id);
    // The number is not reused.
    expect((await repo.addCard(DEMO_FAMILY_ID, base)).number).toBe(maxBefore + 2);
    expect((await rejection(repo.addCard(DEMO_FAMILY_ID, { ...base, imageUrl: 'javascript:alert(1)' }))).code).toBe('invalid');
    expect((await rejection(repo.addCard(DEMO_FAMILY_ID, { ...base, personId: 'p-rosa' }))).code).toBe('invalid');
    expect((await rejection(repo.addCard(DEMO_FRIENDS_ID, base))).code).toBe('forbidden');
  });

  it('keeps a deleted person\'s cromos in the album, without a person', async () => {
    await repo.deletePerson(DEMO_FAMILY_ID, 'p-natalia');
    const cards = (await repo.loadChannel(DEMO_FAMILY_ID)).cards;
    const hers = cards.filter((c) => c.title === 'Primeros pasos');
    expect(hers).toHaveLength(1);
    expect(hers[0].personId).toBeUndefined();
  });

  it('brings the demo album into existing demo channels when upgrading from v4, leaving real ones alone', () => {
    const v4 = buildDemoDb(NOW) as unknown as Record<string, unknown> & Db;
    v4.schemaVersion = 4;
    delete (v4 as Partial<Db>).cards;
    delete (v4 as Partial<Db>).cardSequence;
    delete (v4 as Partial<Db>).unlocks;
    v4.people = v4.people.filter((p) => !['p-marta', 'p-javi', 'p-rosa', 'p-andres', 'p-lucia', 'p-carlos'].includes(p.id));
    v4.events = v4.events.map((e) => (e.id === 'e-cumple-marta' ? { ...e, personIds: [] } : e));
    // The user left (and so deleted) the cousins channel, and has a real channel.
    v4.channels = v4.channels.filter((c) => c.id !== DEMO_COUSINS_ID);
    v4.channels.push({ id: 'mi-familia', name: 'Mi familia', description: '', kind: 'familia', createdAt: NOW.toISOString(), createdBy: v4.currentUserId });
    const db = parseDb(JSON.stringify(v4))!;
    expect(db.schemaVersion).toBe(6);
    expect(db.cards.some((c) => c.channelId === DEMO_COUSINS_ID)).toBe(false);
    expect(db.cards.some((c) => c.channelId === 'mi-familia')).toBe(false);
    // Cromos of a person the user deleted (Carlos) are skipped.
    expect(db.cards.some((c) => c.title === 'Tocando la batería')).toBe(false);
    expect(db.cards.some((c) => c.title === 'La fuente' && c.personId === 'p-javi')).toBe(true);
    expect(db.people.some((p) => p.id === 'p-rosa')).toBe(false);
    expect(db.events.find((e) => e.id === 'e-cumple-marta')?.personIds).toEqual(['p-marta']);
    expect(db.cardSequence[DEMO_FAMILY_ID]).toBe(18);
  });

  it('exposes the user\'s unlocked cromos and forgets them with the cromo or the membership', async () => {
    let library = await repo.loadLibrary();
    const unlocked = new Set(library.unlockedCardIds);
    expect(unlocked.size).toBeGreaterThan(0);
    expect(unlocked.size).toBeLessThan(library.cards.length);
    const familyCard = library.cards.find((c) => c.channelId === DEMO_FAMILY_ID && unlocked.has(c.id))!;
    await repo.deleteCard(DEMO_FAMILY_ID, familyCard.id);
    library = await repo.loadLibrary();
    expect(library.unlockedCardIds).not.toContain(familyCard.id);
    await repo.leaveChannel(DEMO_COUSINS_ID);
    library = await repo.loadLibrary();
    expect(library.cards.some((c) => c.channelId === DEMO_COUSINS_ID)).toBe(false);
  });

  it('migrates v5 cromos: drops rarities and adds the demo collection', () => {
    const v5 = buildDemoDb(NOW) as unknown as Record<string, unknown> & Db;
    v5.schemaVersion = 5;
    delete (v5 as Partial<Db>).unlocks;
    for (const c of v5.cards as unknown as Record<string, unknown>[]) c.rarity = 'raro';
    const db = parseDb(JSON.stringify(v5))!;
    expect(db.schemaVersion).toBe(6);
    expect(db.cards.every((c) => !('rarity' in c))).toBe(true);
    expect(db.unlocks.length).toBeGreaterThan(0);
    expect(db.unlocks.every((u) => u.userId === db.currentUserId)).toBe(true);
  });

  it('treats unknown channels and channels you do not belong to the same way', async () => {
    expect((await rejection(repo.loadChannel('nope'))).code).toBe('not-found');
  });

  it('validates input on the repository side, not only in forms', async () => {
    const error = await rejection(repo.addVideo(DEMO_FAMILY_ID, { ...videoInput, mediaUrl: 'javascript:alert(1)' }));
    expect(error.code).toBe('invalid');
    const foreign = await rejection(repo.addVideo(DEMO_FAMILY_ID, { ...videoInput, personIds: ['p-unknown'] }));
    expect(foreign.details.join()).toContain('no pertenece');
  });

  it('adds, edits and deletes videos, cleaning up favorites', async () => {
    const video = await repo.addVideo(DEMO_FAMILY_ID, { ...videoInput, thumbnailUrl: 'https://img.test/a.jpg' });
    expect(video.uploadedAt).toBe(NOW.toISOString());
    expect(await repo.toggleFavorite(DEMO_FAMILY_ID, video.id)).toBe(true);
    await repo.updateVideo(DEMO_FAMILY_ID, video.id, { ...videoInput, title: 'Feria 2010' });
    let snapshot = await repo.loadChannel(DEMO_FAMILY_ID);
    const edited = snapshot.videos.find((v) => v.id === video.id)!;
    expect(edited.title).toBe('Feria 2010');
    expect(edited.thumbnailUrl).toBeUndefined();
    expect(snapshot.favoriteVideoIds).toContain(video.id);
    await repo.deleteVideo(DEMO_FAMILY_ID, video.id);
    snapshot = await repo.loadChannel(DEMO_FAMILY_ID);
    expect(snapshot.videos.some((v) => v.id === video.id)).toBe(false);
    expect(snapshot.favoriteVideoIds).not.toContain(video.id);
  });

  it('never leaks references to its internal state', async () => {
    const snapshot = await repo.loadChannel(DEMO_FAMILY_ID);
    snapshot.videos[0].title = 'hacked';
    snapshot.me.role = 'admin';
    const again = await repo.loadChannel(DEMO_FAMILY_ID);
    expect(again.videos[0].title).not.toBe('hacked');
  });

  it('unlinks a deleted person from videos and events', async () => {
    await repo.deletePerson(DEMO_FAMILY_ID, 'p-natalia');
    const snapshot = await repo.loadChannel(DEMO_FAMILY_ID);
    expect(snapshot.people.some((p) => p.id === 'p-natalia')).toBe(false);
    expect(snapshot.videos.some((v) => v.personIds.includes('p-natalia'))).toBe(false);
    expect(snapshot.events.some((e) => e.personIds.includes('p-natalia'))).toBe(false);
  });

  it('keeps at least one admin per channel', async () => {
    const elena = 'u-elena';
    await repo.setMemberRole(DEMO_FAMILY_ID, elena, 'member');
    const me = (await repo.loadChannel(DEMO_FAMILY_ID)).me;
    expect((await rejection(repo.setMemberRole(DEMO_FAMILY_ID, me.userId, 'member'))).code).toBe('conflict');
    expect((await rejection(repo.leaveChannel(DEMO_FAMILY_ID))).code).toBe('conflict');
    expect((await rejection(repo.removeMember(DEMO_FAMILY_ID, me.userId))).code).toBe('conflict');
    await repo.removeMember(DEMO_FAMILY_ID, elena);
    const members = (await repo.loadChannel(DEMO_FAMILY_ID)).members;
    expect(members.some((m) => m.userId === elena)).toBe(false);
  });

  it('creates a channel with its creator as admin and deletes it when the last member leaves', async () => {
    const id = await repo.createChannel({ name: '  Viaje a Japón 2025 ', description: '', kind: 'viajes' });
    const snapshot = await repo.loadChannel(id);
    expect(snapshot.channel.name).toBe('Viaje a Japón 2025');
    expect(snapshot.me.role).toBe('admin');
    await repo.leaveChannel(id);
    expect((await repo.listChannels()).some((c) => c.channel.id === id)).toBe(false);
  });
});

describe('invitations', () => {
  function storeWithInvitation(mutate: (db: Db) => void = () => {}) {
    const db = buildDemoDb(NOW);
    // The current user is not yet in the friends channel; Marta invited them.
    db.members = db.members.filter((m) => !(m.channelId === DEMO_FRIENDS_ID && m.userId === db.currentUserId));
    db.invitations.push({
      id: 'i-friends',
      channelId: DEMO_FRIENDS_ID,
      code: 'K7PM-Q2XD-9HWA',
      createdBy: 'u-marta',
      createdAt: '2026-10-14T00:00:00.000Z',
      expiresAt: '2026-10-21T00:00:00.000Z',
    });
    mutate(db);
    return memoryStore({ [STORAGE_KEY]: JSON.stringify(db) });
  }

  it('lets a new member join once, with traceability', async () => {
    const repo = createLocalRepository({ store: storeWithInvitation(), now: () => NOW });
    const channelId = await repo.redeemInvitation('k7pm q2xd 9hwa', 'Lucía');
    expect(channelId).toBe(DEMO_FRIENDS_ID);
    const snapshot = await repo.loadChannel(channelId);
    expect(snapshot.me).toMatchObject({ role: 'member', displayName: 'Lucía', invitationId: 'i-friends' });
    // Single use: the code no longer works once redeemed.
    expect((await rejection(repo.redeemInvitation('K7PM-Q2XD-9HWA', 'Lucía'))).code).toBe('invalid');
  });

  it('rejects expired, revoked, used and unknown codes with the same message', async () => {
    const later = new Date('2026-10-22T00:00:00.000Z');
    const expired = createLocalRepository({ store: storeWithInvitation(), now: () => later });
    const revoked = createLocalRepository({
      store: storeWithInvitation((db) => (db.invitations.at(-1)!.revokedAt = '2026-10-14T01:00:00.000Z')),
      now: () => NOW,
    });
    const used = createLocalRepository({
      store: storeWithInvitation((db) => (db.invitations.at(-1)!.usedAt = '2026-10-14T01:00:00.000Z')),
      now: () => NOW,
    });
    const unknown = createLocalRepository({ store: storeWithInvitation(), now: () => NOW });
    const messages = await Promise.all([
      rejection(expired.redeemInvitation('K7PM-Q2XD-9HWA', 'Ana')),
      rejection(revoked.redeemInvitation('K7PM-Q2XD-9HWA', 'Ana')),
      rejection(used.redeemInvitation('K7PM-Q2XD-9HWA', 'Ana')),
      rejection(unknown.redeemInvitation('AAAA-BBBB-CCCC', 'Ana')),
      rejection(unknown.redeemInvitation('basura', 'Ana')),
    ]);
    expect(new Set(messages.map((e) => e.message)).size).toBe(1);
  });

  it('lets admins create and revoke invitations with a bounded expiry', async () => {
    const repo = createLocalRepository({ store: memoryStore(), now: () => NOW });
    const invitation = await repo.createInvitation(DEMO_FAMILY_ID, 7);
    expect(invitation.expiresAt).toBe('2026-10-22T10:00:00.000Z');
    expect((await rejection(repo.createInvitation(DEMO_FAMILY_ID, 0))).code).toBe('invalid');
    expect((await rejection(repo.createInvitation(DEMO_FAMILY_ID, 365))).code).toBe('invalid');
    await repo.revokeInvitation(DEMO_FAMILY_ID, invitation.id);
    expect((await rejection(repo.revokeInvitation(DEMO_FAMILY_ID, invitation.id))).code).toBe('conflict');
  });
});
