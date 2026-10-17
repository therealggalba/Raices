import type { MemoriesRepository } from './repository';
import { RepositoryError } from './repository';

/** Shown when the demo is asked to change anything. */
export const DEMO_READ_ONLY_MESSAGE = 'La demo es solo para mirar. Crea una cuenta para usar FamilyMemories con tu familia.';

/** What a visitor can still do in the demo: watch, mark favourites and open packs. */
const ALLOWED = new Set<keyof MemoriesRepository>([
  'mode',
  'getCurrentUser',
  'listChannels',
  'loadLibrary',
  'loadChannel',
  'recordView',
  'saveProgress',
  'toggleFavorite',
  'openPack',
]);

/**
 * The portfolio demo: the fictional family can be browsed but not changed.
 * The visitor is a plain member everywhere (so no screen offers editing) and
 * every write that isn't part of "watching" is refused.
 */
export function readOnlyDemo(inner: MemoriesRepository): MemoriesRepository {
  const refuse = async () => {
    throw new RepositoryError('forbidden', DEMO_READ_ONLY_MESSAGE);
  };
  const demo = {} as Record<string, unknown>;
  for (const key of Object.keys(inner) as (keyof MemoriesRepository)[]) {
    const value = inner[key];
    demo[key] = ALLOWED.has(key) ? (typeof value === 'function' ? value.bind(inner) : value) : refuse;
  }
  const repo = demo as unknown as MemoriesRepository;

  repo.listChannels = async () => (await inner.listChannels()).map((s) => ({ ...s, role: 'member' }));
  repo.loadLibrary = async () => {
    const library = await inner.loadLibrary();
    return { ...library, channels: library.channels.map((c) => ({ ...c, role: 'member' })) };
  };
  repo.loadChannel = async (channelId) => {
    const snapshot = await inner.loadChannel(channelId);
    const me = { ...snapshot.me, role: 'member' as const };
    return {
      ...snapshot,
      me,
      members: snapshot.members.map((m) => (m.userId === me.userId ? me : m)),
      invitations: [],
    };
  };
  return repo;
}
