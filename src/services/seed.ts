import { SCHEMA_VERSION } from '../types/domain';
import type {
  AlbumCard,
  CardCopy,
  FamilyEvent,
  Invitation,
  Member,
  Gender,
  Person,
  User,
  Video,
  VideoCategory,
  PackTheme,
  ViewRecord,
} from '../types/domain';
import { addDays, sameDayInYear, toIsoDate } from '../utils/dates';
import { newId } from '../utils/ids';
import { demoAsset } from '../utils/media';
import type { Db } from './localRepository';

// Demo data for the public MVP. Everyone in it is fictional. Some dates are
// computed relative to "today" so the event alerts always have something to
// show (e.g. "Cumpleaños de Carlos en 3 días", like the spec's example).
// Media are freely licensed sample clips (Blender Foundation, MDN), played as links.

export const DEMO_FAMILY_ID = 'demo-familia-montero';
export const DEMO_FRIENDS_ID = 'demo-amigos-uni';
export const DEMO_COUSINS_ID = 'demo-primos-sanz';

const CLIPS = [
  // Sintel trailer (Blender Foundation, CC-BY), 52 s.
  { url: 'https://download.blender.org/durian/trailer/sintel_trailer-480p.mp4', seconds: 52 },
  // Big Buck Bunny (Blender Foundation, CC-BY) via archive.org, 9 min 56 s.
  { url: 'https://archive.org/download/BigBuckBunny_124/Content/big_buck_bunny_720p_surround.mp4', seconds: 596 },
  // MDN CC0 sample, 5 s.
  { url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', seconds: 5 },
];

// Family photos bundled with the app (public/demo, free Unsplash photos, see
// CREDITOS.md there): covers of the demo videos and photos of its cromos.
const DEMO_VIDEO_COVERS: Record<string, string> = {
  'La boda de los abuelos': 'boda-baile',
  'Primer verano en Cádiz': 'antigua-ninos',
  'Boda de Luis y Elena': 'boda-coche',
  'Bautizo de Carlos': 'bautizo-agua',
  'Navidad en casa de los abuelos': 'navidad-arbol',
  'Carlos cumple 5': 'cumple-velas',
  'Primera comunión de Carlos': 'familia-cesped',
  'Pirineos en caravana': 'montana-familia',
  'Bodas de oro de Antonio y Carmen': 'comida-festin',
  'Llega Natalia': 'padre-hija',
  'Concierto de Carlos': 'navidad-luces',
  'Navidad 2019': 'navidad-cuento',
  'Natalia cumple 6': 'cumple-tarta',
  'Verano en Galicia': 'playa-paseo',
  'Comida de domingo': 'comida-familia',
  'Reyes en casa de la tía Pilar': 'navidad-luces',
  'Viaje de fin de carrera': 'amigos-coche',
  'Cena de los 20 años': 'comida-grupo',
  'Fiesta de la primavera': 'amigos-playa',
  'Los 30 de Marta': 'cumple-mascota',
  'Boda de Javi y Laura': 'boda-abrazo',
  'Escapada a Lisboa': 'madre-hijo-agua',
  'Nochevieja en el pueblo': 'navidad-decorar',
  'Verano en la casa de Asturias': 'playa-orilla',
  'Comunión de Lucía': 'padre-nina-flores',
  'Boda de Rosa y Andrés': 'familia-otono',
};

/** Cromo photos, in the order of the demo album plan. */
const DEMO_CARD_PHOTOS = [
  'antigua-retrato', 'antigua-arboles', 'antigua-perro', 'antigua-campo', 'boda-baile', 'comida-festin',
  'navidad-cuento', 'graduacion-chicos', 'abuela-nino', 'cumple-tarta', 'bautizo-nino', 'navidad-nino',
  'navidad-luces', 'antigua-perro', 'graduacion-birretes', 'padre-hija', 'cumple-velas', 'padre-nina-flores',
  'graduacion-birretes', 'madre-hijo-agua', 'amigos-playa', 'boda-abrazo', 'amigos-coche', 'playa-orilla',
  'boda-coche', 'abuelo-planta', 'navidad-decorar', 'familia-parque',
];

export function buildDemoDb(now: Date): Db {
  const today = toIsoDate(now);
  const iso = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86_400_000).toISOString();
  const userId = newId();

  const users: User[] = [
    { id: userId, name: 'Invitado' },
    { id: 'u-elena', name: 'Elena' },
    { id: 'u-luis', name: 'Luis' },
    { id: 'u-carlos', name: 'Carlos' },
    { id: 'u-marta', name: 'Marta' },
    { id: 'u-javi', name: 'Javi' },
    { id: 'u-rosa', name: 'Rosa' },
  ];

  const member = (channelId: string, id: string, displayName: string, role: Member['role'], daysAgo: number): Member => ({
    channelId,
    userId: id,
    displayName,
    role,
    joinedAt: iso(daysAgo),
  });

  const members: Member[] = [
    member(DEMO_FAMILY_ID, userId, 'Invitado', 'admin', 120),
    member(DEMO_FAMILY_ID, 'u-elena', 'Elena', 'admin', 120),
    member(DEMO_FAMILY_ID, 'u-luis', 'Luis', 'member', 110),
    member(DEMO_FAMILY_ID, 'u-carlos', 'Carlos', 'member', 60),
    member(DEMO_FRIENDS_ID, 'u-marta', 'Marta', 'admin', 300),
    member(DEMO_FRIENDS_ID, userId, 'Invitado', 'member', 200),
    member(DEMO_FRIENDS_ID, 'u-javi', 'Javi', 'member', 190),
    member(DEMO_COUSINS_ID, 'u-rosa', 'Rosa', 'admin', 400),
    member(DEMO_COUSINS_ID, userId, 'Invitado', 'member', 150),
    member(DEMO_COUSINS_ID, 'u-elena', 'Elena', 'member', 150),
  ];

  const person = (
    id: string,
    p: Omit<Person, 'id' | 'channelId' | 'parentIds'>,
  ): Person => ({
    id,
    channelId: DEMO_FAMILY_ID,
    parentIds: [],
    ...p,
  });

  const people: Person[] = [
    person('p-antonio', {
      firstName: 'Antonio',
      lastName: 'Montero Ruiz',
      birthDate: '1941-03-12',
      relationship: 'Abuelo',
      biography:
        'Carpintero de Úbeda. Montó su propio taller en 1968 y todavía guarda la primera silla que hizo. Le encanta contar cómo conoció a Carmen en las fiestas del pueblo.',
    }),
    person('p-carmen', {
      firstName: 'Carmen',
      lastName: 'Lozano Gil',
      birthDate: '1944-09-30',
      relationship: 'Abuela',
      biography: 'Maestra durante 38 años. La mejor tortilla de patatas de la familia y la memoria viva de todas las recetas.',
    }),
    person('p-luis', {
      firstName: 'Luis',
      lastName: 'Montero Lozano',
      birthDate: '1969-05-21',
      relationship: 'Padre',
      biography: 'Hijo mayor de Antonio y Carmen. Aficionado a grabarlo todo con su videocámara desde 1990.',
    }),
    person('p-elena', {
      firstName: 'Elena',
      lastName: 'Sanz Pardo',
      birthDate: '1971-11-04',
      relationship: 'Madre',
      biography: 'Enfermera y organizadora oficial de las reuniones familiares.',
    }),
    person('p-carlos', {
      firstName: 'Carlos',
      lastName: 'Montero Sanz',
      birthDate: sameDayInYear(addDays(today, 3), 1998),
      relationship: 'Hijo',
      biography: 'El mayor de los nietos. Batería en un grupo de rock desde los 15 años.',
    }),
    person('p-natalia', {
      firstName: 'Natalia',
      lastName: 'Montero Sanz',
      birthDate: '2017-02-14',
      relationship: 'Hija',
      biography: 'La pequeña de la casa. Quiere ser veterinaria (o astronauta, según el día).',
    }),
    // Other channels (so their albums have categories too).
    { id: 'p-marta', channelId: DEMO_FRIENDS_ID, firstName: 'Marta', lastName: 'Ibáñez', birthDate: sameDayInYear(today, 1982),
      relationship: 'Amiga', biography: 'Delegada de clase y organizadora oficial de todas las cenas.', parentIds: [] },
    { id: 'p-javi', channelId: DEMO_FRIENDS_ID, firstName: 'Javi', lastName: 'Ortega', birthDate: '1982-04-02',
      relationship: 'Amigo', biography: 'El de la fuente. Ahora es serio (a ratos).', parentIds: [] },
    { id: 'p-rosa', channelId: DEMO_COUSINS_ID, firstName: 'Rosa', lastName: 'Sanz Pardo', birthDate: '1975-05-12',
      relationship: 'Prima', biography: 'Hermana pequeña de Elena. Guardiana de las fotos del pueblo.', parentIds: [] },
    { id: 'p-andres', channelId: DEMO_COUSINS_ID, firstName: 'Andrés', lastName: 'Vidal', birthDate: '1973-02-08',
      relationship: 'Primo político', biography: 'Pescador de río y cocinero de fabada.', parentIds: [] },
    { id: 'p-lucia', channelId: DEMO_COUSINS_ID, firstName: 'Lucía', lastName: 'Vidal Sanz', birthDate: '2001-01-15',
      relationship: 'Prima', biography: 'Hija de Rosa y Andrés.', parentIds: [] },
  ];

  let n = 0;
  const video = (
    title: string,
    eventDate: string,
    category: VideoCategory,
    personIds: string[],
    description: string,
    tags: string[] = [],
  ): Video => {
    n += 1;
    return {
      id: `v-demo-${n}`,
      channelId: DEMO_FAMILY_ID,
      title,
      description,
      mediaUrl: CLIPS[n % CLIPS.length].url,
      eventDate,
      uploadedAt: iso(90 - n * 5),
      durationSeconds: CLIPS[n % CLIPS.length].seconds,
      category,
      tags,
      personIds,
      authorId: n % 3 === 0 ? 'u-elena' : userId,
    };
  };

  const videos: Video[] = [
    video('La boda de los abuelos', sameDayInYear(addDays(today, 1), 1966).slice(0, 7), 'boda', ['p-antonio', 'p-carmen'],
      'Película en Super 8 digitalizada. La iglesia de Santa María y el banquete en el patio de la casa.', ['super 8', 'úbeda']),
    video('Primer verano en Cádiz', '1985-08', 'vacaciones', ['p-antonio', 'p-carmen', 'p-luis'],
      'El primer viaje a la playa en el Seat 127. Luis con 16 años se niega a salir en la grabación.', ['playa', 'cádiz']),
    video('Boda de Luis y Elena', '1996-06-15', 'boda', ['p-luis', 'p-elena', 'p-antonio', 'p-carmen'],
      'La ceremonia, el baile y el famoso discurso del tío Paco.', ['ceremonia', 'baile']),
    video('Bautizo de Carlos', '1998-11', 'bautizo', ['p-carlos', 'p-luis', 'p-elena'],
      'Carlos llora durante toda la ceremonia. La abuela Carmen lo calma con una nana.'),
    video('Navidad en casa de los abuelos', '1999-12-24', 'navidad', ['p-antonio', 'p-carmen', 'p-luis', 'p-elena', 'p-carlos'],
      'Nochebuena con villancicos y zambomba. El abuelo hace de rey mago.', ['nochebuena', 'villancicos']),
    video('Carlos cumple 5', '2003', 'cumpleanos', ['p-carlos'], 'Tarta de piratas y piñata en el jardín.', ['piñata']),
    video('Primera comunión de Carlos', '2007-05', 'comunion', ['p-carlos', 'p-luis', 'p-elena'],
      'Misa, fotos en el parque y comida con toda la familia.'),
    video('Pirineos en caravana', '2009-07', 'vacaciones', ['p-luis', 'p-elena', 'p-carlos'],
      'Diez días de ruta por Huesca. La caravana se queda sin batería en Ordesa.', ['montaña', 'caravana']),
    video('Bodas de oro de Antonio y Carmen', '2016-06', 'reunion', ['p-antonio', 'p-carmen', 'p-luis', 'p-elena', 'p-carlos'],
      '50 años de casados. Sorpresa organizada por Elena con vídeo de fotos antiguas.', ['aniversario']),
    video('Llega Natalia', '2017-02-16', 'otros', ['p-natalia', 'p-elena', 'p-luis'], 'Primeros días en casa con la pequeña.'),
    video('Concierto de Carlos', '2018-04', 'otros', ['p-carlos'], 'Primer concierto del grupo en la sala del barrio.', ['música', 'batería']),
    video('Navidad 2019', '2019-12-25', 'navidad', ['p-natalia', 'p-carlos', 'p-carmen'],
      'Natalia abre los regalos a las siete de la mañana.'),
    video('Natalia cumple 6', '2023-02-14', 'cumpleanos', ['p-natalia'], 'Fiesta de unicornios con sus amigas del cole.'),
    video('Verano en Galicia', '2024-08', 'vacaciones', ['p-luis', 'p-elena', 'p-natalia'],
      'Ruta por las Rías Baixas. Natalia descubre los percebes (y no le gustan).', ['playa', 'galicia']),
    video('Comida de domingo', '2025-03', 'reunion', ['p-antonio', 'p-carmen', 'p-natalia'],
      'Paella del abuelo, sobremesa y partida de dominó.', ['paella']),
  ];

  const events: FamilyEvent[] = [
    {
      id: 'e-aniversario-abuelos',
      channelId: DEMO_FAMILY_ID,
      type: 'aniversario',
      title: 'Aniversario de los abuelos',
      date: sameDayInYear(addDays(today, 1), 1966),
      personIds: ['p-antonio', 'p-carmen'],
      notes: 'Siempre comida en su casa. Llevar flores.',
    },
    {
      id: 'e-comunion-natalia',
      channelId: DEMO_FAMILY_ID,
      type: 'comunion',
      title: 'Comunión de Natalia',
      date: addDays(today, 7),
      personIds: ['p-natalia'],
      notes: 'Iglesia de San Juan a las 12:00. Comida en el restaurante El Olivo.',
    },
    {
      id: 'e-aniversario-padres',
      channelId: DEMO_FAMILY_ID,
      type: 'aniversario',
      title: 'Aniversario de Luis y Elena',
      date: '1996-06-15',
      personIds: ['p-luis', 'p-elena'],
      notes: '',
    },
    {
      id: 'e-cumple-marta',
      channelId: DEMO_FRIENDS_ID,
      type: 'cumpleanos',
      // Today: the demo always shows the «hoy» pop-up.
      title: 'Cumpleaños de Marta',
      date: sameDayInYear(today, 1982),
      personIds: ['p-marta'],
      notes: 'Cena sorpresa, como en los 30.',
    },
    {
      id: 'e-cumple-javi',
      channelId: DEMO_FRIENDS_ID,
      type: 'cumpleanos',
      title: 'Cumpleaños de Javi',
      date: '1982-04-02',
      personIds: ['p-javi'],
      notes: '',
    },
    {
      id: 'e-boda-javi-laura',
      channelId: DEMO_FRIENDS_ID,
      type: 'boda',
      title: 'Boda de Javi y Laura',
      date: '2015-09-19',
      personIds: [],
      notes: '',
    },
    {
      id: 'e-graduacion',
      channelId: DEMO_FRIENDS_ID,
      type: 'otro',
      title: 'Graduación de la promoción',
      date: '2004-06-25',
      personIds: [],
      notes: 'Cena anual de antiguos alumnos.',
    },
    {
      id: 'e-boda-rosa-andres',
      channelId: DEMO_COUSINS_ID,
      type: 'boda',
      title: 'Boda de Rosa y Andrés',
      date: '2008-10-11',
      personIds: [],
      notes: '',
    },
    {
      id: 'e-cumple-lucia',
      channelId: DEMO_COUSINS_ID,
      type: 'cumpleanos',
      title: 'Cumpleaños de la prima Lucía',
      date: '2001-01-15',
      personIds: ['p-lucia'],
      notes: '',
    },
    {
      id: 'e-bautizo-carlos',
      channelId: DEMO_FAMILY_ID,
      type: 'bautizo',
      title: 'Bautizo de Carlos',
      date: '1998-11-22',
      personIds: ['p-carlos'],
      notes: '',
    },
  ];

  const invitations: Invitation[] = [
    {
      id: 'i-demo-used',
      channelId: DEMO_FAMILY_ID,
      code: 'CRLS-2DMN-7QXP',
      createdBy: userId,
      createdAt: iso(61),
      expiresAt: iso(54),
      usedAt: iso(60),
      usedBy: 'u-carlos',
    },
  ];
  members.find((m) => m.userId === 'u-carlos')!.invitationId = 'i-demo-used';

  const other = (
    channelId: string,
    id: string,
    title: string,
    eventDate: string,
    category: VideoCategory,
    description: string,
    daysAgo: number,
    authorId: string,
    tags: string[] = [],
  ): Video => ({
    id,
    channelId,
    title,
    description,
    mediaUrl: CLIPS[daysAgo % CLIPS.length].url,
    eventDate,
    uploadedAt: iso(daysAgo),
    durationSeconds: CLIPS[daysAgo % CLIPS.length].seconds,
    category,
    tags,
    personIds: [],
    authorId,
  });

  const friendsVideos: Video[] = [
    other(DEMO_FRIENDS_ID, 'v-demo-uni-1', 'Viaje de fin de carrera', '2004-07', 'vacaciones',
      'Praga, Viena y Budapest en tren. Cinco amigos y una sola maleta grande.', 150, 'u-marta', ['interrail']),
    other(DEMO_FRIENDS_ID, 'v-demo-uni-2', 'Cena de los 20 años', '2024-11', 'reunion',
      'Reencuentro en el mismo bar de siempre, que sigue igual.', 100, 'u-marta'),
    other(DEMO_FRIENDS_ID, 'v-demo-uni-3', 'Fiesta de la primavera', '2002-04', 'otros',
      'La fiesta de la facultad en la que Javi acabó en la fuente.', 140, 'u-javi'),
    other(DEMO_FRIENDS_ID, 'v-demo-uni-4', 'Los 30 de Marta', '2012-10-20', 'cumpleanos',
      'Cena sorpresa en Malasaña. Marta no sospechó nada.', 120, 'u-javi'),
    other(DEMO_FRIENDS_ID, 'v-demo-uni-5', 'Boda de Javi y Laura', '2015-09', 'boda',
      'El grupo al completo, el baile de los novios y la tuna sorpresa.', 70, 'u-marta'),
    other(DEMO_FRIENDS_ID, 'v-demo-uni-6', 'Escapada a Lisboa', '2019-10', 'vacaciones',
      'Puente de octubre: tranvía 28, pasteles de Belém y fado.', 30, 'u-marta', ['lisboa']),
  ];

  const cousinsVideos: Video[] = [
    other(DEMO_COUSINS_ID, 'v-demo-sanz-1', 'Nochevieja en el pueblo', '1994-12-31', 'navidad',
      'Las uvas con campanadas en directo desde la plaza. Los primos con los gorros de papel.', 200, 'u-rosa'),
    other(DEMO_COUSINS_ID, 'v-demo-sanz-2', 'Verano en la casa de Asturias', '2001-08', 'vacaciones',
      'Un mes entero de bicis, río y sidra (solo para los mayores).', 180, 'u-rosa', ['asturias']),
    other(DEMO_COUSINS_ID, 'v-demo-sanz-3', 'Comunión de Lucía', '2010-05', 'comunion',
      'La prima Lucía y su vestido con lazo azul.', 160, 'u-rosa'),
    other(DEMO_COUSINS_ID, 'v-demo-sanz-4', 'Boda de Rosa y Andrés', '2008-10-11', 'boda',
      'Boda en otoño en el monasterio. Llovió, pero dio igual.', 45, 'u-rosa'),
    other(DEMO_COUSINS_ID, 'v-demo-sanz-5', 'Reyes en casa de la tía Pilar', '2022-01-06', 'navidad',
      'Roscón, regalos y la tradicional pelea por el haba.', 12, 'u-elena'),
  ];

  // Demo playbacks so "Lo más visto" has something to rank.
  const viewsPlan: Record<string, number> = {
    'v-demo-1': 14, 'v-demo-3': 9, 'v-demo-5': 11, 'v-demo-9': 7, 'v-demo-12': 5, 'v-demo-14': 3,
    'v-demo-uni-1': 12, 'v-demo-uni-5': 6, 'v-demo-sanz-1': 8, 'v-demo-sanz-4': 4,
  };
  const everyVideo = [...videos, ...friendsVideos, ...cousinsVideos];
  const halfWatched = videos.find((v) => v.mediaUrl === CLIPS[1].url)!;
  const views: ViewRecord[] = [];
  for (const [videoId, count] of Object.entries(viewsPlan)) {
    const channelId = everyVideo.find((v) => v.id === videoId)!.channelId;
    const viewers = members.filter((m) => m.channelId === channelId && m.userId !== userId);
    for (let i = 0; i < count; i++) {
      views.push({ channelId, videoId, userId: viewers[i % viewers.length].userId, at: iso(20 - (i % 20)) });
    }
  }

  // Album: bundled family photos (DEMO_CARD_PHOTOS).
  const cardsPlan: [string, string | undefined, string, string, string][] = [
    // channel, person, title, takenAt, description
    [DEMO_FAMILY_ID, 'p-antonio', 'La mili en Melilla', '1961', 'Con el uniforme recién estrenado y cara de no haber dormido.'],
    [DEMO_FAMILY_ID, 'p-antonio', 'Con su primera silla', '1968-05', 'La primera silla del taller. Sigue en el salón.'],
    [DEMO_FAMILY_ID, 'p-antonio', 'El taller de carpintería', '1975', 'Serrín hasta las cejas.'],
    [DEMO_FAMILY_ID, 'p-carmen', 'Primer día de maestra', '1965-09', 'Escuela unitaria de Santo Tomé.'],
    [DEMO_FAMILY_ID, 'p-carmen', 'La boda', '1966-10', 'Antonio y Carmen a la salida de Santa María.'],
    [DEMO_FAMILY_ID, 'p-carmen', 'La tortilla del siglo', '1990', 'Doce huevos y ni una sobra.'],
    [DEMO_FAMILY_ID, 'p-luis', 'Con la videocámara nueva', '1990-12', 'El origen de todos los vídeos de este canal.'],
    [DEMO_FAMILY_ID, 'p-luis', 'Graduación', '1993-06', ''],
    [DEMO_FAMILY_ID, 'p-elena', 'Uniforme de enfermera', '1995', 'Primer día en el hospital.'],
    [DEMO_FAMILY_ID, 'p-elena', 'Los 40', '2011-11-04', 'Fiesta sorpresa (que no fue tan sorpresa).'],
    [DEMO_FAMILY_ID, 'p-carlos', 'Bañándome', '1999-07', 'La palangana del patio de los abuelos.'],
    [DEMO_FAMILY_ID, 'p-carlos', 'Disfrazado de pirata', '2001-02', 'Carnaval del colegio.'],
    [DEMO_FAMILY_ID, 'p-carlos', 'Tocando la batería', '2013-12', 'Primer ensayo con el grupo.'],
    [DEMO_FAMILY_ID, 'p-carlos', 'Selfie perruno', '2016-06', 'Con Toby, el perro de los vecinos.'],
    [DEMO_FAMILY_ID, 'p-carlos', 'Graduación', '2020-06', 'Ingeniero, por fin.'],
    [DEMO_FAMILY_ID, 'p-natalia', 'Primeros pasos', '2018-03', 'Del sofá a la mesa, sin manos.'],
    [DEMO_FAMILY_ID, 'p-natalia', 'Disfraz de astronauta', '2023-02', ''],
    [DEMO_FAMILY_ID, 'p-natalia', 'Sin el primer diente', '2023-09', 'El Ratoncito Pérez pagó dos euros.'],
    [DEMO_FRIENDS_ID, 'p-marta', 'Orla de la facultad', '2004-06', ''],
    [DEMO_FRIENDS_ID, 'p-marta', 'En el tranvía 28', '2019-10', 'Escapada a Lisboa.'],
    [DEMO_FRIENDS_ID, 'p-javi', 'La fuente', '2002-04', 'La foto que Javi intentó destruir.'],
    [DEMO_FRIENDS_ID, 'p-javi', 'El novio', '2015-09', 'Boda con Laura.'],
    [DEMO_FRIENDS_ID, undefined, 'La pandilla al completo', '2004-07', 'Estación de Praga, viaje de fin de carrera.'],
    [DEMO_COUSINS_ID, 'p-rosa', 'Verano en Asturias', '2001-08', ''],
    [DEMO_COUSINS_ID, 'p-rosa', 'Novia en el monasterio', '2008-10-11', 'Llovió, pero dio igual.'],
    [DEMO_COUSINS_ID, 'p-andres', 'Pescando en el río', '2001-08', 'Tres truchas. Según él, cinco.'],
    [DEMO_COUSINS_ID, 'p-lucia', 'Primer día de cole', '2005-09', ''],
    [DEMO_COUSINS_ID, 'p-lucia', 'Comunión', '2010-05', 'El vestido con lazo azul.'],
  ];
  const numbers = new Map<string, number>();
  const cards: AlbumCard[] = cardsPlan.map(([channelId, personId, title, takenAt, description], i) => {
    const number = (numbers.get(channelId) ?? 0) + 1;
    numbers.set(channelId, number);
    return {
      id: `c-demo-${i + 1}`,
      channelId,
      number,
      ...(personId ? { personId } : {}),
      title,
      description,
      imageUrl: demoAsset(DEMO_CARD_PHOTOS[i % DEMO_CARD_PHOTOS.length]),
      takenAt,
      createdAt: iso(60 - i),
      authorId: userId,
    };
  });

  for (const v of [...videos, ...friendsVideos, ...cousinsVideos]) {
    const cover = DEMO_VIDEO_COVERS[v.title];
    if (cover) v.thumbnailUrl = demoAsset(cover);
  }

  const db: Db = {
    schemaVersion: SCHEMA_VERSION,
    currentUserId: userId,
    users,
    channels: [
      {
        id: DEMO_FAMILY_ID,
        name: 'Familia Montero',
        description: 'Los recuerdos de tres generaciones: de las películas en Super 8 de los abuelos a los vídeos del móvil de Natalia.',
        kind: 'familia',
        packTheme: 'clasico',
        createdAt: iso(120),
        createdBy: userId,
      },
      {
        id: DEMO_FRIENDS_ID,
        name: 'Amigos de la Universidad',
        description: 'Promoción 2000-2004. Viajes, cenas y reencuentros.',
        kind: 'amigos',
        packTheme: 'atardecer',
        createdAt: iso(300),
        createdBy: 'u-marta',
      },
      {
        id: DEMO_COUSINS_ID,
        name: 'Primos Sanz',
        description: 'La rama de la familia de Elena: veranos en Asturias y Nocheviejas en el pueblo.',
        kind: 'familia',
        packTheme: 'oceano',
        createdAt: iso(400),
        createdBy: 'u-rosa',
      },
    ],
    members,
    people,
    videos: everyVideo,
    events,
    invitations,
    favorites: [
      { channelId: DEMO_FAMILY_ID, userId, videoId: 'v-demo-1' },
      { channelId: DEMO_FAMILY_ID, userId, videoId: 'v-demo-9' },
      { channelId: DEMO_FRIENDS_ID, userId, videoId: 'v-demo-uni-6' },
    ],
    views,
    cards,
    cardSequence: Object.fromEntries(numbers),
    copies: demoCopies(cards, userId, now),
    packs: [],
    partnerships: [],
    notifications: [],
    // Demo: a half-watched video so «continuar» can be seen straight away.
    progress: [
      {
        channelId: DEMO_FAMILY_ID,
        userId,
        videoId: halfWatched.id,
        positionSeconds: 187,
        durationSeconds: CLIPS[1].seconds,
        updatedAt: iso(1),
      },
    ],
  };
  addDemoFamilyTree(db);
  addDemoPeopleDetails(db, userId);
  return db;
}

