/**
 * What the calibration of the owner's first wash added to the tool: the visible area as an
 * observation, observations that are recorded and not fitted, the input scenarios of a wash
 * whose inputs were not measured, and the wash registry's own `prog.*` keys.
 */

import { describe, expect, it } from 'vitest';
import {
  calibrationOverridesOf,
  createCalibrationParams,
  isCalibrationKey,
  isWashShapingCalibrationKey,
  washOverridesOf,
} from './cal-params.ts';
import type { ObservationSpec, RecordPrediction } from './evaluator.ts';
import { recordLikelihood } from './objective.ts';
import {
  areaLog,
  fisherInformation,
  logLikelihood,
  outlierSpan,
  predictEta,
  predictiveMoments,
  resolveObsConstants,
  sampleObservation,
  type TargetState,
} from './observation.ts';
import {
  AREA_FLOOR_DEFAULT_MM2,
  observationSd,
  RANGE_HALF_WIDTH_SDS,
  rangeLogSd,
  validateWashRecord,
  type RecordObservation,
  type WashRecord,
} from './record.ts';
import { TOY_RULE, toyRecord, toyState } from './toy.test-util.ts';

const constants = resolveObsConstants(createCalibrationParams());
/** The constants without the allowance for gross errors. */
const plain = resolveObsConstants(createCalibrationParams({ 'obs.outlierShare': 0 }));

describe("the wash registry's own programme keys", () => {
  it('are keys of the wash, not of the calibration: a parameter file holds them', () => {
    expect(isCalibrationKey('prog.soakDuty')).toBe(false);
    expect(isCalibrationKey('prog.mainWashTargetShift')).toBe(true);
    expect(isCalibrationKey('obs.scoreSd')).toBe(true);
    expect(isCalibrationKey('soil.bakeRate')).toBe(false);
    expect(isWashShapingCalibrationKey('prog.mainWashHoldScale')).toBe(true);
    expect(isWashShapingCalibrationKey('cal.jetShearScale')).toBe(true);
    expect(isWashShapingCalibrationKey('obs.scoreSd')).toBe(false);
    expect(isWashShapingCalibrationKey('prog.soakDuty')).toBe(false);
    const fitted = createCalibrationParams({
      'prog.soakDuty': 0.8,
      'prog.mainWashTargetShift': -3,
      'obs.scoreSd': 0.7,
    });
    expect(washOverridesOf(fitted)).toEqual({ 'prog.soakDuty': 0.8 });
    expect(calibrationOverridesOf(fitted)).toEqual({
      'prog.mainWashTargetShift': -3,
      'obs.scoreSd': 0.7,
    });
  });
});

