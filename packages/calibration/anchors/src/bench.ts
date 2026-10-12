/**
 * The bench-scale anchors of the soil model, evaluated for a parameter set: what a fit to the
 * standard load must leave standing.
 *
 *  - The six in-machine egg-yolk rates of Perez-Mohedano (docs/research/soils.md section 6.1):
 *    a monitor tile of 137 g/m2 (dried; see `eggYolkRates` for its ageing) under a renewed film, struck by two jets for 1.59 %
 *    of each revolution, at fixed temperature, pH and protease level. Constant-stage rate in
 *    per cent of the tile per minute; tolerance the larger of 20 % and the published standard
 *    deviation of the triplicates.
 *  - The IKW standard test programme (soils 6.4): no pre-wash, 20 g of reference detergent in
 *    5 L, heated from 15 to 45 C and held 8 min. With these conditions the IKW soils are
 *    deliberately not fully removed: egg yolk, starch mix, baked minced meat and tea must each
 *    leave a residue (more than 2 % of the soil; a soil of which more than 98 % is left is
 *    reported as untouched).
 *
 * Both run the soil kernel and the liquor model themselves on a wetted tile; no wash, no
 * exposure. Units: SI; temperatures in degrees Celsius.
 */

import {
  buildWashScene,
  createWashLiquor,
  createWashSoil,
  initSoil,
  SOIL_APPLICATIONS,
  soilData,
  soilVisibility,
  type SoilApplication,
  type ItemSoilRecord,
  type ParamSet,
  type SceneItem,
  type SceneMaterial,
  type SoilChemistry,
  type SoilForcing,
  type SoilModelClass,
  type SoilState,
  type WashScene,
} from '@spotless/sim-core';

const GLAZE: SceneMaterial = {
  id: 'glaze',
  wettingClass: 'continuous_film',
  advancing: [0.4, 0.2, 0.2],
  receding: [0.1, 0.05, 0.05],
};

/** A 100 mm square tile whose top face is the region `top`. */
function tileScene(params: ParamSet): WashScene {
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
      regions: [
        { id: 'top', part: 'body', side: 'in' },
        { id: 'underside', part: 'body', side: 'out' },
      ],
    },
    pose: { p: [0.01, 0.02, 0.1], q: [0, 0, Math.sin(0.4), Math.cos(0.4)] },
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
  return buildWashScene({
    items: [item],
    machine: [],
    blockSize: 6.25e-3,
    materials: () => GLAZE,
    params,
  });
}

function areaOfTop(scene: WashScene): number {
  let area = 0;
  for (let b = 0; b < scene.blocks.count; b++) {
    if (scene.instances[0]?.shape.regions[scene.blocks.region[b] as number]?.id === 'top') {
      area += scene.blocks.area[b] as number;
    }
  }
  return area;
}

const scenes = new WeakMap<object, WashScene>();

/**
 * One soil of a model class laid on the tile with the given dry loading (kg/m2) and ageing.
 * `application` says how it was laid on (`soil.applicationCv`): a record that names a model
 * class and not a catalogue soil has no entry in the soil data, so the scatter of its loading
 * from patch to patch is given here; absent, it is that of a smear (`soil.loadCv`).
 */
function laidDown(
  cls: SoilModelClass,
  loading: number,
  base: ParamSet,
  ageing: Pick<ItemSoilRecord, 'age_h' | 'heat_history'>,
  application?: SoilApplication,
): { state: SoilState; step: (forcing: SoilForcing) => void; left: () => number } {
  let scene = scenes.get(base);
  if (scene === undefined) {
    scene = tileScene(base);
    scenes.set(base, scene);
  }
  const cv =
    application === undefined
      ? undefined
      : base.getVector('soil.applicationCv')[SOIL_APPLICATIONS.indexOf(application)];
  const params = cv === undefined ? base : base.with({ 'soil.loadCv': cv });
  const record: ItemSoilRecord = {
    type: cls,
    regions: [{ region: 'top', coverage: 1 }],
    amount_g: loading * areaOfTop(scene) * 1000,
    ...ageing,
  };
  const state = initSoil(
    scene,
    [{ itemId: 'tile', soils: [record] }],
    () => ({ modelClass: cls, solidsFraction: 1 }),
    params,
    5,
  );
  const soil = createWashSoil(state, scene, params);
  const initial = soil.totalMass();
  return {
    state,
    step: (forcing) => {
      soil.step(forcing);
    },
    left: () => soil.totalMass() / initial,
  };
}

/** Shear levels of the synthetic jet table, Pa. */
const JET_LEVELS = [10, 30, 100, 300] as const;

