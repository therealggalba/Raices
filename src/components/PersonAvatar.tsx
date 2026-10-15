import { useState } from 'react';
import type { Person } from '../types/domain';
import { fullName, initials } from '../utils/people';
import styles from './PersonAvatar.module.scss';

const HUES = [18, 38, 200, 280, 330, 160, 250];

export function PersonAvatar({ person, size = 56 }: { person: Person; size?: number }) {
  const [failed, setFailed] = useState(false);
  const name = fullName(person);
  const hue = HUES[(person.firstName.charCodeAt(0) || 0) % HUES.length];
  return (
    <span
      className={styles.avatar}
      style={{ width: size, height: size, fontSize: size * 0.38, background: `hsl(${hue} 45% 32%)` }}
      aria-hidden
    >
      {person.photoUrl && !failed ? (
        <img src={person.photoUrl} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        initials(name)
      )}
    </span>
  );
}
