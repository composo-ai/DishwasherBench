import { describe, expect, it } from 'vitest';
import {
  detergentDoseG,
  GENERIC_TABLET,
  getDetergent,
  getRinseAid,
  IEC_RINSE_AID_III,
  IEC_TYPE_D,
  ingredientConcentrationsGPerL,
  listDetergents,
  listRinseAids,
} from './detergents.ts';
import type { Detergent, Ingredient } from './types.ts';

function ingredient(detergent: { readonly ingredients: readonly Ingredient[] }, name: string) {
  const found = detergent.ingredients.filter((i) => i.name.includes(name));
  if (found.length !== 1) throw new Error(`expected one ingredient matching '${name}'`);
  return found[0] as Ingredient;
}

function total(detergent: { readonly ingredients: readonly Ingredient[] }): number {
  return detergent.ingredients.reduce((sum, i) => sum + i.massPercent, 0);
}

describe('IEC reference detergent type D (chemistry.md section 1.1)', () => {
  it('has the composition of IEC 60436 Table E.1', () => {
    // [ingredient, mass percent].
    const table: readonly (readonly [string, number])[] = [
      ['Sodium citrate dihydrate', 30],
      ['Maleic/acrylic acid copolymer', 12],
      ['Sodium percarbonate', 7],
      ['TAED', 2],
      ['Sodium disilicate', 10],
      ['Linear fatty alcohol ethoxylate', 2],
      ['Protease', 1],
      ['Amylase', 0.5],
    ];
    for (const [name, percent] of table) {
      const found = ingredient(IEC_TYPE_D, name);
      expect(found.massPercent, name).toBe(percent);
      expect(found.tag, name).toBe('VERIFIED');
    }
    expect(IEC_TYPE_D.ingredients).toHaveLength(table.length + 1);
    expect(IEC_TYPE_D.form).toBe('powder');
  });

  it('makes sodium carbonate the balance to 100 %, tagged as an estimate', () => {
    const listed = 30 + 12 + 7 + 2 + 10 + 2 + 1 + 0.5;
    const carbonate = ingredient(IEC_TYPE_D, 'Sodium carbonate');
    expect(carbonate.massPercent).toBeCloseTo(100 - listed, 12);
    expect(carbonate.tag).toBe('ESTIMATED');
    expect(total(IEC_TYPE_D)).toBeCloseTo(100, 12);
  });

  it('names the enzyme and surfactant grades the standard specifies', () => {
    expect(ingredient(IEC_TYPE_D, 'Protease').specification).toContain('Savinase 6 T');
    expect(ingredient(IEC_TYPE_D, 'Amylase').specification).toContain('Termamyl 120 T');
    expect(ingredient(IEC_TYPE_D, 'ethoxylate').specification).toContain('Plurafac LF 403');
    expect(ingredient(IEC_TYPE_D, 'copolymer').specification).toContain('Sokalan CP 5');
  });
});

describe('detergentDoseG', () => {
  it('doses 8 g + 0.5 g per place setting: 14.5 g at 13 place settings (chemistry.md 1.2)', () => {
    expect(detergentDoseG(IEC_TYPE_D, 13)).toBeCloseTo(14.5, 12);
    expect(detergentDoseG(IEC_TYPE_D, 8)).toBeCloseTo(12, 12);
    expect(detergentDoseG(IEC_TYPE_D, 0)).toBe(8);
  });

  it('doses 8 g + 0.7 g per place setting in a machine rated below 8', () => {
    expect(detergentDoseG(IEC_TYPE_D, 6)).toBeCloseTo(8 + 0.7 * 6, 12);
    expect(detergentDoseG(IEC_TYPE_D, 7)).toBeCloseTo(12.9, 12);
  });

  it('takes the rate from the rated capacity and the amount from what is loaded', () => {
    // Six place settings in a 13 place setting machine: the large-machine rate.
    expect(detergentDoseG(IEC_TYPE_D, 6, 13)).toBeCloseTo(11, 12);
    // Six place settings in a 6 place setting machine: the small-machine rate.
    expect(detergentDoseG(IEC_TYPE_D, 6, 6)).toBeCloseTo(12.2, 12);
  });

  it('gives one tablet whatever the load', () => {
    expect(detergentDoseG(GENERIC_TABLET, 0)).toBe(19);
    expect(detergentDoseG(GENERIC_TABLET, 13)).toBe(19);
    expect(detergentDoseG(GENERIC_TABLET, 6, 6)).toBe(19);
  });

  it('refuses a negative or non-finite number of place settings', () => {
    expect(() => detergentDoseG(IEC_TYPE_D, -1)).toThrow(RangeError);
    expect(() => detergentDoseG(IEC_TYPE_D, Number.NaN)).toThrow(RangeError);
  });
});

