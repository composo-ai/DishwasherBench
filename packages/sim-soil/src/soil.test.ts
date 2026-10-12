// The soil model of the first build against the published results it is built from: the
// in-machine egg-yolk rates of Perez-Mohedano (soils 6.1), the enzyme temperature factors and
// tea bleaching checks of the chemistry dossier, the ketchup adhesion law (soils 8.2), the fat
// melting curve (chemistry 4.2), and the bookkeeping of the initial state.
import { poseInverseTransformPoint } from '@spotless/core';
import { describe, expect, it } from 'vitest';
import {
  adhesionTemperatureFactor,
  adhesiveStrength,
  bakeIndex,
  buildWashScene,
  createParamSet,
  createRegistry,
  createWashSoil,
  enzymeTemperatureFactor,
  excessAbove,
  hillRatio,
  initSoil,
  resolveSoilConstants,
  SCENE_PARAM_DEFS,
  SHARED_PARAM_DEFS,
  SOIL_CLASS_OF_MECHANISM,
  SOIL_CLASS_IDS,
  SOIL_MODEL_CLASSES,
  SOIL_PARAM_DEFS,
  shareAbove,
  sigmaOfCv,
  solidFatContent,
  soilVisibility,
  type ItemSoilRecord,
  type ParamSet,
  type SceneItem,
  type SceneMaterial,
  type SoilChemistry,
  type SoilForcing,
  type SoilModelClass,
  type SoilState,
  type WashScene,
  type WashSoil,
} from './index.ts';

const registry = createRegistry({
  contributions: [SHARED_PARAM_DEFS, SCENE_PARAM_DEFS, SOIL_PARAM_DEFS],
  soilClasses: [...SOIL_MODEL_CLASSES],
});
/**
 * The registry defaults with the scatter and the oven drying switched off: exactly the amount
 * stated, laid down per deposit, on lumped elements that a heat step does not dry. The tests
 * of the laws are written for these; the registered defaults have their own tests below.
 */
const PLAIN = {
  'soil.amountCv': 0,
  'soil.subCellCv': 0,
  'soil.loadScale': 0,
  'soil.heatDryingFactor': 0,
} as const;
const defaults = createParamSet(registry, PLAIN);
/** The registered defaults as they are. */
const registered = createParamSet(registry);

const MATERIALS: Readonly<Record<string, SceneMaterial>> = {
  glaze: {
    id: 'glaze',
    wettingClass: 'continuous_film',
    advancing: [0.4, 0.2, 0.2],
    receding: [0.1, 0.05, 0.05],
  },
  pp: {
    id: 'pp',
    wettingClass: 'rivulet_prone',
    advancing: [1.7, 1.4, 1.2],
    receding: [1.3, 1, 0.8],
  },
};

/** A 100 mm square slab whose top face is the region `top`, with soil cells on it. */
function slabScene(material = 'glaze', blockSize = 4e-3): WashScene {
  const item: SceneItem = {
    itemId: 'tile',
    typeId: 'tile',
    shape: {
      parts: [
        {
          id: 'body',
          prim: { kind: 'rbox', halfExtents: [0.05, 0.05, 0.003], radius: 0.001 },
          pose: { p: [0, 0, 0], q: [0, 0, 0, 1] },
          material,
        },
      ],
      regions: [
        { id: 'top', part: 'body', side: 'in' },
        { id: 'underside', part: 'body', side: 'out' },
      ],
    },
    pose: { p: [0.01, 0.02, 0.1], q: [0, 0, Math.sin(0.4), Math.cos(0.4)] },
    soils: [
      {
        type: 'marker',
        regions: [
          { region: 'top', coverage: 1 },
          { region: 'underside', coverage: 1 },
        ],
        amount_g: 1,
        age_h: 0,
        heat_history: 'none',
      },
    ],
  };
  return buildWashScene({
    items: [item],
    machine: [],
    blockSize,
    materials: (id) => MATERIALS[id] ?? (MATERIALS['glaze'] as SceneMaterial),
    params: defaults,
  });
}

/** Area of the region `top` of a slab scene, m2. */
function areaOfTop(of: WashScene): number {
  let area = 0;
  for (let b = 0; b < of.blocks.count; b++) {
    if (of.instances[0]?.shape.regions[of.blocks.region[b] as number]?.id === 'top') {
      area += of.blocks.area[b] as number;
    }
  }
  return area;
}

// A fine scene for the initial state, a coarse one for the runs over simulated hours (the
// kinetics do not depend on the size of a cell).
const scene = slabScene();
const topArea = areaOfTop(scene);
const coarse = slabScene('glaze', 12.5e-3);

function record(type: string, over: Partial<ItemSoilRecord> = {}): ItemSoilRecord {
  return {
    type,
    regions: [{ region: 'top', coverage: 1 }],
    amount_g: 1,
    // No ageing by default: the bake index is 0. A record with a solids fraction of 1 holds
    // no water, so it starts dry (the lag in full) whatever its age.
    age_h: 0,
    heat_history: 'none',
    ...over,
  };
}

/** A soil of a model class with the given dry loading (kg/m2) all over the top face. */
function laidDown(
  cls: SoilModelClass,
  loading: number,
  params: ParamSet = defaults,
  over: Partial<ItemSoilRecord> = {},
  onScene: WashScene = coarse,
): { state: SoilState; soil: WashSoil } {
  const state = initSoil(
    onScene,
    [
      {
        itemId: 'tile',
        soils: [record(cls, { amount_g: loading * areaOfTop(onScene) * 1000, ...over })],
      },
    ],
    () => ({ modelClass: cls, solidsFraction: 1 }),
    params,
    5,
  );
  return { state, soil: createWashSoil(state, onScene, params) };
}

const NO_CHEMISTRY: SoilChemistry = {
  temperature: 20,
  pH: 8,
  protease: 0,
  amylase: 0,
  peracid: 0,
  perhydroxyl: 0,
  surfactant: 0,
};

/**
 * Every deposit alike: no scatter of the loading or of the bond strength, and the bond as it
 * was measured in cold water at every temperature (the tests of the detach law integrate that).
 */
const FLAT = {
  ...PLAIN,
  'soil.loadCv': 0,
  'soil.adhesionCv': 0,
  'soil.adhesionHotFactor': 1,
} as const;

/** The error function (Abramowitz and Stegun 7.1.26, absolute error below 1.5e-7). */
function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return x >= 0 ? y : -y;
}

/** Shear levels of the synthetic jet table, Pa. */
const JET_LEVELS = [10, 30, 100, 300] as const;

/** The same exposure on every deposit. */
function forcing(
  state: SoilState,
  chem: SoilChemistry,
  o: {
    time?: number;
    dt?: number;
    wet?: number;
    filmShear?: number;
    jetDuty?: number;
    jetShear?: number;
    period?: number;
    supply?: number;
    wetHeld?: number;
  } = {},
): SoilForcing {
  const n = state.count;
  const dt = o.dt ?? 1.71;
  // One row of a jet table for every deposit: a square pulse of `jetShear` for `jetDuty` of
  // the time (columns: time in the film, time above each of the four levels, peak).
  const duty = o.jetDuty ?? 0;
  const shear = o.jetShear ?? 0;
  const above = (level: number): number => (shear > level ? duty : 0);
  return {
    time: o.time ?? 0,
    dt,
    period: o.period ?? dt,
    wet: new Float32Array(n).fill(o.wet ?? 1),
    supply: new Float32Array(n).fill(o.supply ?? 1),
    wetUntil: new Float64Array(n),
    wetHeld: new Float32Array(n).fill(o.wetHeld ?? 1),
    filmShear: new Float32Array(n).fill(o.filmShear ?? 0),
    jetRow: new Int32Array(n).fill(duty > 0 ? 0 : -1),
    jetValues: Float32Array.of(
      duty,
      above(JET_LEVELS[0]),
      above(JET_LEVELS[1]),
      above(JET_LEVELS[2]),
      above(JET_LEVELS[3]),
      shear,
    ),
    jetColumns: { stride: 6, wetDuty: 0, duty: 1, level1: 2, level2: 3, level3: 4, shearPeak: 5 },
    jetShearLevels: JET_LEVELS,
    jetShearScale: 1,
    liquor: new Uint16Array(n),
    chemistry: [chem],
  };
}