/** People added to the friends/cousins demo channels together with the album (schema v5). */
const ALBUM_DEMO_PEOPLE = new Set(['p-marta', 'p-javi', 'p-rosa', 'p-andres', 'p-lucia']);
const ALBUM_DEMO_EVENT_LINKS: Record<string, string> = {
  'e-cumple-marta': 'p-marta',
  'e-cumple-javi': 'p-javi',
  'e-cumple-lucia': 'p-lucia',
};

/**
 * Upgrade helper for stored data created before the album existed: brings
 * the demo album (and the people it needs) into the demo channels that are
 * still there. Real channels are never touched; demo people or cromos the
 * user already deleted or changed are respected.
 */
export function addDemoAlbum(db: Db, now: Date): void {
  const demo = buildDemoDb(now);
  const channels = new Set(db.channels.map((c) => c.id));
  const personIds = new Set(db.people.map((p) => p.id));
  for (const person of demo.people) {
    if (ALBUM_DEMO_PEOPLE.has(person.id) && channels.has(person.channelId) && !personIds.has(person.id)) {
      db.people.push(person);
      personIds.add(person.id);
    }
  }
  for (const event of db.events) {
    const link = ALBUM_DEMO_EVENT_LINKS[event.id];
    if (link && personIds.has(link) && event.personIds.length === 0) event.personIds = [link];
  }
  const cardIds = new Set(db.cards.map((c) => c.id));
  for (const card of demo.cards) {
    if (!channels.has(card.channelId) || cardIds.has(card.id)) continue;
    if (card.personId && !personIds.has(card.personId)) continue;
    db.cards.push({ ...card, authorId: db.currentUserId });
    db.cardSequence[card.channelId] = Math.max(db.cardSequence[card.channelId] ?? 0, card.number);
  }
}