describe('ingredientConcentrationsGPerL', () => {
  it('reproduces the component concentrations of chemistry.md 1.3 for type D at 4.0 g/L', () => {
    // 20 g (the IKW dose) in a 5 L main-wash fill.
    const c = ingredientConcentrationsGPerL(IEC_TYPE_D, 20, 5);
    const of = (name: string): number => c[ingredient(IEC_TYPE_D, name).name] as number;
    // [ingredient, g/L as printed, decimals printed].
    const table: readonly (readonly [string, number, number])[] = [
      ['Sodium citrate dihydrate', 1.2, 2],
      ['Sodium percarbonate', 0.28, 2],
      ['TAED', 0.08, 3],
      ['Sodium disilicate', 0.4, 2],
      ['Linear fatty alcohol ethoxylate', 0.08, 3],
      ['Protease', 0.04, 3],
      ['Amylase', 0.02, 3],
    ];
    for (const [name, expected, decimals] of table) {
      expect(of(name), name).toBeCloseTo(expected, decimals);
    }
    // The copolymer granulate is 50 % active: 0.24 g/L of active polymer.
    expect(0.5 * of('copolymer')).toBeCloseTo(0.24, 12);
  });

  it('adds up to the detergent concentration: 4.0 g/L and 4.1 g/L in the two worked cases', () => {
    const sum = (c: Readonly<Record<string, number>>): number =>
      Object.values(c).reduce((a, b) => a + b, 0);
    expect(sum(ingredientConcentrationsGPerL(IEC_TYPE_D, 20, 5))).toBeCloseTo(4.0, 12);
    const standardDose = detergentDoseG(IEC_TYPE_D, 13);
    expect(sum(ingredientConcentrationsGPerL(IEC_TYPE_D, standardDose, 3.5))).toBeCloseTo(4.1, 1);
  });

  it('refuses a fill that is not positive', () => {
    expect(() => ingredientConcentrationsGPerL(IEC_TYPE_D, 20, 0)).toThrow(RangeError);
    expect(() => ingredientConcentrationsGPerL(IEC_TYPE_D, 20, -1)).toThrow(RangeError);
  });
});