/** Runs `seconds` of identical ticks; returns the remaining share of the initial mass after each. */
function run(soil: WashSoil, f: SoilForcing, seconds: number, start = 0): number[] {
  // The initial mass summed the way `totalMass` sums, so that an untouched soil gives exactly 1.
  let initial = 0;
  for (let d = 0; d < soil.state.count; d++) {
    initial += (soil.state.mass0[d] as number) * (soil.state.area[d] as number);
  }
  const out: number[] = [];
  for (let t = start; t < start + seconds - 1e-9; t += f.dt) {
    soil.step({ ...f, time: t });
    out.push(soil.totalMass() / initial);
  }
  return out;
}

describe('rate functions', () => {
  const c = resolveSoilConstants(defaults);

  it('give the enzyme temperature factors of chemistry 10.6', () => {
    const protease = (t: number): number =>
      enzymeTemperatureFactor(25e3, 63, 300e3, c.gasConstant, t, 50);
    const amylase = (t: number): number =>
      enzymeTemperatureFactor(30e3, 70, 300e3, c.gasConstant, t, 50);
    // "protease: 0.55 at 30 C, 0.75 at 40 C, 1.00 at 50 C, 1.09 at 55 C, 0.97 at 60 C, 0.53 at
    // 65 C, 0.18 at 70 C"; "amylase: 0.48, 0.70, 1.00, 1.34 at 60 C, 1.36 at 65 C, 0.96 at 70 C".
    const want: [number, number][] = [
      [30, 0.55],
      [40, 0.75],
      [50, 1],
      [55, 1.09],
      [60, 0.97],
      [65, 0.53],
      [70, 0.18],
    ];
    for (const [t, f] of want) expect(Math.abs(protease(t) - f)).toBeLessThan(0.015);
    const wantA: [number, number][] = [
      [30, 0.48],
      [40, 0.7],
      [50, 1],
      [60, 1.34],
      [65, 1.36],
      [70, 0.96],
    ];
    for (const [t, f] of wantA) expect(Math.abs(amylase(t) - f)).toBeLessThan(0.015);
  });

  it('give the Hill response fitted to the in-machine rates', () => {
    // soils 6.1: rate proportional to E^3 / (0.049^3 + E^3): 0.097, 1.00, 1.39 at 0.02, 0.06, 0.10 g/L.
    expect(hillRatio(0.02, 0.06, c.KE * 0.06, c.hillN)).toBeCloseTo(0.097, 2);
    expect(hillRatio(0.06, 0.06, c.KE * 0.06, c.hillN)).toBe(1);
    expect(hillRatio(0.1, 0.06, c.KE * 0.06, c.hillN)).toBeCloseTo(1.39, 2);
    expect(hillRatio(0, 0.06, c.KE * 0.06, c.hillN)).toBe(0);
  });

  it('melt butter between 20 and 40 C', () => {
    const FAT = SOIL_MODEL_CLASSES.indexOf('fat');
    // chemistry 4.2: butter SFC 0.008 / 0.003 / 0.001 at 40 / 45 / 50 C; liquid by 35 to 40 C.
    expect(solidFatContent(c, 40, FAT)).toBeCloseTo(0.008, 3);
    expect(solidFatContent(c, 45, FAT)).toBeCloseTo(0.003, 3);
    expect(solidFatContent(c, 20, FAT)).toBeGreaterThan(c.fatSfcSolid);
    expect(solidFatContent(c, 37, FAT)).toBeLessThan(c.fatSfcLiquid);
  });

  it('give soaked ketchup a strength a 1 Pa film exceeds and a 0.3 Pa film does not', () => {
    // soils 8.2: tau_ad = 8.11e5 exp(-0.016 beta) Pa, C_ad = 14.2; at beta = 750 kg/m3 the bond
    // holds 5.0 Pa, which a flow of 5.0 / 14.2 = 0.35 Pa breaks.
    expect(adhesiveStrength(c, 1, 1)).toBeCloseTo((8.11e5 * Math.exp(-12)) / 14.2, 9);
    expect(adhesiveStrength(c, 1, 1)).toBeGreaterThan(0.3);
    expect(adhesiveStrength(c, 1, 1)).toBeLessThan(1);
    expect(adhesiveStrength(c, 0, 1)).toBeCloseTo(8.11e5 / 14.2, 6);
  });
});

describe('initial state', () => {
  const lookup = () => ({ modelClass: 'egg_yolk' as const, solidsFraction: 0.5 });

  it('lays down exactly the dry mass of the record on the covered share of the region', () => {
    const state = initSoil(
      scene,
      [
        {
          itemId: 'tile',
          soils: [record('egg', { amount_g: 1.5, regions: [{ region: 'top', coverage: 0.4 }] })],
        },
      ],
      lookup,
      defaults,
      9,
    );
    expect(state.problems).toEqual([]);
    expect(state.records).toHaveLength(1);
    const rec = state.records[0];
    if (rec === undefined) throw new Error('no record');
    expect(rec.dryMass).toBeCloseTo(0.5 * 1.5e-3, 15);
    let mass = 0;
    let area = 0;
    for (let d = 0; d < state.count; d++) {
      mass += (state.mass[d] as number) * (state.area[d] as number);
      area += state.area[d] as number;
      // Every deposit lies on the region named.
      const region = scene.blocks.region[state.block[d] as number] as number;
      expect(scene.instances[0]?.shape.regions[region]?.id).toBe('top');
      if (d > 0) expect(state.cell[d]).toBeGreaterThan(state.cell[d - 1] as number);
    }
    expect(mass / rec.dryMass).toBeCloseTo(1, 12);
    // 40 % of the region, to within one soil cell (4 mm2).
    expect(Math.abs(area - 0.4 * topArea)).toBeLessThan(4.1e-6);
    expect(rec.coveredArea).toBeCloseTo(area, 9);
  });

  it('varies the loading log-normally with the registered coefficient of variation', () => {
    const state = initSoil(
      scene,
      [{ itemId: 'tile', soils: [record('egg')] }],
      lookup,
      defaults,
      9,
    );
    let sum = 0;
    let sq = 0;
    for (let d = 0; d < state.count; d++) {
      sum += state.mass[d] as number;
      sq += (state.mass[d] as number) ** 2;
    }
    const mean = sum / state.count;
    const cv = Math.sqrt(sq / state.count - mean * mean) / mean;
    expect(state.count).toBeGreaterThan(2000);
    expect(cv).toBeGreaterThan(0.27);
    expect(cv).toBeLessThan(0.33);
    const flat = initSoil(
      scene,
      [{ itemId: 'tile', soils: [record('egg')] }],
      lookup,
      createParamSet(registry, { ...PLAIN, 'soil.loadCv': 0 }),
      9,
    );
    for (let d = 1; d < flat.count; d++)
      expect(flat.mass[d]).toBeCloseTo(flat.mass[0] as number, 15);
  });

  it('covers a coherent patch that the seed moves', () => {
    const half = (seed: number): SoilState =>
      initSoil(
        scene,
        [
          {
            itemId: 'tile',
            soils: [record('egg', { regions: [{ region: 'top', coverage: 0.5 }] })],
          },
        ],
        lookup,
        defaults,
        seed,
      );
    const a = half(1);
    const again = half(1);
    const b = half(2);
    expect([...a.cell]).toEqual([...again.cell]);
    expect([...a.mass]).toEqual([...again.mass]);
    expect([...a.cell]).not.toEqual([...b.cell]);
    // Coherent: most covered cells share their block with other covered cells (a random half of
    // the cells would fill all four cells of only one block in sixteen).
    const perBlock = new Map<number, number>();
    for (const blockIndex of a.block) perBlock.set(blockIndex, (perBlock.get(blockIndex) ?? 0) + 1);
    const full = [...perBlock.values()].filter((count) => count === 4).length;
    expect(full / perBlock.size).toBeGreaterThan(0.7);
  });

  it('starts a soil that is still wet with its lag paid, and a dried one from zero', () => {
    const fresh = initSoil(
      scene,
      [{ itemId: 'tile', soils: [record('egg', { age_h: 0 })] }],
      lookup,
      defaults,
      9,
    );
    const dried = initSoil(
      scene,
      [{ itemId: 'tile', soils: [record('egg', { age_h: 48 })] }],
      lookup,
      defaults,
      9,
    );
    expect(fresh.hydration[0]).toBe(1.5);
    expect(dried.hydration[0]).toBe(0);
    // 20 g of wet soil on 0.01 m2 holds 1 kg/m2 of water; at 9e-6 kg/(m2 s), 10 h take a third.
    const thick = initSoil(
      scene,
      [{ itemId: 'tile', soils: [record('egg', { age_h: 10, amount_g: 2000 * topArea })] }],
      lookup,
      defaults,
      9,
    );
    expect(thick.hydration[0]).toBeCloseTo(1.5 * (1 - (9e-6 * 36000) / 1), 6);
  });

  it('computes the bake index of a heat history', () => {
    // soils 8.3: "B of about 0.2 after 2 h at 80 C ... 0.1 after 20 h at room temperature".
    expect(bakeIndex(defaults, record('x', { age_h: 0, heat_history: 'warm' }))).toBeCloseTo(
      0.19,
      2,
    );
    expect(bakeIndex(defaults, record('x', { age_h: 20, heat_history: 'none' }))).toBeCloseTo(
      0.1,
      1,
    );
    const histories = (['none', 'warm', 'cooked', 'baked', 'burnt'] as const).map((h) =>
      bakeIndex(defaults, record('x', { age_h: 0, heat_history: h })),
    );
    for (let i = 1; i < histories.length; i++)
      expect(histories[i]).toBeGreaterThan(histories[i - 1] as number);
    expect(histories[0]).toBe(0);
    expect(histories[3]).toBeGreaterThan(0.7);
  });

  it('reports a soil on a region the item does not have', () => {
    const state = initSoil(
      scene,
      [
        {
          itemId: 'tile',
          soils: [record('egg', { regions: [{ region: 'handle', coverage: 1 }] })],
        },
        { itemId: 'ghost', soils: [record('egg')] },
      ],
      lookup,
      defaults,
      9,
    );
    expect(state.count).toBe(0);
    expect(state.problems.join('\n')).toContain('handle');
    expect(state.problems.join('\n')).toContain('ghost');
  });

  it('maps every mechanism class of the catalogue to a model class with a visibility threshold', () => {
    for (const id of SOIL_CLASS_IDS)
      expect(SOIL_MODEL_CLASSES).toContain(SOIL_CLASS_OF_MECHANISM[id]);
    const visible = soilVisibility(defaults);
    expect(visible.mass).toHaveLength(SOIL_MODEL_CLASSES.length);
    // standards 10.3: 0.02 to 0.3 mg/cm2, that is 2e-4 to 3e-3 kg/m2; a stain is judged
    // against 5 to 10 % of the nominal 0.5 g/m2 of an IKW-level stain (chemistry 8.6).
    const tea = SOIL_MODEL_CLASSES.indexOf('tea');
    visible.mass.forEach((m, k) => {
      expect(m).toBeGreaterThanOrEqual(k === tea ? 2.5e-5 : 2e-4);
      expect(m).toBeLessThanOrEqual(k === tea ? 5e-5 : 3e-3);
    });
    expect(visible.fraction[tea]).toBe(0);
  });
});

