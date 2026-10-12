// Fitting support against the brief of M2, item 8: axes of a calibration group with ranges,
// normalised values applied linearly or logarithmically, and the reverse.
import { describe, expect, it } from 'vitest';
import {
  applyNormalised,
  createParamSet,
  createRegistry,
  fitAxes,
  fitAxesOf,
  normalisedValues,
  type AnyParamDef,
} from './index.ts';

const DEFS: AnyParamDef[] = [
  {
    key: 'soil.JOHref',
    unit: 'm/s',
    default: 2e-6,
    min: 1e-8,
    max: 1e-4,
    tag: 'ESTIMATED',
    source: 't',
    group: 'soil',
    calibration: 'egg',
  },
  {
    key: 'soil.lag',
    unit: 's',
    default: 60,
    min: 0,
    max: 600,
    tag: 'ESTIMATED',
    source: 't',
    group: 'soil',
    calibration: 'egg',
  },
  {
    key: 'soil.fixed',
    unit: '1',
    default: 3,
    min: 3,
    max: 3,
    tag: 'SYN',
    source: 't',
    group: 'soil',
    calibration: 'egg',
  },
  {
    kind: 'enum',
    key: 'soil.law',
    unit: '1',
    default: 'a',
    options: ['a', 'b'],
    tag: 'SYN',
    source: 't',
    group: 'soil',
    calibration: 'egg',
  },
  {
    kind: 'vector',
    key: 'film.sigma',
    unit: 'N/m',
    default: [0.06, 0.04, 0.045],
    min: 0.03,
    max: 0.065,
    components: ['W', 'D', 'R'],
    tag: 'ESTIMATED',
    source: 't',
    group: 'hydro',
    calibration: 'wetting',
  },
  {
    key: 'film.other',
    unit: '1',
    default: 1,
    min: 0,
    max: 2,
    tag: 'SYN',
    source: 't',
    group: 'hydro',
  },
];
const registry = createRegistry({ contributions: [DEFS], soilClasses: ['egg_yolk_dried'] });
const base = createParamSet(registry);

describe('fit axes', () => {
  it('lists the numeric, non-fixed parameters of a group with their ranges and scales', () => {
    expect(fitAxes(registry, 'egg')).toEqual([
      {
        id: 'soil.JOHref',
        key: 'soil.JOHref',
        index: null,
        unit: 'm/s',
        min: 1e-8,
        max: 1e-4,
        default: 2e-6,
        scale: 'log',
      },
      {
        id: 'soil.lag',
        key: 'soil.lag',
        index: null,
        unit: 's',
        min: 0,
        max: 600,
        default: 60,
        scale: 'linear',
      },
    ]);
    expect(fitAxes(registry, 'wetting').map((a) => a.id)).toEqual([
      'film.sigma[W]',
      'film.sigma[D]',
      'film.sigma[R]',
    ]);
    expect(fitAxes(registry, 'none')).toEqual([]);
    expect(() => fitAxesOf(registry, ['soil.law'])).toThrow(RangeError);
    expect(() => fitAxesOf(registry, ['soil.fixed'])).toThrow(RangeError);
  });
});

describe('normalised values', () => {
  const axes = fitAxes(registry, 'egg');

  it('maps 0, 1 and the middle onto a linear and a logarithmic range', () => {
    // Middle of 1e-8 .. 1e-4 on a log scale is the geometric mean 1e-6; of 0 .. 600 it is 300.
    const mid = applyNormalised(base, axes, [0.5, 0.5]);
    expect(mid.get('soil.JOHref')).toBeCloseTo(1e-6, 18);
    expect(mid.get('soil.lag')).toBe(300);
    const ends = applyNormalised(base, axes, [0, 1]);
    expect(ends.get('soil.JOHref')).toBe(1e-8);
    expect(ends.get('soil.lag')).toBe(600);
    // A quarter of four decades is one decade.
    expect(applyNormalised(base, axes, [0.25, 0]).get('soil.JOHref') / 1e-8).toBeCloseTo(10, 9);
  });

  it('is inverted by normalisedValues to 1e-12', () => {
    const all = [
      ...axes,
      ...fitAxes(registry, 'wetting'),
      ...fitAxesOf(registry, ['soil.egg_yolk_dried.lag']),
    ];
    const u = [0.137, 0.9, 0.25, 0.5, 1, 0.61];
    const set = applyNormalised(base, all, u);
    const back = normalisedValues(set, all);
    back.forEach((v, i) => expect(Math.abs(v - (u[i] as number))).toBeLessThan(1e-12));
    // The defaults sit where the ranges say: (0.04 - 0.03) / 0.035 for the D component.
    expect(normalisedValues(base, fitAxes(registry, 'wetting'))[1]).toBeCloseTo(0.01 / 0.035, 12);
    // Components not on an axis keep the value of the base set.
    const oneAxis = fitAxes(registry, 'wetting').slice(1, 2);
    expect(applyNormalised(base, oneAxis, [1]).getVector('film.sigma')).toEqual([
      0.06, 0.065, 0.045,
    ]);
    // The per-class axis overrode the class only.
    expect(set.soilClass('egg_yolk_dried', 'lag')).toBeCloseTo(0.61 * 600, 9);
    expect(set.get('soil.lag')).toBeCloseTo(540, 9);
  });

  it('leaves the hydro hash alone when only soil axes move', () => {
    expect(applyNormalised(base, axes, [0.3, 0.3]).hydroHash).toBe(base.hydroHash);
  });

  it('rejects values outside 0 to 1 unless asked to clamp', () => {
    expect(() => applyNormalised(base, axes, [1.2, 0])).toThrow(RangeError);
    expect(() => applyNormalised(base, axes, [0.5])).toThrow(RangeError);
    expect(() => applyNormalised(base, axes, [Number.NaN, 0])).toThrow(RangeError);
    const clamped = applyNormalised(base, axes, [1.2, -3], { outOfRange: 'clamp' });
    expect(clamped.get('soil.JOHref')).toBe(1e-4);
    expect(clamped.get('soil.lag')).toBe(0);
  });
});
