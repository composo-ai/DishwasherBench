/**
 * The registered parameters of the secondary-water stage of the first build
 * (docs/design/scope.md, "Indirect water"; docs/design/sim-core.md section M6).
 *
 * The `spray.standIn*` keys belong to the labelled STAND-IN (`stand-in.ts`), which is kept for
 * comparison. The others are those of the real stage (`spray-stage.ts`, `flight.ts`): the
 * number of parcels, droplet flight (drag in still air), the wall interaction, the droplets of
 * fixed sprayers and of drips. All are in the `hydro` hash group.
 *
 * `film.sigma` and `film.liquorClass` are declared here although they carry the prefix of the
 * film module: the drop that leaves a drip site is sized with the surface tension of the
 * liquor, and the dependency table lets the film module read this one but not the reverse
 * (the same reason `film-interface.ts` lives here).
 */

import type { AnyParamDef, ParamDef, ParamSet } from '@spotless/sim-jets';

const J = 'jets';

/** The parameters the secondary-water stage reads, to be contributed to the registry. */
export const SPRAY_PARAM_DEFS: readonly AnyParamDef[] = [
  {
    key: 'spray.standInShowerRays',
    unit: '1',
    default: 4096,
    min: 64,
    max: 1_000_000,
    tag: 'SYN',
    source:
      'stand-in of the first build: droplet paths traced per fixed sprayer (the Bosch roof spinner) and spray state',
    group: 'hydro',
  },
  {
    key: 'spray.standInFlightStep',
    unit: 's',
    default: 0.02,
    min: 0.002,
    max: 0.1,
    tag: 'SYN',
    source:
      'stand-in of the first build: length in time of the straight segments a droplet parabola is traced in',
    group: 'hydro',
  },
  {
    key: 'spray.standInFlightTime',
    unit: 's',
    default: 1.5,
    min: 0.2,
    max: 5,
    tag: 'SYN',
    source:
      'stand-in of the first build: a droplet that has struck nothing after this time is dropped (it would have reached the sump)',
    group: 'hydro',
  },
  // ---- the real stage: sampling
  {
    kind: 'vector',
    key: 'spray.parcelMass',
    unit: 'kg',
    default: [2e-8, 1.6e-7],
    min: 1e-9,
    max: 1e-3,
    components: ['official', 'fast'],
    tag: 'SYN',
    source:
      'sim-core M6 "Sampling" (3 x 10^8 and 3 x 10^7 parcels per state in the full design; no importance sampling here): water one droplet parcel stands for, per revolution of the master arm, per tier. Every droplet source (a stretch of a jet footprint, a fan off a wire or a rim, a fixed sprayer) is flown as its own mass over this many parcels, at least one, so the number of parcels of a source does not depend on what the jets do elsewhere in the machine. 20 micrograms (a drop of 0.34 mm) gives about 9 million parcels in a lower-arm state and 13 million in an upper-arm state of a full standard load on the Bosch (the first build flew 4.2 million in every state at the official tier); the fast tier flies an eighth of that. The scatter of the droplet flux on a face that only droplets reach falls as the square root of the count. Measured on the standard load (sim-core scripts/variance-study.ts): at 40 micrograms two simulation seeds disagreed on 1.8 of 68 verdicts, at 20 micrograms (with spray.landingKernel at 40 mm) on 0.9',
    group: 'hydro',
  },
  num(
    'spray.showerParcelFactor',
    '1',
    4,
    1,
    64,
    'SYN',
    'secondary-water stage: a parcel of a fixed sprayer (the roof sprinkler) stands for this many times spray.parcelMass. The sprinkler is one broad, even source that carries more than half of the droplet water of an upper-arm state and rains at rates far above those at which the supply of liquor limits anything, so its parcels may be coarser than those of the splatter and the fans, whose thin spray decides what a sheltered face receives',
  ),
  num(
    'spray.dripParcels',
    '1',
    16,
    1,
    256,
    'SYN',
    'secondary-water stage: points over the cross-section of the drop of a drip site from which its landing table is made (a power of two keeps the weights exact). A drop from an edge is 3.3 capillary lengths wide, wider than a tine or the rim it may fall on: each point falls straight from its place in the drop, so a slender part below catches the share of the drop it covers. The points are a fixed pattern, turned by the stable key of the site: the table does not depend on the simulation seed. With 16 points the share caught by a 2.5 mm tine is resolved to about a sixteenth',
  ),
  num(
    'spray.landingKernel',
    'm',
    40e-3,
    2e-3,
    0.2,
    'SYN',
    'secondary-water stage (sim-core M6 "Sampling": smoothing windows): spacing of the nodes of the landing kernel. One sample of parcels stands for the droplets of every revolution of a spray state, which do not land in the same places each time: what lands about a node from one direction is shared among the faces there by the area each presents to that direction and can be reached from it (landing-kernel.ts). The flux of droplets from a source varies over the distance to that source, some tens of millimetres between neighbours in a loaded basket and more for what crosses from one basket to the other; what stands in the way nearer than spray.landingRange is resolved exactly whatever this spacing. The first build spread a landing over a 12 mm disc of its own face (450 mm2); a 40 mm lattice pools over about three and a half times that on a flat face and, unlike it, over every face about the node. A bandwidth: smaller follows the flux more closely and scatters more between seeds',
  ),
  num(
    'spray.landingRange',
    'm',
    50e-3,
    0,
    0.5,
    'SYN',
    'secondary-water stage (standards P04, P15, P16, P40): distance within which another body in the way of a direction (a neighbour, a wall of the tub or of a basket) keeps a block from being open to it; the item itself does at any distance. A block that is not open to a direction does not share what lands on open faces from it. A shadow cast from further away is seen by the parcels only and blurred by spray.landingKernel. 0 takes every face as open to every direction it faces (no ray is traced)',
  ),
  num(
    'spray.landingGap',
    'm',
    4e-3,
    0,
    0.05,
    'ESTIMATED',
    'secondary-water stage (standards P04, P15, P40; jets 6: splatter and fan droplets are 0.2 to 2 mm): another body nearer than this in the way of a direction closes it altogether: a droplet does not fly into a gap a few of its own diameters wide and far along it. Between this and spray.landingRange the block is faced: it shares only what lands on faces in the same situation. The scene takes surfaces nearer than scene.contactGap (4 mm) as a contact',
  ),
  num(
    'spray.outlineRays',
    '1',
    4,
    0,
    16,
    'SYN',
    'secondary-water stage (standards P04, P15, P40; jets 6: splatter and fan droplets are 0.2 to 2 mm, the drops of a fixed sprayer 1.5 mm): rays that carry the outline of a droplet where it flies into a gap. A droplet whose centre line ends on a face that another body faces within scene.contactGap is flown again from its last event as a sphere of its own diameter: this many rays abreast, each a radius off the centre line, and it lands where the first of them strikes (the edge of a mouth narrower than the droplet, or a wall a radius sooner). With n rays the outline is seen in n directions across the flight: 2 rays find 64 % of the edges a sphere would, 3 find 83 %, 4 find 90 %. 0: every droplet is a point, as before water-6',
  ),
  num(
    'spray.landingDirections',
    '1',
    48,
    6,
    512,
    'SYN',
    'secondary-water stage: direction bins over the sphere (a Fibonacci lattice) in which landings are gathered and the exposure of a block is traced; 48 bins are 17 degrees in half-angle',
  ),
  num(
    'spray.sagTolerance',
    'm',
    2.5e-4,
    1e-5,
    2e-3,
    'ESTIMATED',
    'sim-core M6 "Flight" (0.1 mm in the full design): largest sag of a droplet path under one straight segment',
  ),
  num(
    'spray.maxSegmentLength',
    'm',
    0.1,
    0.005,
    0.5,
    'ESTIMATED',
    'sim-core M6 "Flight" (20 mm in the full design): longest straight segment of a droplet path',
  ),
  num(
    'spray.maxStep',
    's',
    0.1,
    0.002,
    0.5,
    'SYN',
    'secondary-water stage of the first build: longest time step of a droplet (a drop that starts at rest has no speed to size its first segment by)',
  ),
  num(
    'spray.maxSegments',
    '1',
    32,
    4,
    256,
    'ESTIMATED',
    'sim-core M6 "Flight": segments after which a droplet that has struck nothing is counted as returned to the sump',
  ),
  num(
    'spray.maxBounces',
    '1',
    3,
    0,
    16,
    'ESTIMATED',
    'sim-core M6 "Wall interaction": rebounds of one droplet before it is deposited',
  ),
  num(
    'spray.terminalBand',
    '1',
    0.05,
    0.005,
    0.3,
    'ESTIMATED',
    'sim-core M6 "Flight": a droplet whose acceleration has fallen to this share of gravity is at its terminal velocity and is finished with one straight ray',
  ),
  num(
    'spray.maxRange',
    'm',
    2,
    0.5,
    10,
    'SYN',
    'secondary-water stage of the first build: length of the last ray of a droplet at terminal velocity (more than the diagonal of a domestic wash chamber)',
  ),
  num(
    'spray.spawnOffset',
    'm',
    2e-4,
    1e-5,
    2e-3,
    'SYN',
    'secondary-water stage of the first build: a droplet leaves a wall this far off it, so that it does not strike the surface it leaves',
  ),
  // ---- flight (jets 3.7)
  num(
    'spray.airDensity',
    'kg/m3',
    1.09,
    0.9,
    1.25,
    'RECALLED',
    `${J} 3.7 "at 50 C properties": density of the air in the tub`,
  ),
  num(
    'spray.airViscosity',
    'Pa s',
    1.96e-5,
    1.7e-5,
    2.1e-5,
    'RECALLED',
    `${J} 3.7 "at 50 C properties": dynamic viscosity of the air in the tub`,
  ),
  fix(
    'spray.dragStokes',
    '1',
    24,
    'RECALLED',
    `${J} 3.7 eq. (3.3), Schiller-Naumann: C_D = (24 / Re)(1 + 0.15 Re^0.687) for Re < 1000, 0.44 otherwise`,
  ),
  fix('spray.dragCoef', '1', 0.15, 'RECALLED', `${J} 3.7 eq. (3.3)`),
  fix('spray.dragExp', '1', 0.687, 'RECALLED', `${J} 3.7 eq. (3.3)`),
  fix('spray.dragNewton', '1', 0.44, 'RECALLED', `${J} 3.7 eq. (3.3)`),
  fix('spray.dragReMax', '1', 1000, 'RECALLED', `${J} 3.7 eq. (3.3)`),
  // ---- wall interaction (jets 6.2 to 6.4, 11.2 step 6)
  num(
    'spray.Awet',
    '1',
    1320,
    700,
    5000,
    'VERIFIED',
    `${J} 6.2, 6.3: splash on a wetted wall above We_c = A_wet La^(-0.183)`,
    'dropletSplash',
  ),
  num(
    'spray.Adry',
    '1',
    2630,
    1300,
    5200,
    'VERIFIED',
    `${J} 6.2, 6.3: splash on a dry wall above We_c = A_dry La^(-0.183)`,
    'dropletSplash',
  ),
  fix(
    'spray.laExp',
    '1',
    0.183,
    'VERIFIED',
    `${J} 6.3: exponent of the Laplace number in the splash threshold (stored positive)`,
  ),
  fix(
    'spray.WeStick',
    '1',
    2,
    'VERIFIED',
    `${J} 6.2: a droplet sticks to a wetted wall below this normal Weber number`,
  ),
  fix(
    'spray.WeRebound',
    '1',
    20,
    'VERIFIED',
    `${J} 6.2: a droplet rebounds from a wetted wall between spray.WeStick and this`,
  ),
  {
    kind: 'vector',
    key: 'spray.restitution',
    unit: '1',
    default: [0.993, -1.76, 1.56, -0.49],
    min: -2,
    max: 2,
    components: ['c0', 'c1', 'c2', 'c3'],
    tag: 'VERIFIED',
    source: `${J} 6.3: normal restitution of a rebound, e = 0.993 - 1.76 a + 1.56 a^2 - 0.49 a^3, a the angle from the wall in radians`,
    group: 'hydro',
  },
  fix(
    'spray.tangentialRestitution',
    '1',
    5 / 7,
    'VERIFIED',
    `${J} 6.3: a rebound keeps 5/7 of the tangential velocity`,
  ),
  {
    ...num(
      'spray.rmSlope',
      '1',
      0.1,
      0.02,
      0.5,
      'ESTIMATED',
      `${J} 6.4: splashed mass ratio r_m = clamp(0.1 (We_n / We_c - 1), 0, r_max)`,
      'dropletSplash',
    ),
    bracket: 'G2',
  },
  {
    ...num(
      'spray.rmMax',
      '1',
      0.3,
      0.14,
      0.8,
      'ESTIMATED',
      `${J} 6.4: largest splashed mass ratio (measured splash of millimetre drops is under 14 %; Bai-Gosman takes 0.2 to 0.8)`,
      'dropletSplash',
    ),
    bracket: 'G2',
  },
  {
    ...num(
      'spray.secDropSize',
      '1',
      0.23,
      0.08,
      0.4,
      'ESTIMATED',
      `sim-core M5 "Droplet sizes are mass distributions": mass-median diameter of splash secondaries over the parent diameter (${J} 6.4: count median 0.08)`,
      'dropletSplash',
    ),
    bracket: 'G2',
  },
  num(
    'spray.secElevationLo',
    'rad',
    0.1745,
    0,
    0.6,
    'ESTIMATED',
    `${J} 6.4: secondaries leave 10 to 40 degrees above the wall`,
  ),
  num('spray.secElevationHi', 'rad', 0.6981, 0.3, 1.4, 'ESTIMATED', `${J} 6.4`),
  num(
    'spray.secSpeedLo',
    '1',
    0.3,
    0.1,
    0.8,
    'ESTIMATED',
    `${J} 6.4: secondaries leave at 0.3 to 1.2 times the normal speed of the parent`,
  ),
  num('spray.secSpeedHi', '1', 1.2, 0.8, 2, 'ESTIMATED', `${J} 6.4`),
  num(
    'spray.secTangential',
    '1',
    0.7,
    0.4,
    1,
    'ESTIMATED',
    `${J} 6.4: and carry 0.7 of its tangential velocity`,
  ),
  num(
    'spray.wetWallAngle',
    'rad',
    0.1745,
    0.02,
    1,
    'SYN',
    'sim-core M6 "Wall interaction" (the pilot of the full design; here by material only): before the film is solved, a wall whose receding contact angle in the liquor is below this, or that a jet hands water to, counts as wetted when a droplet lands on it',
    'dropletSplash',
  ),
  // ---- droplets of fixed sprayers and of drips
  num(
    'spray.showerDropSize',
    'm',
    1.5e-3,
    0.5e-3,
    4e-3,
    'ESTIMATED',
    'machine dossier (the roof sprinkler is a spinning deflector, no size is given): mass-median diameter of the droplets of a fixed sprayer',
    'shower',
  ),
  num(
    'spray.showerOffset',
    'm',
    2e-3,
    0,
    10e-3,
    'SYN',
    'droplet stage of the first build: a droplet of a fixed sprayer starts this far from the outlet along its direction (clear of the deflector)',
    'shower',
  ),
  num(
    'spray.showerSizeMin',
    '1',
    0.25,
    0.05,
    1,
    'SYN',
    'droplet stage of the first build: droplet diameters of a fixed sprayer are kept above this factor of their median',
    'shower',
  ),
  num(
    'spray.showerSizeMax',
    '1',
    2.5,
    1,
    6,
    'SYN',
    'droplet stage of the first build: droplet diameters of a fixed sprayer are kept below this factor of their median',
    'shower',
  ),
  num(
    'spray.dripDropFactor',
    '1',
    3.3,
    3,
    3.3,
    'VERIFIED',
    'films 6.4, 12.5, 12.7: a drop leaving a broad wetted edge has the diameter 3.3 l_c',
  ),
  num(
    'spray.dripTipFactor',
    '1',
    0.65,
    0.4,
    1,
    'ESTIMATED',
    'films 6.4, 12.5 (Tate): a drop leaving a wire or tip of wetted perimeter P has the mass 0.65 sigma P / g',
  ),
  {
    kind: 'vector',
    key: 'film.sigma',
    unit: 'N/m',
    default: [0.06, 0.04, 0.045],
    min: 0.025,
    max: 0.075,
    components: ['W', 'D', 'R'],
    tag: 'ESTIMATED',
    source:
      'films 12.8: surface tension of the liquor of each class (pre-rinse 60, main wash 40, final rinse with rinse aid 45 mN/m)',
    group: 'hydro',
    calibration: 'wetting',
    bracket: 'G3',
  },
  {
    kind: 'enum',
    key: 'film.liquorClass',
    unit: '1',
    default: 'D',
    options: ['W', 'D', 'R'],
    tag: 'SYN',
    source:
      'surface-water stage of the first build: the liquor class whose surface tension and contact angles the exposure of a spray state is solved with (an exposure set knows nothing of the liquor; the main wash is the longest phase). The full design solves one set per class',
    group: 'hydro',
  },
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

/** The secondary-water parameters as numbers. */
export interface SprayParams {
  readonly standInShowerRays: number;
  readonly standInFlightStep: number;
  readonly standInFlightTime: number;
  /** Water one droplet parcel stands for, kg: [official, fast]. */
  readonly parcelMass: readonly number[];
  /** Mass of a parcel of a fixed sprayer over `parcelMass`. */
  readonly showerParcelFactor: number;
  readonly dripParcels: number;
  /** Spacing of the nodes of the landing kernel, m. */
  readonly landingKernel: number;
  /** Distance within which another body in the way of a direction faces a block, m. */
  readonly landingRange: number;
  /** Distance within which another body in the way of a direction closes it, m. */
  readonly landingGap: number;
  /** Direction bins of the landing kernel. */
  readonly landingDirections: number;
  /** Rays that carry the outline of a droplet in a gap (0: droplets are points). */
  readonly outlineRays: number;
  readonly sagTolerance: number;
  readonly maxSegmentLength: number;
  readonly maxStep: number;
  readonly maxSegments: number;
  readonly maxBounces: number;
  readonly terminalBand: number;
  readonly maxRange: number;
  readonly spawnOffset: number;
  readonly airDensity: number;
  readonly airViscosity: number;
  readonly dragStokes: number;
  readonly dragCoef: number;
  readonly dragExp: number;
  readonly dragNewton: number;
  readonly dragReMax: number;
  readonly Awet: number;
  readonly Adry: number;
  readonly laExp: number;
  readonly WeStick: number;
  readonly WeRebound: number;
  readonly restitution: readonly number[];
  readonly tangentialRestitution: number;
  readonly rmSlope: number;
  readonly rmMax: number;
  readonly secDropSize: number;
  readonly secElevationLo: number;
  readonly secElevationHi: number;
  readonly secSpeedLo: number;
  readonly secSpeedHi: number;
  readonly secTangential: number;
  readonly wetWallAngle: number;
  readonly showerDropSize: number;
  readonly showerOffset: number;
  readonly showerSizeMin: number;
  readonly showerSizeMax: number;
  readonly dripDropFactor: number;
  readonly dripTipFactor: number;
  /** Surface tension of the liquor the exposure is solved with, N/m, and its class (0 W, 1 D, 2 R). */
  readonly liquorSigma: number;
  readonly liquorClass: number;
}

const whole = (value: number): number => Math.max(1, Math.round(value));

/** Reads the secondary-water parameters from a set built on a registry that holds them. */
export function resolveSprayParams(params: ParamSet): SprayParams {
  const liquorClass = params.enumIndex('film.liquorClass');
  return {
    standInShowerRays: whole(params.get('spray.standInShowerRays')),
    standInFlightStep: params.get('spray.standInFlightStep'),
    standInFlightTime: params.get('spray.standInFlightTime'),
    parcelMass: params.getVector('spray.parcelMass'),
    showerParcelFactor: params.get('spray.showerParcelFactor'),
    dripParcels: whole(params.get('spray.dripParcels')),
    landingKernel: params.get('spray.landingKernel'),
    landingRange: params.get('spray.landingRange'),
    landingGap: params.get('spray.landingGap'),
    landingDirections: whole(params.get('spray.landingDirections')),
    outlineRays: Math.max(0, Math.round(params.get('spray.outlineRays'))),
    sagTolerance: params.get('spray.sagTolerance'),
    maxSegmentLength: params.get('spray.maxSegmentLength'),
    maxStep: params.get('spray.maxStep'),
    maxSegments: whole(params.get('spray.maxSegments')),
    maxBounces: Math.max(0, Math.round(params.get('spray.maxBounces'))),
    terminalBand: params.get('spray.terminalBand'),
    maxRange: params.get('spray.maxRange'),
    spawnOffset: params.get('spray.spawnOffset'),
    airDensity: params.get('spray.airDensity'),
    airViscosity: params.get('spray.airViscosity'),
    dragStokes: params.get('spray.dragStokes'),
    dragCoef: params.get('spray.dragCoef'),
    dragExp: params.get('spray.dragExp'),
    dragNewton: params.get('spray.dragNewton'),
    dragReMax: params.get('spray.dragReMax'),
    Awet: params.get('spray.Awet'),
    Adry: params.get('spray.Adry'),
    laExp: params.get('spray.laExp'),
    WeStick: params.get('spray.WeStick'),
    WeRebound: params.get('spray.WeRebound'),
    restitution: params.getVector('spray.restitution'),
    tangentialRestitution: params.get('spray.tangentialRestitution'),
    rmSlope: params.get('spray.rmSlope'),
    rmMax: params.get('spray.rmMax'),
    secDropSize: params.get('spray.secDropSize'),
    secElevationLo: params.get('spray.secElevationLo'),
    secElevationHi: params.get('spray.secElevationHi'),
    secSpeedLo: params.get('spray.secSpeedLo'),
    secSpeedHi: params.get('spray.secSpeedHi'),
    secTangential: params.get('spray.secTangential'),
    wetWallAngle: params.get('spray.wetWallAngle'),
    showerDropSize: params.get('spray.showerDropSize'),
    showerOffset: params.get('spray.showerOffset'),
    showerSizeMin: params.get('spray.showerSizeMin'),
    showerSizeMax: params.get('spray.showerSizeMax'),
    dripDropFactor: params.get('spray.dripDropFactor'),
    dripTipFactor: params.get('spray.dripTipFactor'),
    liquorSigma:
      params.getVector('film.sigma')[liquorClass] ?? (params.getVector('film.sigma')[0] as number),
    liquorClass,
  };
}
