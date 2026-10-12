import { describe, expect, it } from 'vitest';
import { createCalibrationParams } from './cal-params.ts';
import { fitParameters } from './objective.ts';
import {
  fisherOf,
  identifiability,
  rankExperiments,
  sensitivity,
  sensitivityTable,
} from './sensitivity.ts';
import { toyEvaluator, toyRate, toyRecord } from './toy.test-util.ts';

const pool = toyEvaluator();
// The closed forms below are those of the plain normal model: no allowance for gross errors.
const base = createCalibrationParams({ 'obs.outlierShare': 0 });
const k = toyRate(base);
const sd = Math.hypot(0.02, 0.05);

describe('sensitivity and Fisher information', () => {
  it('matches the derivatives and the information of the toy model in closed form', async () => {
    const times = [600, 1800, 3600];
    const result = await sensitivity([toyRecord('toy', times)], ['soil.egg_yolk.rateRef'], {
      pool,
      base,
      step: 0.02,
      adapt: false,
    });
    // eta = exp(-k t), z = ln(rate), k proportional to the rate: d eta / dz = -k t exp(-k t).
    result.jacobian.rows.forEach((row, i) => {
      const t = times[i] as number;
      expect(row.eta).toBeCloseTo(Math.exp(-k * t), 12);
      expect(row.derivative[0]).toBeCloseTo(-k * t * Math.exp(-k * t), 4);
      expect(row.information).toBeCloseTo(1 / (sd * sd), 9);
    });
    const expected = times.reduce((sum, t) => sum + (k * t * Math.exp(-k * t)) ** 2, 0) / (sd * sd);
    // Central differences of a step of a fiftieth of a prior deviation: good to 0.1 %.
    expect((fisherOf(result.jacobian)[0]?.[0] ?? 0) / expected).toBeCloseTo(1, 3);
    // Scaled by the prior variance it is the information column of the report.
    const s = fitParameters(['soil.egg_yolk.rateRef'])[0]?.priorSd ?? 0;
    const p = result.report.parameters[0];
    expect((p?.information ?? 0) / (expected * s * s)).toBeCloseTo(1, 3);
    expect(p?.marginal).toBeCloseTo(1 / Math.sqrt(1 + expected * s * s), 3);
    expect(p?.verdict).toBe('identified');
    expect(result.sensitivityTable).toMatch(/tile\.mass_fraction@1800/);
    expect(sensitivityTable(result.jacobian, 1)).toMatch(/2 weaker rows not shown/);
  });

  it('needs no observed values: a planned record has the information a run of it will have', async () => {
    const times = [900, 1800];
    const planned = await sensitivity([toyRecord('plan', times)], ['soil.egg_yolk.rateRef'], {
      pool,
    });
    const run = await sensitivity(
      [toyRecord('run', times, [0.6, 0.4])],
      ['soil.egg_yolk.rateRef'],
      { pool },
    );
    expect(fisherOf(run.jacobian)[0]?.[0]).toBeCloseTo(fisherOf(planned.jacobian)[0]?.[0] ?? 0, 9);
  });

  it('says which parameters the records constrain, which they do not, and which are confounded', async () => {
    const result = await sensitivity(
      [toyRecord('toy', [600, 1200, 1800, 2400, 3600])],
      ['soil.egg_yolk.rateRef', 'soil.egg_yolk.jetRatio', 'liq.proteaseHalfLife'],
      { pool },
    );
    const [rate, ratio, halfLife] = result.report.parameters;
    // The toy model does not read the half-life.
    expect(halfLife?.verdict).toBe('not identified');
    expect(halfLife?.information).toBeCloseTo(0, 9);
    expect(halfLife?.marginal).toBeCloseTo(1, 9);
    // Rate and jet ratio act only through their product: each is tight if the other is known ...
    expect(rate?.conditional).toBeLessThan(0.5);
    expect(ratio?.conditional).toBeLessThan(0.5);
    // ... and loose when it is not, with a posterior correlation near -1.
    expect(rate?.marginal).toBeGreaterThan(1.5 * (rate?.conditional ?? 1));
    expect(rate?.confoundedWith.map((c) => c.id)).toEqual(['soil.egg_yolk.jetRatio']);
    expect(result.report.correlation[0]?.[1]).toBeLessThan(-0.9);
    // One combination is fixed by the records, two are left to the prior.
    const [first, second, third] = result.report.combinations;
    expect(first?.information).toBeGreaterThan(10);
    expect(first?.loadings.map((l) => l.id).sort()).toEqual([
      'soil.egg_yolk.jetRatio',
      'soil.egg_yolk.rateRef',
    ]);
    // Both push the rate the same way, so their loadings have one sign.
    expect(Math.sign(first?.loadings[0]?.loading ?? 0)).toBe(
      Math.sign(first?.loadings[1]?.loading ?? 0),
    );
    expect(second?.information).toBeLessThan(1e-4);
    expect(third?.information).toBeLessThan(1e-4);
    expect(result.report.table).toMatch(/not identified/);
    expect(result.report.table).toMatch(/fixed by the records/);
    expect(result.report.table).toMatch(/left to the prior/);
  });

  it('gives the linearised posterior covariance (F + P)^-1', () => {
    const parameters = fitParameters(['soil.egg_yolk.rateRef', 'liq.proteaseHalfLife']);
    const [a, b] = parameters;
    if (a === undefined || b === undefined) throw new Error('missing');
    // Information 9 prior precisions on the first parameter alone, none on the second.
    const fisher = [
      [9 / a.priorSd ** 2, 0],
      [0, 0],
    ];
    const report = identifiability(parameters, fisher);
    expect(report.covariance[0]?.[0]).toBeCloseTo(a.priorSd ** 2 / 10, 12);
    expect(report.covariance[1]?.[1]).toBeCloseTo(b.priorSd ** 2, 12);
    expect(report.parameters[0]?.contraction).toBeCloseTo(0.9, 12);
    expect(report.parameters[0]?.verdict).toBe('identified');
    expect(report.parameters[1]?.contraction).toBeCloseTo(0, 12);
    // Contraction 0.5 (information equal to the prior's) is weak.
    const weak = identifiability(parameters, [
      [1 / a.priorSd ** 2, 0],
      [0, 0],
    ]);
    expect(weak.parameters[0]?.verdict).toBe('weak');
  });
});

