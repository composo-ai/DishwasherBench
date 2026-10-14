// End-to-end washes of the first build on the owner's machine (Bosch SMV4HAX40G, Eco 50,
// 4 h 55 min) with catalogue items placed by hand, at the fast tier, with the real exposure
// (the jet trace and gather, the droplets and the kinematic cascade of sim-jets, sim-spray and
// sim-film). They check directions and orders of magnitude, not calibrated values
// (docs/design/scope.md):
//
//  - a soiled plate facing the lower arm's jets against the same plate turned away;
//  - an upright mug against an inverted one;
//  - a plate above a large pan against the same plate with the pan taken out;
//  - the water balance of every spray state, from the nozzles to the sump, in whole units;
//  - the same wash twice: identical results and hashes, cold cache and warm;
//  - a changed soil parameter: the cached exposure is reused;
//  - a blocked dispenser: little detergent, and the enzyme-dependent soil stays.
//
// The poses (tub frame: origin on the lower-arm axis at tub-floor level, x right, y back, z
// up; position of the item-frame origin in millimetres; quaternions as (w, x, y, z)):
//
//  plate_facing   (-120, -130, 172)  turned 110 degrees about x: the eating face looks at the
//                                    door and 20 degrees down, at the lower arm
//  plate_away     ( 120, -130, 172)  turned 70 degrees about x: the same lean, eating face up,
//                                    so the lower arm strikes its back
//  pan            (-100,  120, 200)  inverted, lying 0.2 m up over the lower arm
//  plate_shadowed (-100,  120, 300)  as plate_facing, directly above the pan
//  mug_upright    (-120,  100, 423)  standing on the floor of the upper basket (z = 420)
//  mug_inverted   ( 120,  100, 524)  upside down on the same floor
//
// Nothing is settled with the loading physics: the lower-basket items hang where they are put.
import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  wash,
  washInputFromDescription,
  type ItemWashResult,
  type WashDescription,
  type WashResult,
} from '@spotless/sim-core';
import { createDiskExposureCache, runWashFile } from '@spotless/sim-core/node';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/** With SPOTLESS_E2E_DUMP=<file> set, the washes of this file append their numbers to it. */
const DUMP = process.env['SPOTLESS_E2E_DUMP'];
function dump(...values: unknown[]): void {
  if (DUMP === undefined) return;
  appendFileSync(
    DUMP,
    `${values.map((v) => (typeof v === 'string' ? v : JSON.stringify(v))).join(' ')}\n`,
  );
}

const FACING: [number, number, number, number] = [0.5736, 0.8192, 0, 0];
const AWAY: [number, number, number, number] = [0.8192, 0.5736, 0, 0];

// Baked-on tomato sauce on the eating face (it comes off only where a jet strikes it) and
// dried egg yolk on the rim (it comes off wherever it is kept wet with active protease).
const PLATE_SOILS = [
  {
    type: 'tomato_sauce',
    regions: [{ region: 'well', coverage: 0.6 }],
    amount_g: 2,
    age_h: 2,
    heat_history: 'baked' as const,
  },
  { type: 'egg_yolk_dried', regions: [{ region: 'rim', coverage: 0.3 }], amount_g: 0.5, age_h: 2 },
];
const TEA = [{ type: 'tea_tannin', regions: ['interior'], amount_g: 0.6, age_h: 12 }];

/**
 * The baked sauce of these tests is a probe of where the jets strike: its bond is taken as it
 * was measured in cold water (soils 8.2), which only a jet breaks. With the registered fall of
 * the bond in warm liquor (`soil.adhesionHotFactor`, soils 2.4: 90 % weaker at 50 C) a film
 * takes the sauce off wherever it runs in the main wash and the probe would show nothing of
 * what these tests are about: that what the water side sees of a load reaches the result.
 */
const COLD_BOND = { 'soil.adhesionHotFactor': 1 } as const;

