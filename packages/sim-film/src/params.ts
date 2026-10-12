/**
 * The registered parameters of the surface-water stage of the first build
 * (docs/design/scope.md, "Surface water"; docs/design/sim-core.md section M7).
 *
 * The `film.standIn*` keys belong to the labelled STAND-IN (`stand-in.ts`), which is kept for
 * comparison. The others are those of the kinematic cascade (`cascade.ts`): the friction law,
 * the regime machine (film, rivulet, beads), lines, edges, puddles and contacts, and the
 * driver (pilot, settle and recorded revolutions, drain-down). The wetting threshold itself
 * (`film.kappaW`, `film.nBeta`, `film.Cb`, `film.sinBetaFloor`) is declared by
 * `@spotless/sim-params`, and the liquor (`film.sigma`, `film.liquorClass`) by
 * `@spotless/sim-spray`. All are in the `hydro` hash group.
 */

import type { AnyParamDef, ParamDef, ParamSet } from '@spotless/sim-jets';

/** The parameters the surface-water stage reads, to be contributed to the registry. */
export const FILM_PARAM_DEFS: readonly AnyParamDef[] = [
  {
    key: 'film.standInThickness',
    unit: 'm',
    default: 100e-6,
    min: 20e-6,
    max: 500e-6,
    tag: 'SYN',
    source:
      'stand-in of the first build: thickness of the film on every wet block while a spray state is active; of the order of the gravity film of sim-core M8 (147 um at 0.02 kg/(m s), 55 C)',
    group: 'hydro',
    calibration: 'filmStress',
  },
  {
    key: 'film.standInResidual',
    unit: 'm',
    default: 10e-6,
    min: 2e-6,
    max: 50e-6,
    tag: 'ESTIMATED',
    source:
      'stand-in of the first build: film left on a wet block after the spray stops and it has drained; chemistry 11 row 18 (retained water after the final rinse, 5 to 15 um)',
    group: 'hydro',
    calibration: 'carryOver',
  },
  {
    key: 'film.standInHoldTime',
    unit: 's',
    default: 30,
    min: 2,
    max: 600,
    tag: 'SYN',
    source:
      'stand-in of the first build: time a block stays wet after the water stops arriving (a draining remnant; films 8.1)',
    group: 'hydro',
    calibration: 'wetting',
  },
  // ---- the kinematic cascade: flow
  fix(
    'film.frictionLam',
    '1',
    24,
    'VERIFIED',
    'films 3.3; sim-core M7.3: friction factor f = max(24 / Re, 0.288 Re^(-0.40)), Re = 4 q / nu (the laminar branch gives the Nusselt film q = g_s h^3 / (3 nu))',
  ),
  num(
    'film.frictionTurbCoef',
    '1',
    0.288,
    0.2,
    0.4,
    'VERIFIED',
    'films 3.3; sim-core M7.3: coefficient of the turbulent branch of the friction factor',
    'filmStress',
  ),
  fix(
    'film.frictionTurbExp',
    '1',
    0.4,
    'VERIFIED',
    'films 3.3; sim-core M7.3: exponent of the turbulent branch of the friction factor',
  ),
  num(
    'film.minSlope',
    '1',
    0.02,
    0.002,
    0.2,
    'SYN',
    'cascade of the first build: the gravity that drives a film along a surface is at least g times this (about 1 degree): on nearly level ground the head of the film itself moves it, which the cascade does not carry',
  ),
  num(
    'film.lineKw',
    '1',
    25,
    8,
    80,
    'ESTIMATED',
    'sim-core M7.5 "LINE model": velocity of the liquid along a wire, u = g_l (lambda / rho) / (k_w nu); 8 pi for a round thread',
    'filmStress',
  ),
  // ---- the regime machine (films 5, 12.4; sim-core M7.3)
  num(
    'film.thetaFilm',
    'rad',
    0.105,
    0.05,
    0.14,
    'ESTIMATED',
    'films 12.4 ("if theta_r < 5 degrees the cell stays wet"); sim-core M7.3, M7.9 (5 degrees, range 3 to 8): a surface whose receding angle is below this holds whatever film reaches it and never breaks it up. 6 degrees here, so that glazed ware in wash liquor (5 degrees in the catalogue) is on the film side, as sim-core M7.3 states it, and stainless steel (10 degrees) is not',
    'wetting',
  ),
  num(
    'film.thetaFilmWidth',
    'rad',
    0.035,
    0,
    0.2,
    'SYN',
    'review of the first build: width of the ramp above film.thetaFilm over which a material goes from never dewetting to dewetting at the full speed of film.kDw (the dewetting time is divided by the ramp, the dry share of a rivulet multiplied by it); 0 restores the switch. 2 degrees: sim-core M7.9 gives the threshold itself a range of 3 to 8 degrees',
    'wetting',
  ),
  fix(
    'film.deltaStarGravityExp',
    '1',
    0.4,
    'VERIFIED',
    'films 5.1; sim-core M7.3: the wetting thickness delta* scales as g_e^(-2/5)',
  ),
  num(
    'film.deltaDry',
    'm',
    2e-6,
    1e-6,
    1e-5,
    'ESTIMATED',
    'films 12.4, 12.7: below this thickness a draining rivulet breaks into beads; the thickness to which the hold time of a film is extrapolated',
  ),
  num(
    'film.rivuletMin',
    '1',
    0.1,
    0.02,
    0.5,
    'VERIFIED',
    'films 5.2; sim-core M7.3: wetted width fraction of rivulets, f = max(f_min, f_1 (Gamma / Gamma*_a)^(1/4)), anchored on the measured 0.1 to 0.2 below the transition',
    'wetting',
  ),
  num('film.rivuletF1', '1', 0.2, 0.05, 1, 'ESTIMATED', 'films 5.2; sim-core M7.3', 'wetting'),
  num(
    'film.kDw',
    '1',
    0.005,
    0.001,
    0.05,
    'ESTIMATED',
    'films 5.5; sim-core M7.3: dewetting speed V_dw = k_dw (sigma / mu) theta_r^3 (1.9 mm/s at 10 degrees in wash liquor at 55 C)',
    'wetting',
  ),
  num(
    'film.beadCover',
    '1',
    0.3,
    0.05,
    1,
    'ESTIMATED',
    'films 8.2 (0.5 to 2 drops per cm2): share of a block that beads cover when its bead store is full; a block with beads counts as wet over that share',
    'wetting',
  ),
  // ---- edges, puddles, contacts (films 6.4, 7.2, 8.2, 12.5; sim-core M7.5, M7.6)
  num(
    'film.dropPinning',
    '1',
    1,
    0.7,
    1.1,
    'RECALLED',
    'films 5.7 (Furmidge 1962): a drop of width w stays on a surface inclined at beta while rho g V sin(beta) <= k w sigma (cos theta_r - cos theta_a), k about 1 (measured 0.76 to 0.98 for water). The cascade uses it for the pendant drops of a lower edge that is not level: the edge keeps its whole ridge (film.edgeHold) up to sin(beta_0) = k sigma (cos theta_r - cos theta_a) / (g edgeHold), about 3 degrees for glazed ware in wash liquor, and the share sin(beta_0) / sin(beta) beyond',
    'carryOver',
  ),
  {
    ...num(
      'film.edgeHold',
      'kg/m',
      0.008,
      0.002,
      0.03,
      'ESTIMATED',
      'films 8.2: a lower edge or low point keeps 0.1 to 0.35 mL per 12 to 25 mm as a pendant ridge and last drops',
      'carryOver',
    ),
    bracket: 'G4',
  },
  {
    ...num(
      'film.undersideHold',
      'm',
      0.2e-3,
      0.02e-3,
      0.6e-3,
      'ESTIMATED',
      'films 3.5, 6.4, 8.2: water a level underside keeps as a pendant film and drops, as a thickness (pendant drops of 3.3 l_c at the spacing 2 pi sqrt(2) l_c would be 0.5 mm; after dripping, less)',
      'carryOver',
    ),
    bracket: 'G4',
  },
  num(
    'film.puddleDepth',
    'm',
    1.5e-3,
    0.3e-3,
    5e-3,
    'ESTIMATED',
    'films 7.2: a level upward face holds a puddle up to 2 l_c sin(theta / 2) at its bounding edge before it spills. The cascade keeps 2 l_c sin(theta_r / 2) with the receding angle of the material (what is left once it has drained), and at most this depth',
    'carryOver',
  ),
  {
    ...num(
      'film.contactTransfer',
      '1',
      0.5,
      0,
      1,
      'SYN',
      'sim-core M7.5 "Contacts": share of the discharge reaching a contact that crosses to the lower body',
      'contacts',
    ),
    bracket: 'G4',
  },
  {
    ...num(
      'film.bridgeGap',
      'm',
      1e-3,
      0.1e-3,
      4e-3,
      'ESTIMATED',
      'films 8.2, 12.5 (a meniscus of about the capillary length): water crosses, and is held, where two bodies are closer than this',
      'contacts',
    ),
    bracket: 'G4',
  },
  {
    ...num(
      'film.bridgeDepth',
      'm',
      0.15e-3,
      0.02e-3,
      0.5e-3,
      'ESTIMATED',
      'films 12.5, 12.7 (20 uL per contact point), per unit of the area that faces a gap narrower than film.bridgeGap, as a depth of water on each of the two surfaces: independent of the block size, where a volume per contact link was not (review of the first build). 0.15 mm on the 1 to 2 cm2 about a contact point is 15 to 30 uL',
      'carryOver',
    ),
    bracket: 'G4',
  },
  num(
    'film.gapNoFlow',
    'm',
    0.4e-3,
    0.1e-3,
    2e-3,
    'SYN',
    'sim-core M7.6: blocks facing a gap narrower than this carry almost no film flow',
    'contacts',
  ),
  num(
    'film.gapFlowFactor',
    '1',
    0.1,
    0,
    1,
    'SYN',
    'cascade of the first build: factor on the discharge of a block that faces a gap narrower than film.gapNoFlow (water held there exchanges slowly)',
    'contacts',
  ),
  num(
    'film.gapReservoirWidth',
    '1',
    2,
    0.5,
    4,
    'ESTIMATED',
    'standards P04 ("gaps below about twice the capillary length ... hold liquid that does not exchange"), P40; sim-core M7.6 "Gap reservoirs": a gap between two bodies narrower than this many capillary lengths of the liquor is bridged by liquid where it lies within the capillary rise height 2 sigma cos(theta_r) / (rho g w) above the low point of the gap; each of the two surfaces then holds half the width of the gap as standing water. Gaps wider than scene.contactGap are not seen',
    'contacts',
  ),
  num(
    'film.etaGap',
    '1',
    0.02,
    0,
    1,
    'SYN',
    'sim-core M7.6 "Gap reservoirs" and M10 "Pools and gaps" (V_g dc/dt = eta_gap Q_pass (c_film - c)); standards P04 ("gaps below about twice the capillary length ... hold liquid that does not exchange"), P15: the share of the film that passes a liquid-filled gap which mixes into the liquid the gap holds. The liquor a surface inside a gap reservoir sees is replaced at eta_gap times the throughput of its block over the water the block holds for the gap (surface-water table, column `exchange`), and it is standing liquid: no film shear. 0: the held liquid never exchanges; 1: one stirred store with the film (the build of water-4). No measurement: the three proposals of the design used 0.1, 0.02 and 0 (its range 0 to 0.1); the registered range reaches 1 so that the stirred store can be set',
    'contacts',
  ),
  num(
    'film.dewetBeadShare',
    '1',
    0.5,
    0,
    1,
    'ESTIMATED',
    'films 8.2 (beads on partially wetting surfaces: 10 to 60 g/m2 with water, "a spray-wetted surface that has just de-wetted should hold less than a surface saturated by condensation") and 12.4 (bead store, capacity b_max): share of the bead capacity that a film leaves behind as drops on the part of a block it uncovers when it breaks up into a rivulet. The weakest number of the retained water; calibration decides it',
    'carryOver',
  ),
  num(
    'film.renewalLength',
    'm',
    4e-3,
    1e-3,
    0.1,
    'SYN',
    'surface-water table, column `renewal`: the run of film over which the column counts the water of a block as replaced (discharge per width over the water per area, divided by this length). The side of a block of the fast tier, so that the column does not change with the block size',
  ),
  // ---- the driver (sim-core M7.7)
  num(
    'film.pilotRevolutions',
    '1',
    4,
    0,
    64,
    'SYN',
    'cascade of the first build, in place of the steady-routing pilot of sim-core M7.2: revolutions marched at a coarse step before the settle revolutions, so that slow thin films are near their periodic state',
  ),
  num(
    'film.soakRevolutions',
    '1',
    64,
    0,
    4096,
    'SYN',
    'cascade (sim-core M7.2, the steady-routing pilot): revolutions one soak step stands for. The march begins with film.soakSteps implicit steps this long, with the time-mean forcing of a revolution, so that faces fed only by thin spray (which collect drops for minutes before they wet, and whose films take as long to fill) are near the periodic state of a spray that runs for tens of minutes. 64 revolutions are about 100 to 140 s; 0 leaves the soak out',
  ),
  num(
    'film.soakSteps',
    '1',
    3,
    0,
    16,
    'SYN',
    'cascade: number of soak steps (see film.soakRevolutions). The first wets and fills, the next let a film that breaks up on a material that dewets settle into its regime',
  ),
  num(
    'film.pilotCoarsening',
    '1',
    8,
    1,
    64,
    'SYN',
    'cascade of the first build: phase bins one step of the pilot covers',
  ),
  num(
    'film.drainTime',
    's',
    60,
    5,
    600,
    'SYN',
    'sim-core M7.7 "Drain-down": the film is marched this long with all sources off',
  ),
  num(
    'film.drainGrowth',
    '1',
    1.25,
    1.01,
    1.5,
    'SYN',
    'cascade of the first build: the step of the drain-down grows by this factor per step (sim-core M7.7 doubles it every 512 steps)',
  ),
  num(
    'film.drainMaxStep',
    's',
    2,
    0.05,
    5,
    'SYN',
    'cascade of the first build: longest step of the drain-down (0.25 s in sim-core M7.7)',
  ),
  num(
    'film.holdMax',
    's',
    3600,
    60,
    36000,
    'SYN',
    'cascade of the first build: longest hold time written for a film that is still continuous at the end of the drain-down (extrapolated by Jeffreys drainage, h ~ t^(-1/2), to film.deltaDry)',
  ),
  num(
    'film.massTolerance',
    '1',
    0.01,
    1e-4,
    0.5,
    'SYN',
    'sim-core M7.7 (eps_mass; 0.1 % in the full design, whose pilot starts every state near its periodic state): the periodic state counts as reached when the water held on the surfaces changes by less than this share of the nozzle outflow per revolution',
  ),
];

