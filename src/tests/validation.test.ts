import { describe, expect, it } from 'vitest';
import type { VideoInput } from '../types/domain';
import {
  cleanMultiline,
  cleanText,
  normalizeTags,
  parseDurationInput,
  validateChannelInput,
  validateDisplayName,
  validateEventInput,
  validatePersonInput,
  validateVideoInput,
} from '../utils/validation';

const video = (overrides: Partial<Record<keyof VideoInput, unknown>> = {}) => ({
  title: 'Navidad 1999',
  description: '',
  mediaUrl: 'https://youtu.be/dQw4w9WgXcQ',
  eventDate: '1999-12',
  category: 'navidad',
  tags: [],
  personIds: [],
  ...overrides,
});

describe('text cleaning', () => {
  it('strips control characters and collapses whitespace', () => {
    expect(cleanText('  Hola\u0000\t mundo \n')).toBe('Hola mundo');
    expect(cleanMultiline('Línea 1  \r\n\r\n\r\n\r\nLínea\u0007 2')).toBe('Línea 1\n\nLínea 2');
  });

  it('normalizes tags', () => {
    expect(normalizeTags([' #Playa', 'playa', 'Cádiz ', ''])).toEqual(['playa', 'cádiz']);
  });

  it('parses durations in seconds, m:ss and h:mm:ss', () => {
    expect(parseDurationInput('')).toBeUndefined();
    expect(parseDurationInput('90')).toBe(90);
    expect(parseDurationInput('5:12')).toBe(312);
    expect(parseDurationInput('1:02:03')).toBe(3723);
    expect(parseDurationInput('abc')).toBeNaN();
  });
});

describe('validateVideoInput', () => {
  it('accepts a valid video and cleans its fields', () => {
    const result = validateVideoInput(video({ title: '  Navidad   1999 ', tags: ['#Familia', 'familia'] }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.title).toBe('Navidad 1999');
      expect(result.value.tags).toEqual(['familia']);
    }
  });

  it('rejects missing titles, unsafe links, bad dates and unknown categories', () => {
    const result = validateVideoInput(
      video({ title: ' ', mediaUrl: 'javascript:alert(1)', eventDate: '1999-13', category: 'fiesta' }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toHaveLength(4);
  });

  it('rejects non-https thumbnails, bad durations and malformed person ids', () => {
    expect(validateVideoInput(video({ thumbnailUrl: 'http://x.test/a.jpg' })).ok).toBe(false);
    expect(validateVideoInput(video({ durationSeconds: -3 })).ok).toBe(false);
    expect(validateVideoInput(video({ personIds: ['../x'] })).ok).toBe(false);
    expect(validateVideoInput(null).ok).toBe(false);
  });
});

describe('other inputs', () => {
  it('validates channels', () => {
    expect(validateChannelInput({ name: 'Familia', description: '', kind: 'familia' }).ok).toBe(true);
    expect(validateChannelInput({ name: '', description: '', kind: 'familia' }).ok).toBe(false);
    expect(validateChannelInput({ name: 'F', description: '', kind: 'familia', coverUrl: 'ftp://x' }).ok).toBe(false);
    expect(validateChannelInput({ name: 'F', description: '' }).ok).toBe(false);
    expect(validateChannelInput({ name: 'F', description: '', kind: 'trabajo' }).ok).toBe(false);
  });

  it('validates people', () => {
    const base = { firstName: 'Ana', lastName: '', relationship: '', biography: '', notes: '' };
    expect(validatePersonInput(base).ok).toBe(true);
    expect(validatePersonInput({ ...base, birthDate: '1990-02-30' }).ok).toBe(false);
    expect(validatePersonInput({ ...base, firstName: 'x'.repeat(200) }).ok).toBe(false);
  });

  it('validates events', () => {
    const base = { type: 'boda', title: 'Boda', date: '2026-06-01', personIds: [], notes: '' };
    expect(validateEventInput(base).ok).toBe(true);
    expect(validateEventInput({ ...base, date: '2026-06' }).ok).toBe(false);
    expect(validateEventInput({ ...base, type: 'fiesta' }).ok).toBe(false);
    expect(validateEventInput({ ...base, title: '' }).ok).toBe(false);
  });

  it('validates display names', () => {
    expect(validateDisplayName('  Ana ')).toEqual({ ok: true, value: 'Ana' });
    expect(validateDisplayName('   ').ok).toBe(false);
  });
});

describe('selfChanges', () => {
  it('lists only the fields that changed', async () => {
    const { selfChanges } = await import('../utils/people');
    const person = { id: 'p', channelId: 'c', firstName: 'Ana', lastName: 'Ruiz', relationship: '', biography: '', parentIds: [] };
    expect(selfChanges(person, { firstName: 'Anabel', lastName: 'Ruiz', biography: '', birthDate: '1990-01-02' })).toEqual([
      { field: 'firstName', before: 'Ana', after: 'Anabel' },
      { field: 'birthDate', before: '', after: '1990-01-02' },
    ]);
  });
});

describe('photo sizes', () => {
  it('fits photos inside the limit without upscaling', async () => {
    const { fitSize } = await import('../utils/imageCompress');
    expect(fitSize(4000, 3000, 1280)).toEqual({ width: 1280, height: 960 });
    expect(fitSize(3000, 4000, 512)).toEqual({ width: 384, height: 512 });
    expect(fitSize(300, 200, 1280)).toEqual({ width: 300, height: 200 });
  });
});
