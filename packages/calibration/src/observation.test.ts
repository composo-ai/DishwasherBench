import { randomNormal, randomUniform } from '@spotless/core';
import { inspectionRules, inspectItem, type InspectionElements } from '@spotless/inspector';
import { soilVisibility } from '@spotless/sim-core';
import { describe, expect, it } from 'vitest';
import { createCalibrationParams } from './cal-params.ts';
import { normCdf, normPdf } from './mathx.ts';
import {
  cleanMargin,
  cleanProbability,
  continuousScore,
  continuousSpeckScore,
  expectedAreaScore,
  fisherInformation,
  logLikelihood,
  noiseSd,
  outlierProbability,
  outlierSpan,
  predictEta,
  predictiveMoments,
  resolveObsConstants,
  sampleObservation,
  scoreProbabilities,
  THRESHOLD_LOG_CAP,
  visibilityThresholdLog,
  visibleShare,
  type TargetState,
} from './observation.ts';
import type { ObservationKind } from './record.ts';
import { TOY_RULE, toyState } from './toy.test-util.ts';

const c = resolveObsConstants(createCalibrationParams());
const AREA_BANDS = [0, 4, 20, 50, 200];
const SPECK_BANDS = [0, 4, 10];
const LOG_SQRT_2PI = 0.9189385332046727;

describe('the registered constants', () => {
  it('are the values the hand computations below assume', () => {
    expect(c.scoreSd).toBe(0.6);
    expect(c.visibilityLogSd).toBe(0.3);
    expect(c.outlierShare).toBe(0.03);
    expect(c.waterSpan).toBe(250);
    expect(c.areaModelSd).toBe(0.05);
    expect(c.areaEndTolerance).toBe(0.01);
    expect(c.massModelRel).toBe(0.1);
    expect(c.massModelAbs).toBe(0.5);
    expect(c.massFractionModelSd).toBe(0.05);
    expect(c.speckDispersion).toBe(2);
    expect(c.speckFloor).toBe(0.2);
    expect(c.cleanMisjudge).toBe(0.02);
    expect(c.waterModelRel).toBe(0.3);
    expect(c.waterModelAbs).toBe(0.5);
  });
});

/** A target of `count` elements of 4 mm2 each with one soil class at the given indices. */
function film(indices: readonly number[]): {
  elements: InspectionElements;
  index: Float64Array;
} {
  // Elements judged whole (no sub-element coverage): the index of an element is its residue
  // over the threshold, which is what these tests construct.
  const params = createCalibrationParams({ 'soil.subCellCv': 0 });
  const rules = inspectionRules(params, soilVisibility(params));
  const classCount = rules.visibleMass_mg_cm2.length;
  // The class with the plainest threshold: a mass per area, no visible share.
  const k = rules.visibleFraction.findIndex(
    (share, i) => share === 0 && (rules.visibleMass_mg_cm2[i] as number) > 0,
  );
  const threshold = rules.visibleMass_mg_cm2[k] as number;
  const count = indices.length;
  const initial = new Float32Array(count * classCount);
  const residual = new Float32Array(count * classCount);
  const index = new Float64Array(count);
  indices.forEach((value, e) => {
    initial[classCount * e + k] = 100 * threshold;
    residual[classCount * e + k] = value * threshold;
    index[e] = (residual[classCount * e + k] as number) / threshold;
  });
  // A line of elements, each the neighbour of the next.
  const offsets = new Uint32Array(count + 1);
  const neighbours: number[] = [];
  for (let e = 0; e < count; e++) {
    if (e > 0) neighbours.push(e - 1);
    if (e < count - 1) neighbours.push(e + 1);
    offsets[e + 1] = neighbours.length;
  }
  return {
    elements: {
      count,
      region: new Uint16Array(count),
      areaMm2: new Float32Array(count).fill(4),
      initial_mg_cm2: initial,
      residual_mg_cm2: residual,
      neighbours: { offsets, indices: Uint32Array.from(neighbours) },
    },
    index,
  };
}