function description(withPan: boolean, params?: WashDescription['params']): WashDescription {
  return {
    machine: 'bosch_smv4hax40g',
    programme: 'eco_50',
    tier: 'fast',
    levelSeed: 7,
    simSeed: 3,
    params: { ...COLD_BOND, ...(params ?? {}) },
    items: [
      {
        id: 'plate_facing',
        type: 'dessert_plate_porcelain_190',
        position_mm: [-120, -130, 172],
        quat_wxyz: FACING,
        soils: PLATE_SOILS,
      },
      {
        id: 'plate_away',
        type: 'dessert_plate_porcelain_190',
        position_mm: [120, -130, 172],
        quat_wxyz: AWAY,
        soils: PLATE_SOILS,
      },
      ...(withPan
        ? [
            {
              id: 'pan',
              type: 'frying_pan_clad_254',
              position_mm: [-100, 120, 200] as [number, number, number],
              orientation: 'inverted',
            },
          ]
        : []),
      {
        id: 'plate_shadowed',
        type: 'dessert_plate_porcelain_190',
        position_mm: [-100, 120, 300],
        quat_wxyz: FACING,
        soils: PLATE_SOILS,
      },
      {
        id: 'mug_upright',
        type: 'mug_ceramic_300',
        position_mm: [-120, 100, 423],
        orientation: 'upright',
        soils: TEA,
      },
      {
        id: 'mug_inverted',
        type: 'mug_ceramic_300',
        position_mm: [120, 100, 524],
        orientation: 'inverted',
        soils: TEA,
      },
    ],
  };
}

const directory = mkdtempSync(join(tmpdir(), 'spotless-e2e-'));
const cache = createDiskExposureCache(join(directory, 'cache'));

let withPan: WashResult;
let withoutPan: WashResult;
let fasterEgg: WashResult;
let blocked: WashResult;
/** The first wash with the bond of the baked sauce a quarter and four times as strong. */
let weakBond: WashResult;
let strongBond: WashResult;
/** The first wash traced on the CPU, against the cache the GPU washes filled. */
let onCpu: WashResult;
/** The first wash again, from its JSON description on disk and the warm cache. */
let repeat: WashResult;
let repeatPath: string;

beforeAll(async () => {
  withPan = await wash(washInputFromDescription(description(true)), { cache });
  fasterEgg = await wash(
    washInputFromDescription(description(true, { 'soil.egg_yolk.rateRef': 9e-5 })),
    { cache },
  );
  blocked = await wash(
    { ...washInputFromDescription(description(true)), dispenserBlocked: true },
    { cache },
  );
  weakBond = await wash(washInputFromDescription(description(true, { 'soil.adhesionTau0': 2e5 })), {
    cache,
  });
  strongBond = await wash(
    washInputFromDescription(description(true, { 'soil.adhesionTau0': 3.2e6 })),
    { cache },
  );
  const input = join(directory, 'wash.json');
  writeFileSync(input, JSON.stringify(description(true)));
  const ran = await runWashFile(input, { cacheDir: join(directory, 'cache'), cells: true });
  repeat = ran.result;
  repeatPath = ran.outputPath;
  withoutPan = await wash(washInputFromDescription(description(false)), { cache });
  onCpu = await wash(washInputFromDescription(description(true)), { cache, gpu: null });
  if (DUMP !== undefined) {
    for (const result of [withPan, withoutPan, fasterEgg, repeat, onCpu]) dump(result.run);
    for (const result of [withPan, weakBond, strongBond, onCpu, withoutPan]) {
      dump(
        result.items
          .map(
            (i) =>
              `${i.itemId} ${i.soils.map((x) => `${x.type} ${x.residualMass_mg.toFixed(1)}`).join(' ')}`,
          )
          .join(' | '),
      );
    }
  }
});

afterAll(() => {
  rmSync(directory, { recursive: true, force: true });
});

function item(result: WashResult, id: string): ItemWashResult {
  const found = result.items.find((i) => i.itemId === id);
  if (found === undefined) throw new Error(`no item ${id}`);
  return found;
}

