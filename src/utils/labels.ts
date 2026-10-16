import type { ChannelKind, EventType, Role, VideoCategory } from '../types/domain';

export const CATEGORY_LABELS: Record<VideoCategory, string> = {
  vacaciones: 'Vacaciones',
  cumpleanos: 'Cumpleaños',
  navidad: 'Navidades',
  boda: 'Bodas',
  comunion: 'Comuniones',
  bautizo: 'Bautizos',
  reunion: 'Reuniones',
  otros: 'Otros recuerdos',
};

export const CATEGORY_ICONS: Record<VideoCategory, string> = {
  vacaciones: '🏖️',
  cumpleanos: '🎂',
  navidad: '🎄',
  boda: '💍',
  comunion: '🕊️',
  bautizo: '👶',
  reunion: '👨‍👩‍👧‍👦',
  otros: '🎞️',
};

export const EVENT_LABELS: Record<EventType, string> = {
  cumpleanos: 'Cumpleaños',
  aniversario: 'Aniversario',
  comunion: 'Comunión',
  bautizo: 'Bautizo',
  boda: 'Boda',
  otro: 'Otro evento',
};

export const EVENT_ICONS: Record<EventType, string> = {
  cumpleanos: '🎂',
  aniversario: '💞',
  comunion: '🕊️',
  bautizo: '👶',
  boda: '💍',
  otro: '📌',
};

export const CHANNEL_KIND_LABELS: Record<ChannelKind, string> = {
  familia: 'Familia',
  amigos: 'Amigos',
  viajes: 'Viajes',
  otros: 'Otros',
};

/** Suffix for thematic rows when several kinds share a category ("Vacaciones en familia"). */
export const CHANNEL_KIND_ROW_SUFFIX: Record<ChannelKind, string> = {
  familia: 'en familia',
  amigos: 'con amigos',
  viajes: 'de viaje',
  otros: '· otros canales',
};

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrador',
  member: 'Miembro',
};
