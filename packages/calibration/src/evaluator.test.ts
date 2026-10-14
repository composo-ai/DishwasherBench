import {
  createMemoryExposureCache,
  wash,
  type WashInput,
  type WashScene,
} from '@spotless/sim-core';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createCalibrationParams, washOverridesOf } from './cal-params.ts';
import { EvaluatorPool, HydroMismatchError, preparationKeyOf, prepareRecord } from './evaluator.ts';
import { fitRecords } from './fit.ts';
import { washLoadOfRecord } from './load.ts';
import { readFittedParams, writeJsonFile } from './node/index.ts';
import { createObjective, recordLikelihood } from './objective.ts';
import { cleanProbability, groupMeanLogLikelihood } from './observation.ts';
import {
  WASH_RECORD_FORMAT,
  type RecordItem,
  type RecordObservation,
  type WashRecord,
} from './record.ts';
import { machineOfRecord, programmeOfRecord, RecordSetupError } from './setup.ts';
import { synthesiseRecord, tileRecord } from './synthetic.ts';

/**
 * One exposure cache and one set of scenes for the file: a load is washed and its scene built
 * once, however many times it is prepared.
 */
const cache = createMemoryExposureCache();
const scenes = new Map<string, WashScene>();
const shared = { cache, scenes };

const soil = (
  id: string,
  type: string,
  region: string,
  coverage: number,
  amount: number,
): RecordItem['soils'][number] => ({
  id,
  type,
  amount_g: amount,
  where: { regions: [{ region, coverage }] },
  drying: { time_h: 2 },
  heat: { history: 'none' },
});

/** Three catalogue items, soiled on regions. */
const WARE: RecordItem[] = [
  {
    id: 'plate_facing',
    type: 'dessert_plate_porcelain_190',
    position_mm: [-120, -130, 172],
    quat_wxyz: [0.5736, 0.8192, 0, 0],
    soils: [
      soil('sauce', 'tomato_sauce', 'well', 0.6, 2),
      soil('egg', 'egg_yolk_dried', 'rim', 0.3, 0.5),
    ],
  },
  {
    id: 'plate_away',
    type: 'dessert_plate_porcelain_190',
    position_mm: [120, -130, 172],
    quat_wxyz: [0.8192, 0.5736, 0, 0],
    soils: [
      soil('sauce', 'tomato_sauce', 'well', 0.6, 2),
      soil('egg', 'egg_yolk_dried', 'rim', 0.3, 0.5),
    ],
  },
  {
    id: 'mug_upright',
    type: 'mug_ceramic_300',
    position_mm: [-120, 100, 423],
    quat_wxyz: [1, 0, 0, 0],
    soils: [soil('tea', 'tea_tannin', 'interior', 1, 0.6)],
  },
];

/**
 * Every record of this file is the same five items in the same places (two test tiles and the
 * three above), so that the water is computed once; only soils and observations differ.
 */
function load(options: {
  id: string;
  disc?: number;
  amount?: number;
  kinds?: RecordObservation['kind'][];
  at?: number[];
  ware?: 'soiled' | 'clean';
  sd?: number;
}): WashRecord {
  const tiles = tileRecord({
    id: options.id,
    tiles: [
      {
        id: 'tile_a',
        rack: 'lower_rack',
        x_mm: 150,
        y_mm: 400,
        facing: '+x',
        soil: 'egg_yolk_dried',
        amount_g: options.amount ?? 0.3,
        ...(options.disc === undefined ? {} : { disc_mm: options.disc }),
      },
      {
        id: 'tile_b',
        rack: 'upper_rack',
        x_mm: 380,
        y_mm: 250,
        facing: 'down',
        soil: 'egg_yolk_dried',
        amount_g: options.amount ?? 0.3,
        ...(options.disc === undefined ? {} : { disc_mm: options.disc }),
      },
    ],
    kinds: options.kinds ?? ['mass_fraction'],
    at_s: options.at ?? [],
    interruptedKinds: ['mass_fraction'],
    sd: { mass_fraction: options.sd ?? 0.03 },
    levelSeed: 7,
    simSeed: 3,
  });
  const ware = WARE.map((item) => (options.ware === 'clean' ? { ...item, soils: [] } : item));
  return { ...tiles, load: { items: [...tiles.load.items, ...ware] } };
}

const ALL = ['tile_a', 'tile_b', 'plate_facing', 'plate_away', 'mug_upright'];

