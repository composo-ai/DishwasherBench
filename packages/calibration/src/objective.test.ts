import { describe, expect, it } from 'vitest';
import { createCalibrationParams } from './cal-params.ts';
import {
  createObjective,
  fitParameters,
  fromZ,
  isStandardKey,
  logPrior,
  paramsAt,
  PRIOR_SD_BY_TAG,
  recordWeight,
  toZ,
  zOf,
} from './objective.ts';
import { toyEvaluator, toyFraction, toyRecord } from './toy.test-util.ts';

describe('fit parameters from the registry', () => {
  it('fits a positive scale in its logarithm, with a prior from default, range and tag', () => {
    const [rate, halfLife] = fitParameters(['soil.egg_yolk.rateRef', 'liq.proteaseHalfLife']);
    // VERIFIED, 3e-5 in 1e-5 to 1e-4: the farther end is ln(10 / 3) away, which is one deviation.
    expect(rate?.transform).toBe('log');
    expect(rate?.priorMean).toBeCloseTo(Math.log(3e-5), 12);
    expect(rate?.priorSd).toBeCloseTo(Math.log(10 / 3), 12);
    expect(rate?.lower).toBeCloseTo(Math.log(1e-5), 12);
    expect(rate?.upper).toBeCloseTo(Math.log(1e-4), 12);
    expect(rate?.route).toBe('replay');
    // ESTIMATED, 1800 s in 180 to 14400 s: one and a half times ln(10), the way to the lower
    // end (the calcium-free buffer value), which is the farther one.
    expect(halfLife?.transform).toBe('log');
    expect(halfLife?.priorMean).toBeCloseTo(Math.log(1800), 12);
    expect(halfLife?.priorSd).toBeCloseTo(1.5 * Math.log(10), 12);
    // No end of a registered range is more than one prior deviation from the default.
    for (const p of [rate, halfLife]) {
      if (p === undefined) throw new Error('missing');
      expect((p.upper - p.priorMean) / p.priorSd).toBeLessThanOrEqual(1 + 1e-12);
      expect((p.priorMean - p.lower) / p.priorSd).toBeLessThanOrEqual(1 + 1e-12);
    }
    expect(PRIOR_SD_BY_TAG.SYN).toBeGreaterThan(PRIOR_SD_BY_TAG.ESTIMATED);
    expect(PRIOR_SD_BY_TAG.ESTIMATED).toBeGreaterThan(PRIOR_SD_BY_TAG.VERIFIED);
  });

  it('fits a fraction in its logit and anything else in its own unit', () => {
    const [mixing, tm, shift] = fitParameters([
      'tl.poolMixing',
      'soil.enzymeTm',
      'prog.mainWashTargetShift',
    ]);
    // SYN, 0.5 in 0 to 1: logit 0; twice ln(99), the way to 0.99.
    expect(mixing?.transform).toBe('logit');
    expect(mixing?.priorMean).toBeCloseTo(0, 12);
    expect(mixing?.priorSd).toBeCloseTo(2 * Math.log(99), 12);
    // ESTIMATED, 75 C in 50 to 90 C: linear, one and a half times the 25 K to the lower end.
    expect(tm?.transform).toBe('linear');
    expect(tm?.priorMean).toBe(75);
    expect(tm?.priorSd).toBeCloseTo(1.5 * 25, 12);
    expect(shift?.transform).toBe('linear');
    expect(shift?.priorMean).toBe(0);
  });

  it('fits a positive quantity whose range starts at 0 in its logarithm, above a floor', () => {
    // ESTIMATED, 0.01 in 0 to 0.05: a factor 5 below its upper end, so logarithmic, with a
    // floor of a tenth of the default in place of 0 (0.01^2 / 0.05 = 0.002 is higher).
    const [dose] = fitParameters(['liq.xProtease']);
    expect(dose?.transform).toBe('log');
    expect(dose?.min).toBeCloseTo(0.001, 15);
    expect(dose?.lower).toBeCloseTo(Math.log(0.001), 12);
    expect(dose?.upper).toBeCloseTo(Math.log(0.05), 12);
    expect(dose?.priorMean).toBeCloseTo(Math.log(0.01), 12);
    // The farther end is the floor, ln(10) away; one and a half times that is one deviation.
    expect(dose?.priorSd).toBeCloseTo(1.5 * Math.log(10), 12);
    if (dose === undefined) throw new Error('missing');
    // A value of 0 in a set is fitted from the floor; the fit never returns less than it.
    expect(toZ(dose, 0)).toBe(-Infinity);
    expect(fromZ(dose, -Infinity)).toBeCloseTo(0.001, 15);
    expect(fromZ(dose, Math.log(0.02))).toBeCloseTo(0.02, 15);
    // A range from 0 whose default is not far below its upper end stays linear.
    const [taed] = fitParameters(['liq.xTaed']);
    expect(taed?.transform).toBe('linear');
    expect(taed?.min).toBe(0);
  });

  it('keeps every end of every registered range within one prior deviation of the centre', () => {
    const registry = createCalibrationParams().registry;
    let axes = 0;
    let onBound = 0;
    for (const def of registry.defs) {
      if (def.kind === 'enum' || def.min === def.max) continue;
      for (const p of fitParameters([def.key])) {
        axes++;
        expect(p.priorSd, p.id).toBeGreaterThan(0);
        expect(Number.isFinite(p.priorMean), p.id).toBe(true);
        expect(p.priorMean, p.id).toBeGreaterThanOrEqual(p.lower);
        expect(p.priorMean, p.id).toBeLessThanOrEqual(p.upper);
        if (p.transform !== 'logit') {
          expect((p.upper - p.priorMean) / p.priorSd, p.id).toBeLessThanOrEqual(1 + 1e-9);
          expect((p.priorMean - p.lower) / p.priorSd, p.id).toBeLessThanOrEqual(1 + 1e-9);
        }
        // A default on an end of its range: a half-normal as wide as the range allows.
        if (p.priorMean === p.lower || p.priorMean === p.upper) {
          onBound++;
          expect(p.priorSd, p.id).toBeCloseTo(PRIOR_SD_BY_TAG[p.tag] * (p.upper - p.lower), 9);
        }
      }
    }
    expect(axes).toBeGreaterThan(250);
    expect(onBound).toBeGreaterThan(0);
  });

  it('does not fit the constants a standard defines unless asked', () => {
    expect(isStandardKey('inspect.maxAreaMm2')).toBe(true);
    expect(isStandardKey('soil.KE')).toBe(false);
    const record = toyRecord('toy', [600], [0.5]);
    expect(() =>
      createObjective([record], ['soil.KE', 'inspect.maxAreaMm2'], { pool: toyEvaluator() }),
    ).toThrow(/inspect\.maxAreaMm2: a standard defines these constants/);
    const allowed = createObjective([record], ['inspect.maxAreaMm2'], {
      pool: toyEvaluator(),
      allowStandardKeys: true,
    });
    expect(allowed.parameters[0]?.key).toBe('inspect.maxAreaMm2');
  });

  it('routes parameters by what a change of them costs', () => {
    const routes = fitParameters(['obs.scoreSd', 'soil.KE', 'cal.jetShearScale', 'jets.kStag']).map(
      (p) => p.route,
    );
    expect(routes).toEqual(['observation', 'replay', 'replay', 'hydro']);
  });

  it('takes one component of a vector, and undeclared per-class keys', () => {
    const [rollUp] = fitParameters(['soil.fatRollUp[1]']);
    expect(rollUp?.id).toBe('soil.fatRollUp[partially_wetting]');
    expect(rollUp?.index).toBe(1);
    expect(rollUp?.default).toBe(0.5);
    expect(fitParameters(['soil.fatRollUp'])).toHaveLength(3);
    const [tm] = fitParameters(['soil.egg_yolk.enzymeTm']);
    expect(tm?.default).toBe(75);
  });

  it('refuses what cannot be fitted', () => {
    expect(() => fitParameters(['soil.refPH'])).toThrow(/fixed/);
    expect(() => fitParameters(['soil.nonsense'])).toThrow(/unknown parameter/);
    expect(() => fitParameters(['soil.KE', 'soil.KE'])).toThrow(/twice/);
    expect(() => fitParameters(['soil.fatRollUp[7]'])).toThrow(/no component/);
  });

  it('maps coordinates to values inside the registered range, and back', () => {
    const [rate, mixing, tm] = fitParameters([
      'soil.egg_yolk.rateRef',
      'tl.poolMixing',
      'soil.enzymeTm',
    ]);
    if (rate === undefined || mixing === undefined || tm === undefined) throw new Error('missing');
    expect(fromZ(rate, toZ(rate, 4.2e-5))).toBeCloseTo(4.2e-5, 15);
    expect(fromZ(mixing, toZ(mixing, 0.3))).toBeCloseTo(0.3, 12);
    expect(fromZ(tm, toZ(tm, 71))).toBe(71);
    // Beyond its bounds a coordinate gives the end of the range.
    expect(fromZ(rate, 0)).toBe(1e-4);
    expect(fromZ(rate, -100)).toBe(1e-5);
    expect(fromZ(tm, 1000)).toBe(90);
    expect(fromZ(mixing, 50)).toBeLessThanOrEqual(1);
    const base = createCalibrationParams();
    const moved = paramsAt(base, [rate, tm], [Math.log(5e-5), 70]);
    expect(moved.get('soil.egg_yolk.rateRef')).toBeCloseTo(5e-5, 15);
    expect(moved.get('soil.enzymeTm')).toBe(70);
    expect(zOf(moved, [rate, tm])[1]).toBe(70);
  });

  it("accepts a prior that replaces the registry's", () => {
    const [rate] = fitParameters(['soil.egg_yolk.rateRef'], {
      'soil.egg_yolk.rateRef': { centre: 5e-5, sd: 0.1 },
    });
    expect(rate?.priorMean).toBeCloseTo(Math.log(5e-5), 12);
    expect(rate?.priorSd).toBe(0.1);
    expect(logPrior(rate === undefined ? [] : [rate], [Math.log(5e-5) + 0.2])).toBeCloseTo(-2, 10);
  });
});

