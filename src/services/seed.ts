import { SCHEMA_VERSION } from '../types/domain';
import type { FamilyEvent, Invitation, Member, Person, User, Video, VideoCategory, ViewRecord } from '../types/domain';
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
      personIds: [],
      notes: 'Cena sorpresa, como en los 30.',
    },
    {
      id: 'e-cumple-javi',
      channelId: DEMO_FRIENDS_ID,
      type: 'cumpleanos',
      title: 'Cumpleaños de Javi',
      date: '1982-04-02',
      personIds: [],
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
      personIds: [],
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