describe('the visible area as an observation', () => {
  const state = (areaMm2: number): TargetState => ({
    ...toyState(0.001),
    soiledAreaMm2: 21100,
    softVisibleAreaMm2: areaMm2,
    visibleAreaMm2: areaMm2,
  });

  it('predicts the expected visible area in mm2', () => {
    expect(predictEta('visible_area', state(37), TOY_RULE, constants)).toBe(37);
    expect(constants.areaFloorMm2).toBe(AREA_FLOOR_DEFAULT_MM2);
  });

  it('is normal in ln(area + floor): factors count, not differences', () => {
    const sd = 0.4;
    const s = Math.hypot(sd, plain.areaLogModelSd);
    const at = (observed: number, predicted: number): number =>
      logLikelihood('visible_area', observed, predicted, sd, plain);
    // At the prediction: the density of a normal at its mean.
    expect(at(100, 100)).toBeCloseTo(-Math.log(s * Math.sqrt(2 * Math.PI)), 12);
    // One deviation of ln(area + floor) away costs half a log unit, either way.
    const floor = plain.areaFloorMm2;
    const up = (100 + floor) * Math.exp(s) - floor;
    const down = (100 + floor) * Math.exp(-s) - floor;
    expect(at(100, 100) - at(100, up)).toBeCloseTo(0.5, 10);
    expect(at(100, 100) - at(100, down)).toBeCloseTo(0.5, 10);
    // A reading of nothing agrees with a prediction of a square millimetre and not with 100.
    expect(at(0, 0) - at(0, 1)).toBeLessThan(0.05);
    expect(at(0, 0) - at(0, 100)).toBeGreaterThan(10);
    // The same factor apart costs the same far above the floor.
    expect(at(1000, 2000)).toBeCloseTo(at(4000, 8000), 2);
  });

  it('takes its uncertainty from a stated range, read as the central 90 %', () => {
    const sd = rangeLogSd([50, 200], AREA_FLOOR_DEFAULT_MM2);
    expect(sd).toBeCloseTo(Math.log(205 / 55) / (2 * RANGE_HALF_WIDTH_SDS), 12);
    const record = toyRecord('areas', [0]);
    const observation: RecordObservation = {
      item: 'tile',
      kind: 'visible_area',
      value: 100,
      range: [50, 200],
      method: 'scale',
    };
    expect(observationSd(record, observation)).toBeCloseTo(sd, 12);
    // Its own sd wins.
    expect(observationSd(record, { ...observation, sd: 0.2 })).toBe(0.2);
    // The ends of the range are 1.645 deviations of the reading from the value in the mean.
    const half = (areaLog(200, constants) - areaLog(50, constants)) / 2;
    expect(half / sd).toBeCloseTo(RANGE_HALF_WIDTH_SDS, 12);
  });

  it('has its information by the chain rule, and an allowance for a gross error', () => {
    const sd = 0.4;
    const s = Math.hypot(sd, plain.areaLogModelSd);
    const eta = 60;
    expect(fisherInformation('visible_area', eta, sd, plain)).toBeCloseTo(
      1 / ((eta + plain.areaFloorMm2) ** 2 * s * s),
      14,
    );
    const span = outlierSpan('visible_area', state(eta), constants);
    expect(span).toBeCloseTo(Math.log((21100 + 5) / 5), 12);
    // With the allowance a wild value costs no more than the uniform part.
    const wild = logLikelihood('visible_area', 20000, eta, sd, constants, span);
    expect(wild).toBeGreaterThan(Math.log(constants.outlierShare / span) - 1e-9);
    expect(logLikelihood('visible_area', 20000, eta, sd, plain)).toBeLessThan(wild - 10);
    const withAllowance = fisherInformation('visible_area', eta, sd, constants, span);
    expect(withAllowance).toBeLessThan(fisherInformation('visible_area', eta, sd, plain));
    expect(withAllowance).toBeGreaterThan(0.8 * fisherInformation('visible_area', eta, sd, plain));
  });

  it('is drawn as a log-normal of area + floor, never below nothing', () => {
    const sd = 0.3;
    const moments = predictiveMoments('visible_area', 40, sd, plain);
    let k = 0;
    // A fixed low-discrepancy stream of normal deviates.
    const normals = Array.from({ length: 4000 }, (_, i) => {
      const u = (i + 0.5) / 4000;
      // The inverse of the logistic, scaled to unit variance: close enough for two moments.
      return (Math.log(u / (1 - u)) * Math.sqrt(3)) / Math.PI;
    });
    const draws = normals.map(
      () =>
        sampleObservation(
          'visible_area',
          40,
          sd,
          plain,
          () => 0.5,
          () => normals[k++] as number,
        ) as number,
    );
    expect(Math.min(...draws)).toBeGreaterThanOrEqual(0);
    const mean = draws.reduce((a, b) => a + b, 0) / draws.length;
    expect(mean).toBeGreaterThan(40);
    expect(Math.abs(mean - moments.mean) / moments.mean).toBeLessThan(0.1);
  });
});