function soilOf(
  result: WashResult,
  id: string,
  type: string,
): { initial: number; residual: number } {
  const found = item(result, id).soils.find((s) => s.type === type);
  if (found === undefined) throw new Error(`no ${type} on ${id}`);
  return { initial: found.initialMass_mg, residual: found.residualMass_mg };
}

describe('the wash as a whole', () => {
  it('replays the 4 h 55 min programme in about 7,800 ticks over four spray states', () => {
    expect(withPan.machine.machineId).toBe('bosch_smv4hax40g');
    expect(withPan.machine.duration_s / 60).toBeCloseTo(295, 0);
    expect(withPan.machine.ticks).toBeGreaterThan(7000);
    expect(withPan.machine.ticks).toBeLessThan(8500);
    expect(withPan.machine.states.map((s) => s.id)).toEqual([
      'l@2800',
      'l@3000',
      'ur@2800',
      'ur@3000',
    ]);
    expect(withPan.provenance.exposureStandIn).toBe(false);
    expect(withPan.problems).toEqual([]);
    expect(withPan.items.map((i) => i.itemId)).toEqual([
      'mug_inverted',
      'mug_upright',
      'pan',
      'plate_away',
      'plate_facing',
      'plate_shadowed',
    ]);
  });

  it('lays down the soil it was given and accounts for all of it', () => {
    // 2 g of tomato sauce at the catalogue's solids fraction and 0.5 g of egg yolk at 0.5.
    const egg = soilOf(withPan, 'plate_facing', 'egg_yolk_dried');
    expect(egg.initial).toBeCloseTo(250, 6);
    const soil = withPan.machine.soil;
    expect((soil.remaining_mg + soil.toLiquor_mg + soil.toPools_mg) / soil.initial_mg).toBeCloseTo(
      1,
      9,
    );
    for (const result of withPan.items) {
      expect(result.residualMass_mg).toBeLessThanOrEqual(result.initialMass_mg * (1 + 1e-9));
      expect(Number.isFinite(result.visibleAreaMm2)).toBe(true);
      const regions = result.regions.reduce((sum, r) => sum + r.residualMass_mg, 0);
      expect(regions).toBeCloseTo(result.residualMass_mg, 6);
    }
    // The pan carries no soil, holds no water lying upside down, and is clean.
    expect(item(withPan, 'pan').clean).toBe(true);
    expect(item(withPan, 'pan').score).toBe(5);
  });

  it("doses the machine's 20 g of detergent and dissolves it", () => {
    expect(withPan.machine.detergent.dosed_g).toBeCloseTo(20, 9);
    expect(withPan.machine.detergent.dissolved_g).toBeCloseTo(20, 6);
    expect(withPan.machine.dispenser).toBe('free');
  });
});