describe('experiment ranking', () => {
  // Observing while the soil is leaving (k t about 1, t about 2000 s) says most about the rate;
  // observing after it has all gone says nothing.
  const during = {
    ...toyRecord('during', [1500, 2000, 2500]),
    title: 'three looks while it leaves',
  };
  const early = toyRecord('early', [100]);
  const late = toyRecord('late', [40000]);

  it('orders candidates by the information they are expected to add', async () => {
    const result = await rankExperiments([late, early, during], ['soil.egg_yolk.rateRef'], {
      pool,
      base,
      draws: 0,
      step: 0.02,
      adapt: false,
    });
    expect(result.local).toBe(true);
    expect(result.table).toMatch(/LOCAL RANKING: linearised at one parameter set/);
    expect(result.ranking.map((r) => r.recordId)).toEqual(['during', 'early', 'late']);
    const [best, , worst] = result.ranking;
    // By hand: gain = 1/2 ln(1 + F s^2).
    const s = result.parameters[0]?.priorSd ?? 0;
    const information =
      [1500, 2000, 2500].reduce((sum, t) => sum + (k * t * Math.exp(-k * t)) ** 2, 0) / (sd * sd);
    expect(best?.gain_nats).toBeCloseTo(0.5 * Math.log(1 + information * s * s), 3);
    expect(best?.gain_bits).toBeCloseTo((best?.gain_nats ?? 0) / Math.LN2, 12);
    expect(worst?.gain_nats).toBeLessThan(1e-6);
    expect(best?.order).toBe(1);
    expect(best?.after[0]?.marginal).toBeCloseTo(1 / Math.sqrt(1 + information * s * s), 3);
    expect(result.table).toMatch(/during/);
  });

  it('averages the gain over parameter sets drawn from the prior, and says where the order hangs on them', async () => {
    // A look at 300 s says most if the soil leaves fast, one at 8000 s if it leaves slowly:
    // which wash is better is a property of the rate, which is what is not yet known.
    const soon = toyRecord('soon', [300]);
    const longAfter = toyRecord('long-after', [8000]);
    const local = await rankExperiments([soon, longAfter, during], ['soil.egg_yolk.rateRef'], {
      pool,
      draws: 0,
    });
    const drawn = await rankExperiments([soon, longAfter, during], ['soil.egg_yolk.rateRef'], {
      pool,
      draws: 12,
      seed: 3,
    });
    expect(drawn.local).toBe(false);
    expect(drawn.points).toHaveLength(13);
    // The centre is the first parameter set, and the gain there is the local one.
    expect(drawn.points[0]?.[0]).toBeCloseTo(3e-5, 12);
    for (const r of local.ranking) {
      expect(drawn.gains_bits[r.recordId]?.[0]).toBeCloseTo(r.gain_bits, 9);
    }
    // The draws cover the prior: rates below and above the default, inside the range.
    const rates = drawn.points.map((point) => point[0] as number);
    expect(Math.min(...rates)).toBeLessThan(2e-5);
    expect(Math.max(...rates)).toBeGreaterThan(5e-5);
    expect(Math.min(...rates)).toBeGreaterThanOrEqual(1e-5);
    expect(Math.max(...rates)).toBeLessThanOrEqual(1e-4);
    for (const r of drawn.ranking) {
      const own = drawn.gains_bits[r.recordId] ?? [];
      expect(r.gain_bits).toBeCloseTo(own.reduce((a, b) => a + b, 0) / own.length, 9);
      expect(r.gainMin_bits).toBeCloseTo(Math.min(...own), 9);
      expect(r.gainMax_bits).toBeCloseTo(Math.max(...own), 9);
      expect(r.rankBest).toBeLessThanOrEqual(r.rankWorst);
    }
    // The two single looks change places over the draws; the three looks while it leaves do
    // not lead everywhere either.
    const byId = new Map(drawn.ranking.map((r) => [r.recordId, r]));
    expect(byId.get('soon')?.rankBest).toBeLessThan(byId.get('soon')?.rankWorst ?? 0);
    expect(byId.get('long-after')?.gainMax_bits).toBeGreaterThan(
      4 * (byId.get('long-after')?.gainMin_bits ?? 0),
    );
    expect(drawn.table).toMatch(/mean over 13 parameter sets/);
    expect(drawn.table).not.toMatch(/LOCAL RANKING/);
    // Deterministic in the seed; another seed draws other sets.
    const again = await rankExperiments([soon, longAfter, during], ['soil.egg_yolk.rateRef'], {
      pool,
      draws: 12,
      seed: 3,
    });
    expect(again.ranking).toEqual(drawn.ranking);
    const other = await rankExperiments([soon, longAfter, during], ['soil.egg_yolk.rateRef'], {
      pool,
      draws: 12,
      seed: 4,
    });
    expect(other.points[1]?.[0]).not.toBe(drawn.points[1]?.[0]);
  });

  it('flags a leader that leads in under half of the parameter sets', async () => {
    // Two washes, each the better one over half of the prior: whichever leads on the mean
    // does not lead often enough to be recommended without saying so.
    const soon = toyRecord('soon', [250, 350]);
    const longAfter = toyRecord('long-after', [5000, 7000]);
    const result = await rankExperiments([soon, longAfter], ['soil.egg_yolk.rateRef'], {
      pool,
      draws: 16,
      seed: 2,
    });
    const [first, second] = result.ranking;
    expect((first?.firstShare ?? 0) + (second?.firstShare ?? 0)).toBeCloseTo(1, 12);
    expect(first?.rankWorst).toBe(2);
    expect(second?.rankBest).toBe(1);
    if ((first?.firstShare ?? 1) < 0.5) {
      expect(first?.unstable).toBe(true);
      expect(result.table).toMatch(/UNSTABLE/);
    }
  });

  it('draws from a posterior covariance about the centre when one is given', async () => {
    const tight = await rankExperiments([during], ['soil.egg_yolk.rateRef'], {
      pool,
      draws: 8,
      at: createCalibrationParams({ 'soil.egg_yolk.rateRef': 6e-5 }),
      covariance: [[0.01 ** 2]],
    });
    for (const point of tight.points) {
      expect((point[0] as number) / 6e-5).toBeGreaterThan(0.95);
      expect((point[0] as number) / 6e-5).toBeLessThan(1.05);
    }
    expect(tight.ranking[0]?.gainSd_bits).toBeLessThan(0.05);
    expect(tight.table).toMatch(/drawn from the covariance given/);
  });

  it('counts what is already known: a wash like one already run gains less', async () => {
    const fresh = await rankExperiments([during], ['soil.egg_yolk.rateRef'], { pool, draws: 0 });
    const repeat = await rankExperiments([during], ['soil.egg_yolk.rateRef'], {
      pool,
      draws: 0,
      existing: [toyRecord('done', [1500, 2000, 2500], [0.5, 0.4, 0.3])],
    });
    expect(repeat.ranking[0]?.gain_nats).toBeLessThan(0.5 * (fresh.ranking[0]?.gain_nats ?? 0));
    expect(repeat.ranking[0]?.gain_nats).toBeGreaterThan(0);
  });

  it('counts only the parameters of interest, with the others as nuisance', async () => {
    const keys = ['soil.egg_yolk.rateRef', 'liq.proteaseHalfLife'];
    const both = await rankExperiments([during], keys, { pool, draws: 0 });
    const rateOnly = await rankExperiments([during], keys, {
      pool,
      draws: 0,
      interest: ['soil.egg_yolk.rateRef'],
    });
    const halfLifeOnly = await rankExperiments([during], keys, {
      pool,
      draws: 0,
      interest: ['liq.proteaseHalfLife'],
    });
    // The toy model says nothing about the half-life: all the gain is about the rate.
    expect(rateOnly.ranking[0]?.gain_nats).toBeCloseTo(both.ranking[0]?.gain_nats ?? 0, 6);
    expect(halfLifeOnly.ranking[0]?.gain_nats).toBeCloseTo(0, 6);
  });

  it('orders greedily: after the best wash, a wash that repeats it adds less than one that differs', async () => {
    const again = toyRecord('during-again', [1500, 2000, 2500]);
    const result = await rankExperiments(
      [during, again, early],
      ['soil.egg_yolk.rateRef', 'soil.egg_yolk.jetRatio'],
      {
        pool,
        draws: 0,
      },
    );
    const byId = new Map(result.ranking.map((r) => [r.recordId, r]));
    // Alone the repeat is worth as much as the original ...
    expect(byId.get('during-again')?.gain_nats).toBeCloseTo(byId.get('during')?.gain_nats ?? 0, 9);
    // ... but placed after it, it adds less than it would alone.
    const second = [...byId.values()].find((r) => r.order === 2);
    expect(second?.marginalGain_nats).toBeLessThan(byId.get('during')?.gain_nats ?? 0);
    expect([...byId.values()].map((r) => r.order).sort()).toEqual([1, 2, 3]);
  });
});