describe('prepareRecord and evaluate against the wash itself', () => {
  it('predicts for every item what wash() reports for it', async () => {
    const base = load({ id: 'equivalence' });
    const whole: WashRecord = {
      ...base,
      provenance: { methods: { m: { description: 'test', sd: 0.05 } } },
      observations: [
        ...ALL.map((item): RecordObservation => ({ item, kind: 'residual_mass', method: 'm' })),
        { item: 'plate_facing', target: { region: 'rim' }, kind: 'residual_mass', method: 'm' },
        { item: 'plate_facing', target: { soil: 'sauce' }, kind: 'mass_fraction', method: 'm' },
      ],
    };
    const params = createCalibrationParams({
      'soil.egg_yolk.rateRef': 5e-5,
      'soil.detachTime': 30,
    });
    const prepared = await prepareRecord(whole, params, { ...shared, restrict: 'all' });
    const prediction = await prepared.evaluate(params);

    const machine = machineOfRecord(whole);
    const washLoad = washLoadOfRecord(whole, machine.spec, machine.config);
    const input: WashInput = {
      machine: machine.spec,
      config: machine.config,
      programme: programmeOfRecord(whole, machine.spec, machine.config).programme,
      items: washLoad.items,
      tier: 'fast',
      levelSeed: 7,
      simSeed: 3,
      params: washOverridesOf(params),
    };
    const result = await wash(input, { cache });
    // The wash finds the exposure the preparation left in the cache.
    expect(result.run.exposureCacheHits).toBe(prepared.info.sprayStates);
    expect(result.run.exposureComputed).toBe(0);
    expect(prepared.info.deposits).toBe(result.run.deposits);
    expect(prepared.info.blocks).toBe(result.run.blocks);
    expect(prepared.info.soilCells).toBe(result.run.soilCells);
    expect(prepared.info.ticks).toBe(result.machine.ticks);

    ALL.forEach((id, i) => {
      const state = prediction.states[i];
      const washed = result.items.find((x) => x.itemId === id);
      if (state === undefined || washed === undefined) throw new Error('missing');
      // Masses to 1e-6 relative (the result's arrays are f32, the evaluator sums in f64).
      expect(state.initialMass_mg / washed.initialMass_mg, id).toBeCloseTo(1, 5);
      expect((state.residualMass_mg + 1e-9) / (washed.residualMass_mg + 1e-9), id).toBeCloseTo(
        1,
        5,
      );
      expect(state.visibleAreaMm2, id).toBeCloseTo(washed.visibleAreaMm2, 3);
      expect(state.specks, id).toBe(washed.specks);
      expect(state.score, id).toBe(washed.score);
      expect(state.clean, id).toBe(washed.clean);
      expect(state.pooledWater_mL, id).toBeCloseTo(washed.water.pooled_mL, 9);
      expect(prediction.eta[i]).toBe(state.residualMass_mg);
    });
    // A region and a single soil of an item.
    const washedPlate = result.items.find((x) => x.itemId === 'plate_facing');
    const rim = washedPlate?.regions.find((r) => r.regionId === 'rim');
    expect((prediction.states[5]?.residualMass_mg ?? 0) / (rim?.residualMass_mg ?? 1)).toBeCloseTo(
      1,
      5,
    );
    const sauce = washedPlate?.soils[0];
    expect(prediction.eta[6]).toBeCloseTo(
      (sauce?.residualMass_mg ?? 0) / (sauce?.initialMass_mg ?? 1),
      6,
    );
    // Something was removed and something was left, or the comparison says nothing.
    expect(result.machine.soil.remaining_mg).toBeLessThan(0.98 * result.machine.soil.initial_mg);
    expect(result.machine.soil.remaining_mg).toBeGreaterThan(0);

    // A second preparation of the same load reads the summary of the first: no wash, no exposure.
    const again = await prepareRecord({ ...whole, id: 'equivalence-again' }, params, shared);
    expect(again.info.exposureComputed).toBe(0);
    expect(again.info.exposureCacheHits).toBe(prepared.info.sprayStates);
  });

  it('replays only the observed items, with the others as a fixed history in the liquor', async () => {
    const base = load({ id: 'restricted' });
    const one: WashRecord = {
      ...base,
      provenance: { methods: { m: { description: 'test', sd: 0.05 } } },
      observations: [{ item: 'mug_upright', kind: 'mass_fraction', method: 'm' }],
    };
    const params = createCalibrationParams();
    const all = await prepareRecord(one, params, { ...shared, restrict: 'all' });
    const observed = await prepareRecord(one, params, shared);
    const alone = await prepareRecord(one, params, { ...shared, background: false });
    expect(observed.info.itemsReplayed).toBe(1);
    expect(observed.info.deposits).toBeLessThan(0.5 * all.info.deposits);
    expect(observed.info.depositsOfLoad).toBe(all.info.deposits);
    expect(observed.info.restriction).toMatch(
      /1 observed items are replayed, those of the other 4 items are not/,
    );
    expect(observed.info.restriction).toMatch(/fed in as the history/);
    expect(alone.info.restriction).toMatch(/is ignored/);
    const full = (await all.evaluate(params)).eta[0] ?? 0;
    const withBackground = (await observed.evaluate(params)).eta[0] ?? 0;
    const without = (await alone.evaluate(params)).eta[0] ?? 0;
    // Tea leaves by bleaching, and soil in the liquor consumes the bleach: the background counts.
    expect(Math.abs(withBackground - full)).toBeLessThan(2e-3);
    expect(Math.abs(withBackground - full)).toBeLessThanOrEqual(Math.abs(without - full) + 1e-12);
    expect(full).toBeGreaterThan(0);
    expect(full).toBeLessThan(1);
  });
});