/** Shape of the per-user unlock records of schema v6 (migration only). */
export interface LegacyUnlock {
  channelId: string;
  userId: string;
  cardId: string;
  unlockedAt: string;
}

/** Demo cromos the user already has: about two thirds of them. */
function isDemoOwned(cardId: string): boolean {
  return cardId.startsWith('c-demo-') && Number(cardId.slice(7)) % 3 !== 0;
}

/** Schema v6 demo collection (kept for the v5 -> v6 migration step). */
export function demoUnlocks(cards: readonly AlbumCard[], userId: string, now: Date): LegacyUnlock[] {
  return cards
    .filter((c) => isDemoOwned(c.id))
    .map((c, i) => ({
      channelId: c.channelId,
      userId,
      cardId: c.id,
      unlockedAt: new Date(now.getTime() - (i + 1) * 86_400_000).toISOString(),
    }));
}

/**
 * Demo collection: about two thirds of the example cromos owned, some of
 * them repeated (×2, ×3) so the copy counter can be seen.
 */
export function demoCopies(cards: readonly AlbumCard[], userId: string, now: Date): CardCopy[] {
  return demoUnlocks(cards, userId, now).map((u) => ({
    channelId: u.channelId,
    userId: u.userId,
    cardId: u.cardId,
    count: extraDemoCopies(u.cardId) + 1,
    firstObtainedAt: u.unlockedAt,
  }));
}

