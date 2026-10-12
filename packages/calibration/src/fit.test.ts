import { randomNormal } from '@spotless/core';
import { readParamSet, washRegistry } from '@spotless/sim-core';
import { describe, expect, it } from 'vitest';
import { createCalibrationParams } from './cal-params.ts';
import { fitRecords, foldReplayScales, type FitOptions } from './fit.ts';
import type { ParamSet } from '@spotless/sim-core';
import { resolveObsConstants } from './observation.ts';
import type { RecordEvaluator } from './objective.ts';
import { observationIdOf, observationSd, type WashRecord } from './record.ts';
import { TOY_RULE, toyEvaluator, toyFraction, toyRecord, toyState } from './toy.test-util.ts';

/** A toy record with observations drawn at `rate` with normal noise of deviation `noise`. */
function noisyRecord(id: string, rate: number, seed: number, noise = Math.hypot(0.02, 0.05)) {
  const truth = createCalibrationParams({ 'soil.egg_yolk.rateRef': rate });
  const times = [300, 600, 900, 1200, 1800, 2400, 3000, 3600];
  return toyRecord(
    id,
    times,
    times.map((t, i) => toyFraction(truth, t) + noise * randomNormal(seed, 77, i)),
  );
}

const FAST = {
  starts: 2,
  polish: 1,
  profiles: 0,
  predictiveDraws: 0,
  scanPoints: 0,
  createdAt: '2026-10-10T00:00:00Z',
};