describe('visibility thresholds against the inspector', () => {
  // Elements judged whole (no sub-element coverage): the index of an element is its residue
  // over the threshold, which is what these tests construct.
  const params = createCalibrationParams({ 'soil.subCellCv': 0 });
  const rules = inspectionRules(params, soilVisibility(params));
  const classCount = rules.visibleMass_mg_cm2.length;
  const limits = [...rules.areaBandsMm2, rules.maxAreaMm2];
  const stateOf = (indices: readonly number[]): TargetState => {
    const { elements, index } = film(indices);
    const inspection = inspectItem(
      { itemId: 'x', regionIds: ['r'], classCount, elements, pooledWater_mL: 0 },
      rules,
    );
    const thresholds = visibilityThresholdLog(index, elements.areaMm2, limits);
    let soft = 0;
    index.forEach((value) => (soft += 4 * visibleShare(value, c.visibilityLogSd)));
    return {
      ...toyState(0),
      soiledAreaMm2: 4 * indices.length,
      visibleAreaMm2: inspection.visibleAreaMm2,
      softVisibleAreaMm2: soft,
      bandThresholdLog: thresholds.slice(0, rules.areaBandsMm2.length),
      cleanThresholdLog: thresholds[rules.areaBandsMm2.length] as number,
      specks: inspection.specks,
      score: inspection.score,
      clean: inspection.clean,
    };
  };
  const rule = {
    areaBandsMm2: rules.areaBandsMm2,
    speckBands: rules.speckBands,
    maxAreaMm2: rules.maxAreaMm2,
    maxSpecks: rules.maxSpecks,
    maxWaterMl: rules.maxWaterMl,
  };

  it('finds the index of the element at which the soiled area first exceeds each limit', () => {
    // 4 mm2 each; indices 3, 2, 0.5, 0.2. Limit 0: the first; 4: the second; 9: the third.
    const { elements, index } = film([0.5, 3, 0.2, 2]);
    const found = visibilityThresholdLog(index, elements.areaMm2, [0, 4, 9, 16, 12]);
    expect(found[0]).toBeCloseTo(Math.log(3), 6);
    expect(found[1]).toBeCloseTo(Math.log(2), 6);
    expect(found[2]).toBeCloseTo(Math.log(0.5), 6);
    // All four cover 16 mm2, which does not exceed 16: nothing is visible at any threshold.
    expect(found[3]).toBe(-THRESHOLD_LOG_CAP);
    expect(found[4]).toBeCloseTo(Math.log(0.2), 6);
    // Thinned by two, every element stands for 8 mm2: the first already exceeds 4.
    expect(visibilityThresholdLog(index, elements.areaMm2, [4], 2)[0]).toBeCloseTo(Math.log(3), 6);
  });

  it('calls a thin uniform film just under the threshold clean, as the inspector does', () => {
    // 3600 elements of 4 mm2: the 14,400 mm2 inside of a mug, everywhere at 0.9 of the threshold.
    const state = stateOf(new Array<number>(3600).fill(0.9));
    expect(state.clean).toBe(true);
    expect(state.visibleAreaMm2).toBe(0);
    // An observer is expected to see a good part of it in a photograph ...
    expect(state.softVisibleAreaMm2 / state.soiledAreaMm2).toBeCloseTo(
      normCdf(Math.log(0.9) / 0.3),
      3,
    );
    // ... but the verdict follows the inspector: P(clean) = 0.02 + 0.96 Phi(-ln 0.9 / 0.3).
    const margin = predictEta('clean', state, rule, c);
    expect(margin).toBeCloseTo(-Math.log(0.9) / 0.3, 3);
    expect(cleanProbability(margin, c)).toBeGreaterThan(0.6);
    // With a margin of a factor two the verdict is as sure as the misjudgement allows, and
    // the score is 5.
    const thin = stateOf(new Array<number>(3600).fill(0.5));
    expect(cleanProbability(predictEta('clean', thin, rule, c), c)).toBeGreaterThan(0.96);
    expect(predictEta('score', thin, rule, c)).toBeGreaterThan(4.9);
    // Just over the threshold everywhere: not clean, score 0, as the inspector says.
    const thick = stateOf(new Array<number>(3600).fill(1.1));
    expect(thick.clean).toBe(false);
    expect(cleanProbability(predictEta('clean', thick, rule, c), c)).toBeLessThan(0.4);
    expect(predictEta('score', stateOf(new Array<number>(3600).fill(2)), rule, c)).toBeLessThan(
      0.1,
    );
  });

  it('agrees with the inspector on which side of clean every film lies, and on its score', () => {
    // Films of tea-like and fat-like shapes: uniform, graded, patchy, one speck, many specks.
    const films: number[][] = [];
    for (const level of [0.2, 0.7, 0.95, 0.999, 1.001, 1.05, 1.5, 4]) {
      films.push(new Array<number>(400).fill(level));
      films.push(Array.from({ length: 400 }, (_, e) => level * (0.5 + e / 400)));
      films.push(Array.from({ length: 400 }, (_, e) => (e % 37 === 0 ? 3 * level : 0.1 * level)));
      films.push(Array.from({ length: 400 }, (_, e) => (e === 200 ? 2 * level : 0)));
      films.push(Array.from({ length: 400 }, (_, e) => (e < 3 ? 1.2 * level : 0.6 * level)));
    }
    let clean = 0;
    for (const indices of films) {
      const state = stateOf(indices);
      const p = cleanProbability(predictEta('clean', state, rule, c), c);
      // The model's verdict is on the inspector's side of one half, always.
      expect(p > 0.5, `P(clean) ${p} against the inspector's ${state.clean}`).toBe(state.clean);
      if (state.clean) clean++;
      // Its expected score is within half a point of the inspector's wherever no band is
      // within two and a half deviations (a factor 2.1) of being crossed, and never further
      // from it than half the scale where all five are crossed at once.
      const expected = predictEta('score', state, rule, c);
      const near = state.bandThresholdLog.some((t) => Math.abs(t) < 0.75);
      expect(Math.abs(expected - state.score)).toBeLessThan(near ? 2.6 : 0.5);
      // The area-band thresholds have the sign the inspector's area says.
      rules.areaBandsMm2.forEach((band, i) => {
        expect((state.bandThresholdLog[i] as number) < 0).toBe(state.visibleAreaMm2 <= band);
      });
    }
    expect(clean).toBeGreaterThan(5);
    expect(clean).toBeLessThan(films.length - 5);
  });
});

