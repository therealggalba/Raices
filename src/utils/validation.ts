import { CHANNEL_KINDS, EVENT_TYPES, VIDEO_CATEGORIES } from '../types/domain';
import type {
  CardInput,
  ChannelInput,
  ChannelKind,
  EventInput,
  EventType,
  PersonInput,
  ValidationResult,
  VideoCategory,
  VideoInput,
} from '../types/domain';
import { isIsoDate, isPartialDate } from './dates';
import { isHttpsUrl, resolveMedia } from './media';

// Runtime validation for everything that enters the repository. It plays the
// role of the server-side validation: forms may pre-check, but the repository
// always re-validates (data is treated as untrusted, including localStorage).

export const LIMITS = {
  name: 80,
  title: 120,
  description: 2000,
  relationship: 60,
  biography: 4000,
  notes: 2000,
  tag: 30,
  tags: 12,
  people: 50,
  displayName: 40,
  durationSeconds: 24 * 3600,
} as const;

const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function isId(value: unknown): value is string {
  return typeof value === 'string' && ID_RE.test(value);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isVideoCategory(value: unknown): value is VideoCategory {
  return typeof value === 'string' && (VIDEO_CATEGORIES as readonly string[]).includes(value);
}

export function isChannelKind(value: unknown): value is ChannelKind {
  return typeof value === 'string' && (CHANNEL_KINDS as readonly string[]).includes(value);
}

export function isEventType(value: unknown): value is EventType {
  return typeof value === 'string' && (EVENT_TYPES as readonly string[]).includes(value);
}

/** Strips control characters and collapses whitespace (single-line fields). */
export function cleanText(value: string): string {
  // oxlint-disable-next-line no-control-regex -- stripping control chars is the point
  return value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Like cleanText but keeps line breaks (multi-line fields). */
export function cleanMultiline(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    // oxlint-disable-next-line no-control-regex -- stripping control chars is the point
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

interface FieldOptions {
  required?: boolean;
  multiline?: boolean;
}

function readString(
  obj: Record<string, unknown>,
  key: string,
  label: string,
  max: number,
  errors: string[],
  { required = true, multiline = false }: FieldOptions = {},
): string {
  const raw = obj[key];
  if (raw === undefined || raw === null) {
    if (required) errors.push(`${label}: obligatorio`);
    return '';
  }
  if (typeof raw !== 'string') {
    errors.push(`${label}: debe ser texto`);
    return '';
  }
  const value = multiline ? cleanMultiline(raw) : cleanText(raw);
  if (required && value === '') errors.push(`${label}: obligatorio`);
  if (value.length > max) errors.push(`${label}: máximo ${max} caracteres`);
  return value;
}

function readOptionalUrl(obj: Record<string, unknown>, key: string, label: string, errors: string[]) {
  const raw = obj[key];
  if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) return undefined;
  if (!isHttpsUrl(raw)) {
    errors.push(`${label}: debe ser un enlace https válido`);
    return undefined;
  }
  return raw.trim();
}

function readIdList(obj: Record<string, unknown>, key: string, label: string, errors: string[]): string[] {
  const raw = obj[key];
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > LIMITS.people || !raw.every(isId)) {
    errors.push(`${label}: lista inválida`);
    return [];
  }
  return [...new Set(raw)];
}

export function validateChannelInput(input: unknown): ValidationResult<ChannelInput> {
  if (!isRecord(input)) return { ok: false, errors: ['Datos del canal inválidos'] };
  const errors: string[] = [];
  const name = readString(input, 'name', 'Nombre', LIMITS.name, errors);
  const description = readString(input, 'description', 'Descripción', LIMITS.description, errors, {
    required: false,
    multiline: true,
  });
  if (!isChannelKind(input.kind)) errors.push('Tipo de canal: inválido');
  const coverUrl = readOptionalUrl(input, 'coverUrl', 'Portada', errors);
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: { name, description, kind: input.kind as ChannelKind, ...(coverUrl ? { coverUrl } : {}) },
  };
}

export function validatePersonInput(input: unknown): ValidationResult<PersonInput> {
  if (!isRecord(input)) return { ok: false, errors: ['Datos de la persona inválidos'] };
  const errors: string[] = [];
  const firstName = readString(input, 'firstName', 'Nombre', LIMITS.name, errors);
  const lastName = readString(input, 'lastName', 'Apellidos', LIMITS.name, errors, { required: false });
  const relationship = readString(input, 'relationship', 'Relación', LIMITS.relationship, errors, {
    required: false,
  });
  const biography = readString(input, 'biography', 'Biografía', LIMITS.biography, errors, {
    required: false,
    multiline: true,
  });
  const notes = readString(input, 'notes', 'Notas', LIMITS.notes, errors, { required: false, multiline: true });
  let birthDate: string | undefined;
  if (input.birthDate !== undefined && input.birthDate !== null && input.birthDate !== '') {
    if (isIsoDate(input.birthDate)) birthDate = input.birthDate;
    else errors.push('Fecha de nacimiento: fecha inválida');
  }
  const photoUrl = readOptionalUrl(input, 'photoUrl', 'Fotografía', errors);
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      firstName,
      lastName,
      relationship,
      biography,
      notes,
      ...(birthDate ? { birthDate } : {}),
      ...(photoUrl ? { photoUrl } : {}),
    },
  };
}

