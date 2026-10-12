import { describe, expect, it } from 'vitest';
import { listItemTypes } from './catalogue.ts';
import {
  describeSoil,
  formatSoilAge,
  getSoil,
  hasSoil,
  IKW_BALLAST_SOIL,
  listSoils,
} from './soils.ts';
import type { SoilClass, SoilStandard } from './types.ts';
import { SOIL_CLASSES, SOIL_HEAT_HISTORIES } from './types.ts';

/** mg/cm^2 to g/m^2. */
const MG_PER_CM2 = 10;

describe('the soil list', () => {
  it('has every home soil the catalogue brief names', () => {
    const ids = [
      'egg_yolk_dried',
      'egg_cooked',
      'milk_film',
      'milk_burnt',
      'cheese_baked',
      'minced_meat',
      'gravy',
      'rice_starch',
      'pasta_starch',
      'porridge',
      'wheat_biscuit_cereal',
      'mashed_potato',
      'butter_margarine',
      'lard_tallow',
      'vegetable_oil',
      'fat_polymerised',
      'sugar_syrup',
      'caramel',
      'jam',
      'chocolate',
      'tea_tannin',
      'coffee',
      'red_wine',
      'tomato_sauce',
      'curry',
      'spinach_particles',
      'seeds',
      'rice_grains',
      'burnt_carbonised',
      'peanut_butter',
      'lipstick',
    ];
    for (const id of ids) expect(hasSoil(id), id).toBe(true);
  });

  it('has the soils of the three test methods (standards.md sections 4.1 to 4.3)', () => {
    const byMethod = (method: SoilStandard): string[] =>
      listSoils()
        .filter((s) => s.standard?.method === method)
        .map((s) => s.id)
        .sort();
    // IEC 60436: "milk, tea, minced meat, egg, oat flakes, spinach and margarine".
    expect(byMethod('IEC 60436')).toEqual([
      'iec_egg_yolk',
      'iec_margarine',
      'iec_milk',
      'iec_minced_meat',
      'iec_oat_flakes',
      'iec_spinach',
      'iec_tea',
    ]);
    // AHAM DW-1: "egg yolk, creamed corn, oatmeal, mashed potatoes, ground beef with tomato
    // paste, raspberry preserves, peanut butter, tomato juice, coffee".
    expect(byMethod('AHAM DW-1')).toEqual([
      'aham_coffee',
      'aham_creamed_corn',
      'aham_egg_yolk',
      'aham_ground_beef',
      'aham_mashed_potato',
      'aham_oatmeal',
      'aham_peanut_butter',
      'aham_raspberry_preserves',
      'aham_tomato_juice',
    ]);
    // IKW: tea, microwaved milk, milk skin, starch mix, pasta, egg yolk, minced meat, creme brulee.
    expect(byMethod('IKW')).toEqual([
      'ikw_creme_brulee',
      'ikw_egg_yolk',
      'ikw_milk_microwaved',
      'ikw_milk_skin',
      'ikw_minced_meat',
      'ikw_pasta',
      'ikw_starch_mix',
      'ikw_tea',
    ]);
  });

  it('is sorted by id, and lookup by id returns the same record', () => {
    const soils = listSoils();
    const ids = soils.map((s) => s.id);
    expect(ids).toEqual([...ids].sort());
    expect(new Set(ids).size).toBe(ids.length);
    for (const soil of soils) expect(getSoil(soil.id)).toBe(soil);
    expect(() => getSoil('unobtainium')).toThrow(RangeError);
    expect(hasSoil('unobtainium')).toBe(false);
  });
});