describe('patches, interrupted observations and what a replay costs', () => {
  const tiles = load({
    id: 'tiles',
    disc: 50,
    kinds: ['mass_fraction', 'area_fraction'],
    at: [1500, 2700, 3900],
    ware: 'clean',
  });

  it('cuts a patch out of its region with the weighed amount on it', async () => {
    // A weighed soil: the registry lays down exactly the amount stated (soil.amountCv 0).
    const weighed = createCalibrationParams();
    const prepared = await prepareRecord(tiles, weighed, shared);
    expect(prepared.info.notes).toEqual([]);
    const prediction = await prepared.evaluate(weighed);
    const end = prepared.observations.findIndex((o) => o.itemId === 'tile_a' && o.at === null);
    const state = prediction.states[end];
    // A 50 mm disc is 1963 mm2; on 2 mm soil cells the outline is met to 4 %.
    expect((state?.soiledAreaMm2 ?? 0) / 1963.5).toBeGreaterThan(0.96);
    expect((state?.soiledAreaMm2 ?? 0) / 1963.5).toBeLessThan(1.04);
    // Dried egg yolk is half solids: 0.3 g wet is 150 mg dry, whatever the cells.
    expect(state?.initialMass_mg).toBeCloseTo(150, 6);
    expect(prepared.info.restriction).toMatch(/2 soils lie on described patches/);
  });

  it('reports a patch whose centre is not on its region', async () => {
    const off = JSON.parse(JSON.stringify(tiles)) as WashRecord;
    const patch = (
      off.load.items[0]?.soils[0]?.where as unknown as { patch: { centre_mm: number[] } }
    ).patch;
    patch.centre_mm = [0, 0, 80];
    const prepared = await prepareRecord(
      { ...off, id: 'tiles-off' },
      createCalibrationParams(),
      shared,
    );
    expect(prepared.info.notes.join('\n')).toMatch(
      /patch of tile_a soil 1: the centre of the patch is 74\.\d mm from region "top"; it is left out/,
    );
  });

  it('reads observations taken during the run off the same replay, in order of time', async () => {
    const prepared = await prepareRecord(tiles, createCalibrationParams(), shared);
    const params = createCalibrationParams({
      'soil.egg_yolk.rateRef': 8e-5,
      'liq.proteaseHalfLife': 7200,
    });
    const prediction = await prepared.evaluate(params);
    for (const item of ['tile_a', 'tile_b']) {
      const series = prepared.observations
        .map((o, i) => ({ o, eta: prediction.eta[i] ?? 0 }))
        .filter((x) => x.o.itemId === item && x.o.kind === 'mass_fraction')
        .sort((a, b) => (a.o.at ?? Infinity) - (b.o.at ?? Infinity));
      expect(series.map((x) => x.o.at)).toEqual([1500, 2700, 3900, null]);
      for (let i = 1; i < series.length; i++) {
        expect(series[i]?.eta ?? 1).toBeLessThanOrEqual(series[i - 1]?.eta ?? 0);
      }
    }
    // A slower enzyme rate leaves more on a tile that is being cleaned.
    const slower = await prepared.evaluate(
      createCalibrationParams({ 'soil.egg_yolk.rateRef': 2e-5, 'liq.proteaseHalfLife': 7200 }),
    );
    const ends = prepared.observations
      .map((o, i) => ({ o, i }))
      .filter((x) => x.o.at === null && x.o.kind === 'mass_fraction');
    const moved = ends.filter((x) => (prediction.eta[x.i] ?? 1) < 0.999);
    expect(moved.length).toBeGreaterThan(0);
    for (const x of moved) expect(prediction.eta[x.i] ?? 1).toBeLessThan(slower.eta[x.i] ?? 0);
  });

  it('does not replay when only an observation constant changes, and refuses another water', async () => {
    const prepared = await prepareRecord(tiles, createCalibrationParams(), shared);
    const first = await prepared.evaluate(createCalibrationParams({ 'soil.KE': 0.9 }));
    expect(first.reused).toBe(false);
    const second = await prepared.evaluate(
      createCalibrationParams({ 'soil.KE': 0.9, 'obs.areaModelSd': 0.1 }),
    );
    expect(second.reused).toBe(true);
    expect(Array.from(second.eta)).toEqual(Array.from(first.eta));
    expect(second.constants.areaModelSd).toBe(0.1);
    await expect(prepared.evaluate(createCalibrationParams({ 'jets.kStag': 1.5 }))).rejects.toThrow(
      HydroMismatchError,
    );
    // The pool keeps one preparation per record and water.
    const pool = new EvaluatorPool(shared);
    const a = await pool.get(tiles, createCalibrationParams());
    expect(await pool.get(tiles, createCalibrationParams({ 'soil.KE': 1.1 }))).toBe(a);
  });

  it('applies the programme parameters and the replay-time scales without a new exposure', async () => {
    const prepared = await prepareRecord(tiles, createCalibrationParams(), shared);
    const base = await prepared.evaluate(createCalibrationParams());
    const cooler = await prepared.evaluate(
      createCalibrationParams({ 'prog.mainWashTargetShift': -12 }),
    );
    const shorter = await prepared.evaluate(
      createCalibrationParams({ 'prog.mainWashHoldScale': 0.4 }),
    );
    const ends = prepared.observations
      .map((o, i) => ({ o, i }))
      .filter((x) => x.o.at === null && x.o.kind === 'mass_fraction')
      .map((x) => x.i);
    const change = (a: Float64Array, b: Float64Array): number =>
      Math.max(...ends.map((i) => Math.abs((a[i] ?? 0) - (b[i] ?? 0))));
    // Which way each goes depends on how the enzyme fares in a cooler or shorter main wash, so
    // only the change is asserted (on Eco 50 a main wash 12 K cooler moves it by about 0.45 %).
    expect(change(cooler.eta, base.eta)).toBeGreaterThan(0.002);
    expect(change(shorter.eta, base.eta)).toBeGreaterThan(0.005);
    const scaled = await prepared.evaluate(
      createCalibrationParams({ 'cal.holdTimeScale': 0.2, 'cal.jetShearScale': 3 }),
    );
    expect(scaled.reused).toBe(false);
    expect(ends.every((i) => Number.isFinite(scaled.eta[i] ?? Number.NaN))).toBe(true);
  });

  it('thins the soil cells with masses and areas scaled back up', async () => {
    const full = await prepareRecord(tiles, createCalibrationParams(), shared);
    const thinned = await prepareRecord(tiles, createCalibrationParams(), { ...shared, thin: 4 });
    expect(thinned.info.deposits / full.info.deposits).toBeGreaterThan(0.2);
    expect(thinned.info.deposits / full.info.deposits).toBeLessThan(0.3);
    const a = await full.evaluate(createCalibrationParams());
    const b = await thinned.evaluate(createCalibrationParams());
    full.observations.forEach((o, i) => {
      if (o.kind !== 'mass_fraction') return;
      expect(Math.abs((b.eta[i] ?? 0) - (a.eta[i] ?? 0)), o.id).toBeLessThan(0.03);
      expect((b.states[i]?.initialMass_mg ?? 0) / (a.states[i]?.initialMass_mg ?? 1)).toBeCloseTo(
        1,
        6,
      );
      expect((b.states[i]?.soiledAreaMm2 ?? 0) / (a.states[i]?.soiledAreaMm2 ?? 1)).toBeGreaterThan(
        0.9,
      );
    });
    expect(thinned.info.restriction).toMatch(/one soil cell in 4 is kept/);
  });
});

