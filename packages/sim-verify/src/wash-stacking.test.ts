// End-to-end: how items are stacked decides how well they are cleaned (docs/design/scope.md,
// "What links stacking to cleaning"). One wash of the owner's machine (Bosch SMV4HAX40G, Auto
// 45-65) at the fast tier with the real exposure, holding two comparisons:
//
//  - two plates in adjacent slots facing the same way, against two facing each other. The two
//    pairs stand at positions that a half turn about the axis of the lower arm maps on to each
//    other, so the arm treats them alike; in the second pair the plate nearer the wall is
//    turned round, so that the eating faces of the pair look at each other and the turned
//    plate shows its back to the jets;
//  - a bowl nested in another bowl, against the same bowl alone. All three are upside down on
//    the floor of the upper basket; the nested bowl sits 12 mm above the one under it, whose
//    outside covers its inside.
//
// The poses (tub frame: origin on the lower-arm axis at tub-floor level, x right, y back, z
// up; millimetres; quaternions as (w, x, y, z)). Plates in the lower basket, 27 mm apart
// (one slot), leaning 20 degrees:
//
//  same_front     (-120, -130, 172)  eating face towards the door and 20 degrees down
//  same_back      (-120, -103, 172)  the same, one slot behind
//  opposed_front  ( 120,  145, 172)  the half-turn image of same_front, turned round (eating
//                                    face towards the door and 20 degrees up) and 15 mm further
//                                    back: at one slot the two rims would cut 2 mm into each other
//  opposed_back   ( 120,  103, 172)  the half-turn image of same_back
//  bowl_alone     (-110,   70, 473)  inverted
//  bowl_under     ( 110,   70, 473)  inverted
//  bowl_covered   ( 110,   70, 485)  inverted, over bowl_under
//
// Nothing is settled with the loading physics: the items stand where they are put.
import { appendFileSync } from 'node:fs';
import {
  wash,
  washInputFromDescription,
  type ItemWashResult,
  type WashDescription,
  type WashResult,
} from '@spotless/sim-core';
import { beforeAll, describe, expect, it } from 'vitest';

/** With SPOTLESS_E2E_DUMP=<file> set, the washes of this file append their numbers to it. */
const DUMP = process.env['SPOTLESS_E2E_DUMP'];
function dump(...values: unknown[]): void {
  if (DUMP === undefined) return;
  appendFileSync(
    DUMP,
    `${values.map((v) => (typeof v === 'string' ? v : JSON.stringify(v))).join(' ')}\n`,
  );
}

// Baked-on tomato sauce (it comes off where a jet, or a thick stream, stresses it) and dried
// egg yolk (it comes off wherever it is kept wet with active protease).
const SOILS = (region: string) => [
  {
    type: 'tomato_sauce',
    regions: [{ region, coverage: 0.6 }],
    amount_g: 2,
    age_h: 2,
    heat_history: 'baked' as const,
  },
  { type: 'egg_yolk_dried', regions: [{ region, coverage: 0.3 }], amount_g: 0.5, age_h: 2 },
];

const FACING: [number, number, number, number] = [0.5736, 0.8192, 0, 0];
// FACING after a half turn about the vertical, and the same plate turned round in its slot.
const FACING_HALF_TURN: [number, number, number, number] = [0, 0, 0.8192, 0.5736];
const TURNED_HALF_TURN: [number, number, number, number] = [0, 0, -0.5736, 0.8192];

