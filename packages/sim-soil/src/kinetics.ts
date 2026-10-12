/**
 * Rate laws of the soil model of the first build as pure functions (docs/research/soils.md
 * sections 7.5, 8.3 and 8.4; docs/research/chemistry.md sections 3.4, 4.2 and 10.6;
 * docs/design/sim-core.md section M8, simplified as docs/design/scope.md directs).
 *
 * Every rate depends on the liquor a soil cell sees ({@link SoilChemistry}) and on the class,
 * never on the cell, so the rates of a tick are a small table: one row per class and liquor
 * ({@link classRates}). The per-cell loop (`soil.ts`) multiplies them by the cell's own
 * wetness, hydration and jet exposure.
 *
 *   lag        d(hyd)/dt = f_wet p F_T exp(a s_pH (pH - pH_ref)) / (t_lag (1 + k_lag B)),   a = 1/2,
 *              F_T the enzyme's temperature factor for a reaction class, an Arrhenius factor
 *              otherwise; p = 1 when the active agent is present (enzyme, alkali, oxidant) or
 *              the class needs none, else `soil.waterHydration`;
 *              gate g = clamp((hyd - 1) / ramp, 0, 1),   ramp = `soil.lagRamp` = 0.5
 *   reaction   J = J_ref f_T(T) exp(s_pH (pH - pH_ref)) [e_0 + (1 - e_0) theta_E / theta_E,ref]
 *              theta_E = E^n / (K^n + E^n)                                      (Hill)
 *              f_T(T)  = exp[-(E_a / R)(1/T - 1/T_ref)] (1 + exp[(dH / R)(1/T_m - 1/T_ref)])
 *                        / (1 + exp[(dH / R)(1/T_m - 1/T)])                     (activity with denaturation)
 *              J_OH = J_OH,ref a_T [10^(pH - 11.5) - f]+ / (1 - f),  f = 10^(10.5 - 11.5)   (zero at pH 10.5 and below)
 *   dissolve   J = J_ref a_T
 *   detach     strength = tau_a0 exp(-b_a beta_max x) / C_ad times h(T), the bond strength in
 *              liquor at T: h = 1 at T_cold and below, h_hot at T_hot and above, log-linear
 *              between (soils 2.4: tomato paste 90 % weaker hydrated at 50 C than at 25 C)
 *   melt       SFC(T) = SFC_max / (1 + exp((T - T50) / w)), the curve of the class;  tau_y = Y SFC^n
 *              mobile share phi = clamp((SFC_solid - SFC) / (SFC_solid - SFC_liquid), 0, 1)
 *              k = k_em a_T phi [s_0 + (1 - s_0) C_surf / (C_surf + C_half)]    (first order)
 *   bleach     k = [k_bl(T) C_PAA + r_HP k_bl(T) C_HOO] (1 + beta_ch)           (first order)
 *
 * Units: SI; temperatures in degrees Celsius; concentrations of enzymes and surfactant in
 * kg/m3 and of oxidants in mol/m3.
 */

import { KELVIN_OFFSET } from '@spotless/core';
import type { ParamSet } from '@spotless/sim-params';
import { SOIL_CLASS_LAW, SOIL_MODEL_CLASSES, type SoilLaw } from './params.ts';

/**
 * The liquor a soil cell sees: the sump liquor under a film, or the liquor of the pool it lies
 * under. Structurally a part of the `LiquorSample` of `@spotless/sim-liquor`, so a sample can
 * be passed as it is.
 */
export interface SoilChemistry {
  /** Temperature of the liquor at the surface, degrees Celsius. */
  readonly temperature: number;
  readonly pH: number;
  /** Active protease and amylase, kg/m3 of granulate equivalent. */
  readonly protease: number;
  readonly amylase: number;
  /** Peracetic acid, mol/m3, and the perhydroxyl anion HOO-, mol/m3. */
  readonly peracid: number;
  readonly perhydroxyl: number;
  /** Nonionic surfactant, kg/m3. */
  readonly surfactant: number;
}