describe('a small recovery on the wash simulation', () => {
  it('finds a moved egg-yolk rate again from two tiles looked at three times', async () => {
    const plan = load({
      id: 'recovery',
      disc: 20,
      amount: 0.05,
      at: [2000, 3000, 4000],
      ware: 'clean',
      sd: 0.02,
    });
    const pool = new EvaluatorPool(shared);
    // Clean data and the plain likelihood: the allowance for gross errors has its own tests.
    const plain = { 'obs.outlierShare': 0 };
    const truth = createCalibrationParams({ 'soil.egg_yolk.rateRef': 5.5e-5, ...plain });
    const observed = await synthesiseRecord(plan, truth, { seed: 21, pool });
    expect(observed.observations.every((o) => typeof o.value === 'number')).toBe(true);
    const fit = await fitRecords([observed], ['soil.egg_yolk.rateRef'], {
      pool,
      base: createCalibrationParams(plain),
      starts: 0,
      polish: 0,
      restarts: 1,
      maxEvaluations: 40,
      profiles: 0,
      predictiveDraws: 0,
      scanPoints: 0,
    });
    const p = fit.parameters[0];
    if (p === undefined) throw new Error('missing');
    // The truth is inside the 95 % interval, which is well inside the registered range.
    expect(p.interval[0]).toBeLessThan(5.5e-5);
    expect(p.interval[1]).toBeGreaterThan(5.5e-5);
    expect(p.interval[1] / p.interval[0]).toBeLessThan(2.5);
    expect(p.verdict).not.toBe('not identified');
    expect(fit.estimate.logPosterior).toBeGreaterThan(fit.start.logPosterior);
  });
});

