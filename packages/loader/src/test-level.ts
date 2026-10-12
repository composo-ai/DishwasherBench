/**
 * Small levels for the tests of this package: a handful of clean items that fit easily, on the
 * owner's machine with its Auto programme.
 */

import type { Level, LevelItem } from '@spotless/levels';
import { PRIMARY_MACHINE } from '@spotless/machine';
import { standardRules } from './standard-levels.ts';

function clean(prefix: string, count: number, itemType: string): LevelItem[] {
  const out: LevelItem[] = [];
  for (let i = 1; i <= count; i++) {
    out.push({ id: `${prefix}_${String(i).padStart(2, '0')}`, itemType, points: 5, soils: [] });
  }
  return out;
}

function level(id: string, items: LevelItem[]): Level {
  return {
    id,
    title: `${items.length} items`,
    summary: 'Clean items for the tests of the loader.',
    machineId: PRIMARY_MACHINE.id,
    config: null,
    racks: {},
    programmeId: PRIMARY_MACHINE.primaryProgramme,
    items,
    rules: standardRules(items.length),
    seed: 7,
    manual: null,
  };
}

/** Ten clean items: three plates, two cups, two glasses, a fork, a knife and a spoon. */
export function tenItemLevel(): Level {
  return level('loader-test-ten', [
    ...clean('plate', 3, 'dessert_plate_porcelain_190'),
    ...clean('cup', 2, 'tea_cup_porcelain_210'),
    ...clean('glass', 2, 'test_glass_borosilicate_250'),
    ...clean('fork', 1, 'dinner_fork_185'),
    ...clean('knife', 1, 'dinner_knife_210'),
    ...clean('spoon', 1, 'dessert_spoon_160'),
  ]);
}

/** Five clean items, for tests that play a level several times. */
export function fiveItemLevel(): Level {
  return level('loader-test-five', [
    ...clean('plate', 2, 'dessert_plate_porcelain_190'),
    ...clean('cup', 2, 'tea_cup_porcelain_210'),
    ...clean('fork', 1, 'dinner_fork_185'),
  ]);
}
