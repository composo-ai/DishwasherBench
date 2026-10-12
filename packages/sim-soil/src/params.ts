/**
 * The soil classes of the first build and their registered parameters (docs/design/scope.md,
 * "Soil response" and "Calibration is a first-class feature"; docs/research/soils.md sections
 * 7, 8 and R3; docs/research/chemistry.md sections 3.4, 4.2 and 10.6; docs/design/sim-core.md
 * section M8).
 *
 * Six removal laws' worth of model classes, each with the law that the dossier's evidence
 * supports for it:
 *
 * | class      | soil it stands for                     | law        |
 * |------------|----------------------------------------|------------|
 * | `egg_yolk` | dried egg yolk and other protein films | `reaction` (protease, alkali above pH 10.5) |
 * | `starch`   | cooked, dried starch films             | `reaction` (amylase) |
 * | `adhesive` | dried ketchup-like sauces              | `detach` (soak, then failure at the wall) |
 * | `fat`      | butter-like fats                       | `melt` (liquid above its melting range, then emulsified) |
 * | `soluble`  | sugars, fresh drinks                   | `dissolve` |
 * | `tea`      | tea stain                              | `bleach` (peracid) |
 *
 * and seven classes split from those for what a class of the first build could not tell apart
 * ({@link SOIL_CLASS_PARENT}): how a residue LOOKS (standards 10.3: `milk`, a protein film
 * that is translucent where egg yolk is strongly coloured; `coloured_starch`, a starch-bound
 * soil that is strongly coloured, spinach among them; `soluble_coloured`) and how a fat MELTS
 * (chemistry 4.2: `fat_margarine`, `fat_lard`, `fat_tallow`, `fat_oil`). A split class has the
 * law of its parent and, where no value of its own is registered, the parent's values.
 *
 * A parameter `soil.<name>` is the default of every class; `soil.<class>.<name>` overrides it
 * for one class (the registry's per-class soil keys). The class of a parameter set is the
 * model class above, not a catalogue soil id: every catalogue soil is mapped to one of them,
 * by its soil id where `soil-data.ts` knows it and by its mechanism class otherwise
 * ({@link SOIL_CLASS_OF_MECHANISM}).
 *
 * All keys are under `soil.*`, in the `soil` hash group: changing one reuses cached exposure.
 * Units: SI; temperatures in degrees Celsius; activation energies in J/mol; mass per area in
 * kg/m2 (1 mg/cm2 = 0.01 kg/m2).
 */

import type { AnyParamDef, ParamDef, ParamSet, ParamTag } from '@spotless/sim-params';
import { shareAboveThreshold, shareCurve, sigmaOfCv, type ResidueForm } from './spread.ts';
import type { SoilClassId } from './types.ts';

/**
 * The model soil classes of the first build, sorted. The position of a class is its code in
 * the soil state and in the result.
 */
export const SOIL_MODEL_CLASSES = [
  'adhesive',
  'coloured_starch',
  'egg_yolk',
  'fat',
  'fat_lard',
  'fat_margarine',
  'fat_oil',
  'fat_tallow',
  'milk',
  'soluble',
  'soluble_coloured',
  'starch',
  'tea',
] as const;

/** One of the {@link SOIL_MODEL_CLASSES}. */
export type SoilModelClass = (typeof SOIL_MODEL_CLASSES)[number];

/** How a class is removed. */
export type SoilLaw = 'reaction' | 'detach' | 'melt' | 'dissolve' | 'bleach';

/** The removal law of each class, and the enzyme a `reaction` class responds to. */
export const SOIL_CLASS_LAW: Readonly<
  Record<SoilModelClass, { readonly law: SoilLaw; readonly enzyme?: 'protease' | 'amylase' }>
> = {
  adhesive: { law: 'detach' },
  coloured_starch: { law: 'reaction', enzyme: 'amylase' },
  egg_yolk: { law: 'reaction', enzyme: 'protease' },
  fat: { law: 'melt' },
  fat_lard: { law: 'melt' },
  fat_margarine: { law: 'melt' },
  fat_oil: { law: 'melt' },
  fat_tallow: { law: 'melt' },
  milk: { law: 'reaction', enzyme: 'protease' },
  soluble: { law: 'dissolve' },
  soluble_coloured: { law: 'dissolve' },
  starch: { law: 'reaction', enzyme: 'amylase' },
  tea: { law: 'bleach' },
};

/**
 * The class whose registered values a class starts from (docs/research/standards.md 10.3;
 * docs/research/chemistry.md 4.2): a class added for how a soil LOOKS (`milk`: a protein film
 * that is translucent, `coloured_starch`: a starch-bound soil that is strongly coloured,
 * `soluble_coloured`) or for how a fat MELTS (`fat_margarine`, `fat_lard`, `fat_tallow`,
 * `fat_oil`) has the removal law and, where nothing says otherwise, the kinetic values of
 * the class it was split from. Absent: a class of its own.
 */
export const SOIL_CLASS_PARENT: Readonly<Partial<Record<SoilModelClass, SoilModelClass>>> = {
  coloured_starch: 'starch',
  fat_lard: 'fat',
  fat_margarine: 'fat',
  fat_oil: 'fat',
  fat_tallow: 'fat',
  milk: 'egg_yolk',
  soluble_coloured: 'soluble',
};

/**
 * The model class that stands for each mechanism class of the catalogue (soils 7.9) in the
 * first build. Two of the eight have no class of their own yet: baked and burnt soils (`BURN`)
 * are treated as a protein film, slowed by the bake index of their heat history, and particles
 * (`PART`) as the starch film that binds them.
 */
export const SOIL_CLASS_OF_MECHANISM: Readonly<Record<SoilClassId, SoilModelClass>> = {
  SOL: 'soluble',
  SWP: 'egg_yolk',
  SWS: 'starch',
  PEEL: 'adhesive',
  FAT: 'fat',
  BURN: 'egg_yolk',
  STAIN: 'tea',
  PART: 'starch',
};

/** How a soil is laid on: decides the scatter of its loading (`soil.applicationCv`). */
export const SOIL_APPLICATIONS = ['sprayed', 'brushed', 'spread', 'film'] as const;

/** One of the {@link SOIL_APPLICATIONS}. */
export type SoilApplication = (typeof SOIL_APPLICATIONS)[number];

/** The heat histories of a soil record that involve heating, in the order of the vector keys. */
export const SOIL_HEAT_STEPS = ['warm', 'cooked', 'baked', 'burnt'] as const;

