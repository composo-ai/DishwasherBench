import { describe, expect, it } from 'vitest';
import { dryLoadingGPerM2, SOIL_WORKING } from './soil-working.ts';
import { getSoil, listSoils } from './soils.ts';
import { validateSoilType } from './validate.ts';

describe('the working quantities of the soils', () => {
  it('exist for every soil of the catalogue and for nothing else', () => {
    expect(Object.keys(SOIL_WORKING).sort()).toEqual(listSoils().map((soil) => soil.id));
    for (const soil of listSoils()) expect(soil.working, soil.id).toBe(SOIL_WORKING[soil.id]);
  });

  it('give every soil a solids fraction, where the dossiers leave 22 without', () => {
    // docs/calibration/soil-quantities.md section 4: of the soils stated wet, 22 have none.
    const without = listSoils().filter(
      (soil) => soil.loading.basis === 'wet' && soil.loading.solidsFraction === null,
    );
    expect(without.length).toBe(22);
    for (const soil of listSoils()) {
      expect(soil.working.solidsFraction, soil.id).toBeGreaterThan(0);
      expect(soil.working.solidsFraction, soil.id).toBeLessThanOrEqual(1);
      // A soil stated dry is all dry matter (the first build multiplied a tea film by 0.01).
      if (soil.working.basis === 'dry') expect(soil.working.solidsFraction, soil.id).toBe(1);
    }
  });

  it('keep the loading inside its range, name a usual history the soil has, and validate', () => {
    for (const soil of listSoils()) {
      const w = soil.working;
      expect(w.gPerM2, soil.id).toBeGreaterThanOrEqual(w.rangeGPerM2[0]);
      expect(w.gPerM2, soil.id).toBeLessThanOrEqual(w.rangeGPerM2[1]);
      expect(soil.heatHistories, soil.id).toContain(w.heatHistory);
      expect(w.coverage, soil.id).toBeGreaterThan(0);
      expect(w.coverage, soil.id).toBeLessThanOrEqual(1);
      expect(validateSoilType(soil), soil.id).toEqual([]);
    }
  });

  it('state the standard soils as the standards prescribe them', () => {
    // standards.md 13.3: 3 g of egg yolk on the 266 cm2 well of a dinner plate; 10 mL of milk
    // on a quarter of the interior of the test glass; the IKW tea stain is the nominal film.
    expect(getSoil('iec_egg_yolk').working.gPerM2).toBeCloseTo(3 / 266e-4, -1);
    expect(getSoil('iec_milk').working.solidsFraction).toBe(0.05);
    expect(getSoil('ikw_tea').working.gPerM2).toBe(0.5);
    // Tomato sauce is stated wet: 150 g/m2 of sauce is 45 g/m2 of dry matter.
    const sauce = getSoil('tomato_sauce').working;
    expect(sauce.basis).toBe('wet');
    expect(dryLoadingGPerM2(sauce, 1.5, 0.01)).toBeCloseTo(45, 9);
  });

  it('call a stain a stain and nothing else one', () => {
    for (const soil of listSoils()) {
      expect(soil.working.appearance === 'stain', soil.id).toBe(soil.soilClass === 'STAIN');
    }
  });

  it('is found wanting by the validation when a number is off', () => {
    const porridge = getSoil('porridge');
    const messages = (working: Partial<typeof porridge.working>): string[] =>
      validateSoilType({ ...porridge, working: { ...porridge.working, ...working } }).map(
        (issue) => issue.message,
      );
    expect(messages({ solidsFraction: 0 })).toContain('working solids fraction outside 0 to 1');
    expect(messages({ gPerM2: 1 })).toContain('working loading is not inside a positive range');
    expect(messages({ heatHistory: 'burnt' })[0]).toMatch(/usual heat history/);
    expect(messages({ coverage: 1.5 })).toContain('usual coverage outside 0 to 1');
  });
});