describe('the step of the derivatives', () => {
  // A prediction that crosses its whole range within a twentieth of a prior deviation, as a
  // score does where the soil is just coming off: a step of a tenth of a prior deviation
  // averages the slope away.
  const width = 0.03;
  const steep = {
    get(record: Parameters<typeof pool.get>[0]) {
      return pool.get(record, base).then((prepared) => ({
        observations: prepared.observations,
        async evaluate(params: Parameters<typeof prepared.evaluate>[0]) {
          const prediction = await prepared.evaluate(params);
          const x = Math.log(params.get('soil.egg_yolk.rateRef') / 3e-5);
          const eta = Float64Array.from(prediction.eta, () => 0.5 + 0.4 * Math.tanh(x / width));
          return { ...prediction, eta };
        },
      }));
    },
  };

  it('is chosen from the posterior deviation, and reported', async () => {
    const record = toyRecord('steep', [600, 1200, 1800, 2400]);
    const fixed = await sensitivity([record], ['soil.egg_yolk.rateRef'], {
      pool: steep,
      base,
      adapt: false,
    });
    const adapted = await sensitivity([record], ['soil.egg_yolk.rateRef'], { pool: steep, base });
    // The true slope at the centre is 0.4 / width per unit of z.
    const s = fixed.jacobian.parameters[0]?.priorSd ?? 0;
    expect(fixed.jacobian.steps).toEqual([0.1]);
    expect(fixed.jacobian.stepRounds).toBe(1);
    // A step of 0.06 in z against a width of 0.03: the fixed step finds under two thirds of it.
    expect(0.1 * s).toBeGreaterThan(1.5 * width);
    expect((fixed.jacobian.rows[0]?.derivative[0] ?? 0) / (0.4 / width)).toBeLessThan(0.67);
    // The adapted one took a smaller step, more than one round, settled, and is within 5 %.
    expect(adapted.jacobian.stepRounds).toBeGreaterThan(1);
    expect(adapted.jacobian.stepConverged).toBe(true);
    expect(adapted.jacobian.steps[0]).toBeLessThan(0.03);
    expect((adapted.jacobian.rows[0]?.derivative[0] ?? 0) / (0.4 / width)).toBeGreaterThan(0.95);
    // The posterior deviation the fixed step reports is too wide by half as much again.
    const marginal = (r: typeof fixed): number => r.report.parameters[0]?.marginal ?? 0;
    expect(marginal(fixed) / marginal(adapted)).toBeGreaterThan(1.4);
  });

  it('stays at the first step where the records say little', async () => {
    const result = await sensitivity([toyRecord('weak', [40000])], ['soil.egg_yolk.rateRef'], {
      pool,
      base,
    });
    expect(result.jacobian.steps).toEqual([0.1]);
    expect(result.jacobian.stepRounds).toBe(1);
    expect(result.jacobian.stepConverged).toBe(true);
  });
});