/** Deterministic demo duplicates: every 4th owned cromo has 1-2 extra copies. */
export function extraDemoCopies(cardId: string): number {
  if (!isDemoOwned(cardId)) return 0;
  const n = Number(cardId.slice(7));
  return n % 4 === 1 ? 1 + (n % 2) : 0;
}

export const DEMO_PACK_THEMES: Record<string, PackTheme> = {
  [DEMO_FAMILY_ID]: 'clasico',
  [DEMO_FRIENDS_ID]: 'atardecer',
  [DEMO_COUSINS_ID]: 'oceano',
};

// ---- Demo family tree ------------------------------------------------------

/** People who only exist to make the demo tree richer (Luis's sister's family). */
const DEMO_TREE_PEOPLE: Person[] = [
  { id: 'p-pilar', channelId: DEMO_FAMILY_ID, firstName: 'Pilar', lastName: 'Montero Lozano', birthDate: '1973-08-09',
    relationship: 'Tía', biography: 'Hermana de Luis. La de los Reyes en su casa.', parentIds: [] },
  { id: 'p-jorge', channelId: DEMO_FAMILY_ID, firstName: 'Jorge', lastName: 'Ruiz Toledo', birthDate: '1970-01-22',
    relationship: 'Tío político', biography: 'Marido de Pilar. Experto en barbacoas.', parentIds: [] },
  { id: 'p-sofia', channelId: DEMO_FAMILY_ID, firstName: 'Sofía', lastName: 'Ruiz Montero', birthDate: '2003-04-11',
    relationship: 'Prima', biography: 'Hija de Pilar y Jorge. Estudia Bellas Artes.', parentIds: [] },
];

