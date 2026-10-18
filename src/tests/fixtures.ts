import type { FamilyEvent, Person, Video } from '../types/domain';

export function makePerson(overrides: Partial<Person> = {}): Person {
  return {
    id: 'p1',
    channelId: 'c1',
    firstName: 'Carlos',
    lastName: 'Montero',
    relationship: 'Hijo',
    biography: '',
    parentIds: [],
    ...overrides,
  };
}

export function makeEvent(overrides: Partial<FamilyEvent> = {}): FamilyEvent {
  return {
    id: 'e1',
    channelId: 'c1',
    type: 'aniversario',
    title: 'Aniversario',
    date: '1966-10-16',
    personIds: [],
    notes: '',
    ...overrides,
  };
}

export function makeVideo(overrides: Partial<Video> = {}): Video {
  return {
    id: 'v1',
    channelId: 'c1',
    title: 'Vídeo',
    description: '',
    mediaUrl: 'https://example.com/a.mp4',
    eventDate: '2000',
    uploadedAt: '2026-01-01T00:00:00.000Z',
    category: 'otros',
    tags: [],
    personIds: [],
    authorId: 'u1',
    ...overrides,
  };
}