describe('verdicts and scores against the inspector on a soiled load', () => {
  it('gives P(clean) above one half exactly where the inspector says clean', async () => {
    // Tea in a mug, sauce and egg on plates, egg on tiles: films of every thickness as the
    // bleach and the enzymes are turned up and down.
    const base = load({ id: 'verdicts' });
    const record: WashRecord = {
      ...base,
      provenance: { methods: { m: { description: 'test' } } },
      observations: ALL.flatMap((item): RecordObservation[] => [
        { item, kind: 'clean', method: 'm' },
        { item, kind: 'score', method: 'm' },
      ]),
    };
    const prepared = await prepareRecord(record, createCalibrationParams(), {
      ...shared,
      restrict: 'all',
    });
    const sets: Record<string, number>[] = [
      {},
      { 'liq.xTaed': 0.25, 'soil.bleachRate': 2.5e-3 },
      { 'liq.xTaed': 0.3, 'soil.bleachRate': 3e-3, 'soil.tea.visibleFraction': 0.3 },
      { 'soil.egg_yolk.rateRef': 9e-5, 'liq.proteaseHalfLife': 12000, 'soil.egg_yolk.tLag': 60 },
      {
        'soil.egg_yolk.rateRef': 1e-4,
        'liq.proteaseHalfLife': 14400,
        'liq.xProtease': 0.05,
        'soil.bleachRate': 3e-3,
        'liq.xTaed': 0.3,
        'soil.tea.visibleFraction': 0.5,
      },
      { 'inspect.maxAreaMm2': 200, 'soil.bleachRate': 2e-3 },
      // With sub-element coverage (the spread of the loading inside a deposit, as the
      // anchored sets have it): the evaluator sums the same shares as the inspector.
      { 'soil.subCellCv': 0.1 },
      { 'soil.subCellCv': 0.1, 'soil.egg_yolk.rateRef': 9e-5, 'liq.proteaseHalfLife': 12000 },
      { 'soil.subCellCv': 0.3, 'liq.xTaed': 0.25, 'soil.bleachRate': 2.5e-3 },
    ];
    let clean = 0;
    let dirty = 0;
    for (const overrides of sets) {
      const prediction = await prepared.evaluate(createCalibrationParams(overrides));
      record.observations.forEach((observation, i) => {
        const state = prediction.states[i];
        if (state === undefined) throw new Error('missing');
        const where = `${observation.item} at ${JSON.stringify(overrides)}`;
        if (observation.kind === 'clean') {
          const p = cleanProbability(prediction.eta[i] as number, prediction.constants);
          expect(p > 0.5, `${where}: P(clean) ${p}, inspector ${state.clean}`).toBe(state.clean);
          if (state.clean) clean++;
          else dirty++;
          // The sign of the threshold is the inspector's finding about the area.
          expect(state.cleanThresholdLog < 0, where).toBe(
            state.visibleAreaMm2 <= prediction.rule.maxAreaMm2,
          );
        } else {
          // The expected score is the inspector's wherever no band is within a factor 2.1 of
          // being crossed and the specks do not decide.
          const near = state.bandThresholdLog.some((t) => Math.abs(t) < 0.75);
          if (!near && state.specks === 0) {
            expect(Math.abs((prediction.eta[i] as number) - state.score), where).toBeLessThan(0.5);
          }
        }
      });
    }
    // Both verdicts occurred, or the comparison says nothing.
    expect(clean).toBeGreaterThan(0);
    expect(dirty).toBeGreaterThan(0);
  });
});

describe('the mean score of a group of items (a published class mean)', () => {
  it('predicts the weighted mean of the item scores and scores it with the stated uncertainty', async () => {
    const base = load({ id: 'groups' });
    const record: WashRecord = {
      ...base,
      provenance: {
        methods: {
          m: { description: 'test' },
          published: { description: 'a published class mean' },
        },
      },
      observations: ALL.map((item): RecordObservation => ({ item, kind: 'score', method: 'm' })),
      group_observations: [
        {
          id: 'all.mean_score',
          kind: 'mean_score',
          items: ALL.map((item) => ({ item })),
          value: 3.5,
          sd: 0.5,
          method: 'published',
        },
        {
          id: 'plates.weighted',
          kind: 'mean_score',
          items: [
            { item: 'plate_facing', weight: 3 },
            { item: 'plate_away', weight: 1 },
          ],
          value: 4,
          sd: 0.4,
          method: 'published',
        },
        // A planned group observation: predicted, not scored.
        {
          id: 'tiles.planned',
          kind: 'mean_score',
          items: [{ item: 'tile_a' }, { item: 'tile_b' }],
          sd: 0.5,
          method: 'published',
        },
      ],
    };
    const params = createCalibrationParams();
    const prepared = await prepareRecord(record, params, { ...shared, restrict: 'all' });
    expect(prepared.groups.map((g) => g.id)).toEqual([
      'all.mean_score',
      'plates.weighted',
      'tiles.planned',
    ]);
    const prediction = await prepared.evaluate(params);
    const eta = (item: string): number =>
      prediction.eta[prepared.observations.findIndex((o) => o.itemId === item)] as number;
    const groupEta = prediction.groupEta as Float64Array;
    // The predicted group mean is the weighted mean of what a score observation of each item
    // predicts.
    expect(groupEta[0]).toBeCloseTo(ALL.reduce((sum, item) => sum + eta(item), 0) / ALL.length, 9);
    expect(groupEta[1]).toBeCloseTo((3 * eta('plate_facing') + eta('plate_away')) / 4, 9);
    expect(groupEta[2]).toBeCloseTo((eta('tile_a') + eta('tile_b')) / 2, 9);
    // In the likelihood: a normal term per group with a value, nothing for the planned one.
    const likelihood = recordLikelihood(record, prepared.observations, prediction);
    expect(likelihood.perGroup[0]).toBeCloseTo(
      groupMeanLogLikelihood(3.5, groupEta[0] as number, 0.5),
      12,
    );
    expect(likelihood.perGroup[1]).toBeCloseTo(
      groupMeanLogLikelihood(4, groupEta[1] as number, 0.4),
      12,
    );
    expect(Number.isNaN(likelihood.perGroup[2])).toBe(true);
    // The item observations have no values (planned), so the record's log likelihood is the
    // two group terms.
    expect(likelihood.logLikelihood).toBeCloseTo(
      (likelihood.perGroup[0] as number) + (likelihood.perGroup[1] as number),
      12,
    );
    // A group observation alone is enough to have its items replayed and inspected.
    const alone: WashRecord = {
      ...record,
      id: 'groups-alone',
      observations: [],
      group_observations: (record.group_observations ?? []).slice(0, 1),
    };
    const preparedAlone = await prepareRecord(alone, params, shared);
    const again = await preparedAlone.evaluate(params);
    expect(again.groupEta?.[0]).toBeCloseTo(groupEta[0] as number, 6);
    expect(preparedAlone.info.itemsReplayed).toBe(ALL.length);
  });

  it('is a normal about the predicted mean', () => {
    const at = groupMeanLogLikelihood(3.68, 3.68, 1.11);
    expect(at).toBeCloseTo(-Math.log(1.11 * Math.sqrt(2 * Math.PI)), 12);
    // One standard uncertainty away costs half a log unit, two cost two.
    expect(at - groupMeanLogLikelihood(3.68, 3.68 - 1.11, 1.11)).toBeCloseTo(0.5, 12);
    expect(at - groupMeanLogLikelihood(3.68, 3.68 + 2.22, 1.11)).toBeCloseTo(2, 12);
  });
});

