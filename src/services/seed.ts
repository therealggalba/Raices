import { SCHEMA_VERSION } from '../types/domain';
import type { FamilyEvent, Invitation, Member, Person, User, Video, VideoCategory } from '../types/domain';
import { addDays, sameDayInYear, toIsoDate } from '../utils/dates';
import { newId } from '../utils/ids';
import type { Db } from './localRepository';

// Demo data for the public MVP. Everyone in it is fictional. Some dates are
// computed relative to "today" so the event alerts always have something to
// show (e.g. "Cumpleaños de Carlos en 3 días", like the spec's example).
// Media are CC0 sample clips (MDN) and a public test clip, played as links.

export const DEMO_FAMILY_ID = 'demo-familia-montero';
export const DEMO_FRIENDS_ID = 'demo-amigos-uni';

const CLIPS = [
  'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
  'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4',
  'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4',
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
      mediaUrl: CLIPS[n % CLIPS.length],
      eventDate,
      uploadedAt: iso(90 - n * 5),
      durationSeconds: [94, 312, 187, 45, 620, 238][n % 6],
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
      recurring: true,
      personIds: ['p-antonio', 'p-carmen'],
      notes: 'Siempre comida en su casa. Llevar flores.',
    },
    {
      id: 'e-comunion-natalia',
      channelId: DEMO_FAMILY_ID,
      type: 'comunion',
      title: 'Comunión de Natalia',
      date: addDays(today, 7),
      recurring: false,
      personIds: ['p-natalia'],
      notes: 'Iglesia de San Juan a las 12:00. Comida en el restaurante El Olivo.',
    },
    {
      id: 'e-aniversario-padres',
      channelId: DEMO_FAMILY_ID,
      type: 'aniversario',
      title: 'Aniversario de Luis y Elena',
      date: '1996-06-15',
      recurring: true,
      personIds: ['p-luis', 'p-elena'],
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

  const friendsVideos: Video[] = [
    {
      id: 'v-demo-uni-1',
      channelId: DEMO_FRIENDS_ID,
      title: 'Viaje de fin de carrera',
      description: 'Praga, Viena y Budapest en tren. Cinco amigos y una sola maleta grande.',
      mediaUrl: CLIPS[0],
      eventDate: '2004-07',
      uploadedAt: iso(150),
      durationSeconds: 420,
      category: 'vacaciones',
      tags: ['interrail'],
      personIds: [],
      authorId: 'u-marta',
    },
    {
      id: 'v-demo-uni-2',
      channelId: DEMO_FRIENDS_ID,
      title: 'Cena de los 20 años',
      description: 'Reencuentro en el mismo bar de siempre, que sigue igual.',
      mediaUrl: CLIPS[1],
      eventDate: '2024-11',
      uploadedAt: iso(100),
      category: 'reunion',
      tags: [],
      personIds: [],
      authorId: 'u-marta',
    },
  ];

  return {
    schemaVersion: SCHEMA_VERSION,
    currentUserId: userId,
    users,
    channels: [
      {
        id: DEMO_FAMILY_ID,
        name: 'Familia Montero',
        description: 'Los recuerdos de tres generaciones: de las películas en Super 8 de los abuelos a los vídeos del móvil de Natalia.',
        createdAt: iso(120),
        createdBy: userId,
      },
      {
        id: DEMO_FRIENDS_ID,
        name: 'Amigos de la Universidad',
        description: 'Promoción 2000-2004. Viajes, cenas y reencuentros.',
        createdAt: iso(300),
        createdBy: 'u-marta',
      },
    ],
    members,
    people,
    videos: [...videos, ...friendsVideos],
    events,
    invitations,
    favorites: [
      { channelId: DEMO_FAMILY_ID, userId, videoId: 'v-demo-1' },
      { channelId: DEMO_FAMILY_ID, userId, videoId: 'v-demo-9' },
    ],
  };
}
