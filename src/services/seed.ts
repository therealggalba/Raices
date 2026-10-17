import { SCHEMA_VERSION } from '../types/domain';
import type {
  AlbumCard,
  FamilyEvent,
  Invitation,
  Member,
  Person,
  Rarity,
  User,
  Video,
  VideoCategory,
  ViewRecord,
} from '../types/domain';
import { addDays, sameDayInYear, toIsoDate } from '../utils/dates';
import { newId } from '../utils/ids';
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

  const person = (id: string, p: Omit<Person, 'id' | 'channelId' | 'notes'> & { notes?: string }): Person => ({
    id,
    channelId: DEMO_FAMILY_ID,
    notes: '',
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
      relationship: 'Amiga', biography: 'Delegada de clase y organizadora oficial de todas las cenas.', notes: '' },
    { id: 'p-javi', channelId: DEMO_FRIENDS_ID, firstName: 'Javi', lastName: 'Ortega', birthDate: '1982-04-02',
      relationship: 'Amigo', biography: 'El de la fuente. Ahora es serio (a ratos).', notes: '' },
    { id: 'p-rosa', channelId: DEMO_COUSINS_ID, firstName: 'Rosa', lastName: 'Sanz Pardo', birthDate: '1975-05-12',
      relationship: 'Prima', biography: 'Hermana pequeña de Elena. Guardiana de las fotos del pueblo.', notes: '' },
    { id: 'p-andres', channelId: DEMO_COUSINS_ID, firstName: 'Andrés', lastName: 'Vidal', birthDate: '1973-02-08',
      relationship: 'Primo político', biography: 'Pescador de río y cocinero de fabada.', notes: '' },
    { id: 'p-lucia', channelId: DEMO_COUSINS_ID, firstName: 'Lucía', lastName: 'Vidal Sanz', birthDate: '2001-01-15',
      relationship: 'Prima', biography: 'Hija de Rosa y Andrés.', notes: '' },
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

  // Album: free stock photos (picsum.photos), greyscale for the old ones.
  const photo = (seed: string, year: number) =>
    `https://picsum.photos/seed/fm-${seed}/600/800${year < 1990 ? '?grayscale' : ''}`;
  const cardsPlan: [string, string | undefined, string, string, Rarity, string][] = [
    // channel, person, title, takenAt, rarity, description
    [DEMO_FAMILY_ID, 'p-antonio', 'La mili en Melilla', '1961', 'epico', 'Con el uniforme recién estrenado y cara de no haber dormido.'],
    [DEMO_FAMILY_ID, 'p-antonio', 'Con su primera silla', '1968-05', 'comun', 'La primera silla del taller. Sigue en el salón.'],
    [DEMO_FAMILY_ID, 'p-antonio', 'El taller de carpintería', '1975', 'raro', 'Serrín hasta las cejas.'],
    [DEMO_FAMILY_ID, 'p-carmen', 'Primer día de maestra', '1965-09', 'raro', 'Escuela unitaria de Santo Tomé.'],
    [DEMO_FAMILY_ID, 'p-carmen', 'La boda', '1966-10', 'legendario', 'Antonio y Carmen a la salida de Santa María.'],
    [DEMO_FAMILY_ID, 'p-carmen', 'La tortilla del siglo', '1990', 'comun', 'Doce huevos y ni una sobra.'],
    [DEMO_FAMILY_ID, 'p-luis', 'Con la videocámara nueva', '1990-12', 'poco-comun', 'El origen de todos los vídeos de este canal.'],
    [DEMO_FAMILY_ID, 'p-luis', 'Graduación', '1993-06', 'raro', ''],
    [DEMO_FAMILY_ID, 'p-elena', 'Uniforme de enfermera', '1995', 'comun', 'Primer día en el hospital.'],
    [DEMO_FAMILY_ID, 'p-elena', 'Los 40', '2011-11-04', 'poco-comun', 'Fiesta sorpresa (que no fue tan sorpresa).'],
    [DEMO_FAMILY_ID, 'p-carlos', 'Bañándome', '1999-07', 'poco-comun', 'La palangana del patio de los abuelos.'],
    [DEMO_FAMILY_ID, 'p-carlos', 'Disfrazado de pirata', '2001-02', 'comun', 'Carnaval del colegio.'],
    [DEMO_FAMILY_ID, 'p-carlos', 'Tocando la batería', '2013-12', 'comun', 'Primer ensayo con el grupo.'],
    [DEMO_FAMILY_ID, 'p-carlos', 'Selfie perruno', '2016-06', 'raro', 'Con Toby, el perro de los vecinos.'],
    [DEMO_FAMILY_ID, 'p-carlos', 'Graduación', '2020-06', 'epico', 'Ingeniero, por fin.'],
    [DEMO_FAMILY_ID, 'p-natalia', 'Primeros pasos', '2018-03', 'epico', 'Del sofá a la mesa, sin manos.'],
    [DEMO_FAMILY_ID, 'p-natalia', 'Disfraz de astronauta', '2023-02', 'comun', ''],
    [DEMO_FAMILY_ID, 'p-natalia', 'Sin el primer diente', '2023-09', 'poco-comun', 'El Ratoncito Pérez pagó dos euros.'],
    [DEMO_FRIENDS_ID, 'p-marta', 'Orla de la facultad', '2004-06', 'raro', ''],
    [DEMO_FRIENDS_ID, 'p-marta', 'En el tranvía 28', '2019-10', 'comun', 'Escapada a Lisboa.'],
    [DEMO_FRIENDS_ID, 'p-javi', 'La fuente', '2002-04', 'legendario', 'La foto que Javi intentó destruir.'],
    [DEMO_FRIENDS_ID, 'p-javi', 'El novio', '2015-09', 'epico', 'Boda con Laura.'],
    [DEMO_FRIENDS_ID, undefined, 'La pandilla al completo', '2004-07', 'raro', 'Estación de Praga, viaje de fin de carrera.'],
    [DEMO_COUSINS_ID, 'p-rosa', 'Verano en Asturias', '2001-08', 'comun', ''],
    [DEMO_COUSINS_ID, 'p-rosa', 'Novia en el monasterio', '2008-10-11', 'legendario', 'Llovió, pero dio igual.'],
    [DEMO_COUSINS_ID, 'p-andres', 'Pescando en el río', '2001-08', 'poco-comun', 'Tres truchas. Según él, cinco.'],
    [DEMO_COUSINS_ID, 'p-lucia', 'Primer día de cole', '2005-09', 'comun', ''],
    [DEMO_COUSINS_ID, 'p-lucia', 'Comunión', '2010-05', 'raro', 'El vestido con lazo azul.'],
  ];
  const numbers = new Map<string, number>();
  const cards: AlbumCard[] = cardsPlan.map(([channelId, personId, title, takenAt, rarity, description], i) => {
    const number = (numbers.get(channelId) ?? 0) + 1;
    numbers.set(channelId, number);
    const year = Number(takenAt.slice(0, 4));
    return {
      id: `c-demo-${i + 1}`,
      channelId,
      number,
      ...(personId ? { personId } : {}),
      title,
      description,
      imageUrl: title === 'Selfie perruno' ? 'https://picsum.photos/id/1025/600/800' : photo(String(i + 1), year),
      takenAt,
      rarity,
      createdAt: iso(60 - i),
      authorId: userId,
    };
  });

  return {
    schemaVersion: SCHEMA_VERSION,
    currentUserId: userId,
    users,
    channels: [
      {
        id: DEMO_FAMILY_ID,
        name: 'Familia Montero',
        description: 'Los recuerdos de tres generaciones: de las películas en Super 8 de los abuelos a los vídeos del móvil de Natalia.',
        kind: 'familia',
        createdAt: iso(120),
        createdBy: userId,
      },
      {
        id: DEMO_FRIENDS_ID,
        name: 'Amigos de la Universidad',
        description: 'Promoción 2000-2004. Viajes, cenas y reencuentros.',
        kind: 'amigos',
        createdAt: iso(300),
        createdBy: 'u-marta',
      },
      {
        id: DEMO_COUSINS_ID,
        name: 'Primos Sanz',
        description: 'La rama de la familia de Elena: veranos en Asturias y Nocheviejas en el pueblo.',
        kind: 'familia',
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