/** Antonio's parents, who passed away (the tree shows them with a cross). */
const DEMO_ANCESTORS: Person[] = [
  { id: 'p-manuel', channelId: DEMO_FAMILY_ID, firstName: 'Manuel', lastName: 'Montero Vidal', birthDate: '1912-06-03',
    deathDate: '1989-01-27', relationship: 'Bisabuelo', parentIds: [],
    biography: 'Agricultor en Úbeda. De él heredó Antonio la paciencia y las manos de carpintero.' },
  { id: 'p-dolores', channelId: DEMO_FAMILY_ID, firstName: 'Dolores', lastName: 'Ruiz Cano', birthDate: '1916-12-08',
    deathDate: '2004-04-15', relationship: 'Bisabuela', parentIds: [],
    biography: 'Costurera. Hizo a mano el vestido de novia de Carmen.' },
];

const DEMO_GENDERS: Record<string, Gender> = {
  'p-manuel': 'hombre', 'p-dolores': 'mujer', 'p-antonio': 'hombre', 'p-carmen': 'mujer', 'p-luis': 'hombre',
  'p-elena': 'mujer', 'p-pilar': 'mujer', 'p-jorge': 'hombre', 'p-carlos': 'hombre', 'p-natalia': 'mujer',
  'p-sofia': 'mujer', 'p-marta': 'mujer', 'p-javi': 'hombre', 'p-rosa': 'mujer', 'p-andres': 'hombre', 'p-lucia': 'mujer',
};