describe('one pool, records that differ', () => {
  const plan = load({ id: 'pooled', disc: 20, amount: 0.05, at: [3000], ware: 'clean' });

  it('scores each record against its own values, whatever its id', async () => {
    const pool = new EvaluatorPool(shared);
    const truth = createCalibrationParams({ 'soil.egg_yolk.rateRef': 5e-5 });
    const one = await synthesiseRecord(plan, truth, { seed: 1, pool, id: 'same-id' });
    const two = await synthesiseRecord(plan, truth, { seed: 2, pool, id: 'same-id' });
    expect(one.observations[0]?.value).not.toBe(two.observations[0]?.value);
    // The default id carries the seed.
    expect((await synthesiseRecord(plan, truth, { seed: 2, pool })).id).toBe('pooled-synthetic-s2');
    const z = [Math.log(3e-5)];
    const at = async (record: WashRecord, p: EvaluatorPool): Promise<number> =>
      (await createObjective([record], ['soil.egg_yolk.rateRef'], { pool: p }).evaluate(z))
        .logLikelihood;
    const first = await at(one, pool);
    const second = await at(two, pool);
    const fresh = await at(two, new EvaluatorPool(shared));
    expect(second).not.toBe(first);
    expect(second).toBe(fresh);
    // They share one preparation: only what was observed differs.
    expect(preparationKeyOf(one)).toBe(preparationKeyOf(two));
    expect(await pool.get(one, truth)).toBe(await pool.get(two, truth));
  });

  it('prepares again for a record of the same id whose load differs', async () => {
    const pool = new EvaluatorPool(shared);
    const params = createCalibrationParams();
    const heavier: WashRecord = {
      ...plan,
      load: {
        items: plan.load.items.map((item) => ({
          ...item,
          soils: item.soils.map((soil) => ({ ...soil, amount_g: 2 * soil.amount_g })),
        })),
      },
    };
    expect(preparationKeyOf(heavier)).not.toBe(preparationKeyOf(plan));
    const a = await pool.get(plan, params);
    const b = await pool.get(heavier, params);
    expect(b).not.toBe(a);
    const light = (await a.evaluate(params)).states[0]?.initialMass_mg ?? 0;
    const heavy = (await b.evaluate(params)).states[0]?.initialMass_mg ?? 0;
    expect(heavy / light).toBeCloseTo(2, 6);
  });
});

describe('the background of a restricted replay', () => {
  it('is exact where it was computed, drifts away from there, and can be moved', async () => {
    const base = load({ id: 'background' });
    const record: WashRecord = {
      ...base,
      provenance: { methods: { m: { description: 'test', sd: 0.05 } } },
      observations: [
        { item: 'mug_upright', kind: 'mass_fraction', method: 'm' },
        { item: 'mug_upright', kind: 'area_fraction', method: 'm' },
      ],
    };
    const defaults = createCalibrationParams();
    const moved = createCalibrationParams({
      'liq.xTaed': 0.25,
      'soil.bleachRate': 2.5e-3,
      'soil.egg_yolk.rateRef': 9e-5,
      'liq.proteaseHalfLife': 9000,
      'liq.xProtease': 0.03,
    });
    const prepared = await prepareRecord(record, defaults, shared);
    expect(prepared.backgroundAt()).toEqual({});
    const worst = async (at: typeof defaults): Promise<number> => {
      const restricted = await prepared.evaluate(at);
      const full = await prepared.evaluateFull(at);
      return Math.max(...Array.from(full.eta, (v, i) => Math.abs(v - (restricted.eta[i] ?? 0))));
    };
    // Exact (to rounding) at the parameters of the preparation.
    expect(await worst(defaults)).toBeLessThan(1e-5);
    const drift = await worst(moved);
    // Moved to the other parameters it is exact there, and the drift is now at the first.
    expect(await prepared.refreshBackground(moved)).toBe(true);
    expect(prepared.backgroundAt()).toMatchObject({ 'liq.xTaed': 0.25 });
    expect(await worst(moved)).toBeLessThan(1e-5);
    expect(await worst(moved)).toBeLessThanOrEqual(drift + 1e-12);
    // With every soil replayed there is no background to move.
    const all = await prepareRecord(record, defaults, { ...shared, restrict: 'all' });
    expect(all.backgroundAt()).toBeNull();
    expect(await all.refreshBackground(moved)).toBe(false);
    expect(Array.from((await all.evaluateFull(moved)).eta)).toEqual(
      Array.from((await all.evaluate(moved)).eta),
    );
  });
});