describe('the record: a visible area, an observation that is not fitted, input scenarios', () => {
  const base = (): Record<string, unknown> =>
    JSON.parse(JSON.stringify(toyRecord('scenarios', [0], [0.5]))) as Record<string, unknown>;
  const withObservation = (observation: Record<string, unknown>): unknown => ({
    ...base(),
    observations: [{ item: 'tile', method: 'scale', ...observation }],
  });
  const problems = (json: unknown): string[] => {
    const checked = validateWashRecord(json);
    return checked.ok ? [] : checked.error.map((issue) => issue.path);
  };

  it('accepts an area with a range in place of an sd, and a flag that leaves it out of a fit', () => {
    expect(problems(withObservation({ kind: 'visible_area', value: 25, range: [10, 60] }))).toEqual(
      [],
    );
    expect(problems(withObservation({ kind: 'clean', value: false, fitted: false }))).toEqual([]);
  });

  it('rejects a negative area, a range that does not hold the value, a range on another kind', () => {
    expect(problems(withObservation({ kind: 'visible_area', value: -1, sd: 0.4 }))).toEqual([
      'observations[0].value',
    ]);
    expect(problems(withObservation({ kind: 'visible_area', value: 80, range: [10, 60] }))).toEqual(
      ['observations[0].range'],
    );
    expect(problems(withObservation({ kind: 'visible_area', value: 20, range: [60, 10] }))).toEqual(
      ['observations[0].range'],
    );
    expect(
      problems(withObservation({ kind: 'mass_fraction', value: 0.2, sd: 0.02, range: [0, 1] })),
    ).toEqual(['observations[0].range']);
    // Without a range, an sd or a method's default an area has no uncertainty.
    expect(problems(withObservation({ kind: 'visible_area', value: 20 }))).toEqual([
      'observations[0].sd',
    ]);
    expect(problems(withObservation({ kind: 'clean', value: true, fitted: 'no' }))).toEqual([
      'observations[0].fitted',
    ]);
  });

  it('accepts input scenarios and rejects malformed ones', () => {
    const scenarios = (list: unknown): unknown => ({ ...base(), sim: { scenarios: list } });
    expect(
      problems(
        scenarios([
          {},
          { weight: 2, level_seed: 9, amount_factors: { tile: 1.4 }, params: { 'soil.KE': 0.9 } },
        ]),
      ),
    ).toEqual([]);
    expect(
      problems(
        scenarios([
          { weight: 0 },
          { level_seed: -1 },
          { amount_factors: { nobody: 1.2 } },
          { amount_factors: { tile: 0 } },
          { params: 3 },
        ]),
      ),
    ).toEqual([
      'sim.scenarios[0].weight',
      'sim.scenarios[1].level_seed',
      'sim.scenarios[2].amount_factors.nobody',
      'sim.scenarios[3].amount_factors.tile',
      'sim.scenarios[4].params',
    ]);
  });
});