describe('the log posterior', () => {
  const truth = createCalibrationParams({ 'soil.egg_yolk.rateRef': 6e-5 });
  const times = [600, 1200, 2400];
  const exact = times.map((t) => toyFraction(truth, t));

  it('is the weighted log likelihood plus the log prior', async () => {
    const record = toyRecord('toy', times, exact);
    const objective = createObjective([record], ['soil.egg_yolk.rateRef'], {
      pool: toyEvaluator(),
    });
    const parameter = objective.parameters[0];
    if (parameter === undefined) throw new Error('missing');
    const z = [Math.log(4e-5)];
    const value = await objective.evaluate(z);
    // With the allowance for gross errors: each density is 0.97 of the normal plus 0.03 / 1.5.
    {
      const s = Math.hypot(0.02, 0.05);
      const at = objective.paramsAt(z);
      let mixed = 0;
      let plain = 0;
      times.forEach((t, i) => {
        const d = ((exact[i] as number) - toyFraction(at, t)) / s;
        const density = Math.exp(-0.5 * d * d) / (s * Math.sqrt(2 * Math.PI));
        mixed += Math.log(0.97 * density + 0.02);
        plain += Math.log(density);
      });
      expect(value.logLikelihood).toBeCloseTo(mixed, 10);
      expect(value.coreLogPosterior).toBeCloseTo(plain + value.logPrior, 10);
    }
    // By hand: mass fractions with sd = hypot(0.02, 0.05), normal.
    const sd = Math.hypot(0.02, 0.05);
    const at = objective.paramsAt(z);
    let logLik = 0;
    times.forEach((t, i) => {
      const d = ((exact[i] as number) - toyFraction(at, t)) / sd;
      logLik += -0.5 * d * d - Math.log(sd) - 0.5 * Math.log(2 * Math.PI);
    });
    const prior = -0.5 * (((z[0] as number) - parameter.priorMean) / parameter.priorSd) ** 2;
    expect(value.coreLogPosterior - value.logPrior).toBeCloseTo(logLik, 10);
    expect(value.logPrior).toBeCloseTo(prior, 10);
    expect(value.logPosterior).toBeCloseTo(value.logLikelihood + prior, 10);
  });

  it("takes the values from the record it is asked about, not from the evaluator's", async () => {
    // An evaluator that prepared for another record of the same plan: its specs carry the
    // first record's values.
    const first = toyRecord('same', times, exact);
    const second = toyRecord(
      'same',
      times,
      exact.map((v) => v + 0.1),
    );
    const inner = toyEvaluator();
    const prepared = await inner.get(first, createCalibrationParams());
    const stale = { get: () => Promise.resolve(prepared) };
    const z = [Math.log(6e-5)];
    const a = await createObjective([first], ['soil.egg_yolk.rateRef'], { pool: stale }).evaluate(
      z,
    );
    const b = await createObjective([second], ['soil.egg_yolk.rateRef'], { pool: stale }).evaluate(
      z,
    );
    const own = await createObjective([second], ['soil.egg_yolk.rateRef'], {
      pool: toyEvaluator(),
    }).evaluate(z);
    expect(b.logLikelihood).toBeLessThan(a.logLikelihood - 1);
    expect(b.logLikelihood).toBeCloseTo(own.logLikelihood, 12);
  });

  it('rises towards the truth from either side (the sign of its gradient)', async () => {
    const record = toyRecord('toy', times, exact);
    const objective = createObjective([record], ['soil.egg_yolk.rateRef'], {
      pool: toyEvaluator(),
    });
    const slope = async (z: number): Promise<number> => {
      const h = 1e-4;
      const up = await objective.evaluate([z + h]);
      const down = await objective.evaluate([z - h]);
      return (up.logPosterior - down.logPosterior) / (2 * h);
    };
    // Below the truth (at the default, half the true rate) the posterior rises with the rate ...
    expect(await slope(Math.log(3e-5))).toBeGreaterThan(0);
    // ... and above it (at 9e-5) it falls.
    expect(await slope(Math.log(9e-5))).toBeLessThan(0);
    // Without observations the gradient is that of the prior: back towards the default.
    const plan = createObjective([toyRecord('plan', times)], ['soil.egg_yolk.rateRef'], {
      pool: toyEvaluator(),
    });
    const h = 1e-4;
    const z = Math.log(6e-5);
    const priorSlope =
      ((await plan.evaluate([z + h])).logPosterior - (await plan.evaluate([z - h])).logPosterior) /
      (2 * h);
    const parameter = plan.parameters[0];
    expect(priorSlope).toBeCloseTo(
      -(z - (parameter?.priorMean ?? 0)) / (parameter?.priorSd ?? 1) ** 2,
      4,
    );
  });

  it('answers a point seen before from memory, and clips to the bounds', async () => {
    const counter = { evaluations: 0 };
    const objective = createObjective([toyRecord('toy', times, exact)], ['soil.egg_yolk.rateRef'], {
      pool: toyEvaluator(counter),
    });
    const a = await objective.evaluate([Math.log(5e-5)]);
    const b = await objective.evaluate([Math.log(5e-5)]);
    expect(b).toBe(a);
    expect(counter.evaluations).toBe(1);
    expect(objective.evaluations).toBe(2);
    expect(objective.computed).toBe(1);
    const beyond = await objective.evaluate([10]);
    expect(beyond.z[0]).toBeCloseTo(Math.log(1e-4), 12);
  });

  it('weights a literature record down, and any record by its own weight', async () => {
    const record = toyRecord('toy', times, exact);
    expect(recordWeight(record, 0.25)).toBe(1);
    expect(recordWeight({ ...record, kind: 'literature' }, 0.25)).toBe(0.25);
    expect(recordWeight({ ...record, kind: 'literature', weight: 0.6 }, 0.25)).toBe(0.6);
    const z = [Math.log(4e-5)];
    const full = await createObjective([record], ['soil.egg_yolk.rateRef'], {
      pool: toyEvaluator(),
    }).evaluate(z);
    const half = await createObjective([{ ...record, weight: 0.5 }], ['soil.egg_yolk.rateRef'], {
      pool: toyEvaluator(),
    }).evaluate(z);
    expect(half.logLikelihood).toBeCloseTo(0.5 * full.logLikelihood, 12);
    expect(half.logPrior).toBe(full.logPrior);
  });

  it('refuses two records with one id', () => {
    const record = toyRecord('same', times, exact);
    expect(() => createObjective([record, record], ['soil.KE'], { pool: toyEvaluator() })).toThrow(
      /same/,
    );
  });
});
