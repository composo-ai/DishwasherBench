/**
 * The registered parameters of the jet stage (docs/design/scope.md, "Calibration is a
 * first-class feature"; docs/research/jets.md sections 4.2 to 4.4 and 11.3).
 *
 * The closed forms of an impinging round jet are written with their numerical constants as
 * parameters, each with the calibration scale the jets dossier gives it (`jets.kStag`,
 * `jets.kFilm`, `jets.kS`, `jets.kDrop`, `jets.cR` ...). The keys after the stand-in's are
 * those of the real stage (`jet-stage.ts`, `jet-closures.ts`): sampling, break-up, splatter,
 * the zones of the radial film, the droplets it sheds, wires and rims, and the gather. The
 * `jets.standIn*` keys belong to the labelled stand-in (`stand-in.ts`), which is kept for
 * comparison.
 *
 * All keys are under `jets.*` and belong to the `hydro` hash group.
 */

import type { AnyParamDef, ParamDef, ParamSet } from '@spotless/sim-params';

const JETS = 'jets';

/** The parameters the jet stage reads, to be contributed to the registry. */
export const JETS_PARAM_DEFS: readonly AnyParamDef[] = [
  {
    key: 'jets.solveTemperature',
    unit: 'degC',
    default: 50,
    min: 15,
    max: 75,
    tag: 'SYN',
    source:
      'sim-core M4, "Solve temperature per liquor class": water properties of the exposure; the replay rescales shear to the liquor temperature of each tick',
    group: 'hydro',
  },
  {
    key: 'jets.pressureA',
    unit: '1',
    default: 0.916,
    min: 0.916,
    max: 0.916,
    tag: 'VERIFIED',
    source: `${JETS} 4.2 eq. (3.5), (3.6): wall pressure p_s sech^2(a x + b x^3), x = r / d; a = B / 2 of a uniform jet`,
    group: 'hydro',
  },
  {
    key: 'jets.pressureB',
    unit: '1',
    default: 0.95,
    min: 0.5,
    max: 1.5,
    tag: 'ESTIMATED',
    source: `${JETS} 4.2 eq. (3.6): cubic coefficient fitted to the series and to the jet momentum`,
    group: 'hydro',
  },
  {
    key: 'jets.pressureIncidenceExponent',
    unit: '1',
    default: 2,
    min: 1,
    max: 2,
    tag: 'ESTIMATED',
    source: `${JETS} 11.2 step 5b, 11.3: peak pressure p_s sin^n(phi) at incidence phi from the wall plane`,
    group: 'hydro',
    calibration: 'jetStress',
  },
  {
    key: 'jets.stagShear',
    unit: '1',
    default: 1.15,
    min: 1.15,
    max: 1.15,
    tag: 'RECALLED',
    source: `${JETS} 4.3 eq. (3.7a): tau = 1.150 rho V^2 Re^(-1/2) (r / d) in the stagnation zone (Homann boundary layer)`,
    validity: 'r up to 0.55 d',
    group: 'hydro',
  },
  {
    key: 'jets.stagRadius',
    unit: '1',
    default: 0.55,
    min: 0.4,
    max: 0.7,
    tag: 'ESTIMATED',
    source: `${JETS} 4.3 eq. (3.7), 4.4 table: radius in jet diameters inside which the radial-film thickness and momentum flux are held at their value at that radius (the film forms there)`,
    group: 'hydro',
  },
  {
    key: 'jets.filmShear',
    unit: '1',
    default: 0.472,
    min: 0.472,
    max: 0.472,
    tag: 'VERIFIED',
    source: `${JETS} 4.4 eq. (3.10), Bhagat and Wilson 2016 eq. 73: tau = 0.472 rho V^2 Re^(-1/2) (r / d)^(-1/2) in the boundary-layer formation zone`,
    validity: 'incidence 30 to 120 degrees, Re up to 32,000; r from 0.55 d to 0.24 Re^(1/3) d',
    group: 'hydro',
  },
  {
    key: 'jets.filmThicknessA',
    unit: '1',
    default: 0.125,
    min: 0.125,
    max: 0.125,
    tag: 'VERIFIED',
    source: `${JETS} 4.4 eq. (3.8), Bhagat and Wilson 2016 eq. 24: h / d = 0.125 (d / r) + 1.06 Re^(-1/2) (r / d)^(1/2)`,
    group: 'hydro',
  },
  {
    key: 'jets.filmThicknessB',
    unit: '1',
    default: 1.06,
    min: 1.06,
    max: 1.06,
    tag: 'VERIFIED',
    source: `${JETS} 4.4 eq. (3.8), Bhagat and Wilson 2016 eq. 24`,
    group: 'hydro',
  },
  {
    key: 'jets.kStag',
    unit: '1',
    default: 1,
    min: 0.5,
    max: 2.8,
    tag: 'ESTIMATED',
    source: `${JETS} 11.3: scale on the stagnation-zone shear (velocity profile, roughness)`,
    group: 'hydro',
    calibration: 'jetStress',
  },
  {
    key: 'jets.kFilm',
    unit: '1',
    default: 1,
    min: 0.3,
    max: 3,
    tag: 'ESTIMATED',
    source: `${JETS} 4.4, 11.3: scale on the radial-film shear; widened by sim-core 1.3 for grazing incidence`,
    group: 'hydro',
    calibration: 'jetStress',
  },
  {
    key: 'jets.standInPhases',
    unit: '1',
    default: 360,
    min: 16,
    max: 4096,
    tag: 'SYN',
    source: 'stand-in of the first build: arm angles per revolution at which every jet is traced',
    group: 'hydro',
  },
  {
    key: 'jets.standInFootprintDiameters',
    unit: '1',
    default: 3,
    min: 1,
    max: 10,
    tag: 'SYN',
    source:
      'stand-in of the first build: radius of the circle about a hit, in jet diameters, inside which soil cells count as under the jet',
    group: 'hydro',
    calibration: 'jetAccess',
  },
  // ---- the real jet stage (jet-stage.ts): sampling
  {
    kind: 'vector',
    key: 'jets.phases',
    unit: '1',
    default: [8192, 1024],
    min: 64,
    max: 65536,
    components: ['official', 'fast'],
    tag: 'SYN',
    source:
      'sim-core M5 "Sampling" (16,384 and 4,096 in the full design): arm angles per revolution at which every jet is traced, per tier; at 1,024 a nozzle at the tip of an arm moves 1.4 mm per angle',
    group: 'hydro',
  },
  num(
    'jets.armPoseBins',
    '1',
    8,
    1,
    1024,
    'SYN',
    'jet stage of the first build: arm poses per revolution for the solid geometry of the spray arms (the ray tracer poses rotating parts per batch); jet origins and directions are exact at every phase',
  ),
  num(
    'jets.sagTolerance',
    'm',
    2.5e-4,
    1e-5,
    1e-3,
    'SYN',
    'sim-core M5 "Launch, flight, break-up": largest sag of a jet parabola under one straight segment (0.1 mm in the full design; a quarter of a millimetre here, an eighth of the finest block)',
  ),
  num(
    'jets.maxSegmentLength',
    'm',
    0.25,
    0.02,
    1,
    'SYN',
    'jet stage of the first build: longest straight segment of a jet path',
  ),
  num(
    'jets.maxSegments',
    '1',
    24,
    1,
    64,
    'SYN',
    'jet stage of the first build: segments after which a jet that has struck nothing is counted as lost to the sump',
  ),
  num(
    'jets.launchOffset',
    'm',
    5e-4,
    1e-5,
    5e-3,
    'SYN',
    'jet stage of the first build: a ray starts this far along the jet from the nozzle exit, so that it clears the arm',
  ),
  // ---- break-up in flight (jets 3.3, 3.6, 11.3)
  num(
    'jets.Cb',
    '1',
    6,
    3.3,
    12,
    'ESTIMATED',
    `${JETS} 3.3 eq. (3.1), 11.3: break-up length L_b = C_b d (sqrt(We) + 3 We / Re); bounds VERIFIED, default ESTIMATED`,
    'jetBreakup',
  ),
  num(
    'jets.breakWindowLo',
    '1',
    0.6,
    0.4,
    0.8,
    'ESTIMATED',
    `${JETS} 3.6 eq. (3.2), 11.3: the jet is coherent up to this share of L_b`,
    'jetBreakup',
  ),
  num(
    'jets.breakWindowHi',
    '1',
    1.4,
    1.2,
    1.6,
    'ESTIMATED',
    `${JETS} 3.6 eq. (3.2), 11.3: the jet is a droplet train beyond this share of L_b`,
    'jetBreakup',
  ),
  num(
    'jets.sheetBreakup',
    'm',
    0.1,
    0.05,
    0.15,
    'ESTIMATED',
    `${JETS} 2.5, 7.3; sim-core M5: break-up length of every sub-jet of a slot nozzle (the sheet breaks up as a sheet)`,
    'jetBreakup',
  ),
  num(
    'jets.kDrop',
    '1',
    0.7,
    0.3,
    1.5,
    'ESTIMATED',
    `${JETS} 6.6, 11.3: stress efficiency of a droplet train against the coherent jet`,
    'jetStress',
  ),
  num(
    'jets.kDropTrain',
    '1',
    0.3,
    0.1,
    0.5,
    'ESTIMATED',
    `${JETS} 6.5: splattered fraction of a fully broken jet (the plateau), times sin(phi)`,
    'splatter',
  ),
  // ---- splatter (jets 5.2, 5.6)
  {
    ...num(
      'jets.kS',
      '1',
      0.5,
      0,
      1,
      'ESTIMATED',
      `${JETS} 5.6 eq. (5.4): xi = k_S max(xi_BL, S_W) sin(phi)`,
      'splatter',
    ),
    bracket: 'G1',
  },
  fix(
    'jets.omegaCoef',
    '1',
    0.971,
    'VERIFIED',
    `${JETS} 5.2 eq. (5.1): omega = We exp(0.971 (l / d) / sqrt(We))`,
  ),
  fix(
    'jets.xiBL.c0',
    '1',
    0.258,
    'VERIFIED',
    `${JETS} 5.2 eq. (5.2): xi = -0.258 + 7.85e-5 omega - 2.51e-9 omega^2 (the constant, stored positive)`,
  ),
  fix('jets.xiBL.c1', '1', 7.85e-5, 'VERIFIED', `${JETS} 5.2 eq. (5.2)`),
  fix(
    'jets.xiBL.c2',
    '1',
    2.51e-9,
    'VERIFIED',
    `${JETS} 5.2 eq. (5.2) (the quadratic coefficient, stored positive)`,
  ),
  num(
    'jets.xiBL.cap',
    '1',
    11000,
    10000,
    15600,
    'ESTIMATED',
    `${JETS} 5.2: omega is capped here, which holds xi_BL at its plateau of 0.30`,
    'splatter',
  ),
  num(
    'jets.SW.slope',
    '1',
    4.6e-5,
    2e-5,
    8e-5,
    'ESTIMATED',
    `${JETS} 5.3, 5.6 eq. (5.4): S_W = clamp(4.6e-5 (V d / nu_20 - 12,000), 0, 0.40)`,
    'splatter',
  ),
  num(
    'jets.SW.onset',
    '1',
    12000,
    8000,
    16000,
    'ESTIMATED',
    `${JETS} 5.3, 5.6 eq. (5.4)`,
    'splatter',
  ),
  num('jets.SW.cap', '1', 0.4, 0.2, 0.7, 'ESTIMATED', `${JETS} 5.3, 5.6 eq. (5.4)`, 'splatter'),
  fix(
    'jets.SW.nu',
    'm2/s',
    1e-6,
    'VERIFIED',
    `${JETS} 5.6: S_W is written with the viscosity of water at 20 C, at which its data were taken`,
  ),
  // ---- the radial film beyond the boundary-layer zone (jets 4.4, 4.5, 4.7)
  num(
    'jets.stagEdge',
    '1',
    0.05,
    0,
    0.2,
    'ESTIMATED',
    `${JETS} 11.2 step 5c: the stagnation-zone shear applies out to r_e + 0.05 d_eq`,
  ),
  fix('jets.blZone', '1', 0.24, 'VERIFIED', `${JETS} 4.4 eq. (3.9): r_b / d = 0.24 Re^(1/3)`),
  fix(
    'jets.lamThicknessA',
    '1',
    3.792,
    'VERIFIED',
    `${JETS} 4.4 eq. (3.11): h / d = 3.792 (r / d)^2 / Re + 0.1975 (d / r)`,
  ),
  fix('jets.lamThicknessB', '1', 0.1975, 'VERIFIED', `${JETS} 4.4 eq. (3.11)`),
  fix(
    'jets.turbZone',
    '1',
    0.2964,
    'VERIFIED',
    `${JETS} 4.4 eq. (3.12): r_t / d = 0.2964 Re^(1/3)`,
  ),
  fix(
    'jets.turbSpeedA',
    '1',
    0.167,
    'VERIFIED',
    `${JETS} 4.4 eq. (3.13): U_av = V / (0.167 Re^(-1/4) (r / d)^(9/4) + 2.37 - 0.0108 Re^(1/2))`,
  ),
  fix('jets.turbSpeedB', '1', 2.37, 'VERIFIED', `${JETS} 4.4 eq. (3.13)`),
  fix('jets.turbSpeedC', '1', 0.0108, 'VERIFIED', `${JETS} 4.4 eq. (3.13)`),
  fix(
    'jets.turbThicknessA',
    '1',
    0.0209,
    'VERIFIED',
    `${JETS} 4.4 eq. (3.14): h / d = 0.0209 Re^(-1/4) (r / d)^(5/4) + (0.296 - 0.001356 Re^(1/2)) (d / r)`,
  ),
  fix('jets.turbThicknessB', '1', 0.296, 'VERIFIED', `${JETS} 4.4 eq. (3.14)`),
  fix('jets.turbThicknessC', '1', 0.001356, 'VERIFIED', `${JETS} 4.4 eq. (3.14)`),
  fix(
    'jets.turbShear',
    '1',
    0.0478,
    'VERIFIED',
    `${JETS} 4.4 eq. (3.15): tau = 0.0478 rho Re^(-1/4) U_av^2 (r / d)^(1/4)`,
  ),
  fix(
    'jets.cMlam',
    '1',
    1.2,
    'RECALLED',
    `films 3.3; sim-core M5: momentum-flux factor of the laminar film (parabolic profile, 6/5)`,
  ),
  fix(
    'jets.cMturb',
    '1',
    64 / 63,
    'VERIFIED',
    `${JETS} 4.4 eq. (3.16): momentum-flux factor of the turbulent film (64/63)`,
  ),
  num(
    'jets.cR',
    '1',
    0.289,
    0.25,
    0.32,
    'VERIFIED',
    `${JETS} 4.5 eq. (3.17): R_j = 0.289 Q^(3/4) (rho / (nu gamma))^(1/4)`,
    'jetFan',
  ),
  {
    ...num(
      'jets.gammaFactor',
      '1',
      1,
      0.6,
      1,
      'VERIFIED',
      `${JETS} 4.5: factor on the surface tension of clean water for surfaces milliseconds old (jump radius, splatter)`,
      'jetFan',
    ),
    bracket: 'G1',
  },
  // ---- splattered droplets (jets 5.4, 5.6; sim-core M5 "Droplet sizes are mass distributions")
  num(
    'jets.splatterRadius',
    '1',
    4.5,
    4,
    5.1,
    'VERIFIED',
    `${JETS} 5.4: splattered droplets leave at 4.5 to 5.1 d from the stagnation point`,
  ),
  num(
    'jets.splatterElevationLo',
    'rad',
    0.1745,
    0,
    0.5,
    'VERIFIED',
    `${JETS} 5.6: elevation above the wall, uniform between 10 and 30 degrees`,
  ),
  num('jets.splatterElevationHi', 'rad', 0.5236, 0.2, 1, 'VERIFIED', `${JETS} 5.6`),
  num(
    'jets.splatterSpeedLo',
    '1',
    0.4,
    0.1,
    0.7,
    'VERIFIED',
    `${JETS} 5.6: speed as a share of the jet speed, uniform between 0.4 and 0.9`,
  ),
  num('jets.splatterSpeedHi', '1', 0.9, 0.7, 1, 'VERIFIED', `${JETS} 5.6`),
  {
    ...num(
      'jets.splatterDropSize',
      '1',
      0.19,
      0.08,
      0.4,
      'ESTIMATED',
      `sim-core M5: mass-median diameter of splattered droplets over the jet diameter (${JETS} 5.4: number mean 0.055 to 0.10)`,
      'splatter',
    ),
    bracket: 'G1',
  },
  num(
    'jets.dropGsd',
    '1',
    1.8,
    1.2,
    2.5,
    'ESTIMATED',
    `${JETS} 5.6; sim-core M5: geometric standard deviation of the log-normal mass distribution of secondary droplets`,
  ),
  num(
    'jets.dropSizeMin',
    '1',
    0.02,
    0.005,
    0.1,
    'ESTIMATED',
    `sim-core M5: droplet diameters are truncated to 0.02 to 0.6 of the parent`,
  ),
  num('jets.dropSizeMax', '1', 0.6, 0.3, 1, 'ESTIMATED', `sim-core M5`),
  // ---- wires, tines, rims (jets 7.3)
  {
    ...num(
      'jets.wireRetain',
      '1',
      0.05,
      0,
      0.3,
      'ESTIMATED',
      `${JETS} 7.3, 11.3: share of the flow a wire or tine intercepts that stays on it as film; the rest leaves as two fan sheets`,
      'wireSplit',
    ),
    bracket: 'G2',
  },
  num(
    'jets.wireFanAngle',
    'rad',
    0.698,
    0.3,
    1.2,
    'ESTIMATED',
    `${JETS} 7.3: the fans are centred 40 degrees from the incoming direction`,
    'wireSplit',
  ),
  num(
    'jets.wireFanSpread',
    'rad',
    0.349,
    0.1,
    0.7,
    'ESTIMATED',
    `${JETS} 7.3: +/- 20 degrees in the plane across the wire`,
    'wireSplit',
  ),
  num(
    'jets.wireFanAlong',
    'rad',
    0.262,
    0.05,
    0.6,
    'ESTIMATED',
    `${JETS} 7.3: +/- 15 degrees along the wire`,
    'wireSplit',
  ),
  num(
    'jets.wireFanSpeed',
    '1',
    0.8,
    0.4,
    1,
    'ESTIMATED',
    `${JETS} 7.3: fan droplets leave at 0.8 V`,
    'wireSplit',
  ),
  num(
    'jets.wireDropSize',
    '1',
    0.25,
    0.1,
    0.5,
    'ESTIMATED',
    `${JETS} 7.3: mass-median diameter of fan droplets over the jet diameter`,
    'wireSplit',
  ),
  {
    ...num(
      'jets.rimScatter',
      '1',
      0.5,
      0,
      1,
      'SYN',
      `jet stage of the first build (${JETS} 7.3 has no data): share of the flow striking a convex rim or edge (the bundle falls on faces that turn by more than jets.groupNormalTol) that leaves as fan droplets instead of forming a footprint`,
      'wireSplit',
    ),
    bracket: 'G2',
  },
  num(
    'jets.groupNormalTol',
    'rad',
    0.349,
    0.1,
    0.8,
    'SYN',
    `sim-core M5 "Hit classification": sub-rays whose hit normals lie within 20 degrees form one footprint`,
  ),
  num(
    'jets.minSinIncidence',
    '1',
    0.052,
    0.01,
    0.2,
    'SYN',
    `jet stage of the first build: the incidence used in the closed forms is at least 3 degrees (sin = 0.052); below that the footprint ellipse and the forward lobe degenerate`,
  ),
  // ---- exposure gather and hand-over
  num(
    'jets.gatherStride',
    '1',
    0.5,
    0.25,
    2,
    'SYN',
    `sim-core M5 "Exposure gather" (jets.gatherStride = 1 d): the footprint is evaluated every this many jet diameters of travel inside the inner zone (and no finer than half a soil cell)`,
  ),
  num(
    'jets.gatherInner',
    '1',
    3,
    2,
    10,
    'SYN',
    `jet stage of the first build: radius of the inner zone in jet diameters; inside it soil cells are evaluated one by one at the fine stride, outside it blocks at the coarse stride`,
  ),
  num(
    'jets.gatherOuterStride',
    '1',
    3,
    1,
    12,
    'SYN',
    `jet stage of the first build: stride in jet diameters at which the outer zone, the hand-over and the droplet sources are evaluated`,
  ),
  {
    kind: 'vector',
    key: 'jets.shearLevels',
    unit: 'Pa',
    default: [10, 30, 100, 300],
    min: 0.1,
    max: 3000,
    components: ['l0', 'l1', 'l2', 'l3'],
    tag: 'ESTIMATED',
    source: `${JETS} 11.2 step 5d: the time with wall shear above {10, 30, 100, 300} Pa is recorded; the first level defines the footprint whose duty the table reports (10 Pa is the protein threshold of soils)`,
    group: 'hydro',
  },
  {
    kind: 'vector',
    key: 'jets.momentumLevels',
    unit: 'N/m',
    default: [2, 10, 20, 40],
    min: 0.01,
    max: 200,
    components: ['l0', 'l1', 'l2', 'l3'],
    tag: 'ESTIMATED',
    source: `sim-core M5 "Exposure gather": levels of the film momentum flux rho U^2 h (the peel threshold of soaked sauces is 20 N/m and above)`,
    group: 'hydro',
  },
  num(
    'jets.fanMinGap',
    'm',
    3e-3,
    0,
    10e-3,
    'ESTIMATED',
    'review of the first build (scope dependency 5; standards P04, P15: an overlapped zone keeps at least half its soil): the fast film of a jet does not act on a surface that another item faces closer than this along its normal',
    'jetFan',
  ),
  num(
    'jets.fanFullGap',
    'm',
    10e-3,
    1e-3,
    40e-3,
    'ESTIMATED',
    'review of the first build: from this gap to the facing item upwards the fast film acts in full; between jets.fanMinGap and this its shear, pressure and momentum are scaled linearly. Also the length of the normal ray that measures the gap',
    'jetFan',
  ),
  num(
    'jets.pressureReach',
    '1',
    2.5,
    1.5,
    4,
    'VERIFIED',
    'jets 4.2 (the wall pressure of a round jet has fallen to under 1 % of its stagnation value 2.5 diameters from the axis): beyond this many jet diameters the wall pressure is taken as zero',
  ),
  num(
    'jets.maxSplatter',
    '1',
    0.95,
    0.5,
    1,
    'SYN',
    'jet stage of the first build: largest splattered fraction of a footprint (keeps a footprint from handing nothing to the film)',
    'splatter',
  ),
  num(
    'jets.fanMaxTurn',
    'rad',
    1.309,
    0.5,
    3.1,
    'SYN',
    `jet stage of the first build, in place of the sector walk of sim-core M5: the fast film does not follow the surface where its normal has turned by more than this (75 degrees) from the normal at the impact`,
    'jetFan',
  ),
  num(
    'jets.handoverInner',
    '1',
    0.75,
    0.3,
    0.98,
    'SYN',
    `jet stage of the first build, in place of the ring emitter of sim-core M5: a sector hands its flow to the blocks between this share of its fan limit and the limit`,
  ),
  num(
    'jets.azimuthBins',
    '1',
    32,
    8,
    128,
    'SYN',
    `sim-core M5 (32 azimuths): sectors about the source point of a footprint for the hand-over and the lead limit`,
  ),
  {
    kind: 'vector',
    key: 'jets.handoverBins',
    unit: '1',
    default: [64, 32],
    min: 8,
    max: 4096,
    components: ['official', 'fast'],
    tag: 'SYN',
    source:
      'jet stage of the first build: phase bins per revolution in which the hand-over to the film is tabulated, per tier; the film stage takes one step per bin',
    group: 'hydro',
  },
  num(
    'jets.tangentialForce',
    '1',
    0.2,
    0.1,
    0.4,
    'ESTIMATED',
    `${JETS} 11.2 step 5f, 11.3: F_t = c_t rho Q V cos(phi)`,
    'jetForce',
  ),
  num(
    'jets.loadBins',
    '1',
    64,
    8,
    1024,
    'SYN',
    'jet stage of the first build: phase bins per revolution over which the force of the jets on an item is averaged before its peak is taken',
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

/** The jet parameters as numbers. */
export interface JetParams {
  readonly solveTemperature: number;
  readonly pressureA: number;
  readonly pressureB: number;
  readonly pressureIncidenceExponent: number;
  readonly stagShear: number;
  readonly stagRadius: number;
  readonly filmShear: number;
  readonly filmThicknessA: number;
  readonly filmThicknessB: number;
  readonly kStag: number;
  readonly kFilm: number;
  readonly standInPhases: number;
  readonly standInFootprintDiameters: number;
  /** Arm angles per revolution: [official, fast]. */
  readonly phases: readonly number[];
  readonly armPoseBins: number;
  readonly sagTolerance: number;
  readonly maxSegmentLength: number;
  readonly maxSegments: number;
  readonly launchOffset: number;
  readonly sheetBreakup: number;
  readonly kDrop: number;
  readonly kDropTrain: number;
  readonly stagEdge: number;
  readonly cR: number;
  readonly gammaFactor: number;
  readonly splatterRadius: number;
  readonly splatterElevationLo: number;
  readonly splatterElevationHi: number;
  readonly splatterSpeedLo: number;
  readonly splatterSpeedHi: number;
  readonly splatterDropSize: number;
  readonly dropGsd: number;
  readonly dropSizeMin: number;
  readonly dropSizeMax: number;
  readonly wireRetain: number;
  readonly wireFanAngle: number;
  readonly wireFanSpread: number;
  readonly wireFanAlong: number;
  readonly wireFanSpeed: number;
  readonly wireDropSize: number;
  readonly rimScatter: number;
  readonly groupNormalTol: number;
  readonly minSinIncidence: number;
  readonly gatherStride: number;
  readonly gatherInner: number;
  readonly gatherOuterStride: number;
  readonly shearLevels: readonly number[];
  readonly momentumLevels: readonly number[];
  readonly fanMaxTurn: number;
  readonly fanMinGap: number;
  readonly fanFullGap: number;
  readonly pressureReach: number;
  readonly maxSplatter: number;
  readonly handoverInner: number;
  readonly azimuthBins: number;
  /** Phase bins of the hand-over per revolution: [official, fast]. */
  readonly handoverBins: readonly number[];
  readonly tangentialForce: number;
  readonly loadBins: number;
}

const whole = (value: number): number => Math.max(1, Math.round(value));

/** Reads the jet parameters from a set built on a registry that holds the definitions. */
export function resolveJetParams(params: ParamSet): JetParams {
  return {
    solveTemperature: params.get('jets.solveTemperature'),
    pressureA: params.get('jets.pressureA'),
    pressureB: params.get('jets.pressureB'),
    pressureIncidenceExponent: params.get('jets.pressureIncidenceExponent'),
    stagShear: params.get('jets.stagShear'),
    stagRadius: params.get('jets.stagRadius'),
    filmShear: params.get('jets.filmShear'),
    filmThicknessA: params.get('jets.filmThicknessA'),
    filmThicknessB: params.get('jets.filmThicknessB'),
    kStag: params.get('jets.kStag'),
    kFilm: params.get('jets.kFilm'),
    standInPhases: whole(params.get('jets.standInPhases')),
    standInFootprintDiameters: params.get('jets.standInFootprintDiameters'),
    phases: params.getVector('jets.phases').map(whole),
    armPoseBins: whole(params.get('jets.armPoseBins')),
    sagTolerance: params.get('jets.sagTolerance'),
    maxSegmentLength: params.get('jets.maxSegmentLength'),
    maxSegments: whole(params.get('jets.maxSegments')),
    launchOffset: params.get('jets.launchOffset'),
    sheetBreakup: params.get('jets.sheetBreakup'),
    kDrop: params.get('jets.kDrop'),
    kDropTrain: params.get('jets.kDropTrain'),
    stagEdge: params.get('jets.stagEdge'),
    cR: params.get('jets.cR'),
    gammaFactor: params.get('jets.gammaFactor'),
    splatterRadius: params.get('jets.splatterRadius'),
    splatterElevationLo: params.get('jets.splatterElevationLo'),
    splatterElevationHi: params.get('jets.splatterElevationHi'),
    splatterSpeedLo: params.get('jets.splatterSpeedLo'),
    splatterSpeedHi: params.get('jets.splatterSpeedHi'),
    splatterDropSize: params.get('jets.splatterDropSize'),
    dropGsd: params.get('jets.dropGsd'),
    dropSizeMin: params.get('jets.dropSizeMin'),
    dropSizeMax: params.get('jets.dropSizeMax'),
    wireRetain: params.get('jets.wireRetain'),
    wireFanAngle: params.get('jets.wireFanAngle'),
    wireFanSpread: params.get('jets.wireFanSpread'),
    wireFanAlong: params.get('jets.wireFanAlong'),
    wireFanSpeed: params.get('jets.wireFanSpeed'),
    wireDropSize: params.get('jets.wireDropSize'),
    rimScatter: params.get('jets.rimScatter'),
    groupNormalTol: params.get('jets.groupNormalTol'),
    minSinIncidence: params.get('jets.minSinIncidence'),
    gatherStride: params.get('jets.gatherStride'),
    gatherInner: params.get('jets.gatherInner'),
    gatherOuterStride: params.get('jets.gatherOuterStride'),
    shearLevels: params.getVector('jets.shearLevels'),
    momentumLevels: params.getVector('jets.momentumLevels'),
    fanMaxTurn: params.get('jets.fanMaxTurn'),
    fanMinGap: params.get('jets.fanMinGap'),
    fanFullGap: params.get('jets.fanFullGap'),
    pressureReach: params.get('jets.pressureReach'),
    maxSplatter: params.get('jets.maxSplatter'),
    handoverInner: params.get('jets.handoverInner'),
    azimuthBins: whole(params.get('jets.azimuthBins')),
    handoverBins: params.getVector('jets.handoverBins').map(whole),
    tangentialForce: params.get('jets.tangentialForce'),
    loadBins: whole(params.get('jets.loadBins')),
  };
}