describe('the water of every spray state', () => {
  it('is conserved exactly from the nozzles to the sump, and the film is in its periodic state', () => {
    for (const result of [withPan, withoutPan]) {
      for (const state of result.machine.states) {
        const water = state.exposure.water;
        const film = state.exposure.film;
        if (water === undefined || film === undefined)
          throw new Error(`${state.id}: no water balance`);
        expect(water.closes, state.id).toBe(true);
        expect(water.nozzle, state.id).toBe(water.jets + water.showers);
        expect(water.jets, state.id).toBe(
          water.jetLost + water.handover + water.splatter + water.scatter,
        );
        expect(water.splatter + water.scatter + water.showers, state.id).toBe(
          water.dropletsLanded + water.dropletsLost,
        );
        expect(water.filmFed, state.id).toBe(water.handover + water.dropletsLanded);
        expect(film.fed + film.primed, state.id).toBe(film.toSump + film.stored);
        // The pump's flow leaves the nozzles: about 30 L/min, 0.7 to 1 kg per revolution.
        expect(
          (water.nozzle * water.unit) / state.period_s / (state.flow_L_min / 60),
        ).toBeGreaterThan(0.95);
        expect((water.nozzle * water.unit) / state.period_s / (state.flow_L_min / 60)).toBeLessThan(
          1.01,
        );
        // What goes out is back in the sump within a revolution; the surfaces hold a few
        // hundred grams; the load is wet nearly all over.
        expect(film.converged, state.id).toBe(true);
        expect(water.sumpReturnFraction, state.id).toBeGreaterThan(0.95);
        expect(water.sumpReturnFraction, state.id).toBeLessThan(1.02);
        expect(film.heldOnItems, state.id).toBeGreaterThan(0.01);
        expect(film.heldOnItems, state.id).toBeLessThan(0.5);
        expect(film.itemWetFraction, state.id).toBeGreaterThan(0.7);
        expect(state.exposure.backend === 'gpu' || state.exposure.backend === 'cpu').toBe(true);
      }
    }
  });

  it('reports the force of the jets on the items, for the screening of what they would move', () => {
    const lower = withPan.machine.states.find((s) => s.id === 'l@3000');
    const loads = lower?.exposure.itemLoads ?? [];
    // The lower arm strikes the pan above it hardest: about a newton, a tenth of its weight.
    const pan = loads.find((l) => l.itemId === 'pan');
    expect(pan?.peakUp).toBeGreaterThan(0.5);
    expect(pan?.peakUp).toBeLessThan(3);
    for (const load of loads) expect(load.peak).toBeGreaterThanOrEqual(load.peakUp);
    // The plate above the pan is out of reach of the lower arm.
    expect(loads.find((l) => l.itemId === 'plate_shadowed')).toBeUndefined();
  });
});

describe('a plate facing the lower arm against the same plate turned away', () => {
  it('loses baked-on sauce where the jets strike, and little where they cannot', () => {
    const facing = soilOf(withPan, 'plate_facing', 'tomato_sauce');
    const away = soilOf(withPan, 'plate_away', 'tomato_sauce');
    expect(facing.initial).toBeCloseTo(away.initial, 6);
    // The jets of the lower arm sweep the face that looks at them: most of the sauce goes.
    expect(facing.residual).toBeLessThan(0.5 * facing.initial);
    // Turned away, the eating face sees no jet squarely. It loses a little all the same: to
    // the fans of jets that strike the rim and wrap round it, and to the run-off where that
    // is thick enough to stress the soaked sauce beyond its strength.
    // The bond strength of the deposits scatters (`soil.adhesionCv`), so the weakest of them
    // go under the film as well: a fifth to a quarter in all.
    expect(away.residual).toBeGreaterThan(0.7 * away.initial);
    expect(facing.residual).toBeLessThan(0.4 * away.residual);
    // In all, the plate that faces the jets ends with less soil and less visibly soiled area.
    expect(item(withPan, 'plate_facing').residualMass_mg).toBeLessThan(
      item(withPan, 'plate_away').residualMass_mg,
    );
    expect(item(withPan, 'plate_facing').visibleAreaMm2).toBeLessThan(
      item(withPan, 'plate_away').visibleAreaMm2,
    );
  });
});

describe('the bond strength of the baked sauce over its registered range', () => {
  it('keeps the directions, and moves the residue by degrees, not from all to nothing', () => {
    const sauce = (result: WashResult, id: string): number => {
      const s = soilOf(result, id, 'tomato_sauce');
      return s.residual / s.initial;
    };
    for (const result of [weakBond, withPan, strongBond]) {
      // Facing the jets is always cleaner than turned away or shadowed by the pan.
      expect(sauce(result, 'plate_facing')).toBeLessThan(sauce(result, 'plate_away'));
      expect(sauce(result, 'plate_facing')).toBeLessThan(sauce(result, 'plate_shadowed'));
    }
    for (const id of ['plate_facing', 'plate_away', 'plate_shadowed']) {
      // A stronger bond leaves more.
      expect(sauce(weakBond, id), id).toBeLessThanOrEqual(sauce(withPan, id));
      expect(sauce(withPan, id), id).toBeLessThanOrEqual(sauce(strongBond, id));
    }
    // A quarter of the default strength (the engineering review found 0 of 600 mg left on
    // the shadowed plate at this value with the all-or-nothing law) still leaves soil where
    // no jet strikes.
    expect(sauce(weakBond, 'plate_shadowed')).toBeGreaterThan(0.05);
    // The exposure is that of the first wash: only the soil was replayed.
    expect(weakBond.run.exposureComputed).toBe(0);
    expect(strongBond.run.exposureComputed).toBe(0);
  });
});

