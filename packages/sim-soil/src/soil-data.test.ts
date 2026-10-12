import { describe, expect, it } from 'vitest';
import {
  APPEARANCE_VISIBLE_BAND,
  SOIL_CLASS_APPEARANCE,
  visibilityBand,
  buildWashScene,
  classRates,
  createClassRates,
  createParamSet,
  createRegistry,
  heatStepOf,
  initSoil,
  resolveSoilConstants,
  SCENE_PARAM_DEFS,
  SHARED_PARAM_DEFS,
  SOIL_APPLICATIONS,
  SOIL_CLASS_LAW,
  SOIL_CLASS_PARENT,
  SOIL_DATA,
  SOIL_MODEL_CLASSES,
  SOIL_PARAM_DEFS,
  soilData,
  solidFatContent,
  workingAmount,
  type ItemSoilRecord,
  type SceneItem,
  type SceneMaterial,
  type SoilChemistry,
  type SoilModelClass,
  type WashScene,
} from './index.ts';

const registry = createRegistry({
  contributions: [SHARED_PARAM_DEFS, SCENE_PARAM_DEFS, SOIL_PARAM_DEFS],
  soilClasses: [...SOIL_MODEL_CLASSES],
});
const params = createParamSet(registry);

describe('the soil data by catalogue soil id (standards 10.3, 13.3; chemistry 4.2)', () => {
  const rows = Object.values(SOIL_DATA);

  it('gives every soil a model class whose registered visibility lies in the band of its appearance', () => {
    expect(rows.length).toBeGreaterThanOrEqual(66);
    for (const datum of rows) {
      expect(SOIL_MODEL_CLASSES, datum.id).toContain(datum.modelClass);
      const [lo, hi] = APPEARANCE_VISIBLE_BAND[datum.appearance];
      const visible = params.soilClass(datum.modelClass, 'visibleMass');
      expect(
        visible,
        `${datum.id} (${datum.appearance}, class ${datum.modelClass})`,
      ).toBeGreaterThanOrEqual(lo);
      expect(
        visible,
        `${datum.id} (${datum.appearance}, class ${datum.modelClass})`,
      ).toBeLessThanOrEqual(hi);
    }
  });

  it('gives every model class one appearance, and with it the band in which its residue becomes visible', () => {
    // The appearance of a class is that of every soil of the class.
    for (const datum of rows) {
      expect(SOIL_CLASS_APPEARANCE[datum.modelClass], datum.id).toBe(datum.appearance);
    }
    const mass = SOIL_MODEL_CLASSES.map((cls) => params.soilClass(cls, 'visibleMass'));
    const band = visibilityBand(SOIL_MODEL_CLASSES, mass);
    SOIL_MODEL_CLASSES.forEach((cls, k) => {
      const [lo, hi] = APPEARANCE_VISIBLE_BAND[SOIL_CLASS_APPEARANCE[cls]];
      // The registered thresholds lie inside the bands of standards 10.3, so the band is it.
      expect(band.low[k], cls).toBe(lo);
      expect(band.high[k], cls).toBe(hi);
      expect(mass[k], cls).toBeGreaterThanOrEqual(lo);
      expect(mass[k], cls).toBeLessThanOrEqual(hi);
    });
    // A tea stain: seen from 5 to 10 % of an IKW-level stain of 0.5 g/m2 (chemistry 8.6).
    const tea = SOIL_MODEL_CLASSES.indexOf('tea');
    expect(band.low[tea]).toBeCloseTo(0.05 * 5e-4, 12);
    expect(band.high[tea]).toBeCloseTo(0.1 * 5e-4, 12);
    // A threshold a parameter set has moved outside the band widens it to hold that value.
    const moved = visibilityBand(['tea'], [1e-4]);
    expect(moved.low[0]).toBeCloseTo(2.5e-5, 12);
    expect(moved.high[0]).toBe(1e-4);
  });

  it('judges milk as a translucent film and spinach as strongly coloured, which their kinetic classes are not', () => {
    // standards 10.3: milk protein 0.1 to 0.3 mg/cm2, spinach 0.02 to 0.05 mg/cm2.
    expect(soilData('iec_milk')?.modelClass).toBe('milk');
    expect(SOIL_CLASS_PARENT.milk).toBe('egg_yolk');
    expect(params.soilClass('milk', 'visibleMass')).toBeGreaterThan(
      2 * params.soilClass('egg_yolk', 'visibleMass'),
    );
    expect(soilData('iec_spinach')?.modelClass).toBe('coloured_starch');
    expect(params.soilClass('coloured_starch', 'visibleMass')).toBeLessThan(
      0.5 * params.soilClass('starch', 'visibleMass'),
    );
    // A split class has the law and, where nothing else is registered, the values of its parent.
    for (const cls of SOIL_MODEL_CLASSES) {
      const parent = SOIL_CLASS_PARENT[cls];
      if (parent === undefined) continue;
      expect(SOIL_CLASS_LAW[cls]).toEqual(SOIL_CLASS_LAW[parent]);
    }
    for (const name of ['tLag', 'rateRef', 'sPH', 'rateOH', 'jetRatio']) {
      expect(params.soilClass('milk', name), name).toBe(params.soilClass('egg_yolk', name));
    }
    for (const name of ['tLag', 'rateRef', 'enzymeRef', 'enzymeTm', 'jetRatio']) {
      expect(params.soilClass('coloured_starch', name), name).toBe(
        params.soilClass('starch', name),
      );
    }
  });

  it('states every amount on one basis: a soil stated dry is all solids, a wet one has a solids fraction and a loading inside its range', () => {
    for (const datum of rows) {
      expect(datum.solidsFraction, datum.id).toBeGreaterThan(0);
      expect(datum.solidsFraction, datum.id).toBeLessThanOrEqual(1);
      if (datum.basis === 'dry') expect(datum.solidsFraction, datum.id).toBe(1);
      expect(datum.loading, datum.id).toBeGreaterThanOrEqual(datum.loadingRange[0]);
      expect(datum.loading, datum.id).toBeLessThanOrEqual(datum.loadingRange[1]);
      expect(datum.coverage, datum.id).toBeGreaterThan(0);
      expect(datum.coverage, datum.id).toBeLessThanOrEqual(1);
      expect(SOIL_APPLICATIONS, datum.id).toContain(datum.application);
      expect(datum.ageH, datum.id).toBeGreaterThanOrEqual(0);
    }
  });

  it('reproduces the working quantities of the standard load (standards 13.3, 4.4)', () => {
    // 3 g of egg yolk on the 266 cm2 well of a dinner plate, half solids: 1.5 g dry.
    const egg = workingAmount('iec_egg_yolk', 0.0266);
    expect(egg?.amount_g).toBeCloseTo(3, 1);
    expect(egg?.dry_g).toBeCloseTo(1.5, 1);
    // 10 mL of milk on a quarter of the 212 cm2 interior of a glass: 0.5 g of protein and fat.
    const milk = workingAmount('iec_milk', 0.25 * 0.0212);
    expect(milk?.amount_g).toBeCloseTo(10.3, 0);
    expect(milk?.dry_g).toBeCloseTo(0.5, 1);
    // 3 g of porridge at 8 % solids on a soup plate: 0.24 g dry.
    expect(workingAmount('iec_oat_flakes', 0.0246)?.dry_g).toBeCloseTo(0.24, 2);
    // A tea film is stated dry: half the nominal film of an IKW-level stain on a cup.
    const tea = workingAmount('iec_tea', 0.6 * 0.012);
    expect(tea?.dry_g).toBe(tea?.amount_g);
    expect((tea?.dry_g ?? 0) * 1000).toBeCloseTo(1.8, 1);
    expect((soilData('iec_tea')?.loading ?? 0) / (soilData('ikw_tea')?.loading ?? 1)).toBe(0.5);
    // The visibility of a stain is 5 to 10 % of the IKW-level film (chemistry 8.6).
    const share =
      params.soilClass('tea', 'visibleMass') / ((soilData('ikw_tea')?.loading ?? 0) / 1000);
    expect(share).toBeGreaterThanOrEqual(0.05);
    expect(share).toBeLessThanOrEqual(0.1);
  });

  it('reads microwaved milk as cooked dry, not as an hour at 160 C', () => {
    expect(heatStepOf('iec_milk', 'baked')).toBe('cooked');
    expect(heatStepOf('ikw_milk_microwaved', 'baked')).toBe('cooked');
    expect(heatStepOf('ikw_creme_brulee', 'baked')).toBe('baked');
    expect(heatStepOf('no_such_soil', 'warm')).toBe('warm');
  });
});