/** The wetting classes of a substrate, in the order of `soil.fatRollUp`. */
export const SOIL_SUBSTRATE_CLASSES = [
  'continuous_film',
  'partially_wetting',
  'rivulet_prone',
] as const;

const S = 'soils';
const C = 'chemistry';

function def(
  key: string,
  unit: string,
  value: number,
  min: number,
  max: number,
  tag: ParamTag,
  source: string,
  calibration?: string,
): ParamDef {
  return {
    key: `soil.${key}`,
    unit,
    default: value,
    min,
    max,
    tag,
    source,
    group: 'soil',
    ...(calibration === undefined ? {} : { calibration }),
  };
}

/** The parameters registered by name; {@link SOIL_PARAM_DEFS} adds what split classes inherit. */
const BASE_PARAM_DEFS: readonly AnyParamDef[] = [
  def(
    'gasConstant',
    'J/(mol K)',
    8.314462618,
    8.314462618,
    8.314462618,
    'VERIFIED',
    'CODATA 2018 (exact)',
  ),
  def(
    'refTemperature',
    'degC',
    50,
    50,
    50,
    'VERIFIED',
    `${S} 8, R3: reference temperature of the rate constants (323.15 K)`,
  ),
  def('refPH', '1', 10.5, 10.5, 10.5, 'VERIFIED', `${S} 8, R3: reference pH of the rate constants`),

  // ---- initial state (soils 7.4, 7.7, 8.1, 8.3)
  def(
    'solidsFraction',
    '1',
    0.5,
    0.01,
    1,
    'ESTIMATED',
    `${S} 8.1: solids mass fraction of a soil as applied, used when the catalogue gives none`,
  ),
  def('egg_yolk.solidsFraction', '1', 0.5, 0.2, 0.7, 'VERIFIED', `${S} 8.1 (egg yolk 0.50)`),
  def(
    'starch.solidsFraction',
    '1',
    0.25,
    0.1,
    0.5,
    'ESTIMATED',
    `${S} 8.1 (mashed potato 0.22, porridge 0.16 to 0.30)`,
  ),
  def(
    'adhesive.solidsFraction',
    '1',
    0.3,
    0.1,
    0.5,
    'ESTIMATED',
    `${S} 8.1 (ketchup, tomato sauce)`,
  ),
  def('fat.solidsFraction', '1', 1, 0.8, 1, 'RECALLED', `${S} 8.1: fats carry no water`),
  def(
    'soluble.solidsFraction',
    '1',
    0.7,
    0.3,
    0.9,
    'ESTIMATED',
    `${S} 8.1 (sugars, honey, jam 0.65 to 0.82)`,
  ),
  def(
    'tea.solidsFraction',
    '1',
    0.01,
    0.001,
    0.05,
    'ESTIMATED',
    `${S} 8.1 (tea film under 1 g/m2 dry)`,
  ),
  def(
    'evapFlux',
    'kg/(m2 s)',
    9e-6,
    5e-6,
    2e-5,
    'ESTIMATED',
    `${S} 7.4, R3: evaporation flux of a soil drying at 22 C and 50 % humidity`,
    'ageing',
  ),
  def(
    'loadCv',
    '1',
    0.3,
    0,
    0.6,
    'ESTIMATED',
    `${S} 7.7, R3: coefficient of variation of the log-normal loading within a soiled area`,
    'heterogeneity',
  ),
  def(
    'loadScale',
    'm',
    0.002,
    0,
    0.01,
    'ESTIMATED',
    `${S} 7.7 (the loading of a smear varies "per element" of 1 to 4 mm); standards 10.1, requirement 3 (what is seen must not depend on the mesh); review of the anchoring (10 October 2026): pitch of the lattice, in the frame of the item, on which the scatter of the loading (soil.loadCv) is drawn; every deposit inside one lattice cube has the same multiplier, so the thick places of a soil are patches of this size at every tier. 0 draws the scatter per deposit (the first build), which makes its thick places single cells of 1 mm2 at the official tier and of 4 mm2 at the fast tier`,
    'heterogeneity',
  ),
  def(
    'amountCv',
    '1',
    0,
    0,
    0.3,
    'ESTIMATED',
    `standards 13.5 (per-item soil mass varies by 3 to 7 %, the verified application tolerances of the IKW method), 3.1: coefficient of variation of the dry mass of a soil record about the amount stated, log-normal, drawn per item and record from the level seed. It is what one run of a standard load differs from the next by before anything is washed; 0 lays down exactly the stated amount (the first build)`,
    'heterogeneity',
  ),
  def(
    'subCellCv',
    '1',
    0,
    0,
    0.6,
    'VERIFIED',
    `${S} 3.2, 7.7 (Go23, verified: a standard deviation of 5 g/m2 at a mean of 50 g/m2 is what gives a sprayed layer its constant-rate stage and its decay stage), 6.1 (the in-machine tile runs at a constant rate to about 70 % and is complete at about 65 min, 1.05 to 1.15 times the time its constant rate needs: a total spread of 0.10 to 0.15), 7.5 E6; standards 10.2 (sub-element coverage): coefficient of variation of the loading inside one deposit (a soil cell of 1 to 4 mm2), log-normal. Inside a few square millimetres a brushed or spread layer has levelled as a sprayed one has (the levelling time of a ripple goes with the fourth power of its length: under a second at 1 mm for a 0.1 mm layer of egg yolk), so the value measured on sprayed soils is taken for every application; what a brush or a spoon leaves uneven is longer than that and is soil.applicationCv. Above 0 a zero-order law bares the thin places of a deposit first, so its rate falls with the share still covered and the residue is a share of the cell (spread.ts); 0, the registered default, is the lumped element of the first build, whose rate falls by soil.decayOnset instead and which a test of the first build's stacking contrasts (sim-verify) still holds the defaults to. The evidence-based value is 0.1 and the anchored sets state it (anchored-v3: packages/calibration/anchors); a wash that is to mean anything runs with one of them. The anchoring of 10 October 2026 (anchored-v2) had 0.3 here on top of 0.3 between deposits, a total of 0.42, with which the thickest places of a deposit take four times its mean and the tile would be 98 % gone only at about 110 min`,
    'heterogeneity',
  ),
  {
    kind: 'vector',
    key: 'soil.applicationCv',
    unit: '1',
    default: [0.1, 0.15, 0.3, 0.2],
    min: 0,
    max: 0.6,
    components: [...SOIL_APPLICATIONS],
    tag: 'ESTIMATED',
    source: `${S} 3.2, 7.7 (sprayed test soils: 0.1, verified, Go23; "real smears are far less uniform": 0.3 to 0.5, estimated), 6.1 (the sprayed in-machine tile is complete at 1.05 to 1.15 times the time of its constant rate, which bounds its whole spread at about 0.15); standards 4.1 (the IEC soils are brushed or spread on "evenly", the porridge with a brush): coefficient of variation of the loading from one patch of soil.loadScale to the next, log-normal, by how the soil was laid on (soil-data.ts gives the application of every catalogue soil). sprayed: a calibrated test tile. brushed: a thin liquid laid on with a brush, which levels below about 5 mm and keeps the unevenness of the strokes (egg yolk of the standard methods); 0.15 is an estimate between the sprayed value and a smear, range 0.1 to 0.3. spread: a paste or a real smear. film: what a drink or a thin liquid leaves when it is poured out or dries. A soil that soil-data.ts does not know has soil.loadCv. The owner's interrupted egg-yolk tile wash measures the brushed value (the time from 70 % to bare)`,
    group: 'soil',
    calibration: 'heterogeneity',
  },
  def(
    'heatDryingFactor',
    '1',
    80,
    0,
    1000,
    'ESTIMATED',
    `${S} 5.0 (evaporation j = h_m times the vapour-density difference: about 3.5 g/m3 at room conditions, about 290 g/m3 for a wet film at 80 C in dry circulating air); standards 4.1 (2 h at 80 C in a through-circulation cabinet): evaporation flux during the heat step of a heat history over soil.evapFlux. About 80 for the IEC cabinet, which dries every soil of the load; 0 lets a heat step dry nothing (the first build, in which a thick soil came out of the cabinet still wet, its lag paid)`,
    'ageing',
  ),
  def(
    'patchScale',
    'm',
    0.012,
    0.003,
    0.05,
    'SYN',
    'first build: coherence length of the field that decides which part of a region a soil covers',
  ),
  def(
    'bakeRate',
    '1/s',
    3e-5,
    1e-5,
    1e-4,
    'ESTIMATED',
    `${S} 8.3: bake-index rate k_B at 80 C`,
    'ageing',
  ),
  def(
    'bakeEa',
    'J/mol',
    43e3,
    30e3,
    80e3,
    'ESTIMATED',
    `${S} 8.3: activation energy of the bake index`,
    'ageing',
  ),
  def(
    'bakeRefTemperature',
    'degC',
    80,
    80,
    80,
    'ESTIMATED',
    `${S} 8.3: reference temperature of k_B`,
  ),
  def(
    'roomTemperature',
    'degC',
    22,
    15,
    30,
    'ESTIMATED',
    `${S} 7.4: temperature at which a soil ages before the wash`,
  ),
  {
    kind: 'vector',
    key: 'soil.heatTemperature',
    unit: 'degC',
    default: [80, 125, 160, 204],
    min: 40,
    max: 300,
    components: [...SOIL_HEAT_STEPS],
    tag: 'ESTIMATED',
    source: `${S} 8.3 and the catalogue's heat histories: temperature of a soil kept warm (80 C), cooked on the item (100 to 150 C), oven-baked (120 to 200 C) and charred (204 C)`,
    group: 'soil',
    calibration: 'ageing',
  },
  {
    kind: 'vector',
    key: 'soil.heatDuration',
    unit: 's',
    default: [7200, 1800, 3600, 1800],
    min: 60,
    max: 36000,
    components: [...SOIL_HEAT_STEPS],
    tag: 'ESTIMATED',
    source: `${S} 8.3: time at that temperature (2 h at 80 C is the IEC drying; it gives a bake index of 0.2)`,
    group: 'soil',
    calibration: 'ageing',
  },
  def(
    'bakeRateFactor',
    '1',
    0.8,
    0,
    1,
    'ESTIMATED',
    `${S} 8.3: reaction-erosion falls as 1 - 0.8 B with the bake index B`,
    'ageing',
  ),
  def(
    'bakeLagFactor',
    '1',
    1.25,
    0,
    5,
    'ESTIMATED',
    `${S} 8.3 (baked egg yolk: lag x 2 at B about 0.8): the lag grows as 1 + 1.25 B`,
    'ageing',
  ),
  def(
    'bakeAdhesionFactor',
    '1',
    7,
    0,
    15,
    'ESTIMATED',
    `${S} 8.3: adhesion grows as 1 + 7 B`,
    'ageing',
  ),

  def(
    'bakeReference',
    '1',
    0,
    0,
    0.6,
    'ESTIMATED',
    `${S} 6.1, 8 (the rates and the lag of the protein class are those of a heat-aged monitor tile); 8.3 (2 h at 80 C gives a bake index of 0.2): bake index of the soil the reference rates of the reaction classes were measured on. The bake factors of the rate and of the lag are taken relative to it, (1 - k_r B) / (1 - k_r B_ref) and (1 + k_l B_ref) / (1 + k_l B), so that a soil aged like the reference runs at the reference rate; 0 charges every soil its whole bake index (the first build, in which oven drying was paid twice)`,
    'ageing',
  ),

  // ---- hydration lag (soils 8.3; sim-core M8 "Lag")
  def(
    'tLag',
    's',
    0,
    0,
    3600,
    'ESTIMATED',
    `${S} 8.3: wetted time at reference conditions before removal starts; 0 for a class without a lag`,
  ),
  def(
    'egg_yolk.tLag',
    's',
    540,
    30,
    1800,
    'VERIFIED',
    `${S} 8.3: 9 min at 50 C (scatter 0.4 to 33 min)`,
    'soil.egg_yolk',
  ),
  def(
    'starch.tLag',
    's',
    300,
    30,
    1800,
    'ESTIMATED',
    `${S} 8.3 (starch mix, pasta: 5 min)`,
    'soil.starch',
  ),
  def(
    'adhesive.tLag',
    's',
    180,
    10,
    3600,
    'ESTIMATED',
    `${S} 8.1, 8.2: soak time of a dried ketchup film (water transport D_w = 2.2e-13 beta^1.36)`,
    'soil.adhesive',
  ),
  def('tea.tLag', 's', 120, 0, 1200, 'ESTIMATED', `${S} 8.3 (tea stain: 2 min)`, 'soil.tea'),
  def(
    'lagEa',
    'J/mol',
    20e3,
    5e3,
    40e3,
    'ESTIMATED',
    `${S} 8.1: activation energy of water transport, for the classes whose lag is not the enzyme's`,
  ),
  def(
    'waterHydration',
    '1',
    0,
    0,
    1,
    'SYN',
    'sim-core M8, "Lag": share of the lag rate that runs in liquor without the active agent and below `soil.lagPhMin` (0: a cold pre-rinse does not pay off the lag)',
  ),
  def(
    'adhesive.waterHydration',
    '1',
    1,
    0,
    1,
    'ESTIMATED',
    `${S} 2.5, 8.2: a dried sauce soaks in plain water`,
  ),
  def(
    'lagRamp',
    '1',
    0.5,
    0.05,
    2,
    'VERIFIED',
    `${S} 7.5 E3: after the lag, removal rises to its full rate over this share of a further lag, g = (t_wet - t_lag) / (0.5 t_lag)`,
  ),
  def(
    'lagPhShare',
    '1',
    0.5,
    0,
    1,
    'SYN',
    'sim-core M8, "Lag": the lag runs with exp((s_pH / 2)(pH - pH_ref)), half the pH sensitivity of the rate',
  ),
  def(
    'lagPhMin',
    '1',
    9.5,
    8,
    11,
    'SYN',
    'sim-core M8: pH at or above which the lag of a reaction class runs without enzyme',
  ),
  def(
    'lagEnzymeMin',
    '1',
    0.05,
    0,
    1,
    'SYN',
    'sim-core M8: enzyme level, as a share of the reference dose, at or above which the lag runs',
  ),

  // ---- reaction-erosion (soils 8.3, 8.4, R3; chemistry 10.6)
  def(
    'rateRef',
    'kg/(m2 s)',
    0,
    0,
    1e-3,
    'ESTIMATED',
    `${S} 8.3: reaction-erosion mass flux at 50 C, pH 10.5 and the reference enzyme dose`,
  ),
  def(
    'egg_yolk.rateRef',
    'kg/(m2 s)',
    3e-5,
    1e-5,
    1e-4,
    'VERIFIED',
    `${S} 8.3, calibration 1 (2e-5 to 4e-5)`,
    'soil.egg_yolk',
  ),
  def(
    'starch.rateRef',
    'kg/(m2 s)',
    2e-5,
    2e-6,
    2e-4,
    'ESTIMATED',
    `${S} 8.3 (starch mix, pasta)`,
    'soil.starch',
  ),
  def(
    'enzymeRef',
    'kg/m3',
    0.06,
    0.01,
    0.2,
    'VERIFIED',
    `${S} 8: reference enzyme dose (0.06 g/L protease prill)`,
  ),
  def(
    'starch.enzymeRef',
    'kg/m3',
    0.02,
    0.005,
    0.1,
    'ESTIMATED',
    `${C} 10.6: reference amylase dose`,
  ),
  def(
    'hillN',
    '1',
    3,
    1,
    4,
    'ESTIMATED',
    `${S} R3: Hill exponent of the enzyme response`,
    'enzymeResponse',
  ),
  def(
    'KE',
    '1',
    0.82,
    0.3,
    1.5,
    'ESTIMATED',
    `${S} R3: Hill constant as a share of the reference dose`,
    'enzymeResponse',
  ),
  def(
    'enzymeFree',
    '1',
    0,
    0,
    1,
    'ESTIMATED',
    `${S} 8.3: share of the reference rate that runs without enzyme`,
  ),
  def(
    'starch.enzymeFree',
    '1',
    0.1,
    0,
    1,
    'ESTIMATED',
    `${S} 8.3 (starch: x 0.1 without amylase)`,
    'soil.starch',
  ),
  def(
    'sPH',
    '1',
    0,
    0,
    1.5,
    'ESTIMATED',
    `${S} 8.3: pH sensitivity per pH unit, as exp(s (pH - 10.5))`,
  ),
  def(
    'egg_yolk.sPH',
    '1',
    0.96,
    0,
    1.5,
    'ESTIMATED',
    `${S} 8.3, R3: factor 2.6 per pH unit between 9.5 and 11.5`,
    'soil.egg_yolk',
  ),
  def('starch.sPH', '1', 0.3, 0, 1.5, 'ESTIMATED', `${S} 8.3`, 'soil.starch'),
  def('phMin', '1', 8, 6, 9.5, 'ESTIMATED', `${C} 10.6: the pH factor is clamped to pH 8 to 12`),
  def('phMax', '1', 12, 11.5, 13, 'ESTIMATED', `${C} 10.6: the pH factor is clamped to pH 8 to 12`),
  def(
    'enzymeEa',
    'J/mol',
    25e3,
    5e3,
    60e3,
    'ESTIMATED',
    `${C} 10.6: activation energy of enzyme activity (protease)`,
    'enzymeResponse',
  ),
  def('starch.enzymeEa', 'J/mol', 30e3, 5e3, 60e3, 'ESTIMATED', `${C} 10.6 (amylase)`),
  def(
    'enzymeTm',
    'degC',
    75,
    50,
    90,
    'ESTIMATED',
    `docs/research/enzymes-at-temperature.md sections 2, 6.1 and 9.2, auto-recommendation.md section 2 (fact-checked 10 October 2026): mid-point of the instantaneous loss of protease activity with temperature. The loss over time is the liquor's half-life law (liq.proteaseHalfLife, 30 min at 60 C), which on its own puts the optimum of a 5-minute assay at the published 60 C (Falkenberg et al. 2022, verified) and reaches a half-life of one minute at 76.5 C; a mid-point at 63 C beside it (${C} 10.6, the first build) halves the activity a second time at 65 C and describes another enzyme. Savinase with calcium keeps 69 % of its activity through 10 min at 70 C (US 5,677,163, verified). Nothing measures the instantaneous factor: range to calibrate 63 to 85 C`,
    'enzymeResponse',
  ),
  def('starch.enzymeTm', 'degC', 70, 50, 90, 'ESTIMATED', `${C} 10.6 (amylase, 343.15 K)`),
  def(
    'enzymeDH',
    'J/mol',
    300e3,
    100e3,
    500e3,
    'ESTIMATED',
    `${C} 10.6: enthalpy of the denaturation transition`,
  ),
  def(
    'rateOH',
    'kg/(m2 s)',
    0,
    0,
    1e-5,
    'ESTIMATED',
    `sim-core M8, "Alkaline path": enzyme-free flux at pH 11.5 and 55 C; zero at pH 10.5 and below`,
  ),
  def(
    'egg_yolk.rateOH',
    'kg/(m2 s)',
    3e-6,
    0,
    1e-5,
    'ESTIMATED',
    `sim-core M8; ${S} 2.2, E3`,
    'soil.egg_yolk',
  ),
  def('rateOHEa', 'J/mol', 60e3, 20e3, 90e3, 'ESTIMATED', `sim-core M8; ${C} 10.6`),
  def(
    'rateOHRefTemperature',
    'degC',
    55,
    55,
    55,
    'ESTIMATED',
    'sim-core M8: reference temperature of the alkaline path',
  ),
  def(
    'rateOHRefPH',
    '1',
    11.5,
    11.5,
    11.5,
    'ESTIMATED',
    'sim-core M8: reference pH of the alkaline path',
  ),
  def(
    'decayOnset',
    '1',
    0.3,
    0.05,
    1,
    'VERIFIED',
    `${S} 7.5, R3: the rate of a lumped element falls in proportion to its mass once this share of its initial mass remains`,
  ),

  // ---- direct jets (soils R3, 8.3)
  def(
    'tauStar',
    'Pa',
    10,
    5,
    20,
    'VERIFIED',
    `${S} R3: wall shear above which a jet adds removal to an enzyme-weakened film`,
    'jetAssist',
  ),
  def(
    'jetRatio',
    '1',
    1,
    1,
    7,
    'ESTIMATED',
    `${S} R3: ratio of jet-assisted to unassisted erosion, k_ss / k_ds`,
  ),
  def('egg_yolk.jetRatio', '1', 4, 1.5, 7, 'VERIFIED', `${S} R3 (range 1.5 to 7)`, 'jetAssist'),
  def('starch.jetRatio', '1', 3, 1, 7, 'ESTIMATED', `${S} 8.3 (x 3)`, 'jetAssist'),
  def(
    'jetDetach',
    '1',
    1,
    0.01,
    100,
    'SYN',
    `${S} 3.6, 7.5 E6d; review of the first build: factor on the erosion of a deposit of the detach and melt laws by a jet film, relative to a gravity film of the same excess shear. The rate is m_0 p_jet / t_det times the stress-time integral of (tau / strength - 1) over the jet's exceedance curve, so it acts on the time above strength (it was a share per revolution, which made it unidentifiable)`,
    'jetAssist',
  ),
  def(
    'jetPassGain',
    '1',
    1,
    1,
    50,
    'SYN',
    `${S} 3.6 (k_mean = k_ds + f (k_ss - k_ds), f the fraction of time under shear) and 6.4.3.3 (at 30 to 40 C the sheared rate is higher at 8.5 % than at 100 % frequency: material loosened between passes is ready for the next): factor on the fraction of time above tau* in the jet-assist term, f = min(1, G D(tau*)). 1 is the dossier's linear form, validated in-machine at f = 1.6 %; larger values credit each pass with the layer loosened since the last`,
    'jetAssist',
  ),
  def(
    'detachExcessCap',
    '1',
    50,
    1,
    500,
    'SYN',
    'review of the first build: the erosion rate of the detach law grows with the excess of the wall shear over the strength, (tau / strength - 1), up to this value (a deposit leaves no faster than a layer can peel: at 50 a soaked deposit under a jet a hundred times its strength goes in 0.2 s of stress, a dozen passes)',
    'soil.adhesive',
  ),
  def(
    'heldFilmCapacity',
    'kg/kg',
    0.02,
    0,
    0.2,
    'ESTIMATED',
    `${C} 10.2 (film exchange: an element with no inflow in a phase keeps the liquor of the phase before); ${S} 6.1 (the loosened material "washes out as water reaches the tile"); mass balance; review of the anchoring (10 October 2026): dry soil that a kilogram of the film left standing on a deposit, once the spray that fed it has stopped, can take up before it is spent (a 100 um film that took up 56 g/m2 of egg yolk would be one third protein). Nothing renews such a film, so it has no supply: the chemical laws remove at most this times the retained film per stop of the spray; soaking goes on. About 0.02 (20 g/L, range 0.005 to 0.1); 0: a residual film soaks the soil and removes nothing. The same capacity is the first of the three balances behind soil.supplyExchange`,
    'supply',
  ),
  def(
    'supplyExchange',
    '1/s',
    0.02,
    0.002,
    1,
    'ESTIMATED',
    `films 12.9 (fresh against run-off liquor); standards P04, P15, P40 (liquid held in gaps does not exchange); ${S} 6.2 (PM-T Table 7.7: in the machine the film on the tile "is renewed quickly", and at low concentration enzyme delivery limits), 7.3; three mass balances on a film of 0.15 kg/m2 over a deposit that leaves at 3e-5 kg/(m2 s): exchange of the liquor on a block (the inverse of the age of the water on it, the water table's exchange column) at which the chemical rates are half those in fresh liquor, s = x / (x + x_half). (1) Products: the film is spent when it holds soil.heldFilmCapacity (0.02 kg/kg) of soil, after 0.15 x 0.02 / 3e-5 = 100 s: 0.010 1/s. (2) Alkali: digesting protein takes up about 0.5 mol of hydroxide per kg (one proton per peptide bond cut at a degree of hydrolysis of 5 to 10 %, and the side groups), the carbonate buffer of the liquor gives about 7 mol/m3 per pH unit, and 0.7 pH units halve the rate (soil.egg_yolk.sPH): 0.15e-3 m3/m2 x 7 x 0.7 / (3e-5 x 0.5) = 49 s: 0.020 1/s. (3) Enzyme: a wall that takes up every enzyme molecule reaching it empties a laminar film at Sh D / h^2 = 2 x 1.5e-10 / (1.5e-4)^2 = 0.013 1/s. All three lie between 0.01 and 0.02 1/s; the upper is taken. With it a face whose water is 3 s old (0.3 1/s: the water side's bowl nest, wall-side face and shielded spoon) is supplied to 94 %, and only water older than about a minute is spent: the age of the liquor alone does not make a wetted face dirty, which agrees with the in-machine tile (removal even over the tile, 90 % chemistry under the draining film). It replaces soil.supplyRenewal of the first build (0.05 1/s on the renewal column, a local speed that is high wherever water moves at all)`,
    'supply',
  ),

  // ---- adhesive detachment (soils 8.2, R3)
  def(
    'adhesionTau0',
    'Pa',
    8.11e5,
    8e4,
    8e6,
    'VERIFIED',
    `${S} 8.2: adhesion of dried ketchup, tau_ad = tau_a0 exp(-b_a beta)`,
    'soil.adhesive',
  ),
  def(
    'adhesionHotFactor',
    '1',
    0.1,
    0.02,
    1,
    'ESTIMATED',
    `${S} 2.4, 4.1 (Liu et al. 2002, at second hand through Z19 section 6: the apparent adhesive strength of baked tomato paste was "90 % lower after raising hydration temperature from 25 to 50 C"; the ketchup law of 8.2 was measured in water at 20 C; that the factor measured on baked tomato paste holds for every soil of the detach law is this model's estimate): the bond strength of a soil of the detach law in liquor at soil.adhesionHotTemperature, as a share of its strength at soil.adhesionColdTemperature; between the two the logarithm of the strength falls in proportion to the temperature, below and above them it stays (nothing was measured outside). 1 switches the dependence off: the first builds took the strength of 20 C water at every temperature, with which the strongest fiftieth of the cells of a dried tomato sauce (soil.adhesionCv 0.5 against a soaked strength of 0.35 Pa under a film of 0.8 Pa) stayed on every plate that no jet strikes, however it stood`,
    'soil.adhesive',
  ),
  def(
    'adhesionColdTemperature',
    'degC',
    25,
    15,
    35,
    'VERIFIED',
    `${S} 2.4, 4.1: the hydration temperature at which the adhesion law holds as written (the lower of the two temperatures of the tomato-paste measurement; the ketchup law itself is of 20 C water)`,
    'soil.adhesive',
  ),
  def(
    'adhesionHotTemperature',
    'degC',
    50,
    40,
    70,
    'VERIFIED',
    `${S} 2.4, 4.1: the hydration temperature at which the bond strength has fallen to soil.adhesionHotFactor (the higher of the two temperatures of the tomato-paste measurement)`,
    'soil.adhesive',
  ),
  def(
    'adhesionCv',
    '1',
    0.5,
    0,
    1.5,
    'ESTIMATED',
    `${S} 4.1 (tomato paste on steel: 1 to 20 N/m overall, 7 falling to 2 with hydration; strength rises with thickness and roughness): coefficient of variation of the bond strength from deposit to deposit, log-normal about its mean, keyed by item, record and cell. It grades the removed share against the strength`,
    'soil.adhesive',
  ),
  def(
    'adhesionB',
    'm3/kg',
    0.016,
    0.01,
    0.03,
    'VERIFIED',
    `${S} 8.2: decay of adhesion with the water concentration at the wall`,
    'soil.adhesive',
  ),
  def(
    'betaMax',
    'kg/m3',
    750,
    300,
    950,
    'ESTIMATED',
    `${S} 8.1: water concentration of fully soaked ketchup (720 to 780)`,
    'soil.adhesive',
  ),
  def(
    'Cad',
    '1',
    14.2,
    0.1,
    20,
    'VERIFIED',
    `${S} R3: correction between a blade and a flow loading the bond (fitted on ketchup)`,
    'soil.adhesive',
  ),
  def(
    'detachTime',
    's',
    10,
    1,
    600,
    'SYN',
    'first build: time in which a deposit leaves the wall under a film whose shear is twice its strength (the rate is m_0 (tau / strength - 1) / t_det, capped at soil.detachExcessCap)',
    'soil.adhesive',
  ),

  // ---- fat (chemistry 4.2, 10.6; soils 8.3)
  def(
    'fatSfcMax',
    '1',
    0.6,
    0,
    0.95,
    'RECALLED',
    `${C} 4.2: solid fat content far below the melting range (butter)`,
    'soil.fat',
  ),
  def(
    'fatT50',
    'degC',
    14,
    5,
    40,
    'ESTIMATED',
    `${C} 4.2: mid-point of the logistic melting curve (butter)`,
    'soil.fat',
  ),
  def(
    'fatWidth',
    'K',
    6,
    2,
    8,
    'ESTIMATED',
    `${C} 4.2: width of the melting curve (butter)`,
    'soil.fat',
  ),
  def(
    'fatSfcLiquid',
    '1',
    0.03,
    0.01,
    0.05,
    'ESTIMATED',
    `${C} 4.2, 10.6: solid fat content below which the fat is a mobile liquid`,
    'soil.fat',
  ),
  def(
    'fatSfcSolid',
    '1',
    0.1,
    0.06,
    0.2,
    'ESTIMATED',
    `${C} 4.2, 10.6: solid fat content above which a film removes nothing`,
    'soil.fat',
  ),
  def(
    'fatYield',
    'Pa',
    3e5,
    3e4,
    3e6,
    'ESTIMATED',
    `${C} 4.2, 10.6: yield stress of the fat crystal network, tau_y = 3e5 SFC^3.5`,
    'soil.fat',
  ),
  def('fatYieldExponent', '1', 3.5, 2, 5, 'ESTIMATED', `${C} 4.2`),
  def(
    'fatEmulsify',
    '1/s',
    0.01,
    0.002,
    0.05,
    'ESTIMATED',
    `${S} 8.3, calibration 13: emulsification rate of mobile fat under a film`,
    'soil.fat',
  ),
  def('fatEa', 'J/mol', 30e3, 10e3, 60e3, 'ESTIMATED', `${S} 8.3 (fats above melting)`),
  def(
    'fatSurfHalf',
    'kg/m3',
    0.02,
    0.005,
    0.1,
    'ESTIMATED',
    `${C} 10.6: surfactant concentration at which the oil-water tension has fallen half-way`,
    'soil.fat',
  ),
  def(
    'fatWaterShare',
    '1',
    0.1,
    0,
    1,
    'SYN',
    'first build: share of the emulsification rate that runs without surfactant (hot water alone shifts liquid fat)',
    'soil.fat',
  ),
  {
    kind: 'vector',
    key: 'soil.fatRollUp',
    unit: '1',
    default: [1, 0.5, 0.15],
    min: 0.01,
    max: 1,
    components: [...SOIL_SUBSTRATE_CLASSES],
    tag: 'ESTIMATED',
    source: `${C} 10.6: roll-up factor of fat by substrate (glass, glazed ceramic, steel 1.0; melamine, PTFE 0.5; polypropylene, polyethylene, silicone 0.15), keyed here by the wetting class of the material`,
    group: 'soil',
    calibration: 'soil.fat',
  },

  // The melting curves of the fats the catalogue names (chemistry 4.2, all RECALLED curves
  // with ESTIMATED logistic fits); the class `fat` above is butter.
  def('fat_margarine.fatSfcMax', '1', 0.35, 0, 0.95, 'RECALLED', `${C} 4.2: margarine`, 'soil.fat'),
  def(
    'fat_margarine.fatT50',
    'degC',
    18,
    5,
    40,
    'ESTIMATED',
    `${C} 4.2: margarine (slip point 31 to 36 C)`,
    'soil.fat',
  ),
  def('fat_margarine.fatWidth', 'K', 5.5, 2, 8, 'ESTIMATED', `${C} 4.2: margarine`, 'soil.fat'),
  def(
    'fat_lard.fatSfcMax',
    '1',
    0.35,
    0,
    0.95,
    'RECALLED',
    `${C} 4.2: lard, bacon fat`,
    'soil.fat',
  ),
  def(
    'fat_lard.fatT50',
    'degC',
    22,
    5,
    40,
    'ESTIMATED',
    `${C} 4.2: lard, bacon fat (slip point 36 to 45 C)`,
    'soil.fat',
  ),
  def('fat_lard.fatWidth', 'K', 6.5, 2, 8, 'ESTIMATED', `${C} 4.2: lard, bacon fat`, 'soil.fat'),
  def(
    'fat_tallow.fatSfcMax',
    '1',
    0.5,
    0,
    0.95,
    'RECALLED',
    `${C} 4.2: beef tallow, roast drippings`,
    'soil.fat',
  ),
  def(
    'fat_tallow.fatT50',
    'degC',
    30,
    5,
    40,
    'ESTIMATED',
    `${C} 4.2: beef tallow, roast drippings (slip point 42 to 48 C; solid fat 0.08 at 40 C, 0.04 at 45 C)`,
    'soil.fat',
  ),
  def('fat_tallow.fatWidth', 'K', 6, 2, 8, 'ESTIMATED', `${C} 4.2: beef tallow`, 'soil.fat'),
  def(
    'fat_oil.fatSfcMax',
    '1',
    0,
    0,
    0.95,
    'RECALLED',
    `${C} 4.2: sunflower, rapeseed and olive oil hold no solid fat above 6 C`,
    'soil.fat',
  ),

  // ---- solubles (soils 3.3, 8.3)
  def(
    'dissolveRate',
    'kg/(m2 s)',
    1e-2,
    1e-4,
    1e-1,
    'ESTIMATED',
    `${S} 8.3: dissolution flux of sugars under a film (of order 1e-2)`,
    'soil.soluble',
  ),
  def('dissolveEa', 'J/mol', 20e3, 5e3, 40e3, 'ESTIMATED', `${S} 8.3`),

  // ---- stains (chemistry 3.4)
  def(
    'bleachRate',
    'm3/(mol s)',
    0.8e-3,
    0.3e-3,
    3e-3,
    'ESTIMATED',
    `${C} 3.4, 11 row 8: bleaching of tea by peracid at 45 C (0.8 L/(mol s))`,
    'soil.tea',
  ),
  def(
    'bleachRefTemperature',
    'degC',
    45,
    45,
    45,
    'ESTIMATED',
    `${C} 3.4: reference temperature of k_bl (318.15 K)`,
  ),
  def('bleachEa', 'J/mol', 60e3, 40e3, 80e3, 'ESTIMATED', `${C} 3.4, 11 row 8`, 'soil.tea'),
  def(
    'bleachPeroxideRatio',
    '1',
    0.02,
    0,
    20,
    'ESTIMATED',
    `${C} 3.4: rate constant of the perhydroxyl anion over that of peracid. This is also where a manganese bleach catalyst acts (MnTACN bleaches tea with hydrogen peroxide directly, docs/research/detergent-finish-ultimate.md sections 2 and 4): a product with one has a larger ratio, and the range is wide for that. No source gives the size of a catalyst's contribution, so no product is given a value other than this default; tea cups washed with and without the catalysed product measure it`,
    'soil.tea',
  ),
  def(
    'bleachChelant',
    '1',
    2,
    0,
    5,
    'ESTIMATED',
    `${C} 3.4: gain of the bleaching rate with free chelant (softened water assumed: factor 1 + beta_ch)`,
    'soil.tea',
  ),

  // ---- what the inspector calls visible (standards 10.3; soils R7)
  def(
    'visibleMass',
    'kg/m2',
    2e-3,
    2e-4,
    2e-2,
    'ESTIMATED',
    `standards 10.3: dry mass per area above which a residue is visible; translucent films 0.1 to 0.3 mg/cm2`,
    'visibility',
  ),
  def(
    'egg_yolk.visibleMass',
    'kg/m2',
    3.5e-4,
    1e-4,
    2e-3,
    'ESTIMATED',
    `standards 10.3: strongly coloured or opaque, 0.02 to 0.05 mg/cm2; ${S} R7: 0.5 g/m2 (0.2 to 2)`,
    'visibility',
  ),
  def(
    'starch.visibleMass',
    'kg/m2',
    1e-3,
    2e-4,
    3e-3,
    'ESTIMATED',
    `standards 10.3: translucent, 0.1 to 0.3 mg/cm2; ${S} R7: 0.5 g/m2 (0.2 to 2)`,
    'visibility',
  ),
  def(
    'adhesive.visibleMass',
    'kg/m2',
    3.5e-4,
    1e-4,
    2e-3,
    'ESTIMATED',
    `standards 10.3: strongly coloured (tomato), 0.02 to 0.05 mg/cm2`,
    'visibility',
  ),
  def(
    'fat.visibleMass',
    'kg/m2',
    1e-3,
    5e-5,
    3e-3,
    'ESTIMATED',
    `standards 10.3: fat smear, 0.05 to 0.2 mg/cm2; ${S} R7: 0.1 g/m2`,
    'visibility',
  ),
  def(
    'tea.visibleMass',
    'kg/m2',
    3.75e-5,
    1e-5,
    2e-3,
    'ESTIMATED',
    `${C} 8.6 (a tea or coffee stain on white ceramic is seen from a colour difference of 2 to 3, "roughly 5 to 10 % of an IKW-level stain"); ${S} R7 (about 10 % of the original chromophore), 5.7, 8.1 (a tea film is "well under 1 g/m2"): the dry film above which a stain is seen, one level for every element: 7.5 % of the nominal film of an IKW-level stain, which soil-data.ts takes as 0.5 g/m2. The mass of a stain is nominal; only the ratio of this level to the film a soil record lays down means anything, and soil-data.ts gives each stain its film as a share of the IKW level (the IEC tea, half-filled once and emptied, half of it: seen above 15 % of its own film). Standards 10.3 lists 0.2 to 0.5 g/m2 for a "strongly coloured" film, which is 40 to 100 % of an unwashed stain and cannot be meant for one`,
    'visibility',
  ),
  def(
    'milk.visibleMass',
    'kg/m2',
    2e-3,
    2e-4,
    5e-3,
    'ESTIMATED',
    `standards 10.3: translucent films (starch, milk protein, sugar glaze), 0.1 to 0.3 mg/cm2, seen as matt haze in diffuse light; the middle`,
    'visibility',
  ),
  def(
    'milk.solidsFraction',
    '1',
    0.05,
    0.03,
    0.13,
    'ESTIMATED',
    `standards 13.3 (10 mL of UHT milk with 1.5 % fat holds 1.07 g of solids: protein 3.4, lactose 4.8, fat 1.5, ash 0.7 g per 100 g); ${S} R4 (sugars and milk films leave wherever a film flows): the share of heated milk that is the protein with its fat, which is what a protease has to digest; the lactose and the minerals dissolve as the network opens. That only this part counts is an assumption (the anchoring's "film" reading); the upper end of the range is all the solids, with which no protease level in the measured range lifts a milk glass off score 0 against a published glass class of 3.43`,
    'soil.milk',
  ),
  def(
    'coloured_starch.visibleMass',
    'kg/m2',
    3.5e-4,
    1e-4,
    2e-3,
    'ESTIMATED',
    `standards 10.3: strongly coloured or opaque (spinach, meat, coffee), 0.02 to 0.05 mg/cm2`,
    'visibility',
  ),
  def(
    'soluble_coloured.visibleMass',
    'kg/m2',
    3.5e-4,
    1e-4,
    2e-3,
    'ESTIMATED',
    `standards 10.3: strongly coloured (jam, tomato juice, caramel), 0.02 to 0.05 mg/cm2`,
    'visibility',
  ),
  def(
    'visibleFraction',
    '1',
    0,
    0,
    1,
    'ESTIMATED',
    `${S} R7: share of its initial loading above which a residue is visible, where that is lower than the mass threshold (0: mass only)`,
  ),
  def(
    'tea.visibleFraction',
    '1',
    0,
    0,
    0.5,
    'ESTIMATED',
    `${S} R7 (a stain is visible when more than about 10 % of the chromophore remains): share of an element's own initial film above which a stain is seen, where that is lower than soil.tea.visibleMass. 0: the stain is judged against the one level of soil.tea.visibleMass (a share per element made every element of a thinned film fail or pass together whatever it started with, and its thick places no more visible than its thin ones)`,
    'visibility',
  ),
];

