import { createContext, useContext } from 'react';
import type { IsoDate, Library, LibraryChannel, Person } from '../types/domain';

export interface LibraryContextValue {
  library: Library;
  today: IsoDate;
  /** Re-reads the library after a mutation (favourite, view, delete…). */
  reload(): Promise<void>;
  channelById(id: string): LibraryChannel | undefined;
  personById(id: string): Person | undefined;
}

export const LibraryContext = createContext<LibraryContextValue | null>(null);

export function useLibrary(): LibraryContextValue {
  const value = useContext(LibraryContext);
  if (!value) throw new Error('useLibrary must be used inside AppLayout');
  return value;
}
