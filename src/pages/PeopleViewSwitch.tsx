import { Link } from 'react-router-dom';
import styles from './PeopleViewSwitch.module.scss';

/** «Lista | Árbol» toggle of family channels' people. */
export function PeopleViewSwitch({ channelId, active }: { channelId: string; active: 'lista' | 'arbol' }) {
  return (
    <nav className={styles.switch} aria-label="Vista de personas">
      <Link to={`/c/${channelId}/personas`} aria-current={active === 'lista' ? 'page' : undefined}>
        Lista
      </Link>
      <Link to={`/c/${channelId}/arbol`} aria-current={active === 'arbol' ? 'page' : undefined}>
        Árbol
      </Link>
    </nav>
  );
}