describe('egg yolk in the machine (soils 6.1)', () => {
  // The tile of the thesis: 137 g/m2, vertical under a draining film, struck by two jets for
  // 1.59 % of each 1.71 s revolution. Constant-stage rates in % of the tile per minute.
  const loading = 0.137;
  const flat = createParamSet(registry, FLAT);
  const cases: { t: number; pH: number; protease: number; rate: number; std: number }[] = [
    { t: 30, pH: 10.5, protease: 0.06, rate: 0.85, std: 0.12 },
    { t: 55, pH: 10.5, protease: 0.06, rate: 1.75, std: 0.29 },
    { t: 55, pH: 10.5, protease: 0.02, rate: 0.17, std: 0.05 },
    { t: 55, pH: 10.5, protease: 0.1, rate: 2.59, std: 0.22 },
    { t: 55, pH: 9.5, protease: 0.06, rate: 0.69, std: 0.16 },
    { t: 55, pH: 11.5, protease: 0.06, rate: 4.66, std: 0.38 },
  ];

  it.each(cases)('removes $rate % per minute at $t C, pH $pH, $protease g/L', (c) => {
    const { state, soil } = laidDown('egg_yolk', loading, flat);
    const chem: SoilChemistry = {
      ...NO_CHEMISTRY,
      temperature: c.t,
      pH: c.pH,
      protease: c.protease,
    };
    const left = run(soil, forcing(state, chem, { jetDuty: 0.0159, jetShear: 60 }), 4 * 3600);
    // Constant stage: between 10 % and 30 % removed.
    const i0 = left.findIndex((x) => x < 0.9);
    const i1 = left.findIndex((x) => x < 0.7);
    expect(i0).toBeGreaterThan(0);
    expect(i1).toBeGreaterThan(i0);
    const perMinute = ((0.2 * 100) / ((i1 - i0) * 1.71)) * 60;
    expect(Math.abs(perMinute - c.rate)).toBeLessThan(Math.max(0.2 * c.rate, c.std));
  });

  it('starts after the lag and slows once 70 % is gone', () => {
    const { state, soil } = laidDown('egg_yolk', loading, flat);
    const chem: SoilChemistry = { ...NO_CHEMISTRY, temperature: 55, pH: 10.5, protease: 0.06 };
    const left = run(soil, forcing(state, chem), 3 * 3600);
    // sim-core M8: the lag is 7.8 min at 55 C (9 min / 1.15, the enzyme's temperature factor
    // with the mid-point at 75 C); removal is in full swing half a lag later.
    const first = left.findIndex((x) => x < 1) * 1.71;
    expect(first / 60).toBeGreaterThan(7.83 * 0.98);
    expect(first / 60).toBeLessThan(7.83 * 1.05);
    const at = (fraction: number): number => left.findIndex((x) => x < fraction) * 1.71;
    const steady = (at(0.5) - at(0.7)) / 0.2;
    const tail = (at(0.1) - at(0.2)) / 0.1;
    expect(tail / steady).toBeGreaterThan(1.3); // decay stage (soils 7.5: below 30 % remaining)
    // "complete at about 65 min" (to the last few per cent).
    expect(at(0.05) / 60).toBeGreaterThan(50);
    expect(at(0.05) / 60).toBeLessThan(110);
  });

  it('removes nothing without enzyme at pH 10.5 or 9.5 (soils 2.2: below 2 %)', () => {
    for (const pH of [10.5, 9.5]) {
      const { state, soil } = laidDown('egg_yolk', loading, flat);
      const left = run(soil, forcing(state, { ...NO_CHEMISTRY, temperature: 55, pH }), 90 * 60);
      expect(left[left.length - 1]).toBeGreaterThan(0.98);
    }
  });

  it('does not let a cold pre-rinse pay off the lag, nor a hot hold reopen it', () => {
    const { state, soil } = laidDown('egg_yolk', loading, flat);
    run(soil, forcing(state, { ...NO_CHEMISTRY, temperature: 15, pH: 8 }), 11 * 60);
    expect(state.hydration[0]).toBe(0);
    const hot: SoilChemistry = { ...NO_CHEMISTRY, temperature: 55, pH: 10.5, protease: 0.06 };
    run(soil, forcing(state, hot), 20 * 60, 660);
    expect(state.hydration[0]).toBe(1.5);
    run(soil, forcing(state, { ...hot, temperature: 65 }), 10 * 60, 1860);
    expect(state.hydration[0]).toBe(1.5);
  });

  it('keeps its soil where it is never wet, whatever the liquor', () => {
    const { state, soil } = laidDown('egg_yolk', loading, flat);
    const chem: SoilChemistry = {
      ...NO_CHEMISTRY,
      temperature: 55,
      pH: 11.5,
      protease: 0.1,
      peracid: 1,
    };
    const before = [...state.mass];
    const left = run(soil, forcing(state, chem, { wet: 0 }), 3600);
    expect([...state.mass]).toEqual(before);
    expect(left[left.length - 1]).toBeCloseTo(1, 12);
    expect(state.hydration[0]).toBe(0);
  });

  it('cleans a baked soil more slowly', () => {
    const chem: SoilChemistry = { ...NO_CHEMISTRY, temperature: 55, pH: 10.5, protease: 0.06 };
    const dried = laidDown('egg_yolk', loading, flat);
    const baked = laidDown('egg_yolk', loading, flat, { heat_history: 'baked' });
    const a = run(dried.soil, forcing(dried.state, chem), 40 * 60);
    const b = run(baked.soil, forcing(baked.state, chem), 40 * 60);
    expect(b[b.length - 1]).toBeGreaterThan((a[a.length - 1] as number) + 0.2);
  });
});