describe('the tracer the exposure was computed on', () => {
  it('is part of the cache key and of the provenance: a CPU wash does not take GPU exposure', () => {
    expect(withPan.provenance.exposureBackend).toBe('gpu');
    expect(onCpu.provenance.exposureBackend).toBe('cpu');
    // The cache held the four sets of the GPU washes; none of them is used.
    expect(onCpu.run.exposureCacheHits).toBe(0);
    expect(onCpu.run.exposureComputed).toBe(4);
    for (const state of onCpu.machine.states) {
      expect(state.exposure.backend, state.id).toBe('cpu');
      expect(state.exposureKey).not.toBe(
        withPan.machine.states.find((s) => s.id === state.id)?.exposureKey,
      );
    }
    // Asked for by name, the CPU is not a fallback: nothing to report.
    expect(onCpu.problems).toEqual([]);
    // The two tracers differ on rare grazing rays: the residues agree to a few per cent.
    for (const id of ['plate_facing', 'plate_away', 'plate_shadowed']) {
      expect(item(onCpu, id).residualMass_mg / item(withPan, id).residualMass_mg).toBeCloseTo(1, 1);
    }
  });
});

describe('an upright mug against an inverted one', () => {
  it('holds a mugful of water upright and a few millilitres in its base upside down', () => {
    const upright = item(withPan, 'mug_upright');
    const inverted = item(withPan, 'mug_inverted');
    // The catalogue mug holds about 330 mL to the brim.
    expect(upright.water.pooled_mL).toBeGreaterThan(250);
    expect(upright.water.pooled_mL).toBeLessThan(400);
    expect(inverted.water.pooled_mL).toBeLessThan(10);
    expect(upright.water.pooled_mL).toBeGreaterThan(20 * inverted.water.pooled_mL);
    // More than 1 mL of water: not clean, whatever happened to its soil.
    expect(upright.clean).toBe(false);
    // Its water holds soil at the end: what came off under it and has not spilled, and what
    // the liquor that fell into it brought. That is laid on the surface under the water and
    // seen there: residue left where dirty water stood (far more than the 4 mm2 of a clean
    // item). The mug upside down and level holds a few millilitres of the last rinse in the
    // recess of its base (chemistry 5.3, R2 names mug bases first): a small fraction of what
    // the mugful leaves, on the base and nowhere else.
    const pool = upright.water.pools[0];
    expect((pool?.dissolvedSoil_mg ?? 0) + (pool?.carriedSoil_mg ?? 0)).toBeGreaterThan(0);
    expect(upright.water.standingResidue_mg ?? 0).toBeGreaterThan(0);
    expect(upright.water.standingVisibleAreaMm2 ?? 0).toBeGreaterThan(100);
    expect(upright.visibleAreaMm2).toBeGreaterThanOrEqual(
      upright.water.standingVisibleAreaMm2 ?? Infinity,
    );
    expect(inverted.water.standingResidue_mg ?? 0).toBeLessThan(
      0.1 * (upright.water.standingResidue_mg ?? 0),
    );
    expect(inverted.water.standingVisibleAreaMm2 ?? 0).toBeLessThan(
      upright.water.standingVisibleAreaMm2 ?? 0,
    );
    // The water the upright mug traps is kept out of the machine's sump.
    expect(withPan.machine.heldWater_mL).toBeGreaterThan(upright.water.pooled_mL - 1);
  });
});

