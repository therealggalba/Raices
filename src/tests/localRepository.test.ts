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
    delete v1.copies;
    delete v1.packs;
    delete v1.partnerships;
    const migrated = parseDb(JSON.stringify(v1));
    expect(migrated?.schemaVersion).toBe(8);
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
    delete (v4 as Partial<Db>).copies;
    delete (v4 as Partial<Db>).packs;
    delete (v4 as Partial<Db>).partnerships;
    v4.people = v4.people.filter((p) => !['p-marta', 'p-javi', 'p-rosa', 'p-andres', 'p-lucia', 'p-carlos'].includes(p.id));
    v4.events = v4.events.map((e) => (e.id === 'e-cumple-marta' ? { ...e, personIds: [] } : e));
    // The user left (and so deleted) the cousins channel, and has a real channel.
    v4.channels = v4.channels.filter((c) => c.id !== DEMO_COUSINS_ID);
    v4.channels.push({ id: 'mi-familia', name: 'Mi familia', description: '', kind: 'familia', packTheme: 'clasico', createdAt: NOW.toISOString(), createdBy: v4.currentUserId });
    const db = parseDb(JSON.stringify(v4))!;
    expect(db.schemaVersion).toBe(8);
    expect(db.cards.some((c) => c.channelId === DEMO_COUSINS_ID)).toBe(false);
    expect(db.cards.some((c) => c.channelId === 'mi-familia')).toBe(false);
    // Cromos of a person the user deleted (Carlos) are skipped.
    expect(db.cards.some((c) => c.title === 'Tocando la batería')).toBe(false);
    expect(db.cards.some((c) => c.title === 'La fuente' && c.personId === 'p-javi')).toBe(true);
    expect(db.people.some((p) => p.id === 'p-rosa')).toBe(false);
    expect(db.events.find((e) => e.id === 'e-cumple-marta')?.personIds).toEqual(['p-marta']);
    expect(db.cardSequence[DEMO_FAMILY_ID]).toBe(18);
  });

  it('exposes the user\'s copies and forgets them with the cromo or the membership', async () => {
    let library = await repo.loadLibrary();
    const owned = Object.keys(library.cardCopies);
    expect(owned.length).toBeGreaterThan(0);
    expect(owned.length).toBeLessThan(library.cards.length);
    expect(Object.values(library.cardCopies).some((n) => n > 1)).toBe(true);
    const familyCard = library.cards.find((c) => c.channelId === DEMO_FAMILY_ID && library.cardCopies[c.id])!;
    await repo.deleteCard(DEMO_FAMILY_ID, familyCard.id);
    library = await repo.loadLibrary();
    expect(library.cardCopies[familyCard.id]).toBeUndefined();
    await repo.leaveChannel(DEMO_COUSINS_ID);
    library = await repo.loadLibrary();
    expect(library.cards.some((c) => c.channelId === DEMO_COUSINS_ID)).toBe(false);
  });

  it('migrates v5 cromos: drops rarities and arrives at v7 with the demo collection', () => {
    const v5 = buildDemoDb(NOW) as unknown as Record<string, unknown> & Db;
    v5.schemaVersion = 5;
    delete (v5 as Partial<Db>).copies;
    delete (v5 as Partial<Db>).packs;
    delete (v5 as Partial<Db>).partnerships;
    for (const c of v5.cards as unknown as Record<string, unknown>[]) c.rarity = 'raro';
    for (const c of v5.channels as unknown as Record<string, unknown>[]) delete c.packTheme;
    const db = parseDb(JSON.stringify(v5))!;
    expect(db.schemaVersion).toBe(8);
    expect(db.cards.every((c) => !('rarity' in c))).toBe(true);
    expect(db.copies.length).toBeGreaterThan(0);
    expect(db.copies.every((c) => c.userId === db.currentUserId && c.count >= 1)).toBe(true);
    expect(db.packs).toEqual([]);
    expect(db.channels.find((c) => c.id === DEMO_FRIENDS_ID)?.packTheme).toBe('atardecer');
    expect('unlocks' in db).toBe(false);
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

describe('family tree', () => {
  let repo: MemoriesRepository;
  const base = { lastName: '', relationship: '', biography: '', notes: '' };

  beforeEach(() => {
    repo = createLocalRepository({ store: memoryStore(), now: () => NOW });
  });

  it('comes with the demo tree: parents and couples', async () => {
    const snap = await repo.loadChannel(DEMO_FAMILY_ID);
    expect(snap.people.find((p) => p.id === 'p-carlos')?.parentIds).toEqual(['p-luis', 'p-elena']);
    expect(snap.partnerships.map((c) => c.personIds.join('+')).sort()).toEqual([
      'p-antonio+p-carmen',
      'p-elena+p-luis',
      'p-jorge+p-pilar',
    ]);
    expect(snap.partnerships.find((c) => c.id === 'pt-antonio-carmen')?.since).toBe(
      snap.events.find((e) => e.id === 'e-aniversario-abuelos')?.date,
    );
  });

  it('rejects more than two parents, foreign parents and ancestry loops', async () => {
    const tooMany = await rejection(repo.addPerson(DEMO_FAMILY_ID, { ...base, firstName: 'X', parentIds: ['p-luis', 'p-elena', 'p-jorge'] }));
    expect(tooMany.code).toBe('invalid');
    expect((await rejection(repo.addPerson(DEMO_FAMILY_ID, { ...base, firstName: 'X', parentIds: ['p-rosa'] }))).code).toBe('invalid');
    // Antonio cannot become his grandson's child.
    const loop = await rejection(repo.updatePerson(DEMO_FAMILY_ID, 'p-antonio', { ...base, firstName: 'Antonio', parentIds: ['p-carlos'] }));
    expect(loop.details.join()).toContain('antepasada');
    expect((await rejection(repo.updatePerson(DEMO_FAMILY_ID, 'p-luis', { ...base, firstName: 'Luis', parentIds: ['p-luis'] }))).code).toBe('invalid');
  });

  it('adds, edits and removes couples, without duplicates', async () => {
    const hugo = await repo.addPerson(DEMO_FAMILY_ID, { ...base, firstName: 'Hugo', parentIds: ['p-pilar', 'p-jorge'] });
    const ana = await repo.addPerson(DEMO_FAMILY_ID, { ...base, firstName: 'Ana' });
    const couple = await repo.addPartnership(DEMO_FAMILY_ID, { personIds: [hugo.id, ana.id], since: '2024-05-01' });
    expect((await rejection(repo.addPartnership(DEMO_FAMILY_ID, { personIds: [ana.id, hugo.id] }))).code).toBe('conflict');
    await repo.updatePartnership(DEMO_FAMILY_ID, couple.id, { personIds: [ana.id, hugo.id], since: '2024-05-01', until: '2026-01-01' });
    expect((await repo.loadChannel(DEMO_FAMILY_ID)).partnerships.find((c) => c.id === couple.id)?.until).toBe('2026-01-01');
    expect((await rejection(repo.addPartnership(DEMO_FAMILY_ID, { personIds: [hugo.id, hugo.id] }))).code).toBe('invalid');
    expect((await rejection(repo.addPartnership(DEMO_FRIENDS_ID, { personIds: ['p-marta', 'p-javi'] }))).code).toBe('forbidden');
    await repo.deletePartnership(DEMO_FAMILY_ID, couple.id);
    expect((await repo.loadChannel(DEMO_FAMILY_ID)).partnerships.some((c) => c.id === couple.id)).toBe(false);
  });

  it('unlinks a deleted person from children and couples', async () => {
    await repo.deletePerson(DEMO_FAMILY_ID, 'p-luis');
    const snap = await repo.loadChannel(DEMO_FAMILY_ID);
    expect(snap.people.find((p) => p.id === 'p-carlos')?.parentIds).toEqual(['p-elena']);
    expect(snap.partnerships.some((c) => c.personIds.includes('p-luis'))).toBe(false);
  });

  it('brings the demo tree into existing data when upgrading from v7', () => {
    const v7 = buildDemoDb(NOW) as unknown as Record<string, unknown> & Db;
    v7.schemaVersion = 7;
    delete (v7 as Partial<Db>).partnerships;
    v7.people = v7.people
      .filter((p) => !['p-pilar', 'p-jorge', 'p-sofia', 'p-natalia'].includes(p.id))
      .map((p) => {
        const { parentIds: _ignored, ...rest } = p;
        return rest as typeof p;
      });
    const db = parseDb(JSON.stringify(v7))!;
    expect(db.schemaVersion).toBe(8);
    expect(db.people.every((p) => Array.isArray(p.parentIds))).toBe(true);
    expect(db.people.some((p) => p.id === 'p-sofia')).toBe(true);
    // Natalia was deleted by the user: she stays deleted.
    expect(db.people.some((p) => p.id === 'p-natalia')).toBe(false);
    expect(db.people.find((p) => p.id === 'p-lucia')?.parentIds).toEqual(['p-rosa', 'p-andres']);
  });
});

describe('packs', () => {
  // Deterministic draws: always the first remaining cromo.
  const first = () => 0;
  let clock: Date;
  let repo: MemoriesRepository;

  beforeEach(() => {
    clock = new Date('2026-10-17T09:00:00');
    repo = createLocalRepository({ store: memoryStore(), now: () => clock, random: first });
  });

  it('gives 5 cromos of the chosen album, marking new ones and counting copies', async () => {
    const before = await repo.loadLibrary();
    const pulls = await repo.openPack(DEMO_FAMILY_ID);
    expect(pulls).toHaveLength(5);
    expect(pulls.every((p) => p.card.channelId === DEMO_FAMILY_ID)).toBe(true);
    expect(new Set(pulls.map((p) => p.card.id)).size).toBe(5);
    for (const pull of pulls) {
      const had = before.cardCopies[pull.card.id] ?? 0;
      expect(pull.isNew).toBe(had === 0);
      expect(pull.copies).toBe(had + 1);
    }
    const after = await repo.loadLibrary();
    expect(after.packs).toEqual({ perDay: 3, openedToday: 1, remaining: 2 });
    expect(after.cardCopies[pulls[0].card.id]).toBe(pulls[0].copies);
  });

  it('allows 3 packs per day across all albums, and 3 more the next day', async () => {
    await repo.openPack(DEMO_FAMILY_ID);
    await repo.openPack(DEMO_FRIENDS_ID);
    await repo.openPack(DEMO_COUSINS_ID);
    expect((await repo.loadLibrary()).packs.remaining).toBe(0);
    expect((await rejection(repo.openPack(DEMO_FAMILY_ID))).code).toBe('conflict');
    clock = new Date('2026-10-18T00:01:00');
    expect((await repo.loadLibrary()).packs.remaining).toBe(3);
    expect(await repo.openPack(DEMO_FAMILY_ID)).toHaveLength(5);
  });

  it('only opens packs of albums you belong to and that have cromos', async () => {
    expect((await rejection(repo.openPack('nope'))).code).toBe('not-found');
    const empty = await repo.createChannel({ name: 'Vacío', description: '', kind: 'otros' });
    expect((await rejection(repo.openPack(empty))).code).toBe('conflict');
    expect((await repo.loadLibrary()).packs.remaining).toBe(3);
  });
});
