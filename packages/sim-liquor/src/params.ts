/**
 * The registered parameters of the liquor model of the first build (docs/design/scope.md,
 * "Calibration is a first-class feature"; docs/research/chemistry.md section 10, "Recommended
 * model and defaults"; docs/design/sim-core.md section M9).
 *
 * Every constant of the lumped model has a key here. Tags are the dossier's: section 10 says
 * every default is [ESTIMATED] unless tagged otherwise. All keys are under `liq.*` and belong
 * to the `soil` hash group, so changing one reuses cached exposure.
 *
 * Units: SI; amounts of molecular species in mol, of products and enzymes in kg; activation
 * energies in J/mol; temperatures in degrees Celsius unless a key says kelvin.
 */

import type { AnyParamDef, ParamDef, ParamSet, ParamTag } from '@spotless/sim-params';

const CH = 'chemistry';

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
    key,
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

/** The parameters the liquor model reads, to be contributed to the registry. */
export const LIQUOR_PARAM_DEFS: readonly AnyParamDef[] = [
  def(
    'liq.gasConstant',
    'J/(mol K)',
    8.314462618,
    8.314462618,
    8.314462618,
    'VERIFIED',
    'CODATA 2018 (exact)',
  ),

  // ---- detergent release (chemistry 10.3)
  def(
    'liq.tabletTau',
    's',
    480,
    100,
    1500,
    'ESTIMATED',
    `${CH} 10.3: dissolution time of a tablet at 40 C in the shrinking-core law m = m0 (1 - w t / tau)^3`,
    'detergentRelease',
  ),
  def(
    'liq.tabletEa',
    'J/mol',
    25e3,
    5e3,
    60e3,
    'ESTIMATED',
    `${CH} 10.3: activation energy of tablet dissolution`,
    'detergentRelease',
  ),
  def(
    'liq.tabletRefTemperature',
    'degC',
    40,
    40,
    40,
    'ESTIMATED',
    `${CH} 10.3: reference temperature of tau_tab (313.15 K)`,
  ),
  def(
    'liq.wStuck',
    '1',
    0.006,
    0.002,
    0.05,
    'SYN',
    `sim-core M9, "Blocked dispenser": wetting factor of a tablet behind a lid that cannot open (15 % of the dose released in the main wash); ${CH} 1.7, 10.3 (0.05)`,
    'detergentRelease',
  ),

  // ---- composition of the dose, IEC reference detergent type D (chemistry 10.3)
  def(
    'liq.xCarbonate',
    'mol/kg',
    4.36,
    2,
    6,
    'ESTIMATED',
    `${CH} 10.3: carbonate per kg of product (46.2 % as Na2CO3; mass fractions [VERIFIED], conversion [ESTIMATED])`,
    'alkalinity',
  ),
  def(
    'liq.xSilicate',
    'eq/kg',
    0.55,
    0,
    2,
    'ESTIMATED',
    `${CH} 10.3: strong-base excess from silicate per kg of product`,
    'alkalinity',
  ),
  def(
    'liq.xPeroxide',
    'mol/kg',
    0.67,
    0,
    2,
    'ESTIMATED',
    `${CH} 10.3: hydrogen peroxide (from percarbonate) per kg of product`,
    'bleach',
  ),
  def(
    'liq.xTaed',
    'mol/kg',
    0.088,
    0,
    0.3,
    'ESTIMATED',
    `${CH} 10.3: TAED per kg of product`,
    'bleach',
  ),
  def(
    'liq.xProtease',
    'kg/kg',
    0.01,
    0,
    0.05,
    'ESTIMATED',
    `${CH} 10.3: protease granulate per kg of product`,
    'enzymes',
  ),
  def(
    'liq.xAmylase',
    'kg/kg',
    0.005,
    0,
    0.05,
    'ESTIMATED',
    `${CH} 10.3: amylase granulate per kg of product`,
    'enzymes',
  ),
  def(
    'liq.xSurfactant',
    'kg/kg',
    0.02,
    0,
    0.1,
    'ESTIMATED',
    `${CH} 10.3: nonionic surfactant per kg of product`,
  ),

  // ---- acid-base (chemistry 10.4)
  def(
    'liq.supplyBicarbonate',
    'mol/m3',
    0.5,
    0,
    7,
    'ESTIMATED',
    `${CH} 1.5, 10.2, 10.4: bicarbonate alkalinity of the supply water. The default is low: it gives the pre-wash pH of 8.0 (7.5 to 8.5) and keeps the dossier's pH figures for type D (10.8, 10.7, 10.3 at 45, 50, 70 C), which were computed without it, within 0.06; 3 mol/m3 (a hard supply) would lower the main-wash pH by 0.2`,
    'alkalinity',
  ),
  def(
    'liq.pK1',
    '1',
    6.35,
    6.35,
    6.35,
    'RECALLED',
    `${CH} 10.4: first dissociation constant of carbonic acid at 25 C`,
  ),
  def(
    'liq.pK1Slope',
    '1/K',
    -0.002,
    -0.002,
    -0.002,
    'ESTIMATED',
    `${CH} 10.4: temperature slope of pK1`,
  ),
  def(
    'liq.pK2',
    '1',
    10.33,
    10.33,
    10.33,
    'RECALLED',
    `${CH} 10.4: second dissociation constant of carbonic acid at 25 C`,
  ),
  def(
    'liq.pK2Slope',
    '1/K',
    -0.0064,
    -0.0064,
    -0.0064,
    'ESTIMATED',
    `${CH} 10.4: temperature slope of pK2`,
  ),
  def('liq.pKw', '1', 14, 14, 14, 'RECALLED', `${CH} 10.4: ion product of water at 25 C`),
  def(
    'liq.pKwSlope',
    '1/K',
    -0.03,
    -0.03,
    -0.03,
    'ESTIMATED',
    `${CH} 10.4: temperature slope of pKw`,
  ),
  def(
    'liq.pKwCurve',
    '1/K2',
    0.00006,
    0.00006,
    0.00006,
    'ESTIMATED',
    `${CH} 10.4: curvature of pKw with temperature`,
  ),
  def(
    'liq.pKaHP',
    '1',
    11.6,
    11.6,
    11.6,
    'RECALLED',
    `${CH} 10.4: dissociation constant of hydrogen peroxide at 25 C`,
  ),
  def(
    'liq.pKaHPSlope',
    '1/K',
    -0.017,
    -0.017,
    -0.017,
    'ESTIMATED',
    `${CH} 10.4: temperature slope of pKa of hydrogen peroxide`,
  ),
  def(
    'liq.pKRefTemperature',
    'degC',
    25,
    25,
    25,
    'RECALLED',
    `${CH} 10.4: reference temperature of the dissociation constants`,
  ),
  def(
    'liq.dpHni',
    '1',
    -0.3,
    -0.5,
    0,
    'ESTIMATED',
    `${CH} 10.4, 11 row 5: lumped non-ideality offset of the pH`,
    'alkalinity',
  ),

  // ---- bleach (chemistry 10.5)
  def(
    'liq.kPer',
    'm3/(mol s)',
    1.0e-2,
    3e-3,
    3e-2,
    'VERIFIED',
    `${CH} 10.5, 3.2: perhydrolysis of TAED at 296 K (derived from verified HERA data)`,
    'bleach',
  ),
  def(
    'liq.kPerRefTemperature',
    'K',
    296,
    296,
    296,
    'VERIFIED',
    `${CH} 10.5: reference temperature of k_per`,
  ),
  def(
    'liq.EPer',
    'J/mol',
    45e3,
    20e3,
    70e3,
    'ESTIMATED',
    `${CH} 10.5: activation energy of perhydrolysis`,
    'bleach',
  ),
  def(
    'liq.Kr',
    'mol/m3',
    3,
    1,
    6,
    'VERIFIED',
    `${CH} 10.5, 11 row 7: hydrolysis of TAED competing with perhydrolysis`,
    'bleach',
  ),
  def(
    'liq.kDec',
    '1/s',
    5.8e-4,
    2e-4,
    2e-3,
    'ESTIMATED',
    `${CH} 10.5, 11 row 7: decay of peracid at 50 C`,
    'bleach',
  ),
  def(
    'liq.kDecRefTemperature',
    'degC',
    50,
    50,
    50,
    'ESTIMATED',
    `${CH} 10.5: reference temperature of k_dec`,
  ),
  def(
    'liq.EDec',
    'J/mol',
    60e3,
    30e3,
    90e3,
    'ESTIMATED',
    `${CH} 10.5: activation energy of peracid decay`,
    'bleach',
  ),
  def(
    'liq.kSoil',
    'm3/(kg s)',
    2e-5,
    0,
    1e-4,
    'ESTIMATED',
    `${CH} 10.5, 11 row 7: consumption of peracid by soil in the liquor`,
    'bleach',
  ),
  def('liq.kHPdec', '1/s', 1e-5, 0, 1e-4, 'ESTIMATED', `${CH} 10.5: decay of hydrogen peroxide`),

  // ---- enzymes (chemistry 10.5)
  def(
    'liq.proteaseHalfLife',
    's',
    1800,
    180,
    14400,
    'ESTIMATED',
    `${CH} 10.5, 11 row 3; docs/research/enzymes-at-temperature.md sections 1.1, 6.1 and 9, auto-recommendation.md section 2 (fact-checked 10 October 2026): thermal half-life of protease at 60 C and liq.proteaseRefPH. Savinase, the protease of reference detergent D, alone in buffer at pH 10 and 60 C: 2.8 to 3.1 min desalted without calcium, one to four hours with 50 mM calcium (US 5,677,163, verified). A citrate-built liquor in softened water is calcium-poor but not the bare buffer; nothing measured in a liquor was found, and the default is unchanged. The lower bound is the calcium-free buffer value. For a current premium capsule no value is supported either (the bracket is 1800 to 14400 s): a logged Auto run and egg-yolk plates on Auto and on Eco 50 with the owner's capsule decide it`,
    'enzymes',
  ),
  def(
    'liq.proteasePhSlope',
    '1',
    0.56,
    0,
    0.57,
    'ESTIMATED',
    `docs/research/enzymes-at-temperature.md section 1.1 (US 5,677,163 Table III, verified: Savinase after 10 min at 60 C keeps 54 % at pH 9 and 10.3 % at pH 10 without calcium, half-lives 11 and 3.1 min; 92 % at pH 10 and 74 % at pH 11 with 50 mM calcium, 83 and 23 min), section 1.4 ("lower pH: a factor of 4 or more between pH 11 and pH 9 to 10"): decadic slope of the thermal loss rate of protease with pH, k_th = k_th(pH_ref) 10^(slope (pH - pH_ref)). Both calcium states give a factor of 3.6 to 3.7 per pH unit where the loss sets in (log10 = 0.56). A liquor at pH 10.1 (a capsule at 65 C) keeps its protease 1.7 times as long as one at pH 10.5. 0 switches the dependence off (the first build). Not in the fact-checked recommendation (docs/research/auto-recommendation.md): added by the third anchoring. 0.56 is the steep half of its source: with calcium the same table shows no loss at all between pH 9 and pH 10 (92 % at both), so over the interval the capsule's liquor lies in the measured slope runs from 0 to 0.57, which is the registered range. It moves no verdict of the standard load (review of 10 October 2026)`,
    'enzymes',
  ),
  def(
    'liq.proteaseRefPH',
    '1',
    10.5,
    10.5,
    10.5,
    'ESTIMATED',
    `${CH} 1.5, 10.4 (the main-wash liquor of reference detergent D has pH 10.7 at 50 C and 10.3 at 70 C): pH at which liq.proteaseHalfLife holds: that of detergent D's liquor at 60 C, so that the dossier's 30 min at 60 C is unchanged for it`,
  ),
  def(
    'liq.proteaseEd',
    'J/mol',
    200e3,
    100e3,
    300e3,
    'ESTIMATED',
    `${CH} 10.5: activation energy of protease denaturation`,
    'enzymes',
  ),
  def(
    'liq.proteaseKox',
    'm3/(mol s)',
    1e-4,
    0,
    1e-3,
    'ESTIMATED',
    `${CH} 10.5: deactivation of protease by peracid`,
    'enzymes',
  ),
  def(
    'liq.proteaseKoxHP',
    'm3/(mol s)',
    5e-6,
    0,
    1e-4,
    'ESTIMATED',
    `${CH} 10.5: deactivation of protease by peroxide`,
  ),
  def(
    'liq.amylaseHalfLife',
    's',
    3600,
    600,
    14400,
    'ESTIMATED',
    `${CH} 10.5: thermal half-life of amylase at 60 C`,
    'enzymes',
  ),
  def(
    'liq.amylaseEd',
    'J/mol',
    220e3,
    100e3,
    300e3,
    'ESTIMATED',
    `${CH} 10.5: activation energy of amylase denaturation`,
    'enzymes',
  ),
  def(
    'liq.amylaseKox',
    'm3/(mol s)',
    6e-4,
    6e-5,
    2e-3,
    'ESTIMATED',
    `${CH} 10.5, 11 row 9: deactivation of amylase by peracid`,
    'enzymes',
  ),
  def(
    'liq.amylaseKoxHP',
    'm3/(mol s)',
    1e-5,
    0,
    1e-4,
    'ESTIMATED',
    `${CH} 10.5: deactivation of amylase by peroxide`,
  ),
  def(
    'liq.enzymeRefTemperature',
    'degC',
    60,
    60,
    60,
    'ESTIMATED',
    `${CH} 10.5: reference temperature of the enzyme half-lives (333.15 K)`,
  ),

  // ---- liquor class and rinse aid
  def(
    'liq.surfClass',
    'kg/m3',
    0.02,
    0.005,
    0.05,
    'SYN',
    'sim-core M9: dissolved nonionic surfactant above which the liquor is of the main-wash class D',
  ),
  def(
    'liq.rinseAidDensity',
    'kg/m3',
    1000,
    950,
    1100,
    'ESTIMATED',
    `${CH} 8.2: density of rinse aid (an aqueous surfactant solution)`,
  ),
];