describe('a plate above a large pan against the same plate with the pan taken out', () => {
  it('keeps more soil in the shadow of the pan', () => {
    const shadowed = item(withPan, 'plate_shadowed');
    const open = item(withoutPan, 'plate_shadowed');
    // The same plate, pose, soil and seeds: it starts identical in both washes.
    expect(shadowed.initialMass_mg).toBe(open.initialMass_mg);
    expect(shadowed.residualMass_mg).toBeGreaterThan(1.03 * open.residualMass_mg);
    // No jet of the lower arm reaches its eating face past the pan: the sauce stays, but for
    // the weakest deposits, which the film of run-off takes.
    const sauce = soilOf(withPan, 'plate_shadowed', 'tomato_sauce');
    expect(sauce.residual).toBeGreaterThan(0.9 * sauce.initial);
    expect(soilOf(withoutPan, 'plate_shadowed', 'tomato_sauce').residual).toBeLessThan(
      0.5 * sauce.residual,
    );
    // The egg yolk on its rim is wet for less of the time and comes off more slowly.
    expect(soilOf(withPan, 'plate_shadowed', 'egg_yolk_dried').residual).toBeGreaterThan(
      soilOf(withoutPan, 'plate_shadowed', 'egg_yolk_dried').residual,
    );
    // The other plates hardly notice the pan: only through the liquor, which carries a little
    // less soil with it, and through the spray the pan throws about.
    expect(
      item(withoutPan, 'plate_away').residualMass_mg / item(withPan, 'plate_away').residualMass_mg,
    ).toBeCloseTo(1, 1);
  });
});

describe('determinism and the exposure cache', () => {
  it('computes the four exposure sets once and gives the same result from the cache', () => {
    expect(withPan.run.exposureComputed).toBe(4);
    expect(withPan.run.exposureCacheHits).toBe(0);
    expect(repeat.run.exposureComputed).toBe(0);
    expect(repeat.run.exposureCacheHits).toBe(4);
    expect(repeat.provenance.resultHash).toBe(withPan.provenance.resultHash);
    expect(repeat.provenance.inputHash).toBe(withPan.provenance.inputHash);
    // The repeat was asked for per-cell arrays as well; everything else is equal.
    expect(repeat.items.map(({ cells: _cells, ...rest }) => rest)).toEqual(withPan.items);
    expect(repeat.machine.liquor.values).toEqual(withPan.machine.liquor.values);
    expect(repeat.machine.states).toEqual(withPan.machine.states);
  });

  it('takes a different scene for a different wash', () => {
    expect(withoutPan.run.exposureComputed).toBe(4);
    expect(withoutPan.provenance.resultHash).not.toBe(withPan.provenance.resultHash);
    expect(withoutPan.machine.states.map((s) => s.exposureKey)).not.toEqual(
      withPan.machine.states.map((s) => s.exposureKey),
    );
  });

  it('reuses the cached exposure when only a soil parameter changes', () => {
    expect(fasterEgg.run.exposureComputed).toBe(0);
    expect(fasterEgg.run.exposureCacheHits).toBe(4);
    // Nor is the scene built again: the load has not changed.
    expect(withPan.run.sceneReused).toBe(false);
    expect(fasterEgg.run.sceneReused).toBe(true);
    expect(withoutPan.run.sceneReused).toBe(false);
    expect(fasterEgg.provenance.hydroHash).toBe(withPan.provenance.hydroHash);
    expect(fasterEgg.provenance.soilHash).not.toBe(withPan.provenance.soilHash);
    expect(fasterEgg.machine.states.map((s) => s.exposureKey)).toEqual(
      withPan.machine.states.map((s) => s.exposureKey),
    );
    // Three times the reaction-erosion flux: less egg yolk left, the sauce as before.
    expect(soilOf(fasterEgg, 'plate_facing', 'egg_yolk_dried').residual).toBeLessThan(
      0.8 * soilOf(withPan, 'plate_facing', 'egg_yolk_dried').residual,
    );
    expect(soilOf(fasterEgg, 'plate_facing', 'tomato_sauce').residual).toBe(
      soilOf(withPan, 'plate_facing', 'tomato_sauce').residual,
    );
    expect(fasterEgg.provenance.resultHash).not.toBe(withPan.provenance.resultHash);
  });
});