describe('generic all-in-one tablet (chemistry.md section 1.4)', () => {
  it('keeps every ingredient inside the range the dossier recalls for modern products', () => {
    // [ingredient, lowest, highest mass percent].
    const ranges: readonly (readonly [string, number, number])[] = [
      ['MGDA', 10, 35],
      ['Sodium citrate', 5, 30],
      ['Sodium carbonate', 10, 40],
      ['Sodium disilicate', 0, 5],
      ['Sodium percarbonate', 10, 20],
      ['TAED', 2, 5],
      ['nonionic surfactant', 2, 8],
      ['polyacrylate', 2, 10],
      ['HEDP', 0, 3],
      ['protease', 1, 3],
      ['amylase', 0.5, 2],
      ['benzotriazole', 0.1, 0.5],
      ['High-cloud-point', 1, 5],
    ];
    for (const [name, lo, hi] of ranges) {
      const found = ingredient(GENERIC_TABLET, name);
      expect(found.massPercent, name).toBeGreaterThanOrEqual(lo);
      expect(found.massPercent, name).toBeLessThanOrEqual(hi);
    }
    expect(GENERIC_TABLET.ingredients).toHaveLength(ranges.length);
    expect(total(GENERIC_TABLET)).toBeCloseTo(100, 9);
  });

  it('uses the typical TAED level HERA reports for tablets, 2.5 % of 0.5 to 3.2 %', () => {
    const taed = ingredient(GENERIC_TABLET, 'TAED');
    expect(taed.massPercent).toBe(2.5);
    expect(taed.rangePercent).toEqual([0.5, 3.2]);
    expect(taed.tag).toBe('VERIFIED');
  });

  it('is one unit dose inside the verified 17 to 25 g of commercial products', () => {
    const dose = GENERIC_TABLET.dose;
    expect(dose.kind).toBe('unit_dose');
    if (dose.kind !== 'unit_dose') return;
    expect(dose.rangeG).toEqual([17, 25]);
    // standards.md 13.4: one 18 to 20 g tablet for consumer-like levels.
    expect(dose.massG).toBeGreaterThanOrEqual(18);
    expect(dose.massG).toBeLessThanOrEqual(20);
    expect(GENERIC_TABLET.form).toBe('tablet');
  });

  it('is phosphate-free, with a strong builder, bleach and both enzymes', () => {
    const roles = new Set(GENERIC_TABLET.ingredients.map((i) => i.role));
    for (const role of ['builder', 'bleach', 'bleach_activator', 'protease', 'amylase'] as const) {
      expect(roles.has(role), role).toBe(true);
    }
    for (const i of GENERIC_TABLET.ingredients) {
      expect(i.name.toLowerCase(), i.name).not.toContain('phosphate');
    }
  });
});

describe('IEC reference rinse aid, formula III (chemistry.md section 8.2)', () => {
  it('has the recalled composition, adding up to 100 %', () => {
    expect(ingredient(IEC_RINSE_AID_III, 'nonionic').massPercent).toBe(12.5);
    expect(ingredient(IEC_RINSE_AID_III, 'cumene sulfonate').massPercent).toBe(11.5);
    expect(ingredient(IEC_RINSE_AID_III, 'Citric acid').massPercent).toBe(5);
    expect(ingredient(IEC_RINSE_AID_III, 'Water').massPercent).toBe(71);
    expect(total(IEC_RINSE_AID_III)).toBeCloseTo(100, 12);
    for (const i of IEC_RINSE_AID_III.ingredients) expect(i.tag, i.name).toBe('RECALLED');
    expect(IEC_RINSE_AID_III.acidic).toBe(true);
  });

  it('doses about 3 mL, which puts about 110 mg/L of nonionic in a 3.5 L final rinse', () => {
    expect(IEC_RINSE_AID_III.doseMl.value).toBe(3);
    expect(IEC_RINSE_AID_III.doseMl.range).toEqual([1, 6]);
    // Taking the rinse aid as 1 g/mL, as the dossier's own estimate does.
    const nonionicG =
      (IEC_RINSE_AID_III.doseMl.value * ingredient(IEC_RINSE_AID_III, 'nonionic').massPercent) /
      100;
    const mgPerL = (nonionicG * 1000) / 3.5;
    expect(Math.abs(mgPerL - 110)).toBeLessThan(5);
  });
});

describe('lookup', () => {
  it('lists detergents and rinse aids sorted by id and finds them by id', () => {
    const ids = listDetergents().map((d: Detergent) => d.id);
    expect(ids).toEqual(['generic_tablet', 'iec_type_d']);
    expect(getDetergent('iec_type_d')).toBe(IEC_TYPE_D);
    expect(getDetergent('generic_tablet')).toBe(GENERIC_TABLET);
    expect(listRinseAids().map((r) => r.id)).toEqual(['iec_formula_iii']);
    expect(getRinseAid('iec_formula_iii')).toBe(IEC_RINSE_AID_III);
  });

  it('throws for an unknown id', () => {
    expect(() => getDetergent('unobtainium')).toThrow(RangeError);
    expect(() => getRinseAid('unobtainium')).toThrow(RangeError);
  });
});