const description: WashDescription = {
  machine: 'bosch_smv4hax40g',
  programme: 'auto_145',
  tier: 'fast',
  levelSeed: 7,
  simSeed: 3,
  items: [
    {
      id: 'same_front',
      type: 'dessert_plate_porcelain_190',
      position_mm: [-120, -130, 172],
      quat_wxyz: FACING,
      soils: SOILS('well'),
    },
    {
      id: 'same_back',
      type: 'dessert_plate_porcelain_190',
      position_mm: [-120, -103, 172],
      quat_wxyz: FACING,
      soils: SOILS('well'),
    },
    {
      id: 'opposed_front',
      type: 'dessert_plate_porcelain_190',
      position_mm: [120, 145, 172],
      quat_wxyz: TURNED_HALF_TURN,
      soils: SOILS('well'),
    },
    {
      id: 'opposed_back',
      type: 'dessert_plate_porcelain_190',
      position_mm: [120, 103, 172],
      quat_wxyz: FACING_HALF_TURN,
      soils: SOILS('well'),
    },
    {
      id: 'bowl_alone',
      type: 'cereal_bowl_vitrelle_159',
      position_mm: [-110, 70, 473],
      orientation: 'inverted',
      soils: SOILS('interior'),
    },
    {
      id: 'bowl_under',
      type: 'cereal_bowl_vitrelle_159',
      position_mm: [110, 70, 473],
      orientation: 'inverted',
      soils: SOILS('interior'),
    },
    {
      id: 'bowl_covered',
      type: 'cereal_bowl_vitrelle_159',
      position_mm: [110, 70, 485],
      orientation: 'inverted',
      soils: SOILS('interior'),
    },
  ],
};

/**
 * The baked sauce of these tests is a probe of where the jets strike: its bond is taken as it
 * was measured in cold water (soils 8.2), which only a jet breaks. With the registered fall of
 * the bond in warm liquor (`soil.adhesionHotFactor`, soils 2.4: 90 % weaker at 50 C) a film
 * takes the sauce off wherever it runs in the main wash and the probe would show nothing of
 * what these tests are about: that what the water side sees of a load reaches the result.
 */
const COLD_BOND = { 'soil.adhesionHotFactor': 1 } as const;

let result: WashResult;

beforeAll(async () => {
  result = await wash(washInputFromDescription({ ...description, params: COLD_BOND }), {
    keepScene: false,
  });
  if (DUMP !== undefined) {
    dump(result.run, result.problems);
    for (const i of result.items)
      dump(
        i.itemId,
        i.clean,
        i.visibleAreaMm2,
        i.water,
        i.soils
          .map((x) => `${x.type} ${x.residualMass_mg.toFixed(1)}/${x.initialMass_mg.toFixed(0)}`)
          .join('; '),
      );
  }
});

function item(id: string): ItemWashResult {
  const found = result.items.find((i) => i.itemId === id);
  if (found === undefined) throw new Error(`no item ${id}`);
  return found;
}

function soilOf(id: string, type: string): { initial: number; residual: number } {
  const found = item(id).soils.find((s) => s.type === type);
  if (found === undefined) throw new Error(`no ${type} on ${id}`);
  return { initial: found.initialMass_mg, residual: found.residualMass_mg };
}

describe('the wash of the stacking comparisons', () => {
  it('runs with the real exposure and places every item', () => {
    expect(result.provenance.exposureStandIn).toBe(false);
    expect(result.problems).toEqual([]);
    expect(result.items).toHaveLength(7);
    for (const state of result.machine.states) {
      expect(state.exposure.water?.closes, state.id).toBe(true);
      expect(state.exposure.film?.converged, state.id).toBe(true);
    }
    // Every item starts with the same soil.
    for (const each of result.items) {
      expect(each.initialMass_mg).toBeCloseTo(item('same_front').initialMass_mg, 4);
    }
  });
});