/** Law codes, in the order of {@link SOIL_LAWS}. */
export const SOIL_LAWS: readonly SoilLaw[] = ['reaction', 'detach', 'melt', 'dissolve', 'bleach'];

/** The class parameters as arrays indexed by class code, resolved once per wash. */
export interface SoilConstants {
  readonly classCount: number;
  /** Index into {@link SOIL_LAWS} per class. */
  readonly law: Uint8Array;
  readonly gasConstant: number;
  readonly refTemperature: number;
  readonly refPH: number;
  readonly phMin: number;
  readonly phMax: number;
  readonly lagRamp: number;
  readonly lagPhShare: number;
  readonly lagPhMin: number;
  readonly lagEnzymeMin: number;
  readonly hillN: number;
  readonly KE: number;
  readonly enzymeDH: number;
  readonly rateOHEa: number;
  readonly rateOHRefTemperature: number;
  readonly rateOHRefPH: number;
  readonly decayOnset: number;
  readonly jetDetach: number;
  readonly jetPassGain: number;
  readonly detachExcessCap: number;
  readonly adhesionCv: number;
  readonly subCellCv: number;
  readonly bakeRateFactor: number;
  readonly bakeLagFactor: number;
  readonly bakeAdhesionFactor: number;
  readonly adhesionTau0: number;
  readonly adhesionB: number;
  readonly adhesionHotFactor: number;
  readonly adhesionColdTemperature: number;
  readonly adhesionHotTemperature: number;
  readonly betaMax: number;
  readonly Cad: number;
  readonly detachTime: number;
  readonly fatSfcLiquid: number;
  readonly fatSfcSolid: number;
  readonly fatYield: number;
  readonly fatYieldExponent: number;
  readonly fatEmulsify: number;
  readonly fatEa: number;
  readonly fatSurfHalf: number;
  readonly fatWaterShare: number;
  readonly fatRollUp: readonly number[];
  readonly dissolveRate: number;
  readonly dissolveEa: number;
  readonly bleachRate: number;
  readonly bleachRefTemperature: number;
  readonly bleachEa: number;
  readonly bleachPeroxideRatio: number;
  readonly bleachChelant: number;
  /** Per class. */
  readonly fatSfcMax: Float64Array;
  readonly fatT50: Float64Array;
  readonly fatWidth: Float64Array;
  readonly tLag: Float64Array;
  readonly lagEa: Float64Array;
  readonly waterHydration: Float64Array;
  readonly rateRef: Float64Array;
  readonly enzymeRef: Float64Array;
  readonly enzymeFree: Float64Array;
  readonly sPH: Float64Array;
  readonly enzymeEa: Float64Array;
  readonly enzymeTm: Float64Array;
  readonly rateOH: Float64Array;
  readonly tauStar: Float64Array;
  readonly jetRatio: Float64Array;
  /** Bake index of the soil the reference rates of the class were measured on. */
  readonly bakeReference: Float64Array;
  /** 0 none, 1 protease, 2 amylase, per class. */
  readonly enzyme: Uint8Array;
}