describe('the fats the catalogue names melt by their own curves (chemistry 4.2)', () => {
  const c = resolveSoilConstants(params);
  const code = (cls: SoilModelClass): number => SOIL_MODEL_CLASSES.indexOf(cls);

  it('has the solid fat content of chemistry 4.2 at 40, 45 and 50 C', () => {
    // butter 0.008 / 0.003 / 0.001; margarine 0.006 / 0.003 / 0.001; lard 0.021 / 0.010 /
    // 0.005; beef tallow 0.080 / 0.038 / 0.017; liquid oils 0.
    const table: [SoilModelClass, number, number, number][] = [
      ['fat', 0.008, 0.003, 0.001],
      ['fat_margarine', 0.006, 0.003, 0.001],
      ['fat_lard', 0.021, 0.01, 0.005],
      ['fat_tallow', 0.08, 0.038, 0.017],
      ['fat_oil', 0, 0, 0],
    ];
    for (const [cls, at40, at45, at50] of table) {
      // The dossier's table is rounded to two figures: within 0.002.
      expect(Math.abs(solidFatContent(c, 40, code(cls)) - at40), cls).toBeLessThan(0.002);
      expect(Math.abs(solidFatContent(c, 45, code(cls)) - at45), cls).toBeLessThan(0.002);
      expect(Math.abs(solidFatContent(c, 50, code(cls)) - at50), cls).toBeLessThan(0.002);
    }
  });

  it('lets butter go at 40 C where tallow is still mostly solid, and both at 55 C', () => {
    const chem = (temperature: number): SoilChemistry => ({
      temperature,
      pH: 10.5,
      protease: 0,
      amylase: 0,
      peracid: 0,
      perhydroxyl: 0,
      surfactant: 0.1,
    });
    const at40 = classRates(c, chem(40), createClassRates(c.classCount));
    const at55 = classRates(c, chem(55), createClassRates(c.classCount));
    const butter40 = at40.first[code('fat')] as number;
    const tallow40 = at40.first[code('fat_tallow')] as number;
    // Tallow at 40 C holds 0.08 of solid fat: under a third of it is mobile.
    expect(tallow40).toBeGreaterThan(0);
    expect(tallow40 / butter40).toBeLessThan(0.35);
    expect((at55.first[code('fat_tallow')] as number) / (at55.first[code('fat')] as number)).toBe(
      1,
    );
    // Oil is mobile even at 20 C, where butter is a solid.
    const at20 = classRates(c, chem(20), createClassRates(c.classCount));
    expect(at20.first[code('fat')]).toBe(0);
    expect(at20.first[code('fat_oil')] as number).toBeGreaterThan(0);
    // The catalogue's fats are assigned: roast drippings to tallow, the IEC margarine to margarine.
    expect(soilData('lard_tallow')?.modelClass).toBe('fat_tallow');
    expect(soilData('iec_margarine')?.modelClass).toBe('fat_margarine');
    expect(soilData('vegetable_oil')?.modelClass).toBe('fat_oil');
    expect(soilData('butter_margarine')?.modelClass).toBe('fat');
  });
});

