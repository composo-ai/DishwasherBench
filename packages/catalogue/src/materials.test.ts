import { describe, expect, it } from 'vitest';
import {
  getMaterial,
  hasMaterial,
  listMaterials,
  materialDensity,
  WATER_DENSITY_60C,
  wettingClassOf,
} from './materials.ts';
import { instantiate } from './catalogue.ts';
import { LIQUOR_CLASSES, PROVENANCE_TAGS, type Material } from './types.ts';

describe('material table', () => {
  it('lists every material once, sorted by id, with a well-formed record', () => {
    const all = listMaterials();
    const ids = all.map((m) => m.id);
    expect(ids).toEqual([...ids].sort());
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of all) {
      expect(m.density.value, m.id).toBeGreaterThan(0);
      expect(m.thermal.conductivity.value, m.id).toBeGreaterThan(0);
      expect(m.thermal.specificHeat.value, m.id).toBeGreaterThan(0);
      for (const sourced of [m.density, m.thermal.conductivity, m.thermal.specificHeat]) {
        expect(PROVENANCE_TAGS, m.id).toContain(sourced.tag);
        expect(sourced.source.length, m.id).toBeGreaterThan(0);
      }
      expect(getMaterial(m.id)).toBe(m);
      expect(materialDensity(m.id)).toBe(m.density.value);
    }
  });

  it('has the densities of items.md table 3.1 with their tags', () => {
    // [material, kg/m^3, tag] as printed in docs/research/items.md section 3.1.
    const table: readonly (readonly [string, number, string])[] = [
      ['porcelain_glazed', 2400, 'VERIFIED'],
      ['stoneware_glazed', 2300, 'RECALLED'],
      ['glass_soda_lime', 2500, 'VERIFIED'],
      ['glass_borosilicate', 2210, 'VERIFIED'],
      ['crystal_lead', 3100, 'VERIFIED'],
      ['crystal_lead_free', 2550, 'ESTIMATED'],
      ['glass_vitrelle', 2500, 'ESTIMATED'],
      ['carbon_steel', 7820, 'VERIFIED'],
      ['stainless_steel', 7900, 'RECALLED'],
      ['cast_iron_seasoned', 7200, 'VERIFIED'],
      ['aluminium', 2700, 'VERIFIED'],
      ['polyethylene', 960, 'VERIFIED'],
      ['tritan', 1180, 'RECALLED'],
      ['melamine', 1500, 'RECALLED'],
      ['beech', 700, 'ESTIMATED'],
    ];
    for (const [id, density, tag] of table) {
      expect(getMaterial(id).density.value, id).toBe(density);
      expect(getMaterial(id).density.tag, id).toBe(tag);
    }
    // Ranges: polypropylene "use 905 to 920", nylon 1120 to 1170, silicone 1100 to 1200.
    expect(getMaterial('polypropylene').density.value).toBeGreaterThanOrEqual(905);
    expect(getMaterial('polypropylene').density.value).toBeLessThanOrEqual(920);
    expect(getMaterial('nylon').density.value).toBeGreaterThanOrEqual(1120);
    expect(getMaterial('nylon').density.value).toBeLessThanOrEqual(1170);
    expect(getMaterial('silicone').density.value).toBeGreaterThanOrEqual(1100);
    expect(getMaterial('silicone').density.value).toBeLessThanOrEqual(1200);
  });

  it('floats exactly the materials items.md 3.1 says float', () => {
    // "PP, PE, wood ... float. Glass, ceramic, metal, melamine, Tritan, silicone and PVC sink."
    for (const id of ['polypropylene', 'polyethylene', 'beech', 'bamboo']) {
      expect(getMaterial(id).floats, id).toBe(true);
    }
    for (const id of [
      'glass_soda_lime',
      'porcelain_glazed',
      'stainless_steel',
      'aluminium',
      'melamine',
      'tritan',
      'silicone',
    ]) {
      expect(getMaterial(id).floats, id).toBe(false);
    }
    for (const m of listMaterials()) {
      expect(m.floats, m.id).toBe(m.density.value < WATER_DENSITY_60C);
    }
  });

  it('reproduces the thermal diffusivities of films.md table 9.2 from k, rho and c', () => {
    // Diffusivity column of the dossier, m^2/s. It was computed there with the dossier's own
    // density column, so 5 % covers the small differences in density (borosilicate, HDPE).
    const diffusivity: readonly (readonly [string, number])[] = [
      ['porcelain_glazed', 6.9e-7],
      ['glass_soda_lime', 4.8e-7],
      ['glass_borosilicate', 6.2e-7],
      ['stainless_steel', 4.1e-6],
      ['polypropylene', 1.3e-7],
      ['polyethylene', 2.7e-7],
      ['melamine', 2.0e-7],
      ['san', 1.2e-7],
      ['tritan', 1.1e-7],
      ['silicone', 1.7e-7],
    ];
    for (const [id, expected] of diffusivity) {
      const m = getMaterial(id);
      const alpha = m.thermal.conductivity.value / (m.density.value * m.thermal.specificHeat.value);
      expect(Math.abs(alpha / expected - 1), id).toBeLessThan(0.05);
    }
  });

  it('derives the composite metals from their layers', () => {
    // Tri-ply at the dossier's 5600 kg/m^3: steel volume share f from 7900 f + 2700 (1 - f).
    const f = (5600 - 2700) / (7900 - 2700);
    const clad = getMaterial('stainless_clad');
    const series = 1 / (f / 16.2 + (1 - f) / 200);
    const steelMass = (f * 7900) / 5600;
    expect(Math.abs(clad.thermal.conductivity.value / series - 1)).toBeLessThan(0.02);
    expect(
      Math.abs(clad.thermal.specificHeat.value / (steelMass * 500 + (1 - steelMass) * 900) - 1),
    ).toBeLessThan(0.02);
    // Encapsulated base: 4 mm aluminium and 0.6 mm steel (items.md 10.2).
    const base = getMaterial('stainless_encapsulated_base');
    expect(Math.abs(base.density.value / ((4 * 2700 + 0.6 * 7900) / 4.6) - 1)).toBeLessThan(0.01);
    expect(
      Math.abs(base.thermal.conductivity.value / (4.6 / (0.6 / 16.2 + 4 / 200)) - 1),
    ).toBeLessThan(0.02);
    // Double wall: two 0.35 mm skins in a 7 mm wall, 0.70 x 7900 / 7 = 790 kg/m3 exactly as
    // its source string derives it (it once said 800).
    expect(getMaterial('stainless_double_wall').density.value).toBe(790);
    expect(getMaterial('stainless_double_wall').density.value).toBeCloseTo((0.7 * 7900) / 7, 9);
    expect(getMaterial('stainless_double_wall').density.source).toContain('0.70 x 7900 / 7 = 790');
    // The travel mug made of it: a wall of 6.9 mm, fitted to the 250 g of its body.
    const mug = instantiate('travel_mug_steel_470');
    expect(Math.abs(mug.mass.mass * 1000 - 250)).toBeLessThan(0.5);
    expect(mug.bbox.max[2]).toBeCloseTo(0.19, 9);
    expect(mug.bbox.max[0]).toBeCloseTo(0.04, 9);
  });

  it('throws for an unknown material', () => {
    expect(hasMaterial('unobtainium')).toBe(false);
    expect(() => getMaterial('unobtainium')).toThrow(RangeError);
    expect(() => materialDensity('unobtainium')).toThrow(RangeError);
  });
});