/** The family's pets: Toby, and Misi, who is no longer with them. */
const DEMO_PETS: Person[] = [
  { id: 'pet-toby', channelId: DEMO_FAMILY_ID, kind: 'mascota', species: 'perro', firstName: 'Toby', lastName: '',
    birthDate: '2015-05-02', relationship: '', parentIds: [],
    biography: 'Mestizo de mil razas. Llegó de la protectora y se quedó con el sofá.' },
  { id: 'pet-misi', channelId: DEMO_FAMILY_ID, kind: 'mascota', species: 'gato', firstName: 'Misi', lastName: '',
    birthDate: '2001-04-10', deathDate: '2018-11-03', relationship: '', parentIds: [],
    biography: 'La gata de la abuela Carmen. Dormía siempre encima de la tele.' },
];

/** The visitor's own card in the channels where Carlos isn't a person yet. */
const DEMO_VISITOR_PEOPLE: Person[] = [
  { id: 'p-alex', channelId: DEMO_FRIENDS_ID, firstName: 'Álex', lastName: 'Prieto', birthDate: '1982-09-19', gender: 'hombre',
    relationship: 'Amigo', biography: 'El que siempre lleva la cámara.', parentIds: [] },
  { id: 'p-carlos-primos', channelId: DEMO_COUSINS_ID, firstName: 'Carlos', lastName: 'Montero Sanz', birthDate: '1998-10-20',
    gender: 'hombre', relationship: 'Sobrino de Rosa', biography: 'Hijo de Elena, la hermana de Rosa.', parentIds: [] },
];

