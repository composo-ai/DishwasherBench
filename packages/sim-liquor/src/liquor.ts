/**
 * The liquor of the first build (docs/design/scope.md; docs/research/chemistry.md section 10,
 * "Recommended model and defaults"; docs/design/sim-core.md section M9): one well-mixed tank
 * whose volume and temperature the machine's timeline gives, and whose chemistry is the
 * dossier's lumped model reduced to what the soil model of the first build reads.
 *
 *   release     d(m_tab)/dt = -(3 m_0 / tau(T)) w (m_tab / m_0)^(2/3),
 *               tau(T) = tau_ref exp[(E_tab / R)(1/T - 1/T_ref)],  w = 1, or w_stuck behind a blocked lid;
 *               only while the liquor circulates; every species of the dose enters in proportion
 *               to the dissolved mass
 *   water       a drain keeps the carried-over fraction of every amount; a fill adds supply
 *               water with its bicarbonate; concentrations are amounts over the current volume
 *   acid-base   Alk = 2 C_Na2CO3 + C_bicarb + B_silicate;  solve
 *               Alk = C_T (K1 H + 2 K1 K2) / (H^2 + K1 H + K1 K2) + Kw / H - H   for H (bisection),
 *               pH = -log10(H) + dpH_ni;   f_HOO = 1 / (1 + 10^(pKa,HP - pH))
 *   bleach      r_per = k_per(T) f_HOO HP TAED;   d(TAED)/dt = -r_per - k_per(T) f_HOO K_r TAED
 *               d(PAA)/dt = 2 r_per - [k_dec(T) + k_soil C_soil] PAA;   d(HP)/dt = -2 r_per - k_HPdec HP
 *   enzymes     d(E_i)/dt = -[k_th,i(T) + k_ox,i PAA + k_oxHP,i HP] E_i,
 *               k_th,i(T) = (ln 2 / t_half,i) exp[-(E_d,i / R)(1/T - 1/T_ref)], and for the
 *               protease times 10^(s_pH (pH - pH_ref)): it lasts longer in a milder liquor
 *   class       R after a rinse-aid dose in the current bath; D when the surfactant exceeds
 *               `liq.surfClass`; W otherwise
 *
 * Simplifications against the dossier (each ignores something calibration may ask for):
 * hardness, chelants and citrate are left out (softened water is assumed, so nothing slows the
 * enzymes or the bleach of stains through calcium); acid released by soils and by rinse aid
 * does not lower the alkalinity; the species of a dose dissolve together (no pouch film, no
 * staged release); soil in the liquor is one number (dissolved, fat and particles together)
 * and nothing is filtered out or redeposited; there is no foam; the liquor's temperature is
 * the machine's, so heat taken up by the load is the machine model's, not fed back from the
 * surfaces.
 *
 * Numerics: explicit sub-steps of at most {@link LIQUOR_NUMERICS}.subStep seconds, with the
 * exact solution of the tablet law and exact exponentials for the first-order losses. f64, one
 * thread, a fixed order: deterministic.
 *
 * Units: SI (m3, kg, mol, s); temperatures in degrees Celsius; concentrations of molecular
 * species in mol/m3 and of products, enzymes and soil in kg/m3.
 */

import { KELVIN_OFFSET } from '@spotless/core';
import type { ParamSet } from '@spotless/sim-params';
import { resolveLiquorParams, type LiquorParams } from './params.ts';

/** Arithmetic controls of the liquor model (not physical quantities). */
export const LIQUOR_NUMERICS = {
  /** Longest explicit sub-step, seconds (chemistry 10.13: 1 to 5 s is stable). */
  subStep: 0.5,
  /** Bisection steps of the pH solve: the bracket of 12 pH units shrinks below 1e-11. */
  // literal-ok-begin: named arithmetic control, documented where it is declared
  phIterations: 40,
  // literal-ok-end
  /** A volume below this holds no liquor, m3. */
  // literal-ok-begin: named arithmetic control, documented where it is declared
  minVolume: 1e-6,
  // literal-ok-end
} as const;