describe('the expected IEC score', () => {
  it('counts the bands an observer finds the area within', () => {
    // Every band passed with a wide margin: 5. None: 0. Two of five passed: 2.
    expect(expectedAreaScore([-9, -9, -9, -9, -9], 0.3)).toBeCloseTo(5, 9);
    expect(expectedAreaScore([9, 9, 9, 9, 9], 0.3)).toBeCloseTo(0, 9);
    expect(expectedAreaScore([9, 9, 9, -9, -9], 0.3)).toBeCloseTo(2, 9);
    // On the edge of a band the score is half way: 2 + 1/2.
    expect(expectedAreaScore([9, 9, 0, -9, -9], 0.3)).toBeCloseTo(2.5, 9);
    // One deviation inside the edge: 2 + Phi(1).
    expect(expectedAreaScore([9, 9, -0.3, -9, -9], 0.3)).toBeCloseTo(2 + normCdf(1), 9);
    // A table of three bands cannot give less than 2.
    expect(expectedAreaScore([9, 9, 9], 0.3)).toBeCloseTo(2, 9);
  });

  it('follows the speck bands, half a speck above each, and ends at the lowest speck score', () => {
    expect(continuousSpeckScore(0, SPECK_BANDS)).toBe(5);
    expect(continuousSpeckScore(0.5, SPECK_BANDS)).toBeCloseTo(4.5, 12);
    // 1 speck: an eighth of the way from 0.5 (4.5) to 4.5 (3.5).
    expect(continuousSpeckScore(1, SPECK_BANDS)).toBeCloseTo(4.375, 12);
    expect(continuousSpeckScore(2.5, SPECK_BANDS)).toBeCloseTo(4.0, 12);
    expect(continuousSpeckScore(4.5, SPECK_BANDS)).toBeCloseTo(3.5, 12);
    expect(continuousSpeckScore(7.5, SPECK_BANDS)).toBeCloseTo(3.0, 12);
    expect(continuousSpeckScore(10.5, SPECK_BANDS)).toBeCloseTo(2.5, 12);
    expect(continuousSpeckScore(21, SPECK_BANDS)).toBeCloseTo(2, 12);
    expect(continuousSpeckScore(500, SPECK_BANDS)).toBe(2);
  });

  it('takes the lower of area and specks; the clean margin is the nearer of the two rules', () => {
    const state: TargetState = {
      ...toyState(0),
      bandThresholdLog: [9, 9, -0.3, -9, -9],
      cleanThresholdLog: 9,
      specks: 1,
    };
    expect(continuousScore(state, TOY_RULE, c)).toBeCloseTo(2 + normCdf(1), 9);
    // No area visible, one speck: the specks decide, 4.375.
    const speck = { ...toyState(0), specks: 1 };
    expect(continuousScore(speck, TOY_RULE, c)).toBeCloseTo(4.375, 9);
    // Clean by area with room to spare; 4 specks are the most allowed: (3.625 - 3.5) / 0.6.
    expect(cleanMargin({ ...toyState(0), specks: 4 }, TOY_RULE, c)).toBeCloseTo(0.125 / 0.6, 9);
    expect(cleanMargin({ ...toyState(0), specks: 5 }, TOY_RULE, c)).toBeLessThan(0);
    // Area on the limit to within 15 %: -ln(1.15) / 0.3 deviations.
    expect(
      cleanMargin({ ...toyState(0), cleanThresholdLog: Math.log(1.15) }, TOY_RULE, c),
    ).toBeCloseTo(-Math.log(1.15) / 0.3, 9);
  });
});