/** Who each demo member is in the tree (the visitor sees the family as Carlos). */
const DEMO_SELVES: Record<string, string> = {
  'u-elena': 'p-elena', 'u-luis': 'p-luis', 'u-marta': 'p-marta', 'u-javi': 'p-javi', 'u-rosa': 'p-rosa',
};

/**
 * Demo details for the tree: the late great-grandparents, everyone's gender
 * and who each member is, so kinship is shown relative to the visitor.
 */
export function addDemoPeopleDetails(db: Db, visitorId: string): void {
  if (db.channels.some((c) => c.id === DEMO_FAMILY_ID)) {
    for (const person of DEMO_ANCESTORS) if (!db.people.some((p) => p.id === person.id)) db.people.push({ ...person });
    const antonio = db.people.find((p) => p.id === 'p-antonio');
    if (antonio && antonio.parentIds.length === 0) antonio.parentIds = ['p-manuel', 'p-dolores'];
    if (!db.partnerships.some((c) => c.id === 'pt-manuel-dolores')) {
      db.partnerships.push({ id: 'pt-manuel-dolores', channelId: DEMO_FAMILY_ID, personIds: ['p-dolores', 'p-manuel'], since: '1938-05-14' });
    }
  }
  for (const person of db.people) {
    const gender = DEMO_GENDERS[person.id];
    if (gender && !person.gender) person.gender = gender;
  }
  for (const pet of DEMO_PETS) {
    if (db.channels.some((c) => c.id === pet.channelId) && !db.people.some((p) => p.id === pet.id)) db.people.push({ ...pet });
  }
  // The visitor is Carlos in the family channels and Álex among the friends.
  for (const person of DEMO_VISITOR_PEOPLE) {
    if (db.channels.some((c) => c.id === person.channelId) && !db.people.some((p) => p.id === person.id)) {
      db.people.push({ ...person });
    }
  }
  const visitorPerson: Record<string, string> = {
    [DEMO_FAMILY_ID]: 'p-carlos',
    [DEMO_FRIENDS_ID]: 'p-alex',
    [DEMO_COUSINS_ID]: 'p-carlos-primos',
  };
  for (const m of db.members) {
    const personId = m.userId === visitorId ? visitorPerson[m.channelId] : DEMO_SELVES[m.userId];
    if (personId && db.people.some((p) => p.id === personId && p.channelId === m.channelId)) m.personId = personId;
  }
}

