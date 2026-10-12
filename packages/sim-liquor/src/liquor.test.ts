// The liquor of the first build against closed forms and against the regression figures of the
// chemistry dossier (section 10.4, 10.5 and the timelines of 10.12).
import { createParamSet, createRegistry, SHARED_PARAM_DEFS } from '@spotless/sim-params';
import { describe, expect, it } from 'vitest';
import {
  createWashLiquor,
  enzymeDecayRate,
  liquorLossRates,
  LIQUOR_CLASS_CODE,
  LIQUOR_FIELD_COUNT,
  LIQUOR_FIELDS,
  LIQUOR_PARAM_DEFS,
  liquorPH,
  resolveLiquorParams,
  tabletTau,
  writeLiquorRow,
  type WashLiquor,
} from './index.ts';

const registry = createRegistry({ contributions: [SHARED_PARAM_DEFS, LIQUOR_PARAM_DEFS] });
const params = createParamSet(registry);
const p = resolveLiquorParams(params);

/** A liquor of `volume` m3 of supply water with a dose released into it. */
function dosed(volume: number, mass: number, blocked = false): WashLiquor {
  const liquor = createWashLiquor(params, { dispenserBlocked: blocked });
  liquor.apply({ kind: 'fill', volume });
  liquor.apply({ kind: 'detergent', mass });
  return liquor;
}

describe('detergent release (chemistry 10.3)', () => {
  it('follows the shrinking-core law m = m0 (1 - t / tau)^3', () => {
    // At the reference temperature tau is 480 s: an eighth is left after 240 s, nothing after 480.
    const liquor = dosed(4e-3, 0.02);
    let s = liquor.sample(0, 4e-3, 40);
    expect(s.tabletLeft).toBe(0.02);
    for (let t = 0; t < 240; t += 2) s = liquor.step(t + 2, 2, 4e-3, 40);
    expect(s.tabletLeft / 0.02).toBeCloseTo(0.125, 9);
    expect(s.detergent).toBeCloseTo((0.02 * 0.875) / 4e-3, 9);
    for (let t = 240; t < 480; t += 2) s = liquor.step(t + 2, 2, 4e-3, 40);
    expect(s.tabletLeft).toBeCloseTo(0, 12);
    expect(liquor.dissolved).toBeCloseTo(0.02, 12);
    expect(s.detergent).toBeCloseTo(5, 9); // 20 g in 4 L
  });

  it('dissolves faster in warmer liquor: 25 kJ/mol', () => {
    // tau(55 C) = 480 exp[(25e3 / R)(1/328.15 - 1/313.15)] = 309 s.
    expect(tabletTau(p, 40)).toBeCloseTo(480, 9);
    expect(tabletTau(p, 55)).toBeCloseTo(309, 0);
  });

  it('releases about 15 % of a dose from behind a blocked lid in a main wash', () => {
    // sim-core M9: w_stuck = 0.006 gives 15 % in the 54 minutes of the sizing programme
    // (range 5 to 30 %). At a constant 50 C: 1 - (1 - 0.006 x 3240 / 356)^3 = 0.155.
    const liquor = dosed(4e-3, 0.02, true);
    for (let t = 0; t < 3240; t += 2) liquor.step(t + 2, 2, 4e-3, 50);
    const released = liquor.dissolved / liquor.dosed;
    expect(released).toBeCloseTo(1 - Math.pow(1 - (0.006 * 3240) / tabletTau(p, 50), 3), 9);
    expect(released).toBeGreaterThan(0.1);
    expect(released).toBeLessThan(0.2);
  });

  it('does not dissolve while the pump is off', () => {
    const liquor = dosed(4e-3, 0.02);
    const s = liquor.step(600, 600, 4e-3, 40, false);
    expect(s.tabletLeft).toBe(0.02);
    expect(liquor.step(840, 240, 4e-3, 40, true).tabletLeft / 0.02).toBeCloseTo(0.125, 9);
  });

  it('does not dissolve into an empty tub', () => {
    const liquor = createWashLiquor(params);
    liquor.apply({ kind: 'detergent', mass: 0.02 });
    const s = liquor.step(60, 60, 0, 40);
    expect(s.tabletLeft).toBe(0.02);
    expect(s.detergent).toBe(0);
  });
});