describe('soil classes (soils.md section 7.9 and the first-release set R4)', () => {
  it('uses every class of the soil model at least once', () => {
    const used = new Set(listSoils().map((s) => s.soilClass));
    for (const soilClass of SOIL_CLASSES) expect(used.has(soilClass), soilClass).toBe(true);
    expect(SOIL_CLASSES).toHaveLength(8);
  });

  it('gives the ten first-release soils the classes the dossier gives them', () => {
    // [soil id, class of R4, secondary class R4 implies or null].
    const expected: readonly (readonly [string, SoilClass, SoilClass | null])[] = [
      ['egg_yolk_dried', 'SWP', null],
      ['egg_cooked', 'SWP', null],
      ['pasta_starch', 'SWS', null],
      ['rice_starch', 'SWS', null],
      ['ikw_starch_mix', 'SWS', null],
      ['porridge', 'SWS', 'PART'],
      ['wheat_biscuit_cereal', 'SWS', 'PART'],
      ['tomato_sauce', 'PEEL', 'STAIN'],
      ['cheese_baked', 'BURN', null],
      ['butter_margarine', 'FAT', null],
      ['lard_tallow', 'FAT', null],
      ['fat_polymerised', 'BURN', null],
      ['tea_tannin', 'STAIN', null],
      ['spinach_particles', 'PART', null],
      ['rice_grains', 'PART', null],
    ];
    for (const [id, soilClass, secondary] of expected) {
      const soil = getSoil(id);
      expect(soil.soilClass, id).toBe(soilClass);
      if (secondary !== null) expect(soil.secondaryClasses, id).toContain(secondary);
    }
  });

  it('flags the dyes that polypropylene takes up (soils.md 5.7): tomato and curry', () => {
    expect(getSoil('tomato_sauce').stainsPlastics).toBe(true);
    expect(getSoil('curry').stainsPlastics).toBe(true);
    expect(getSoil('egg_yolk_dried').stainsPlastics).toBe(false);
    expect(getSoil('tea_tannin').stainsPlastics).toBe(false);
  });

  it('carries identity only: no kinetic or adhesion parameter', () => {
    const allowed = new Set([
      'id',
      'name',
      'group',
      'soilClass',
      'secondaryClasses',
      'standard',
      'description',
      'heatHistories',
      'loading',
      // Amounts, coverage, ageing and appearance: what is on the item, not how it comes off.
      'working',
      'typicalRegions',
      'patterns',
      'difficulty',
      'residue',
      'stainsPlastics',
    ]);
    for (const soil of listSoils()) {
      for (const key of Object.keys(soil)) expect(allowed.has(key), `${soil.id}.${key}`).toBe(true);
    }
  });
});