describe('predictions from a target state', () => {
  const state: TargetState = {
    initialMass_mg: 80,
    residualMass_mg: 20,
    soiledAreaMm2: 2000,
    visibleAreaMm2: 520,
    softVisibleAreaMm2: 500,
    bandThresholdLog: [1.2, 0.9, 0.6, 0.3, -0.15],
    cleanThresholdLog: 0.9,
    specks: 3,
    score: 0,
    clean: false,
    pooledWater_mL: 0.4,
  };

  it('gives each kind its scalar', () => {
    expect(predictEta('area_fraction', state, TOY_RULE, c)).toBeCloseTo(0.25, 12);
    expect(predictEta('mass_fraction', state, TOY_RULE, c)).toBeCloseTo(0.25, 12);
    expect(predictEta('residual_mass', state, TOY_RULE, c)).toBe(20);
    expect(predictEta('specks', state, TOY_RULE, c)).toBe(3);
    expect(predictEta('retained_water', state, TOY_RULE, c)).toBe(0.4);
    // By area: Phi(-4) + Phi(-3) + Phi(-2) + Phi(-1) + Phi(0.5) = 0.8742; 3 specks give 3.875.
    const score = normCdf(-4) + normCdf(-3) + normCdf(-2) + normCdf(-1) + normCdf(0.5);
    expect(predictEta('score', state, TOY_RULE, c)).toBeCloseTo(score, 12);
    expect(score).toBeCloseTo(0.8742, 3);
    // Clean: the area is over its limit by a factor e^0.9, three deviations of 0.3.
    expect(predictEta('clean', state, TOY_RULE, c)).toBeCloseTo(-3, 12);
  });

  it('reads a wet item as not clean whatever its residue', () => {
    const wet = { ...toyState(0), pooledWater_mL: 5 };
    expect(predictEta('clean', wet, TOY_RULE, c)).toBeLessThan(-10);
    expect(cleanProbability(predictEta('clean', wet, TOY_RULE, c), c)).toBeCloseTo(0.02, 10);
    // Spotless and dry: limited by the speck rule, (5 - 3.5) / 0.6 deviations.
    expect(predictEta('clean', toyState(0), TOY_RULE, c)).toBeCloseTo(2.5, 12);
  });

  it('gives 0 for a target that carried no soil', () => {
    const none = { ...toyState(0), initialMass_mg: 0, soiledAreaMm2: 0 };
    expect(predictEta('area_fraction', none, TOY_RULE, c)).toBe(0);
    expect(predictEta('mass_fraction', none, TOY_RULE, c)).toBe(0);
  });
});

