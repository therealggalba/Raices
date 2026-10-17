import { describe, expect, it } from 'vitest';
import {
  sortedPair,
  toCard,
  toChannel,
  toInvitation,
  toPartnership,
  toPerson,
  toRepositoryError,
  toVideo,
} from '../services/supabaseMappers';

const A = '0b6d2b5e-0000-4000-8000-000000000001';
const B = '0b6d2b5e-0000-4000-8000-000000000002';

describe('row mappers', () => {
  it('maps a channel and drops a null cover', () => {
    const channel = toChannel({
      id: A,
      name: 'Montero',
      description: '',
      kind: 'familia',
      pack_theme: 'oceano',
      cover_url: null,
      created_at: '2026-10-17T10:00:00Z',
      created_by: B,
    });
    expect(channel).toEqual({
      id: A,
      name: 'Montero',
      description: '',
      kind: 'familia',
      packTheme: 'oceano',
      createdAt: '2026-10-17T10:00:00Z',
      createdBy: B,
    });
    expect('coverUrl' in channel).toBe(false);
  });

  it('maps people with parents and optional fields', () => {
    const person = toPerson({
      id: A,
      channel_id: B,
      first_name: 'Pilar',
      last_name: 'Montero',
      birth_date: '1950-02-01',
      death_date: '2020-05-03',
      gender: 'mujer',
      photo_url: null,
      relationship: 'Abuela',
      biography: '',
      notes: '',
      parent_ids: [],
    });
    expect(person.birthDate).toBe('1950-02-01');
    expect(person.deathDate).toBe('2020-05-03');
    expect(person.gender).toBe('mujer');
    expect('photoUrl' in person).toBe(false);
    expect(person.parentIds).toEqual([]);
  });

  it('maps videos, keeping arrays and dropping empty duration', () => {
    const video = toVideo({
      id: A,
      channel_id: B,
      title: 'Sevillanas',
      description: '',
      media_url: 'https://drive.google.com/file/d/abcdefghijk/view',
      thumbnail_url: null,
      event_date: '1998',
      uploaded_at: '2026-10-17T10:00:00Z',
      duration_seconds: null,
      category: 'reunion',
      tags: ['feria'],
      person_ids: [A],
      author_id: B,
    });
    expect(video.tags).toEqual(['feria']);
    expect(video.personIds).toEqual([A]);
    expect('durationSeconds' in video).toBe(false);
  });

  it('maps invitations with optional timestamps', () => {
    const inv = toInvitation({
      id: A,
      channel_id: B,
      code: 'ABCD-EFGH-JKMN',
      created_by: B,
      created_at: '2026-10-17T10:00:00Z',
      expires_at: '2026-10-24T10:00:00Z',
      used_at: null,
      used_by: null,
      revoked_at: '2026-10-18T10:00:00Z',
      person_id: null,
    });
    expect(inv.usedAt).toBeUndefined();
    expect(inv.revokedAt).toBe('2026-10-18T10:00:00Z');
  });

  it('maps partnerships to a person pair', () => {
    expect(toPartnership({ id: A, channel_id: B, person_a: A, person_b: B, since: '1975-06-01', until: null })).toEqual({
      id: A,
      channelId: B,
      personIds: [A, B],
      since: '1975-06-01',
    });
  });

  it('builds cromos with the resolved image and description', () => {
    const card = toCard(
      {
        id: A,
        channel_id: B,
        number: 7,
        person_id: null,
        title: 'Playa',
        image_url: null,
        image_path: `${B}/${A}.webp`,
        blurred_path: null,
        taken_at: '1990',
        created_at: '2026-10-17T10:00:00Z',
        author_id: B,
      },
      'https://example.test/signed',
      '',
    );
    expect(card.imageUrl).toBe('https://example.test/signed');
    expect(card.number).toBe(7);
    expect('personId' in card).toBe(false);
  });

  it('sorts partnership pairs like the database', () => {
    expect(sortedPair([B, A])).toEqual([A, B]);
    expect(sortedPair([A, B])).toEqual([A, B]);
  });
});

describe('toRepositoryError', () => {
  it('keeps the Spanish messages raised by our SQL functions', () => {
    const error = toRepositoryError({ code: '23514', message: 'Ya has abierto todos los sobres de hoy. ¡Vuelve mañana!' });
    expect(error.code).toBe('conflict');
    expect(error.message).toBe('Ya has abierto todos los sobres de hoy. ¡Vuelve mañana!');
  });

  it('hides internal database messages', () => {
    const rls = toRepositoryError({ code: '42501', message: 'new row violates row-level security policy for table "videos"' });
    expect(rls.code).toBe('forbidden');
    expect(rls.message).toBe('No tienes permiso para hacer esto');
    const check = toRepositoryError({ code: '23514', message: 'new row for relation "videos" violates check constraint' });
    expect(check.code).toBe('invalid');
    expect(check.message).not.toMatch(/relation|constraint/);
    const unknown = toRepositoryError({ code: 'XX000', message: 'internal error at line 3' });
    expect(unknown.message).not.toMatch(/line/);
  });

  it('maps not-found and invalid-input codes', () => {
    expect(toRepositoryError({ code: '02000', message: 'Este canal no existe' }).code).toBe('not-found');
    expect(toRepositoryError({ code: '22023', message: 'La invitación no es válida o ha caducado' })).toMatchObject({
      code: 'invalid',
      message: 'La invitación no es válida o ha caducado',
    });
    expect(toRepositoryError({ code: '22P02', message: 'invalid input syntax for type uuid' }).code).toBe('invalid');
  });
});
