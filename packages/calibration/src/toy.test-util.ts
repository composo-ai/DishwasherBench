/**
 * A toy evaluator for the tests of the fitting machinery: a soil that leaves a tile as
 * exp(-k t), observed as a mass fraction at stated times, in place of the wash simulation.
 * Not exported from the package entry point.
 */

import type { ParamSet } from '@spotless/sim-core';
import type { ObservationSpec, RecordPrediction } from './evaluator.ts';
import {
  resolveObsConstants,
  THRESHOLD_LOG_CAP,
  type ScoreRule,
  type TargetState,
} from './observation.ts';
import type { RecordEvaluator } from './objective.ts';
import {
  observationIdOf,
  observationSd,
  WASH_RECORD_FORMAT,
  WASH_RECORD_VERSION,
  type RecordObservation,
  type WashRecord,
} from './record.ts';

/** Rule of the inspector at its registered defaults. */
export const TOY_RULE: ScoreRule = {
  areaBandsMm2: [0, 4, 20, 50, 200],
  speckBands: [0, 4, 10],
  maxAreaMm2: 4,
  maxSpecks: 4,
  maxWaterMl: 1,
};

/**
 * A target state with the given residue: a uniform film on 1000 mm2 that stays visible until a
 * twentieth of it is left, everything else plain.
 */
export function toyState(fraction: number): TargetState {
  const threshold =
    fraction > 0 ? Math.max(-THRESHOLD_LOG_CAP, Math.log(fraction / 0.05)) : -THRESHOLD_LOG_CAP;
  return {
    initialMass_mg: 100,
    residualMass_mg: 100 * fraction,
    soiledAreaMm2: 1000,
    visibleAreaMm2: 1000 * fraction,
    softVisibleAreaMm2: 1000 * fraction,
    bandThresholdLog: TOY_RULE.areaBandsMm2.map(() => threshold),
    cleanThresholdLog: threshold,
    specks: 0,
    score: 0,
    clean: false,
    pooledWater_mL: 0,
  };
}

/**
 * The decay rate of the toy model, 1/s: 5e-4 at the registry defaults, proportional to the
 * egg-yolk rate and to the egg-yolk jet ratio (so that the two are perfectly confounded).
 */
export function toyRate(params: ParamSet): number {
  return (
    5e-4 * (params.get('soil.egg_yolk.rateRef') / 3e-5) * (params.get('soil.egg_yolk.jetRatio') / 4)
  );
}

/** The residual mass fraction of the toy model at time `t` seconds. */
export function toyFraction(params: ParamSet, t: number): number {
  return Math.exp(-toyRate(params) * t);
}

/** A record of one tile observed as a mass fraction at `times` (seconds), with values if given. */
export function toyRecord(
  id: string,
  times: readonly number[],
  values?: readonly number[],
): WashRecord {
  const observations: RecordObservation[] = times.map((t, i) => ({
    item: 'tile',
    at_s: t,
    kind: 'mass_fraction',
    method: 'scale',
    sd: 0.02,
    ...(values === undefined ? {} : { value: values[i] as number }),
  }));
  return {
    format: WASH_RECORD_FORMAT,
    version: WASH_RECORD_VERSION,
    id,
    kind: values === undefined ? 'planned' : 'synthetic',
    provenance: { methods: { scale: { description: 'toy' } } },
    machine: { id: 'bosch_smv4hax40g' },
    programme: { id: 'eco_50' },
    load: {
      items: [
        {
          id: 'tile',
          type: 'toy_tile',
          custom: {
            tile: { length_mm: 100, width_mm: 100, thickness_mm: 6, material: 'porcelain_glazed' },
          },
          position_mm: [0, 0, 100],
          quat_wxyz: [1, 0, 0, 0],
          soils: [
            {
              type: 'egg_yolk',
              amount_g: 0.2,
              where: { regions: [{ region: 'top', coverage: 1 }] },
              drying: { time_h: 2 },
              heat: { history: 'none' },
            },
          ],
        },
      ],
    },
    observations,
  };
}

/** The toy evaluator: predictions of {@link toyFraction} for every observation of a record. */
export function toyEvaluator(counter?: { evaluations: number }): RecordEvaluator {
  return {
    get(record) {
      const observations: ObservationSpec[] = record.observations.map((observation, index) => ({
        index,
        id: observationIdOf(observation),
        kind: observation.kind,
        itemId: observation.item,
        target: 'item',
        at: observation.at_s ?? null,
        value: observation.value,
        sd: observationSd(record, observation) ?? 0,
      }));
      return Promise.resolve({
        observations,
        evaluate(params: ParamSet): Promise<RecordPrediction> {
          if (counter !== undefined) counter.evaluations++;
          const eta = new Float64Array(observations.length);
          const states: TargetState[] = [];
          observations.forEach((observation, i) => {
            const fraction = toyFraction(params, observation.at ?? 0);
            eta[i] = fraction;
            states.push(toyState(fraction));
          });
          return Promise.resolve({
            recordId: record.id,
            eta,
            states,
            rule: TOY_RULE,
            constants: resolveObsConstants(params),
            elapsed_ms: 0,
            reused: false,
          });
        },
      });
    },
  };
}