describe('areal loadings', () => {
  it('follow from the recipes of the IKW and IEC methods (standards.md 4.3 and 4.4)', () => {
    // Egg yolk: 1.5 +/- 0.1 g over 140 cm^2; 750 mg dry of 1500 mg wet.
    const egg = getSoil('ikw_egg_yolk').loading;
    expect(egg.basis).toBe('wet');
    expect(egg.typicalGPerM2).toBeCloseTo(1.5 / 140e-4, 0);
    expect(egg.rangeGPerM2[0]).toBeCloseTo(1.4 / 140e-4, 0);
    expect(egg.rangeGPerM2[1]).toBeCloseTo(1.6 / 140e-4, 0);
    expect(egg.solidsFraction).toBeCloseTo(750 / 1500, 12);
    // Minced meat: 11.8 +/- 0.5 mg/cm^2; solids (225 x 0.27 + 75 x 0.24) / 380.
    const meat = getSoil('ikw_minced_meat').loading;
    expect(meat.typicalGPerM2).toBeCloseTo(11.8 * MG_PER_CM2, 9);
    expect(meat.rangeGPerM2[0]).toBeCloseTo(11.3 * MG_PER_CM2, 9);
    expect(meat.rangeGPerM2[1]).toBeCloseTo(12.3 * MG_PER_CM2, 9);
    expect(meat.solidsFraction).toBeCloseTo((225 * 0.27 + 75 * 0.24) / 380, 2);
    // Creme brulee: 19.8 +/- 1.1 mg/cm^2.
    const brulee = getSoil('ikw_creme_brulee').loading;
    expect(brulee.typicalGPerM2).toBeCloseTo(19.8 * MG_PER_CM2, 9);
    expect(brulee.rangeGPerM2[0]).toBeCloseTo(18.7 * MG_PER_CM2, 9);
    expect(brulee.rangeGPerM2[1]).toBeCloseTo(20.9 * MG_PER_CM2, 9);
    // Starch mix: a dry film of 619 to 708 mg on 177 cm^2, stated as 3.75 +/- 0.25 mg/cm^2.
    const starch = getSoil('ikw_starch_mix').loading;
    expect(starch.basis).toBe('dry');
    expect(starch.typicalGPerM2).toBeCloseTo(3.75 * MG_PER_CM2, 9);
    expect(starch.rangeGPerM2[0]).toBeCloseTo(0.619 / 177e-4, 0);
    expect(starch.rangeGPerM2[1]).toBeCloseTo(0.708 / 177e-4, 0);
    // Pasta: 3 g on about 250 cm^2.
    expect(getSoil('ikw_pasta').loading.typicalGPerM2).toBeCloseTo(3 / 250e-4, 9);
    // Porridge: 10.6 +/- 0.5 mg/cm^2; solids (50 x 0.9 + 250 x 0.1) / about 850 g.
    const oats = getSoil('iec_oat_flakes').loading;
    expect(oats.typicalGPerM2).toBeCloseTo(10.6 * MG_PER_CM2, 9);
    expect(oats.rangeGPerM2[0]).toBeCloseTo(10.1 * MG_PER_CM2, 9);
    expect(oats.rangeGPerM2[1]).toBeCloseTo(11.1 * MG_PER_CM2, 9);
    expect(oats.solidsFraction).toBeCloseTo((50 * 0.9 + 250 * 0.1) / 850, 2);
  });

  it('have the defaults of soils.md table 8.1', () => {
    // [soil id, default wet loading g/m^2, range or null, solids fraction or null].
    const table: readonly (readonly [
      string,
      number,
      readonly [number, number] | null,
      number | null,
    ])[] = [
      ['egg_yolk_dried', 150, [100, 600], 0.5],
      ['egg_white', 150, null, 0.12],
      ['milk_film', 30, null, 0.125],
      ['cheese_melted', 800, [300, 2000], 0.6],
      ['minced_meat', 120, null, 0.4],
      ['mashed_potato', 1500, null, 0.22],
      ['porridge', 600, [300, 2000], 0.16],
      ['wheat_biscuit_cereal', 600, [300, 2000], 0.3],
      ['butter_margarine', 10, null, null],
    ];
    for (const [id, typical, range, solids] of table) {
      const loading = getSoil(id).loading;
      expect(loading.basis, id).toBe('wet');
      expect(loading.typicalGPerM2, id).toBe(typical);
      if (range !== null) expect(loading.rangeGPerM2, id).toEqual(range);
      if (solids !== null) expect(loading.solidsFraction, id).toBe(solids);
    }
    // Dry-basis rows: starch films 37.5 (20 to 100), baked complex soil 280, char 20 to 300.
    expect(getSoil('pasta_starch').loading).toMatchObject({
      basis: 'dry',
      typicalGPerM2: 37.5,
      rangeGPerM2: [20, 100],
    });
    expect(getSoil('cheese_baked').loading).toMatchObject({ basis: 'dry', typicalGPerM2: 280 });
    expect(getSoil('fat_polymerised').loading).toMatchObject({
      basis: 'dry',
      rangeGPerM2: [20, 300],
    });
  });

  it('are under 1 g/m^2 of dry matter for every stain (soils.md 8.1, last row)', () => {
    const stains = listSoils().filter((s) => s.soilClass === 'STAIN');
    expect(stains.length).toBeGreaterThanOrEqual(5);
    for (const soil of stains) {
      expect(soil.loading.basis, soil.id).toBe('dry');
      expect(soil.loading.rangeGPerM2[1], soil.id).toBeLessThanOrEqual(1);
    }
  });

  it('are positive ranges that contain the typical value, with a tag and a source', () => {
    for (const soil of listSoils()) {
      const { typicalGPerM2, rangeGPerM2, solidsFraction, source } = soil.loading;
      expect(rangeGPerM2[0], soil.id).toBeGreaterThan(0);
      expect(typicalGPerM2, soil.id).toBeGreaterThanOrEqual(rangeGPerM2[0]);
      expect(typicalGPerM2, soil.id).toBeLessThanOrEqual(rangeGPerM2[1]);
      if (solidsFraction !== null) {
        expect(solidsFraction, soil.id).toBeGreaterThan(0);
        expect(solidsFraction, soil.id).toBeLessThanOrEqual(1);
      }
      expect(source.length, soil.id).toBeGreaterThan(0);
    }
  });
});

