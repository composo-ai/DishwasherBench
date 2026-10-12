/**
 * A level for this package's tests and scripts (not exported from the package entry point):
 * the owner's machine with a mixed set of real catalogue items, each carrying one plausible
 * soil, and generous budgets unless a test asks otherwise.
 */

import type { Level, LevelItem, LevelRules } from '@spotless/levels';
import { PRIMARY_MACHINE } from '@spotless/machine';

function many(
  prefix: string,
  count: number,
  itemType: string,
  soil: LevelItem['soils'][number],
): LevelItem[] {
  const out: LevelItem[] = [];
  for (let i = 1; i <= count; i++) {
    out.push({ id: `${prefix}_${String(i).padStart(2, '0')}`, itemType, points: 5, soils: [soil] });
  }
  return out;
}

/** The items of the test level. */
export function testItems(): LevelItem[] {
  const film = (type: string, region: string): LevelItem['soils'][number] => ({
    type,
    regions: [{ region, coverage: 0.5 }],
    amountG: 1,
    ageH: 2,
    heatHistory: 'none',
  });
  return [
    ...many('soup_plate', 6, 'soup_plate_porcelain_230', film('tomato_sauce', 'well')),
    ...many('dessert_plate', 6, 'dessert_plate_porcelain_190', film('jam', 'well')),
    ...many('dinner_plate', 2, 'dinner_plate_porcelain_270', film('gravy', 'well')),
    ...many('bowl', 3, 'cereal_bowl_porcelain_160', film('yoghurt', 'interior')),
    ...many('mug', 3, 'mug_ceramic_300', film('coffee', 'interior')),
    ...many('glass', 6, 'tumbler_360', film('milk_film', 'interior')),
    ...many('flute', 1, 'champagne_flute_170', film('sugar_syrup', 'interior')),
    ...many('fork', 6, 'dinner_fork_185', film('tomato_sauce', 'tines')),
    ...many('knife', 6, 'dinner_knife_210', film('butter_margarine', 'blade')),
    ...many('teaspoon', 6, 'teaspoon_130', film('coffee', 'bowl')),
    ...many('pan', 1, 'skillet_steel_270', film('lard_tallow', 'interior_base')),
    ...many('tray', 1, 'baking_tray_half_sheet', film('lard_tallow', 'interior')),
    ...many('pot', 1, 'stockpot_steel_8qt', film('tomato_sauce', 'interior_wall')),
  ];
}

/** The test level, with rules changed as asked. */
export function testLevel(rules: Partial<LevelRules> = {}, id = 'test-level'): Level {
  return {
    id,
    title: 'Test level',
    summary: "A mixed set of items on the owner's machine for the tests of the session.",
    machineId: PRIMARY_MACHINE.id,
    config: null,
    racks: {},
    programmeId: PRIMARY_MACHINE.primaryProgramme,
    items: testItems(),
    rules: {
      track: 'one_shot',
      actionsMax: 1000,
      queriesMax: 5000,
      washesMax: 1,
      mechanicalChecks: true,
      ...rules,
    },
    seed: 7,
    manual: null,
  };
}
