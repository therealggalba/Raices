import { createLocalRepository } from './localRepository';
import type { MemoriesRepository } from './repository';

// Phase 1 (public MVP): local backend only. The privacy phase will pick the
// Supabase implementation here when its credentials are configured.
export const repository: MemoriesRepository = createLocalRepository();
