import { useAuth } from '../auth/auth-context';
import { Button, LinkButton } from '../components/ui';
import { ui } from '../components/ui-styles';
import styles from './AboutPage.module.scss';

interface Feature {
  title: string;
  text: string;
  /** Where to see it in the demo. */
  to?: string;
}

const FEATURES: Feature[] = [
  {
    title: 'Canales privados',
    text: 'Cada familia o grupo de amigos tiene su canal. Solo entra quien recibe una invitación: un código de un solo uso que caduca. Dentro, los administradores añaden contenido y el resto disfruta de él.',
  },
  {
    title: 'Vídeos como en una plataforma',
    text: 'Los vídeos de toda la vida, organizados en filas: añadidos recientemente, lo más visto, recuerdos del mes, favoritos… Se enlazan desde Google Drive o YouTube, se ven a pantalla completa y la app recuerda por dónde ibas.',
    to: '/',
  },
  {
    title: 'Catálogo con filtros',
    text: 'Busca por canal, persona, tipo de evento (bodas, cumpleaños, Navidad…) o década. ¿Todos los vídeos de la abuela en los 90? Dos toques.',
    to: '/catalogo',
  },
  {
    title: 'Fechas que no se olvidan',
    text: 'Cumpleaños, aniversarios, bodas… se repiten cada año y la app calcula cuántos se cumplen. El día señalado avisa con un mensaje y una notificación en el móvil.',
    to: '/fechas',
  },
  {
    title: 'Personas y árbol familiar',
    text: 'Cada persona tiene su ficha (biografía, fechas, vídeos en los que aparece) y el árbol genealógico se dibuja solo a partir de padres y parejas.',
  },
  {
    title: 'Álbum de cromos',
    text: 'Las fotos de la familia se convierten en cromos coleccionables. Cada día hay 3 sobres de 5 cromos: los que aún no tienes salen borrosos hasta que te tocan, y los repetidos se acumulan.',
    to: '/albumes',
  },
  {
    title: 'App para el móvil',
    text: 'Funciona en el navegador y como app de Android, pensada para usarse con una mano en vertical.',
  },
];

const AUDIENCE = [
  'Familias que quieren reunir los vídeos y fotos que hoy están repartidos en móviles, discos duros y cintas digitalizadas.',
  'Abuelos, padres y nietos que quieren revivir momentos juntos (y que los más pequeños conozcan su historia).',
  'Grupos de amigos que guardan sus viajes, despedidas o reuniones en un sitio privado.',
];

const USE_CASES = [
  'Digitalizar las cintas de vídeo de la familia y ponerlas a disposición de todos, ordenadas por año y evento.',
  'Recibir un aviso el día del cumpleaños de la abuela con el vídeo de su 80 cumpleaños a un toque.',
  'Coleccionar entre primos el álbum de cromos de la familia, abriendo sobres cada día.',
  'Consultar el árbol para explicar a los niños quién era quién en las fotos antiguas.',
];

/** «Saber más» (demo only): what FamilyMemories is, for whom and what it can do. */
export function AboutPage() {
  const { configured, leaveDemo } = useAuth();
  return (
    <div className={ui.page}>
      <header className={styles.hero}>
        <p className={styles.kicker}>Saber más</p>
        <h1 className={styles.title}>Los recuerdos de tu familia, en un solo sitio</h1>
        <p className={styles.lead}>
          FamilyMemories es un espacio privado para guardar, ver y celebrar los recuerdos de una familia o un grupo: vídeos,
          fechas importantes, personas y un álbum de cromos con sus fotos.
        </p>
      </header>

      <section className={styles.section}>
        <h2>Qué se puede hacer</h2>
        <ul className={styles.features}>
          {FEATURES.map((f) => (
            <li key={f.title} className={styles.feature}>
              <div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
                {f.to && (
                  <LinkButton to={f.to} variant="ghost" small>
                    Verlo en la demo
                  </LinkButton>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h2>¿Para quién es?</h2>
        <ul className={styles.list}>
          {AUDIENCE.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h2>Algunos casos de uso</h2>
        <ul className={styles.list}>
          {USE_CASES.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>

      <section className={[styles.section, styles.privacy].join(' ')}>
        <h2>Privado de verdad</h2>
        <p>
          Nada es público: cada canal solo lo ven sus miembros, las fotos de los cromos bloqueados no se pueden descargar
          y cada persona entra con su usuario y contraseña.
        </p>
        <p className={ui.muted}>
          Esta demo usa una familia ficticia y es solo para mirar: no se puede añadir ni cambiar nada.
        </p>
        {configured && (
          <Button variant="primary" onClick={leaveDemo}>
            Crear una cuenta
          </Button>
        )}
      </section>
    </div>
  );
}
