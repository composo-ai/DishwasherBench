// The replay of the first build on a small hand-built scene under the owner's machine and
// programme: tick bookkeeping, the liquor through the water changes, the soil ledger, a cup
// that pools, a tile nothing reaches, and repeatability.
import { describe, expect, it } from 'vitest';
import {
  bindSharedClosures,
  buildWashHydraulics,
  buildWashScene,
  computeExposureSet,
  createParamSet,
  createRegistry,
  createWashLiquor,
  createWashSoil,
  FILM_PARAM_DEFS,
  HYDRAULICS_PARAM_DEFS,
  initSoil,
  JETS_PARAM_DEFS,
  LIQUOR_FIELD_COUNT,
  LIQUOR_FIELDS,
  LIQUOR_PARAM_DEFS,
  PRIMARY_MACHINE,
  primaryProgramme,
  replayWash,
  SCENE_PARAM_DEFS,
  SHARED_PARAM_DEFS,
  SOIL_MODEL_CLASSES,
  SOIL_PARAM_DEFS,
  SPRAY_PARAM_DEFS,
  STAND_IN_EXPOSURE_STAGES,
  TIER_FAST,
  TIMELINE_PARAM_DEFS,
  WATER_FIELD,
  WATER_FIELD_COUNT,
  type ExposureSet,
  type ItemSoilRecord,
  type ParamSet,
  type ReplayResult,
  type SceneItem,
  type SceneMaterial,
  type SoilState,
} from './index.ts';

const registry = createRegistry({
  contributions: [
    SHARED_PARAM_DEFS,
    SCENE_PARAM_DEFS,
    HYDRAULICS_PARAM_DEFS,
    JETS_PARAM_DEFS,
    SPRAY_PARAM_DEFS,
    FILM_PARAM_DEFS,
    LIQUOR_PARAM_DEFS,
    SOIL_PARAM_DEFS,
    TIMELINE_PARAM_DEFS,
  ],
  soilClasses: [...SOIL_MODEL_CLASSES],
});
const params = createParamSet(registry);
const spec = PRIMARY_MACHINE; // the owner's Bosch SMV4HAX40G
const hydraulics = buildWashHydraulics({ spec, programme: primaryProgramme(spec), params });
const { schedule, states } = hydraulics;

const glaze: SceneMaterial = {
  id: 'glaze',
  wettingClass: 'continuous_film',
  advancing: [0.4, 0.2, 0.2],
  receding: [0.1, 0.05, 0.05],
};
const marker = (regions: readonly string[]): ItemSoilRecord => ({
  type: 'marker',
  regions: regions.map((region) => ({ region, coverage: 1 })),
  amount_g: 0,
  age_h: 0,
  heat_history: 'none',
});
function slab(itemId: string, half: number, p: [number, number, number]): SceneItem {
  return {
    itemId,
    typeId: 'slab',
    shape: {
      parts: [
        {
          id: 'body',
          prim: { kind: 'rbox', halfExtents: [half, half, 0.003], radius: 0.001 },
          pose: { p: [0, 0, 0], q: [0, 0, 0, 1] },
          material: 'glaze',
        },
      ],
      regions: [
        { id: 'top', part: 'body', side: 'in' },
        { id: 'underside', part: 'body', side: 'out' },
      ],
    },
    pose: { p, q: [0, 0, 0, 1] },
    soils: [marker(['top', 'underside'])],
  };
}
const cup: SceneItem = {
  itemId: 'b_cup',
  typeId: 'cup',
  shape: {
    parts: [
      {
        id: 'body',
        prim: {
          kind: 'sor',
          profile: [
            { r: 0, z: 0.002, t: 0.004 },
            { r: 0.03, z: 0.002, t: 0.004 },
            { r: 0.035, z: 0.07, t: 0.003 },
          ],
        },
        pose: { p: [0, 0, 0], q: [0, 0, 0, 1] },
        material: 'glaze',
      },
    ],
    regions: [
      { id: 'interior', part: 'body', side: 'in' },
      { id: 'exterior', part: 'body', side: 'out' },
    ],
  },
  pose: { p: [0.05, 0.02, 0.25], q: [0, 0, 0, 1] },
  soils: [marker(['interior', 'exterior'])],
};

