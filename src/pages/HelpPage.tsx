import { Accordion } from '../components/Accordion';
import type { AccordionPanel } from '../components/Accordion';
import { ui } from '../components/ui-styles';
import styles from './HelpPage.module.scss';

interface Topic {
  id: string;
  title: string;
  steps: string[];
  /** Extra advice under the steps. */
  note?: string;
  /** Only the channel's creator can do it. */
  creator?: boolean;
}

interface Group {
  title: string;
  topics: Topic[];
}

const GROUPS: Group[] = [
  {
    title: 'Empezar',
    topics: [
      {
        id: 'crear-canal',
        title: 'Crear un canal',
        steps: [
          'Abre el menú (tu inicial, arriba a la derecha) y toca «Crear canal».',
          'Ponle nombre, elige el tipo (familia, amigos…) y guarda.',
          'Serás su creador: lo gestionas tú y apruebas lo que suban los demás.',
          'Añade primero a las personas del canal (Personas › Añadir) y luego invítalas.',
        ],
      },
      {
        id: 'unirse',
        title: 'Unirte a un canal con un código',
        steps: [
          'Pide al creador del canal una invitación: es un código de 12 caracteres.',
          'Menú › «Unirme con código», escríbelo (da igual mayúsculas o guiones) y confirma tu nombre.',
          'Cada código sirve una sola vez, es para una persona concreta y caduca.',
        ],
      },
      {
        id: 'quien-eres',
        title: 'Decir quién eres en el canal',
        steps: [
          'Si tu invitación era para ti, ya entras enlazado a tu ficha.',
          'Si no, al entrar el canal te pide elegir tu ficha. Solo se elige una vez.',
          'Es importante: decide qué vídeos, cromos y fechas puedes subir y editar, y cómo se calcula el parentesco.',
        ],
        note: 'Si te equivocas, pide al creador del canal que lo corrija en Canal › Miembros.',
      },
      {
        id: 'roles',
        title: 'Creador, administradores y miembros',
        steps: [
          'Creador: gestiona el canal (invitaciones, personas, árbol, diseño, miembros) y aprueba lo que suben los demás.',
          'Administrador: sube vídeos y cromos de cualquier persona del canal.',
          'Miembro: sube vídeos y cromos en los que aparece.',
          'Todos corrigen su propia ficha y las fechas importantes en las que aparecen.',
        ],
        note: 'Lo que suben administradores y miembros queda pendiente hasta que el creador lo aprueba.',
      },
    ],
  },
  {
    title: 'Recuerdos',
    topics: [
      {
        id: 'subir-video',
        title: 'Subir un vídeo',
        steps: [
          'Entra en el canal y toca «+ Añadir» arriba.',
          'Pega el enlace del vídeo: Google Drive, YouTube (puede ser oculto), Vimeo o un enlace directo a un .mp4.',
          'Ponle título, cuándo ocurrió y marca las personas que aparecen (si eres miembro, tú tienes que estar).',
          'Opcional: una portada con «Cámara», «Galería» o «Del vídeo».',
          'Toca «Enviar para revisar» (o «Añadir vídeo» si eres el creador).',
        ],
        note: 'En Google Drive, comparte el vídeo como «Cualquier persona con el enlace» para que el resto pueda verlo.',
      },
      {
        id: 'subir-cromo',
        title: 'Añadir un cromo al álbum',
        steps: [
          'Ve a Álbumes, abre el del canal y toca «+ Añadir cromo».',
          'Haz o elige la foto y encuádrala (arrastra y pellizca).',
          'Elige la persona (si eres miembro, solo puedes elegirte a ti), el título y cuándo se hizo.',
          'La descripción es el recuerdo que se descubre al conseguir el cromo.',
        ],
        note: 'El cromo recibe su número del álbum cuando el creador lo aprueba.',
      },
      {
        id: 'sobres',
        title: 'Abrir sobres y completar el álbum',
        steps: [
          'Cada día tienes 3 sobres de 5 cromos, a repartir entre tus álbumes.',
          'Los cromos que aún no tienes salen borrosos; al conseguirlos ves la foto y su historia.',
          'Los repetidos se acumulan.',
        ],
      },
      {
        id: 'pendientes',
        title: 'Lo que espera aprobación',
        steps: [
          'Lo que subes aparece en el inicio del canal, en «Esperando aprobación», hasta que el creador lo revisa.',
          'Mientras tanto puedes editarlo o retirarlo.',
          'Si editas algo ya publicado, vuelve a revisión.',
        ],
      },
      {
        id: 'fechas',
        title: 'Fechas importantes y avisos',
        steps: [
          'En el canal, «Fechas» › «+ Añadir fecha»: cumpleaños, aniversarios, santos…',
          'Puedes añadir y editar las fechas en las que apareces tú.',
          'En la app de Android, cada fecha avisa ese día a la hora elegida por el creador del canal (Canal › Avisos de fechas).',
          '«Fechas» en el menú principal reúne las de todos tus canales, con filtros.',
        ],
      },
      {
        id: 'mi-ficha',
        title: 'Corregir tu ficha',
        steps: [
          'En Personas, abre tu ficha («Eres tú») y toca «Editar mis datos».',
          'Puedes cambiar tu nombre, foto, fecha de nacimiento y biografía.',
          'Los padres y parejas del árbol los gestiona el creador del canal.',
        ],
      },
    ],
  },
  {
    title: 'Para el creador del canal',
    topics: [
      {
        id: 'personas',
        title: 'Añadir personas y montar el árbol',
        creator: true,
        steps: [
          'Personas › «Añadir»: nombre, fechas, foto y, en canales de familia, sus padres y parejas.',
          'El árbol se dibuja solo a partir de esos vínculos (Personas › Árbol).',
          'Las mascotas tienen su propio apartado: tienen fechas y vídeos, pero no árbol.',
        ],
      },
      {
        id: 'invitar',
        title: 'Invitar a alguien',
        creator: true,
        steps: [
          'Canal › Invitaciones: elige para quién es y cuánto dura.',
          'Toca «Generar invitación» y compártela.',
          'Puedes revocar una invitación que aún no se haya usado.',
        ],
      },
      {
        id: 'revisar',
        title: 'Revisar lo que suben los demás',
        creator: true,
        steps: [
          'El inicio del canal muestra «Por revisar» con todo lo pendiente (y un aviso en «Vídeos»).',
          '«Aprobar» lo publica para todos; «Rechazar» lo borra.',
          'También puedes editarlo antes de aprobarlo.',
        ],
      },
      {
        id: 'gestionar',
        title: 'Gestionar el canal',
        creator: true,
        steps: [
          'Canal › Información y Diseño de los sobres: nombre, tipo, descripción y aspecto de los sobres.',
          'Canal › Miembros: quién es cada uno, hacer o quitar administradores, expulsar.',
          'Canal › Buzón: quién entra, quién sale y quién corrige su ficha.',
          'Canal › Ceder el canal: otra persona pasa a ser la creadora (tú sigues como administrador).',
          'Canal › Eliminar el canal: lo borra para todos, para siempre.',
        ],
        note: 'Para salir del canal o borrar tu cuenta, antes tienes que ceder tus canales.',
      },
    ],
  },
  {
    title: 'Tu cuenta',
    topics: [
      {
        id: 'sugerencias',
        title: 'Enviar una sugerencia',
        steps: ['Menú › «Enviar una sugerencia». Llega directamente a quien desarrolla Raíces.'],
      },
      {
        id: 'borrar-cuenta',
        title: 'Eliminar tu cuenta',
        steps: [
          'Menú › «Eliminar mi cuenta». Te enseña antes qué pasará con cada canal.',
          'Los canales en los que estás solo se borran; del resto sales, y lo que subiste se queda.',
        ],
      },
    ],
  },
];

/** How-tos, one open at a time, grouped by what people want to do. */
export function HelpPage() {
  return (
    <div className={ui.page}>
      <h1>Ayuda</h1>
      <p className={ui.muted}>Cómo se hace cada cosa en Raíces, paso a paso.</p>
      {GROUPS.map((group) => (
        <section key={group.title} className={styles.group}>
          <h2 className={styles.groupTitle}>{group.title}</h2>
          <Accordion
            panels={group.topics.map(
              (t): AccordionPanel => ({
                id: t.id,
                title: t.title,
                content: (
                  <>
                    {t.creator && <p className={styles.creator}>Solo el creador del canal</p>}
                    <ol className={styles.steps}>
                      {t.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                    {t.note && <p className={styles.note}>{t.note}</p>}
                  </>
                ),
              }),
            )}
          />
        </section>
      ))}
    </div>
  );
}