describe('fitRecords on the toy model', () => {
  it('recovers the truth within its stated uncertainty', async () => {
    const record = noisyRecord('toy-a', 5.2e-5, 3);
    const fit = await fitRecords([record], ['soil.egg_yolk.rateRef'], {
      ...FAST,
      pool: toyEvaluator(),
    });
    const p = fit.parameters[0];
    if (p === undefined) throw new Error('missing');
    // The truth lies inside the 95 % interval, and the interval is far narrower than the range.
    expect(p.interval[0]).toBeLessThan(5.2e-5);
    expect(p.interval[1]).toBeGreaterThan(5.2e-5);
    expect(p.interval[1] / p.interval[0]).toBeLessThan(1.5);
    expect(Math.abs(Math.log(p.estimate / 5.2e-5))).toBeLessThan(2.5 * p.sd);
    expect(p.verdict).toBe('identified');
    expect(p.movedSd).toBeGreaterThan(0.4);
    expect(fit.estimate.logPosterior).toBeGreaterThan(fit.start.logPosterior + 10);
    // The second difference of the log posterior agrees with the Fisher deviation to 25 %.
    expect(p.curvatureSd).not.toBeNull();
    expect((p.curvatureSd as number) / p.sd).toBeGreaterThan(0.75);
    expect((p.curvatureSd as number) / p.sd).toBeLessThan(1.25);
  });

  it('covers the truth about as often as a 95 % interval should', async () => {
    let covered = 0;
    const runs = 24;
    for (let seed = 1; seed <= runs; seed++) {
      const fit = await fitRecords(
        [noisyRecord(`toy-${seed}`, 4.4e-5, seed)],
        ['soil.egg_yolk.rateRef'],
        {
          ...FAST,
          starts: 0,
          polish: 0,
          pool: toyEvaluator(),
        },
      );
      const p = fit.parameters[0];
      if (p !== undefined && p.interval[0] <= 4.4e-5 && 4.4e-5 <= p.interval[1]) covered++;
    }
    // Expect about 23 of 24; fewer than 20 would be a broken interval.
    expect(covered).toBeGreaterThanOrEqual(20);
  });

  it('is deterministic', async () => {
    const record = noisyRecord('toy-d', 5.2e-5, 9);
    const keys = ['soil.egg_yolk.rateRef', 'liq.proteaseHalfLife'];
    const options = { ...FAST, seed: 4, profiles: 1, predictiveDraws: 6 };
    const a = await fitRecords([record], keys, { ...options, pool: toyEvaluator() });
    const b = await fitRecords([record], keys, { ...options, pool: toyEvaluator() });
    expect(b.parameters).toEqual(a.parameters);
    expect(b.paramSetHash).toBe(a.paramSetHash);
    expect(b.profiles).toEqual(a.profiles);
    expect(b.predictive).toEqual(a.predictive);
    expect(b.evaluations).toBe(a.evaluations);
    // Another seed draws other starts and other predictive samples, and ends at the same estimate.
    const c = await fitRecords([record], keys, { ...options, seed: 5, pool: toyEvaluator() });
    expect(c.parameters[0]?.estimate).toBeCloseTo(a.parameters[0]?.estimate ?? 0, 7);
  });

  it('says so when the records cannot identify a parameter, and returns its prior', async () => {
    const record = noisyRecord('toy-u', 5.2e-5, 5);
    const fit = await fitRecords([record], ['soil.egg_yolk.rateRef', 'liq.proteaseHalfLife'], {
      ...FAST,
      pool: toyEvaluator(),
    });
    const [rate, halfLife] = fit.parameters;
    expect(rate?.verdict).toBe('identified');
    // The toy model does not read the half-life: nothing is learnt, and the default comes back.
    expect(halfLife?.verdict).toBe('not identified');
    expect(halfLife?.returnedPrior).toBe(true);
    expect(halfLife?.estimate).toBeCloseTo(1800, 9);
    expect(halfLife?.shrink).toBeCloseTo(1, 6);
    expect(halfLife?.interval[0]).toBeLessThan(700);
    expect(halfLife?.interval[1]).toBeGreaterThan(4000);
    expect(fit.report).toMatch(/liq\.proteaseHalfLife.*not identified: prior returned/);
    expect(fit.paramSet.overrides['liq.proteaseHalfLife']).toBeCloseTo(1800, 9);
  });

  it('reports two parameters that only act through their product as confounded', async () => {
    const record = noisyRecord('toy-c', 5.2e-5, 6);
    const fit = await fitRecords([record], ['soil.egg_yolk.rateRef', 'soil.egg_yolk.jetRatio'], {
      ...FAST,
      resetUnidentified: false,
      pool: toyEvaluator(),
    });
    const [rate, ratio] = fit.parameters;
    expect(rate?.confoundedWith[0]?.id).toBe('soil.egg_yolk.jetRatio');
    expect(rate?.confoundedWith[0]?.correlation).toBeLessThan(-0.9);
    expect(ratio?.confoundedWith[0]?.id).toBe('soil.egg_yolk.rateRef');
    // Each alone would be pinned down; together neither is.
    expect(fit.identifiability.parameters[0]?.conditional).toBeLessThan(0.3);
    expect(rate?.shrink).toBeGreaterThan(0.5);
    // The product is recovered all the same: rate x ratio / 4 within 15 % of the truth.
    const product = ((rate?.estimate ?? 0) * (ratio?.estimate ?? 0)) / 4;
    expect(product / 5.2e-5).toBeGreaterThan(0.85);
    expect(product / 5.2e-5).toBeLessThan(1.15);
    expect(fit.report).toMatch(/confounded/);
  });

  it("writes the fitted set in the registry's own format, with hashes that read back", async () => {
    const fit = await fitRecords(
      [noisyRecord('toy-f', 5.2e-5, 2)],
      ['soil.egg_yolk.rateRef', 'obs.massFractionModelSd'],
      {
        ...FAST,
        name: 'toy-fit',
        pool: toyEvaluator(),
      },
    );
    expect(fit.paramSet.format).toBe('spotless.params');
    expect(fit.paramSet.provenance).toMatchObject({
      name: 'toy-fit',
      origin: 'calibration',
      washRecords: ['toy-f'],
      createdAt: '2026-10-10T00:00:00Z',
    });
    // Only keys of the wash simulation are in the parameter file; the calibration's are beside it.
    expect(Object.keys(fit.paramSet.overrides)).toEqual(['soil.egg_yolk.rateRef']);
    expect(Object.keys(fit.calibrationOverrides)).toEqual(['obs.massFractionModelSd']);
    const read = readParamSet(washRegistry(), JSON.parse(JSON.stringify(fit.paramSet)));
    expect(read.ok).toBe(true);
    if (read.ok) {
      expect(read.value.soilHash).toBe(fit.paramSet.soilHash);
      expect(read.value.get('soil.egg_yolk.rateRef')).toBe(fit.parameters[0]?.estimate);
    }
    expect(fit.paramSetHash).toMatch(/^sha256:/);
  });

  it('profiles a parameter to an interval that brackets the estimate and the truth', async () => {
    const fit = await fitRecords([noisyRecord('toy-p', 5.2e-5, 8)], ['soil.egg_yolk.rateRef'], {
      ...FAST,
      profiles: 1,
      pool: toyEvaluator(),
    });
    const profile = fit.profiles[0];
    const p = fit.parameters[0];
    if (profile === undefined || p === undefined) throw new Error('missing');
    expect(profile.id).toBe('soil.egg_yolk.rateRef');
    const [lo, hi] = profile.interval;
    expect(lo).not.toBeNull();
    expect(hi).not.toBeNull();
    expect(lo as number).toBeLessThan(p.estimate);
    expect(hi as number).toBeGreaterThan(p.estimate);
    expect(lo as number).toBeLessThan(5.2e-5);
    expect(hi as number).toBeGreaterThan(5.2e-5);
    // Close to the normal approximation here, where the posterior is close to normal: 15 %.
    expect((lo as number) / p.interval[0]).toBeGreaterThan(0.85);
    expect((lo as number) / p.interval[0]).toBeLessThan(1.15);
    expect((hi as number) / p.interval[1]).toBeGreaterThan(0.85);
    expect((hi as number) / p.interval[1]).toBeLessThan(1.15);
    // The profile peaks at the estimate.
    expect(Math.max(...profile.logPosterior)).toBeCloseTo(fit.estimate.logPosterior, 6);
  });

  it('passes the predictive check on data the model made, and fails it on data it did not', async () => {
    const good = await fitRecords([noisyRecord('toy-g', 5.2e-5, 12)], ['soil.egg_yolk.rateRef'], {
      ...FAST,
      predictiveDraws: 40,
      pool: toyEvaluator(),
    });
    expect(good.predictive[0]?.pValue).toBeGreaterThan(0.05);
    expect(good.predictive[0]?.pValue).toBeLessThan(0.99);
    // Five times the scatter the observation model allows.
    const bad = await fitRecords(
      [noisyRecord('toy-b', 5.2e-5, 12, 0.27)],
      ['soil.egg_yolk.rateRef'],
      {
        ...FAST,
        predictiveDraws: 40,
        pool: toyEvaluator(),
      },
    );
    expect(bad.predictive[0]?.pValue).toBeLessThan(0.05);
    expect(bad.predictive[0]?.outliers.length).toBeGreaterThan(0);
  });

  it('lists the fit to every observation', async () => {
    const record = noisyRecord('toy-o', 5.2e-5, 2);
    const fit = await fitRecords([record], ['soil.egg_yolk.rateRef'], {
      ...FAST,
      pool: toyEvaluator(),
    });
    expect(fit.observations).toHaveLength(8);
    const first = fit.observations[0];
    expect(first?.observationId).toBe('tile.mass_fraction@300');
    expect(first?.observed).toBe(record.observations[0]?.value);
    expect(first?.sd).toBeCloseTo(Math.hypot(0.02, 0.05), 12);
    expect(first?.residual).toBeCloseTo(
      ((first?.observed as number) - (first?.mean ?? 0)) / (first?.sd ?? 1),
      12,
    );
    const sum = fit.observations.reduce((a, o) => a + o.logLikelihood, 0);
    expect(sum).toBeCloseTo(fit.estimate.logLikelihood, 9);
  });
});