describe('the other classes', () => {
  const flat = createParamSet(registry, FLAT);

  it('removes starch ten times more slowly without amylase', () => {
    const chem = (amylase: number): SoilChemistry => ({
      ...NO_CHEMISTRY,
      temperature: 50,
      pH: 10.5,
      amylase,
    });
    const withEnzyme = laidDown('starch', 0.0375, flat);
    const without = laidDown('starch', 0.0375, flat);
    const a = run(withEnzyme.soil, forcing(withEnzyme.state, chem(0.02)), 15 * 60);
    const b = run(without.soil, forcing(without.state, chem(0)), 15 * 60);
    // After the 5 min lag and its ramp, 2e-5 kg/(m2 s) takes 1 - 0.5 of 37.5 g/m2 in 7.5 min.
    const removedWith = 1 - (a[a.length - 1] as number);
    const removedWithout = 1 - (b[b.length - 1] as number);
    expect(removedWith).toBeGreaterThan(0.2);
    expect(removedWithout / removedWith).toBeCloseTo(0.1, 1);
  });

  it('detaches ketchup under a film once it has soaked, at a rate that grows with the excess shear', () => {
    const water: SoilChemistry = { ...NO_CHEMISTRY, temperature: 50 };
    const c = resolveSoilConstants(flat);
    // Independent integration of the law: hydration h = t / 180 s, strength
    // tau_a0 exp(-b beta_max min(h, 1)) / C_ad, rate (tau / strength - 1)+ / t_det (capped).
    const expected = (weight: (strength: number) => number): { start: number; gone: number } => {
      let removed = 0;
      let start = -1;
      for (let t = 1; t <= 4000; t++) {
        const h = Math.min(1, t / 180);
        const strength = (c.adhesionTau0 * Math.exp(-c.adhesionB * c.betaMax * h)) / c.Cad;
        const rate = weight(strength) / c.detachTime;
        if (rate > 0 && start < 0) start = t;
        removed += rate;
        if (removed >= 1) return { start, gone: t };
      }
      return { start, gone: -1 };
    };
    const excess = (tau: number, strength: number): number =>
      Math.min(c.detachExcessCap, Math.max(0, tau / strength - 1));
    // Under a 1 Pa film the bond gives way at hydration ln(tau_a0 / (C_ad tau)) / (b beta_max)
    // = 0.913 of the 180 s soak.
    const film = laidDown('adhesive', 0.278, flat);
    const left = run(film.soil, forcing(film.state, water, { filmShear: 1, dt: 1 }), 400);
    const start = left.findIndex((x) => x < 1);
    const need = Math.log(c.adhesionTau0 / (c.Cad * 1)) / (c.adhesionB * c.betaMax);
    expect(need).toBeCloseTo(0.913, 2);
    const film1 = expected((s) => excess(1, s));
    expect(Math.abs(start + 1 - film1.start)).toBeLessThanOrEqual(1);
    expect(Math.abs(left.findIndex((x) => x === 0) + 1 - film1.gone)).toBeLessThanOrEqual(1);
    // The soaked bond withstands 0.35 Pa: the rate rises from 0 to (1 / 0.35 - 1) / t_det =
    // 0.18 per second over the last 16 s of the soak, so the deposit takes 10 to 20 s.
    expect(film1.gone - film1.start).toBeGreaterThan(8);
    expect(film1.gone - film1.start).toBeLessThan(20);
    // Graded, not a cliff: a film just above the soaked strength takes far longer.
    const slow = laidDown('adhesive', 0.278, flat);
    const slowLeft = run(slow.soil, forcing(slow.state, water, { filmShear: 0.4, dt: 1 }), 400);
    const slow1 = expected((s) => excess(0.4, s));
    expect(slow1.gone - slow1.start).toBeGreaterThan(5 * (film1.gone - film1.start));
    expect(Math.abs(slowLeft.findIndex((x) => x === 0) + 1 - slow1.gone)).toBeLessThanOrEqual(2);
    // A 0.3 Pa film never does: the soaked bond withstands 0.35 Pa.
    const weak = laidDown('adhesive', 0.278, flat);
    const kept = run(weak.soil, forcing(weak.state, water, { filmShear: 0.3, dt: 1 }), 1200);
    expect(kept[kept.length - 1]).toBe(1);
    // A jet of 200 Pa for 1 % of the time breaks it at 0.471 of the soak; the deposit then
    // leaves in proportion to the stress-time: the band from 100 Pa to the peak, 150 Pa.
    const jet = laidDown('adhesive', 0.278, flat);
    const hit = run(
      jet.soil,
      forcing(jet.state, water, { filmShear: 0.3, jetDuty: 0.01, jetShear: 200, dt: 1, period: 1 }),
      400,
    );
    const jetNeed = Math.log(c.adhesionTau0 / (c.Cad * 200)) / (c.adhesionB * c.betaMax);
    expect(jetNeed).toBeCloseTo(0.471, 2);
    const jet1 = expected((s) => (s < 200 ? c.jetDetach * 0.01 * excess(150, s) : 0));
    const jetStart = hit.findIndex((x) => x < 1);
    expect(Math.abs(jetStart + 1 - jet1.start)).toBeLessThanOrEqual(1);
    expect(Math.abs(hit.findIndex((x) => x === 0) + 1 - jet1.gone)).toBeLessThanOrEqual(2);
    expect(jet1.gone).toBeLessThan(film1.start);
    // Twice the time under the jet takes the deposit sooner, as the same integration says:
    // the time above strength counts, not the number of revolutions.
    const twice = laidDown('adhesive', 0.278, flat);
    const hit2 = run(
      twice.soil,
      forcing(twice.state, water, { jetDuty: 0.02, jetShear: 200, dt: 1, period: 1 }),
      400,
    );
    const jet2 = expected((s) => (s < 200 ? c.jetDetach * 0.02 * excess(150, s) : 0));
    expect(Math.abs(hit2.findIndex((x) => x === 0) + 1 - jet2.gone)).toBeLessThanOrEqual(2);
    expect(jet2.gone).toBeLessThan(jet1.gone - 3);
  });

  it('removes a share of scattered deposits that rises smoothly as the bond strength falls', () => {
    // With the registered scatter of the bond strength, a 1 Pa film on soaked ketchup removes
    // the share of deposits whose strength lies below it: log-normal about the mean, so a
    // factor of two in tau_a0 moves the share by tens of per cent, not from none to all.
    const water: SoilChemistry = { ...NO_CHEMISTRY, temperature: 50 };
    const share = (tau0: number): number => {
      const p = createParamSet(registry, {
        ...FLAT,
        'soil.adhesionCv': 0.5,
        'soil.adhesionTau0': tau0,
      });
      const many = laidDown('adhesive', 0.278, p, {}, slabScene('glaze', 2e-3));
      const left = run(many.soil, forcing(many.state, water, { filmShear: 1, dt: 5 }), 3600);
      return 1 - (left[left.length - 1] as number);
    };
    const c = resolveSoilConstants(flat);
    // Soaked strength at tau_a0: tau_a0 exp(-b beta_max) / C_ad; removed where x < 1 / mean.
    const sigma = Math.sqrt(Math.log(1 + 0.25));
    const phi = (z: number): number => 0.5 * (1 + erf(z / Math.SQRT2));
    const predicted = (tau0: number): number => {
      const mean = (tau0 * Math.exp(-c.adhesionB * c.betaMax)) / c.Cad;
      return phi((Math.log(1 / mean) + 0.5 * sigma * sigma) / sigma);
    };
    const shares = [8.11e5, 1.6e6, 2.4e6, 3.2e6, 6.4e6].map(share);
    const predictions = [8.11e5, 1.6e6, 2.4e6, 3.2e6, 6.4e6].map(predicted);
    for (let i = 0; i < shares.length; i++) {
      expect(Math.abs((shares[i] as number) - (predictions[i] as number))).toBeLessThan(0.08);
      if (i > 0) expect(shares[i] as number).toBeLessThanOrEqual(shares[i - 1] as number);
    }
    // Neither all nor nothing over a factor of two about the film's shear.
    expect(shares[2]).toBeGreaterThan(0.1);
    expect(shares[2]).toBeLessThan(0.9);
  });

  it('weakens the bond of a ketchup-type soil in warm liquor: a tenth at 50 C of what it is at 25 C', () => {
    // soils 2.4 (tomato paste: "90 % lower after raising hydration temperature from 25 to
    // 50 C"): log-linear between the two temperatures, constant outside them.
    const warm = createParamSet(registry, { ...PLAIN, 'soil.loadCv': 0, 'soil.adhesionCv': 0 });
    const c = resolveSoilConstants(warm);
    expect(adhesionTemperatureFactor(c, 20)).toBe(1);
    expect(adhesionTemperatureFactor(c, 25)).toBe(1);
    expect(adhesionTemperatureFactor(c, 37.5)).toBeCloseTo(Math.sqrt(0.1), 12);
    expect(adhesionTemperatureFactor(c, 50)).toBeCloseTo(0.1, 12);
    expect(adhesionTemperatureFactor(c, 65)).toBeCloseTo(0.1, 12);
    // The soaked bond withstands 0.35 Pa cold: a film of 0.3 Pa leaves it in cold water for
    // ever and takes it in liquor at 50 C, where it withstands 0.035 Pa.
    const left = (temperature: number): number => {
      const one = laidDown('adhesive', 0.278, warm);
      const chem: SoilChemistry = { ...NO_CHEMISTRY, temperature };
      const series = run(one.soil, forcing(one.state, chem, { filmShear: 0.3, dt: 1 }), 3600);
      return series[series.length - 1] as number;
    };
    expect(left(20)).toBe(1);
    expect(left(50)).toBe(0);
    // With the registered scatter of the bond (cv 0.5), a 0.8 Pa film at 50 C leaves no
    // deposit behind (the strongest would have to be 23 times the mean); cold, it leaves
    // those more than 2.3 times the mean: about a fiftieth.
    const scattered = (temperature: number): number => {
      const p = createParamSet(registry, { ...PLAIN, 'soil.loadCv': 0 });
      const many = laidDown('adhesive', 0.278, p, {}, slabScene('glaze', 2e-3));
      const chem: SoilChemistry = { ...NO_CHEMISTRY, temperature };
      const series = run(many.soil, forcing(many.state, chem, { filmShear: 0.8, dt: 5 }), 7200);
      return series[series.length - 1] as number;
    };
    expect(scattered(50)).toBe(0);
    const cold = scattered(20);
    expect(cold).toBeGreaterThan(0.005);
    expect(cold).toBeLessThan(0.06);
  });

  it('never removes more with the spray off than with it on', () => {
    // A deposit on a block the spray wets for 14 % of the time (drops on a plastic), then the
    // same deposit inside the hold time of the film that spray left: the residual film covers
    // what the spray wetted and no more.
    const chem: SoilChemistry = { ...NO_CHEMISTRY, temperature: 50 };
    const on = laidDown('soluble', 0.07, flat);
    const sprayed = run(on.soil, forcing(on.state, chem, { wet: 0.14, dt: 1.5 }), 1.5);
    const off = laidDown('soluble', 0.07, flat);
    const f = forcing(off.state, chem, { wet: 0, wetHeld: 0.14, dt: 1.5 });
    f.wetUntil.fill(1000);
    const held = run(off.soil, f, 1.5);
    expect(1 - (sprayed[0] as number)).toBeGreaterThan(0);
    expect(1 - (held[0] as number)).toBeLessThanOrEqual((1 - (sprayed[0] as number)) * (1 + 1e-12));
    expect(1 - (held[0] as number)).toBeCloseTo(1 - (sprayed[0] as number), 12);
  });

  it('lets a film that nothing renews take up no more than its capacity, while the soil soaks on', () => {
    // An egg-yolk tile of 137 g/m2 wet only by the film a spray left, for 50 minutes. Without a
    // limit (the first build) the film removes soil at the rate of the spray: over a third of
    // the tile. With 2 g/m2 of capacity (a 100 um film that can hold 20 g/L) it removes 2 g/m2
    // and stops; the lag goes on being paid either way.
    const chem: SoilChemistry = { ...NO_CHEMISTRY, temperature: 55, pH: 10.5, protease: 0.06 };
    const held = (capacity: number | undefined): { state: SoilState } => {
      const tile = laidDown('egg_yolk', 0.137, flat);
      const f = forcing(tile.state, chem, { wet: 0, wetHeld: 1, dt: 2 });
      f.wetUntil.fill(1e9);
      const limited: SoilForcing =
        capacity === undefined
          ? f
          : { ...f, heldCapacity: new Float64Array(tile.state.count).fill(capacity) };
      for (let t = 0; t < 3000; t += 2) tile.soil.step({ ...limited, time: t });
      return tile;
    };
    const removed = (x: { state: SoilState }): number =>
      (x.state.mass0[0] as number) - (x.state.mass[0] as number);
    const free = held(undefined);
    const capped = held(0.002);
    expect(removed(free)).toBeGreaterThan(0.045);
    expect(removed(capped)).toBeCloseTo(0.002, 9);
    expect(capped.state.hydration[0]).toBe(free.state.hydration[0]);
    // Under the spray itself the capacity is not read.
    const sprayed = laidDown('egg_yolk', 0.137, flat);
    const on: SoilForcing = {
      ...forcing(sprayed.state, chem, { wet: 1, dt: 2 }),
      heldCapacity: new Float64Array(sprayed.state.count),
    };
    for (let t = 0; t < 3000; t += 2) sprayed.soil.step({ ...on, time: t });
    expect(removed(sprayed)).toBeCloseTo(removed(free), 9);
  });

  it('slows every chemical rate, not the soak, where the water on a block is not renewed', () => {
    const chem: SoilChemistry = { ...NO_CHEMISTRY, temperature: 55, pH: 10.5, protease: 0.06 };
    const flowing = laidDown('egg_yolk', 0.137, flat);
    const standing = laidDown('egg_yolk', 0.137, flat);
    run(flowing.soil, forcing(flowing.state, chem, { supply: 1, dt: 2 }), 1500);
    run(standing.soil, forcing(standing.state, chem, { supply: 0.25, dt: 2 }), 1500);
    // The lag is the same (the soil soaks in standing water) ...
    expect(standing.state.hydration[0]).toBe(flowing.state.hydration[0]);
    // ... and what has been removed since is a quarter.
    const removed = (x: { state: SoilState }): number =>
      1 - (x.state.mass[0] as number) / (x.state.mass0[0] as number);
    expect(removed(flowing)).toBeGreaterThan(0.1);
    expect(removed(standing) / removed(flowing)).toBeCloseTo(0.25, 2);
  });

  it('leaves solid fat alone and emulsifies it once the surface is above its melting range', () => {
    const c = resolveSoilConstants(flat);
    const cold = laidDown('fat', 0.01, flat);
    const stay = run(
      cold.soil,
      forcing(cold.state, { ...NO_CHEMISTRY, temperature: 20, surfactant: 0.1 }, { filmShear: 1 }),
      1800,
    );
    expect(stay[stay.length - 1]).toBe(1);
    // At 50 C with 0.1 g/L of surfactant on a glazed surface:
    // k = k_em (s0 + (1 - s0) C / (C + C_half)) = 0.01 x (0.1 + 0.9 x 0.1 / 0.12) = 0.0085 1/s.
    const hot = laidDown('fat', 0.01, flat);
    const melt = run(
      hot.soil,
      forcing(hot.state, { ...NO_CHEMISTRY, temperature: 50, surfactant: 0.1 }, { dt: 2 }),
      100,
    );
    expect(melt[melt.length - 1]).toBeCloseTo(Math.exp(-0.0085 * 100), 6);
    expect(c.fatEmulsify).toBe(0.01);
    // On a rivulet-prone plastic the fat rolls up 0.15 times as fast.
    const plastic = slabScene('pp', 12.5e-3);
    const onPlastic = laidDown('fat', 0.01, flat, {}, plastic);
    const slow = run(
      onPlastic.soil,
      forcing(onPlastic.state, { ...NO_CHEMISTRY, temperature: 50, surfactant: 0.1 }, { dt: 2 }),
      100,
    );
    expect(slow[slow.length - 1]).toBeCloseTo(Math.exp(-0.0085 * 0.15 * 100), 6);
  });

  it('lets a jet displace soft fat but not hard fat', () => {
    // tau_y = 3e5 SFC^3.5: 500 Pa for butter at 20 C, 3.5 Pa at 30 C.
    const jet = { jetDuty: 0.01, jetShear: 150, period: 1.71 };
    const hard = laidDown('fat', 0.01, flat);
    const kept = run(hard.soil, forcing(hard.state, { ...NO_CHEMISTRY, temperature: 20 }, jet), 60);
    expect(kept[kept.length - 1]).toBe(1);
    const soft = laidDown('fat', 0.01, flat);
    const gone = run(soft.soil, forcing(soft.state, { ...NO_CHEMISTRY, temperature: 30 }, jet), 60);
    expect(gone[gone.length - 1]).toBe(0);
  });

  it('dissolves a sugar film in seconds wherever it is wet', () => {
    const { state, soil } = laidDown('soluble', 0.07, flat);
    const left = run(soil, forcing(state, NO_CHEMISTRY, { dt: 1 }), 60);
    // 1e-2 kg/(m2 s) at 50 C is 4.7e-3 at 20 C (20 kJ/mol): 70 g/m2 in 15 s.
    const done = left.findIndex((x) => x === 0) + 1;
    expect(done).toBeGreaterThanOrEqual(14);
    expect(done).toBeLessThanOrEqual(16);
  });

  it('bleaches tea as chemistry 3.4 checks: 70 % in 25 min at 45 C, over 99 % in 30 min at 65 C', () => {
    const noLag = createParamSet(registry, { ...PLAIN, 'soil.loadCv': 0, 'soil.tea.tLag': 0 });
    const warm = laidDown('tea', 0.0005, noLag);
    const a = run(
      warm.soil,
      forcing(warm.state, { ...NO_CHEMISTRY, temperature: 45, peracid: 0.33 }, { dt: 2 }),
      25 * 60,
    );
    expect(1 - (a[a.length - 1] as number)).toBeCloseTo(0.7, 1);
    const hot = laidDown('tea', 0.0005, noLag);
    const b = run(
      hot.soil,
      forcing(hot.state, { ...NO_CHEMISTRY, temperature: 65, peracid: 0.33 }, { dt: 2 }),
      30 * 60,
    );
    expect(1 - (b[b.length - 1] as number)).toBeGreaterThan(0.99);
    // Without the chelant term: 33 % and 84 %.
    const hard = createParamSet(registry, {
      'soil.loadCv': 0,
      'soil.tea.tLag': 0,
      'soil.bleachChelant': 0,
    });
    const plain = laidDown('tea', 0.0005, hard);
    const p = run(
      plain.soil,
      forcing(plain.state, { ...NO_CHEMISTRY, temperature: 45, peracid: 0.33 }, { dt: 2 }),
      25 * 60,
    );
    expect(1 - (p[p.length - 1] as number)).toBeCloseTo(0.33, 2);
    // No bleach, no bleaching.
    const none = laidDown('tea', 0.0005, noLag);
    const n = run(
      none.soil,
      forcing(none.state, { ...NO_CHEMISTRY, temperature: 65 }, { dt: 2 }),
      30 * 60,
    );
    expect(n[n.length - 1]).toBe(1);
  });
});