/** Codes of the liquor classes W (water-like), D (main-wash liquor), R (rinse-aid rinse). */
export const LIQUOR_CLASS_CODE = { W: 0, D: 1, R: 2 } as const;

/**
 * The liquor at one instant. Also the row of the per-tick liquor table of a wash: its numeric
 * members in the order of {@link LIQUOR_FIELDS}.
 */
export interface LiquorSample {
  /** Seconds from the start of the programme. */
  time: number;
  /** Liquor in circulation, m3. */
  volume: number;
  /** Temperature, degrees Celsius. */
  temperature: number;
  /** Detergent product dissolved in the liquor, kg/m3. */
  detergent: number;
  /** Detergent not yet dissolved (in the dispenser or as a tablet), kg. */
  tabletLeft: number;
  pH: number;
  /** Alkalinity, eq/m3, and total carbonate, mol/m3. */
  alkalinity: number;
  carbonate: number;
  /** Active protease and amylase, kg/m3 of granulate equivalent. */
  protease: number;
  amylase: number;
  /** Peracetic acid, hydrogen peroxide and TAED, mol/m3. */
  peracid: number;
  peroxide: number;
  taed: number;
  /** The part of the hydrogen peroxide present as the perhydroxyl anion HOO-, mol/m3. */
  perhydroxyl: number;
  /** Nonionic surfactant, kg/m3. */
  surfactant: number;
  /** Rinse aid, kg/m3. */
  rinseAid: number;
  /** Soil removed from the load and still in the liquor, kg/m3. */
  suspendedSoil: number;
  /** {@link LIQUOR_CLASS_CODE}: 0 W, 1 D, 2 R. */
  liquorClass: number;
}

/** The columns of the per-tick liquor table, in order: the members of {@link LiquorSample}. */
export const LIQUOR_FIELDS = [
  'time',
  'volume',
  'temperature',
  'detergent',
  'tabletLeft',
  'pH',
  'alkalinity',
  'carbonate',
  'protease',
  'amylase',
  'peracid',
  'peroxide',
  'taed',
  'perhydroxyl',
  'surfactant',
  'rinseAid',
  'suspendedSoil',
  'liquorClass',
] as const satisfies readonly (keyof LiquorSample)[];

/** Number of columns of the liquor table. */
export const LIQUOR_FIELD_COUNT = LIQUOR_FIELDS.length;

/** Writes a sample into row `row` of a liquor table of {@link LIQUOR_FIELD_COUNT} columns. */
export function writeLiquorRow(table: Float64Array, row: number, sample: LiquorSample): void {
  const o = LIQUOR_FIELD_COUNT * row;
  for (let i = 0; i < LIQUOR_FIELD_COUNT; i++) {
    table[o + i] = sample[LIQUOR_FIELDS[i] as keyof LiquorSample];
  }
}

/** Something that happens to the liquor at a moment of the programme. */
export type LiquorEvent =
  | {
      /** The tub is pumped out; `carryFraction` (0 to 1) of every dissolved amount stays. */
      readonly kind: 'drain';
      readonly carryFraction: number;
    }
  | {
      /** Supply water enters: `volume` m3. */
      readonly kind: 'fill';
      readonly volume: number;
    }
  | {
      /** The dispenser releases `mass` kg of detergent (it starts to dissolve). */
      readonly kind: 'detergent';
      readonly mass: number;
    }
  | {
      /** `volume` m3 of rinse aid is dosed. */
      readonly kind: 'rinseAid';
      readonly volume: number;
    };

/** Options of {@link createWashLiquor}. */
export interface WashLiquorOptions {
  /**
   * True when the load keeps the dispenser lid from opening: the dose is reached only by what
   * splashes through the gap and dissolves with the wetting factor `liq.wStuck`.
   */
  readonly dispenserBlocked?: boolean;
}