/** Reads the soil constants from a set built on a registry that holds `SOIL_PARAM_DEFS`. */
export function resolveSoilConstants(params: ParamSet): SoilConstants {
  const classes = SOIL_MODEL_CLASSES;
  const table = (name: string): Float64Array => params.soilClassTable(name, classes);
  const g = (name: string): number => params.get(`soil.${name}`);
  return {
    classCount: classes.length,
    law: Uint8Array.from(classes, (cls) => SOIL_LAWS.indexOf(SOIL_CLASS_LAW[cls].law)),
    enzyme: Uint8Array.from(classes, (cls) => {
      const enzyme = SOIL_CLASS_LAW[cls].enzyme;
      return enzyme === 'protease' ? 1 : enzyme === 'amylase' ? 2 : 0;
    }),
    gasConstant: g('gasConstant'),
    refTemperature: g('refTemperature'),
    refPH: g('refPH'),
    phMin: g('phMin'),
    phMax: g('phMax'),
    lagRamp: g('lagRamp'),
    lagPhShare: g('lagPhShare'),
    lagPhMin: g('lagPhMin'),
    lagEnzymeMin: g('lagEnzymeMin'),
    hillN: g('hillN'),
    KE: g('KE'),
    enzymeDH: g('enzymeDH'),
    rateOHEa: g('rateOHEa'),
    rateOHRefTemperature: g('rateOHRefTemperature'),
    rateOHRefPH: g('rateOHRefPH'),
    decayOnset: g('decayOnset'),
    jetDetach: g('jetDetach'),
    jetPassGain: g('jetPassGain'),
    detachExcessCap: g('detachExcessCap'),
    adhesionCv: g('adhesionCv'),
    subCellCv: g('subCellCv'),
    bakeRateFactor: g('bakeRateFactor'),
    bakeLagFactor: g('bakeLagFactor'),
    bakeAdhesionFactor: g('bakeAdhesionFactor'),
    adhesionTau0: g('adhesionTau0'),
    adhesionB: g('adhesionB'),
    adhesionHotFactor: g('adhesionHotFactor'),
    adhesionColdTemperature: g('adhesionColdTemperature'),
    adhesionHotTemperature: g('adhesionHotTemperature'),
    betaMax: g('betaMax'),
    Cad: g('Cad'),
    detachTime: g('detachTime'),
    fatSfcMax: table('fatSfcMax'),
    fatT50: table('fatT50'),
    fatWidth: table('fatWidth'),
    fatSfcLiquid: g('fatSfcLiquid'),
    fatSfcSolid: g('fatSfcSolid'),
    fatYield: g('fatYield'),
    fatYieldExponent: g('fatYieldExponent'),
    fatEmulsify: g('fatEmulsify'),
    fatEa: g('fatEa'),
    fatSurfHalf: g('fatSurfHalf'),
    fatWaterShare: g('fatWaterShare'),
    fatRollUp: params.getVector('soil.fatRollUp'),
    dissolveRate: g('dissolveRate'),
    dissolveEa: g('dissolveEa'),
    bleachRate: g('bleachRate'),
    bleachRefTemperature: g('bleachRefTemperature'),
    bleachEa: g('bleachEa'),
    bleachPeroxideRatio: g('bleachPeroxideRatio'),
    bleachChelant: g('bleachChelant'),
    tLag: table('tLag'),
    lagEa: table('lagEa'),
    waterHydration: table('waterHydration'),
    rateRef: table('rateRef'),
    enzymeRef: table('enzymeRef'),
    enzymeFree: table('enzymeFree'),
    sPH: table('sPH'),
    enzymeEa: table('enzymeEa'),
    enzymeTm: table('enzymeTm'),
    rateOH: table('rateOH'),
    tauStar: table('tauStar'),
    jetRatio: table('jetRatio'),
    bakeReference: table('bakeReference'),
  };
}

/** exp[-(E / R)(1/T - 1/T_ref)] with temperatures in degrees Celsius. */
export function soilArrhenius(
  activationEnergy: number,
  gasConstant: number,
  temperature: number,
  refTemperature: number,
): number {
  return Math.exp(
    (-activationEnergy / gasConstant) *
      (1 / (temperature + KELVIN_OFFSET) - 1 / (refTemperature + KELVIN_OFFSET)),
  );
}

/**
 * Activity of an enzyme against temperature, 1 at the reference temperature (chemistry 10.6):
 * an Arrhenius rise cut off by denaturation about the mid-point `tm` (degrees Celsius).
 */