describe('the allowance for gross errors', () => {
  const state = { ...toyState(0.2), initialMass_mg: 80 };

  it('has an admissible range per kind', () => {
    expect(outlierSpan('area_fraction', state, c)).toBe(1);
    expect(outlierSpan('mass_fraction', state, c)).toBe(1.5);
    expect(outlierSpan('residual_mass', state, c)).toBe(120);
    expect(outlierSpan('retained_water', state, c)).toBe(250);
    expect(outlierSpan('score', state, c)).toBe(0);
    expect(outlierSpan('clean', state, c)).toBe(0);
    expect(outlierSpan('specks', state, c)).toBe(0);
  });

  it('mixes the model with a uniform density over that range', () => {
    // Mass fraction at the prediction: 0.97 / (sd sqrt(2 pi)) + 0.03 / 1.5.
    const sd = Math.hypot(0.03, 0.05);
    const peak = 1 / (sd * Math.sqrt(2 * Math.PI));
    expect(Math.exp(logLikelihood('mass_fraction', 0.5, 0.5, 0.03, c, 1.5))).toBeCloseTo(
      0.97 * peak + 0.02,
      9,
    );
    // Fourteen deviations away the model says e^-98 and the value costs ln(0.03 / 1.5) = -3.91.
    expect(logLikelihood('mass_fraction', 1.0, 0.165, 0.02, c, 1.5)).toBeCloseTo(Math.log(0.02), 6);
    expect(logLikelihood('mass_fraction', 1.0, 0.165, 0.02, c, 0)).toBeLessThan(-100);
    // The ends of an area fraction take the share of the uniform part that lies in them.
    const s = Math.hypot(0.05, 0.05);
    expect(Math.exp(logLikelihood('area_fraction', 0, 0.3, 0.05, c, 1))).toBeCloseTo(
      0.97 * normCdf(-0.29 / s) + 0.03 * 0.01,
      12,
    );
    // Without a range, or with a share of 0, it is the plain model.
    expect(logLikelihood('mass_fraction', 0.4, 0.5, 0.03, { ...c, outlierShare: 0 }, 1.5)).toBe(
      logLikelihood('mass_fraction', 0.4, 0.5, 0.03, c, 0),
    );
    // Scores, verdicts and counts have none.
    expect(logLikelihood('score', 3, 3, 0, c, 5)).toBe(logLikelihood('score', 3, 3, 0, c));
  });

  it('says how likely a value is to be a gross error', () => {
    // At the prediction: 0.02 / (0.97 x 6.842 + 0.02) = 0.003.
    expect(outlierProbability('mass_fraction', 0.5, 0.5, 0.03, c, 1.5)).toBeCloseTo(0.003, 3);
    // Three deviations out: 0.02 / (0.97 x 6.842 x e^-4.5 + 0.02) = 0.213.
    const sd = Math.hypot(0.03, 0.05);
    expect(outlierProbability('mass_fraction', 0.5 + 3 * sd, 0.5, 0.03, c, 1.5)).toBeCloseTo(
      0.02 / ((0.97 * Math.exp(-4.5)) / (sd * Math.sqrt(2 * Math.PI)) + 0.02),
      9,
    );
    expect(outlierProbability('mass_fraction', 1.0, 0.165, 0.02, c, 1.5)).toBeGreaterThan(0.999);
    expect(outlierProbability('score', 0, 5, 0, c, 0)).toBe(0);
    expect(outlierProbability('clean', true, -5, 0, c, 0)).toBe(0);
  });

  it('costs a little Fisher information, found by quadrature', () => {
    // Against the expected square of the score function by a finer sum.
    for (const [kind, eta, sd, span] of [
      ['mass_fraction', 0.4, 0.03, 1.5],
      ['residual_mass', 20, 2, 120],
      ['retained_water', 2, 0.5, 250],
      ['area_fraction', 0.3, 0.05, 1],
      ['area_fraction', 0.03, 0.05, 1],
    ] as const) {
      const s = noiseSd(kind, eta, sd, c);
      const h = 1e-5 * s;
      const term = (y: number): number =>
        Math.exp(logLikelihood(kind, y, eta, sd, c, span)) *
        ((logLikelihood(kind, y, eta + h, sd, c, span) -
          logLikelihood(kind, y, eta - h, sd, c, span)) /
          (2 * h)) **
          2;
      let expected = 0;
      const lo = kind === 'area_fraction' ? 0.01 + 1e-9 : eta - 12 * s;
      const hi = kind === 'area_fraction' ? 0.99 - 1e-9 : eta + 12 * s;
      const steps = 20000;
      for (let i = 0; i < steps; i++)
        expected += (term(lo + ((i + 0.5) * (hi - lo)) / steps) * (hi - lo)) / steps;
      if (kind === 'area_fraction') expected += term(0) + term(1);
      const found = fisherInformation(kind, eta, sd, c, span);
      expect(found / expected, kind).toBeCloseTo(1, 2);
      // Less than without the allowance, by no more than a fifth.
      const plain = fisherInformation(kind, eta, sd, c, 0);
      expect(found).toBeLessThan(plain);
      expect(found).toBeGreaterThan(0.8 * plain);
    }
  });

  it('is drawn by the sampler at its share', () => {
    let gross = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) {
      let counter = 0;
      const y = sampleObservation(
        'mass_fraction',
        0.2,
        0.02,
        c,
        () => randomUniform(9, 1, i, counter++),
        () => randomNormal(9, 1, i, counter++),
        1.5,
      ) as number;
      // Beyond six deviations of the model: a gross error (which lies in 0 .. 1.5).
      if (Math.abs(y - 0.2) > 6 * Math.hypot(0.02, 0.05)) {
        gross++;
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(1.5);
      }
    }
    // 3 % of the draws, of which 57 % fall beyond six deviations: 1.7 % (to a tenth of it, 4 se).
    const expected =
      0.03 *
      (1 -
        (12 * Math.hypot(0.02, 0.05)) / 1.5 +
        (0.2 - 6 * Math.hypot(0.02, 0.05) < 0 ? (6 * Math.hypot(0.02, 0.05) - 0.2) / 1.5 : 0));
    expect(gross / n).toBeGreaterThan(expected - 4 * Math.sqrt(expected / n));
    expect(gross / n).toBeLessThan(expected + 4 * Math.sqrt(expected / n));
  });
});

