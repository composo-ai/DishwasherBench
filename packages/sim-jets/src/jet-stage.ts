/**
 * The jet stage of the first build (docs/design/scope.md, "Jet access" and "What a jet does
 * where it lands"; docs/design/sim-core.md section M5; docs/research/jets.md section 11.2):
 * the coherent jets of one spray state against the scene.
 *
 *   trace     every jet at `jets.phases` arm angles per revolution, as a bundle of sub-rays
 *             (19 at the official tier, 7 at the fast tier) that sample equal areas of its
 *             section; each sub-ray flies on its parabola under gravity as a chain of straight
 *             segments through the scene's ray query, on the GPU where there is one
 *   classify  the sub-rays of one jet at one phase that strike the same face form a footprint
 *             with the flow of the rays that struck; rays on a wire or tine, and bundles that
 *             straddle a convex rim, are split by registered fractions into what stays, what
 *             passes (the rays that missed fly on) and what leaves as fan droplets
 *   gather    consecutive phases are merged into stretches of track; for each stretch the
 *             closed forms of `jet-closures.ts` (oblique flow split, stagnation pressure and
 *             shear, the zones of the radial film out to the film jump or to where the film
 *             can no longer outrun the footprint) are integrated in time onto the soil cells:
 *             time above each of four shear and four momentum levels, peaks, means, wet time.
 *             A jet that has flown beyond its break-up length counts as a droplet train
 *             (`jets.kDrop`, `jets.kDropTrain`)
 *   hand-over the water of each stretch, less the splattered fraction, goes to the film at the
 *             end of the fan, sector by sector, in whole units of `WATER_UNIT` per phase bin
 *   sources   splatter and fan droplets are written as source records for the secondary-water
 *             stage
 *   loads     the force of the jets on every item, by the momentum theorem (jets 11.2 step 5f)
 *
 * Water is conserved exactly: the units out of the nozzles equal those lost, handed over,
 * splattered and scattered (`JetLedger`).
 *
 * Simplifications (each ignores something calibration may ask for):
 *  - the fast film is quasi-steady about the instantaneous source point of the footprint; it
 *    is laid on the surface by straight-line distance from the source point and stops where
 *    the surface normal has turned by `jets.fanMaxTurn` (no geodesic sector walk, no fold or
 *    Gaussian-curvature rules, no separation at rims: liquid reaching an edge is handed to the
 *    film there);
 *  - beyond `jets.gatherInner` jet diameters of the track the exposure is evaluated per block,
 *    every `jets.gatherOuterStride` diameters of travel; peaks are those of the sampled
 *    positions (stride `jets.gatherStride`), so a peak can be up to 15 % low;
 *  - the hand-over is a direct deposit over the outer quarter of each sector of the fan (no
 *    retarded ring emitter: the travel time of the film is ignored);
 *  - no pre-wet correction, no rain interference, no shed droplets along the flight, no
 *    transition cap on the grazing-incidence boundary layer; a jet on the underside of a
 *    surface is handed to the film like any other (no curtain);
 *  - a jet that passes a wire keeps its diameter and direction; a jet on a perforated part or
 *    on a spray arm is handed to the block it strikes with no footprint;
 *  - arms are posed per `jets.armPoseBins` of a revolution for their solid geometry; while one
 *    arm is sampled, any other turning arm stands at a hashed angle;
 *  - loads take the liquid that stays on the item at its full incoming momentum and ignore the
 *    momentum of splatter leaving it;
 *  - covered faces: the fast film does not act where another body (an item, a wall of the tub
 *    or of a basket; not a wire, a perforated part or a spray arm) faces the surface closer
 *    than `jets.fanMinGap` along the block's normal, and is scaled up to `jets.fanFullGap`
 *    (one normal ray per block, see `fanOpenness`). It does not cross such a face either: the
 *    spread over the cell graph stops there, so a cell beyond a covered band is not reached,
 *    and the water of a sector whose fan is cut is handed to the film at the last open block
 *    it reached. The gap is that along the normal of the block (a cover that leans over the
 *    surface from the side is seen only where it is in front of it).
 *
 * Deterministic: rays are traced and processed in a fixed order; masses are integers; the
 * tables are sorted by index. The GPU and the CPU tracer differ on rare grazing rays.
 *
 * Units: SI. Frame: tub frame.
 */

import { hashU32, u32ToUnitFloat } from '@spotless/core';
import { createJetLaunch, jetLaunch, type SprayJet } from '@spotless/sim-hydraulics';
import { bindSharedClosures, type ParamSet } from '@spotless/sim-params';
import {
  BLOCK_FLAG,
  HIT_WORDS,
  RAY_WORDS,
  SCENE_NONE,
  sceneBlockKeys,
} from '@spotless/sim-scene';
import {
  bindJetClosures,
  buildFilmTable,
  FILM_COLUMN,
  filmTableAt,
  type FilmTable,
  type JetClosures,
} from './jet-closures.ts';
import {
  DROPLET_SOURCE,
  JET_FIELD,
  JET_FIELD_COUNT,
  WATER_UNIT,
  type DropletSources,
  type ExposureStageInput,
  type ItemJetLoad,
  type JetHandover,
  type JetStageOutput,
} from './jet-exposure.ts';
import { resolveJetParams } from './params.ts';
import { SparseSum } from './sparse-sum.ts';
import { acquireTraceBackend, type TraceBackend } from './trace-backend.ts';

/** Arithmetic controls of the jet stage (not physical quantities). */
export const JET_STAGE_NUMERICS = {
  /** Most footprints one jet forms at one phase; further faces join the nearest. */
  maxGroups: 4,
  /** RNG domain of the angles other turning arms stand at. */
  otherArmDomain: 0x6a657432,
  /** Bisection steps for the radius at which the film is as slow as the footprint. */
  leadSteps: 12,
  /** RNG domain of the phase origin of an arm (the simulation seed shifts the sampled angles). */
  phaseDomain: 0x6a657470,
  /** The ray that measures the gap in front of a block starts this far off its surface, m. */
  // literal-ok-begin: named arithmetic control, documented where it is declared
  gapOffset: 2e-4,
  // literal-ok-end
  /** A miss of the tracer: the triangle word of a hit record. */
  miss: 0xffffffff,
  /** Domain of the stable keys of the droplet sources (`DropletSources.key`). */
  sourceDomain: 0x6a737263,
} as const;

const TWO_PI = 2 * Math.PI;

/** Offsets of the sub-rays over the jet section, in jet radii: equal areas, equal weights. */
export function subRayPattern(count: number): Float64Array {
  const out = new Float64Array(2 * count);
  const ring = (first: number, n: number, radius: number, turn: number): void => {
    for (let k = 0; k < n; k++) {
      const a = turn + (TWO_PI * k) / n;
      out[2 * (first + k)] = radius * Math.cos(a);
      out[2 * (first + k) + 1] = radius * Math.sin(a);
    }
  };
  // literal-ok-begin: sub-ray layout of sim-core M5, "Sampling" (a sampling pattern, not a physical quantity)
  if (count === 19) {
    // literal-ok-end
    // sim-core M5 "Sampling": centre, 6 at 0.45 r0, 12 at 0.82 r0.
    // literal-ok-begin: sub-ray layout of sim-core M5, "Sampling" (a sampling pattern, not a physical quantity)
    ring(1, 6, 0.45, 0);
    ring(7, 12, 0.82, Math.PI / 12);
    // literal-ok-end
  } else if (count === 7) {
    // Centre and 6 at 0.74 r0.
    // literal-ok-begin: sub-ray layout of sim-core M5, "Sampling" (a sampling pattern, not a physical quantity)
    ring(1, 6, 0.74, 0);
    // literal-ok-end
  } else if (count > 1) {
    ring(1, count - 1, Math.SQRT1_2, 0);
  }
  return out;
}

interface Bound {
  readonly closures: JetClosures;
  readonly table: FilmTable;
}

const bound = new WeakMap<ParamSet, Bound>();

function boundClosures(params: ParamSet): Bound {
  let b = bound.get(params);
  if (b === undefined) {
    const closures = bindJetClosures(params);
    b = { closures, table: buildFilmTable(closures) };
    bound.set(params, b);
  }
  return b;
}

/**
 * A footprint: one jet (or its part that strikes one face) on a wall, over a stretch of track.
 * The geometry (ellipse, stagnation zone) is that of the whole jet; the flow of the radial
 * film is that of the part that struck.
 */
interface Footprint {
  ox: number;
  oy: number;
  oz: number;
  nx: number;
  ny: number;
  nz: number;
  /** Forward tangent e_t and lateral tangent e_l = n x e_t. */
  tx: number;
  ty: number;
  tz: number;
  lx: number;
  ly: number;
  lz: number;
  /** Source point S (rear focus of the footprint ellipse). */
  sx: number;
  sy: number;
  sz: number;
  /** Incoming unit direction. */
  ux: number;
  uy: number;
  uz: number;
  speed: number;
  sinPhi: number;
  cosPhi: number;
  /** Diameter and radius of the jet as it arrives, m; volume flow of the part that strikes, m3/s. */
  d: number;
  r0: number;
  flow: number;
  /** (V r0^2 / 2) sin^3(phi) times the share that struck: q(psi) = qScale / (1 - cos psi cos phi)^2. */
  qScale: number;
  /** R_j(psi) = fanCoef q^(3/4). */
  fanCoef: number;
  /**
   * With den = 1 - cos psi cos phi: d_eq = dEq0 / den, ln Re_eq = lnRe0 - ln den,
   * R_j = fan0 / den^(3/2).
   */
  dEq0: number;
  lnRe0: number;
  fan0: number;
  /** Stagnation shear per unit X, Pa. */
  stagCoef: number;
  /** Stress scale of break-up, coherent share, splattered fraction. */
  stress: number;
  coherent: number;
  splatter: number;
}