describe('laying a catalogue soil down with its own data', () => {
  const GLAZE: SceneMaterial = {
    id: 'glaze',
    wettingClass: 'continuous_film',
    advancing: [0.4, 0.2, 0.2],
    receding: [0.1, 0.05, 0.05],
  };
  const item: SceneItem = {
    itemId: 'tile',
    typeId: 'tile',
    shape: {
      parts: [
        {
          id: 'body',
          prim: { kind: 'rbox', halfExtents: [0.05, 0.05, 0.003], radius: 0.001 },
          pose: { p: [0, 0, 0], q: [0, 0, 0, 1] },
          material: 'glaze',
        },
      ],
      regions: [{ id: 'top', part: 'body', side: 'in' }],
    },
    pose: { p: [0, 0, 0.1], q: [0, 0, 0, 1] },
    soils: [
      {
        type: 'marker',
        regions: [{ region: 'top', coverage: 1 }],
        amount_g: 1,
        age_h: 0,
        heat_history: 'none',
      },
    ],
  };
  const scene: WashScene = buildWashScene({
    items: [item],
    machine: [],
    blockSize: 2e-3,
    materials: () => GLAZE,
    params,
  });
  const exact = createParamSet(registry, { 'soil.amountCv': 0 });
  const record = (type: string, over: Partial<ItemSoilRecord> = {}): ItemSoilRecord => ({
    type,
    regions: [{ region: 'top', coverage: 1 }],
    amount_g: 2,
    age_h: 3,
    heat_history: 'warm',
    ...over,
  });
  // What the orchestrator's lookup would say of the first build: the class of the mechanism
  // and no solids fraction.
  const lookup = (): { modelClass: SoilModelClass; solidsFraction: number | null } => ({
    modelClass: 'egg_yolk',
    solidsFraction: null,
  });
  const lay = (soil: ItemSoilRecord, with_ = exact) =>
    initSoil(scene, [{ itemId: 'tile', soils: [soil] }], lookup, with_, 7);

  it('takes the class and the solids of the soil id, and those of the caller for an id it does not know', () => {
    const milk = lay(record('iec_milk', { heat_history: 'baked' }));
    expect(milk.classes[milk.records[0]?.classCode ?? -1]).toBe('milk');
    expect(milk.records[0]?.dryMass).toBeCloseTo(2e-3 * 0.05, 12);
    // Cooked dry in a microwave oven (bake index about 0.25), not baked for an hour at 160 C (0.8).
    expect(milk.records[0]?.bake).toBeGreaterThan(0.15);
    expect(milk.records[0]?.bake).toBeLessThan(0.4);
    // A tea film is stated dry: all of the amount is on the item.
    const tea = lay(record('iec_tea', { amount_g: 0.002 }));
    expect(tea.classes[tea.records[0]?.classCode ?? -1]).toBe('tea');
    expect(tea.records[0]?.dryMass).toBeCloseTo(2e-6, 15);
    // An id the table does not know: the caller's class and the solids fraction of that class.
    const other = lay(record('something_else'));
    expect(other.classes[other.records[0]?.classCode ?? -1]).toBe('egg_yolk');
    expect(other.records[0]?.dryMass).toBeCloseTo(2e-3 * 0.5, 12);
  });

  it('scatters a brushed layer less from patch to patch than a paste spread on', () => {
    const cvOf = (type: string): number => {
      const state = lay(record(type));
      // One value per 2 mm patch of the lattice; the deposits are 1 mm cells.
      const seen = new Set<number>();
      for (let d = 0; d < state.count; d++) seen.add(Math.fround(state.mass0[d] as number));
      const values = [...seen];
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
      expect(values.length).toBeGreaterThan(1500);
      return sd / mean;
    };
    const cv = params.getVector('soil.applicationCv');
    const brushed = cv[SOIL_APPLICATIONS.indexOf('brushed')] as number;
    const spread = cv[SOIL_APPLICATIONS.indexOf('spread')] as number;
    // Over about 2,500 patches the coefficient of variation is met to 10 %.
    expect(cvOf('iec_egg_yolk') / brushed).toBeGreaterThan(0.9);
    expect(cvOf('iec_egg_yolk') / brushed).toBeLessThan(1.1);
    expect(cvOf('iec_oat_flakes') / spread).toBeGreaterThan(0.9);
    expect(cvOf('iec_oat_flakes') / spread).toBeLessThan(1.1);
    expect(brushed).toBeLessThan(spread);
    // A sprayed layer has the measured 0.1 (soils 7.7).
    expect(cv[SOIL_APPLICATIONS.indexOf('sprayed')]).toBe(0.1);
    expect(params.getVector('soil.applicationCv')).toEqual([0.1, 0.15, 0.3, 0.2]);
  });
});