describe('wetness and bookkeeping', () => {
  const flat = createParamSet(registry, FLAT);
  const chem: SoilChemistry = { ...NO_CHEMISTRY, temperature: 55, pH: 10.5, protease: 0.06 };

  it('counts a draining film as wet until it has gone', () => {
    // Wet by a residual film until t = 600 s only: the lag (498 s at 55 C) is paid, removal has
    // just begun when the film goes, and nothing happens afterwards.
    const { state, soil } = laidDown('egg_yolk', 0.137, flat);
    const f = forcing(state, chem, { wet: 0, dt: 2 });
    f.wetUntil.fill(601);
    const left = run(soil, f, 1800);
    expect(state.hydration[0]).toBeGreaterThan(1);
    expect(state.hydration[0]).toBeLessThan(1.5);
    const at600 = left[300] as number;
    expect(at600).toBeLessThan(1);
    expect(left[left.length - 1]).toBe(at600);
    // The last tick of the film is half wet: hydration advanced by half a tick's worth.
    const lagRate = 1.5 / (state.hydration[0] as number);
    expect(lagRate).toBeGreaterThan(1);
  });

  it("gives a cell under a pool the pool's liquor, all the time, without jets", () => {
    const { state, soil } = laidDown('egg_yolk', 0.137, flat);
    const f = forcing(state, NO_CHEMISTRY, { wet: 0, jetDuty: 0.02, jetShear: 100 });
    f.liquor.fill(1);
    const pooled: SoilForcing = { ...f, chemistry: [NO_CHEMISTRY, chem] };
    const initial = soil.totalMass();
    let toSump = 0;
    let toPool = 0;
    for (let t = 0; t < 3600; t += pooled.dt) {
      const removed = soil.step({ ...pooled, time: t });
      toSump += removed[0] as number;
      toPool += removed[1] as number;
    }
    // Removed at the pool's chemistry, credited to the pool, and the ledger closes.
    expect(toSump).toBe(0);
    expect(toPool).toBeGreaterThan(0.5 * initial);
    expect((initial - soil.totalMass()) / toPool).toBeCloseTo(1, 12);
    // No jet assistance under water: the same as a film without jets.
    const film = laidDown('egg_yolk', 0.137, flat);
    run(film.soil, forcing(film.state, chem), 3600);
    expect(soil.totalMass() / film.soil.totalMass()).toBeCloseTo(1, 9);
  });

  it('is the same on a repeat', () => {
    const once = (): number[] => {
      const { state, soil } = laidDown('egg_yolk', 0.137, defaults);
      run(soil, forcing(state, chem, { jetDuty: 0.01, jetShear: 50 }), 1200);
      return [...state.mass, ...state.hydration];
    };
    expect(once()).toEqual(once());
  });
});