describe('water changes', () => {
  it('dilute every species with the carry-over', () => {
    // 20 g dissolved in 4 L is 5 g/L. A drain that leaves 0.4 L and a fill to 2.9 L leave
    // 5 x 0.4 / 2.9 = 0.69 g/L; a second such change a hundredth of the main wash.
    const liquor = dosed(4e-3, 0.02);
    for (let t = 0; t < 600; t += 2) liquor.step(t + 2, 2, 4e-3, 40);
    const main = liquor.sample(600, 4e-3, 40);
    liquor.addSoil(0.012);
    liquor.apply({ kind: 'drain', carryFraction: 0.4 / 4 });
    liquor.apply({ kind: 'fill', volume: 2.5e-3 });
    const rinse = liquor.sample(700, 2.9e-3, 30);
    expect(rinse.detergent).toBeCloseTo((5 * 0.4) / 2.9, 9);
    expect(rinse.suspendedSoil).toBeCloseTo((3 * 0.4) / 2.9, 9);
    expect(rinse.protease / main.protease).toBeCloseTo(0.4 / 2.9, 9);
    liquor.apply({ kind: 'drain', carryFraction: 0.4 / 2.9 });
    liquor.apply({ kind: 'fill', volume: 2.5e-3 });
    const final = liquor.sample(800, 2.9e-3, 30);
    expect(final.detergent / main.detergent).toBeCloseTo((0.4 / 2.9) ** 2, 9);
  });

  it('classes the liquor W, D and R', () => {
    const liquor = createWashLiquor(params);
    liquor.apply({ kind: 'fill', volume: 4e-3 });
    expect(liquor.sample(0, 4e-3, 20).liquorClass).toBe(LIQUOR_CLASS_CODE.W);
    liquor.apply({ kind: 'detergent', mass: 0.02 });
    let s = liquor.sample(0, 4e-3, 20);
    for (let t = 0; t < 900; t += 2) s = liquor.step(t + 2, 2, 4e-3, 40);
    // 0.02 x 5 g/L = 0.1 g/L of nonionic, above the class threshold of 0.02 g/L.
    expect(s.surfactant).toBeCloseTo(0.1, 9);
    expect(s.liquorClass).toBe(LIQUOR_CLASS_CODE.D);
    liquor.apply({ kind: 'drain', carryFraction: 0.1 });
    liquor.apply({ kind: 'fill', volume: 2.5e-3 });
    expect(liquor.sample(0, 2.9e-3, 30).liquorClass).toBe(LIQUOR_CLASS_CODE.W);
    liquor.apply({ kind: 'rinseAid', volume: 5e-6 });
    const rinse = liquor.sample(0, 2.9e-3, 45);
    expect(rinse.liquorClass).toBe(LIQUOR_CLASS_CODE.R);
    expect(rinse.rinseAid).toBeCloseTo((1000 * 5e-6) / 2.9e-3, 9);
  });
});

describe('acid-base (chemistry 10.4)', () => {
  it('gives the pH of type D at 4.1 g/L: 10.8, 10.7, 10.3 at 45, 50, 70 C', () => {
    const c = 4.1;
    const alk = (2 * p.xCarbonate + p.xSilicate) * c + p.supplyBicarbonate;
    const carb = p.xCarbonate * c + p.supplyBicarbonate;
    // The dossier quotes one decimal and computed without supply bicarbonate.
    expect(Math.abs(liquorPH(p, alk, carb, 45) - 10.8)).toBeLessThan(0.1);
    expect(Math.abs(liquorPH(p, alk, carb, 50) - 10.7)).toBeLessThan(0.1);
    expect(Math.abs(liquorPH(p, alk, carb, 70) - 10.3)).toBeLessThan(0.1);
    const none = (t: number): number =>
      liquorPH(p, (2 * p.xCarbonate + p.xSilicate) * c, p.xCarbonate * c, t);
    expect(none(45)).toBeCloseTo(10.8, 1);
    expect(none(50)).toBeCloseTo(10.7, 1);
    expect(none(70)).toBeCloseTo(10.3, 1);
  });

  it('gives supply water a pH of 7.5 to 8.5 and satisfies the alkalinity balance', () => {
    const pH = liquorPH(p, p.supplyBicarbonate, p.supplyBicarbonate, 20);
    expect(pH).toBeGreaterThan(7.5);
    expect(pH).toBeLessThan(8.5);
    // Independent check of the root: put it back into the balance.
    const alk = 25;
    const carb = 14;
    const t = 50;
    const h = Math.pow(10, -(liquorPH(p, alk, carb, t) - p.dpHni));
    const dT = t - 25;
    const k1 = 10 ** -(6.35 - 0.002 * dT);
    const k2 = 10 ** -(10.33 - 0.0064 * dT);
    const kw = 10 ** -(14 - 0.03 * dT + 0.00006 * dT * dT);
    const rhs = ((carb / 1000) * (k1 * h + 2 * k1 * k2)) / (h * h + k1 * h + k1 * k2) + kw / h - h;
    expect(rhs * 1000).toBeCloseTo(alk, 6);
  });

  it('is within 0.4 pH of its plateau when a quarter of the dose has dissolved', () => {
    // chemistry 1.5: the pH goes with the logarithm of the concentration.
    const b = p.supplyBicarbonate;
    const full = liquorPH(p, (2 * p.xCarbonate + p.xSilicate) * 5 + b, p.xCarbonate * 5 + b, 50);
    const quarter = liquorPH(
      p,
      (2 * p.xCarbonate + p.xSilicate) * 1.25 + b,
      p.xCarbonate * 1.25 + b,
      50,
    );
    expect(full - quarter).toBeGreaterThan(0.1);
    expect(full - quarter).toBeLessThan(0.45);
  });
});

