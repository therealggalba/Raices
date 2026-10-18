import { describe, expect, it } from 'vitest';
import type { Gender, Partnership, Person } from '../types/domain';
import { capitalize, kinship } from '../utils/kinship';

const p = (id: string, gender: Gender | undefined, parentIds: string[] = []): Person => ({
  id,
  channelId: 'c',
  firstName: id,
  lastName: '',
  relationship: '',
  biography: '',
  parentIds,
  ...(gender ? { gender } : {}),
});
const couple = (a: string, b: string, extra: Partial<Partnership> = {}): Partnership => ({
  id: `${a}+${b}`,
  channelId: 'c',
  personIds: [a, b],
  since: '1970-01-01',
  ...extra,
});

//            bisabuelo
//                |
//   abuelo ♥ abuela
//      ______|_____________
//     |                    |
//   padre ♥ madre      tia ♥ tioPol      (madre married in; tioPol married in)
//     |  ______           |
//    yo ♥ esposa  hermana  prima
//    |                |
//   hijo ♥ nuera     sobrino
//                    |
//    consuegro -> nuera's father
const people: Person[] = [
  p('bisabuelo', 'hombre'),
  p('abuelo', 'hombre', ['bisabuelo']),
  p('abuela', 'mujer'),
  p('padre', 'hombre', ['abuelo', 'abuela']),
  p('madre', 'mujer'),
  p('tia', 'mujer', ['abuelo', 'abuela']),
  p('tioPol', 'hombre'),
  p('yo', 'hombre', ['padre', 'madre']),
  p('hermana', 'mujer', ['padre', 'madre']),
  p('prima', 'mujer', ['tia', 'tioPol']),
  p('esposa', 'mujer', ['suegro']),
  p('suegro', 'hombre'),
  p('cunado', 'hombre', ['suegro']),
  p('hijo', 'hombre', ['yo', 'esposa']),
  p('nuera', 'mujer', ['consuegro']),
  p('consuegro', 'hombre'),
  p('sobrino', undefined, ['hermana']),
  p('tioAbuelo', 'hombre', ['bisabuelo']),
];
const couples = [
  couple('abuelo', 'abuela'),
  couple('padre', 'madre'),
  couple('tia', 'tioPol'),
  couple('yo', 'esposa'),
  couple('hijo', 'nuera'),
];
const k = (target: string, viewer = 'yo') => kinship(viewer, target, people, couples);

describe('kinship', () => {
  it('names blood relatives', () => {
    expect(k('yo')).toBe('Yo');
    expect(k('padre')).toBe('padre');
    expect(k('madre')).toBe('madre');
    expect(k('abuela')).toBe('abuela');
    expect(k('bisabuelo')).toBe('bisabuelo');
    expect(k('hermana')).toBe('hermana');
    expect(k('tia')).toBe('tía');
    expect(k('tioAbuelo')).toBe('tío abuelo');
    expect(k('prima')).toBe('prima');
    expect(k('hijo')).toBe('hijo');
    expect(k('sobrino')).toBe('sobrino/a');
  });

  it('changes with the viewer (tío and Yo instead of Yo and sobrina)', () => {
    expect(k('yo', 'sobrino')).toBe('tío');
    expect(k('hermana', 'prima')).toBe('prima');
    expect(k('abuelo', 'hijo')).toBe('bisabuelo');
  });

  it('names relatives by marriage', () => {
    expect(k('esposa')).toBe('mujer');
    expect(k('tioPol')).toBe('tío político');
    expect(k('suegro')).toBe('suegro');
    expect(k('cunado')).toBe('cuñado');
    expect(k('nuera')).toBe('nuera');
    expect(k('consuegro')).toBe('consuegro');
    expect(k('yo', 'suegro')).toBe('yerno');
  });

  it('marks separated couples and unknown links', () => {
    const separated = [couple('yo', 'esposa', { until: '2010-01-01' })];
    expect(kinship('yo', 'esposa', people, separated)).toBe('expareja');
    expect(kinship('yo', 'nadie', people, couples)).toBeNull();
    expect(kinship('yo', 'consuegro', people, [])).toBeNull();
  });

  it('capitalizes labels', () => {
    expect(capitalize('tío abuelo')).toBe('Tío abuelo');
  });
});