describe('the likelihood of a record with input scenarios', () => {
  /** Two items, an area and a verdict on each; three scenarios of what the areas may be. */
  const record: WashRecord = {
    ...toyRecord('two-items', [0]),
    kind: 'synthetic',
    load: {
      items: ['a', 'b'].map((id) => ({
        ...(toyRecord('x', [0]).load.items[0] as WashRecord['load']['items'][number]),
        id,
      })),
    },
    observations: [
      { item: 'a', kind: 'visible_area', value: 100, sd: 0.4, method: 'scale' },
      { item: 'a', kind: 'clean', value: false, method: 'scale' },
      { item: 'b', kind: 'visible_area', value: 0, sd: 0.4, method: 'scale' },
      { item: 'b', kind: 'clean', value: true, method: 'scale', fitted: false },
    ],
  };
  const specs: ObservationSpec[] = record.observations.map((observation, index) => ({
    index,
    id: `${observation.item}.${observation.kind}`,
    kind: observation.kind,
    itemId: observation.item,
    target: 'item',
    at: null,
    value: observation.value,
    sd: observation.kind === 'clean' ? 0 : (observation.sd ?? 0),
    fitted: observation.fitted !== false,
  }));
  const stateOf = (areaMm2: number): TargetState => ({
    ...toyState(0.001),
    soiledAreaMm2: 21100,
    softVisibleAreaMm2: areaMm2,
    visibleAreaMm2: areaMm2,
  });
  /** `eta` of the four observations for the areas of the two items: an area, a clean margin. */
  const etaOf = (a: number, b: number): Float64Array =>
    Float64Array.from([a, a > 4 ? -2 : 2, b, b > 4 ? -2 : 2]);
  const prediction = (
    areas: readonly (readonly [number, number])[],
    weights?: readonly number[],
  ): RecordPrediction => {
    const [a0, b0] = areas[0] as readonly [number, number];
    return {
      recordId: record.id,
      eta: etaOf(a0, b0),
      states: [stateOf(a0), stateOf(a0), stateOf(b0), stateOf(b0)],
      ...(weights === undefined
        ? {}
        : {
            scenarios: {
              weights,
              eta: areas.map(([a, b]) => etaOf(a, b)),
              states: areas.map(([a, b]) => [stateOf(a), stateOf(a), stateOf(b), stateOf(b)]),
            },
          }),
      rule: TOY_RULE,
      constants: plain,
      elapsed_ms: 0,
      reused: false,
    };
  };
  const ll = (i: number, eta: number): number => {
    const observation = record.observations[i] as RecordObservation;
    return logLikelihood(
      observation.kind,
      observation.value as number | boolean,
      eta,
      observation.kind === 'clean' ? 0 : (observation.sd ?? 0),
      plain,
    );
  };

  it('without scenarios is the sum over the fitted observations', () => {
    const single = prediction([[60, 1]]);
    const likelihood = recordLikelihood(record, specs, single);
    const eta = single.eta;
    expect(likelihood.logLikelihood).toBeCloseTo(
      ll(0, eta[0] as number) + ll(1, eta[1] as number) + ll(2, eta[2] as number),
      12,
    );
    // The observation that is not fitted has its value in the table and not in the sum.
    expect(likelihood.perObservation[3]).toBeCloseTo(ll(3, eta[3] as number), 12);
  });

  it('integrates the scenarios out per item: its observations share the unknown inputs', () => {
    const areas: [number, number][] = [
      [60, 1],
      [2, 30],
      [400, 0],
    ];
    const weights = [0.5, 0.25, 0.25];
    const likelihood = recordLikelihood(record, specs, prediction(areas, weights));
    const etas = areas.map(([a, b]) => etaOf(a, b));
    // Item a: both of its observations inside one sum over the scenarios.
    const itemA = Math.log(
      weights.reduce(
        (sum, w, k) =>
          sum +
          w *
            Math.exp(
              ll(0, (etas[k] as Float64Array)[0] as number) +
                ll(1, (etas[k] as Float64Array)[1] as number),
            ),
        0,
      ),
    );
    // Item b: its area alone (its verdict is not fitted).
    const itemB = Math.log(
      weights.reduce(
        (sum, w, k) => sum + w * Math.exp(ll(2, (etas[k] as Float64Array)[2] as number)),
        0,
      ),
    );
    expect(likelihood.logLikelihood).toBeCloseTo(itemA + itemB, 10);
    // Not the product of the two marginals of item a: the area and the verdict go together.
    const separately = [0, 1].map((i) =>
      Math.log(
        weights.reduce(
          (sum, w, k) => sum + w * Math.exp(ll(i, (etas[k] as Float64Array)[i] as number)),
          0,
        ),
      ),
    );
    expect(likelihood.perObservation[0]).toBeCloseTo(separately[0] as number, 10);
    expect(
      Math.abs(itemA - ((separately[0] as number) + (separately[1] as number))),
    ).toBeGreaterThan(0.01);
    // A scenario explains what the nominal one cannot: the record is likelier with them.
    const nominalOnly = recordLikelihood(record, specs, prediction([[2, 30]]));
    const withOthers = recordLikelihood(
      record,
      specs,
      prediction(
        [
          [2, 30],
          [90, 0],
        ],
        [0.5, 0.5],
      ),
    );
    expect(withOthers.logLikelihood).toBeGreaterThan(nominalOnly.logLikelihood + 3);
  });
});