function createFootprint(): Footprint {
  return {
    ox: 0,
    oy: 0,
    oz: 0,
    nx: 0,
    ny: 0,
    nz: 1,
    tx: 1,
    ty: 0,
    tz: 0,
    lx: 0,
    ly: 1,
    lz: 0,
    sx: 0,
    sy: 0,
    sz: 0,
    ux: 0,
    uy: 0,
    uz: -1,
    speed: 0,
    sinPhi: 1,
    cosPhi: 0,
    d: 0,
    r0: 0,
    flow: 0,
    qScale: 0,
    fanCoef: 0,
    dEq0: 0,
    lnRe0: 0,
    fan0: 0,
    stagCoef: 0,
    stress: 1,
    coherent: 1,
    splatter: 0,
  };
}

/** Sums over the sub-ray hits of a stretch of track. */
interface Sums {
  /** Number of sub-ray hits, and phases. */
  hits: number;
  phases: number;
  /** Mass, units. */
  mass: number;
  px: number;
  py: number;
  pz: number;
  nx: number;
  ny: number;
  nz: number;
  vx: number;
  vy: number;
  vz: number;
  dist: number;
}

function createSums(): Sums {
  return {
    hits: 0,
    phases: 0,
    mass: 0,
    px: 0,
    py: 0,
    pz: 0,
    nx: 0,
    ny: 0,
    nz: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    dist: 0,
  };
}

function addSums(s: Sums, g: Sums): void {
  s.hits += g.hits;
  s.phases += 1;
  s.mass += g.mass;
  s.px += g.px;
  s.py += g.py;
  s.pz += g.pz;
  s.nx += g.nx;
  s.ny += g.ny;
  s.nz += g.nz;
  s.vx += g.vx;
  s.vy += g.vy;
  s.vz += g.vz;
  s.dist += g.dist;
}

function clearSums(s: Sums): void {
  s.hits = 0;
  s.phases = 0;
  s.mass = 0;
  s.px = 0;
  s.py = 0;
  s.pz = 0;
  s.nx = 0;
  s.ny = 0;
  s.nz = 0;
  s.vx = 0;
  s.vy = 0;
  s.vz = 0;
  s.dist = 0;
}

const KIND_WALL = 0;
const KIND_RIM = 1;
const KIND_WIRE = 2;
const KIND_DIRECT = 3;

/** One group of sub-ray hits of a jet at a phase. */
interface Group extends Sums {
  instance: number;
  kind: number;
  /** Reference normal (first member) and the block nearest the centroid. */
  rx: number;
  ry: number;
  rz: number;
  block: number;
  first: number;
}

/** An open stretch of track of one jet on one face. */
interface Track {
  open: boolean;
  instance: number;
  kind: number;
  /** Reference normal for matching. */
  rx: number;
  ry: number;
  rz: number;
  lastPhase: number;
  fine: Sums;
  coarse: Sums;
  /** Start of the fine stretch. */
  fx: number;
  fy: number;
  fz: number;
  /** Start of the coarse stretch (the centre of its inner zone), its block, first and last hit centroid and phase. */
  cx: number;
  cy: number;
  cz: number;
  block: number;
  ex: number;
  ey: number;
  ez: number;
  firstPhase: number;
  /** Soil cells of the inner zone (built when first needed). */
  inner: number[];
  innerBuilt: boolean;
}

function createTrack(): Track {
  return {
    open: false,
    instance: 0,
    kind: KIND_WALL,
    rx: 0,
    ry: 0,
    rz: 1,
    lastPhase: -2,
    fine: createSums(),
    coarse: createSums(),
    fx: 0,
    fy: 0,
    fz: 0,
    cx: 0,
    cy: 0,
    cz: 0,
    block: 0,
    ex: 0,
    ey: 0,
    ez: 0,
    firstPhase: 0,
    inner: [],
    innerBuilt: false,
  };
}

/**
 * The clear distance in front of every block along its normal, m, out to `range` (Infinity
 * where nothing faces the block within it; Infinity for a block of the machine and for a line
 * element). One ray per block of an item, from just off its centre along its normal, with the
 * spray arms at their reference angle. What closes a gap is a surface: another item, a wall of
 * the tub, the door or a basket. A wire or tine (a line element), a perforated part and a
 * spray arm do not: water runs past the one and through the other.
 */
export async function coverGaps(
  scene: ExposureStageInput['scene'],
  backend: TraceBackend,
  range: number,
  seed: number,
): Promise<Float32Array> {
  const blocks = scene.blocks;
  const out = new Float32Array(blocks.count).fill(Infinity);
  if (!(range > 0)) return out;
  const isItem = scene.instances.map((instance) => instance.kind === 'item');
  const rotating = scene.instances.map((instance) => instance.rotating);
  const probe: number[] = [];
  for (let b = 0; b < blocks.count; b++) {
    if (isItem[blocks.instance[b] as number] !== true) continue;
    if (((blocks.flags[b] as number) & BLOCK_FLAG.line) !== 0) continue;
    probe.push(b);
  }
  if (probe.length === 0) return out;
  const buffer = new ArrayBuffer(4 * RAY_WORDS * probe.length);
  const rf = new Float32Array(buffer);
  const ru = new Uint32Array(buffer);
  const off = JET_STAGE_NUMERICS.gapOffset;
  for (let k = 0; k < probe.length; k++) {
    const b = probe[k] as number;
    const o = RAY_WORDS * k;
    const nx = blocks.normal[3 * b] as number;
    const ny = blocks.normal[3 * b + 1] as number;
    const nz = blocks.normal[3 * b + 2] as number;
    rf[o] = (blocks.centre[3 * b] as number) + off * nx;
    rf[o + 1] = (blocks.centre[3 * b + 1] as number) + off * ny;
    rf[o + 2] = (blocks.centre[3 * b + 2] as number) + off * nz;
    rf[o + 3] = range;
    rf[o + 4] = nx;
    rf[o + 5] = ny;
    rf[o + 6] = nz;
    ru[o + 7] = b;
  }
  const angles = scene.trace.roots.filter((root) => root.rotating !== null).map(() => 0);
  const hits = await backend.trace(buffer, probe.length, angles, seed >>> 0);
  const hf = new Float32Array(hits);
  const hu = new Uint32Array(hits);
  for (let k = 0; k < probe.length; k++) {
    const h = HIT_WORDS * k;
    if ((hu[h + 3] as number) === JET_STAGE_NUMERICS.miss) continue;
    const struck = hu[h + 1] as number;
    if (struck === SCENE_NONE || struck >= blocks.count) continue;
    const b = probe[k] as number;
    const other = blocks.instance[struck] as number;
    if (other === (blocks.instance[b] as number) || rotating[other] === true) continue;
    if (((blocks.flags[struck] as number) & (BLOCK_FLAG.line | BLOCK_FLAG.porous)) !== 0) continue;
    out[b] = (hf[h] as number) + off;
  }
  return out;
}

/**
 * How open the space in front of every block is to the fast film of a jet, 0 to 1: 1 for a
 * block of the machine, a line element, and a block of an item with no other body within
 * `fullGap` along its normal; 0 where another body faces it closer than `minGap`; linear
 * between (the gap is that of `coverGaps`).
 */
export async function fanOpenness(
  scene: ExposureStageInput['scene'],
  backend: TraceBackend,
  minGap: number,
  fullGap: number,
  seed: number,
): Promise<Float32Array> {
  const out = new Float32Array(scene.blocks.count).fill(1);
  if (!(fullGap > 0)) return out;
  const gaps = await coverGaps(scene, backend, fullGap, seed);
  const span = fullGap - minGap;
  for (let b = 0; b < out.length; b++) {
    const gap = gaps[b] as number;
    if (gap === Infinity) continue;
    out[b] = span > 0 ? Math.min(1, Math.max(0, (gap - minGap) / span)) : gap >= minGap ? 1 : 0;
  }
  return out;
}

/**
 * The jet stage: see the file comment. Returns the jet table, the hand-over to the film, the
 * droplet sources and the loads on items of one spray state.
 */