export function enzymeTemperatureFactor(
  activationEnergy: number,
  tm: number,
  dH: number,
  gasConstant: number,
  temperature: number,
  refTemperature: number,
): number {
  const tK = temperature + KELVIN_OFFSET;
  const refK = refTemperature + KELVIN_OFFSET;
  const tmK = tm + KELVIN_OFFSET;
  const fold = (t: number): number => 1 + Math.exp((dH / gasConstant) * (1 / tmK - 1 / t));
  return (
    soilArrhenius(activationEnergy, gasConstant, temperature, refTemperature) *
    (fold(refK) / fold(tK))
  );
}

/** Hill response of an enzyme level, 1 at the reference dose: theta(E) / theta(E_ref). */
export function hillRatio(level: number, reference: number, k: number, n: number): number {
  if (!(level > 0)) return 0;
  const kn = Math.pow(k, n);
  const theta = (e: number): number => Math.pow(e, n) / (kn + Math.pow(e, n));
  return theta(level) / theta(reference);
}

/**
 * Solid fat content of the fat of class `classCode` at a temperature (degrees Celsius): the
 * logistic of chemistry 4.2 with the melting curve registered for the class (butter for `fat`,
 * and margarine, lard, tallow and liquid oil for the classes split from it).
 */
export function solidFatContent(c: SoilConstants, temperature: number, classCode: number): number {
  const max = c.fatSfcMax[classCode] as number;
  if (!(max > 0)) return 0;
  return (
    max /
    (1 +
      Math.exp((temperature - (c.fatT50[classCode] as number)) / (c.fatWidth[classCode] as number)))
  );
}

/**
 * Wall shear a deposit of the `detach` law withstands, Pa, at hydration `x` (0 dry, 1 soaked
 * through): the bond strength tau_a0 exp(-b_a beta_max x) over the correction factor C_ad,
 * times the bake factor of the deposit.
 */
export function adhesiveStrength(c: SoilConstants, x: number, bakeFactor: number): number {
  const soaked = Math.min(1, Math.max(x, 0));
  return (c.adhesionTau0 * bakeFactor * Math.exp(-c.adhesionB * c.betaMax * soaked)) / c.Cad;
}

/**
 * Factor on the bond strength of a `detach` soil hydrated in liquor at `temperature` (degrees
 * Celsius): 1 at `soil.adhesionColdTemperature` and below, `soil.adhesionHotFactor` at
 * `soil.adhesionHotTemperature` and above, log-linear between (tomato paste: 90 % lower at
 * 50 C than at 25 C, soils 2.4).
 */
export function adhesionTemperatureFactor(c: SoilConstants, temperature: number): number {
  const span = c.adhesionHotTemperature - c.adhesionColdTemperature;
  if (!(span > 0) || !(c.adhesionHotFactor > 0) || c.adhesionHotFactor >= 1) return 1;
  const x = Math.min(1, Math.max(0, (temperature - c.adhesionColdTemperature) / span));
  return Math.pow(c.adhesionHotFactor, x);
}

/** The rates of one tick for one liquor, per class code. Filled by {@link classRates}. */
export interface ClassRates {
  /**
   * Lag progress per second of wetted time, before the bake factor, 1/s; 0 for a class without
   * a lag (its deposits start with the lag over).
   */
  readonly lag: Float64Array;
  /** `reaction`, `dissolve`: dry mass flux of a hydrated wet cell, before the bake factor, kg/(m2 s). */
  readonly flux: Float64Array;
  /** `reaction`: the same for the enzyme-free alkaline path, kg/(m2 s). */
  readonly alkaline: Float64Array;
  /** `melt`, `bleach`: first-order removal rate of a wet cell, 1/s. */
  readonly first: Float64Array;
  /**
   * `melt`: yield stress of the fat at the liquor's temperature, Pa. `detach`: the factor on
   * the bond strength at the liquor's temperature ({@link adhesionTemperatureFactor}).
   */
  readonly strength: Float64Array;
}

/** Fresh rate arrays for `classCount` classes. */
export function createClassRates(classCount: number): ClassRates {
  return {
    lag: new Float64Array(classCount),
    flux: new Float64Array(classCount),
    alkaline: new Float64Array(classCount),
    first: new Float64Array(classCount),
    strength: new Float64Array(classCount),
  };
}

