import { createContext, useContext } from 'react';
import type { ChannelSnapshot, IsoDate, Person } from '../types/domain';

export interface ChannelContextValue {
  snapshot: ChannelSnapshot;
  today: IsoDate;
  /** The owner manages the channel (see utils/permissions for the rest). */
  isOwner: boolean;
  /** The portfolio demo: look, don't touch (no upload or edit buttons). */
  readOnly: boolean;
  /** Content waiting for approval that this user sees (the owner: everybody's). */
  pendingCount: number;
  /** Re-reads the channel from the repository after a mutation. */
  reload(): Promise<void>;
  personById(id: string): Person | undefined;
}

export const ChannelContext = createContext<ChannelContextValue | null>(null);

export function useChannel(): ChannelContextValue {
  const value = useContext(ChannelContext);
  if (!value) throw new Error('useChannel must be used inside ChannelLayout');
  return value;
}
