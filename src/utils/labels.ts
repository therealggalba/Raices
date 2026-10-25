import type { ChannelKind, EventType, Role, Species, VideoCategory } from '../types/domain';

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

export const EVENT_LABELS: Record<EventType, string> = {
  cumpleanos: 'Cumpleaños',
  aniversario: 'Aniversario',
  comunion: 'Comunión',
  bautizo: 'Bautizo',
  boda: 'Boda',
  fallecimiento: 'Fallecimiento',
  santo: 'Santo',
  dia_senalado: 'Día señalado',
  otro: 'Otro evento',
};

export const CHANNEL_KIND_LABELS: Record<ChannelKind, string> = {
  familia: 'Familia',
  amigos: 'Amigos',
  viajes: 'Viajes',
  otros: 'Otros',
};

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Creador',
  admin: 'Administrador',
  member: 'Miembro',
};

export const SPECIES_LABELS: Record<Species, string> = {
  perro: 'Perro',
  gato: 'Gato',
  ave: 'Ave',
  conejo: 'Conejo',
  roedor: 'Roedor',
  pez: 'Pez',
  reptil: 'Reptil',
  caballo: 'Caballo',
  otro: 'Otro animal',
};