/**
 * The registered values a split class takes from its parent ({@link SOIL_CLASS_PARENT}): a
 * copy of every `soil.<parent>.<name>` for which no `soil.<class>.<name>` is registered, with
 * the same value, range and tag. They are registered parameters of their own, so that a
 * measurement on milk can move `soil.milk.rateRef` without moving egg yolk.
 */
function inheritedDefs(base: readonly AnyParamDef[]): AnyParamDef[] {
  const known = new Set(base.map((d) => d.key));
  const out: AnyParamDef[] = [];
  for (const cls of SOIL_MODEL_CLASSES) {
    const parent = SOIL_CLASS_PARENT[cls];
    if (parent === undefined) continue;
    const prefix = `soil.${parent}.`;
    for (const d of base) {
      if (!d.key.startsWith(prefix)) continue;
      const key = `soil.${cls}.${d.key.slice(prefix.length)}`;
      if (known.has(key)) continue;
      out.push({
        ...d,
        key,
        source: `${d.source} (the value of the class ${parent}, which ${cls} was split from)`,
        ...(d.calibration === `soil.${parent}` ? { calibration: `soil.${cls}` } : {}),
      });
    }
  }
  return out;
}

/** The parameters the soil model reads, to be contributed to the registry. */
export const SOIL_PARAM_DEFS: readonly AnyParamDef[] = [
  ...BASE_PARAM_DEFS,
  ...inheritedDefs(BASE_PARAM_DEFS),
];