describe('log likelihoods against hand-computed values', () => {
  it('score: ordered probit about the continuous score', () => {
    // eta 3.0, sd 0.6: P(3) = Phi(0.5 / 0.6) - Phi(-0.5 / 0.6) = 2 Phi(0.8333) - 1 = 0.595343.
    expect(Math.exp(logLikelihood('score', 3, 3.0, 0, c))).toBeCloseTo(0.595343, 5);
    // P(4) = Phi(1.5 / 0.6) - Phi(0.5 / 0.6) = 0.993790 - 0.797672 = 0.196119.
    expect(Math.exp(logLikelihood('score', 4, 3.0, 0, c))).toBeCloseTo(0.196119, 5);
    // The end classes take the tails: P(5 | 4.8) = Phi(0.5) and P(0 | 0.2) = Phi(0.5) = 0.691462.
    expect(Math.exp(logLikelihood('score', 5, 4.8, 0, c))).toBeCloseTo(0.691462, 5);
    expect(Math.exp(logLikelihood('score', 0, 0.2, 0, c))).toBeCloseTo(0.691462, 5);
    // The six probabilities add up to 1.
    expect(scoreProbabilities(2.3, 0.6).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    // A stated observer uncertainty adds in quadrature: sd = hypot(0.6, 0.8) = 1.
    expect(Math.exp(logLikelihood('score', 3, 3.0, 0.8, c))).toBeCloseTo(2 * normCdf(0.5) - 1, 6);
    // Far in the tail the logarithm stays finite.
    expect(Number.isFinite(logLikelihood('score', 5, -0.5, 0, c))).toBe(true);
    expect(logLikelihood('score', 5, -0.5, 0, c)).toBeLessThan(-30);
  });

  it('area fraction: normal between the ends, piled up at both', () => {
    // f = 0.3, stated sd 0.05, model sd 0.05: sd = 0.0707107.
    const s = Math.hypot(0.05, 0.05);
    expect(noiseSd('area_fraction', 0.3, 0.05, c)).toBeCloseTo(s, 12);
    // y = 0.4: z = 1.414214, log density = -1 - ln(0.0707107) - 0.918939 = 0.730220.
    expect(logLikelihood('area_fraction', 0.4, 0.3, 0.05, c)).toBeCloseTo(0.73022, 5);
    // y = 0 (nothing left): Phi((0.01 - 0.3) / s) = Phi(-4.101219) = 2.055e-5.
    expect(logLikelihood('area_fraction', 0, 0.3, 0.05, c)).toBeCloseTo(
      Math.log(normCdf(-0.29 / s)),
      9,
    );
    expect(Math.exp(logLikelihood('area_fraction', 0, 0.3, 0.05, c))).toBeCloseTo(2.055e-5, 7);
    // y = 1 (all left) from f = 0.95: 1 - Phi((0.99 - 0.95) / s) = 1 - Phi(0.565685) = 0.285804.
    expect(Math.exp(logLikelihood('area_fraction', 1, 0.95, 0.05, c))).toBeCloseTo(0.285804, 5);
    // A value within the end tolerance reads as the end.
    expect(logLikelihood('area_fraction', 0.005, 0.3, 0.05, c)).toBe(
      logLikelihood('area_fraction', 0, 0.3, 0.05, c),
    );
  });

  it('residual mass: weighing error and model scatter in quadrature', () => {
    // eta 20 mg, stated 2 mg, 10 % of 20 = 2 mg, 0.5 mg: sd = sqrt(4 + 4 + 0.25) = 2.872281.
    expect(noiseSd('residual_mass', 20, 2, c)).toBeCloseTo(2.872281, 6);
    // y = 23: z = 1.044466; -z^2 / 2 - ln(sd) - ln sqrt(2 pi) = -0.545455 - 1.055106 - 0.918939.
    expect(logLikelihood('residual_mass', 23, 20, 2, c)).toBeCloseTo(-2.5195, 4);
  });

  it('mass fraction: normal', () => {
    // sd = hypot(0.03, 0.05) = 0.0583095; at the prediction the density is 1 / (sd sqrt(2 pi)).
    expect(logLikelihood('mass_fraction', 0.5, 0.5, 0.03, c)).toBeCloseTo(
      -Math.log(0.0583095) - LOG_SQRT_2PI,
      6,
    );
    expect(logLikelihood('mass_fraction', 0.5, 0.5, 0.03, c)).toBeCloseTo(1.92305, 4);
  });

  it('specks: negative binomial about the count plus the floor', () => {
    // eta 3, floor 0.2: mu = 3.2, k = 2. P(0) = (2 / 5.2)^2 = 0.147929.
    expect(Math.exp(logLikelihood('specks', 0, 3, 0, c))).toBeCloseTo(0.147929, 6);
    // P(2) = [G(4) / (G(2) 2!)] (2 / 5.2)^2 (3.2 / 5.2)^2 = 3 x 0.147929 x 0.378698 = 0.168060.
    expect(Math.exp(logLikelihood('specks', 2, 3, 0, c))).toBeCloseTo(
      3 * (2 / 5.2) ** 2 * (3.2 / 5.2) ** 2,
      9,
    );
    expect(Math.exp(logLikelihood('specks', 2, 3, 0, c))).toBeCloseTo(0.168061, 5);
    let total = 0;
    for (let n = 0; n < 400; n++) total += Math.exp(logLikelihood('specks', n, 3, 0, c));
    expect(total).toBeCloseTo(1, 9);
  });

  it('clean: a probit of the margin with a floor and a ceiling', () => {
    // On the boundary: 0.02 + 0.96 x 0.5 = 0.5.
    expect(Math.exp(logLikelihood('clean', true, 0, 0, c))).toBeCloseTo(0.5, 10);
    // One deviation above: 0.02 + 0.96 x Phi(1) = 0.827691.
    expect(Math.exp(logLikelihood('clean', true, 1, 0, c))).toBeCloseTo(0.827691, 5);
    expect(Math.exp(logLikelihood('clean', false, 1, 0, c))).toBeCloseTo(0.172309, 5);
    // Hopelessly dirty: clean is still reported with the misjudgement probability.
    expect(Math.exp(logLikelihood('clean', true, -20, 0, c))).toBeCloseTo(0.02, 10);
  });

  it('retained water: normal', () => {
    // eta 2 mL, stated 0.5, 30 % of 2 = 0.6, 0.5: sd = sqrt(0.25 + 0.36 + 0.25) = 0.927362.
    expect(noiseSd('retained_water', 2, 0.5, c)).toBeCloseTo(0.927362, 6);
    expect(logLikelihood('retained_water', 2, 2, 0.5, c)).toBeCloseTo(
      -Math.log(0.927362) - LOG_SQRT_2PI,
      6,
    );
  });
});

/** d(log likelihood)/d(eta) by a central difference. */
function scoreFunction(
  kind: ObservationKind,
  value: number | boolean,
  eta: number,
  sd: number,
): number {
  const h = 1e-5;
  return (
    (logLikelihood(kind, value, eta + h, sd, c) - logLikelihood(kind, value, eta - h, sd, c)) /
    (2 * h)
  );
}

describe('Fisher information', () => {
  it('score and clean: the expected square of the score function over the outcomes', () => {
    for (const eta of [0.3, 2.2, 3.5, 4.7]) {
      let expected = 0;
      scoreProbabilities(eta, 0.6).forEach((p, k) => {
        if (p > 1e-12) expected += p * scoreFunction('score', k, eta, 0) ** 2;
      });
      expect(fisherInformation('score', eta, 0, c)).toBeCloseTo(expected, 4);
    }
    for (const eta of [-1.2, 0, 0.8]) {
      const p = cleanProbability(eta, c);
      const expected =
        p * scoreFunction('clean', true, eta, 0) ** 2 +
        (1 - p) * scoreFunction('clean', false, eta, 0) ** 2;
      expect(fisherInformation('clean', eta, 0, c)).toBeCloseTo(expected, 5);
    }
  });

  it('area fraction: both point masses and the density between them', () => {
    for (const eta of [0.02, 0.3, 0.93]) {
      const s = noiseSd('area_fraction', eta, 0.05, c);
      const p0 = normCdf((0.01 - eta) / s);
      const p1 = 1 - normCdf((0.99 - eta) / s);
      let expected = 0;
      if (p0 > 1e-12) expected += p0 * scoreFunction('area_fraction', 0, eta, 0.05) ** 2;
      if (p1 > 1e-12) expected += p1 * scoreFunction('area_fraction', 1, eta, 0.05) ** 2;
      // Simpson's rule over the interior.
      const n = 2000;
      const a = 0.01 + 1e-9;
      const b = 0.99 - 1e-9;
      const h = (b - a) / n;
      let sum = 0;
      for (let i = 0; i <= n; i++) {
        const y = a + i * h;
        const density = normPdf((y - eta) / s) / s;
        const w = i === 0 || i === n ? 1 : i % 2 === 1 ? 4 : 2;
        sum += w * density * ((y - eta) / (s * s)) ** 2;
      }
      expected += (sum * h) / 3;
      expect(fisherInformation('area_fraction', eta, 0.05, c) / expected).toBeCloseTo(1, 3);
    }
    // Away from the ends it is that of a normal observation, 1 / sd^2 = 200.
    expect(fisherInformation('area_fraction', 0.5, 0.05, c)).toBeCloseTo(200, 6);
    // An observation that is certain to read "all left" says nothing.
    expect(
      fisherInformation('area_fraction', 1, 0.001, {
        ...c,
        areaModelSd: 0.001,
        areaEndTolerance: 0.05,
      }),
    ).toBeLessThan(1e-6);
  });

  it('normal kinds and counts: closed forms', () => {
    // sd does not depend on eta: 1 / sd^2.
    expect(fisherInformation('mass_fraction', 0.4, 0.03, c)).toBeCloseTo(
      1 / (0.03 ** 2 + 0.05 ** 2),
      9,
    );
    // sd grows with eta: 1 / sd^2 + 2 rel^4 eta^2 / sd^4.
    const s2 = 4 + 4 + 0.25;
    expect(fisherInformation('residual_mass', 20, 2, c)).toBeCloseTo(
      1 / s2 + (2 * 1e-4 * 400) / (s2 * s2),
      9,
    );
    // Negative binomial: 1 / (mu + mu^2 / k) with mu = 3.2.
    expect(fisherInformation('specks', 3, 0, c)).toBeCloseTo(1 / (3.2 + (3.2 * 3.2) / 2), 12);
    let expected = 0;
    for (let n = 0; n < 300; n++) {
      expected +=
        Math.exp(logLikelihood('specks', n, 3, 0, c)) * scoreFunction('specks', n, 3, 0) ** 2;
    }
    expect(fisherInformation('specks', 3, 0, c)).toBeCloseTo(expected, 6);
  });
});

describe('sampling and predictive moments', () => {
  const kinds: [ObservationKind, number, number][] = [
    ['score', 2.8, 0],
    ['area_fraction', 0.06, 0.05],
    ['area_fraction', 0.6, 0.05],
    ['residual_mass', 20, 2],
    ['mass_fraction', 0.4, 0.03],
    ['specks', 3, 0],
    ['clean', 0.3, 0],
    ['retained_water', 2, 0.5],
  ];

  it('draws observations whose mean and deviation are the predictive moments', () => {
    const n = 20000;
    kinds.forEach(([kind, eta, sd], which) => {
      let sum = 0;
      let square = 0;
      for (let i = 0; i < n; i++) {
        let counter = 0;
        const value = sampleObservation(
          kind,
          eta,
          sd,
          c,
          () => randomUniform(5, which, i, counter++),
          () => randomNormal(5, which, i, counter++),
        );
        const y = typeof value === 'boolean' ? (value ? 1 : 0) : value;
        sum += y;
        square += y * y;
      }
      const mean = sum / n;
      const deviation = Math.sqrt(square / n - mean * mean);
      const moments = predictiveMoments(kind, eta, sd, c);
      // Four standard errors of the mean; the deviation to 4 %.
      expect(Math.abs(mean - moments.mean), `${kind} mean`).toBeLessThan(
        (4 * moments.sd) / Math.sqrt(n),
      );
      expect(deviation / moments.sd, `${kind} deviation`).toBeGreaterThan(0.96);
      expect(deviation / moments.sd, `${kind} deviation`).toBeLessThan(1.04);
    });
  });

  it('draws whole scores and counts, booleans, and fractions that pile up at the ends', () => {
    const score = sampleObservation(
      'score',
      2.8,
      0,
      c,
      () => 0.5,
      () => 0.4,
    );
    expect(score).toBe(3);
    expect(
      sampleObservation(
        'area_fraction',
        0.02,
        0.05,
        c,
        () => 0.5,
        () => -1,
      ),
    ).toBe(0);
    expect(
      sampleObservation(
        'area_fraction',
        0.98,
        0.05,
        c,
        () => 0.5,
        () => 1,
      ),
    ).toBe(1);
    expect(
      sampleObservation(
        'clean',
        5,
        0,
        c,
        () => 0.5,
        () => 0,
      ),
    ).toBe(true);
    expect(
      sampleObservation(
        'clean',
        -5,
        0,
        c,
        () => 0.5,
        () => 0,
      ),
    ).toBe(false);
    // Mean 3.2, dispersion 2: P(0) + P(1) + P(2) = 0.1479 + 0.1821 + 0.1681 = 0.4981, so a
    // uniform draw of 0.49 gives 2 and one of 0.5 gives 3.
    expect(
      sampleObservation(
        'specks',
        3,
        0,
        c,
        () => 0.49,
        () => 0,
      ),
    ).toBe(2);
    expect(
      sampleObservation(
        'specks',
        3,
        0,
        c,
        () => 0.5,
        () => 0,
      ),
    ).toBe(3);
  });
});