export async function jetStage(input: ExposureStageInput): Promise<JetStageOutput> {
  const { scene, state } = input;
  const jp = resolveJetParams(input.params);
  const { closures, table } = boundClosures(input.params);
  const water = bindSharedClosures(input.params).water(jp.solveTemperature);
  const rho = water.rho;
  const nu = water.nu;
  const gamma = water.gammaW;
  const gravity = scene.gravity;
  const blocks = scene.blocks;
  const cells = scene.soilCells;
  const graph = scene.graph;
  const seed = input.seed >>> 0;
  const period = state.period;

  input.onStage?.('jets:setup');
  const rotatingRoots = scene.trace.roots.filter((root) => root.rotating !== null).length;
  if (input.armLevels.length !== rotatingRoots) {
    throw new RangeError(
      `jetStage: ${input.armLevels.length} arm levels for ${rotatingRoots} rotating roots`,
    );
  }
  const rootArm = input.armLevels.map((level) => state.arms.findIndex((a) => a.level === level));
  const rotatingInstance = new Uint8Array(scene.instances.length);
  for (const instance of scene.instances)
    if (instance.rotating) rotatingInstance[instance.index] = 1;
  const itemOfInstance = new Int32Array(scene.instances.length).fill(-1);
  const itemInstances: number[] = [];
  for (const instance of scene.instances) {
    if (instance.kind !== 'item') continue;
    itemOfInstance[instance.index] = itemInstances.length;
    itemInstances.push(instance.index);
  }

  const official = input.tier.id === 'official';
  // literal-ok-begin: fallback for a missing entry of a registered vector (never taken with the registry defaults)
  const phasesTurning = jp.phases[official ? 0 : 1] ?? 2048;
  const handoverBins = jp.handoverBins[official ? 0 : 1] ?? 128;
  // literal-ok-end
  const subRays = Math.max(1, Math.round(input.tier.subRays));
  const pattern = subRayPattern(subRays);
  const sectors = jp.azimuthBins;
  const cosGroup = Math.cos(jp.groupNormalTol);
  const cosTurn = Math.cos(jp.fanMaxTurn);
  const level0 = jp.shearLevels[0] ?? 10;
  const level1 = jp.shearLevels[1] ?? Infinity;
  const level2 = jp.shearLevels[2] ?? Infinity;
  const level3 = jp.shearLevels[3] ?? Infinity;
  const mLevel0 = jp.momentumLevels[0] ?? Infinity;
  const mLevel1 = jp.momentumLevels[1] ?? Infinity;
  const mLevel2 = jp.momentumLevels[2] ?? Infinity;
  const mLevel3 = jp.momentumLevels[3] ?? Infinity;
  const lnStagRadius = Math.log(jp.stagRadius);
  const blockSize = scene.blockSize;

  // ---- accumulators
  const ACC = 15; // wet, duty, tau sum, p sum, M sum, tau peak, p peak, M peak, 3 tau levels, 4 M levels
  const slotOf = new Int32Array(cells.count).fill(-1);
  // literal-ok-begin: buffer size or fixed-point scale
  let slotCells = new Uint32Array(1024);
  let acc = new Float32Array(ACC * 1024);
  // literal-ok-end
  let slots = 0;
  const slotFor = (cell: number): number => {
    let slot = slotOf[cell] as number;
    if (slot >= 0) return slot;
    if (slots === slotCells.length) {
      const moreCells = new Uint32Array(2 * slots);
      moreCells.set(slotCells);
      slotCells = moreCells;
      const more = new Float32Array(2 * ACC * slots);
      more.set(acc);
      acc = more;
    }
    slot = slots++;
    slotOf[cell] = slot;
    slotCells[slot] = cell;
    return slot;
  };
  /**
   * Books `w` (share of a revolution) of the stresses of a fast film on a soil cell. The film
   * does not act where another item faces the surface too closely (`fanFactor`).
   */
  const expose = (cell: number, w: number, tau0: number, p0: number, m0: number): void => {
    const open = fanFactor[cells.block[cell] as number] as number;
    if (!(open > 0)) return;
    const tau = tau0 * open;
    const p = p0 * open;
    const m = m0 * open;
    const o = ACC * slotFor(cell);
    acc[o] = (acc[o] as number) + w;
    if (tau > level0) {
      acc[o + 1] = (acc[o + 1] as number) + w;
      acc[o + 2] = (acc[o + 2] as number) + w * tau;
      acc[o + 3] = (acc[o + 3] as number) + w * p;
      acc[o + 4] = (acc[o + 4] as number) + w * m;
      if (tau > level1) acc[o + 8] = (acc[o + 8] as number) + w;
      if (tau > level2) acc[o + 9] = (acc[o + 9] as number) + w;
      if (tau > level3) acc[o + 10] = (acc[o + 10] as number) + w;
    }
    if (tau > (acc[o + 5] as number)) acc[o + 5] = tau;
    if (p > (acc[o + 6] as number)) acc[o + 6] = p;
    if (m > (acc[o + 7] as number)) acc[o + 7] = m;
    if (m > mLevel0) acc[o + 11] = (acc[o + 11] as number) + w;
    if (m > mLevel1) acc[o + 12] = (acc[o + 12] as number) + w;
    if (m > mLevel2) acc[o + 13] = (acc[o + 13] as number) + w;
    if (m > mLevel3) acc[o + 14] = (acc[o + 14] as number) + w;
  };

  /** Per block: how open the space in front of it is to a fast film, 0 to 1 (see `fanOpenness`). */
  const fanFactor = new Float32Array(blocks.count).fill(1);

  const handover = new SparseSum(1 << 16);
  const handoverTotal = new Float64Array(blocks.count);
  const ledger = { nozzle: 0, lost: 0, handover: 0, splatter: 0, scatter: 0 };
  /**
   * Hands `mass` units to `block` in phase bin `bin`; with `bin` -1 (an arm that stands still,
   * whose jets run all the time) evenly over every bin, the remainder over the first ones.
   */
  const handTo = (block: number, bin: number, mass: number): void => {
    if (!(mass > 0)) return;
    if (bin >= 0) {
      handover.add(bin * blocks.count + block, mass);
    } else {
      const each = Math.floor(mass / handoverBins);
      const extra = mass - each * handoverBins;
      for (let k = 0; k < handoverBins; k++) {
        const units = each + (k < extra ? 1 : 0);
        if (units > 0) handover.add(k * blocks.count + block, units);
      }
    }
    handoverTotal[block] = (handoverTotal[block] as number) + mass;
    ledger.handover += mass;
  };

  // Droplet sources, grown as needed.
  // literal-ok-begin: buffer size or fixed-point scale
  let srcCap = 1024;
  // literal-ok-end
  let srcCount = 0;
  let srcKind = new Uint8Array(srcCap);
  let srcVec = new Float32Array(9 * srcCap); // origin, normal, forward
  let srcNum = new Float32Array(3 * srcCap); // shape, speed, size
  let srcMass = new Float64Array(srcCap);
  let srcKey = new Uint32Array(srcCap);
  let srcRoot = new Uint32Array(srcCap);
  let srcArm = new Uint8Array(srcCap);
  let srcPose = new Uint16Array(srcCap);
  const blockKeys = sceneBlockKeys(scene);
  /** The stretch of track the source being added belongs to (set before `addSource`). */
  let srcJet = 0;
  let srcFirstPhase = 0;
  let srcBlock = 0;
  let srcArmIndex = 0;
  let srcPoseIndex = 0;
  const addSource = (
    kind: number,
    fp: Footprint,
    ax: number,
    ay: number,
    az: number,
    shape: number,
    mass: number,
  ): void => {
    if (!(mass > 0)) return;
    if (srcCount === srcCap) {
      srcCap *= 2;
      const kk = new Uint32Array(srcCap);
      kk.set(srcKey);
      srcKey = kk;
      const rr = new Uint32Array(srcCap);
      rr.set(srcRoot);
      srcRoot = rr;
      const aa = new Uint8Array(srcCap);
      aa.set(srcArm);
      srcArm = aa;
      const pp = new Uint16Array(srcCap);
      pp.set(srcPose);
      srcPose = pp;
      const k = new Uint8Array(srcCap);
      k.set(srcKind);
      srcKind = k;
      const vv = new Float32Array(9 * srcCap);
      vv.set(srcVec);
      srcVec = vv;
      const nn = new Float32Array(3 * srcCap);
      nn.set(srcNum);
      srcNum = nn;
      const mm = new Float64Array(srcCap);
      mm.set(srcMass);
      srcMass = mm;
    }
    const i = srcCount++;
    srcKind[i] = kind;
    const splatter = kind === DROPLET_SOURCE.splatter;
    srcVec[9 * i] = splatter ? fp.sx : fp.ox;
    srcVec[9 * i + 1] = splatter ? fp.sy : fp.oy;
    srcVec[9 * i + 2] = splatter ? fp.sz : fp.oz;
    srcVec[9 * i + 3] = ax;
    srcVec[9 * i + 4] = ay;
    srcVec[9 * i + 5] = az;
    srcVec[9 * i + 6] = splatter ? fp.tx : fp.ux;
    srcVec[9 * i + 7] = splatter ? fp.ty : fp.uy;
    srcVec[9 * i + 8] = splatter ? fp.tz : fp.uz;
    srcNum[3 * i] = shape;
    srcNum[3 * i + 1] = fp.speed;
    srcNum[3 * i + 2] = fp.d;
    srcMass[i] = mass;
    srcKey[i] = hashU32(
      JET_STAGE_NUMERICS.sourceDomain,
      blockKeys[srcBlock] as number,
      srcJet,
      srcFirstPhase,
      kind,
    );
    srcRoot[i] = srcBlock;
    srcArm[i] = srcArmIndex;
    srcPose[i] = srcPoseIndex;
    if (splatter) ledger.splatter += mass;
    else ledger.scatter += mass;
  };

  // Loads: force x time share per (item, load bin).
  const loadBins = jp.loadBins;
  const loadSum = new Float64Array(3 * loadBins * itemInstances.length);
  /**
   * Books the impulse share (force x share of the revolution) of a stretch that lasted from
   * phase `first` to phase `last` of `phases`, spread evenly over the load bins it covers.
   */
  const addLoad = (
    item: number,
    first: number,
    last: number,
    phases: number,
    fx: number,
    fy: number,
    fz: number,
  ): void => {
    const from = (first / phases) * loadBins;
    const to = ((last + 1) / phases) * loadBins;
    const length = to - from;
    for (let lb = Math.floor(from); lb < loadBins && lb < to; lb++) {
      const part = (Math.min(to, lb + 1) - Math.max(from, lb)) / length;
      if (!(part > 0)) continue;
      const o = 3 * (item * loadBins + lb);
      loadSum[o] = (loadSum[o] as number) + part * fx;
      loadSum[o + 1] = (loadSum[o + 1] as number) + part * fy;
      loadSum[o + 2] = (loadSum[o + 2] as number) + part * fz;
    }
  };

  // ---- the spread of a fan over the surface (breadth-first over the cell graph)
  const stamp = new Uint32Array(blocks.count);
  let stampNow = 0;
  const queue = new Uint32Array(blocks.count);
  const centre = blocks.centre;
  const normal = blocks.normal;
  const area = blocks.area;
  const flags = blocks.flags;
  const blockInstance = blocks.instance;
  const soilFirst = blocks.soilFirst;
  const offsets = graph.offsets;
  const neighbour = graph.neighbour;

  // ---- evaluation of the closed forms at a point of the wall
  let evR = 0;
  let evTau = 0;
  let evP = 0;
  let evM = 0;
  let evLimit = 0;
  let evSector = 0;
  const rStar = new Float64Array(sectors).fill(Infinity);
  let useLead = false;
  /**
   * The jet's wall stresses at (x, y, z) for footprint `fp`. Sets evR, evLimit, evSector and,
   * when the point lies inside the fast film (returns true), evTau, evP and evM.
   */
  const evaluate = (fp: Footprint, x: number, y: number, z: number, stresses: boolean): boolean => {
    const vx = x - fp.sx;
    const vy = y - fp.sy;
    const vz = z - fp.sz;
    const r = Math.sqrt(vx * vx + vy * vy + vz * vz);
    const a = vx * fp.tx + vy * fp.ty + vz * fp.tz;
    const b = vx * fp.lx + vy * fp.ly + vz * fp.lz;
    const rt = Math.sqrt(a * a + b * b);
    // literal-ok-begin: arithmetic tolerance
    const cosPsi = rt > 1e-12 ? a / rt : 1;
    // literal-ok-end
    const den = 1 - cosPsi * fp.cosPhi;
    let limit = fp.fan0 / (den * Math.sqrt(den));
    if (useLead) {
      let sector = sectors >> 1;
      // literal-ok-begin: arithmetic tolerance
      if (rt > 1e-12) {
        // literal-ok-end
        sector = Math.floor(((Math.atan2(b, a) + Math.PI) / TWO_PI) * sectors);
        if (sector >= sectors) sector = sectors - 1;
        else if (sector < 0) sector = 0;
      }
      evSector = sector;
      const lead = rStar[sector] as number;
      if (lead < limit) limit = lead;
    }
    const edge = (fp.r0 * fp.sinPhi) / den;
    if (limit < edge) limit = edge;
    evR = r;
    evLimit = limit;
    if (r > limit) return false;
    if (!stresses) return true;
    const dEq = fp.dEq0 / den;
    const lnDen = Math.log(den);
    const lnRe = fp.lnRe0 - lnDen;
    // literal-ok-begin: arithmetic tolerance
    const lnX = r > 1e-9 * dEq ? Math.log(r / dEq) : -20;
    // literal-ok-end
    const scale = rho * fp.speed * fp.speed;
    let tau = scale * filmTableAt(table, lnX, lnRe, FILM_COLUMN.shear);
    // Position about the jet axis, the forward coordinate foreshortened.
    const wx = x - fp.ox;
    const wy = y - fp.oy;
    const wz = z - fp.oz;
    const xf = (wx * fp.tx + wy * fp.ty + wz * fp.tz) * fp.sinPhi;
    const xl = wx * fp.lx + wy * fp.ly + wz * fp.lz;
    const big = Math.sqrt(xf * xf + xl * xl) / fp.d;
    if (r <= edge + jp.stagEdge * dEq) {
      const stag = fp.stagCoef * big;
      if (stag < tau) tau = stag;
    }
    evTau = tau * fp.stress;
    evP =
      big < jp.pressureReach ? closures.wallPressure(fp.speed, rho, fp.sinPhi, big) * fp.stress : 0;
    evM = scale * dEq * filmTableAt(table, lnX, lnRe, FILM_COLUMN.momentum) * fp.stress;
    return true;
  };

  /** The azimuth sector of a point about the source point of `fp` (see `evaluate`). */
  const sectorOf = (fp: Footprint, x: number, y: number, z: number): number => {
    const vx = x - fp.sx;
    const vy = y - fp.sy;
    const vz = z - fp.sz;
    const a = vx * fp.tx + vy * fp.ty + vz * fp.tz;
    const b = vx * fp.lx + vy * fp.ly + vz * fp.lz;
    // literal-ok-begin: arithmetic tolerance
    if (!(a * a + b * b > 1e-24)) return sectors >> 1;
    // literal-ok-end
    const sector = Math.floor(((Math.atan2(b, a) + Math.PI) / TWO_PI) * sectors);
    return sector >= sectors ? sectors - 1 : sector < 0 ? 0 : sector;
  };

  // ---- footprints
  const fp = createFootprint();
  /**
   * Fills `fp` from the sums of a stretch of `jet`. `share` is the fraction of a revolution the
   * stretch lasts; `keep` the share of its flow that forms the footprint.
   */
  const makeFootprint = (s: Sums, jet: SprayJet, share: number, keep: number): void => {
    const inv = 1 / s.hits;
    fp.ox = s.px * inv;
    fp.oy = s.py * inv;
    fp.oz = s.pz * inv;
    let nx = s.nx;
    let ny = s.ny;
    let nz = s.nz;
    const nn = Math.hypot(nx, ny, nz);
    if (nn > 0) {
      nx /= nn;
      ny /= nn;
      nz /= nn;
    } else {
      nx = 0;
      ny = 0;
      nz = 1;
    }
    fp.nx = nx;
    fp.ny = ny;
    fp.nz = nz;
    const ux = s.vx * inv;
    const uy = s.vy * inv;
    const uz = s.vz * inv;
    const speed = Math.hypot(ux, uy, uz);
    fp.speed = speed;
    fp.ux = ux / speed;
    fp.uy = uy / speed;
    fp.uz = uz / speed;
    const un = ux * nx + uy * ny + uz * nz;
    let sinPhi = -un / speed;
    if (!(sinPhi > jp.minSinIncidence)) sinPhi = jp.minSinIncidence;
    if (sinPhi > 1) sinPhi = 1;
    let tx = ux - un * nx;
    let ty = uy - un * ny;
    let tz = uz - un * nz;
    const tn = Math.hypot(tx, ty, tz);
    let cosPhi = Math.sqrt(1 - sinPhi * sinPhi);
    // literal-ok-begin: arithmetic tolerance
    if (tn > 1e-6 * speed) {
      // literal-ok-end
      tx /= tn;
      ty /= tn;
      tz /= tn;
    } else {
      // Normal incidence: any tangent serves.
      // literal-ok-begin: choice of a helper axis that is not parallel to a direction
      const px = Math.abs(nx) < 0.9 ? 1 : 0;
      const py = Math.abs(nx) < 0.9 ? 0 : 1;
      // literal-ok-end
      tx = py * nz;
      ty = -px * nz;
      tz = px * ny - py * nx;
      const m = Math.hypot(tx, ty, tz);
      tx /= m;
      ty /= m;
      tz /= m;
      cosPhi = 0;
      sinPhi = 1;
    }
    fp.tx = tx;
    fp.ty = ty;
    fp.tz = tz;
    fp.lx = ny * tz - nz * ty;
    fp.ly = nz * tx - nx * tz;
    fp.lz = nx * ty - ny * tx;
    fp.sinPhi = sinPhi;
    fp.cosPhi = cosPhi;
    const flow = (keep * s.mass * WATER_UNIT) / (rho * share * period);
    fp.flow = flow;
    // The footprint and its stagnation zone are those of the whole jet as it arrives (a jet
    // clipped by an edge is not a thinner round jet); only the flow of the fan is the part
    // that struck.
    const d = Math.sqrt((4 * jet.flow) / (Math.PI * speed));
    const struck = Math.min(1, flow / jet.flow);
    fp.d = d;
    fp.r0 = 0.5 * d;
    const back = (fp.r0 * cosPhi) / sinPhi;
    fp.sx = fp.ox - back * tx;
    fp.sy = fp.oy - back * ty;
    fp.sz = fp.oz - back * tz;
    const flight = s.dist * inv;
    const breakup =
      jet.subJets > 1
        ? jp.sheetBreakup
        : closures.breakupLength(jet.speed, jet.diameter, rho, nu, gamma);
    const coherent = closures.coherentFraction(flight, breakup);
    fp.coherent = coherent;
    fp.stress = coherent + (1 - coherent) * jp.kDrop;
    const xi =
      coherent * closures.splatterFraction(speed, jet.diameter, flight, rho, gamma, sinPhi) +
      (1 - coherent) * jp.kDropTrain * sinPhi;
    fp.splatter = Math.min(jp.maxSplatter, Math.max(0, xi));
    fp.qScale = 0.5 * struck * speed * fp.r0 * fp.r0 * sinPhi * sinPhi * sinPhi;
    fp.fanCoef = closures.fanRadius(TWO_PI * (1 - fp.splatter), rho, nu, gamma);
    fp.dEq0 = Math.sqrt((8 * fp.qScale) / speed);
    fp.lnRe0 = Math.log((speed * fp.dEq0) / nu);
    fp.fan0 = fp.fanCoef * Math.pow(fp.qScale, 3 / 4);
    fp.stagCoef = closures.stagShear(speed, d, rho, nu, sinPhi, 1);
  };

  // ---- the inner zone: soil cells one by one, at the fine stride
  const buildInner = (track: Track, radius: number): void => {
    track.inner.length = 0;
    track.innerBuilt = true;
    const root = track.block;
    stampNow++;
    let head = 0;
    let tail = 0;
    queue[tail++] = root;
    stamp[root] = stampNow;
    const instance = track.instance;
    while (head < tail) {
      const b = queue[head++] as number;
      const dx = (centre[3 * b] as number) - track.cx;
      const dy = (centre[3 * b + 1] as number) - track.cy;
      const dz = (centre[3 * b + 2] as number) - track.cz;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < radius) {
        const first = soilFirst[b] as number;
        if (first !== SCENE_NONE) {
          for (let k = 0; k < 4; k++) {
            if ((cells.area[first + k] as number) > 0) track.inner.push(first + k);
          }
        }
      }
      if (dist > radius + Math.sqrt(area[b] as number)) continue;
      for (let e = offsets[b] as number; e < (offsets[b + 1] as number); e++) {
        const n = neighbour[e] as number;
        if (stamp[n] === stampNow) continue;
        stamp[n] = stampNow;
        if ((blockInstance[n] as number) !== instance) continue;
        if (((flags[n] as number) & BLOCK_FLAG.line) !== 0) continue;
        // The fast film does not run under a cover.
        if (!((fanFactor[n] as number) > 0)) continue;
        const dot =
          (normal[3 * n] as number) * track.rx +
          (normal[3 * n + 1] as number) * track.ry +
          (normal[3 * n + 2] as number) * track.rz;
        if (dot < cosTurn) continue;
        queue[tail++] = n;
      }
    }
  };

  const fineStrideOf = (jet: SprayJet): number =>
    Math.max(jp.gatherStride * jet.diameter, 0.25 * blockSize);
  const coarseStrideOf = (jet: SprayJet): number =>
    Math.max(jp.gatherOuterStride * jet.diameter, blockSize);
  const innerRadiusOf = (jet: SprayJet): number =>
    jp.gatherInner * jet.diameter + coarseStrideOf(jet);

  const closeFine = (track: Track, jet: SprayJet, phases: number): void => {
    const s = track.fine;
    if (s.hits === 0) return;
    if (
      itemOfInstance[track.instance] !== -1 &&
      (track.kind === KIND_WALL || track.kind === KIND_RIM)
    ) {
      const share = s.phases / phases;
      makeFootprint(s, jet, share, track.kind === KIND_RIM ? 1 - jp.rimScatter : 1);
      if (fp.flow > 0) {
        if (!track.innerBuilt) buildInner(track, innerRadiusOf(jet));
        useLead = false;
        const inner = track.inner;
        for (let i = 0; i < inner.length; i++) {
          const c = inner[i] as number;
          if (
            evaluate(
              fp,
              cells.centre[3 * c] as number,
              cells.centre[3 * c + 1] as number,
              cells.centre[3 * c + 2] as number,
              true,
            )
          ) {
            expose(c, share, evTau, evP, evM);
          }
        }
      }
    }
    clearSums(s);
  };

  // ---- the outer zone, the hand-over, the sources and the load, at the coarse stride
  const sectorFirst = new Int32Array(sectors + 1);
  const sectorShare = new Float64Array(sectors);
  const sectorOuter = new Int32Array(sectors);
  const sectorOuterR = new Float64Array(sectors);
  // literal-ok-begin: buffer size or fixed-point scale
  let ringBlock = new Uint32Array(4096);
  let ringSector = new Uint16Array(4096);
  // literal-ok-end
  let ringCount = 0;
  const ringOrder: number[] = [];

  /** The jet whose tracks are being closed (index into `state.jets`), and the pose bins of its arm. */
  let jetIndexNow = 0;
  let poseCountNow = 1;
  let posePhasesNow = 1;
  const closeCoarse = (track: Track, jet: SprayJet, armIndex: number, phases: number): void => {
    closeFine(track, jet, phases);
    const s = track.coarse;
    if (s.hits === 0) {
      track.innerBuilt = false;
      return;
    }
    const share = s.phases / phases;
    const midPhase = 0.5 * (track.firstPhase + track.lastPhase) + 0.5;
    const bin =
      phases === 1
        ? -1
        : Math.min(handoverBins - 1, Math.floor((midPhase / phases) * handoverBins));
    const mass = s.mass;
    const item = itemOfInstance[track.instance] as number;
    // What the droplet sources of this stretch are keyed by, and the pose of the arm then.
    srcJet = jetIndexNow;
    srcFirstPhase = track.firstPhase;
    srcBlock = track.block;
    srcArmIndex = armIndex;
    srcPoseIndex =
      phases === 1 ? 0 : Math.min(poseCountNow - 1, Math.floor(midPhase / posePhasesNow));

    if (track.kind === KIND_DIRECT) {
      handTo(track.block, bin, mass);
    } else if (track.kind === KIND_WIRE) {
      makeFootprint(s, jet, share, 1);
      const kept = Math.floor(jp.wireRetain * mass);
      handTo(track.block, bin, kept);
      const patch = scene.patches[blocks.patch[track.block] as number];
      const axis = patch?.axis ?? [0, 0, 1];
      addSource(
        DROPLET_SOURCE.wireFan,
        fp,
        axis[0],
        axis[1],
        axis[2],
        patch?.radius ?? 0,
        mass - kept,
      );
      // The wire sees the stagnation stresses of the jet across its width.
      const first = soilFirst[track.block] as number;
      if (first !== SCENE_NONE) {
        const tau = fp.stress * fp.stagCoef * jp.stagRadius;
        const p = fp.stress * closures.wallPressure(fp.speed, rho, 1, 0);
        for (let k = 0; k < 4; k++) {
          if ((cells.area[first + k] as number) > 0) expose(first + k, share, tau, p, 0);
        }
      }
      if (item >= 0) {
        // The fans carry part of the momentum on past the wire.
        const passed = (1 - jp.wireRetain) * jp.wireFanSpeed * Math.cos(jp.wireFanAngle);
        const f = rho * fp.flow * fp.speed * (1 - passed) * share;
        addLoad(item, track.firstPhase, track.lastPhase, phases, f * fp.ux, f * fp.uy, f * fp.uz);
      }
    } else {
      const keep = track.kind === KIND_RIM ? 1 - jp.rimScatter : 1;
      const scattered = track.kind === KIND_RIM ? Math.floor(jp.rimScatter * mass) : 0;
      const remaining = mass - scattered;
      makeFootprint(s, jet, share, keep > 0 ? keep : 1);
      if (scattered > 0) addSource(DROPLET_SOURCE.rimFan, fp, fp.nx, fp.ny, fp.nz, 0, scattered);
      if (!(remaining > 0)) {
        clearSums(s);
        track.innerBuilt = false;
        return;
      }
      const splattered = Math.floor(fp.splatter * remaining);
      addSource(DROPLET_SOURCE.splatter, fp, fp.nx, fp.ny, fp.nz, fp.sinPhi, splattered);
      const film = remaining - splattered;

      // The lead limit: ahead of a moving footprint the film exists only where it is faster.
      const arm = state.arms[armIndex];
      let sweepX = 0;
      let sweepY = 0;
      let sweepZ = 0;
      const span = track.lastPhase - track.firstPhase;
      if (arm !== undefined && !arm.stalled && arm.period > 0) {
        if (span > 0) {
          const time = (span * arm.period) / phases;
          sweepX = (track.ex - track.cx) / time;
          sweepY = (track.ey - track.cy) / time;
          sweepZ = (track.ez - track.cz) / time;
        } else {
          const w = arm.senseSign * arm.omega;
          sweepX = -w * (fp.oy - arm.axis[1]);
          sweepY = w * (fp.ox - arm.axis[0]);
        }
      }
      const sweepT = sweepX * fp.tx + sweepY * fp.ty + sweepZ * fp.tz;
      const sweepL = sweepX * fp.lx + sweepY * fp.ly + sweepZ * fp.lz;
      useLead = false;
      if (sweepT !== 0 || sweepL !== 0) {
        for (let k = 0; k < sectors; k++) {
          const psi = -Math.PI + ((k + 0.5) * TWO_PI) / sectors;
          const cosPsi = Math.cos(psi);
          const vr = sweepT * cosPsi + sweepL * Math.sin(psi);
          rStar[k] = Infinity;
          if (!(vr > 0)) continue;
          const den = 1 - cosPsi * fp.cosPhi;
          const q = fp.qScale / (den * den);
          const dEq = Math.sqrt((8 * q) / fp.speed);
          const lnRe = Math.log((fp.speed * dEq) / nu);
          const sq = Math.sqrt(q);
          const jump = fp.fanCoef * sq * Math.sqrt(sq);
          const target = vr / fp.speed;
          const lnJump = Math.log(jump / dEq);
          if (lnJump <= lnStagRadius) continue;
          if (filmTableAt(table, lnJump, lnRe, FILM_COLUMN.speed) >= target) continue;
          useLead = true;
          if (filmTableAt(table, lnStagRadius, lnRe, FILM_COLUMN.speed) <= target) {
            rStar[k] = 0;
            continue;
          }
          let lo = lnStagRadius;
          let hi = lnJump;
          for (let it = 0; it < JET_STAGE_NUMERICS.leadSteps; it++) {
            const mid = 0.5 * (lo + hi);
            if (filmTableAt(table, mid, lnRe, FILM_COLUMN.speed) > target) lo = mid;
            else hi = mid;
          }
          rStar[k] = dEq * Math.exp(0.5 * (lo + hi));
        }
      }

      // Spread over the surface from the struck block.
      const innerRadius = innerRadiusOf(jet);
      const gathers = item >= 0;
      const forward = fp.qScale / ((1 - fp.cosPhi) * (1 - fp.cosPhi));
      const sqf = Math.sqrt(forward);
      const reach = fp.fanCoef * sqf * Math.sqrt(sqf);
      for (let k = 0; k < sectors; k++) {
        sectorOuter[k] = -1;
        sectorOuterR[k] = -1;
      }
      ringCount = 0;
      stampNow++;
      let head = 0;
      let tail = 0;
      const root = track.block;
      queue[tail++] = root;
      stamp[root] = stampNow;
      const instance = track.instance;
      while (head < tail) {
        const b = queue[head++] as number;
        const bx = centre[3 * b] as number;
        const by = centre[3 * b + 1] as number;
        const bz = centre[3 * b + 2] as number;
        const first = soilFirst[b] as number;
        let stresses = false;
        if (gathers && first !== SCENE_NONE) {
          const dx = bx - track.cx;
          const dy = by - track.cy;
          const dz = bz - track.cz;
          stresses = dx * dx + dy * dy + dz * dz >= innerRadius * innerRadius;
        }
        const inside = evaluate(fp, bx, by, bz, stresses);
        const pad = Math.sqrt(area[b] as number);
        if (inside) {
          if (!useLead) evSector = sectorOf(fp, bx, by, bz);
          if (evR > (sectorOuterR[evSector] as number)) {
            sectorOuterR[evSector] = evR;
            sectorOuter[evSector] = b;
          }
          if (evR >= jp.handoverInner * evLimit) {
            if (ringCount === ringBlock.length) {
              const rb = new Uint32Array(2 * ringCount);
              rb.set(ringBlock);
              ringBlock = rb;
              const rs = new Uint16Array(2 * ringCount);
              rs.set(ringSector);
              ringSector = rs;
            }
            ringBlock[ringCount] = b;
            ringSector[ringCount] = evSector;
            ringCount++;
          }
          if (stresses) {
            for (let k = 0; k < 4; k++) {
              if ((cells.area[first + k] as number) > 0) expose(first + k, share, evTau, evP, evM);
            }
          }
        } else if (evR > evLimit + pad && b !== root) {
          continue;
        }
        if (evR > reach + pad) continue;
        for (let e = offsets[b] as number; e < (offsets[b + 1] as number); e++) {
          const n = neighbour[e] as number;
          if (stamp[n] === stampNow) continue;
          stamp[n] = stampNow;
          if ((blockInstance[n] as number) !== instance) continue;
          if (((flags[n] as number) & BLOCK_FLAG.line) !== 0) continue;
          // The fast film does not run under a cover: its water stops at the last open
          // block (the hand-over of a sector with no ring goes to the furthest one reached).
          if (!((fanFactor[n] as number) > 0)) continue;
          const dot =
            (normal[3 * n] as number) * fp.nx +
            (normal[3 * n + 1] as number) * fp.ny +
            (normal[3 * n + 2] as number) * fp.nz;
          if (dot < cosTurn) continue;
          queue[tail++] = n;
        }
      }

      // Hand the film flow over, sector by sector.
      if (film > 0) {
        const whole = closures.flowIntegral(fp.cosPhi, Math.PI);
        let before = -0.5;
        for (let k = 0; k < sectors; k++) {
          const edge = -Math.PI + ((k + 1) * TWO_PI) / sectors;
          const g =
            edge >= 0
              ? 0.5 * (closures.flowIntegral(fp.cosPhi, Math.min(edge, Math.PI)) / whole)
              : -0.5 * (closures.flowIntegral(fp.cosPhi, -edge) / whole);
          sectorShare[k] = g - before;
          before = g;
        }
        // Blocks of the outer ring, by sector.
        sectorFirst.fill(0);
        for (let i = 0; i < ringCount; i++) {
          const k = (ringSector[i] as number) + 1;
          sectorFirst[k] = (sectorFirst[k] as number) + 1;
        }
        for (let k = 0; k < sectors; k++) {
          sectorFirst[k + 1] = (sectorFirst[k + 1] as number) + (sectorFirst[k] as number);
        }
        ringOrder.length = ringCount;
        {
          const cursor = Array.from(sectorFirst.subarray(0, sectors));
          for (let i = 0; i < ringCount; i++) {
            const k = ringSector[i] as number;
            const at = cursor[k] as number;
            ringOrder[at] = ringBlock[i] as number;
            cursor[k] = at + 1;
          }
        }
        let cumulative = 0;
        let given = 0;
        for (let k = 0; k < sectors; k++) {
          cumulative += sectorShare[k] as number;
          const upTo = k === sectors - 1 ? film : Math.min(film, Math.floor(film * cumulative));
          const amount = upTo - given;
          given = upTo;
          if (!(amount > 0)) continue;
          const from = sectorFirst[k] as number;
          const to = sectorFirst[k + 1] as number;
          if (to > from) {
            let ringArea = 0;
            for (let i = from; i < to; i++) ringArea += area[ringOrder[i] as number] as number;
            let run = 0;
            let done = 0;
            for (let i = from; i < to; i++) {
              const b = ringOrder[i] as number;
              run += area[b] as number;
              const until = i === to - 1 ? amount : Math.floor((amount * run) / ringArea);
              handTo(b, bin, until - done);
              done = until;
            }
          } else {
            // The fan is cut short in this sector: its flow arrives at the last block it reached.
            const last = sectorOuter[k] as number;
            handTo(last >= 0 ? last : root, bin, amount);
          }
        }
      }

      if (item >= 0) {
        const f = rho * fp.flow * fp.speed * share;
        const fn = -f * fp.sinPhi;
        const ft = f * fp.cosPhi * jp.tangentialForce;
        addLoad(
          item,
          track.firstPhase,
          track.lastPhase,
          phases,
          fn * fp.nx + ft * fp.tx,
          fn * fp.ny + ft * fp.ty,
          fn * fp.nz + ft * fp.tz,
        );
      }
    }
    clearSums(s);
    track.innerBuilt = false;
  };

  // ---- trace, arm by arm
  input.onStage?.('jets:trace');
  const backend = await acquireTraceBackend(scene, input.gpu);
  {
    // The gap in front of every block of an item: one ray along its normal, arms at rest.
    const gapped = await fanOpenness(scene, backend, jp.fanMinGap, jp.fanFullGap, seed);
    fanFactor.set(gapped);
  }
  const launch = createJetLaunch();
  const armPoses: number[][] = state.arms.map(() => []);
  const angles = new Array<number>(rotatingRoots).fill(0);
  let rays = 0;
  let hitsTotal = 0;
  let flow = 0;
  const groups: Group[] = [];
  for (let g = 0; g < JET_STAGE_NUMERICS.maxGroups; g++) {
    groups.push({ ...createSums(), instance: 0, kind: 0, rx: 0, ry: 0, rz: 1, block: 0, first: 0 });
  }

  for (let armIndex = 0; armIndex < state.arms.length; armIndex++) {
    const arm = state.arms[armIndex];
    if (arm === undefined) continue;
    const armJets: number[] = [];
    state.jets.forEach((jet, j) => {
      if (jet.arm === armIndex) armJets.push(j);
    });
    if (armJets.length === 0) continue;
    const phases = arm.stalled || !(arm.period > 0) ? 1 : phasesTurning;
    // The simulation seed shifts the angles at which the arm is sampled by up to one phase, so
    // that the sampling error of a wash differs between seeds and can be averaged out.
    const phaseShift =
      u32ToUnitFloat(hashU32(seed, JET_STAGE_NUMERICS.phaseDomain, armIndex)) - 0.5;
    const poseBins = Math.min(jp.armPoseBins, phases);
    const perBin = Math.ceil(phases / poseBins);
    poseCountNow = Math.ceil(phases / perBin);
    posePhasesNow = perBin;
    const poses: number[] = [];
    armPoses[armIndex] = poses;
    const nJ = armJets.length;
    const capacity = perBin * nJ * subRays;

    // Integer mass of every jet per revolution of the master arm, and its split by phase.
    const jetMass = armJets.map((j) => {
      const jet = state.jets[j] as SprayJet;
      flow += jet.flow;
      const units = Math.round((rho * jet.flow * period) / WATER_UNIT);
      ledger.nozzle += units;
      return units;
    });
    const tracks: Track[][] = armJets.map(() => {
      const list: Track[] = [];
      for (let g = 0; g < JET_STAGE_NUMERICS.maxGroups; g++) list.push(createTrack());
      return list;
    });

    // State of the sub-rays of one pose bin.
    const px = new Float64Array(capacity);
    const py = new Float64Array(capacity);
    const pz = new Float64Array(capacity);
    const vx = new Float64Array(capacity);
    const vy = new Float64Array(capacity);
    const vz = new Float64Array(capacity);
    const dist = new Float64Array(capacity);
    const hitBlock = new Uint32Array(capacity);
    const struck = new Uint8Array(capacity);
    const hx = new Float64Array(capacity);
    const hy = new Float64Array(capacity);
    const hz = new Float64Array(capacity);
    const hnx = new Float32Array(capacity);
    const hny = new Float32Array(capacity);
    const hnz = new Float32Array(capacity);
    const live = new Int32Array(capacity);
    const segDt = new Float64Array(capacity);
    const segLen = new Float64Array(capacity);
    const rayBuffer = new ArrayBuffer(4 * RAY_WORDS * capacity);
    const rf = new Float32Array(rayBuffer);
    const ru = new Uint32Array(rayBuffer);

    for (let first = 0; first < phases; first += perBin) {
      const last = Math.min(phases, first + perBin);
      const count = (last - first) * nJ * subRays;
      // Pose of the arms for this bin.
      const midAngle = arm.stalled
        ? arm.stallAngle
        : (arm.senseSign * TWO_PI * (0.5 * (first + last) + phaseShift)) / phases;
      poses.push(midAngle);
      for (let r = 0; r < rotatingRoots; r++) {
        const other = rootArm[r] as number;
        if (other === armIndex) angles[r] = midAngle;
        else if (other < 0) angles[r] = 0;
        else {
          const o = state.arms[other];
          angles[r] =
            o === undefined || o.stalled
              ? (o?.stallAngle ?? 0)
              : TWO_PI *
                u32ToUnitFloat(
                  hashU32(seed, JET_STAGE_NUMERICS.otherArmDomain, armIndex, other, first),
                );
        }
      }
      // Launch.
      let nLive = 0;
      for (let p = first; p < last; p++) {
        const angle = arm.stalled
          ? arm.stallAngle
          : (arm.senseSign * TWO_PI * (p + 0.5 + phaseShift)) / phases;
        for (let jj = 0; jj < nJ; jj++) {
          const jet = state.jets[armJets[jj] as number] as SprayJet;
          jetLaunch(state, jet, angle, launch);
          // A frame across the jet.
          let e1x = launch.dy;
          let e1y = -launch.dx;
          let e1z = 0;
          let m = Math.hypot(e1x, e1y);
          // literal-ok-begin: arithmetic tolerance
          if (m < 1e-6) {
            // literal-ok-end
            e1x = 1;
            e1y = 0;
            m = 1;
          }
          e1x /= m;
          e1y /= m;
          const e2x = launch.dy * e1z - launch.dz * e1y;
          const e2y = launch.dz * e1x - launch.dx * e1z;
          const e2z = launch.dx * e1y - launch.dy * e1x;
          const r0 = 0.5 * jet.diameter;
          const base = ((p - first) * nJ + jj) * subRays;
          for (let s = 0; s < subRays; s++) {
            const i = base + s;
            const a = (pattern[2 * s] as number) * r0;
            const b = (pattern[2 * s + 1] as number) * r0;
            px[i] = launch.ox + launch.dx * jp.launchOffset + a * e1x + b * e2x;
            py[i] = launch.oy + launch.dy * jp.launchOffset + a * e1y + b * e2y;
            pz[i] = launch.oz + launch.dz * jp.launchOffset + a * e1z + b * e2z;
            vx[i] = launch.speed * launch.dx;
            vy[i] = launch.speed * launch.dy;
            vz[i] = launch.speed * launch.dz;
            dist[i] = 0;
            struck[i] = 0;
            hitBlock[i] = SCENE_NONE;
            live[nLive++] = i;
          }
        }
      }
      rays += count;
      // Flight: one straight segment of the parabola per wave.
      for (let wave = 0; wave < jp.maxSegments && nLive > 0; wave++) {
        for (let k = 0; k < nLive; k++) {
          const i = live[k] as number;
          const sx = vx[i] as number;
          const sy = vy[i] as number;
          const sz = vz[i] as number;
          const speed = Math.sqrt(sx * sx + sy * sy + sz * sz);
          const across = (gravity * Math.sqrt(sx * sx + sy * sy)) / speed;
          let dt = jp.maxSegmentLength / speed;
          // literal-ok-begin: arithmetic tolerance
          if (across > 1e-9) {
            // literal-ok-end
            const sag = Math.sqrt((8 * jp.sagTolerance) / across);
            if (sag < dt) dt = sag;
          }
          const ex = sx * dt;
          const ey = sy * dt;
          const ez = sz * dt - 0.5 * gravity * dt * dt;
          const len = Math.sqrt(ex * ex + ey * ey + ez * ez);
          segDt[k] = dt;
          segLen[k] = len;
          const o = RAY_WORDS * k;
          rf[o] = px[i] as number;
          rf[o + 1] = py[i] as number;
          rf[o + 2] = pz[i] as number;
          rf[o + 3] = len;
          rf[o + 4] = ex / len;
          rf[o + 5] = ey / len;
          rf[o + 6] = ez / len;
          ru[o + 7] = (first * nJ * subRays + i) >>> 0;
        }
        const out = await backend.trace(rayBuffer, nLive, angles, seed);
        const hf = new Float32Array(out);
        const hu = new Uint32Array(out);
        let kept = 0;
        for (let k = 0; k < nLive; k++) {
          const i = live[k] as number;
          const h = HIT_WORDS * k;
          const o = RAY_WORDS * k;
          const dt = segDt[k] as number;
          const len = segLen[k] as number;
          if ((hu[h + 3] as number) !== JET_STAGE_NUMERICS.miss) {
            const t = Math.min(len, Math.max(0, hf[h] as number));
            const part = len > 0 ? t / len : 0;
            hx[i] = (px[i] as number) + (rf[o + 4] as number) * t;
            hy[i] = (py[i] as number) + (rf[o + 5] as number) * t;
            hz[i] = (pz[i] as number) + (rf[o + 6] as number) * t;
            vz[i] = (vz[i] as number) - gravity * dt * part;
            dist[i] = (dist[i] as number) + t;
            hnx[i] = hf[h + 4] as number;
            hny[i] = hf[h + 5] as number;
            hnz[i] = hf[h + 6] as number;
            hitBlock[i] = hu[h + 1] as number;
            struck[i] = 1;
          } else {
            px[i] = (px[i] as number) + (vx[i] as number) * dt;
            py[i] = (py[i] as number) + (vy[i] as number) * dt;
            pz[i] = (pz[i] as number) + (vz[i] as number) * dt - 0.5 * gravity * dt * dt;
            vz[i] = (vz[i] as number) - gravity * dt;
            dist[i] = (dist[i] as number) + len;
            live[kept++] = i;
          }
        }
        nLive = kept;
      }

      // Classify and accumulate, phase by phase.
      for (let p = first; p < last; p++) {
        for (let jj = 0; jj < nJ; jj++) {
          const jet = state.jets[armJets[jj] as number] as SprayJet;
          jetIndexNow = armJets[jj] as number;
          const total = jetMass[jj] as number;
          const perPhase =
            Math.floor(total / phases) + (p < total - phases * Math.floor(total / phases) ? 1 : 0);
          const perRay = Math.floor(perPhase / subRays);
          const extra = perPhase - subRays * perRay;
          const base = ((p - first) * nJ + jj) * subRays;
          let nGroups = 0;
          for (let s = 0; s < subRays; s++) {
            const i = base + s;
            const mass = perRay + (s < extra ? 1 : 0);
            const b = hitBlock[i] as number;
            if (struck[i] === 0 || b === SCENE_NONE) {
              ledger.lost += mass;
              continue;
            }
            hitsTotal++;
            const instance = blockInstance[b] as number;
            const flag = flags[b] as number;
            const kind =
              rotatingInstance[instance] === 1 || (flag & BLOCK_FLAG.porous) !== 0
                ? KIND_DIRECT
                : (flag & BLOCK_FLAG.line) !== 0
                  ? KIND_WIRE
                  : KIND_WALL;
            const nx = hnx[i] as number;
            const ny = hny[i] as number;
            const nz = hnz[i] as number;
            let found = -1;
            for (let g = 0; g < nGroups; g++) {
              const group = groups[g] as Group;
              if (group.instance !== instance || group.kind !== kind) continue;
              if (kind === KIND_WALL) {
                if (nx * group.rx + ny * group.ry + nz * group.rz < cosGroup) continue;
              } else if (group.block !== b) {
                continue;
              }
              found = g;
              break;
            }
            if (found < 0) {
              if (nGroups < JET_STAGE_NUMERICS.maxGroups) {
                found = nGroups++;
                const group = groups[found] as Group;
                clearSums(group);
                group.instance = instance;
                group.kind = kind;
                group.rx = nx;
                group.ry = ny;
                group.rz = nz;
                group.block = b;
                group.first = i;
              } else {
                found = nGroups - 1;
              }
            }
            const group = groups[found] as Group;
            group.hits++;
            group.mass += mass;
            group.px += hx[i] as number;
            group.py += hy[i] as number;
            group.pz += hz[i] as number;
            group.nx += nx;
            group.ny += ny;
            group.nz += nz;
            group.vx += vx[i] as number;
            group.vy += vy[i] as number;
            group.vz += vz[i] as number;
            group.dist += dist[i] as number;
          }
          // A bundle that straddles a convex edge of one item strikes a rim.
          for (let g = 0; g < nGroups; g++) {
            const a = groups[g] as Group;
            if (a.kind !== KIND_WALL && a.kind !== KIND_RIM) continue;
            for (let h = g + 1; h < nGroups; h++) {
              const b = groups[h] as Group;
              if (b.instance !== a.instance || (b.kind !== KIND_WALL && b.kind !== KIND_RIM))
                continue;
              const dx = b.px / b.hits - a.px / a.hits;
              const dy = b.py / b.hits - a.py / a.hits;
              const dz = b.pz / b.hits - a.pz / a.hits;
              const fromA = dx * a.rx + dy * a.ry + dz * a.rz;
              const fromB = -(dx * b.rx + dy * b.ry + dz * b.rz);
              if (fromA < 0 && fromB < 0) {
                a.kind = KIND_RIM;
                b.kind = KIND_RIM;
              }
            }
          }
          // The block nearest the centroid of a wall group roots its fan.
          const list = tracks[jj] as Track[];
          for (let g = 0; g < nGroups; g++) {
            const group = groups[g] as Group;
            const cx = group.px / group.hits;
            const cy = group.py / group.hits;
            const cz = group.pz / group.hits;
            if (group.kind === KIND_WALL || group.kind === KIND_RIM) {
              let best = Infinity;
              for (let s = 0; s < subRays; s++) {
                const i = base + s;
                const b = hitBlock[i] as number;
                if (struck[i] === 0 || b === SCENE_NONE) continue;
                if ((blockInstance[b] as number) !== group.instance) continue;
                const d2 =
                  ((hx[i] as number) - cx) ** 2 +
                  ((hy[i] as number) - cy) ** 2 +
                  ((hz[i] as number) - cz) ** 2;
                if (d2 < best) {
                  best = d2;
                  group.block = b;
                }
              }
            }
            // Find the open stretch this group continues.
            let track: Track | undefined;
            for (let c = 0; c < list.length; c++) {
              const candidate = list[c] as Track;
              if (!candidate.open || candidate.lastPhase !== p - 1) continue;
              if (candidate.instance !== group.instance || candidate.kind !== group.kind) continue;
              if (group.kind === KIND_WALL || group.kind === KIND_RIM) {
                const inv = 1 / Math.hypot(group.nx, group.ny, group.nz);
                if (
                  (group.nx * candidate.rx + group.ny * candidate.ry + group.nz * candidate.rz) *
                    inv <
                  cosGroup
                ) {
                  continue;
                }
              } else if (candidate.block !== group.block) {
                continue;
              }
              track = candidate;
              break;
            }
            if (track !== undefined) {
              if (
                track.fine.hits > 0 &&
                Math.hypot(cx - track.fx, cy - track.fy, cz - track.fz) > fineStrideOf(jet)
              ) {
                closeFine(track, jet, phases);
              }
              if (Math.hypot(cx - track.cx, cy - track.cy, cz - track.cz) > coarseStrideOf(jet)) {
                closeCoarse(track, jet, armIndex, phases);
              }
            } else {
              track = list.find((t) => !t.open);
              if (track === undefined) {
                // Every slot is taken by a stretch that has just ended: close the oldest.
                track = list.reduce((a, b) => (a.lastPhase <= b.lastPhase ? a : b));
                closeCoarse(track, jet, armIndex, phases);
              }
              track.open = true;
              track.instance = group.instance;
              track.kind = group.kind;
              clearSums(track.fine);
              clearSums(track.coarse);
              track.innerBuilt = false;
            }
            if (track.coarse.hits === 0) {
              track.cx = cx;
              track.cy = cy;
              track.cz = cz;
              track.block = group.block;
              track.firstPhase = p;
              const inv = 1 / Math.hypot(group.nx, group.ny, group.nz);
              track.rx = group.nx * inv;
              track.ry = group.ny * inv;
              track.rz = group.nz * inv;
              track.innerBuilt = false;
            }
            if (track.fine.hits === 0) {
              track.fx = cx;
              track.fy = cy;
              track.fz = cz;
            }
            track.ex = cx;
            track.ey = cy;
            track.ez = cz;
            track.lastPhase = p;
            addSums(track.coarse, group);
            // Only items carry soil cells: other tracks need no fine stretches.
            if (itemOfInstance[track.instance] !== -1) addSums(track.fine, group);
          }
          // Stretches this phase did not continue have ended.
          for (let c = 0; c < list.length; c++) {
            const track = list[c] as Track;
            if (track.open && track.lastPhase !== p) {
              closeCoarse(track, jet, armIndex, phases);
              track.open = false;
            }
          }
        }
      }
    }
    // The revolution is over: close what is open.
    for (let jj = 0; jj < nJ; jj++) {
      const jet = state.jets[armJets[jj] as number] as SprayJet;
      jetIndexNow = armJets[jj] as number;
      for (const track of tracks[jj] as Track[]) {
        if (!track.open) continue;
        closeCoarse(track, jet, armIndex, phases);
        track.open = false;
      }
    }
  }

  // ---- tables in index order
  input.onStage?.('jets:tables');
  const order = new Uint32Array(slots);
  for (let i = 0; i < slots; i++) order[i] = slotCells[i] as number;
  order.sort();
  const cell = new Uint32Array(slots);
  const values = new Float32Array(JET_FIELD_COUNT * slots);
  for (let n = 0; n < slots; n++) {
    const c = order[n] as number;
    const o = ACC * (slotOf[c] as number);
    const v = JET_FIELD_COUNT * n;
    const duty = acc[o + 1] as number;
    const inv = duty > 0 ? 1 / duty : 0;
    cell[n] = c;
    values[v + JET_FIELD.duty] = Math.min(1, duty);
    values[v + JET_FIELD.shearPeak] = acc[o + 5] as number;
    values[v + JET_FIELD.shearMean] = (acc[o + 2] as number) * inv;
    values[v + JET_FIELD.pressurePeak] = acc[o + 6] as number;
    values[v + JET_FIELD.pressureMean] = (acc[o + 3] as number) * inv;
    values[v + JET_FIELD.momentumPeak] = acc[o + 7] as number;
    values[v + JET_FIELD.momentumMean] = (acc[o + 4] as number) * inv;
    values[v + JET_FIELD.wetDuty] = Math.min(1, acc[o] as number);
    values[v + JET_FIELD.shearDuty1] = Math.min(1, acc[o + 8] as number);
    values[v + JET_FIELD.shearDuty2] = Math.min(1, acc[o + 9] as number);
    values[v + JET_FIELD.shearDuty3] = Math.min(1, acc[o + 10] as number);
    values[v + JET_FIELD.momentumDuty0] = Math.min(1, acc[o + 11] as number);
    values[v + JET_FIELD.momentumDuty1] = Math.min(1, acc[o + 12] as number);
    values[v + JET_FIELD.momentumDuty2] = Math.min(1, acc[o + 13] as number);
    values[v + JET_FIELD.momentumDuty3] = Math.min(1, acc[o + 14] as number);
  }

  const entries = handover.entries();
  const hoOffsets = new Uint32Array(handoverBins + 1);
  const hoBlock = new Uint32Array(entries.keys.length);
  for (let i = 0; i < entries.keys.length; i++) {
    const key = entries.keys[i] as number;
    const bin = Math.floor(key / blocks.count);
    hoBlock[i] = key - bin * blocks.count;
    hoOffsets[bin + 1] = (hoOffsets[bin + 1] as number) + 1;
  }
  for (let k = 0; k < handoverBins; k++) {
    hoOffsets[k + 1] = (hoOffsets[k + 1] as number) + (hoOffsets[k] as number);
  }
  const handoverTable: JetHandover = {
    blockCount: blocks.count,
    bins: handoverBins,
    offsets: hoOffsets,
    block: hoBlock,
    mass: entries.values,
  };

  let wetted = 0;
  for (let b = 0; b < blocks.count; b++) if ((handoverTotal[b] as number) > 0) wetted++;
  const arrivalBlock = new Uint32Array(wetted);
  const arrivalFlux = new Float32Array(wetted);
  let n = 0;
  for (let b = 0; b < blocks.count; b++) {
    const units = handoverTotal[b] as number;
    if (!(units > 0)) continue;
    arrivalBlock[n] = b;
    arrivalFlux[n] = (units * WATER_UNIT) / (period * (area[b] as number));
    n++;
  }

  const sources: DropletSources = {
    count: srcCount,
    kind: srcKind.slice(0, srcCount),
    origin: new Float32Array(3 * srcCount),
    normal: new Float32Array(3 * srcCount),
    forward: new Float32Array(3 * srcCount),
    shape: new Float32Array(srcCount),
    speed: new Float32Array(srcCount),
    size: new Float32Array(srcCount),
    mass: srcMass.slice(0, srcCount),
    key: srcKey.slice(0, srcCount),
    block: srcRoot.slice(0, srcCount),
    arm: srcArm.slice(0, srcCount),
    pose: srcPose.slice(0, srcCount),
  };
  for (let i = 0; i < srcCount; i++) {
    for (let k = 0; k < 3; k++) {
      sources.origin[3 * i + k] = srcVec[9 * i + k] as number;
      sources.normal[3 * i + k] = srcVec[9 * i + 3 + k] as number;
      sources.forward[3 * i + k] = srcVec[9 * i + 6 + k] as number;
    }
    sources.shape[i] = srcNum[3 * i] as number;
    sources.speed[i] = srcNum[3 * i + 1] as number;
    sources.size[i] = srcNum[3 * i + 2] as number;
  }

  const loads: ItemJetLoad[] = [];
  itemInstances.forEach((instanceIndex, item) => {
    let mx = 0;
    let my = 0;
    let mz = 0;
    let peak = 0;
    let peakUp = 0;
    for (let lb = 0; lb < loadBins; lb++) {
      const o = 3 * (item * loadBins + lb);
      const fx = loadSum[o] as number;
      const fy = loadSum[o + 1] as number;
      const fz = loadSum[o + 2] as number;
      mx += fx;
      my += fy;
      mz += fz;
      // The sums hold force x share of the revolution; a bin lasts 1 / loadBins of it.
      const mag = Math.hypot(fx, fy, fz) * loadBins;
      if (mag > peak) peak = mag;
      if (fz * loadBins > peakUp) peakUp = fz * loadBins;
    }
    if (!(peak > 0)) return;
    const instance = scene.instances[instanceIndex];
    if (instance === undefined) return;
    const mass = input.itemMass?.get(instance.id);
    loads.push({
      instance: instanceIndex,
      itemId: instance.id,
      mean: [mx, my, mz],
      peak,
      peakUp,
      ...(mass !== undefined && mass > 0 ? { liftRatio: peakUp / (mass * gravity) } : {}),
    });
  });

  if (ledger.nozzle !== ledger.lost + ledger.handover + ledger.splatter + ledger.scatter) {
    throw new Error(
      `jetStage: water is not conserved (${ledger.nozzle} units out of the nozzles, ` +
        `${ledger.lost + ledger.handover + ledger.splatter + ledger.scatter} accounted for)`,
    );
  }

  return {
    exposure: { soilCellCount: cells.count, cell, values },
    arrival: { blockCount: blocks.count, block: arrivalBlock, flux: arrivalFlux },
    stats: {
      rays,
      hits: hitsTotal,
      flow,
      lostFlow: (ledger.lost * WATER_UNIT) / (rho * period),
    },
    handover: handoverTable,
    sources,
    loads,
    ledger,
    backend: backend.kind,
    armPoses,
  };
}