/** The liquor of one wash: events and time steps in, samples out. */
export interface WashLiquor {
  /** Applies a water change or a dose. */
  apply(event: LiquorEvent): void;
  /** Credits `mass` kg of removed soil to the liquor. */
  addSoil(mass: number): void;
  /**
   * Advances the chemistry by `dt` seconds with the liquor at `volume` m3 and `temperature`
   * degrees Celsius, and returns the liquor at the end of the step, stamped `time`. The dose
   * dissolves only while the liquor circulates (`circulating`, default true): standing water
   * in the sump does not reach the dispenser or wash over a tablet.
   */
  step(
    time: number,
    dt: number,
    volume: number,
    temperature: number,
    circulating?: boolean,
  ): LiquorSample;
  /** The liquor as it is now, without advancing it. */
  sample(time: number, volume: number, temperature: number): LiquorSample;
  /** Mass of detergent released by the dispenser so far, and of it dissolved, kg. */
  readonly dosed: number;
  readonly dissolved: number;
}

/** exp[-(E / R)(1/T - 1/T_ref)] with temperatures in degrees Celsius. */
export function arrhenius(
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
 * pH of a carbonate-buffered liquor (chemistry 10.4): the root of the alkalinity balance for
 * `alkalinity` (eq/m3) and total carbonate `carbonate` (mol/m3) at `temperature` (degrees
 * Celsius), plus the non-ideality offset `liq.dpHni`.
 */
export function liquorPH(
  p: LiquorParams,
  alkalinity: number,
  carbonate: number,
  temperature: number,
): number {
  const dT = temperature - p.pKRefTemperature;
  const k1 = Math.pow(10, -(p.pK1 + p.pK1Slope * dT));
  const k2 = Math.pow(10, -(p.pK2 + p.pK2Slope * dT));
  const kw = Math.pow(10, -(p.pKw + p.pKwSlope * dT + p.pKwCurve * dT * dT));
  // The solver works in mol/L.
  // literal-ok-begin: unit conversion (seconds per hour or minute, grams per kilogram, litres per cubic metre)
  const alk = alkalinity / 1000;
  const ct = Math.max(carbonate, 0) / 1000;
  // literal-ok-end
  // The right-hand side falls as H rises, so bisect on pH between 2 and 14.
  let lo = 2;
  let hi = 14;
  for (let i = 0; i < LIQUOR_NUMERICS.phIterations; i++) {
    const mid = 0.5 * (lo + hi);
    const h = Math.pow(10, -mid);
    const value = (ct * (k1 * h + 2 * k1 * k2)) / (h * h + k1 * h + k1 * k2) + kw / h - h;
    if (value < alk) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi) + p.dpHni;
}

/** Fraction of hydrogen peroxide present as the perhydroxyl anion at a pH and temperature. */
export function perhydroxylFraction(p: LiquorParams, pH: number, temperature: number): number {
  const pKa = p.pKaHP + p.pKaHPSlope * (temperature - p.pKRefTemperature);
  return 1 / (1 + Math.pow(10, pKa - pH));
}

/** Thermal deactivation rate of an enzyme, 1/s, from its half-life at the reference temperature. */
export function enzymeDecayRate(
  p: LiquorParams,
  halfLife: number,
  activationEnergy: number,
  temperature: number,
): number {
  return (
    (Math.LN2 / halfLife) *
    arrhenius(activationEnergy, p.gasConstant, temperature, p.enzymeRefTemperature)
  );
}

/** Dissolution time of the dose at a temperature, seconds. */
export function tabletTau(p: LiquorParams, temperature: number): number {
  return p.tabletTau / arrhenius(p.tabletEa, p.gasConstant, temperature, p.tabletRefTemperature);
}

/** First-order loss rates of the species that decay in a liquor, 1/s. Filled by {@link liquorLossRates}. */
export interface LiquorLossRates {
  /** Peracid: thermal decay and consumption by soil in the liquor. */
  peracid: number;
  /** Hydrogen peroxide: slow decay (perhydrolysis is not included). */
  peroxide: number;
  /** Protease and amylase: denaturation, and deactivation by peracid and peroxide. */
  protease: number;
  amylase: number;
}

/**
 * The first-order loss rates in a liquor at `temperature` (degrees Celsius) that holds
 * `peracid` and `peroxide` (mol/m3) and `soil` (kg/m3). The same rates apply in the sump and
 * in standing water on the load. With the `pH` of the liquor the thermal loss of protease
 * follows it (`liq.proteasePhSlope`); without it the loss is that at `liq.proteaseRefPH`.
 */
export function liquorLossRates(
  p: LiquorParams,
  temperature: number,
  peracid: number,
  peroxide: number,
  soil: number,
  out: LiquorLossRates,
  pH?: number,
): LiquorLossRates {
  out.peracid =
    p.kDec * arrhenius(p.EDec, p.gasConstant, temperature, p.kDecRefTemperature) +
    p.kSoil * Math.max(soil, 0);
  out.peroxide = p.kHPdec;
  out.protease =
    enzymeDecayRate(p, p.proteaseHalfLife, p.proteaseEd, temperature) *
      (pH === undefined ? 1 : Math.pow(10, p.proteasePhSlope * (pH - p.proteaseRefPH))) +
    p.proteaseKox * Math.max(peracid, 0) +
    p.proteaseKoxHP * Math.max(peroxide, 0);
  out.amylase =
    enzymeDecayRate(p, p.amylaseHalfLife, p.amylaseEd, temperature) +
    p.amylaseKox * Math.max(peracid, 0) +
    p.amylaseKoxHP * Math.max(peroxide, 0);
  return out;
}

/**
 * The liquor of one wash, empty at the start. `params` is a set built on a registry that
 * holds `LIQUOR_PARAM_DEFS`.
 */
export function createWashLiquor(params: ParamSet, options: WashLiquorOptions = {}): WashLiquor {
  const p = resolveLiquorParams(params);
  const wetting = options.dispenserBlocked === true ? p.wStuck : 1;

  // Amounts in the liquor: mol, eq or kg.
  let carbonate = 0;
  let alkalinity = 0;
  let peroxide = 0;
  let taed = 0;
  let peracid = 0;
  let protease = 0;
  let amylase = 0;
  let surfactant = 0;
  let detergent = 0;
  let rinseAid = 0;
  let soil = 0;
  // The dose: what was released, what of it is still solid.
  let dose = 0;
  let solid = 0;
  let dosed = 0;
  let dissolved = 0;

  const loss: LiquorLossRates = { peracid: 0, peroxide: 0, protease: 0, amylase: 0 };

  const scaleAll = (f: number): void => {
    carbonate *= f;
    alkalinity *= f;
    peroxide *= f;
    taed *= f;
    peracid *= f;
    protease *= f;
    amylase *= f;
    surfactant *= f;
    detergent *= f;
    rinseAid *= f;
    soil *= f;
  };

  const dissolve = (mass: number): void => {
    if (!(mass > 0)) return;
    dissolved += mass;
    detergent += mass;
    carbonate += p.xCarbonate * mass;
    alkalinity += (2 * p.xCarbonate + p.xSilicate) * mass;
    peroxide += p.xPeroxide * mass;
    taed += p.xTaed * mass;
    protease += p.xProtease * mass;
    amylase += p.xAmylase * mass;
    surfactant += p.xSurfactant * mass;
  };

  const sample = (time: number, volume: number, temperature: number): LiquorSample => {
    const v = Math.max(volume, LIQUOR_NUMERICS.minVolume);
    const has = volume > LIQUOR_NUMERICS.minVolume;
    const c = (amount: number): number => (has ? amount / v : 0);
    const surf = c(surfactant);
    const pH = liquorPH(p, c(alkalinity), c(carbonate), temperature);
    return {
      time,
      volume,
      temperature,
      detergent: c(detergent),
      tabletLeft: solid,
      pH,
      alkalinity: c(alkalinity),
      carbonate: c(carbonate),
      protease: c(protease),
      amylase: c(amylase),
      peracid: c(peracid),
      peroxide: c(peroxide),
      taed: c(taed),
      perhydroxyl: perhydroxylFraction(p, pH, temperature) * c(peroxide),
      surfactant: surf,
      rinseAid: c(rinseAid),
      suspendedSoil: c(soil),
      liquorClass:
        rinseAid > 0
          ? LIQUOR_CLASS_CODE.R
          : surf >= p.surfClass
            ? LIQUOR_CLASS_CODE.D
            : LIQUOR_CLASS_CODE.W,
    };
  };

  const advance = (dt: number, volume: number, temperature: number, pumping: boolean): void => {
    if (!(dt > 0)) return;
    const present = volume > LIQUOR_NUMERICS.minVolume;
    const v = Math.max(volume, LIQUOR_NUMERICS.minVolume);
    // The dose dissolves only into liquor that is there and moving: (m / m0)^(1/3) falls
    // linearly.
    if (solid > 0 && dose > 0 && present && pumping) {
      const root = Math.cbrt(solid / dose) - (wetting * dt) / tabletTau(p, temperature);
      const left = root > 0 ? dose * root * root * root : 0;
      dissolve(solid - left);
      solid = left;
    }
    if (!present) return;
    const pH = liquorPH(p, alkalinity / v, carbonate / v, temperature);
    const fHoo = perhydroxylFraction(p, pH, temperature);
    const tK = temperature + KELVIN_OFFSET;
    const kPer = p.kPer * Math.exp((-p.EPer / p.gasConstant) * (1 / tK - 1 / p.kPerRefTemperature));
    const hp = peroxide / v;
    const ta = taed / v;
    liquorLossRates(p, temperature, peracid / v, hp, soil / v, loss, pH);
    // Rates in mol/(m3 s), then amounts.
    const rPer = kPer * fHoo * hp * ta;
    const rHyd = kPer * fHoo * p.Kr * ta;
    const taedLoss = Math.min(taed, (rPer + rHyd) * v * dt);
    const made = rPer + rHyd > 0 ? (2 * taedLoss * rPer) / (rPer + rHyd) : 0;
    taed -= taedLoss;
    peroxide = Math.max(0, peroxide - made) * Math.exp(-loss.peroxide * dt);
    peracid = (peracid + made) * Math.exp(-loss.peracid * dt);
    protease *= Math.exp(-loss.protease * dt);
    amylase *= Math.exp(-loss.amylase * dt);
  };

  return {
    apply(event) {
      switch (event.kind) {
        case 'drain':
          // What has not dissolved by now stays where it lies (in the dispenser, on the tray)
          // and goes on dissolving into the next bath.
          scaleAll(Math.min(1, Math.max(event.carryFraction, 0)));
          break;
        case 'fill':
          carbonate += p.supplyBicarbonate * Math.max(event.volume, 0);
          alkalinity += p.supplyBicarbonate * Math.max(event.volume, 0);
          break;
        case 'detergent':
          dose = Math.max(event.mass, 0);
          solid = dose;
          dosed += dose;
          break;
        case 'rinseAid':
          rinseAid += p.rinseAidDensity * Math.max(event.volume, 0);
          break;
      }
    },
    addSoil(mass) {
      if (mass > 0) soil += mass;
    },
    step(time, dt, volume, temperature, circulating = true) {
      const steps = Math.max(1, Math.ceil(dt / LIQUOR_NUMERICS.subStep));
      for (let i = 0; i < steps; i++) advance(dt / steps, volume, temperature, circulating);
      return sample(time, volume, temperature);
    },
    sample,
    get dosed() {
      return dosed;
    },
    get dissolved() {
      return dissolved;
    },
  };
}