function num(
  key: string,
  unit: string,
  value: number,
  min: number,
  max: number,
  tag: ParamDef['tag'],
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
    group: 'hydro',
    ...(calibration === undefined ? {} : { calibration }),
  };
}

function fix(
  key: string,
  unit: string,
  value: number,
  tag: ParamDef['tag'],
  source: string,
): ParamDef {
  return { key, unit, default: value, min: value, max: value, tag, source, group: 'hydro' };
}

/** The surface-water parameters as numbers. */
export interface FilmParams {
  readonly standInThickness: number;
  readonly standInResidual: number;
  readonly standInHoldTime: number;
  readonly frictionLam: number;
  readonly frictionTurbCoef: number;
  readonly frictionTurbExp: number;
  readonly minSlope: number;
  readonly lineKw: number;
  readonly thetaFilm: number;
  readonly deltaDry: number;
  readonly rivuletMin: number;
  readonly rivuletF1: number;
  readonly kDw: number;
  readonly beadCover: number;
  readonly edgeHold: number;
  readonly dropPinning: number;
  readonly undersideHold: number;
  readonly puddleDepth: number;
  readonly contactTransfer: number;
  readonly bridgeGap: number;
  readonly bridgeDepth: number;
  readonly thetaFilmWidth: number;
  readonly deltaStarGravityExp: number;
  readonly gapNoFlow: number;
  readonly gapFlowFactor: number;
  readonly gapReservoirWidth: number;
  /** Share of the passing film that mixes into the liquid a gap holds. */
  readonly etaGap: number;
  readonly dewetBeadShare: number;
  readonly renewalLength: number;
  readonly pilotRevolutions: number;
  readonly soakRevolutions: number;
  readonly soakSteps: number;
  readonly pilotCoarsening: number;
  readonly drainTime: number;
  readonly drainGrowth: number;
  readonly drainMaxStep: number;
  readonly holdMax: number;
  readonly massTolerance: number;
  /** The shared wetting threshold of `@spotless/sim-params`. */
  readonly kappaW: number;
  readonly nBeta: number;
  readonly sinBetaFloor: number;
}