// A plate lying over the lower arm (struck from below by its jets, rained on from the roof
// spinner), a cup standing on it (it fills), and a tile under the middle of the plate that
// neither a jet nor a droplet nor a drip reaches.
const scene = buildWashScene({
  items: [slab('a_plate', 0.15, [0, 0, 0.2]), cup, slab('c_tile', 0.02, [0, 0, 0.12])],
  machine: [],
  blockSize: 4e-3,
  materials: () => glaze,
  params,
});
const soils = [
  {
    itemId: 'a_plate',
    soils: [
      {
        type: 'egg_yolk',
        regions: [{ region: 'underside', coverage: 0.3 }],
        amount_g: 1,
        age_h: 24,
        heat_history: 'none' as const,
      },
    ],
  },
  {
    itemId: 'b_cup',
    soils: [
      {
        type: 'egg_yolk',
        regions: [{ region: 'interior', coverage: 1 }],
        amount_g: 0.5,
        age_h: 24,
        heat_history: 'none' as const,
      },
    ],
  },
  {
    itemId: 'c_tile',
    soils: [
      {
        type: 'soluble',
        regions: [
          { region: 'top', coverage: 1 },
          { region: 'underside', coverage: 1 },
        ],
        amount_g: 0.2,
        age_h: 24,
        heat_history: 'none' as const,
      },
    ],
  },
];

interface Run {
  readonly result: ReplayResult;
  readonly soil: SoilState;
  readonly sets: readonly ExposureSet[];
  readonly requested: readonly number[];
}

/**
 * One replay. `set` is the parameter set of the replay and the soil (the exposure is that of
 * the defaults); `change` rewrites the exposure sets before they are replayed.
 */
async function run(
  set: ParamSet = params,
  change: (exposure: ExposureSet) => ExposureSet = (exposure) => exposure,
): Promise<Run> {
  const sets: ExposureSet[] = [];
  for (const state of states) {
    sets.push(
      // The labelled stand-ins: this file tests the replay against exposure with known values
      // (every wet block the same film), not the exposure stages.
      await computeExposureSet(
        { scene, state, armLevels: [], params, tier: TIER_FAST, seed: 4 },
        STAND_IN_EXPOSURE_STAGES,
      ),
    );
  }
  for (let i = 0; i < sets.length; i++) sets[i] = change(sets[i] as ExposureSet);
  const state = initSoil(
    scene,
    soils,
    (id) => ({ modelClass: id as 'egg_yolk', solidsFraction: 0.5 }),
    set,
    2,
  );
  const requested: number[] = [];
  const result = await replayWash({
    scene,
    hydraulics,
    exposure: (index) => {
      requested.push(index);
      return Promise.resolve(sets[index] as ExposureSet);
    },
    liquor: createWashLiquor(set),
    soil: createWashSoil(state, scene, set),
    params: set,
  });
  return { result, soil: state, sets, requested };
}

const first = await run();
const { result } = first;
const column = (name: (typeof LIQUOR_FIELDS)[number]): number => LIQUOR_FIELDS.indexOf(name);
const liquorAt = (time: number, name: (typeof LIQUOR_FIELDS)[number]): number => {
  let tick = 0;
  while (tick + 1 < result.ticks && (result.tickTime[tick + 1] as number) <= time) tick++;
  return result.liquor[LIQUOR_FIELD_COUNT * tick + column(name)] as number;
};

describe('ticks', () => {
  it('asks for each exposure once, in the order the programme first needs it', () => {
    // The pre-rinse alternates l and ur at 2800 rev/min; the main wash at 3000.
    expect(first.requested.map((index) => states[index]?.id)).toEqual([
      'l@2800',
      'ur@2800',
      'l@3000',
      'ur@3000',
    ]);
  });

  it('steps every span in revolutions of its master arm, 2 s with the pump off, 10 s in drying', () => {
    let want = 0;
    for (const span of schedule.spans) {
      const tick =
        span.state >= 0 ? (states[span.state]?.period ?? 0) : span.kind === 'dry' ? 10 : 2;
      want += Math.max(1, Math.ceil((span.end - span.start - 1e-6) / tick));
    }
    expect(result.ticks).toBe(want);
    // About 4,000 ticks for the 2 h 25 min programme.
    expect(result.ticks).toBeGreaterThan(3500);
    expect(result.ticks).toBeLessThan(4500);
    let total = 0;
    for (let i = 0; i < result.ticks; i++) {
      total += result.tickLength[i] as number;
      if (i > 0) {
        expect(result.tickTime[i]).toBeCloseTo(
          (result.tickTime[i - 1] as number) + (result.tickLength[i - 1] as number),
          4,
        );
      }
      const state = result.tickState[i] as number;
      if (state >= 0)
        expect(result.tickLength[i]).toBeLessThanOrEqual((states[state]?.period ?? 0) + 1e-6);
    }
    expect(total).toBeCloseTo(schedule.duration, 2);
  });
});

