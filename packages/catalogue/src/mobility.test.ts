import { STANDARD_GRAVITY } from '@spotless/core';
import { describe, expect, it } from 'vitest';
import { instantiate, listItemTypes } from './catalogue.ts';
import {
  CONCAVE_TURNING_FACTOR,
  isJetMobile,
  JET_MOBILE_THRESHOLD,
  jetMobilityNumber,
  jetMomentumFlux,
} from './mobility.ts';

/** Momentum flux of one 2 mm jet at the measured mean ejection speed, newtons (items.md 4.3). */
const J_MEAN = jetMomentumFlux(0.002, 7.69);
/** Largest single-nozzle momentum flux of the machine of the thesis, newtons (items.md 4.6). */
const J_MAX_THESIS = 0.45;

describe('jetMomentumFlux', () => {
  it('reproduces the force table of items.md section 4.3 to its printed precision', () => {
    // [nozzle diameter mm, speed m/s, flow L/min, J in N, equivalent mass J/g in grams].
    const table: readonly (readonly [number, number, number, number, number])[] = [
      [2, 4.5, 0.85, 0.064, 6.5],
      [2, 7.69, 1.45, 0.186, 19],
      [2, 12.0, 2.26, 0.452, 46],
      [3, 7.69, 3.26, 0.418, 43],
      [4, 7.69, 5.8, 0.743, 76],
    ];
    for (const [dMm, v, flowLPerMin, jN, equivalentG] of table) {
      const j = jetMomentumFlux(dMm / 1000, v);
      // Half a unit of the last printed digit: 0.0005 N and 0.5 g (0.05 g for 6.5).
      expect(Math.abs(j - jN), `${dMm} mm at ${v} m/s`).toBeLessThanOrEqual(0.0005);
      expect(Math.abs((j / STANDARD_GRAVITY) * 1000 - equivalentG)).toBeLessThanOrEqual(0.5);
      // J = rho Q v: the flow column gives the same force within its own rounding (0.005 L/min).
      const q = flowLPerMin / 60000;
      expect(Math.abs(1000 * q * v - j) / j).toBeLessThan(0.006);
    }
  });

  it('scales with the square of the nozzle diameter, the square of the speed, and the density', () => {
    const j = jetMomentumFlux(0.002, 5);
    expect(jetMomentumFlux(0.004, 5)).toBeCloseTo(4 * j, 12);
    expect(jetMomentumFlux(0.002, 10)).toBeCloseTo(4 * j, 12);
    expect(jetMomentumFlux(0.002, 5, 983)).toBeCloseTo(0.983 * j, 12);
  });
});

describe('jetMobilityNumber', () => {
  it('reproduces the flat-hit column of the table in items.md section 4.4', () => {
    // [item, mass in grams, Pi_J for one 2 mm jet at 7.69 m/s, decimals printed].
    const table: readonly (readonly [string, number, number, number])[] = [
      ['chopstick, wood', 6, 3.2, 1],
      ['silicone teat', 9, 2.1, 1],
      ['PP container lid', 20, 0.95, 2],
      ['teaspoon', 25, 0.76, 2],
      ['PP cup 400 ml', 41, 0.46, 2],
      ['baby bottle', 44, 0.43, 2],
      ['sippy cup', 62, 0.31, 2],
      ['wooden spoon', 45, 0.42, 2],
      ['melamine bowl', 136, 0.14, 2],
      ['tumbler', 220, 0.09, 2],
      ['mug', 340, 0.06, 2],
      ['cast-iron skillet', 2400, 0.008, 3],
    ];
    for (const [what, grams, expected, decimals] of table) {
      const pi = jetMobilityNumber(grams / 1000, J_MEAN, false);
      expect(Math.abs(pi - expected), what).toBeLessThanOrEqual(0.5 * 10 ** -decimals);
    }
  });

  it('doubles for an item with a concave face that turns the jet back', () => {
    expect(CONCAVE_TURNING_FACTOR).toBe(2);
    const flat = jetMobilityNumber(0.041, J_MEAN, false);
    const captured = jetMobilityNumber(0.041, J_MEAN, true);
    expect(captured).toBeCloseTo(2 * flat, 12);
    // items.md 4.4: PP cup 400 ml, concave capture: 0.93 to 1.0.
    expect(captured).toBeGreaterThan(0.92);
    expect(captured).toBeLessThan(1.0);
  });

  it('is the ratio of jet force to weight: one for the mass the jet just carries', () => {
    const mass = J_MEAN / STANDARD_GRAVITY;
    expect(jetMobilityNumber(mass, J_MEAN, false)).toBeCloseTo(1, 12);
  });

  it('refuses a mass that is not positive', () => {
    expect(() => jetMobilityNumber(0, J_MEAN, false)).toThrow(RangeError);
    expect(() => jetMobilityNumber(-0.1, J_MEAN, false)).toThrow(RangeError);
    expect(() => jetMobilityNumber(Number.NaN, J_MEAN, false)).toThrow(RangeError);
  });
});