/** The exposure of the monitor tile: always under a renewed film, two jets for 1.59 % of the time at 60 Pa. */
function tileForcing(state: SoilState, chem: SoilChemistry, time: number, dt: number): SoilForcing {
  const n = state.count;
  const duty = 0.0159;
  const shear = 60;
  const above = (level: number): number => (shear > level ? duty : 0);
  return {
    time,
    dt,
    period: dt,
    wet: new Float32Array(n).fill(1),
    supply: new Float32Array(n).fill(1),
    wetUntil: new Float64Array(n),
    wetHeld: new Float32Array(n).fill(1),
    filmShear: new Float32Array(n),
    jetRow: new Int32Array(n).fill(0),
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

/** One of the six in-machine cases (soils 6.1). */
export interface EggYolkCase {
  readonly temperature: number;
  readonly pH: number;
  /** Protease prill, kg/m3. */
  readonly protease: number;
  /** Published constant-stage rate and its standard deviation, per cent of the tile per minute. */
  readonly rate: number;
  readonly sd: number;
}

/** The six cases of soils 6.1 (PM-T Tables 7.1 to 7.3). */
export const EGG_YOLK_CASES: readonly EggYolkCase[] = [
  { temperature: 30, pH: 10.5, protease: 0.06, rate: 0.85, sd: 0.12 },
  { temperature: 55, pH: 10.5, protease: 0.06, rate: 1.75, sd: 0.29 },
  { temperature: 55, pH: 10.5, protease: 0.02, rate: 0.17, sd: 0.05 },
  { temperature: 55, pH: 10.5, protease: 0.1, rate: 2.59, sd: 0.22 },
  { temperature: 55, pH: 9.5, protease: 0.06, rate: 0.69, sd: 0.16 },
  { temperature: 55, pH: 11.5, protease: 0.06, rate: 4.66, sd: 0.38 },
];

/** A case with what the model gives for it. */
export interface EggYolkResult extends EggYolkCase {
  /** Simulated constant-stage rate (between 10 % and 30 % removed), per cent per minute. */
  readonly simulated: number;
  /** Tolerance: the larger of 20 % of the published rate and its standard deviation. */
  readonly tolerance: number;
  readonly within: boolean;
  /** (simulated - published) over half the tolerance: the tolerance read as two standard deviations. */
  readonly z: number;
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

/** How the monitor tile of the in-machine study is taken to have been aged. */
export type TileAgeing = 'dried' | 'heat-aged';

/**
 * The six in-machine egg-yolk rates under a parameter set.
 *
 * `tile` says how the monitor tile (CFT DM-22) is aged in the simulation. The dossiers
 * describe a sprayed, dried tile (soils 2.2, 6.1; "egg yolk, dried" in soils 8.3, apart from
 * "baked"): `dried`, the default, gives it no bake index. `heat-aged` is the first
 * anchoring's assumption that it was aged like an IEC soil (2 h at 80 C, bake index 0.2),
 * which no dossier states; it belongs with `soil.egg_yolk.bakeReference` = 0.2.
 */
export function eggYolkRates(params: ParamSet, tile: TileAgeing = 'dried'): EggYolkResult[] {
  return EGG_YOLK_CASES.map((c) => {
    const laid = laidDown(
      'egg_yolk',
      0.137,
      params,
      tile === 'heat-aged'
        ? { age_h: 3, heat_history: 'warm' }
        : { age_h: 0, heat_history: 'none' },
      // CFT DM-22: a sprayed tile.
      'sprayed',
    );
    const chem: SoilChemistry = {
      ...NO_CHEMISTRY,
      temperature: c.temperature,
      pH: c.pH,
      protease: c.protease,
    };
    const dt = 1.71;
    let t10 = Number.NaN;
    let t30 = Number.NaN;
    for (let t = 0; t < 24 * 3600 && Number.isNaN(t30); t += dt) {
      laid.step(tileForcing(laid.state, chem, t, dt));
      const left = laid.left();
      if (Number.isNaN(t10) && left < 0.9) t10 = t + dt;
      if (left < 0.7) t30 = t + dt;
    }
    const simulated = Number.isNaN(t30) ? 0 : (0.2 * 100 * 60) / (t30 - t10);
    const tolerance = Math.max(0.2 * c.rate, c.sd);
    return {
      ...c,
      simulated,
      tolerance,
      within: Math.abs(simulated - c.rate) <= tolerance,
      z: (simulated - c.rate) / (0.5 * tolerance),
    };
  });
}

/** What the IKW programme leaves of one IKW soil. */
export interface IkwResult {
  readonly soil: string;
  /** Dry loading, kg/m2, and the model class and heat history it was given. */
  readonly loading: number;
  readonly modelClass: SoilModelClass;
  readonly age_h: number;
  readonly heat_history: ItemSoilRecord['heat_history'];
  /** Share of the dry mass left at the end of the main wash. */
  readonly left: number;
  /** True when the programme leaves a residue: more than 2 % of the soil. */
  readonly residue: boolean;
  /** True when it hardly touches the soil: more than 98 % left. */
  readonly untouched: boolean;
}

/** The IKW soils that the standard programme must not clean (soils 5.0, 6.4; standards 4.3, 4.4). */
const IKW_SOILS: readonly {
  soil: string;
  loading: number;
  modelClass: SoilModelClass;
  age_h: number;
  heat_history: ItemSoilRecord['heat_history'];
  application: SoilApplication;
}[] = [
  // 750 mg dry on 140 cm2, dried 4 to 24 h, dipped in boiling water and dried 30 min at 80 C.
  {
    soil: 'egg yolk',
    loading: 0.054,
    modelClass: 'egg_yolk',
    age_h: 12,
    heat_history: 'warm',
    application: 'brushed',
  },
  // 3.75 mg/cm2 of starch mix, 48 h in air then 4 h at 80 C.
  {
    soil: 'starch mix',
    loading: 0.0375,
    modelClass: 'starch',
    age_h: 48,
    heat_history: 'warm',
    application: 'sprayed',
  },
  // 11.8 mg/cm2 wet at 21 % solids, 2 h at 130 C.
  {
    soil: 'minced meat',
    loading: 0.025,
    modelClass: 'egg_yolk',
    age_h: 2,
    heat_history: 'baked',
    application: 'spread',
  },
  // The IKW-level tea film, nominally 0.5 g/m2, stored 3 days.
  {
    soil: 'tea',
    loading: 0.0005,
    modelClass: 'tea',
    age_h: 72,
    heat_history: 'warm',
    application: 'film',
  },
];

/** The IKW standard test programme as the liquor sees it. */
export const IKW_PROGRAMME = {
  /** Liquor in circulation, m3, and detergent dosed at the start, kg (soils 6.4; chemistry 1.2, 1.3). */
  volume: 5e-3,
  dose: 0.02,
  /** Inlet and target temperature, C, heating rate, K/s (1.9 kW into 46.7 kJ/K, chemistry 10.12), and hold, s. */
  inlet: 15,
  target: 45,
  heating: 1900 / 46700,
  hold: 480,
} as const;

/** What the IKW standard programme leaves of the IKW soils on a wetted tile, under a parameter set. */
export function ikwResidues(params: ParamSet): IkwResult[] {
  const p = IKW_PROGRAMME;
  const heatTime = (p.target - p.inlet) / p.heating;
  const end = heatTime + p.hold;
  const dt = 1.71;
  return IKW_SOILS.map((spec) => {
    const tile = laidDown(
      spec.modelClass,
      spec.loading,
      params,
      { age_h: spec.age_h, heat_history: spec.heat_history },
      spec.application,
    );
    const liquor = createWashLiquor(params);
    liquor.apply({ kind: 'fill', volume: p.volume });
    liquor.apply({ kind: 'detergent', mass: p.dose });
    for (let t = 0; t < end; t += dt) {
      const temperature = Math.min(p.target, p.inlet + p.heating * (t + 0.5 * dt));
      const sample = liquor.step(t + dt, dt, p.volume, temperature, true);
      tile.step(tileForcing(tile.state, sample, t, dt));
    }
    const left = tile.left();
    return { ...spec, left, residue: left > 0.02, untouched: left > 0.98 };
  });
}

/**
 * What a place in the load gives a deposit while a bath circulates: the share of the time
 * there is water on it, the exchange of that water (1/s, the inverse of its age), the shear of
 * the film (Pa) and the share of the time a jet film above `jetShear` (Pa) is on it.
 */
export interface PlacedExposure {
  readonly wet: number;
  readonly exchange: number;
  readonly filmShear: number;
  readonly jetDuty: number;
  readonly jetShear: number;
}

/**
 * Two places, from the exposure of the settled standard loads on the water side of the third
 * anchoring (`scripts/diagnose.ts`): the median of an open plate face of the careful load
 * (wet all the time, water 3 to 4 s old, a 0.6 Pa film, a jet film above 10 Pa for 0.3 % of
 * the time), and a face in a nest or a shadow (wet a quarter of the time by water half a
 * minute old, hardly any shear, no jet). They are reference places for a table, not poses.
 */
export const WELL_PLACED: PlacedExposure = {
  wet: 1,
  exchange: 0.27,
  filmShear: 0.6,
  jetDuty: 0.003,
  jetShear: 30,
};
export const BADLY_PLACED: PlacedExposure = {
  wet: 0.25,
  exchange: 0.03,
  filmShear: 0.05,
  jetDuty: 0,
  jetShear: 0,
};

/** The liquor of a wash, tick by tick (the liquor table of a `WashResult`). */
export interface LiquorCourse {
  readonly fields: readonly string[];
  readonly tickTime_s: readonly number[];
  readonly values: readonly number[];
}

/** What a course of liquor leaves of one catalogue soil at one place. */
export interface PlacedResult {
  readonly soil: string;
  readonly modelClass: string;
  /** Dry loading laid down, mg/cm2. */
  readonly loading_mg_cm2: number;
  /** Share of the dry mass left, and share of the soiled area still visibly soiled. */
  readonly left: number;
  readonly visibleShare: number;
}

/**
 * One catalogue soil at its working loading and usual ageing (`SOIL_DATA`) on the bench tile,
 * through the liquor of a wash at a place: no scene, no exposure, no residual films between
 * baths (a place is wet while a bath of more than 2 L is in the machine). `visibleShare` is the
 * area-weighted share of the deposits above the visibility threshold of the soil's class.
 */
export function soilAtPlace(
  base: ParamSet,
  soilId: string,
  place: PlacedExposure,
  course: LiquorCourse,
): PlacedResult {
  const datum = soilData(soilId);
  if (datum === undefined) throw new RangeError(`soilAtPlace: no soil data for ${soilId}`);
  let scene = scenes.get(base);
  if (scene === undefined) {
    scene = tileScene(base);
    scenes.set(base, scene);
  }
  const area = areaOfTop(scene);
  const record: ItemSoilRecord = {
    type: soilId,
    regions: [{ region: 'top', coverage: 1 }],
    amount_g: datum.loading * area,
    age_h: datum.ageH,
    heat_history: datum.heatHistory,
  };
  const state = initSoil(
    scene,
    [{ itemId: 'tile', soils: [record] }],
    () => ({ modelClass: datum.modelClass, solidsFraction: datum.solidsFraction }),
    base,
    5,
  );
  const soil = createWashSoil(state, scene, base);
  const initial = soil.totalMass();
  const n = state.count;
  const half = base.get('soil.supplyExchange');
  const supply = place.exchange > 0 ? place.exchange / (place.exchange + half) : 0;
  const above = (level: number): number => (place.jetShear > level ? place.jetDuty : 0);
  const col = (name: string): number => course.fields.indexOf(name);
  const stride = course.fields.length;
  const at = (t: number, name: string): number => course.values[stride * t + col(name)] as number;
  const wetOn = new Float32Array(n).fill(place.wet);
  const dry = new Float32Array(n);
  const supplied = new Float32Array(n).fill(supply);
  const shear = new Float32Array(n).fill(place.filmShear);
  const none = new Float64Array(n);
  const jetRow = new Int32Array(n).fill(place.jetDuty > 0 ? 0 : -1);
  const jetValues = Float32Array.of(
    place.jetDuty,
    above(JET_LEVELS[0]),
    above(JET_LEVELS[1]),
    above(JET_LEVELS[2]),
    above(JET_LEVELS[3]),
    place.jetShear,
  );
  for (let t = 0; t + 1 < course.tickTime_s.length; t++) {
    const time = course.tickTime_s[t] as number;
    const dt = (course.tickTime_s[t + 1] as number) - time;
    if (!(dt > 0)) continue;
    // literal-ok-begin: a bath of more than 2 litres circulates (m3)
    const circulating = at(t, 'volume') > 2e-3;
    // literal-ok-end
    const chem: SoilChemistry = {
      temperature: at(t, 'temperature'),
      pH: at(t, 'pH'),
      protease: at(t, 'protease'),
      amylase: at(t, 'amylase'),
      peracid: at(t, 'peracid'),
      perhydroxyl: at(t, 'perhydroxyl'),
      surfactant: at(t, 'surfactant'),
    };
    soil.step({
      time,
      dt,
      period: circulating ? dt : 0,
      wet: circulating ? wetOn : dry,
      supply: supplied,
      wetUntil: none,
      wetHeld: dry,
      filmShear: shear,
      jetRow,
      jetValues,
      jetColumns: { stride: 6, wetDuty: 0, duty: 1, level1: 2, level2: 3, level3: 4, shearPeak: 5 },
      jetShearLevels: JET_LEVELS,
      jetShearScale: 1,
      liquor: new Uint16Array(n),
      chemistry: [chem],
    });
  }
  const visibility = soilVisibility(base);
  const classCode = state.classCode[0] as number;
  const threshold = visibility.mass[classCode] as number;
  let visible = 0;
  let total = 0;
  for (let d = 0; d < n; d++) {
    const a = state.area[d] as number;
    total += a;
    const m0 = state.mass0[d] as number;
    const m = state.mass[d] as number;
    visible +=
      a *
      (visibility.share === undefined
        ? m >= threshold
          ? 1
          : 0
        : visibility.share(classCode, m0, m, threshold));
  }
  return {
    soil: soilId,
    modelClass: datum.modelClass,
    loading_mg_cm2: (initial / area) * 100,
    left: initial > 0 ? soil.totalMass() / initial : 0,
    visibleShare: total > 0 ? visible / total : 0,
  };
}
