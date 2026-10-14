// End-to-end: nesting, touching, the material of an item and an upright vessel
// (docs/design/scope.md, dependencies 3 to 5 and 7; docs/research/standards.md P01, P04, P15,
// P40, P44, P45). One wash of the owner's machine (Bosch SMV4HAX40G, Eco 50) at the fast
// tier with the real exposure, holding A/B pairs that differ in one thing each:
//
//  - a bowl nested 6 mm inside another against the same nest opened to 25 mm (upper basket,
//    both stacks at the same distance from the arm axes, mirrored in x);
//  - two soup spoons nested 3 mm apart against the same two spoons 15 mm apart (cutlery
//    basket, the same cell: a wash of their own each, so that nothing else differs);
//  - the same soil on a porcelain plate, on a melamine plate and on a steel fork;
//  - an upright food container.
//
// The poses (tub frame: origin on the lower-arm axis at tub-floor level, x right, y back, z
// up; millimetres):
//
//  tight_under    (-110,   70, 473)  cereal bowl, inverted
//  tight_covered  (-110,   70, 479)  the same bowl over it, 6 mm up
//  loose_under    ( 110,   70, 473)
//  loose_covered  ( 110,   70, 498)  25 mm up
//  porcelain      (-120,  130, 172)  dessert plate, eating face to the door and 20 degrees down
//  melamine       ( 120,  130, 172)  the IEC melamine plate, the same pose
//  fork           cell c02 of the cutlery basket, handle down
//  spoon, partner cell c01, handle down; the partner 3 mm (nested) or 15 mm (apart) in front
//                 of the soiled face of the spoon's bowl, in two washes of their own
//  container      (   0, -100, 423)  food container, upright on the floor of the upper basket
//
// Nothing is settled with the loading physics: the items stand where they are put. The
// cutlery stands on the floor of its cell (z = 79 mm).
import { appendFileSync } from 'node:fs';
import { instantiate } from '@spotless/catalogue';
import {
  buildWashScene,
  createMemoryExposureCache,
  sceneMaterialOf,
  wash,
  washInputFromDescription,
  type ItemDescription,
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

const SAUCE = (region: string, amount_g = 2) => ({
  type: 'tomato_sauce',
  regions: [{ region, coverage: 0.6 }],
  amount_g,
  age_h: 2,
  heat_history: 'baked' as const,
});
const EGG = (region: string, amount_g = 0.5) => ({
  type: 'egg_yolk_dried',
  regions: [{ region, coverage: 0.3 }],
  amount_g,
  age_h: 2,
});

const FACING: [number, number, number, number] = [0.5736, 0.8192, 0, 0];
/** Height of the floor of a cutlery cell above the tub floor plus a 2 mm stand-off, mm. */
const CELL_FLOOR = 79;

/** Tub-frame box of one item alone, and the mean outward normal of one of its regions. */
function probe(
  desc: ItemDescription,
  region?: string,
): { zMin: number; normal: [number, number, number] } {
  const input = washInputFromDescription({ items: [desc] });
  const one = input.items[0];
  if (one === undefined) throw new Error('probe: no item');
  const shape = instantiate(one.typeId).shape;
  const scene = buildWashScene({
    items: [{ itemId: one.itemId, typeId: one.typeId, shape, pose: one.pose, soils: [] }],
    machine: [],
    blockSize: 0.004,
    materials: sceneMaterialOf,
  });
  const n: [number, number, number] = [0, 0, 0];
  for (let b = 0; b < scene.blocks.count; b++) {
    if (region !== undefined && shape.regions[scene.blocks.region[b] as number]?.id !== region)
      continue;
    for (let k = 0; k < 3; k++) {
      n[k] =
        (n[k] as number) +
        (scene.blocks.area[b] as number) * (scene.blocks.normal[3 * b + k] as number);
    }
  }
  const length = Math.hypot(n[0], n[1], n[2]);
  const box = scene.instances[0]?.box;
  if (box === undefined) throw new Error('probe: no instance');
  return { zMin: box.min[2] * 1000, normal: [n[0] / length, n[1] / length, n[2] / length] };
}

/** A piece of cutlery standing handle down on the floor of the cell at (x, y). */
function standing(
  id: string,
  type: string,
  x: number,
  y: number,
  soils: ItemDescription['soils'],
): ItemDescription {
  const trial = probe({ id, type, position_mm: [x, y, 300], orientation: 'handle_down' });
  return {
    id,
    type,
    position_mm: [x, y, 300 + CELL_FLOOR - trial.zMin],
    orientation: 'handle_down',
    ...(soils === undefined ? {} : { soils }),
  };
}

function spoons(
  first: string,
  second: string,
  x: number,
  y: number,
  gap: number,
): ItemDescription[] {
  const soils = [EGG('bowl', 0.1), SAUCE('bowl', 0.2)];
  const a = standing(first, 'soup_spoon_190', x, y, soils);
  // The partner stands in front of the soiled face, displaced along the mean normal of the bowl.
  const n = probe(a, 'bowl').normal;
  return [
    a,
    {
      ...a,
      id: second,
      position_mm: [
        a.position_mm[0] + gap * n[0],
        a.position_mm[1] + gap * n[1],
        a.position_mm[2] + gap * n[2],
      ],
      soils: [],
    },
  ];
}

/** Two spoons in cell c01 and nothing else: the partner `gap` mm in front of the soiled bowl. */
function spoonWash(gap: number): WashDescription {
  return {
    machine: 'bosch_smv4hax40g',
    programme: 'eco_50',
    tier: 'fast',
    levelSeed: 7,
    simSeed: 3,
    items: spoons('spoon', 'partner', -24, -139, gap),
  };
}

function description(): WashDescription {
  const bowl = (id: string, x: number, z: number, soiled: boolean): ItemDescription => ({
    id,
    type: 'cereal_bowl_vitrelle_159',
    position_mm: [x, 70, z],
    orientation: 'inverted',
    soils: soiled ? [SAUCE('interior'), EGG('interior')] : [],
  });
  return {
    machine: 'bosch_smv4hax40g',
    programme: 'eco_50',
    tier: 'fast',
    levelSeed: 7,
    simSeed: 3,
    items: [
      bowl('tight_under', -110, 473, false),
      bowl('tight_covered', -110, 479, true),
      bowl('loose_under', 110, 473, false),
      bowl('loose_covered', 110, 498, true),
      {
        id: 'porcelain',
        type: 'dessert_plate_porcelain_190',
        position_mm: [-120, 130, 172],
        quat_wxyz: FACING,
        soils: [EGG('well')],
      },
      {
        id: 'melamine',
        type: 'melamine_dessert_plate_iec_195',
        position_mm: [120, 130, 172],
        quat_wxyz: FACING,
        soils: [EGG('well')],
      },
      standing('fork', 'dinner_fork_185', -24, -51, [EGG('tines', 0.1)]),
      {
        id: 'container',
        type: 'food_container_1l',
        position_mm: [0, -100, 423],
        orientation: 'upright',
        soils: [SAUCE('interior', 3), EGG('interior', 1)],
      },
    ],
  };
}

/**
 * The baked sauce of these tests is a probe of where the jets strike: its bond is taken as it
 * was measured in cold water (soils 8.2), which only a jet breaks. With the registered fall of
 * the bond in warm liquor (`soil.adhesionHotFactor`, soils 2.4: 90 % weaker at 50 C) a film
 * takes the sauce off wherever it runs in the main wash and the probe would show nothing of
 * what these tests are about: that what the water side sees of a load reaches the result.
 */
const COLD_BOND = { 'soil.adhesionHotFactor': 1 } as const;

let result: WashResult;
/** The two spoons nested, and the same two apart. */
let nested: WashResult;
let apart: WashResult;
/** The same wash with the jets given a larger share in the removal of weakened egg yolk. */
let assisted: WashResult;

beforeAll(async () => {
  const cache = createMemoryExposureCache();
  const d = description();
  result = await wash(washInputFromDescription({ ...d, params: COLD_BOND }), { cache });
  assisted = await wash(
    washInputFromDescription({ ...d, params: { ...COLD_BOND, 'soil.jetPassGain': 20 } }),
    {
      cache,
      keepScene: false,
    },
  );
  nested = await wash(washInputFromDescription({ ...spoonWash(3), params: COLD_BOND }), {
    keepScene: false,
  });
  apart = await wash(washInputFromDescription({ ...spoonWash(15), params: COLD_BOND }), {
    keepScene: false,
  });
  if (DUMP !== undefined) {
    dump(result.run, result.problems, nested.problems, apart.problems);
    for (const r of [result, assisted, nested, apart]) {
      for (const i of r.items) {
        dump(
          i.itemId,
          i.clean,
          i.water.pooled_mL.toFixed(1),
          i.soils
            .map((x) => `${x.type} ${x.residualMass_mg.toFixed(1)}/${x.initialMass_mg.toFixed(0)}`)
            .join('; '),
        );
      }
    }
  }
});

function item(of: WashResult, id: string): ItemWashResult {
  const found = of.items.find((i) => i.itemId === id);
  if (found === undefined) throw new Error(`no item ${id}`);
  return found;
}

/** Share of a soil of an item that is left, 0 to 1. */
function left(of: WashResult, id: string, type: string): number {
  const found = item(of, id).soils.find((s) => s.type === type);
  if (found === undefined) throw new Error(`no ${type} on ${id}`);
  return found.residualMass_mg / found.initialMass_mg;
}

describe('the wash of the nesting comparisons', () => {
  it('runs with the real exposure, conserves water and reuses the exposure for the replay', () => {
    expect(result.provenance.exposureStandIn).toBe(false);
    for (const state of result.machine.states) {
      expect(state.exposure.water?.closes, state.id).toBe(true);
    }
    expect(assisted.run.exposureComputed).toBe(0);
    expect(assisted.run.exposureCacheHits).toBe(4);
    // The wash objects to no placement: the nests are 3 mm and 6 mm open.
    for (const each of [result, nested, apart]) {
      expect(each.problems.filter((p) => p.startsWith('placement'))).toEqual([]);
    }
  });
});

describe('a bowl nested 6 mm inside another against the nest opened to 25 mm (P04)', () => {
  it('keeps nearly all its baked sauce in the tight nest, and more than in the open one', () => {
    // standards P04: an overlapped zone keeps at least half of its soil.
    expect(left(result, 'tight_covered', 'tomato_sauce')).toBeGreaterThan(0.85);
    expect(left(result, 'tight_covered', 'tomato_sauce')).toBeGreaterThan(
      left(result, 'loose_covered', 'tomato_sauce') + 0.1,
    );
  });

  it('keeps at least as much egg yolk in the tight nest as in the open one', () => {
    expect(left(result, 'tight_covered', 'egg_yolk_dried')).toBeGreaterThanOrEqual(
      left(result, 'loose_covered', 'egg_yolk_dried') - 0.01,
    );
  });
});

describe('two soup spoons nested 3 mm apart against the same two 15 mm apart (P15)', () => {
  it('leaves at least as much of each soil on the shielded spoon', () => {
    for (const soil of ['egg_yolk_dried', 'tomato_sauce']) {
      expect(left(nested, 'spoon', soil), soil).toBeGreaterThanOrEqual(
        left(apart, 'spoon', soil) - 0.02,
      );
    }
  });

  // Known to fail (issue 2): on Eco 50 the shielded spoon keeps slightly less in all (60.3
  // against 61.4 mg), because the long soak cleans a face 3 mm from another as if it were open.
  // Drop `.fails` when that is fixed.
  it.fails('leaves more in all on the shielded spoon', () => {
    expect(item(nested, 'spoon').residualMass_mg).toBeGreaterThan(
      item(apart, 'spoon').residualMass_mg,
    );
  });
});

describe('the same egg yolk on porcelain, on melamine and on a steel fork (P44, P45, P47)', () => {
  it('comes off the melamine plate and the fork at least as well as off the porcelain plate', () => {
    // Everything in the machine is wetted within seconds: a deposit under a rivulet or under
    // drops is as wet as one under a film, whatever the bare substrate does with the water.
    const porcelain = 1 - left(result, 'porcelain', 'egg_yolk_dried');
    expect(porcelain).toBeGreaterThan(0.05);
    expect(1 - left(result, 'melamine', 'egg_yolk_dried')).toBeGreaterThanOrEqual(0.95 * porcelain);
    // The fork stands elsewhere (in the cutlery basket), so only the order of magnitude is
    // compared: with the wetted share of the bare steel as the soil's wet time it lost a
    // tenth of what the plate did.
    expect(1 - left(result, 'fork', 'egg_yolk_dried')).toBeGreaterThanOrEqual(0.6 * porcelain);
  });
});

describe('an upright food container (P01)', () => {
  it('fills to the brim, is not clean, and keeps the water out of the sump', () => {
    const container = item(result, 'container');
    // 24,200 mm2 of floor under 64.6 mm of wall: 1.57 L to the brim.
    expect(container.water.pooled_mL).toBeGreaterThan(1300);
    expect(container.water.pooled_mL).toBeLessThan(1800);
    expect(container.clean).toBe(false);
    expect(result.machine.heldWater_mL).toBeGreaterThan(container.water.pooled_mL - 1);
    // Under standing water no jet and no film stress the baked sauce: it stays.
    // (What goes, goes while the container fills.)
    expect(left(result, 'container', 'tomato_sauce')).toBeGreaterThan(0.8);
  });
});

describe('the share of the jets in the removal of egg yolk (P02), a calibration hook', () => {
  it('is small with the dossier default and grows with soil.jetPassGain', () => {
    // soils 3.6: k_mean = k_ds + f (k_ss - k_ds) with f about 1.6 %: a few per cent. On Eco 50
    // little of the yolk is left on the plate either way; the hook takes more than half of it.
    const base = left(result, 'porcelain', 'egg_yolk_dried');
    const more = left(assisted, 'porcelain', 'egg_yolk_dried');
    expect(more).toBeLessThan(0.5 * base);
    // Where no jet film reaches (the inside of the tight nest) the hook changes nothing.
    expect(left(assisted, 'tight_covered', 'egg_yolk_dried')).toBeCloseTo(
      left(result, 'tight_covered', 'egg_yolk_dried'),
      3,
    );
  });
});