/** The liquor parameters as numbers. */
export interface LiquorParams {
  readonly gasConstant: number;
  readonly tabletTau: number;
  readonly tabletEa: number;
  readonly tabletRefTemperature: number;
  readonly wStuck: number;
  readonly xCarbonate: number;
  readonly xSilicate: number;
  readonly xPeroxide: number;
  readonly xTaed: number;
  readonly xProtease: number;
  readonly xAmylase: number;
  readonly xSurfactant: number;
  readonly supplyBicarbonate: number;
  readonly pK1: number;
  readonly pK1Slope: number;
  readonly pK2: number;
  readonly pK2Slope: number;
  readonly pKw: number;
  readonly pKwSlope: number;
  readonly pKwCurve: number;
  readonly pKaHP: number;
  readonly pKaHPSlope: number;
  readonly pKRefTemperature: number;
  readonly dpHni: number;
  readonly kPer: number;
  readonly kPerRefTemperature: number;
  readonly EPer: number;
  readonly Kr: number;
  readonly kDec: number;
  readonly kDecRefTemperature: number;
  readonly EDec: number;
  readonly kSoil: number;
  readonly kHPdec: number;
  readonly proteaseHalfLife: number;
  readonly proteasePhSlope: number;
  readonly proteaseRefPH: number;
  readonly proteaseEd: number;
  readonly proteaseKox: number;
  readonly proteaseKoxHP: number;
  readonly amylaseHalfLife: number;
  readonly amylaseEd: number;
  readonly amylaseKox: number;
  readonly amylaseKoxHP: number;
  readonly enzymeRefTemperature: number;
  readonly surfClass: number;
  readonly rinseAidDensity: number;
}

/** Reads the liquor parameters from a set built on a registry that holds the definitions. */
export function resolveLiquorParams(params: ParamSet): LiquorParams {
  const out: Record<string, number> = {};
  for (const d of LIQUOR_PARAM_DEFS) out[d.key.slice('liq.'.length)] = params.get(d.key);
  return out as unknown as LiquorParams;
}