describe('enzymes and bleach (chemistry 10.5)', () => {
  it('has the thermal half-lives the dossier derives', () => {
    // "protease 280 min at 50 C, 30 min at 60 C, 3.7 min at 70 C; amylase 700, 60, 5.9".
    const half = (halfLife: number, ed: number, t: number): number =>
      Math.LN2 / enzymeDecayRate(p, halfLife, ed, t) / 60;
    expect(half(p.proteaseHalfLife, p.proteaseEd, 50) / 280).toBeCloseTo(1, 1);
    expect(half(p.proteaseHalfLife, p.proteaseEd, 60)).toBeCloseTo(30, 9);
    expect(half(p.proteaseHalfLife, p.proteaseEd, 70) / 3.7).toBeCloseTo(1, 1);
    expect(half(p.amylaseHalfLife, p.amylaseEd, 50) / 700).toBeCloseTo(1, 1);
    expect(half(p.amylaseHalfLife, p.amylaseEd, 70) / 5.9).toBeCloseTo(1, 1);
  });

  it('keeps its protease longer in a milder liquor (US 5,677,163: a factor of 3.6 per pH unit)', () => {
    const rates = { peracid: 0, peroxide: 0, protease: 0, amylase: 0 };
    const at = (pH?: number): number => liquorLossRates(p, 60, 0, 0, 0, rates, pH).protease;
    // The registered half-life holds at the reference pH, and without a pH.
    expect(Math.LN2 / at(p.proteaseRefPH) / 60).toBeCloseTo(30, 9);
    expect(at()).toBe(at(p.proteaseRefPH));
    // Savinase after 10 min at 60 C: half-lives 11 and 3.1 min at pH 9 and 10 without calcium,
    // 83 and 23 min at pH 10 and 11 with it: a factor of 3.6 to 3.7 per pH unit either way.
    expect(at(11.5) / at(10.5)).toBeCloseTo(Math.pow(10, 0.56), 9);
    expect(at(11.5) / at(10.5)).toBeGreaterThan(3.4);
    expect(at(11.5) / at(10.5)).toBeLessThan(3.8);
    // A capsule's liquor at pH 10.1 keeps it 1.7 times as long as detergent D's at 10.5.
    expect(at(10.5) / at(10.1)).toBeCloseTo(1.675, 2);
    // The amylase does not follow the pH (nothing found on it).
    const amylase = (pH?: number): number => liquorLossRates(p, 60, 0, 0, 0, rates, pH).amylase;
    expect(amylase(10.1)).toBe(amylase());
    // The registered range reaches the calcium-free buffer value of 3 min.
    const def = LIQUOR_PARAM_DEFS.find((d) => d.key === 'liq.proteaseHalfLife');
    expect(def !== undefined && 'min' in def ? def.min : Number.NaN).toBe(180);
  });

  it('loses half of its protease in 30 minutes at 60 C without bleach', () => {
    const noBleach = createParamSet(registry, {
      'liq.xPeroxide': 0,
      'liq.xTaed': 0,
      'liq.tabletTau': 100,
    });
    const liquor = createWashLiquor(noBleach);
    liquor.apply({ kind: 'fill', volume: 4e-3 });
    liquor.apply({ kind: 'detergent', mass: 0.02 });
    let s = liquor.step(200, 200, 4e-3, 20);
    const start = s.protease;
    expect(start).toBeCloseTo(0.01 * 5, 3);
    for (let t = 0; t < 1800; t += 2) s = liquor.step(202 + t, 2, 4e-3, 60);
    expect(s.protease / start).toBeCloseTo(0.5, 2);
  });

  it('reproduces the ECO-50 main-wash timeline of the dossier', () => {
    // chemistry 10.12: type D, 14.5 g in 3.5 L, heavy soil 12 g/L, heat-up 17 to 50 C in about
    // 20 min then hold. Regression rows at 10, 20, 30 and 50 min: T 41 / 50 / 50 / 50 C, pH
    // 10.8 / 10.7, dose dissolved 0.99 / 1.00, peracid 0.23 / 0.15 / 0.09 / 0.03 mmol/L,
    // protease 41 / 40 / 38 / 35 mg/L. The dossier's implementation is not available, so the
    // peracid rows are held to a factor (its yield and decay are calibration rows 7).
    const volume = 3.5e-3;
    const liquor = createWashLiquor(params);
    liquor.apply({ kind: 'fill', volume });
    liquor.apply({ kind: 'detergent', mass: 0.0145 });
    liquor.addSoil(0.012 * 3.5);
    const temperature = (t: number): number =>
      t < 600 ? 17 + (24 * t) / 600 : t < 1200 ? 41 + (9 * (t - 600)) / 600 : 50;
    const rows = new Map<number, ReturnType<WashLiquor['sample']>>();
    let peak = 0;
    let peakTime = 0;
    for (let t = 0; t < 3000; t += 2) {
      const s = liquor.step(t + 2, 2, volume, temperature(t + 1));
      if (s.peracid > peak) {
        peak = s.peracid;
        peakTime = t + 2;
      }
      if ((t + 2) % 600 === 0) rows.set((t + 2) / 60, s);
    }
    const at = (min: number) => {
      const row = rows.get(min);
      if (row === undefined) throw new Error(`no row at ${min}`);
      return row;
    };
    expect(liquor.dissolved / liquor.dosed).toBeGreaterThan(0.97); // "0.99" at 10 min
    expect(Math.abs(at(10).pH - 10.8)).toBeLessThan(0.1);
    expect(Math.abs(at(20).pH - 10.7)).toBeLessThan(0.1);
    expect(at(10).protease * 1000).toBeCloseTo(41, 0);
    expect(Math.abs(at(30).protease * 1000 - 38)).toBeLessThan(2);
    expect(Math.abs(at(50).protease * 1000 - 35)).toBeLessThan(3);
    // "Peracid peaks about 10 min after the lid opens at roughly one-third of theoretical and
    // is mostly gone by 40 min." Theoretical: two per TAED, 2 x 0.088 x 4.14 = 0.73 mmol/L.
    const theoretical = 2 * p.xTaed * (0.0145 / volume);
    expect(peakTime / 60).toBeGreaterThan(4);
    expect(peakTime / 60).toBeLessThan(15);
    expect(peak / theoretical).toBeGreaterThan(0.2);
    expect(peak / theoretical).toBeLessThan(0.5);
    expect(at(40).peracid / peak).toBeLessThan(0.3);
    expect(at(10).peracid).toBeGreaterThan(0.23 / 1.6);
    expect(at(10).peracid).toBeLessThan(0.23 * 1.6);
  });

  it('conserves acetyl groups: peracid made never exceeds two per TAED', () => {
    const slow = createParamSet(registry, { 'liq.kDec': 2e-4, 'liq.kSoil': 0, 'liq.EDec': 30e3 });
    const liquor = createWashLiquor(slow);
    liquor.apply({ kind: 'fill', volume: 4e-3 });
    liquor.apply({ kind: 'detergent', mass: 0.02 });
    let most = 0;
    for (let t = 0; t < 1200; t += 1)
      most = Math.max(most, liquor.step(t + 1, 1, 4e-3, 30).peracid);
    expect(most).toBeLessThan(2 * p.xTaed * 5);
    expect(most).toBeGreaterThan(0);
  });
});

describe('the liquor table', () => {
  it('has one column per numeric member of a sample, in the order of LIQUOR_FIELDS', () => {
    const liquor = dosed(4e-3, 0.02);
    const s = liquor.step(10, 10, 4e-3, 40);
    expect(Object.keys(s)).toEqual([...LIQUOR_FIELDS]);
    const table = new Float64Array(2 * LIQUOR_FIELD_COUNT);
    writeLiquorRow(table, 1, s);
    LIQUOR_FIELDS.forEach((field, i) => expect(table[LIQUOR_FIELD_COUNT + i]).toBe(s[field]));
    expect(table[0]).toBe(0);
  });

  it('is the same on a repeat', () => {
    const run = (): number[] => {
      const liquor = dosed(4e-3, 0.02);
      const out: number[] = [];
      for (let t = 0; t < 600; t += 1.7)
        out.push(...Object.values(liquor.step(t, 1.7, 4e-3, 20 + t / 20)));
      return out;
    };
    expect(run()).toEqual(run());
  });
});