describe('the spread of the loading inside a deposit (soils 7.5, 7.7; standards 10.2)', () => {
  const chem: SoilChemistry = { ...NO_CHEMISTRY, temperature: 55, pH: 10.5, protease: 0.06 };
  const lumped = createParamSet(registry, FLAT);
  const spreadSet = createParamSet(registry, { ...FLAT, 'soil.subCellCv': 0.3 });
  const sigma = sigmaOfCv(0.3);
  const loading = 0.137;
  const at = (left: number[], fraction: number): number =>
    left.findIndex((x) => x < fraction) * 1.71;

  it('is off at a spread of 0: a deposit is the lumped element of the first build', () => {
    const { state, soil } = laidDown('egg_yolk', loading, lumped);
    run(soil, forcing(state, chem), 3600);
    expect(soilVisibility(defaults).share).toBeUndefined();
    expect([...state.eroded].every((r) => r === 0)).toBe(true);
  });

  it('keeps the constant stage of the in-machine tile and leaves it near 70 % removed', () => {
    const a = laidDown('egg_yolk', loading, lumped);
    const b = laidDown('egg_yolk', loading, spreadSet);
    const f = { jetDuty: 0.0159, jetShear: 60 };
    const leftLumped = run(a.soil, forcing(a.state, chem, f), 4 * 3600);
    const leftSpread = run(b.soil, forcing(b.state, chem, f), 4 * 3600);
    // The same rate between 10 % and 30 % removed, to 3 %: every place is still covered.
    const steadyLumped = at(leftLumped, 0.7) - at(leftLumped, 0.9);
    const steadySpread = at(leftSpread, 0.7) - at(leftSpread, 0.9);
    expect(steadySpread / steadyLumped).toBeGreaterThan(0.97);
    expect(steadySpread / steadyLumped).toBeLessThan(1.04);
    // soils 6.1: 1.75 % per minute in the constant stage.
    expect(Math.abs((0.2 * 100 * 60) / steadySpread - 1.75)).toBeLessThan(0.35);
    // The decay stage: between 80 % and 90 % removed the rate is under two thirds of that.
    const tail = (at(leftSpread, 0.1) - at(leftSpread, 0.2)) / 0.1;
    expect(tail / (steadySpread / 0.2)).toBeGreaterThan(1.5);
    // "Complete at about 65 min": 95 % gone between 50 and 110 minutes.
    expect(at(leftSpread, 0.05) / 60).toBeGreaterThan(50);
    expect(at(leftSpread, 0.05) / 60).toBeLessThan(110);
  });

  it('holds the mass at m_0 G(R / m_0) and closes the ledger', () => {
    const { state, soil } = laidDown('egg_yolk', loading, spreadSet);
    const f = forcing(state, chem);
    const initial = soil.totalMass();
    let removed = 0;
    for (let t = 0; t < 2 * 3600; t += f.dt) removed += soil.step({ ...f, time: t })[0] as number;
    const depth = (state.eroded[0] as number) / (state.mass0[0] as number);
    expect(depth).toBeGreaterThan(1);
    expect((state.mass[0] as number) / (state.mass0[0] as number)).toBeCloseTo(
      excessAbove(depth, sigma),
      5,
    );
    expect((initial - soil.totalMass()) / removed).toBeCloseTo(1, 10);
    // Taken far enough, the deposit is bare: exactly nothing, not a film that thins for ever.
    for (let t = 0; t < 6 * 3600; t += f.dt) soil.step({ ...f, time: 7200 + t });
    expect(soil.totalMass()).toBe(0);
  });

  it('ends mostly gone with a little left, where the lumped element is thinned evenly', () => {
    // Both soils after the time in which the reference flux takes 1.8 times the mean loading.
    const seconds = (1.8 * loading) / 3.3e-5;
    const a = laidDown('egg_yolk', loading, lumped);
    const b = laidDown('egg_yolk', loading, spreadSet);
    run(a.soil, forcing(a.state, chem), seconds);
    run(b.soil, forcing(b.state, chem), seconds);
    const k = SOIL_MODEL_CLASSES.indexOf('egg_yolk');
    const threshold = soilVisibility(spreadSet).mass[k] as number;
    // Lumped: a few per cent of the loading everywhere, ten times the visibility threshold:
    // the whole deposit reads as visibly soiled.
    const lumpedLeft = a.state.mass[0] as number;
    expect(lumpedLeft / loading).toBeGreaterThan(0.005);
    expect(lumpedLeft).toBeGreaterThan(3 * threshold);
    expect(soilVisibility(lumped).share).toBeUndefined();
    // With the spread: about as much mass, on the thickest few per cent of the area.
    const share = soilVisibility(spreadSet).share;
    expect(share).toBeDefined();
    const visible = (share as NonNullable<typeof share>)(
      k,
      b.state.mass0[0] as number,
      b.state.mass[0] as number,
      threshold,
    );
    const depth = (b.state.eroded[0] as number) / (b.state.mass0[0] as number);
    expect(depth).toBeGreaterThan(1.5);
    expect(visible).toBeCloseTo(shareAbove(depth + threshold / loading, sigma), 4);
    expect(visible).toBeGreaterThan(0);
    expect(visible).toBeLessThan(0.05);
  });

  it('takes a sugar film off the same way, to exactly nothing', () => {
    const { state, soil } = laidDown('soluble', 0.05, spreadSet);
    const left = run(soil, forcing(state, { ...NO_CHEMISTRY, temperature: 40 }), 120);
    expect(left[left.length - 1]).toBe(0);
    expect(state.eroded[0]).toBeGreaterThan(0.05);
  });
});

