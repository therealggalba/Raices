import { beforeEach, describe, expect, it } from 'vitest';
import { DEMO_READ_ONLY_MESSAGE, readOnlyDemo } from '../services/demoRepository';
import { createLocalRepository, memoryStore } from '../services/localRepository';
import type { MemoriesRepository } from '../services/repository';
import { RepositoryError } from '../services/repository';
import { DEMO_FAMILY_ID } from '../services/seed';

describe('read-only demo', () => {
  let demo: MemoriesRepository;
  beforeEach(() => {
    demo = readOnlyDemo(createLocalRepository({ store: memoryStore() }));
  });

  it('shows the visitor as a plain member everywhere (no editing screens)', async () => {
    expect((await demo.listChannels()).every((c) => c.role === 'member')).toBe(true);
    expect((await demo.loadLibrary()).channels.every((c) => c.role === 'member')).toBe(true);
    const snap = await demo.loadChannel(DEMO_FAMILY_ID);
    expect(snap.me.role).toBe('member');
    expect(snap.members.find((m) => m.userId === snap.me.userId)?.role).toBe('member');
    expect(snap.invitations).toEqual([]);
  });

  it('refuses every change to the content', async () => {
    const attempts = [
      demo.createChannel({ name: 'X', description: '', kind: 'familia' }),
      demo.renameCurrentUser('Hacker'),
      demo.addPerson(DEMO_FAMILY_ID, { firstName: 'X', lastName: '', relationship: '', biography: '' }),
      demo.deleteVideo(DEMO_FAMILY_ID, 'v-1'),
      demo.createInvitation(DEMO_FAMILY_ID, 7, 'p-natalia'),
      demo.resetDemo(),
    ];
    for (const attempt of attempts) {
      const error = await attempt.then(() => null, (e: unknown) => e);
      expect(error).toBeInstanceOf(RepositoryError);
      expect((error as RepositoryError).message).toBe(DEMO_READ_ONLY_MESSAGE);
    }
  });

  it('still lets the visitor watch and open packs, already knowing who they are', async () => {
    const library = await demo.loadLibrary();
    await demo.recordView(library.videos[0].id);
    expect((await demo.openPack(DEMO_FAMILY_ID)).length).toBeGreaterThan(0);
    expect((await demo.loadChannel(DEMO_FAMILY_ID)).me.personId).toBe('p-carlos');
  });
});