const TIMES = [300, 600, 900, 1200, 1800, 2400, 3600, 5400];
const RATE = 'soil.egg_yolk.rateRef';

/** An evaluator of one tile whose residual mass fraction at time t is `model(params, t)`. */
function evaluatorOf(model: (params: ParamSet, t: number) => number): RecordEvaluator {
  return {
    get(record: WashRecord) {
      const observations = record.observations.map((o, index) => ({
        index,
        id: observationIdOf(o),
        kind: o.kind,
        itemId: o.item,
        target: 'item',
        at: o.at_s ?? null,
        value: o.value,
        sd: observationSd(record, o) ?? 0,
      }));
      return Promise.resolve({
        observations,
        evaluate(params: ParamSet) {
          const eta = Float64Array.from(observations, (o) => model(params, o.at ?? 0));
          return Promise.resolve({
            recordId: record.id,
            eta,
            states: Array.from(eta, (value) => toyState(value)),
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

/** Observations of `model` at `truth` with the noise of a mass fraction weighed to 0.02. */
function drawn(
  id: string,
  model: (params: ParamSet, t: number) => number,
  truth: Record<string, number>,
  seed: number,
  times: readonly number[] = TIMES,
): WashRecord {
  const params = createCalibrationParams(truth);
  const noise = Math.hypot(0.02, 0.05);
  return toyRecord(
    id,
    times,
    times.map((t, i) => model(params, t) + noise * randomNormal(seed, 777, i)),
  );
}

const single = (params: ParamSet, t: number): number =>
  Math.exp(-5e-4 * (params.get(RATE) / 3e-5) * t);

const QUICK: FitOptions = { profiles: 0, predictiveDraws: 0, scanPoints: 0 };

describe('what the fit does with parameters the records do not identify locally', () => {
  // Soil that is either left alone or removed: below a rate of 2.2e-5 nothing comes off at
  // all, above it the tile cleans as usual. The registry default (3e-5) is on the cleaning
  // side; the data say nothing came off. On the plateau no prediction moves with the rate.
  const cliff = (params: ParamSet, t: number): number =>
    params.get(RATE) < 2.2e-5 ? 1 : single(params, t);

  it('does not throw the optimum away for the prior centre when the records exclude it', async () => {
    for (const seed of [1, 2, 3, 4]) {
      const record = drawn(`cliff-${seed}`, cliff, { [RATE]: 1.2e-5 }, seed);
      // Profiled, as by default: next to a cliff the derivatives say nothing useful about the
      // width of the plateau; the profile walks it.
      const fit = await fitRecords([record], [RATE], {
        ...QUICK,
        profiles: 1,
        pool: evaluatorOf(cliff),
        seed,
      });
      const p = fit.parameters[0];
      if (p === undefined) throw new Error('missing');
      // The estimate is on the plateau, where the data are, not at the default.
      expect(p.estimate).toBeLessThan(2.2e-5);
      expect(p.returnedPrior).toBe(false);
      // It is the best point found, and far better than the start (the default).
      expect(fit.estimate.logPosterior).toBeGreaterThan(fit.bestLogPosterior - 0.5);
      expect(fit.estimate.logPosterior).toBeGreaterThan(fit.start.logPosterior + 20);
      // The fall of the log posterior at the prior centre is reported, and it is large.
      expect(p.priorCentreDrop).toBeGreaterThan(20);
      expect(fit.report).toMatch(/the log posterior falls by \d+\.\d with it at its prior centre/);
      // The truth is inside the interval, which is the profile's and stops at the cliff.
      expect(p.intervalFrom).toBe('profile');
      expect(p.interval[0]).toBeLessThanOrEqual(1.2e-5);
      expect(p.interval[1]).toBeGreaterThanOrEqual(1.2e-5);
      expect(p.interval[1]).toBeLessThan(2.3e-5);
      // One verdict, the same in both tables of the report.
      const lines = fit.report.split('\n').filter((line) => line.startsWith(RATE));
      expect(lines.length).toBeGreaterThanOrEqual(2);
      for (const line of lines) expect(line).toContain(p.status);
      expect(fit.report).not.toMatch(/prior returned/);
      if (p.verdict === 'not identified') {
        expect(p.status).toBe('not locally identified, but the records exclude the prior centre');
      }
    }
  });

  it('would have returned the default without the comparison (what the comparison is for)', async () => {
    const record = drawn('cliff-old', cliff, { [RATE]: 1.2e-5 }, 1);
    const guarded = await fitRecords([record], [RATE], { ...QUICK, pool: evaluatorOf(cliff) });
    const unguarded = await fitRecords([record], [RATE], {
      ...QUICK,
      pool: evaluatorOf(cliff),
      resetTolerance: Infinity,
    });
    const p = unguarded.parameters[0];
    if (guarded.parameters[0]?.verdict === 'not identified') {
      // The local verdict alone puts it back at 3e-5, tens of log units below the optimum.
      expect(p?.returnedPrior).toBe(true);
      expect(p?.estimate).toBeCloseTo(3e-5, 12);
      expect(unguarded.bestLogPosterior - unguarded.estimate.logPosterior).toBeGreaterThan(20);
      expect(unguarded.report).toMatch(/returning unidentified parameters to their priors cost/);
    }
    expect(guarded.bestLogPosterior - guarded.estimate.logPosterior).toBeLessThanOrEqual(0.5);
  });

  it('still returns a parameter the model does not read, at no cost', async () => {
    const record = drawn('unread', single, { [RATE]: 5.2e-5 }, 5);
    const fit = await fitRecords([record], [RATE, 'liq.proteaseHalfLife'], {
      ...QUICK,
      pool: evaluatorOf(single),
    });
    const [rate, halfLife] = fit.parameters;
    expect(rate?.status).toBe('identified');
    expect(halfLife?.status).toBe('not identified: prior returned');
    expect(halfLife?.estimate).toBeCloseTo(1800, 9);
    expect(fit.bestLogPosterior - fit.estimate.logPosterior).toBeLessThan(0.5);
    // Both tables say the same of it.
    const lines = fit.report.split('\n').filter((line) => line.startsWith('liq.proteaseHalfLife'));
    expect(lines.length).toBeGreaterThanOrEqual(2);
    for (const line of lines) expect(line).toMatch(/not identified: prior returned/);
  });
});

describe('coverage of the stated interval across the registered range', () => {
  it('holds for truths at 10 %, 50 % and 90 % of the range, not only near the default', async () => {
    // The range of the rate is 1e-5 to 1e-4; in its logarithm 10 %, 50 % and 90 % are:
    const truths = [0.1, 0.5, 0.9].map((share) => 1e-5 * 10 ** share);
    const runs = 60;
    for (const truth of truths) {
      let covered = 0;
      for (let seed = 1; seed <= runs; seed++) {
        const record = drawn(`cover-${seed}`, single, { [RATE]: truth }, seed);
        const fit = await fitRecords([record], [RATE], {
          ...QUICK,
          starts: 2,
          polish: 1,
          pool: evaluatorOf(single),
          seed,
        });
        const p = fit.parameters[0];
        if (p !== undefined && p.interval[0] <= truth && truth <= p.interval[1]) covered++;
      }
      // A 95 % interval: 57 of 60 expected; under 52 (87 %) has a chance below 1 in 500.
      expect(covered, `truth ${truth}`).toBeGreaterThanOrEqual(52);
    }
  });
});

describe('an estimate on a bound', () => {
  it('is reported as such, with a one-sided interval', async () => {
    // The tile cleans six times as fast as the default, twice what the range allows.
    const fast = (_: ParamSet, t: number): number => Math.exp(-5e-4 * 6 * t);
    const record = drawn('bound', fast, {}, 5);
    const fit = await fitRecords([record], [RATE], { pool: evaluatorOf(single), seed: 1 });
    const p = fit.parameters[0];
    if (p === undefined) throw new Error('missing');
    expect(p.estimate).toBeCloseTo(1e-4, 12);
    expect(p.atBound).toBe('upper');
    expect(p.status).toBe('at the upper bound of its range');
    // From the profile on the inner side up to the bound itself.
    expect(p.interval[1]).toBe(1e-4);
    expect(p.interval[0]).toBeGreaterThan(8e-5);
    expect(p.interval[0]).toBeLessThan(1e-4);
    expect(fit.profiles[0]?.id).toBe(RATE);
    expect(fit.report).toMatch(
      /WARNING: soil\.egg_yolk\.rateRef sits on the upper bound of its registered range/,
    );
    expect(fit.report).toMatch(/at the upper bound of its range/);
    // An estimate inside the range is not flagged.
    const inside = await fitRecords([drawn('inside', single, { [RATE]: 5e-5 }, 5)], [RATE], {
      ...QUICK,
      pool: evaluatorOf(single),
    });
    expect(inside.parameters[0]?.atBound).toBeNull();
    expect(inside.report).not.toMatch(/sits on the/);
  });
});

describe('a gross error among the observations', () => {
  const withOutlier = (seed: number): WashRecord => {
    const record = drawn(`outlier-${seed}`, single, {}, seed);
    // At 3600 s the truth is 0.165; 1.0 was written down (a tile that was not washed, a typo).
    const observations = record.observations.map((o, i) => (i === 6 ? { ...o, value: 1.0 } : o));
    return { ...record, observations };
  };

  it('does not move the estimate, and is named', async () => {
    let covered = 0;
    let named = 0;
    let mean = 0;
    const runs = 30;
    for (let seed = 1; seed <= runs; seed++) {
      const fit = await fitRecords([withOutlier(seed)], [RATE], {
        profiles: 0,
        scanPoints: 0,
        pool: evaluatorOf(single),
        seed,
      });
      const p = fit.parameters[0];
      if (p === undefined) throw new Error('missing');
      if (p.interval[0] <= 3e-5 && 3e-5 <= p.interval[1]) covered++;
      mean += p.estimate / runs;
      const bad = fit.observations[6];
      if ((bad?.outlierProbability ?? 0) > 0.9) named++;
      // The predictive check runs by default and lists the one value, not most of them.
      expect(fit.predictive).toHaveLength(1);
      expect(fit.predictive[0]?.grossErrors).toContain('tile.mass_fraction@3600');
      expect(fit.predictive[0]?.grossErrors.length).toBeLessThanOrEqual(2);
      expect(fit.predictive[0]?.outliers.length).toBeLessThanOrEqual(2);
    }
    // 30 of 30 named; coverage as without the outlier (25 of 30 would be a broken interval);
    // the mean estimate within 5 % of the truth (it was 1.87e-5 with a plain normal likelihood).
    expect(named).toBe(runs);
    expect(covered).toBeGreaterThanOrEqual(25);
    expect(mean / 3e-5).toBeGreaterThan(0.95);
    expect(mean / 3e-5).toBeLessThan(1.05);
  });

  it('is what drags the estimate when the allowance is switched off', async () => {
    const fit = await fitRecords([withOutlier(1)], [RATE], {
      ...QUICK,
      base: createCalibrationParams({ 'obs.outlierShare': 0 }),
      pool: evaluatorOf(single),
    });
    const p = fit.parameters[0];
    expect(p?.estimate).toBeLessThan(2.3e-5);
    expect(p?.interval[1]).toBeLessThan(3e-5);
    expect(fit.observations[6]?.outlierProbability).toBe(0);
  });

  it('finds the optimum from a start so far off that every value looks like a gross error', async () => {
    // Started at the upper end of the range with data from the lower: with the allowance alone
    // the log likelihood is flat there; the first stage of the minimisation has the slope.
    const record = drawn('far', single, { [RATE]: 1.3e-5 }, 3);
    const fit = await fitRecords([record], [RATE], {
      ...QUICK,
      starts: 0,
      polish: 0,
      base: createCalibrationParams({ [RATE]: 1e-4 }),
      pool: evaluatorOf(single),
    });
    const p = fit.parameters[0];
    expect(p?.interval[0]).toBeLessThan(1.3e-5);
    expect(p?.interval[1]).toBeGreaterThan(1.3e-5);
    expect(fit.estimate.logPosterior).toBeGreaterThan(fit.start.logPosterior + 10);
  });
});

describe('a second optimum', () => {
  // The predictions depend on |ln(rate / 3e-5) - 0.35|: 7.76e-5 (the truth) and 2.34e-5 (its
  // mirror, nearer the prior centre) give the same data.
  const mirror = (params: ParamSet, t: number): number =>
    Math.exp(-5e-4 * Math.exp(Math.abs(Math.log(params.get(RATE) / 3e-5) - 0.35)) * t);

  it('is found and reported beside the estimate', async () => {
    for (const seed of [1, 2, 3]) {
      const record = drawn(`mirror-${seed}`, mirror, { [RATE]: 7.76e-5 }, seed);
      const fit = await fitRecords([record], [RATE], {
        profiles: 0,
        predictiveDraws: 0,
        pool: evaluatorOf(mirror),
        seed,
      });
      const p = fit.parameters[0];
      if (p === undefined) throw new Error('missing');
      // The estimate is the mode the prior prefers; the other is listed, a little lower.
      expect(fit.optima.length).toBeGreaterThanOrEqual(1);
      const modes = [p.estimate, ...fit.optima.map((o) => o.values[0] as number)];
      expect(modes.some((m) => Math.abs(Math.log(m / 7.76e-5)) < 0.2)).toBe(true);
      expect(modes.some((m) => Math.abs(Math.log(m / 2.34e-5)) < 0.2)).toBe(true);
      const other = fit.optima[0];
      expect(other?.logPosterior).toBeLessThanOrEqual(fit.estimate.logPosterior);
      expect(fit.estimate.logPosterior - (other?.logPosterior ?? 0)).toBeLessThan(5);
      expect(other?.distanceSd).toBeGreaterThan(3);
      expect(fit.report).toMatch(/WARNING: 1 other local optimum of the log posterior/);
    }
  });

  it('is found by the scan when no start falls in its basin', async () => {
    const record = drawn('mirror-scan', mirror, { [RATE]: 7.76e-5 }, 1);
    const none = await fitRecords([record], [RATE], {
      ...QUICK,
      starts: 0,
      polish: 0,
      pool: evaluatorOf(mirror),
    });
    const scanned = await fitRecords([record], [RATE], {
      ...QUICK,
      starts: 0,
      polish: 0,
      scanPoints: 24,
      pool: evaluatorOf(mirror),
    });
    expect(none.optima).toHaveLength(0);
    expect(scanned.optima).toHaveLength(1);
    expect(none.report).toMatch(/no other local optimum was found/);
  });

  it('reports none where there is one hump', async () => {
    const fit = await fitRecords([drawn('one', single, { [RATE]: 5e-5 }, 2)], [RATE], {
      profiles: 0,
      predictiveDraws: 0,
      pool: evaluatorOf(single),
    });
    expect(fit.optima).toHaveLength(0);
  });
});

describe('profiles beside the normal interval', () => {
  it('are made by default and agree where the posterior is normal', async () => {
    const fit = await fitRecords([drawn('normal', single, { [RATE]: 4e-5 }, 4)], [RATE], {
      pool: evaluatorOf(single),
    });
    const p = fit.parameters[0];
    expect(fit.profiles).toHaveLength(1);
    expect(p?.profileInterval).not.toBeNull();
    expect(p?.profileDisagrees).toBe(false);
    expect(fit.report).toMatch(/profiles \(the other parameters re-fitted at every value\)/);
    expect(fit.report).not.toMatch(/DISAGREES/);
  });

  it('are as wide as the normal intervals where the posterior is normal, in several parameters', async () => {
    // A rate and a lag, both pinned by the tile to a few percent of ranges that span factors
    // of ten and sixty: the re-fits along a profile have to work at the scale of the
    // posterior, a hundredth of the prior's, or the profile falls too fast and the interval
    // comes out too narrow.
    const LAG = 'soil.egg_yolk.tLag';
    const lagged = (params: ParamSet, t: number): number =>
      Math.exp(-5e-4 * (params.get(RATE) / 3e-5) * Math.max(0, t - params.get(LAG)));
    const truth: Record<string, number> = { [RATE]: 6e-5, [LAG]: 1100 };
    const times = [600, 900, 1200, 1300, 1400, 1500, 1800, 2400, 3000, 3600];
    let covered = 0;
    let agree = 0;
    const runs = 20;
    for (let seed = 1; seed <= runs; seed++) {
      const record = drawn(`lagged-${seed}`, lagged, truth, seed, times);
      const fit = await fitRecords([record], [RATE, LAG], {
        predictiveDraws: 0,
        scanPoints: 0,
        base: createCalibrationParams({ 'obs.outlierShare': 0 }),
        pool: evaluatorOf(lagged),
        seed,
      });
      for (const p of fit.parameters) {
        expect(p.intervalFrom).toBe('profile');
        const t = truth[p.key] as number;
        if (p.interval[0] <= t && t <= p.interval[1]) covered++;
        // Each end of the profile's interval within 30 % of the normal one's distance.
        if (!p.profileDisagrees) agree++;
        // Never narrower than half the normal interval: that is a profile that did not re-fit.
        const width = Math.log(p.interval[1] / p.interval[0]);
        const normal = Math.log(p.normalInterval[1] / p.normalInterval[0]);
        expect(width / normal, `${p.id} seed ${seed}`).toBeGreaterThan(0.5);
      }
    }
    // 40 intervals at 95 %: 38 expected; under 34 has a chance below 1 in 100.
    expect(covered).toBeGreaterThanOrEqual(34);
    expect(agree).toBeGreaterThanOrEqual(24);
  });

  it('follow a curved ridge that the normal interval at the optimum cannot', async () => {
    // The tile sees one combination of two parameters, u - 3 v^2 with u = ln(rate / 3e-5) and
    // v = ln(jet ratio / 4): a parabola of equally good fits. The priors pick its apex; the
    // truth is half way up one arm. At the apex nothing moves with v, so the derivatives say
    // the rate is known to a few percent.
    const RATIO = 'soil.egg_yolk.jetRatio';
    const ridge = (params: ParamSet, t: number): number => {
      const u = Math.log(params.get(RATE) / 3e-5);
      const v = Math.log(params.get(RATIO) / 4);
      return Math.exp(-5e-4 * Math.exp(u - 3 * v * v) * t);
    };
    const truth = { [RATE]: 3e-5 * Math.exp(0.45), [RATIO]: 4 * Math.exp(0.5) };
    let normal = 0;
    let profiled = 0;
    const runs = 6;
    for (let seed = 1; seed <= runs; seed++) {
      const record = drawn(`ridge-${seed}`, ridge, truth, seed);
      const fit = await fitRecords([record], [RATE, RATIO], {
        predictiveDraws: 0,
        scanPoints: 0,
        // Priors that hold the estimate at the apex (those of an earlier campaign, say).
        priors: { [RATE]: { sd: 0.6 }, [RATIO]: { sd: 0.5 } },
        pool: evaluatorOf(ridge),
        seed,
      });
      const p = fit.parameters[0];
      if (p === undefined) throw new Error('missing');
      const t = truth[RATE] as number;
      if (p.normalInterval[0] <= t && t <= p.normalInterval[1]) normal++;
      if (p.interval[0] <= t && t <= p.interval[1]) profiled++;
      expect(p.intervalFrom).toBe('profile');
      expect(p.profileInterval).not.toBeNull();
      // Where the normal interval misses the truth, the profile reaches further up the arm
      // and the difference is flagged.
      if (p.normalInterval[1] < t) {
        expect(p.interval[1]).toBeGreaterThan(1.3 * p.normalInterval[1]);
        expect(p.profileDisagrees).toBe(true);
        expect(fit.report).toMatch(/DISAGREES by over 30 %/);
      }
      expect(fit.report).toMatch(/\(p\)/);
    }
    // The normal interval misses the truth in most runs; the profile's holds it in all.
    expect(normal).toBeLessThanOrEqual(3);
    expect(profiled).toBe(runs);
  });

  it('take the fit up again from a point that is better than where the minimiser stopped', async () => {
    // The same ridge, with a minimiser that is cut off after a handful of evaluations: it
    // stops short of the optimum. Without profiles that is where the fit ends; with them the
    // re-fits along each parameter find the better point and the fit goes on from it.
    const RATIO = 'soil.egg_yolk.jetRatio';
    const ridge = (params: ParamSet, t: number): number => {
      const u = Math.log(params.get(RATE) / 3e-5);
      const v = Math.log(params.get(RATIO) / 4);
      return Math.exp(-5e-4 * Math.exp(u - 3 * v * v) * t);
    };
    const record = drawn('cut-short', ridge, { [RATE]: 9.5e-5, [RATIO]: 4 }, 3);
    const said: string[] = [];
    const cut: FitOptions = {
      ...QUICK,
      starts: 0,
      polish: 0,
      restarts: 0,
      maxEvaluations: 4,
      jacobianStep: 0.01,
      adaptStep: false,
      resetUnidentified: false,
      base: createCalibrationParams({ [RATE]: 1.2e-5, 'obs.outlierShare': 0 }),
      pool: evaluatorOf(ridge),
    };
    const short = await fitRecords([record], [RATE, RATIO], cut);
    const resumed = await fitRecords([record], [RATE, RATIO], {
      ...cut,
      profiles: 2,
      onProgress: (message) => said.push(message),
    });
    expect(said.join('\n')).toMatch(/a profile found log posterior .* minimising again from there/);
    const full = await fitRecords([record], [RATE, RATIO], {
      ...QUICK,
      resetUnidentified: false,
      base: createCalibrationParams({ 'obs.outlierShare': 0 }),
      pool: evaluatorOf(ridge),
    });
    expect(full.estimate.logPosterior).toBeGreaterThan(short.estimate.logPosterior + 1);
    expect(resumed.estimate.logPosterior).toBeGreaterThan(short.estimate.logPosterior + 0.25);
    // The profile of the resumed fit peaks at its estimate, or the report says it is not settled.
    if (resumed.unsettled === null) {
      for (const profile of resumed.profiles) {
        expect(Math.max(...profile.logPosterior)).toBeLessThan(
          resumed.bestLogPosterior + 0.25 + 1e-9,
        );
      }
      expect(resumed.report).not.toMatch(/the optimum is not settled/);
    } else expect(resumed.report).toMatch(/the optimum is not settled/);
    expect(full.unsettled).toBeNull();
  });

  it('end at the bound where the log posterior never falls far enough', async () => {
    // One late look at a tile that is all but clean, and a prior that says next to nothing:
    // the rate can be anything above a floor.
    const record = drawn('one-sided', single, { [RATE]: 3e-5 }, 2, [9000]);
    const fit = await fitRecords([record], [RATE], {
      pool: evaluatorOf(single),
      priors: { [RATE]: { sd: 10 } },
      resetUnidentified: false,
      profiles: [RATE],
    });
    const p = fit.parameters[0];
    if (p === undefined) throw new Error('missing');
    expect(p.intervalFrom).toBe('profile');
    expect(p.profileInterval?.[1]).toBeNull();
    expect(p.interval[1]).toBe(1e-4);
    expect(p.interval[0]).toBeLessThan(3e-5);
    expect(fit.report).toMatch(/up to the bound/);
  });
});

describe('a restricted replay whose background is frozen where the pool first looked', () => {
  // The tile's rate is slowed by what the rest of the load releases, which grows with the
  // rate too. The restricted evaluator knows that background only at the parameters it was
  // last computed at.
  const slowed = (rate: number, background: number, t: number): number =>
    Math.exp((-5e-4 * (rate / 3e-5) * t) / (1 + 0.5 * (background / 3e-5)));
  const restricted = (): RecordEvaluator & { refreshes: number } => {
    let background: number | null = null;
    const made: RecordEvaluator & { refreshes: number } = {
      refreshes: 0,
      get(record, first) {
        background ??= first.get(RATE);
        const exact = evaluatorOf((params, t) => slowed(params.get(RATE), params.get(RATE), t));
        const frozen = evaluatorOf((params, t) =>
          slowed(params.get(RATE), background as number, t),
        );
        return Promise.all([exact.get(record, first), frozen.get(record, first)]).then(
          ([full, approximate]) => ({
            observations: approximate.observations,
            evaluate: approximate.evaluate,
            evaluateFull: full.evaluate,
            refreshBackground(params: ParamSet) {
              background = params.get(RATE);
              made.refreshes++;
              return Promise.resolve(true);
            },
            backgroundAt: () => ({ [RATE]: background as number }),
          }),
        );
      },
    };
    return made;
  };
  const truth = 7e-5;
  const record = (() => {
    const params = createCalibrationParams({ [RATE]: truth });
    const noise = Math.hypot(0.02, 0.05);
    return toyRecord(
      'background',
      TIMES,
      TIMES.map(
        (t, i) => slowed(params.get(RATE), params.get(RATE), t) + noise * randomNormal(8, 777, i),
      ),
    );
  })();

  it('is computed again at the estimate, and the remaining difference is reported', async () => {
    const pool = restricted();
    const fit = await fitRecords([record], [RATE], { ...QUICK, pool });
    expect(pool.refreshes).toBeGreaterThanOrEqual(1);
    const check = fit.restriction[0];
    expect(check?.recordId).toBe('background');
    expect(check?.refreshed).toBeGreaterThanOrEqual(1);
    // At the estimate the restricted prediction is the full one, to a hundredth of a deviation.
    expect(check?.worstSd).toBeLessThan(0.02);
    const p = fit.parameters[0];
    expect(p?.interval[0]).toBeLessThan(truth);
    expect(p?.interval[1]).toBeGreaterThan(truth);
    expect(fit.report).toMatch(/restricted replay against the replay of every soil/);
  });

  it('is off by half a deviation and more when it is left where the pool first looked', async () => {
    const pool = restricted();
    const fit = await fitRecords([record], [RATE], { ...QUICK, pool, refineBackground: 0 });
    expect(pool.refreshes).toBe(0);
    expect(fit.restriction[0]?.worstSd).toBeGreaterThan(0.5);
    expect(fit.report).toMatch(/LARGE: fit with restrict "all"/);
    // The estimate is that of a model with the background of the default: too low.
    expect(fit.parameters[0]?.estimate).toBeLessThan(0.85 * truth);
  });
});

describe('foldReplayScales', () => {
  it('multiplies the key a scale stands for, inside its range', () => {
    const folded = foldReplayScales(
      createCalibrationParams({ 'cal.jetShearScale': 1.4, 'soil.KE': 0.9 }),
    );
    expect(folded.overrides['jets.kStag']).toBeCloseTo(1.4, 12);
    expect(folded.overrides['soil.KE']).toBe(0.9);
    expect(folded.overrides['cal.jetShearScale']).toBeUndefined();
    const beyond = foldReplayScales(createCalibrationParams({ 'cal.jetShearScale': 4 }));
    expect(beyond.overrides['jets.kStag']).toBeUndefined();
    expect(beyond.notes[0]).toMatch(/outside/);
  });
});