describe('difficulty ranks (soils.md section 5.11)', () => {
  it('are those of the ranking table', () => {
    const table: readonly (readonly [number, readonly string[]])[] = [
      [10, ['fat_polymerised', 'burnt_carbonised']],
      [9, ['cheese_baked', 'egg_cooked', 'milk_burnt', 'wheat_biscuit_cereal']],
      [8, ['egg_yolk_dried', 'ikw_creme_brulee', 'lipstick', 'porridge']],
      [7, ['ikw_starch_mix', 'ikw_minced_meat', 'cheese_melted', 'burnt_sugar', 'tea_tannin']],
      [6, ['pasta_starch', 'mashed_potato', 'dough_batter', 'milk_skin', 'peanut_butter']],
      [5, ['rice_starch', 'egg_white', 'yoghurt', 'hummus', 'avocado', 'curry']],
      [4, ['gravy', 'tomato_sauce', 'coffee', 'mustard', 'minced_meat']],
      [3, ['caramel', 'chocolate', 'red_wine', 'spinach_particles', 'seeds']],
      [2, ['sugar_syrup', 'jam', 'vegetable_oil', 'butter_margarine', 'milk_film']],
    ];
    for (const [rank, ids] of table) {
      for (const id of ids) expect(getSoil(id).difficulty.rank, id).toBe(rank);
    }
  });

  it('rise with the heat a food has seen', () => {
    const rank = (id: string): number => getSoil(id).difficulty.rank;
    expect(rank('egg_cooked')).toBeGreaterThan(rank('egg_yolk_dried'));
    expect(rank('milk_burnt')).toBeGreaterThan(rank('milk_skin'));
    expect(rank('milk_skin')).toBeGreaterThan(rank('milk_film'));
    expect(rank('cheese_baked')).toBeGreaterThan(rank('cheese_melted'));
    expect(rank('burnt_sugar')).toBeGreaterThan(rank('caramel'));
    expect(rank('caramel')).toBeGreaterThan(rank('sugar_syrup'));
    expect(rank('ikw_minced_meat')).toBeGreaterThan(rank('minced_meat'));
    expect(rank('fat_polymerised')).toBeGreaterThan(rank('lard_tallow'));
  });

  it('are integers from 1 to 10 inside their own range, all tagged as estimates', () => {
    for (const soil of listSoils()) {
      const { rank, range, tag } = soil.difficulty;
      expect(Number.isInteger(rank), soil.id).toBe(true);
      expect(range[0], soil.id).toBeGreaterThanOrEqual(1);
      expect(rank, soil.id).toBeGreaterThanOrEqual(range[0]);
      expect(rank, soil.id).toBeLessThanOrEqual(range[1]);
      expect(range[1], soil.id).toBeLessThanOrEqual(10);
      expect(tag, soil.id).toBe('ESTIMATED');
    }
  });
});