describe('wetting data (films.md 12.7)', () => {
  it('has the contact angles of the dossier rows', () => {
    // [material, clean adv/rec, main-wash adv/rec, rinse-aid adv/rec], degrees.
    const rows: readonly (readonly [string, readonly number[]])[] = [
      ['glass_soda_lime', [35, 10, 15, 3, 15, 3]],
      ['glass_borosilicate', [40, 15, 15, 3, 15, 3]],
      ['porcelain_glazed', [45, 15, 20, 5, 20, 5]],
      ['stainless_steel', [80, 30, 45, 10, 55, 20]],
      ['polypropylene', [95, 60, 50, 25, 55, 25]],
      ['polyethylene', [96, 70, 45, 20, 50, 20]],
      ['melamine', [75, 40, 35, 10, 40, 12]],
      ['san', [80, 50, 35, 10, 40, 12]],
      ['tritan', [80, 50, 30, 8, 35, 10]],
      ['aluminium_nonstick', [110, 90, 70, 45, 72, 50]],
      ['silicone', [108, 80, 65, 40, 68, 45]],
    ];
    for (const [id, expected] of rows) {
      const a = getMaterial(id).wetting.angles;
      expect(
        [
          a.clean_water.advancingDeg,
          a.clean_water.recedingDeg,
          a.main_wash.advancingDeg,
          a.main_wash.recedingDeg,
          a.rinse_aid.advancingDeg,
          a.rinse_aid.recedingDeg,
        ],
        id,
      ).toEqual(expected);
      expect(getMaterial(id).wetting.standIn, id).toBe(false);
      expect(getMaterial(id).wetting.tag, id).toBe('ESTIMATED');
    }
  });

  it('has hysteresis in every liquor, and detergent never makes a surface less wettable', () => {
    for (const m of listMaterials()) {
      for (const liquor of LIQUOR_CLASSES) {
        const a = m.wetting.angles[liquor];
        expect(a.recedingDeg, `${m.id} ${liquor}`).toBeGreaterThanOrEqual(0);
        expect(a.recedingDeg, `${m.id} ${liquor}`).toBeLessThan(a.advancingDeg);
        expect(a.advancingDeg, `${m.id} ${liquor}`).toBeLessThan(180);
      }
      // films.md 2.3.3: lower surface tension lowers the contact angle.
      const { clean_water, main_wash, rinse_aid } = m.wetting.angles;
      expect(main_wash.advancingDeg, m.id).toBeLessThanOrEqual(clean_water.advancingDeg);
      expect(main_wash.recedingDeg, m.id).toBeLessThanOrEqual(clean_water.recedingDeg);
      expect(rinse_aid.advancingDeg, m.id).toBeLessThanOrEqual(clean_water.advancingDeg);
    }
  });

  it('classes materials as sim-core.md 3.4 lists them', () => {
    // Film class S1 (not a continuous film): "stainless steel, polypropylene, polyethylene,
    // melamine, SAN, copolyester, PTFE, silicone". Glass and glazed ceramic keep a film.
    const partiallyWetting = [
      'stainless_steel',
      'polypropylene',
      'polyethylene',
      'melamine',
      'san',
      'tritan',
      'aluminium_nonstick',
      'carbon_steel_nonstick',
      'silicone',
    ];
    for (const id of partiallyWetting) {
      expect(getMaterial(id).wetting.class, id).not.toBe('continuous_film');
    }
    for (const id of [
      'glass_soda_lime',
      'glass_borosilicate',
      'glass_vitrelle',
      'crystal_lead_free',
      'porcelain_glazed',
      'stoneware_glazed',
    ]) {
      expect(getMaterial(id).wetting.class, id).toBe('continuous_film');
    }
    // films.md 12.6: rivulet-prone above a receding angle of 20 degrees in the current liquor.
    const rivuletProne = listMaterials()
      .filter((m) => !m.wetting.standIn && m.wetting.class === 'rivulet_prone')
      .map((m) => m.id);
    expect(rivuletProne).toEqual([
      'aluminium_nonstick',
      'carbon_steel_nonstick',
      'polypropylene',
      'silicone',
    ]);
  });

  it('applies the receding-angle thresholds at their edges', () => {
    const angles = (cleanRec: number, washRec: number): Material['wetting']['angles'] => ({
      clean_water: { advancingDeg: 90, recedingDeg: cleanRec },
      main_wash: { advancingDeg: 60, recedingDeg: washRec },
      rinse_aid: { advancingDeg: 60, recedingDeg: washRec },
    });
    expect(wettingClassOf(angles(20, 10))).toBe('continuous_film');
    expect(wettingClassOf(angles(21, 10))).toBe('partially_wetting');
    expect(wettingClassOf(angles(20, 11))).toBe('partially_wetting');
    expect(wettingClassOf(angles(70, 20))).toBe('partially_wetting');
    expect(wettingClassOf(angles(70, 21))).toBe('rivulet_prone');
  });

  it('gives a service limit to every polymer and none to ceramics, glass and bare metals', () => {
    for (const m of listMaterials()) {
      if (m.family === 'polymer' || m.family === 'elastomer') {
        expect(m.maxServiceTempC, m.id).not.toBeNull();
        // Every catalogue polymer survives a 65 C main wash.
        expect(m.maxServiceTempC?.value ?? 0, m.id).toBeGreaterThanOrEqual(65);
      }
      if (m.family === 'ceramic' || m.family === 'glass') {
        expect(m.maxServiceTempC, m.id).toBeNull();
      }
    }
    // Verified: Vicat softening point of the PA11 rack coating (items.md 3.4).
    expect(getMaterial('rack_wire_pa11').maxServiceTempC?.value).toBe(181);
    expect(getMaterial('rack_wire_pa11').maxServiceTempC?.tag).toBe('VERIFIED');
  });
});