describe('a fitted set read back from its files', () => {
  it('reproduces the fit in wash(), a fitted main-wash temperature included', async () => {
    // Whole-face soils, so that wash() can take the same load.
    const plan = load({ id: 'roundtrip', amount: 0.85, ware: 'clean' });
    const pool = new EvaluatorPool(shared);
    const truth = createCalibrationParams({
      'soil.egg_yolk.rateRef': 6e-5,
      'prog.mainWashTargetShift': -6,
      'obs.outlierShare': 0,
    });
    const observed = await synthesiseRecord(plan, truth, { seed: 21, pool });
    const fit = await fitRecords(
      [observed],
      ['soil.egg_yolk.rateRef', 'prog.mainWashTargetShift'],
      {
        pool,
        base: createCalibrationParams({ 'obs.outlierShare': 0 }),
        starts: 0,
        polish: 0,
        restarts: 0,
        maxEvaluations: 14,
        profiles: 0,
        predictiveDraws: 0,
        scanPoints: 0,
        resetUnidentified: false,
        adaptStep: false,
      },
    );
    // The parameter file holds the wash registry's keys only, and says it is not the whole fit.
    expect(Object.keys(fit.paramSet.overrides)).toEqual(['soil.egg_yolk.rateRef']);
    expect(fit.calibrationOverrides['prog.mainWashTargetShift']).toBeDefined();
    expect(fit.calibrationOverrides['prog.mainWashTargetShift']).not.toBe(0);
    expect(fit.needsCalibrationKeys).toBe(true);
    expect(fit.paramSet.provenance.note).toMatch(/NOT THE WHOLE FIT: prog\.mainWashTargetShift/);
    expect(fit.report).toMatch(/the parameter file alone does not reproduce it/);
    expect(fit.washes).toHaveLength(1);
    expect(fit.washes[0]?.exact).toBe(true);

    const dir = mkdtempSync(join(tmpdir(), 'spotless-fit-'));
    try {
      // As `spotless-fit fit --out` writes them.
      writeJsonFile(join(dir, 'params.json'), fit.paramSet);
      writeJsonFile(join(dir, 'calibration.json'), fit.calibrationOverrides);
      writeJsonFile(join(dir, 'wash-input.json'), fit.washes[0]?.input);
      const masses = (result: Awaited<ReturnType<typeof wash>>): Map<string, number> =>
        new Map(result.items.map((i) => [i.itemId, i.residualMass_mg / i.initialMass_mg]));
      const predicted = new Map(
        fit.observations.map((o) => [o.observationId.split('.')[0] as string, o.eta]),
      );
      expect(predicted.size).toBe(2);

      // 1. wash() from the wash-input file, as plain JSON.
      const input = JSON.parse(readFileSync(join(dir, 'wash-input.json'), 'utf8')) as WashInput;
      const fromFile = masses(await wash(input, { cache }));
      for (const [item, eta] of predicted) expect(fromFile.get(item)).toBeCloseTo(eta, 6);

      // 2. The two parameter files read back, and the record prepared with them: the same
      // programme and the same overrides as the fit's own wash input.
      const read = readFittedParams(join(dir, 'params.json'));
      expect(read.missing).toBe(false);
      expect(read.warning).toBeNull();
      expect(read.params.get('prog.mainWashTargetShift')).toBe(
        fit.calibrationOverrides['prog.mainWashTargetShift'],
      );
      const again = await prepareRecord(observed, read.params, shared);
      const rebuilt = again.washInputAt(read.params);
      expect(rebuilt.programme).toEqual(fit.washes[0]?.programme);
      expect(rebuilt.input.params).toEqual(fit.washes[0]?.input.params);
      const targets = rebuilt.programme.steps.flatMap((step) =>
        step.kind === 'heat' && step.phase === 'main_wash' ? [step.target] : [],
      );
      const written = again.programme.steps.flatMap((step) =>
        step.kind === 'heat' && step.phase === 'main_wash' ? [step.target] : [],
      );
      expect(targets.length).toBeGreaterThan(0);
      targets.forEach((target, i) =>
        expect(target - (written[i] ?? 0)).toBeCloseTo(
          fit.calibrationOverrides['prog.mainWashTargetShift'] as number,
          9,
        ),
      );

      // 3. The parameter file alone is not the fit, and reading it says so.
      rmSync(join(dir, 'calibration.json'));
      const alone = readFittedParams(join(dir, 'params.json'));
      expect(alone.missing).toBe(true);
      expect(alone.warning).toMatch(/is not the whole fit and .*calibration\.json is missing/);
      const partial = await again.evaluate(alone.params);
      const off = Math.max(
        ...fit.observations.map((o, i) => Math.abs((partial.eta[i] ?? 0) - o.eta)),
      );
      expect(off).toBeGreaterThan(1e-3);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('says where wash() cannot do what the fit did', async () => {
    const patched = load({ id: 'inexact', disc: 20, amount: 0.05, ware: 'clean' });
    const prepared = await prepareRecord(patched, createCalibrationParams(), shared);
    const made = prepared.washInputAt(createCalibrationParams({ 'cal.jetShearScale': 1.5 }));
    expect(made.exact).toBe(false);
    expect(made.notes.join(' ')).toMatch(/2 soils lie on described patches/);
    expect(made.notes.join(' ')).toMatch(
      /cal\.jetShearScale = 1\.5 is applied by the calibration only/,
    );
  });
});

describe('input scenarios of a wash whose inputs were not measured', () => {
  const plan = load({ id: 'scenarios', ware: 'clean' });
  const params = createCalibrationParams();

  it('replays each scenario with its layout seed, its amounts and its parameters', async () => {
    const record: WashRecord = {
      ...plan,
      sim: {
        ...plan.sim,
        scenarios: [
          {},
          { level_seed: 11, amount_factors: { tile_a: 2 } },
          { weight: 2, params: { 'soil.KE': 0.5 } },
        ],
      },
    };
    const prepared = await prepareRecord(record, params, shared);
    expect(prepared.info.scenarios).toBe(3);
    const prediction = await prepared.evaluate(params);
    const scenarios = prediction.scenarios;
    if (scenarios === undefined) throw new Error('no scenarios in the prediction');
    expect(scenarios.weights).toEqual([0.25, 0.25, 0.5]);
    // The first scenario is the record as written, and is what `eta` reports.
    const written = await (await prepareRecord(plan, params, shared)).evaluate(params);
    expect(written.scenarios).toBeUndefined();
    expect(Array.from(prediction.eta)).toEqual(Array.from(written.eta));
    expect(Array.from(scenarios.eta[0] as Float64Array)).toEqual(Array.from(written.eta));
    // The second: another layout and twice the soil on one tile.
    const doubled: WashRecord = {
      ...plan,
      id: 'scenarios-doubled',
      sim: { ...plan.sim, level_seed: 11 },
      load: {
        items: plan.load.items.map((item) =>
          item.id === 'tile_a'
            ? { ...item, soils: item.soils.map((s) => ({ ...s, amount_g: 2 * s.amount_g })) }
            : item,
        ),
      },
    };
    const second = await (await prepareRecord(doubled, params, shared)).evaluate(params);
    (scenarios.eta[1] as Float64Array).forEach((eta, i) =>
      expect(eta).toBeCloseTo(second.eta[i] as number, 12),
    );
    // The third: the record as written at the scenario's parameters.
    const third = await (
      await prepareRecord(plan, params, shared)
    ).evaluate(params.with({ 'soil.KE': 0.5 }));
    (scenarios.eta[2] as Float64Array).forEach((eta, i) =>
      expect(eta).toBeCloseTo(third.eta[i] as number, 12),
    );
    // More soil on a tile leaves another share of it: the scenarios differ.
    const a = prepared.observations.findIndex((o) => o.itemId === 'tile_a' && o.at === null);
    expect((scenarios.eta[1] as Float64Array)[a]).not.toBe((scenarios.eta[0] as Float64Array)[a]);
    expect(
      Number.isFinite(recordLikelihood(record, prepared.observations, prediction).logLikelihood),
    ).toBe(true);
  });

  it('refuses a scenario that changes the water', async () => {
    const record: WashRecord = {
      ...plan,
      id: 'scenarios-water',
      sim: { ...plan.sim, scenarios: [{}, { params: { 'jets.kStag': 1.5 } }] },
    };
    await expect(prepareRecord(record, params, shared)).rejects.toThrow(RecordSetupError);
  });
});

describe('the soak of Eco 50, a key of the wash registry that only moves the schedule', () => {
  it('is replayed at the value asked for, on the exposure of the preparation', async () => {
    // Two grams of yolk on a tile and a protease level at which Eco 50 takes part of it.
    const eco: WashRecord = {
      ...load({ id: 'eco', ware: 'clean', amount: 5 }),
      programme: { id: 'eco_50' },
    };
    const capsule = { 'liq.xProtease': 0.03 };
    // The low end of the registered range of the duty (0.59 to 1 since the owner's wash 01).
    const half = createCalibrationParams({ ...capsule, 'prog.soakDuty': 0.6 });
    const full = createCalibrationParams({ ...capsule, 'prog.soakDuty': 1 });
    const prepared = await prepareRecord(eco, half, shared);
    const atHalf = await prepared.evaluate(half);
    const atFull = await prepared.evaluate(full);
    expect(atFull.reused).toBe(false);
    const ends = prepared.observations
      .map((o, i) => ({ o, i }))
      .filter((x) => x.o.at === null && x.o.kind === 'mass_fraction')
      .map((x) => x.i);
    // A soak sprayed all the time takes more of a thick soil than one sprayed 0.6 of the time.
    expect(
      Math.max(...ends.map((i) => (atHalf.eta[i] as number) - (atFull.eta[i] as number))),
    ).toBeGreaterThan(0.005);
    // The same as a preparation made at that duty, which computes no exposure of its own.
    const fresh = await prepareRecord(eco, full, shared);
    expect(fresh.info.exposureComputed).toBe(0);
    const again = await fresh.evaluate(full);
    for (const i of ends) expect(atFull.eta[i]).toBeCloseTo(again.eta[i] as number, 12);
    // And the wash input of the fitted set carries the duty: wash() reads it.
    expect(prepared.washInputAt(full).input.params?.['prog.soakDuty']).toBe(1);
  });
});