const DEMO_PARENTS: Record<string, string[]> = {
  'p-luis': ['p-antonio', 'p-carmen'],
  'p-pilar': ['p-antonio', 'p-carmen'],
  'p-carlos': ['p-luis', 'p-elena'],
  'p-natalia': ['p-luis', 'p-elena'],
  'p-sofia': ['p-pilar', 'p-jorge'],
  'p-lucia': ['p-rosa', 'p-andres'],
};

/** Demo couples: [id, person, person, wedding date or the id of the anniversary event holding it]. */
const DEMO_COUPLES: [string, string, string, string][] = [
  ['pt-antonio-carmen', 'p-antonio', 'p-carmen', 'e-aniversario-abuelos'],
  ['pt-luis-elena', 'p-luis', 'p-elena', '1996-06-15'],
  ['pt-pilar-jorge', 'p-pilar', 'p-jorge', '2000-09-16'],
  ['pt-rosa-andres', 'p-andres', 'p-rosa', '2008-10-11'],
];

/**
 * Adds the demo family tree to the demo channels that exist: the extra
 * relatives, parents and couples. Only fills what is missing, so people the
 * user deleted or links they changed are respected (fresh demo + upgrades).
 */
export function addDemoFamilyTree(db: Db): void {
  const channels = new Set(db.channels.map((c) => c.id));
  const ids = new Set(db.people.map((p) => p.id));
  for (const person of DEMO_TREE_PEOPLE) {
    if (channels.has(person.channelId) && !ids.has(person.id)) {
      db.people.push({ ...person, parentIds: [] });
      ids.add(person.id);
    }
  }
  for (const person of db.people) {
    const parents = DEMO_PARENTS[person.id];
    if (parents && person.parentIds.length === 0) person.parentIds = parents.filter((id) => ids.has(id));
  }
  const existing = new Set(db.partnerships.map((c) => [...c.personIds].sort().join('+')));
  for (const [id, a, b, date] of DEMO_COUPLES) {
    const person = db.people.find((p) => p.id === a);
    if (!person || !ids.has(b) || existing.has([a, b].sort().join('+'))) continue;
    const since = date.startsWith('e-') ? db.events.find((e) => e.id === date)?.date : date;
    db.partnerships.push({
      id,
      channelId: person.channelId,
      personIds: [a, b].sort() as [string, string],
      ...(since ? { since } : {}),
    });
  }
}
