import { beforeEach, describe, expect, it } from 'vitest';
import type { EventInput, VideoInput } from '../types/domain';
import { STORAGE_KEY, createLocalRepository, memoryStore, parseDb } from '../services/localRepository';
import type { Db, KeyValueStore } from '../services/localRepository';
import type { MemoriesRepository } from '../services/repository';
import { RepositoryError } from '../services/repository';
import { DEMO_FAMILY_ID, DEMO_FRIENDS_ID, buildDemoDb } from '../services/seed';

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
  recurring: false,
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
    const id = await repo.createChannel({ name: '  Viaje a Japón 2025 ', description: '' });
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