/** How the residue of each law lies inside a deposit (spread.ts). */
export const SOIL_LAW_RESIDUE: Readonly<Record<SoilLaw, ResidueForm>> = {
  reaction: 'erode',
  dissolve: 'erode',
  detach: 'peel',
  melt: 'thin',
  bleach: 'thin',
};

/** What the inspector needs to know per class to call a residue visible. */
export interface SoilVisibility {
  /** Dry mass per area above which a residue of each class is visible, kg/m2, by class code. */
  readonly mass: readonly number[];
  /**
   * Share of a deposit's own initial loading above which it is visible, by class code; 0 for a
   * class judged by mass alone. Where both apply, the lower threshold decides.
   */
  readonly fraction: readonly number[];
  /**
   * The share of a deposit of class `classCode` whose residue is above `threshold`, from its
   * dry loading at the start and now (one unit of mass per area for the three): the
   * sub-element coverage of standards 10.2, by the spread of the loading inside a deposit
   * (`soil.subCellCv`, spread.ts). Absent when that spread is zero: a deposit is then above
   * the threshold as a whole or not at all.
   */
  readonly share?: (
    classCode: number,
    initial: number,
    residual: number,
    threshold: number,
  ) => number;
  /**
   * `share` for one deposit as a function of the threshold alone (the same numbers; cheaper
   * for a caller that asks for many thresholds). Present exactly when `share` is.
   */
  readonly shareOf?: (
    classCode: number,
    initial: number,
    residual: number,
  ) => (threshold: number) => number;
  /**
   * By class code, with `share`: true for a class whose residue is a film thinned everywhere
   * by the same share (the first-order laws: a stain, an emulsified fat film), which the
   * inspector judges by area and never breaks into specks.
   */
  readonly film?: readonly boolean[];
}

/** The visibility thresholds of the model classes, in the order of {@link SOIL_MODEL_CLASSES}. */
export function soilVisibility(params: ParamSet): SoilVisibility {
  const mass = SOIL_MODEL_CLASSES.map((cls) => params.soilClass(cls, 'visibleMass'));
  const fraction = SOIL_MODEL_CLASSES.map((cls) => params.soilClass(cls, 'visibleFraction'));
  const sigma = sigmaOfCv(params.get('soil.subCellCv'));
  if (!(sigma > 0)) return { mass, fraction };
  const forms = SOIL_MODEL_CLASSES.map((cls) => SOIL_LAW_RESIDUE[SOIL_CLASS_LAW[cls].law]);
  return {
    mass,
    fraction,
    film: forms.map((form) => form === 'thin'),
    share: (classCode, initial, residual, threshold) =>
      shareAboveThreshold(forms[classCode] ?? 'thin', initial, residual, threshold, sigma),
    shareOf: (classCode, initial, residual) =>
      shareCurve(forms[classCode] ?? 'thin', initial, residual, sigma),
  };
}
