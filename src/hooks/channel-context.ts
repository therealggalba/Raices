import { createContext, useContext } from 'react';
import type { ChannelSnapshot, IsoDate, Person } from '../types/domain';

export interface ChannelContextValue {
  snapshot: ChannelSnapshot;
  today: IsoDate;
  isAdmin: boolean;
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