describe('two plates facing the same way against two facing each other', () => {
  it('cleans both plates of the pair that faces the jets', () => {
    for (const id of ['same_front', 'same_back']) {
      const sauce = soilOf(id, 'tomato_sauce');
      expect(sauce.residual, id).toBeLessThan(0.4 * sauce.initial);
    }
  });

  it('leaves the sauce on the plate that is turned round', () => {
    const turned = soilOf('opposed_front', 'tomato_sauce');
    const twin = soilOf('same_front', 'tomato_sauce');
    // Its eating face looks up and away from the arm: only the fans of jets that strike its
    // rim, and the run-off, reach the sauce.
    expect(turned.residual).toBeGreaterThan(0.6 * turned.initial);
    expect(turned.residual).toBeGreaterThan(2 * twin.residual);
    // The plate that faces it is no worse off than its twin by more than a half.
    const partner = soilOf('opposed_back', 'tomato_sauce');
    expect(partner.residual).toBeLessThan(0.5 * partner.initial);
  });

  it('leaves more soil, and more visibly soiled area, on the pair that faces each other', () => {
    const same = item('same_front').residualMass_mg + item('same_back').residualMass_mg;
    const opposed = item('opposed_front').residualMass_mg + item('opposed_back').residualMass_mg;
    expect(opposed).toBeGreaterThan(1.3 * same);
    expect(
      item('opposed_front').visibleAreaMm2 + item('opposed_back').visibleAreaMm2,
    ).toBeGreaterThan(item('same_front').visibleAreaMm2 + item('same_back').visibleAreaMm2);
    // The egg yolk needs to be kept wet with fresh liquor more than it needs jets (soils 3.6:
    // the jet term is a few per cent at dishwasher duty), so the plate turned round keeps at
    // least as much of it as its twin, and at most a quarter more. `soil.jetPassGain` is the
    // calibration hook that widens this (wash-nesting.test.ts).
    const turnedEgg = soilOf('opposed_front', 'egg_yolk_dried').residual;
    const twinEgg = soilOf('same_front', 'egg_yolk_dried').residual;
    expect(turnedEgg).toBeGreaterThanOrEqual(twinEgg);
    expect(turnedEgg).toBeLessThan(1.25 * twinEgg);
  });
});

describe('a bowl nested in another bowl against the same bowl alone', () => {
  it('strips the sauce from the open bowls, where the jets of the upper arm strike', () => {
    for (const id of ['bowl_alone', 'bowl_under']) {
      const sauce = soilOf(id, 'tomato_sauce');
      expect(sauce.residual, id).toBeLessThan(0.1 * sauce.initial);
    }
    // The bowl under another is as open to the upper arm as the bowl alone.
    expect(
      soilOf('bowl_under', 'egg_yolk_dried').residual /
        soilOf('bowl_alone', 'egg_yolk_dried').residual,
    ).toBeGreaterThan(0.8);
    expect(
      soilOf('bowl_under', 'egg_yolk_dried').residual /
        soilOf('bowl_alone', 'egg_yolk_dried').residual,
    ).toBeLessThan(1.25);
  });

  it('leaves the sauce in the bowl whose inside another bowl covers', () => {
    const covered = soilOf('bowl_covered', 'tomato_sauce');
    expect(covered.residual).toBeGreaterThan(0.8 * covered.initial);
    expect(covered.residual).toBeGreaterThan(20 * soilOf('bowl_alone', 'tomato_sauce').residual);
    // Less water reaches its inside, so the egg yolk comes off more slowly too.
    expect(soilOf('bowl_covered', 'egg_yolk_dried').residual).toBeGreaterThan(
      1.15 * soilOf('bowl_alone', 'egg_yolk_dried').residual,
    );
    expect(item('bowl_covered').visibleAreaMm2).toBeGreaterThan(
      1.5 * item('bowl_alone').visibleAreaMm2,
    );
    expect(item('bowl_covered').residualMass_mg).toBeGreaterThan(
      2 * item('bowl_alone').residualMass_mg,
    );
  });

  it('shows the jets pushing on the open bowls and not on the covered one', () => {
    const upper = result.machine.states.find((s) => s.id === 'ur@3000');
    const loads = upper?.exposure.itemLoads ?? [];
    const up = (id: string): number => loads.find((l) => l.itemId === id)?.peakUp ?? 0;
    // A few tenths of a newton on a 180 g bowl: a quarter of its weight.
    expect(up('bowl_alone')).toBeGreaterThan(0.2);
    expect(up('bowl_alone')).toBeLessThan(1.5);
    expect(up('bowl_under')).toBeGreaterThan(0.2);
    expect(up('bowl_covered')).toBeLessThan(0.1 * up('bowl_alone'));
  });
});