describe('the amount applied (standards 13.5)', () => {
  it('scatters about the stated amount from seed to seed by the registered coefficient of variation', () => {
    const lookup = (): { modelClass: SoilModelClass; solidsFraction: number } => ({
      modelClass: 'egg_yolk',
      solidsFraction: 0.5,
    });
    const scattered = createParamSet(registry, { ...PLAIN, 'soil.amountCv': 0.05 });
    const massAt = (params: ParamSet, seed: number): number =>
      initSoil(scene, [{ itemId: 'tile', soils: [record('egg')] }], lookup, params, seed).records[0]
        ?.dryMass ?? 0;
    // By default exactly the stated amount: 1 g at 50 % solids.
    expect(massAt(defaults, 3)).toBeCloseTo(0.0005, 15);
    const ratios = Array.from({ length: 400 }, (_unused, seed) => massAt(scattered, seed) / 0.0005);
    const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    const sd = Math.sqrt(ratios.reduce((a, b) => a + (b - mean) * (b - mean), 0) / ratios.length);
    // 400 draws: the mean within 3 standard errors of 1, the deviation within 15 % of 0.05.
    expect(Math.abs(mean - 1)).toBeLessThan((3 * 0.05) / 20);
    expect(sd).toBeGreaterThan(0.0425);
    expect(sd).toBeLessThan(0.0575);
    // The same seed lays down the same amount, and the deposits add up to it.
    expect(massAt(scattered, 7)).toBe(massAt(scattered, 7));
    const state = initSoil(
      scene,
      [{ itemId: 'tile', soils: [record('egg')] }],
      lookup,
      scattered,
      7,
    );
    let total = 0;
    for (let d = 0; d < state.count; d++)
      total += (state.mass0[d] as number) * (state.area[d] as number);
    expect(total / massAt(scattered, 7)).toBeCloseTo(1, 6);
  });
});

describe('the scatter of the loading on a lattice (soil.loadScale; soils 7.7)', () => {
  const lookup = (): { modelClass: SoilModelClass; solidsFraction: number } => ({
    modelClass: 'egg_yolk',
    solidsFraction: 0.5,
  });
  const soils: ItemSoilRecord[] = [
    {
      type: 'egg',
      regions: [{ region: 'top', coverage: 1 }],
      amount_g: 1,
      age_h: 0,
      heat_history: 'none',
    },
  ];
  const onLattice = createParamSet(registry, { ...PLAIN, 'soil.loadScale': 4e-3 });
  /** Mean loading over a 4 mm lattice cube of the tile frame, by cube, and its mass. */
  const byCube = (
    of: WashScene,
    params: ParamSet,
  ): { cubes: Map<string, number[]>; mass: number } => {
    const state = initSoil(of, [{ itemId: 'tile', soils }], lookup, params, 11);
    const pose = of.instances[0]?.pose;
    if (pose === undefined) throw new Error('no tile');
    const cubes = new Map<string, number[]>();
    let mass = 0;
    for (let d = 0; d < state.count; d++) {
      const c = state.cell[d] as number;
      const p = poseInverseTransformPoint(pose, [
        of.soilCells.centre[3 * c] as number,
        of.soilCells.centre[3 * c + 1] as number,
        of.soilCells.centre[3 * c + 2] as number,
      ]);
      const key = p.map((x) => Math.floor(x / 4e-3)).join(',');
      const list = cubes.get(key);
      if (list === undefined) cubes.set(key, [state.mass0[d] as number]);
      else list.push(state.mass0[d] as number);
      mass += (state.mass0[d] as number) * (state.area[d] as number);
    }
    return { cubes, mass };
  };

  it('gives every deposit inside one lattice cube the same loading, and the cubes a log-normal scatter of soil.loadCv', () => {
    const fine = byCube(slabScene('glaze', 2e-3), onLattice);
    const loadings: number[] = [];
    for (const list of fine.cubes.values()) {
      const first = list[0] as number;
      for (const m of list) expect(m / first).toBeCloseTo(1, 12);
      loadings.push(first);
    }
    // 100 mm square in 4 mm cubes: about 625 of them.
    expect(loadings.length).toBeGreaterThan(500);
    const mean = loadings.reduce((a, b) => a + b, 0) / loadings.length;
    const sd = Math.sqrt(
      loadings.reduce((a, b) => a + (b - mean) * (b - mean), 0) / loadings.length,
    );
    // Coefficient of variation 0.3 within 15 % over more than 500 cubes.
    expect(sd / mean).toBeGreaterThan(0.255);
    expect(sd / mean).toBeLessThan(0.345);
    // The record's dry mass is exact: 1 g at 50 % solids.
    expect(fine.mass).toBeCloseTo(0.0005, 12);
  });

  it('lays down the same field on soil cells of 1 mm and of 2 mm', () => {
    const fine = byCube(slabScene('glaze', 2e-3), onLattice);
    const coarse = byCube(slabScene('glaze', 4e-3), onLattice);
    let compared = 0;
    let worst = 0;
    for (const [key, list] of coarse.cubes) {
      const other = fine.cubes.get(key);
      if (other === undefined) continue;
      compared++;
      // The same multiplier; the two differ only by the normalisation to the record's mass,
      // which is over differently cut cells (under 2 %).
      worst = Math.max(worst, Math.abs((list[0] as number) / (other[0] as number) - 1));
    }
    expect(compared).toBeGreaterThan(500);
    expect(worst).toBeLessThan(0.02);
    // Per deposit (the default) the two meshes share nothing: the cube means differ by far more.
    const fineDefault = byCube(slabScene('glaze', 2e-3), defaults);
    const coarseDefault = byCube(slabScene('glaze', 4e-3), defaults);
    let differing = 0;
    for (const [key, list] of coarseDefault.cubes) {
      const other = fineDefault.cubes.get(key);
      if (other === undefined) continue;
      if (Math.abs((list[0] as number) / (other[0] as number) - 1) > 0.02) differing++;
    }
    expect(differing).toBeGreaterThan(400);
  });
});