/** Reads the surface-water parameters from a set built on a registry that holds them. */
export function resolveFilmParams(params: ParamSet): FilmParams {
  return {
    standInThickness: params.get('film.standInThickness'),
    standInResidual: params.get('film.standInResidual'),
    standInHoldTime: params.get('film.standInHoldTime'),
    frictionLam: params.get('film.frictionLam'),
    frictionTurbCoef: params.get('film.frictionTurbCoef'),
    frictionTurbExp: params.get('film.frictionTurbExp'),
    minSlope: params.get('film.minSlope'),
    lineKw: params.get('film.lineKw'),
    thetaFilm: params.get('film.thetaFilm'),
    deltaDry: params.get('film.deltaDry'),
    rivuletMin: params.get('film.rivuletMin'),
    rivuletF1: params.get('film.rivuletF1'),
    kDw: params.get('film.kDw'),
    beadCover: params.get('film.beadCover'),
    edgeHold: params.get('film.edgeHold'),
    dropPinning: params.get('film.dropPinning'),
    undersideHold: params.get('film.undersideHold'),
    puddleDepth: params.get('film.puddleDepth'),
    contactTransfer: params.get('film.contactTransfer'),
    bridgeGap: params.get('film.bridgeGap'),
    bridgeDepth: params.get('film.bridgeDepth'),
    thetaFilmWidth: params.get('film.thetaFilmWidth'),
    deltaStarGravityExp: params.get('film.deltaStarGravityExp'),
    gapNoFlow: params.get('film.gapNoFlow'),
    gapFlowFactor: params.get('film.gapFlowFactor'),
    gapReservoirWidth: params.get('film.gapReservoirWidth'),
    etaGap: params.get('film.etaGap'),
    dewetBeadShare: params.get('film.dewetBeadShare'),
    renewalLength: params.get('film.renewalLength'),
    pilotRevolutions: Math.max(0, Math.round(params.get('film.pilotRevolutions'))),
    soakRevolutions: Math.max(0, Math.round(params.get('film.soakRevolutions'))),
    soakSteps: Math.max(0, Math.round(params.get('film.soakSteps'))),
    pilotCoarsening: Math.max(1, Math.round(params.get('film.pilotCoarsening'))),
    drainTime: params.get('film.drainTime'),
    drainGrowth: params.get('film.drainGrowth'),
    drainMaxStep: params.get('film.drainMaxStep'),
    holdMax: params.get('film.holdMax'),
    massTolerance: params.get('film.massTolerance'),
    kappaW: params.get('film.kappaW'),
    nBeta: params.get('film.nBeta'),
    sinBetaFloor: params.get('film.sinBetaFloor'),
  };
}