describe('liquor through the programme', () => {
  const release = schedule.timeline.events.find((e) => e.kind === 'detergent_release');
  const drains = schedule.timeline.events.filter((e) => e.kind === 'drain');
  const mainDrain = drains.find((e) => e.kind === 'drain' && e.stepId === 'a6_drain');
  if (release === undefined || release.kind !== 'detergent_release') throw new Error('no release');
  if (mainDrain === undefined || mainDrain.kind !== 'drain') throw new Error('no main-wash drain');

  it('has no detergent before the dispenser opens and the whole dose after it has dissolved', () => {
    expect(liquorAt(release.time - 5, 'detergent')).toBe(0);
    expect(liquorAt(release.time - 5, 'pH')).toBeLessThan(8.5);
    // 20 g in the 4 L of the main wash.
    expect(liquorAt(mainDrain.time - 10, 'detergent')).toBeCloseTo(release.mass / 0.004, 6);
    expect(liquorAt(release.time + 900, 'pH')).toBeGreaterThan(10.3);
    expect(result.detergent.dosed).toBe(release.mass);
    expect(result.detergent.dissolved).toBeCloseTo(release.mass, 12);
  });

  it('follows the machine for volume and temperature', () => {
    const hold = schedule.timeline.segments.find(
      (s) => s.kind === 'hold' && s.phase === 'main_wash',
    );
    if (hold === undefined) throw new Error('no hold');
    expect(liquorAt(hold.start + 30, 'volume')).toBeCloseTo(hold.liquorVolume.start, 9);
    expect(
      Math.abs(liquorAt(hold.start + 30, 'temperature') - (hold.temperature.liquor[3] ?? 0)),
    ).toBeLessThan(0.5);
  });

  it('dilutes at the main-wash drain by the sump residue plus the film on the surfaces', () => {
    const carried = result.carryOver.find((c) => c.time === mainDrain.time);
    if (carried === undefined) throw new Error('no carry-over');
    expect(carried.sump).toBe(mainDrain.remaining);
    // The film: the residual film on every block either main-wash state wets.
    const rho = bindSharedClosures(params).water(params.get('jets.solveTemperature')).rho;
    let film = 0;
    for (let b = 0; b < scene.blocks.count; b++) {
      let kept = 0;
      for (const set of [first.sets[1], first.sets[3]]) {
        const o = WATER_FIELD_COUNT * b;
        if (set !== undefined && (set.water.values[o + WATER_FIELD.wetFraction] as number) > 0) {
          kept = Math.max(kept, set.water.values[o + WATER_FIELD.retained] as number);
        }
      }
      film += (kept * (scene.blocks.area[b] as number)) / rho;
    }
    expect(film).toBeGreaterThan(0);
    expect(carried.film).toBeCloseTo(film, 9);
    const before = mainDrain.volume + mainDrain.remaining;
    expect(carried.fraction).toBeCloseTo((mainDrain.remaining + film) / before, 12);
    // The intermediate rinse starts with that share of the detergent in its own volume.
    const rinse = schedule.timeline.segments.find(
      (s) => s.phase === 'intermediate_rinse' && s.kind === 'circulate',
    );
    if (rinse === undefined) throw new Error('no rinse');
    const main = liquorAt(mainDrain.time - 10, 'detergent');
    expect(liquorAt(rinse.start + 20, 'detergent')).toBeCloseTo(
      (main * before * carried.fraction) / rinse.liquorVolume.start,
      6,
    );
    expect(result.carryOver).toHaveLength(drains.length);
  });
});