/** Fills `out` with the rates of every class in the liquor `chem`. */
export function classRates(c: SoilConstants, chem: SoilChemistry, out: ClassRates): ClassRates {
  const t = chem.temperature;
  const pH = Math.min(c.phMax, Math.max(chem.pH, c.phMin));
  for (let k = 0; k < c.classCount; k++) {
    const law = SOIL_LAWS[c.law[k] as number];
    const enzymeKind = c.enzyme[k] as number;
    const level = enzymeKind === 1 ? chem.protease : enzymeKind === 2 ? chem.amylase : 0;
    const reference = c.enzymeRef[k] as number;
    const sPH = c.sPH[k] as number;
    let lagT: number;
    let agent: boolean;
    let flux = 0;
    let alkaline = 0;
    let first = 0;
    let strength = 0;
    if (law === 'reaction') {
      const fT = enzymeTemperatureFactor(
        c.enzymeEa[k] as number,
        c.enzymeTm[k] as number,
        c.enzymeDH,
        c.gasConstant,
        t,
        c.refTemperature,
      );
      const free = c.enzymeFree[k] as number;
      const response = free + (1 - free) * hillRatio(level, reference, c.KE * reference, c.hillN);
      flux = (c.rateRef[k] as number) * fT * Math.exp(sPH * (pH - c.refPH)) * response;
      // Zero at the reference pH of the rates and below, 1 at the reference pH of this path.
      const floor = Math.pow(10, c.refPH - c.rateOHRefPH);
      alkaline =
        ((c.rateOH[k] as number) *
          soilArrhenius(c.rateOHEa, c.gasConstant, t, c.rateOHRefTemperature) *
          Math.max(0, Math.pow(10, chem.pH - c.rateOHRefPH) - floor)) /
        (1 - floor);
      lagT = fT;
      agent = level >= c.lagEnzymeMin * reference || chem.pH >= c.lagPhMin;
    } else {
      lagT = soilArrhenius(c.lagEa[k] as number, c.gasConstant, t, c.refTemperature);
      agent = law === 'bleach' ? chem.peracid > 0 || chem.perhydroxyl > 0 : true;
      if (law === 'detach') strength = adhesionTemperatureFactor(c, t);
      if (law === 'dissolve') {
        flux = c.dissolveRate * soilArrhenius(c.dissolveEa, c.gasConstant, t, c.refTemperature);
      } else if (law === 'melt') {
        const sfc = solidFatContent(c, t, k);
        const mobile = Math.min(
          1,
          Math.max((c.fatSfcSolid - sfc) / (c.fatSfcSolid - c.fatSfcLiquid), 0),
        );
        const surf = Math.max(chem.surfactant, 0);
        first =
          c.fatEmulsify *
          soilArrhenius(c.fatEa, c.gasConstant, t, c.refTemperature) *
          mobile *
          (c.fatWaterShare + ((1 - c.fatWaterShare) * surf) / (surf + c.fatSurfHalf));
        strength = c.fatYield * Math.pow(sfc, c.fatYieldExponent);
      } else if (law === 'bleach') {
        const kbl =
          c.bleachRate * soilArrhenius(c.bleachEa, c.gasConstant, t, c.bleachRefTemperature);
        first =
          kbl *
          (Math.max(chem.peracid, 0) + c.bleachPeroxideRatio * Math.max(chem.perhydroxyl, 0)) *
          (1 + c.bleachChelant);
      }
    }
    const tLag = c.tLag[k] as number;
    out.lag[k] =
      tLag > 0
        ? ((agent ? 1 : (c.waterHydration[k] as number)) *
            lagT *
            Math.exp(c.lagPhShare * sPH * (pH - c.refPH))) /
          tLag
        : 0;
    out.flux[k] = flux;
    out.alkaline[k] = alkaline;
    out.first[k] = first;
    out.strength[k] = strength;
  }
  return out;
}
