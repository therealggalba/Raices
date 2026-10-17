import type { ChannelKind, EventType, Rarity, Role, VideoCategory } from '../types/domain';

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

export const RARITY_LABELS: Record<Rarity, string> = {
  comun: 'Común',
  'poco-comun': 'Poco común',
  raro: 'Raro',
  epico: 'Épico',
  legendario: 'Legendario',
};

/** Stars shown on the cromo (legendary shows a crown, as in the original app). */
export const RARITY_STARS: Record<Rarity, number> = {
  comun: 1,
  'poco-comun': 2,
  raro: 3,
  epico: 4,
  legendario: 0,
};

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrador',
  member: 'Miembro',
};