describe('ageing before the wash (soils 5.0, 7.4, 8.3; standards 4.1)', () => {
  const chem: SoilChemistry = { ...NO_CHEMISTRY, temperature: 55, pH: 10.5, protease: 0.06 };
  const lookup = (): { modelClass: SoilModelClass; solidsFraction: number } => ({
    modelClass: 'egg_yolk',
    solidsFraction: 0.5,
  });

  it('dries a soil in the cabinet: after 2 h at 80 C it starts dry, its lag unpaid', () => {
    // 10 g of wet yolk on the 0.01 m2 tile holds 0.5 kg/m2 of water: two hours at room
    // conditions take 0.065 of it, two hours at 80 times the flux take all of it.
    const soils = [record('egg', { amount_g: 1000 * topArea, age_h: 2, heat_history: 'warm' })];
    const first = initSoil(scene, [{ itemId: 'tile', soils }], lookup, defaults, 9);
    expect(first.hydration[0]).toBeCloseTo(1.5 * (1 - (9e-6 * 7200) / 0.5), 6);
    const dried = createParamSet(registry, { ...PLAIN, 'soil.heatDryingFactor': 80 });
    const oven = initSoil(scene, [{ itemId: 'tile', soils }], lookup, dried, 9);
    expect(oven.hydration[0]).toBe(0);
    // A soil that was never heated dries at room conditions as before.
    const air = [record('egg', { amount_g: 1000 * topArea, age_h: 2 })];
    expect(initSoil(scene, [{ itemId: 'tile', soils: air }], lookup, dried, 9).hydration[0]).toBe(
      first.hydration[0],
    );
  });

  it('runs a soil aged like the reference tile at the reference rate, and a baked one more slowly', () => {
    const steady = (params: ParamSet, over: Partial<ItemSoilRecord>): number => {
      const { state, soil } = laidDown('egg_yolk', 0.137, params, over);
      const left = run(soil, forcing(state, chem), 2 * 3600);
      const i0 = left.findIndex((x) => x < 0.9);
      const i1 = left.findIndex((x) => x < 0.7);
      return 0.2 / ((i1 - i0) * 1.71);
    };
    const first = createParamSet(registry, FLAT);
    const bake = bakeIndex(defaults, record('x', { heat_history: 'warm' }));
    const referenced = createParamSet(registry, { ...FLAT, 'soil.egg_yolk.bakeReference': bake });
    const fresh = steady(first, {});
    // The first build charges the oven-dried soil 1 - 0.8 B of the tile's rate.
    expect(steady(first, { heat_history: 'warm' }) / fresh).toBeCloseTo(1 - 0.8 * bake, 2);
    // Relative to a reference of the same ageing it runs at the tile's rate, to 1 %.
    expect(steady(referenced, { heat_history: 'warm' }) / fresh).toBeCloseTo(1, 2);
    // A soil baked at 160 C is still slower, by (1 - 0.8 B) / (1 - 0.8 B_ref).
    const baked = bakeIndex(defaults, record('x', { heat_history: 'baked' }));
    expect(steady(referenced, { heat_history: 'baked' }) / fresh).toBeCloseTo(
      (1 - 0.8 * baked) / (1 - 0.8 * bake),
      2,
    );
    // The reference is that of the class: starch keeps its own.
    expect(
      resolveSoilConstants(referenced).bakeReference[SOIL_MODEL_CLASSES.indexOf('starch')],
    ).toBe(0);
  });
});

describe('the registered defaults after the third anchoring (docs/calibration/anchoring-v3.md)', () => {
  it('are the evidence-based values, each inside its range', () => {
    const expected: Readonly<Record<string, number>> = {
      // The lumped element until the anchored set states the measured 0.1 (soils 7.7).
      'soil.subCellCv': 0,
      'soil.loadScale': 0.002,
      // standards 4.1, 13.5: the cabinet dries every soil; amounts scatter by 3 to 7 %.
      'soil.heatDryingFactor': 80,
      // Exactly the amount stated unless a set says otherwise (the anchored set: 0.05).
      'soil.amountCv': 0,
      // mass balances: 20 g of soil per litre of film; fresh liquor above about 0.02 1/s.
      'soil.heldFilmCapacity': 0.02,
      'soil.supplyExchange': 0.02,
      // enzymes-at-temperature.md: the loss over time is the liquor's half-life law.
      'soil.enzymeTm': 75,
      // chemistry 8.6: 7.5 % of the nominal 0.5 g/m2 of an IKW-level stain.
      'soil.tea.visibleMass': 3.75e-5,
      'soil.tea.visibleFraction': 0,
    };
    for (const [key, value] of Object.entries(expected)) {
      expect(registered.get(key), key).toBe(value);
    }
    expect(registered.getVector('soil.applicationCv')).toEqual([0.1, 0.15, 0.3, 0.2]);
    expect(() => registered.get('soil.supplyRenewal')).toThrow();
  });

  it('lets the protease work at 65 C: the factor rises with temperature until near the mid-point', () => {
    const c = resolveSoilConstants(registered);
    const k = SOIL_MODEL_CLASSES.indexOf('egg_yolk');
    const f = (t: number): number =>
      enzymeTemperatureFactor(
        c.enzymeEa[k] as number,
        c.enzymeTm[k] as number,
        c.enzymeDH,
        c.gasConstant,
        t,
        c.refTemperature,
      );
    // enzymes-at-temperature.md 6.1: 1.15, 1.31, 1.44, 1.41 at 55, 60, 65, 70 C (0.53 at 65 C
    // with the mid-point at 63 C, which counted the loss over time twice).
    expect(f(55)).toBeCloseTo(1.15, 2);
    expect(f(60)).toBeCloseTo(1.31, 2);
    expect(f(65)).toBeCloseTo(1.44, 2);
    expect(f(70)).toBeCloseTo(1.41, 2);
    expect(f(50)).toBeCloseTo(1, 12);
  });

  it('has a tail the in-machine tile allows: complete at about 65 min, not at 150', () => {
    // The sprayed monitor tile (137 g/m2) at 55 C, pH 10.5 and 0.06 g/L under the registered
    // spread (0.1 within a deposit, 0.1 between patches for a sprayed layer).
    const sprayed = registered.with({
      'soil.amountCv': 0,
      'soil.subCellCv': 0.1,
      'soil.loadCv': registered.getVector('soil.applicationCv')[0] as number,
    });
    const { state, soil } = laidDown('egg_yolk', 0.137, sprayed, {}, scene);
    const chem: SoilChemistry = { ...NO_CHEMISTRY, temperature: 55, pH: 10.5, protease: 0.06 };
    const left = run(soil, forcing(state, chem, { jetDuty: 0.0159, jetShear: 60 }), 4 * 3600);
    const at = (fraction: number): number => (left.findIndex((x) => x < fraction) * 1.71) / 60;
    // The constant stage: 1.75 % per minute to 20 % (soils 6.1).
    const rate = (0.2 * 100) / (at(0.7) - at(0.9));
    expect(Math.abs(rate - 1.75)).toBeLessThan(0.35);
    // Hardly slower at 70 % removed, and 98 % gone within a quarter more than the time the
    // constant rate needs from 30 % left (soils 6.1: complete at about 65 min).
    const late = (0.1 * 100) / (at(0.2) - at(0.3));
    expect(late / rate).toBeGreaterThan(0.85);
    expect(at(0.02) - at(0.3)).toBeLessThan(1.6 * (30 / rate));
    expect(at(0.02)).toBeGreaterThan(50);
    expect(at(0.02)).toBeLessThan(90);
  });

  it('lets a residual film remove what it can take up and no more, and nothing without capacity', () => {
    const chem: SoilChemistry = { ...NO_CHEMISTRY, temperature: 55, pH: 10.5, protease: 0.06 };
    // The shortest lag of the range: a residual film soaks the soil, then removes.
    const flat = createParamSet(registry, { ...FLAT, 'soil.egg_yolk.tLag': 30 });
    const stepHeld = (capacity: number | undefined): number => {
      const { state, soil } = laidDown('egg_yolk', 0.05, flat);
      const base = forcing(state, chem, { wet: 0 });
      const held: SoilForcing = {
        ...base,
        wetUntil: new Float64Array(state.count).fill(1e9),
        ...(capacity === undefined
          ? {}
          : { heldCapacity: new Float64Array(state.count).fill(capacity) }),
      };
      const before = soil.totalMass();
      for (let t = 0; t < 1800; t += held.dt) soil.step({ ...held, time: t });
      return (before - soil.totalMass()) / areaOfTop(coarse);
    };
    // A film of 0.05 kg/m2 at 0.02 kg/kg takes up 1 g/m2; half an hour of the reference flux
    // would take 60.
    expect(stepHeld(1e-3)).toBeCloseTo(1e-3, 9);
    expect(stepHeld(0)).toBe(0);
    // Without a film balance (a bench calculation) the film is taken as fresh throughout.
    expect(stepHeld(undefined)).toBeGreaterThan(0.03);
  });
});