describe('a dispenser the load keeps shut', () => {
  it('releases a fraction of the dose, and the enzyme-dependent soil stays', () => {
    // chemistry 1.7: 5 to 30 % of the dose is released over a main wash through the gap; the
    // two and a half hours of the main wash of Eco 50 release a little more (36 %).
    const share = blocked.machine.detergent.dissolved_g / blocked.machine.detergent.dosed_g;
    expect(blocked.machine.dispenser).toBe('blocked');
    expect(share).toBeGreaterThan(0.05);
    expect(share).toBeLessThan(0.45);
    const pH = blocked.machine.liquor.fields.indexOf('pH');
    const width = blocked.machine.liquor.fields.length;
    let highest = 0;
    let normal = 0;
    for (let i = 0; i < blocked.machine.ticks; i++) {
      highest = Math.max(highest, blocked.machine.liquor.values[width * i + pH] as number);
      normal = Math.max(normal, withPan.machine.liquor.values[width * i + pH] as number);
    }
    expect(highest).toBeLessThan(normal - 0.4);
    // Little protease: nearly all the egg yolk stays (95 % on Eco 50, whose long main wash lets
    // a third of the dose out). The sauce the jets strip mechanically does not care.
    const egg = soilOf(blocked, 'plate_facing', 'egg_yolk_dried');
    expect(egg.residual).toBeGreaterThan(0.9 * egg.initial);
    expect(egg.residual).toBeGreaterThan(
      soilOf(withPan, 'plate_facing', 'egg_yolk_dried').residual,
    );
    // (To 0.05 mg: the soil is stepped when the liquor has moved, which it does at other
    // moments without the dose.)
    expect(soilOf(blocked, 'plate_facing', 'tomato_sauce').residual).toBeCloseTo(
      soilOf(withPan, 'plate_facing', 'tomato_sauce').residual,
      1,
    );
    // The exposure does not depend on the dispenser.
    expect(blocked.run.exposureComputed).toBe(0);
  });
});

describe('the spotless-wash command', () => {
  it('runs a wash from a JSON description and writes the result as JSON', () => {
    const result = repeat;
    const outputPath = repeatPath;
    expect(outputPath).toBe(join(directory, 'wash.result.json'));
    const written = JSON.parse(readFileSync(outputPath, 'utf8')) as {
      provenance: { resultHash: string };
      items: {
        itemId: string;
        clean: boolean;
        cells: { count: number; visible: number[]; residual_mg_cm2: number[] };
      }[];
      machine: { liquor: { fields: string[]; tickTime_s: number[]; values: number[][] } };
    };
    expect(written.provenance.resultHash).toBe(result.provenance.resultHash);
    expect(written.items.map((i) => i.itemId)).toEqual(result.items.map((i) => i.itemId));
    const facing = written.items.find((i) => i.itemId === 'plate_facing');
    expect(facing?.cells.visible).toHaveLength(facing?.cells.count ?? -1);
    expect(facing?.cells.residual_mg_cm2).toHaveLength(
      (facing?.cells.count ?? 0) * result.soilClasses.length,
    );
    // The liquor trace is thinned to about a row a minute: 295 minutes.
    expect(written.machine.liquor.values.length).toBeGreaterThan(240);
    expect(written.machine.liquor.values.length).toBeLessThan(400);
    expect(written.machine.liquor.values[0]).toHaveLength(written.machine.liquor.fields.length);
  });
});