describe('formatSoilAge', () => {
  it('puts an age in hours into words', () => {
    expect(formatSoilAge(0)).toBe('less than an hour');
    expect(formatSoilAge(0.99)).toBe('less than an hour');
    expect(formatSoilAge(1)).toBe('about an hour');
    expect(formatSoilAge(1.49)).toBe('about an hour');
    expect(formatSoilAge(1.5)).toBe('about 2 hours');
    expect(formatSoilAge(12)).toBe('about 12 hours');
    expect(formatSoilAge(21.9)).toBe('about 22 hours');
    expect(formatSoilAge(22)).toBe('about a day');
    expect(formatSoilAge(35.9)).toBe('about a day');
    expect(formatSoilAge(36)).toBe('about 2 days');
    expect(formatSoilAge(72)).toBe('about 3 days');
  });

  it('refuses an age that is negative or not finite', () => {
    expect(() => formatSoilAge(-1)).toThrow(RangeError);
    expect(() => formatSoilAge(Number.NaN)).toThrow(RangeError);
    expect(() => formatSoilAge(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('describeSoil', () => {
  it('says what the soil is, how old it is and where it is', () => {
    expect(describeSoil('porridge', { ageH: 12, regionLabels: ['inside base'] })).toBe(
      'Porridge, dried on for about 12 hours, on the inside base',
    );
    expect(describeSoil('tea_tannin', { ageH: 72 })).toBe(
      'Tea stain, left standing for about 3 days',
    );
  });

  it('uses the phrase for the heat history asked for, and the first one by default', () => {
    expect(
      describeSoil('egg_cooked', {
        ageH: 30,
        heatHistory: 'baked',
        regionLabels: ['eating face', 'rim'],
      }),
    ).toBe('Baked-on egg, left for about a day after cooking, on the eating face and rim');
    expect(describeSoil('egg_cooked', { ageH: 30 })).toBe(
      'Cooked egg, left for about a day after cooking',
    );
  });

  it('describes a soil under an hour old as fresh, in the words that fit how it ages', () => {
    expect(describeSoil('egg_yolk_dried', { ageH: 0.5 })).toBe('Egg yolk, still wet');
    expect(describeSoil('burnt_carbonised', { ageH: 0.2 })).toBe(
      'Burnt-on crust, straight from the heat',
    );
  });

  it('joins several regions with commas and "and"', () => {
    expect(
      describeSoil('butter_margarine', { ageH: 3, regionLabels: ['blade', 'handle', 'rim'] }),
    ).toBe('Butter or margarine, left for about 3 hours, on the blade, handle and rim');
  });

  it('throws for an unknown soil and for a heat history the soil does not have', () => {
    expect(() => describeSoil('unobtainium', { ageH: 1 })).toThrow(RangeError);
    expect(() => describeSoil('milk_film', { ageH: 1, heatHistory: 'burnt' })).toThrow(RangeError);
  });

  it('has a phrase for every heat history of every soil, and an age placeholder', () => {
    for (const soil of listSoils()) {
      expect(soil.heatHistories.length, soil.id).toBeGreaterThan(0);
      for (const heat of soil.heatHistories) {
        expect(SOIL_HEAT_HISTORIES, soil.id).toContain(heat);
        const text = describeSoil(soil.id, { ageH: 5, heatHistory: heat });
        expect(text, soil.id).toContain('about 5 hours');
        expect(text.startsWith(soil.description.byHeat[heat] as string), soil.id).toBe(true);
      }
    }
  });
});

describe('typical regions', () => {
  it('are regions that some item type of the catalogue has', () => {
    const itemRegions = new Set<string>();
    for (const type of listItemTypes()) {
      for (const region of type.surfaceRegions) itemRegions.add(region.id);
    }
    for (const soil of listSoils()) {
      expect(soil.typicalRegions.length, soil.id).toBeGreaterThan(0);
      for (const region of soil.typicalRegions) {
        expect(itemRegions.has(region), `${soil.id}: ${region}`).toBe(true);
      }
    }
  });
});

describe('IKW ballast soil (standards.md section 4.3)', () => {
  it('is a 50 g portion whose fourteen ingredients add up to 100 %', () => {
    expect(IKW_BALLAST_SOIL.portionG).toBe(50);
    expect(IKW_BALLAST_SOIL.ingredients).toHaveLength(14);
    const total = IKW_BALLAST_SOIL.ingredients.reduce((sum, i) => sum + i.massPercent, 0);
    // Percentages are printed to one decimal: fourteen of them can be off by 0.7 in total.
    expect(Math.abs(total - 100)).toBeLessThan(0.7);
  });

  it('is half fat by mass: oil, margarine, lard and frying fat', () => {
    const share = (name: string): number => {
      const found = IKW_BALLAST_SOIL.ingredients.find((i) => i.name === name);
      if (found === undefined) throw new Error(`no ingredient ${name}`);
      return found.massPercent;
    };
    const fats =
      share('vegetable oil') + share('margarine') + share('lard') + share('deep-frying fat');
    expect(fats).toBeCloseTo(31.6 + 3 * 6.3, 9);
    expect(share('whole egg')).toBe(15.8);
    expect(share('potato starch')).toBe(2.2);
  });
});
