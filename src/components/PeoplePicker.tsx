import type { Person } from '../types/domain';
import { sortPeople } from '../utils/people';
import { ui } from './ui-styles';

interface Props {
  people: readonly Person[];
  value: readonly string[];
  onChange(ids: string[]): void;
}

/** Toggleable chips to tag the people who appear in a video or event. */
export function PeoplePicker({ people, value, onChange }: Props) {
  if (!people.length) return <p className={ui.hint}>Todavía no hay personas en este canal.</p>;
  const selected = new Set(value);
  return (
    <div className={ui.chips} role="group" aria-label="Personas">
      {sortPeople(people).map((person) => {
        const active = selected.has(person.id);
        return (
          <button
            key={person.id}
            type="button"
            aria-pressed={active}
            className={[ui.chip, active ? ui.chipActive : ''].join(' ')}
            onClick={() => onChange(active ? value.filter((id) => id !== person.id) : [...value, person.id])}
          >
            {active ? '✓ ' : ''}
            {person.firstName}
          </button>
        );
      })}
    </div>
  );
}
