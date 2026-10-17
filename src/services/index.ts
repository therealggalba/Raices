import { readOnlyDemo } from './demoRepository';
import { createLocalRepository, memoryStore } from './localRepository';
import type { MemoriesRepository } from './repository';
import { getSupabase } from './supabaseClient';
import { createSupabaseRepository } from './supabaseRepository';

// Two backends behind the same contract: the portfolio demo (fictional data,
// in memory only and read-only: it starts over on every launch and can only
// be looked at) and Supabase (real accounts and shared channels). The auth layer picks one before any screen is rendered; screens
// just import `repository`.

let local: MemoriesRepository | null = null;
let remote: MemoriesRepository | null = null;
let current: MemoriesRepository | null = null;

export type Backend = MemoriesRepository['mode'];

export function selectBackend(mode: Backend): void {
  if (mode === 'supabase') {
    const client = getSupabase();
    if (!client) throw new Error('Supabase is not configured');
    remote ??= createSupabaseRepository(client);
    current = remote;
  } else {
    local ??= readOnlyDemo(createLocalRepository({ store: memoryStore() }));
    current = local;
  }
}

function active(): MemoriesRepository {
  if (!current) selectBackend('local');
  return current!;
}

export const repository: MemoriesRepository = new Proxy({} as MemoriesRepository, {
  get: (_target, key) => Reflect.get(active(), key),
});