/** Normalizes free-form tags: lowercase, trimmed, no "#", deduplicated. */
export function normalizeTags(raw: readonly string[]): string[] {
  const tags = raw.map((t) => cleanText(t).replace(/^#+/, '').toLowerCase()).filter(Boolean);
  return [...new Set(tags)];
}

export function validateVideoInput(input: unknown): ValidationResult<VideoInput> {
  if (!isRecord(input)) return { ok: false, errors: ['Datos del vídeo inválidos'] };
  const errors: string[] = [];
  const title = readString(input, 'title', 'Título', LIMITS.title, errors);
  const description = readString(input, 'description', 'Descripción', LIMITS.description, errors, {
    required: false,
    multiline: true,
  });

  let mediaUrl = '';
  if (typeof input.mediaUrl !== 'string' || input.mediaUrl.trim() === '') errors.push('Enlace del vídeo: obligatorio');
  else if (!isHttpsUrl(input.mediaUrl) || !resolveMedia(input.mediaUrl)) {
    errors.push('Enlace del vídeo: debe ser un enlace https válido');
  } else mediaUrl = input.mediaUrl.trim();

  const thumbnailUrl = readOptionalUrl(input, 'thumbnailUrl', 'Miniatura', errors);

  if (!isPartialDate(input.eventDate)) errors.push('Fecha del acontecimiento: usa AAAA, AAAA-MM o AAAA-MM-DD');

  let durationSeconds: number | undefined;
  if (input.durationSeconds !== undefined && input.durationSeconds !== null) {
    const d = input.durationSeconds;
    if (typeof d === 'number' && Number.isInteger(d) && d > 0 && d <= LIMITS.durationSeconds) durationSeconds = d;
    else errors.push('Duración: número de segundos inválido');
  }

  if (!isVideoCategory(input.category)) errors.push('Categoría: inválida');

  let tags: string[] = [];
  if (input.tags !== undefined) {
    if (!Array.isArray(input.tags) || !input.tags.every((t) => typeof t === 'string')) {
      errors.push('Etiquetas: lista inválida');
    } else {
      tags = normalizeTags(input.tags as string[]);
      if (tags.length > LIMITS.tags) errors.push(`Etiquetas: máximo ${LIMITS.tags}`);
      if (tags.some((t) => t.length > LIMITS.tag)) errors.push(`Etiquetas: máximo ${LIMITS.tag} caracteres cada una`);
    }
  }
  const personIds = readIdList(input, 'personIds', 'Personas', errors);

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      title,
      description,
      mediaUrl,
      eventDate: input.eventDate as string,
      category: input.category as VideoCategory,
      tags,
      personIds,
      ...(thumbnailUrl ? { thumbnailUrl } : {}),
      ...(durationSeconds ? { durationSeconds } : {}),
    },
  };
}

export function validateEventInput(input: unknown): ValidationResult<EventInput> {
  if (!isRecord(input)) return { ok: false, errors: ['Datos del evento inválidos'] };
  const errors: string[] = [];
  if (!isEventType(input.type)) errors.push('Tipo: inválido');
  const title = readString(input, 'title', 'Descripción', LIMITS.title, errors);
  if (!isIsoDate(input.date)) errors.push('Fecha de origen: fecha inválida');
  const personIds = readIdList(input, 'personIds', 'Personas', errors);
  const notes = readString(input, 'notes', 'Notas', LIMITS.notes, errors, { required: false, multiline: true });
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      type: input.type as EventType,
      title,
      date: input.date as string,
      personIds,
      notes,
    },
  };
}

export function validateCardInput(input: unknown): ValidationResult<CardInput> {
  if (!isRecord(input)) return { ok: false, errors: ['Datos del cromo inválidos'] };
  const errors: string[] = [];
  const title = readString(input, 'title', 'Título', LIMITS.title, errors);
  const description = readString(input, 'description', 'Descripción', LIMITS.description, errors, {
    required: false,
    multiline: true,
  });
  let imageUrl = '';
  if (typeof input.imageUrl !== 'string' || input.imageUrl.trim() === '') errors.push('Imagen: obligatoria');
  else if (!isHttpsUrl(input.imageUrl)) errors.push('Imagen: debe ser un enlace https válido');
  else imageUrl = input.imageUrl.trim();
  if (!isPartialDate(input.takenAt)) errors.push('Fecha de la foto: usa AAAA, AAAA-MM o AAAA-MM-DD');
  let personId: string | undefined;
  if (input.personId !== undefined && input.personId !== null && input.personId !== '') {
    if (isId(input.personId)) personId = input.personId;
    else errors.push('Persona: inválida');
  }
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      title,
      description,
      imageUrl,
      takenAt: input.takenAt as string,
      ...(personId ? { personId } : {}),
    },
  };
}

export function validateDisplayName(input: unknown): ValidationResult<string> {
  if (typeof input !== 'string') return { ok: false, errors: ['Nombre: obligatorio'] };
  const name = cleanText(input);
  if (!name) return { ok: false, errors: ['Nombre: obligatorio'] };
  if (name.length > LIMITS.displayName) return { ok: false, errors: [`Nombre: máximo ${LIMITS.displayName} caracteres`] };
  return { ok: true, value: name };
}

/** "1:30", "90", "1:02:03" → seconds. Empty → undefined. Invalid → NaN. */
export function parseDurationInput(value: string): number | undefined {
  const v = value.trim();
  if (!v) return undefined;
  if (!/^\d+(?::\d{1,2}){0,2}$/.test(v)) return Number.NaN;
  return v.split(':').reduce((acc, part) => acc * 60 + Number(part), 0);
}

export function parseTagsInput(value: string): string[] {
  return normalizeTags(value.split(','));
}