/** The mass, kilograms, at which an item stops being a jet-mobile candidate (bisection). */
function freezingMass(jMax: number, concave: boolean): number {
  let lo = 0.001;
  let hi = 10;
  for (let i = 0; i < 60; i++) {
    const mid = 0.5 * (lo + hi);
    if (isJetMobile(mid, jMax, concave)) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

describe('the mobility screen of items.md section 4.6', () => {
  it('uses a threshold of 0.25, half of the best-lever tipping threshold', () => {
    expect(JET_MOBILE_THRESHOLD).toBe(0.25);
    expect(isJetMobile(J_MEAN / (0.25 * STANDARD_GRAVITY) / 1.001, J_MEAN, false)).toBe(true);
    expect(isJetMobile((J_MEAN / (0.25 * STANDARD_GRAVITY)) * 1.001, J_MEAN, false)).toBe(false);
  });

  it('freezes everything above about 370 g if concave and about 185 g otherwise at 0.45 N', () => {
    // The dossier rounds to the nearest 5 g.
    expect(Math.abs(freezingMass(J_MAX_THESIS, true) - 0.37)).toBeLessThan(0.005);
    expect(Math.abs(freezingMass(J_MAX_THESIS, false) - 0.185)).toBeLessThan(0.0025);
  });

  it('keeps a 220 g tumbler as a candidate, as the dossier says it deliberately does', () => {
    expect(isJetMobile(0.22, J_MAX_THESIS, true)).toBe(true);
  });

  it('sorts the catalogue as the dossier describes for that machine', () => {
    const mobile = new Map<string, boolean>();
    for (const type of listItemTypes()) {
      const mass = instantiate(type.id).mass.mass;
      mobile.set(type.id, isJetMobile(mass, J_MAX_THESIS, type.flags.concave));
    }
    const typesWhere = (pick: (type: ReturnType<typeof listItemTypes>[number]) => boolean) =>
      listItemTypes().filter(pick);
    // Frozen: "plates, bowls, cookware, boards" (dinner plates, cookware and boards here).
    const frozen = typesWhere(
      (t) => t.itemClass === 'dinner_plate' || t.category === 'cookware' || t.shapeTag === 'board',
    );
    expect(frozen.length).toBeGreaterThanOrEqual(15);
    for (const type of frozen) expect(mobile.get(type.id), type.id).toBe(false);
    // Candidates: "all plastics, lids, glasses, cups, stemware, loose cutlery, chopsticks,
    // teats": the light plastic containers and their lids, stemware, cutlery and baby items.
    const candidates = typesWhere(
      (t) =>
        ['food_container', 'container_lid', 'lunch_box', 'tumbler'].includes(t.itemClass) ||
        t.shapeTag === 'stemware' ||
        t.category === 'cutlery' ||
        t.category === 'baby',
    );
    expect(candidates.length).toBeGreaterThanOrEqual(25);
    for (const type of candidates) expect(mobile.get(type.id), type.id).toBe(true);
  });

  it('gives catalogue items the mobility numbers of the dossier table within 10 %', () => {
    // [catalogue id, Pi_J of items.md 4.4 for a flat hit by one 2 mm jet at 7.69 m/s].
    const table: readonly (readonly [string, number])[] = [
      ['chopstick_bamboo', 3.2],
      ['bottle_teat_silicone', 2.1],
      ['container_lid_pp', 0.95],
      ['teaspoon_130', 0.76],
      ['drinking_cup_pp_400', 0.46],
      ['baby_bottle_pp_260', 0.43],
      ['melamine_bowl_150', 0.14],
      ['tumbler_250', 0.09],
      ['skillet_cast_iron_260', 0.008],
    ];
    for (const [id, expected] of table) {
      const pi = jetMobilityNumber(instantiate(id).mass.mass, J_MEAN, false);
      expect(Math.abs(pi / expected - 1), id).toBeLessThan(0.1);
    }
  });
});