describe('soil and pools', () => {
  it('closes the soil ledger: on the load, in the liquor and in pools', () => {
    const { initial, remaining, toLiquor, toPools } = result.soilLedger;
    expect(initial).toBeCloseTo(0.5 * 1.7e-3, 12);
    expect((remaining + toLiquor + toPools) / initial).toBeCloseTo(1, 12);
    expect(toLiquor).toBeGreaterThan(0);
    expect(remaining).toBeLessThan(initial);
  });

  it('fills the cup under the roof spinner and never empties it', () => {
    const basin = scene.basins.findIndex(
      (b) => b.instance === scene.itemInstance.get('b_cup') && b.volume > 50e-6,
    );
    const pool = result.pools.find((p) => p.basin === basin);
    expect(pool).toBeDefined();
    expect(pool?.volume).toBeCloseTo(scene.basins[basin]?.volume ?? 0, 12);
    // Its water was exchanged with rinse liquor: some detergent, less than in the main wash.
    expect(pool?.detergent).toBeGreaterThan(0);
    expect(pool?.detergent).toBeLessThan(5);
    // What the ledger counts as in pools is what the pools still hold of the load's soil.
    expect(result.soilLedger.toPools).toBeCloseTo(pool?.dissolvedSoil ?? -1, 15);
    expect(result.carryOver[result.carryOver.length - 1]?.pools).toBeCloseTo(pool?.volume ?? 0, 12);
    // It is full to the end: none of its blocks is dry.
    expect(pool?.dry).toBeCloseTo(0, 6);
  });

  // The same replay with the water that falls into the cup scaled: at a hundredth the cup
  // never fills, at three hundredths it fills late and little runs over.
  const inflowScaled = (factor: number): Promise<Run> =>
    run(params, (set) => ({ ...set, poolInflow: set.poolInflow.map((rate) => rate * factor) }));
  const cupPool = (r: Run): ReplayResult['pools'][number] => {
    const basin = scene.basins.findIndex(
      (b) => b.instance === scene.itemInstance.get('b_cup') && b.volume > 50e-6,
    );
    const found = r.result.pools.find((p) => p.basin === basin);
    if (found === undefined) throw new Error('the cup holds no water');
    return found;
  };

  it('lets the soil that dissolved under a pool leave with the water that spills, as its detergent does', async () => {
    const dripped = await inflowScaled(0.01);
    const trickled = await inflowScaled(0.03);
    const tenth = await inflowScaled(0.1);
    // The ledger closes however much runs through the cup, and what it counts as in pools is
    // what the pools hold of the load's soil at the end.
    for (const r of [dripped, trickled, tenth, first]) {
      const { initial, remaining, toLiquor, toPools } = r.result.soilLedger;
      expect((remaining + toLiquor + toPools) / initial).toBeCloseTo(1, 12);
      expect(toPools).toBeCloseTo(cupPool(r).dissolvedSoil, 15);
    }
    // A cup that never fills spills nothing: it holds main-wash liquor and tens of milligrams
    // of its own soil, and some of its blocks are dry.
    expect(cupPool(dripped).volume).toBeLessThan(cupPool(dripped).capacity);
    expect(cupPool(dripped).dry).toBeGreaterThan(0);
    expect(cupPool(dripped).dissolvedSoil).toBeGreaterThan(20e-6);
    expect(cupPool(dripped).detergent).toBeGreaterThan(3);
    // The more water runs through a full cup, the less of either it keeps.
    expect(cupPool(trickled).volume).toBeCloseTo(cupPool(trickled).capacity, 12);
    expect(cupPool(tenth).dissolvedSoil).toBeLessThan(0.5 * cupPool(trickled).dissolvedSoil);
    expect(cupPool(tenth).detergent).toBeLessThan(cupPool(trickled).detergent);
    expect(cupPool(first).dissolvedSoil).toBeLessThan(1e-3 * cupPool(tenth).dissolvedSoil);
    expect(cupPool(first).detergent).toBeLessThan(cupPool(tenth).detergent);
  }, 120_000);

  it('brings the soil of the liquor into a pool with the water, and leaves it there as the detergent is left', async () => {
    // Under the roof spinner the cup is rinsed through many times: at the end its water is
    // the liquor of the last rinse, with the soil that liquor carries.
    const last = result.ticks - 1;
    const soilThen = result.liquor[LIQUOR_FIELD_COUNT * last + column('suspendedSoil')] as number;
    const flushed = cupPool(first);
    expect(soilThen).toBeGreaterThan(0);
    expect(flushed.carriedSoil / flushed.volume / soilThen).toBeCloseTo(1, 1);
    // A cup that little runs through still holds liquor of the main wash: several times the
    // soil in the same water, as it holds several times the detergent.
    const trickled = cupPool(await inflowScaled(0.03));
    expect(trickled.carriedSoil).toBeGreaterThan(3 * flushed.carriedSoil);
    expect(trickled.detergent).toBeGreaterThan(3 * flushed.detergent);
    // The liquor never held more soil than the load gave up.
    let peak = 0;
    for (let t = 0; t < result.ticks; t++) {
      peak = Math.max(
        peak,
        result.liquor[LIQUOR_FIELD_COUNT * t + column('suspendedSoil')] as number,
      );
    }
    expect(trickled.carriedSoil / trickled.volume).toBeLessThanOrEqual(peak);
  }, 120_000);

  it('leaves the tile that nothing reaches as it was', () => {
    const tile = scene.itemInstance.get('c_tile');
    const record = first.soil.records.find((r) => r.instance === tile);
    if (record === undefined) throw new Error('no record on the tile');
    expect(record.depositCount).toBeGreaterThan(100);
    for (let d = record.firstDeposit; d < record.firstDeposit + record.depositCount; d++) {
      expect(first.soil.mass[d]).toBe(first.soil.mass0[d]);
      expect(first.soil.hydration[d]).toBe(1.5); // a soluble soil has no lag
      for (const set of first.sets) {
        expect(
          set.water.values[
            WATER_FIELD_COUNT * (first.soil.block[d] as number) + WATER_FIELD.wetFraction
          ],
        ).toBe(0);
      }
    }
  });

  it('leaves the residual film of the last rinse on the wet surfaces', () => {
    const rho = bindSharedClosures(params).water(params.get('jets.solveTemperature')).rho;
    let wet = 0;
    for (let b = 0; b < scene.blocks.count; b++) {
      const rinsed = [first.sets[0], first.sets[2]].some(
        (set) =>
          set !== undefined &&
          (set.water.values[WATER_FIELD_COUNT * b + WATER_FIELD.wetFraction] as number) > 0,
      );
      expect(result.retainedFilm[b]).toBeCloseTo(
        rinsed ? rho * params.get('film.standInResidual') : 0,
        9,
      );
      if (rinsed) wet++;
    }
    expect(wet).toBeGreaterThan(1000);
  });

  it('is the same on a repeat', async () => {
    const again = await run();
    expect(again.result.ticks).toBe(result.ticks);
    expect(again.result.liquor).toEqual(result.liquor);
    expect(again.soil.mass).toEqual(first.soil.mass);
    expect(again.soil.hydration).toEqual(first.soil.hydration);
    expect(again.result.retainedFilm).toEqual(result.retainedFilm);
  });
});

describe('the step of the soil (review of the first build)', () => {
  const left = (of: Run): number[] => {
    // Share of the dry mass left per soil record.
    return of.soil.records.map((record) => {
      let now = 0;
      let start = 0;
      for (let d = record.firstDeposit; d < record.firstDeposit + record.depositCount; d++) {
        now += (of.soil.mass[d] as number) * (of.soil.area[d] as number);
        start += (of.soil.mass0[d] as number) * (of.soil.area[d] as number);
      }
      return now / start;
    });
  };

  it('gives the same residue whether the soil is stepped every revolution or every eighth', async () => {
    // The laws are linear or exponential in the step and the exposure of a spray state does
    // not change from one revolution to the next; the liquor moves over minutes.
    const every = await run(createParamSet(registry, { 'tl.soilStride': 1 }));
    const eighth = first; // the default, tl.soilStride = 8
    const coarse = await run(createParamSet(registry, { 'tl.soilStride': 32 }));
    expect(every.result.ticks).toBe(eighth.result.ticks);
    // The liquor and the pools are stepped every revolution whatever the stride.
    expect(every.result.liquor.length).toBe(eighth.result.liquor.length);
    const a = left(every);
    const b = left(eighth);
    const c = left(coarse);
    expect(a.length).toBeGreaterThan(1);
    for (let i = 0; i < a.length; i++) {
      // Within half a per cent of the initial mass at a stride of 8, 2 % at 32.
      expect(Math.abs((b[i] as number) - (a[i] as number)), `record ${i}`).toBeLessThan(0.005);
      expect(Math.abs((c[i] as number) - (a[i] as number)), `record ${i}`).toBeLessThan(0.02);
    }
    // The soil ledger closes at every stride.
    for (const each of [every, coarse]) {
      const ledger = each.result.soilLedger;
      expect((ledger.remaining + ledger.toLiquor + ledger.toPools) / ledger.initial).toBeCloseTo(
        1,
        9,
      );
    }
  }, 120_000);

  it('counts a deposit as wet by the time there is water on its block, not by its area share', async () => {
    // The same exposure with the wetted share of the bare surface set to a tenth (rivulets on
    // a plastic) and the time with water on the block left at 1: the deposits, which the
    // water wets, are cleaned as before.
    const rivulets = await run(params, (exposure) => {
      const values = Float32Array.from(exposure.water.values);
      for (let b = 0; b < exposure.water.blockCount; b++) {
        const o = WATER_FIELD_COUNT * b;
        if ((values[o + WATER_FIELD.wetFraction] as number) > 0) {
          values[o + WATER_FIELD.wetFraction] = 0.1;
        }
      }
      return { ...exposure, water: { ...exposure.water, values } };
    });
    const a = left(first);
    const b = left(rivulets);
    let cleaned = 0;
    for (let i = 0; i < a.length; i++) {
      // (The tile that nothing reaches keeps its soil in both.)
      if (1 - (a[i] as number) > 0.01) cleaned++;
      expect(b[i] as number, `record ${i}`).toBeCloseTo(a[i] as number, 6);
    }
    expect(cleaned).toBeGreaterThanOrEqual(2);
  });

  it('lets a film that the spray has left remove no more than it can take up (soil.heldFilmCapacity)', async () => {
    // The same wash with a residual film that can take up nothing, with the registered
    // capacity (0.02 kg per kg of film) and with a capacity far above any layer: what is
    // removed while a spray is on is untouched, what is removed under films left standing
    // between sprays grows with the capacity. Nothing renews a residual film, so with no
    // capacity it removes nothing.
    const none = await run(createParamSet(registry, { 'soil.heldFilmCapacity': 0 }));
    const ample = await run(createParamSet(registry, { 'soil.heldFilmCapacity': 0.2 }));
    const a = left(first);
    const b = left(none);
    const c = left(ample);
    let fewer = 0;
    for (let i = 0; i < a.length; i++) {
      // Never more removed with a smaller capacity.
      expect(b[i] as number, `record ${i}`).toBeGreaterThanOrEqual((a[i] as number) - 1e-12);
      expect(a[i] as number, `record ${i}`).toBeGreaterThanOrEqual((c[i] as number) - 1e-12);
      if ((b[i] as number) > (c[i] as number) + 1e-4) fewer++;
    }
    // At least one soil of the load was being cleaned by a standing film.
    expect(fewer).toBeGreaterThanOrEqual(1);
    // The ledger closes and the lag is paid as before (a standing film soaks).
    const ledger = none.result.soilLedger;
    expect((ledger.remaining + ledger.toLiquor + ledger.toPools) / ledger.initial).toBeCloseTo(
      1,
      9,
    );
    const plate = first.soil.records.findIndex((r) => r.itemId === 'a_plate');
    const d = first.soil.records[plate]?.firstDeposit ?? 0;
    expect(none.soil.hydration[d]).toBe(first.soil.hydration[d]);
  });

  it('removes far less where the water on a block is old than where it is fresh', async () => {
    // The same exposure with the exchange of the water on every block (the inverse of its
    // age) set to a hundredth of soil.supplyExchange: the soil soaks, but the agents in old
    // water are spent. The renewal column, a local speed, is left as it is and is not read.
    const half = params.get('soil.supplyExchange');
    const standing = await run(params, (exposure) => {
      const values = Float32Array.from(exposure.water.values);
      for (let b = 0; b < exposure.water.blockCount; b++) {
        values[WATER_FIELD_COUNT * b + WATER_FIELD.exchange] = 0.01 * half;
      }
      return { ...exposure, water: { ...exposure.water, values } };
    });
    const a = left(first);
    const b = left(standing);
    // The plate's egg yolk lies under a film (no pool): about a hundredth of the removal.
    const plate = first.soil.records.findIndex((r) => r.itemId === 'a_plate');
    const removedFlowing = 1 - (a[plate] as number);
    const removedStanding = 1 - (b[plate] as number);
    expect(removedFlowing).toBeGreaterThan(0.02);
    expect(removedStanding).toBeLessThan(0.05 * removedFlowing);
    // The lag is paid in standing water as in flowing water.
    const d = first.soil.records[plate]?.firstDeposit ?? 0;
    expect(standing.soil.hydration[d]).toBe(first.soil.hydration[d]);
  });
});
