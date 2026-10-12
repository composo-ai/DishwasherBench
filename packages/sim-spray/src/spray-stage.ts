/**
 * The secondary-water stage of the first build (docs/design/scope.md, "Indirect water";
 * docs/design/sim-core.md section M6; docs/research/jets.md sections 3.7, 5.6, 6 and 7.3):
 * every droplet of one spray state, as Monte Carlo parcels.
 *
 *   sources   the splatter rings and the wire and rim fans the jet stage wrote, and the showers
 *             of fixed sprayers (the Bosch roof sprinkler is a droplet source, not a jet)
 *   parcels   every source is flown as its own mass over parcels of `spray.parcelMass`, at
 *             least one (whole units, so the total is exact). Position, direction, speed and
 *             size are points of a Halton sequence shifted by a hash of the seed and
 *             of the STABLE KEY of the source (the jet, the phase its stretch began at, the
 *             block it strikes: `DropletSources.key`), so the parcels of a source are spread
 *             evenly over what it emits and do not depend on anything else in the machine
 *   flight    gravity and drag in still air, as chains of straight segments through the scene's
 *             segment query (`flight.ts`), on the GPU where there is one. The parcels of a
 *             source fly past the spray arms as they stood when the source was sampled (the
 *             pose of the arm that carries its jet); those of a fixed sprayer are spread over
 *             the poses of the master arm
 *   landing   stick, rebound, deposit or splash by the normal Weber number (`flight.ts`); a
 *             splash sends an integer share of the mass on as two secondary parcels, which do
 *             not splash again; everything else lands
 *   settling  what lands is shared among the faces about the landing by the landing kernel
 *             (`landing-kernel.ts`): by the area each presents to the direction the droplet
 *             flew in, where it can be reached from that direction. A contact shadow, a nest or
 *             a covered face is not filled; a slender part receives its share
 *   drips     the same flight and landing for the drops that leave the drip sites of the
 *             scene: a table of where each site's water lands (`DripTransfer`), which the
 *             film stage applies to whatever arrives at the site, so that film and drips are
 *             marched together. A drop lands where it lands: no kernel
 *
 * Deposits are per block and per revolution, in whole units of `WATER_UNIT`; emitted mass
 * equals deposited plus lost exactly (`SprayLedger`).
 *
 * Simplifications (each ignores something calibration may ask for):
 *  - no tangential momentum handed to the film, no impact-shear counters;
 *  - before the film is solved a wall counts as wetted by its material (`spray.wetWallAngle`)
 *    or because a jet hands water to it; drips always land on a wetted wall;
 *  - deposits are per-revolution means: not binned by the phase of the arm;
 *  - every parcel carries about the same mass (no pilot, no importance sampling);
 *  - the simplifications of the landing kernel (see `landing-kernel.ts`);
 *  - still air; droplets do not collide, merge or break up in flight;
 *  - a drip leaves as drops of one size from rest (3.3 capillary lengths from an edge, Tate's
 *    law from a wire), whatever the flow: no columns, no sheets;
 *  - while a droplet flies, the arms stand still (at the pose of its source).
 *
 * Deterministic: every random number is a hash of the seed and of what it belongs to (a
 * source by its stable key, a drip site by the stable key of its block), never of a running
 * index over the whole machine: an edit elsewhere leaves the droplets of an untouched source
 * as they were, and what an untouched item receives changes only where the water that reaches
 * it does. Parcels are traced and resolved in a fixed order; masses are integers.
 *
 * Units: SI. Frame: tub frame.
 */

import { hashU32, randomNormal, u32ToUnitFloat } from '@spotless/core';
import {
  acquireTraceBackend,
  bindSharedClosures,
  DROPLET_SOURCE,
  resolveJetParams,
  SparseSum,
  WATER_UNIT,
  type ExposureStageInput,
  type JetParams,
  type JetStageOutput,
  type TraceBackend,
} from '@spotless/sim-jets';
import {
  BLOCK_FLAG,
  HIT_WORDS,
  RAY_WORDS,
  SCENE_NONE,
  sceneBlockKeys,
  type WashScene,
} from '@spotless/sim-scene';
import {
  createFlightStep,
  createWallImpact,
  flightStep,
  WALL_OUTCOME,
  wallImpact,
  type FlightMedium,
} from './flight.ts';
import { buildLandingKernel, LandingTally, type LandingKernel } from './landing-kernel.ts';
import { resolveSprayParams, type SprayParams } from './params.ts';
import {
  DRIP_WEIGHT_ONE,
  type DripTransfer,
  type SecondaryWaterOutput,
} from './secondary-water.ts';

/** Arithmetic controls of the stage (not physical quantities). */
export const SPRAY_STAGE_NUMERICS = {
  /** RNG domains: source parcels, their secondaries, drip parcels, the angles of the arms. */
  sourceDomain: 0x73707263,
  secondaryDomain: 0x73706c73,
  dripDomain: 0x64726970,
  armDomain: 0x73706172,
  showerDomain: 0x73686f77,
  /** RNG domain of the turn of the outline rays of a droplet about its centre line. */
  outlineDomain: 0x73706f6c,
  /** Parcels flown together (bounds the buffers of one wave). */
  // literal-ok-begin: buffer size or fixed-point scale
  chunk: 1 << 18,
  // literal-ok-end
  /** A miss of the tracer: the triangle word of a hit record. */
  miss: 0xffffffff,
  /** Numbers a parcel draws from the sequence of its source (at most the bases there are). */
  draws: 6,
} as const;

const TWO_PI = 2 * Math.PI;

/** The golden angle, radians: the turn between successive points of a sunflower pattern. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * The radical inverse of `index` in `base`: its digits mirrored about the point (the Halton
 * sequence in one dimension). The first b^m values fill b^m equal parts of [0, 1) one each.
 */
export function radicalInverse(index: number, base: number): number {
  let result = 0;
  let fraction = 1 / base;
  let i = index;
  while (i > 0) {
    result += (i % base) * fraction;
    i = Math.floor(i / base);
    fraction /= base;
  }
  return result;
}

/** The bases of the dimensions of the sequence a source draws its parcels from: the first primes. */
// literal-ok-begin: sampling pattern (the bases of a Halton sequence), not a physical quantity
const SEQUENCE_BASES: readonly number[] = [2, 3, 5, 7, 11, 13];
// literal-ok-end

/** A growable set of parcels, as parallel arrays. */
class Cloud {
  count = 0;
  px: Float64Array;
  py: Float64Array;
  pz: Float64Array;
  ux: Float64Array;
  uy: Float64Array;
  uz: Float64Array;
  mass: Float64Array;
  diameter: Float32Array;
  owner: Int32Array;
  /** Stable key of the parcel: its random numbers and its ray key. */
  key: Uint32Array;
  generation: Uint8Array;
  bounces: Uint8Array;
  segments: Uint16Array;
  /** 1 while the parcel is flown with its outline (see `fly`), else 0. */
  outline: Uint8Array;
  /**
   * Where the parcel was and how it moved after its last event (its start, or its last
   * rebound), and the segments it had flown by then: what it is flown again from when its
   * outline has to be followed.
   */
  eventP: Float64Array;
  eventU: Float64Array;
  eventSegments: Uint16Array;
  /**
   * 1 for a droplet that has not left the wall yet: it stands where its jet strikes, and
   * `leaveE` (a unit vector) and `leaveRun` (metres) lead to the place it is born at;
   * `leaveLift` is the sine of the elevation above the wall it leaves at (see `fly`).
   */
  leaving: Uint8Array;
  leaveE: Float32Array;
  leaveRun: Float32Array;
  leaveLift: Float32Array;

  constructor(capacity: number) {
    const n = Math.max(16, capacity);
    this.px = new Float64Array(n);
    this.py = new Float64Array(n);
    this.pz = new Float64Array(n);
    this.ux = new Float64Array(n);
    this.uy = new Float64Array(n);
    this.uz = new Float64Array(n);
    this.mass = new Float64Array(n);
    this.diameter = new Float32Array(n);
    this.owner = new Int32Array(n);
    this.key = new Uint32Array(n);
    this.generation = new Uint8Array(n);
    this.bounces = new Uint8Array(n);
    this.segments = new Uint16Array(n);
    this.outline = new Uint8Array(n);
    this.eventP = new Float64Array(3 * n);
    this.eventU = new Float64Array(3 * n);
    this.eventSegments = new Uint16Array(n);
    this.leaving = new Uint8Array(n);
    this.leaveE = new Float32Array(3 * n);
    this.leaveRun = new Float32Array(n);
    this.leaveLift = new Float32Array(n);
  }

  private grow(): void {
    const n = 2 * this.px.length;
    const f64 = (a: Float64Array): Float64Array => {
      const b = new Float64Array(n);
      b.set(a);
      return b;
    };
    this.px = f64(this.px);
    this.py = f64(this.py);
    this.pz = f64(this.pz);
    this.ux = f64(this.ux);
    this.uy = f64(this.uy);
    this.uz = f64(this.uz);
    this.mass = f64(this.mass);
    const d = new Float32Array(n);
    d.set(this.diameter);
    this.diameter = d;
    const o = new Int32Array(n);
    o.set(this.owner);
    this.owner = o;
    const k = new Uint32Array(n);
    k.set(this.key);
    this.key = k;
    const g = new Uint8Array(n);
    g.set(this.generation);
    this.generation = g;
    const b = new Uint8Array(n);
    b.set(this.bounces);
    this.bounces = b;
    const s = new Uint16Array(n);
    s.set(this.segments);
    this.segments = s;
    const w = new Uint8Array(n);
    w.set(this.outline);
    this.outline = w;
    const ep = new Float64Array(3 * n);
    ep.set(this.eventP);
    this.eventP = ep;
    const eu = new Float64Array(3 * n);
    eu.set(this.eventU);
    this.eventU = eu;
    const es = new Uint16Array(n);
    es.set(this.eventSegments);
    this.eventSegments = es;
    const lv = new Uint8Array(n);
    lv.set(this.leaving);
    this.leaving = lv;
    const le = new Float32Array(3 * n);
    le.set(this.leaveE);
    this.leaveE = le;
    const lr = new Float32Array(n);
    lr.set(this.leaveRun);
    this.leaveRun = lr;
    const ll = new Float32Array(n);
    ll.set(this.leaveLift);
    this.leaveLift = ll;
  }

  /**
   * Makes parcel `i` a droplet that is born `run` metres from where it stands, along the
   * unit vector (ex, ey, ez), and leaves the wall there at an elevation of sine `lift`.
   */
  leaveAlong(i: number, ex: number, ey: number, ez: number, run: number, lift: number): void {
    this.leaving[i] = 1;
    this.leaveE[3 * i] = ex;
    this.leaveE[3 * i + 1] = ey;
    this.leaveE[3 * i + 2] = ez;
    this.leaveRun[i] = run;
    this.leaveLift[i] = lift;
  }

  /** Records the present state of parcel `i` as that after its last event. */
  markEvent(i: number): void {
    this.eventP[3 * i] = this.px[i] as number;
    this.eventP[3 * i + 1] = this.py[i] as number;
    this.eventP[3 * i + 2] = this.pz[i] as number;
    this.eventU[3 * i] = this.ux[i] as number;
    this.eventU[3 * i + 1] = this.uy[i] as number;
    this.eventU[3 * i + 2] = this.uz[i] as number;
    this.eventSegments[i] = this.segments[i] as number;
  }

  /** Puts parcel `i` back where its last event left it. */
  backToEvent(i: number): void {
    this.px[i] = this.eventP[3 * i] as number;
    this.py[i] = this.eventP[3 * i + 1] as number;
    this.pz[i] = this.eventP[3 * i + 2] as number;
    this.ux[i] = this.eventU[3 * i] as number;
    this.uy[i] = this.eventU[3 * i + 1] as number;
    this.uz[i] = this.eventU[3 * i + 2] as number;
    this.segments[i] = this.eventSegments[i] as number;
  }

  add(
    px: number,
    py: number,
    pz: number,
    ux: number,
    uy: number,
    uz: number,
    mass: number,
    diameter: number,
    owner: number,
    generation: number,
    key: number,
  ): number {
    if (this.count === this.px.length) this.grow();
    const i = this.count++;
    this.key[i] = key;
    this.px[i] = px;
    this.py[i] = py;
    this.pz[i] = pz;
    this.ux[i] = ux;
    this.uy[i] = uy;
    this.uz[i] = uz;
    this.mass[i] = mass;
    this.diameter[i] = diameter;
    this.owner[i] = owner;
    this.generation[i] = generation;
    this.bounces[i] = 0;
    this.segments[i] = 0;
    this.outline[i] = 0;
    this.leaving[i] = 0;
    this.markEvent(i);
    return i;
  }
}

interface FlyEnv {
  readonly input: ExposureStageInput;
  readonly backend: TraceBackend;
  readonly sp: SprayParams;
  readonly jp: JetParams;
  readonly medium: FlightMedium;
  /** The angle every rotating root stands at while these parcels fly, radians. */
  readonly angles: readonly number[];
  readonly domain: number;
  /**
   * Seed of the splash of a landing and of the passage through perforated parts: the
   * simulation seed for the droplets of a spray state, a constant for the drops of the drip
   * sites (where a drop falls is geometry, not sampling).
   */
  readonly seed: number;
  /**
   * Per block: 1 where another body stands within `scene.contactGap` in front of it (the
   * contact links of the scene, from either side). A droplet whose centre line ends on such
   * a block is flown again with its outline. Absent: every droplet is a point (the drops of
   * the drip sites, which are spread over their own cross-section already).
   */
  readonly near?: Uint8Array | undefined;
  /**
   * The instance a parcel's source stands on, by owner (-1: not known). A droplet that is born
   * along the wall follows that body where it turns into its way; anything else stops it.
   */
  readonly body?: Int32Array | undefined;
}

/**
 * Marks the blocks that stand in a contact link of the scene (`SceneContacts`): the faces of
 * the gaps between bodies that the scene resolves, up to `scene.contactGap` wide.
 */
export function blocksInGaps(scene: WashScene): Uint8Array {
  const near = new Uint8Array(scene.blocks.count);
  const contacts = scene.contacts;
  for (let c = 0; c < contacts.count; c++) {
    const a = contacts.blockA[c] as number;
    const b = contacts.blockB[c] as number;
    if (a < near.length) near[a] = 1;
    if (b < near.length) near[b] = 1;
  }
  return near;
}

/** A mass-distributed diameter: the median times a log-normal factor, kept within bounds. */
function sizeFactor(z: number, gsd: number, median: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, median * Math.exp(Math.log(gsd) * z)));
}

/**
 * Flies every parcel of `cloud` to its fate. `wet(block)` says whether a wall carries a film;
 * `deposit(owner, block, mass, dx, dy, dz)` books mass on a block with the unit direction the
 * droplet flew in when it struck, `lose(owner, mass)` what struck nothing. Returns the number
 * of rays traced.
 *
 * **The size of a droplet.** A parcel is flown as a point along the centre line of its
 * droplet, which is exact to a radius (a millimetre or less) wherever it lands in the open.
 * It is not where the droplet flies into a gap between two bodies: a drop does not pass a
 * mouth narrower than itself, strikes the edge of a mouth it passes within its radius of,
 * and inside a gap touches a wall a radius sooner than its centre would. So a point that
 * ends on a face of a gap the scene resolves (`FlyEnv.near`: the contact links, up to
 * `scene.contactGap`) is not landed. It is put back where its last event left it (its start
 * or its last rebound) and flown again with its outline: `spray.outlineRays` rays abreast,
 * each a radius off the centre line (evenly about it, turned by a hash of the parcel and of
 * the segment), and the droplet lands where the first of them strikes. From a rebound it goes
 * on with its outline, its centre a radius off the wall.
 *
 * **Where a splattered droplet is born.** The splatter of a jet leaves the fast film at a ring
 * some jet diameters from the source point of the footprint (`jets.splatterRadius`). The ring
 * is laid out in the plane of the wall at the source point, which the wall itself does not
 * follow: on the inside of a bowl a ring 15 to 45 mm out lies behind the wall, and a droplet
 * born there would start on the far side of it, in whatever gap is there. So a parcel of a
 * splatter source starts where its jet strikes (a point of the wall itself) and is first sent
 * straight to its place on the ring (`Cloud.leaveAlong`): where that way is free it is born
 * there; where the wall it stands on turns into the way, the film follows the wall and the
 * droplet leaves it at that place, along the way it came and at its elevation above the wall
 * as it lies there; anything else in the way (another body, a wire) takes the droplet.
 */
async function fly(
  env: FlyEnv,
  cloud: Cloud,
  wet: (block: number) => boolean,
  deposit: (owner: number, block: number, mass: number, dx: number, dy: number, dz: number) => void,
  lose: (owner: number, mass: number) => void,
): Promise<number> {
  const { sp, jp, medium, backend } = env;
  const seed = env.seed >>> 0;
  const step = createFlightStep();
  const impact = createWallImpact();
  const angles = env.angles;
  const outlineRays = sp.outlineRays;
  const near = outlineRays > 0 ? env.near : undefined;
  const blockInstance = env.input.scene.blocks.instance;
  let live = new Int32Array(Math.max(16, cloud.count));
  let next = new Int32Array(live.length);
  let nLive = cloud.count;
  for (let i = 0; i < nLive; i++) live[i] = i;
  let capacity = 0;
  let rayCapacity = 0;
  let rayBuffer = new ArrayBuffer(0);
  let rf = new Float32Array(rayBuffer);
  let ru = new Uint32Array(rayBuffer);
  /** First ray of every live parcel (and, after the last, the number of rays). */
  let first = new Int32Array(1);
  let ex = new Float64Array(0);
  let ey = new Float64Array(0);
  let ez = new Float64Array(0);
  let vx = new Float64Array(0);
  let vy = new Float64Array(0);
  let vz = new Float64Array(0);
  let terminal = new Uint8Array(0);
  let traced = 0;
  let nNext = 0;
  const keep = (i: number): void => {
    if (nNext === next.length) {
      const more = new Int32Array(2 * next.length);
      more.set(next);
      next = more;
    }
    next[nNext++] = i;
  };

  while (nLive > 0) {
    if (nLive > capacity) {
      capacity = Math.max(nLive, 2 * capacity);
      first = new Int32Array(capacity + 1);
      ex = new Float64Array(capacity);
      ey = new Float64Array(capacity);
      ez = new Float64Array(capacity);
      vx = new Float64Array(capacity);
      vy = new Float64Array(capacity);
      vz = new Float64Array(capacity);
      terminal = new Uint8Array(capacity);
    }
    let nRays = 0;
    for (let k = 0; k < nLive; k++) {
      const i = live[k] as number;
      nRays += cloud.outline[i] === 1 && cloud.leaving[i] === 0 ? outlineRays : 1;
    }
    if (nRays > rayCapacity) {
      rayCapacity = Math.max(nRays, 2 * rayCapacity);
      rayBuffer = new ArrayBuffer(4 * RAY_WORDS * rayCapacity);
      rf = new Float32Array(rayBuffer);
      ru = new Uint32Array(rayBuffer);
    }
    let ray = 0;
    for (let k = 0; k < nLive; k++) {
      const i = live[k] as number;
      first[k] = ray;
      const px = cloud.px[i] as number;
      const py = cloud.py[i] as number;
      const pz = cloud.pz[i] as number;
      const key = cloud.key[i] as number;
      if (cloud.leaving[i] === 1) {
        // Not born yet: one ray along the wall, from the source point to its place on the ring.
        const o = RAY_WORDS * ray++;
        rf[o] = px;
        rf[o + 1] = py;
        rf[o + 2] = pz;
        rf[o + 3] = cloud.leaveRun[i] as number;
        rf[o + 4] = cloud.leaveE[3 * i] as number;
        rf[o + 5] = cloud.leaveE[3 * i + 1] as number;
        rf[o + 6] = cloud.leaveE[3 * i + 2] as number;
        ru[o + 7] = key;
        continue;
      }
      flightStep(
        sp,
        medium,
        cloud.ux[i] as number,
        cloud.uy[i] as number,
        cloud.uz[i] as number,
        cloud.diameter[i] as number,
        step,
      );
      const len = Math.sqrt(step.ex * step.ex + step.ey * step.ey + step.ez * step.ez);
      ex[k] = step.ex;
      ey[k] = step.ey;
      ez[k] = step.ez;
      vx[k] = step.ux;
      vy[k] = step.uy;
      vz[k] = step.uz;
      terminal[k] = step.terminal ? 1 : 0;
      const inv = len > 0 ? 1 / len : 0;
      const dx = step.ex * inv;
      const dy = step.ey * inv;
      const dz = len > 0 ? step.ez * inv : -1;
      if (cloud.outline[i] === 0) {
        const o = RAY_WORDS * ray++;
        rf[o] = px;
        rf[o + 1] = py;
        rf[o + 2] = pz;
        rf[o + 3] = len;
        rf[o + 4] = dx;
        rf[o + 5] = dy;
        rf[o + 6] = dz;
        ru[o + 7] = key;
        continue;
      }
      // The outline: rays a radius off the centre line, evenly about it.
      // literal-ok-begin: choice of a helper axis that is not parallel to a direction
      let ax = Math.abs(dx) < 0.9 ? 0 : -dz;
      let ay = Math.abs(dx) < 0.9 ? dz : 0;
      let az = Math.abs(dx) < 0.9 ? -dy : dx;
      // literal-ok-end
      const an = Math.sqrt(ax * ax + ay * ay + az * az);
      ax /= an;
      ay /= an;
      az /= an;
      const bx = dy * az - dz * ay;
      const by = dz * ax - dx * az;
      const bz = dx * ay - dy * ax;
      const radius = 0.5 * (cloud.diameter[i] as number);
      const turn =
        TWO_PI *
        u32ToUnitFloat(
          hashU32(SPRAY_STAGE_NUMERICS.outlineDomain, key, cloud.segments[i] as number),
        );
      for (let j = 0; j < outlineRays; j++) {
        const psi = turn + (TWO_PI * j) / outlineRays;
        const c = radius * Math.cos(psi);
        const sn = radius * Math.sin(psi);
        const o = RAY_WORDS * ray++;
        rf[o] = px + c * ax + sn * bx;
        rf[o + 1] = py + c * ay + sn * by;
        rf[o + 2] = pz + c * az + sn * bz;
        rf[o + 3] = len;
        rf[o + 4] = dx;
        rf[o + 5] = dy;
        rf[o + 6] = dz;
        ru[o + 7] = key;
      }
    }
    first[nLive] = ray;
    traced += nRays;
    const out = await backend.trace(rayBuffer, nRays, angles, seed ^ env.domain);
    const hf = new Float32Array(out);
    const hu = new Uint32Array(out);
    nNext = 0;
    for (let k = 0; k < nLive; k++) {
      const i = live[k] as number;
      const owner = cloud.owner[i] as number;
      const mass = cloud.mass[i] as number;
      // The first of the rays of the parcel to strike.
      let best = -1;
      let bestT = Infinity;
      for (let q = first[k] as number; q < (first[k + 1] as number); q++) {
        if ((hu[HIT_WORDS * q + 3] as number) === SPRAY_STAGE_NUMERICS.miss) continue;
        const t = hf[HIT_WORDS * q] as number;
        if (t < bestT) {
          bestT = t;
          best = q;
        }
      }
      if (cloud.leaving[i] === 1) {
        cloud.leaving[i] = 0;
        const lx = cloud.leaveE[3 * i] as number;
        const ly = cloud.leaveE[3 * i + 1] as number;
        const lz = cloud.leaveE[3 * i + 2] as number;
        if (best < 0) {
          // The way to the ring is free: the droplet is born there.
          const run = cloud.leaveRun[i] as number;
          cloud.px[i] = (cloud.px[i] as number) + lx * run;
          cloud.py[i] = (cloud.py[i] as number) + ly * run;
          cloud.pz[i] = (cloud.pz[i] as number) + lz * run;
          cloud.markEvent(i);
          keep(i);
          continue;
        }
        const h = HIT_WORDS * best;
        const struck = hu[h + 1] as number;
        if (struck === SCENE_NONE) {
          lose(owner, mass);
          continue;
        }
        const own =
          env.body !== undefined &&
          (env.body[owner] as number) === (blockInstance[struck] as number);
        const nx = hf[h + 4] as number;
        const ny = hf[h + 5] as number;
        const nz = hf[h + 6] as number;
        // Along the wall as it lies where the way meets it.
        const into = lx * nx + ly * ny + lz * nz;
        let wx = lx - into * nx;
        let wy = ly - into * ny;
        let wz = lz - into * nz;
        const wn = Math.sqrt(wx * wx + wy * wy + wz * wz);
        // literal-ok-begin: arithmetic tolerance
        if (!own || !(wn > 1e-6)) {
          // literal-ok-end
          // Another body stands in the way (or the wall meets it head on): it takes the droplet.
          deposit(owner, struck, mass, lx, ly, lz);
          continue;
        }
        wx /= wn;
        wy /= wn;
        wz /= wn;
        // The wall the droplet stands on turns into the way: the film follows it, and the
        // droplet leaves it there, at its speed and at its elevation above the wall there.
        const t = Math.max(0, hf[h] as number);
        const ux = cloud.ux[i] as number;
        const uy = cloud.uy[i] as number;
        const uz = cloud.uz[i] as number;
        const speed = Math.sqrt(ux * ux + uy * uy + uz * uz);
        const lift = Math.min(1, Math.max(0, cloud.leaveLift[i] as number));
        const off = speed * lift;
        const along = speed * Math.sqrt(1 - lift * lift);
        cloud.px[i] = (cloud.px[i] as number) + lx * t + nx * sp.spawnOffset;
        cloud.py[i] = (cloud.py[i] as number) + ly * t + ny * sp.spawnOffset;
        cloud.pz[i] = (cloud.pz[i] as number) + lz * t + nz * sp.spawnOffset;
        cloud.ux[i] = along * wx + off * nx;
        cloud.uy[i] = along * wy + off * ny;
        cloud.uz[i] = along * wz + off * nz;
        cloud.markEvent(i);
        keep(i);
        continue;
      }
      if (best < 0) {
        const count = (cloud.segments[i] as number) + 1;
        if (terminal[k] === 1 || count >= sp.maxSegments) {
          lose(owner, mass);
          continue;
        }
        cloud.segments[i] = count;
        cloud.px[i] = (cloud.px[i] as number) + (ex[k] as number);
        cloud.py[i] = (cloud.py[i] as number) + (ey[k] as number);
        cloud.pz[i] = (cloud.pz[i] as number) + (ez[k] as number);
        cloud.ux[i] = vx[k] as number;
        cloud.uy[i] = vy[k] as number;
        cloud.uz[i] = vz[k] as number;
        keep(i);
        continue;
      }
      const h = HIT_WORDS * best;
      const o = RAY_WORDS * best;
      const block = hu[h + 1] as number;
      if (block === SCENE_NONE) {
        lose(owner, mass);
        continue;
      }
      const diameter = cloud.diameter[i] as number;
      const outlined = cloud.outline[i] === 1;
      if (near !== undefined && !outlined && near[block] === 1 && diameter > 0) {
        // A point that ends in a gap: flown again from its last event, with its outline.
        cloud.backToEvent(i);
        cloud.outline[i] = 1;
        keep(i);
        continue;
      }
      const len = rf[o + 3] as number;
      const t = Math.min(len, Math.max(0, hf[h] as number));
      const part = len > 0 ? t / len : 0;
      const nx = hf[h + 4] as number;
      const ny = hf[h + 5] as number;
      const nz = hf[h + 6] as number;
      // Velocity at the wall: between that at the start and at the end of the segment.
      const wx = (cloud.ux[i] as number) + ((vx[k] as number) - (cloud.ux[i] as number)) * part;
      const wy = (cloud.uy[i] as number) + ((vy[k] as number) - (cloud.uy[i] as number)) * part;
      const wz = (cloud.uz[i] as number) + ((vz[k] as number) - (cloud.uz[i] as number)) * part;
      const vn = -(wx * nx + wy * ny + wz * nz);
      // The direction the droplet flies in as it strikes: that of the segment.
      const fx = rf[o + 4] as number;
      const fy = rf[o + 5] as number;
      const fz = rf[o + 6] as number;
      if (!(vn > 0)) {
        deposit(owner, block, mass, fx, fy, fz);
        continue;
      }
      const tx = wx + vn * nx;
      const ty = wy + vn * ny;
      const tz = wz + vn * nz;
      const vt = Math.sqrt(tx * tx + ty * ty + tz * tz);
      wallImpact(sp, medium, diameter, vn, vt, wet(block), impact);
      // Where what leaves the wall starts: just off it, and for a droplet that is followed
      // with its outline, its centre a radius off it.
      const lift = sp.spawnOffset + (outlined ? 0.5 * diameter : 0);
      const qx = (rf[o] as number) + (rf[o + 4] as number) * t + nx * lift;
      const qy = (rf[o + 1] as number) + (rf[o + 5] as number) * t + ny * lift;
      const qz = (rf[o + 2] as number) + (rf[o + 6] as number) * t + nz * lift;
      if (impact.outcome === WALL_OUTCOME.rebound && (cloud.bounces[i] as number) < sp.maxBounces) {
        const count = (cloud.segments[i] as number) + 1;
        if (count >= sp.maxSegments) {
          deposit(owner, block, mass, fx, fy, fz);
          continue;
        }
        cloud.segments[i] = count;
        cloud.bounces[i] = (cloud.bounces[i] as number) + 1;
        cloud.px[i] = qx;
        cloud.py[i] = qy;
        cloud.pz[i] = qz;
        cloud.ux[i] = sp.tangentialRestitution * tx + impact.restitution * vn * nx;
        cloud.uy[i] = sp.tangentialRestitution * ty + impact.restitution * vn * ny;
        cloud.uz[i] = sp.tangentialRestitution * tz + impact.restitution * vn * nz;
        cloud.markEvent(i);
        keep(i);
        continue;
      }
      let thrown = 0;
      if (impact.outcome === WALL_OUTCOME.splash && cloud.generation[i] === 0) {
        thrown = Math.floor(impact.splashed * mass);
        if (thrown < 2) thrown = 0;
      }
      if (thrown > 0) {
        // A frame in the wall.
        // literal-ok-begin: choice of a helper axis that is not parallel to a direction
        let ax = Math.abs(nx) < 0.9 ? 0 : -nz;
        let ay = Math.abs(nx) < 0.9 ? nz : 0;
        let az = Math.abs(nx) < 0.9 ? -ny : nx;
        // literal-ok-end
        const an = Math.sqrt(ax * ax + ay * ay + az * az);
        ax /= an;
        ay /= an;
        az /= an;
        const bx = ny * az - nz * ay;
        const by = nz * ax - nx * az;
        const bz = nx * ay - ny * ax;
        const key = cloud.key[i] as number;
        for (let child = 0; child < 2; child++) {
          const share = child === 0 ? Math.floor(thrown / 2) : thrown - Math.floor(thrown / 2);
          const draw = (j: number): number =>
            u32ToUnitFloat(
              hashU32(seed, SPRAY_STAGE_NUMERICS.secondaryDomain, env.domain, key, child, j),
            );
          const elevation = sp.secElevationLo + (sp.secElevationHi - sp.secElevationLo) * draw(0);
          const azimuth = TWO_PI * draw(1);
          const speed = vn * (sp.secSpeedLo + (sp.secSpeedHi - sp.secSpeedLo) * draw(2));
          const ce = Math.cos(elevation) * speed;
          const se = Math.sin(elevation) * speed;
          const ca = Math.cos(azimuth);
          const sa = Math.sin(azimuth);
          const z = randomNormal(
            seed,
            SPRAY_STAGE_NUMERICS.secondaryDomain,
            env.domain,
            key,
            child,
            3,
          );
          const j = cloud.add(
            qx,
            qy,
            qz,
            ce * (ca * ax + sa * bx) + se * nx + sp.secTangential * tx,
            ce * (ca * ay + sa * by) + se * ny + sp.secTangential * ty,
            ce * (ca * az + sa * bz) + se * nz + sp.secTangential * tz,
            share,
            diameter * sizeFactor(z, jp.dropGsd, sp.secDropSize, jp.dropSizeMin, jp.dropSizeMax),
            owner,
            1,
            hashU32(SPRAY_STAGE_NUMERICS.secondaryDomain, key, child),
          );
          keep(j);
        }
      }
      deposit(owner, block, mass - thrown, fx, fy, fz);
    }
    const swap = live;
    live = next;
    next = swap;
    nLive = nNext;
    if (next.length < live.length) next = new Int32Array(live.length);
  }
  return traced;
}

interface StageEnv {
  readonly sp: SprayParams;
  readonly jp: JetParams;
  readonly medium: FlightMedium;
  readonly rootArm: readonly number[];
}

function stageEnv(input: ExposureStageInput, who: string): StageEnv {
  const { scene, state } = input;
  const sp = resolveSprayParams(input.params);
  const jp = resolveJetParams(input.params);
  const water = bindSharedClosures(input.params).water(jp.solveTemperature);
  const rotating = scene.trace.roots.filter((root) => root.rotating !== null).length;
  if (input.armLevels.length !== rotating) {
    throw new RangeError(
      `${who}: ${input.armLevels.length} arm levels for ${rotating} rotating roots`,
    );
  }
  return {
    sp,
    jp,
    medium: { rho: water.rho, mu: water.mu, gamma: water.gammaW, gravity: scene.gravity },
    rootArm: input.armLevels.map((level) => state.arms.findIndex((a) => a.level === level)),
  };
}

const dripTables = new WeakMap<WashScene, { readonly key: string; readonly table: DripTransfer }>();

/**
 * The angles the rotating roots stand at for pose `pose` of `poses` evenly spaced ones. An arm
 * the state holds still stands where it is held; an arm the state does not feed rests where
 * it stopped, which is anywhere: it is given the pose too, so that the spray states of a wash
 * pose the arms alike and share one table.
 */
function evenPose(
  input: ExposureStageInput,
  rootArm: readonly number[],
  pose: number,
  poses: number,
): number[] {
  return rootArm.map((index) => {
    const arm = input.state.arms[index];
    if (arm !== undefined && arm.stalled) return arm.stallAngle;
    return ((arm?.senseSign ?? 1) * TWO_PI * (pose + 0.5)) / poses;
  });
}

/**
 * The landing table of the drip sites of a scene (see `DripTransfer`). The drop of a site is
 * `spray.dripParcels` points spread evenly over its cross-section (a sunflower pattern, turned
 * by the stable key of the site's block), each fallen from rest to where it lands, with the
 * splash of its landing: what a drop wider than the tine or the rim below it leaves on that
 * part is the share of the drop that covers it. The points fall past the arms at as many
 * evenly spaced poses as there are points (an arm the state holds still stands where it is
 * held). Nothing here is drawn from the simulation seed except the splash of a landing. Kept
 * for the scene it was last computed for, so the spray states of a wash that pose the arms
 * alike share it.
 */
export async function dripTransfer(input: ExposureStageInput): Promise<DripTransfer> {
  const { scene } = input;
  const backend = await acquireTraceBackend(scene, input.gpu);
  const env = stageEnv(input, 'dripTransfer');
  const poses = env.sp.dripParcels;
  const posed = Array.from({ length: poses }, (_, pose) =>
    evenPose(input, env.rootArm, pose, poses),
  );
  const key = `${input.params.hydroHash}:${backend.kind}:${JSON.stringify(posed)}`;
  const known = dripTables.get(scene);
  if (known !== undefined && known.key === key) return known.table;
  const { sp, medium } = env;
  const blocks = scene.blocks;
  const drips = scene.drips;
  const sites = drips.count;
  const perSite = sp.dripParcels;
  const keys = sceneBlockKeys(scene);
  const capillary = Math.sqrt(sp.liquorSigma / (medium.rho * medium.gravity));
  const edgeDrop = sp.dripDropFactor * capillary;
  // literal-ok-begin: buffer size or fixed-point scale
  const landed = new SparseSum(Math.max(1024, 4 * sites));
  // literal-ok-end
  const sump = new Float64Array(sites);
  const startOffset = input.params.get('scene.dripStartOffset');

  // Drop j of a site falls at pose (key of the site + j) mod poses: the drops of one pose
  // are flown together, in chunks.
  for (let pose = 0; pose < poses; pose++) {
    let cloud = new Cloud(SPRAY_STAGE_NUMERICS.chunk);
    const flush = async (): Promise<void> => {
      if (cloud.count === 0) return;
      await fly(
        {
          ...env,
          input,
          backend,
          angles: posed[pose] as number[],
          domain: SPRAY_STAGE_NUMERICS.dripDomain,
          seed: SPRAY_STAGE_NUMERICS.dripDomain,
        },
        cloud,
        () => true,
        (owner, block, mass) => landed.add(owner * blocks.count + block, mass),
        (owner, mass) => {
          sump[owner] = (sump[owner] as number) + mass;
        },
      );
      cloud = new Cloud(SPRAY_STAGE_NUMERICS.chunk);
    };
    for (let site = 0; site < sites; site++) {
      const b = drips.block[site] as number;
      const siteKey = keys[b] as number;
      const j = (((pose - (siteKey % poses)) % poses) + poses) % poses;
      if (j >= perSite) continue;
      const line = ((blocks.flags[b] as number) & BLOCK_FLAG.line) !== 0;
      const radius = line ? (scene.patches[blocks.patch[b] as number]?.radius ?? 0) : 0;
      // The drop: 3.3 capillary lengths from an edge; Tate's law from a wire.
      const diameter = line
        ? Math.cbrt(
            (6 * sp.dripTipFactor * sp.liquorSigma * TWO_PI * radius) /
              (Math.PI * medium.rho * medium.gravity),
          )
        : edgeDrop;
      // The points cover the cross-section of the drop.
      const spread = 0.5 * diameter;
      const cx = blocks.centre[3 * b] as number;
      const cy = blocks.centre[3 * b + 1] as number;
      const cz = blocks.centre[3 * b + 2] as number;
      const weight =
        Math.floor(DRIP_WEIGHT_ONE / perSite) + (j < DRIP_WEIGHT_ONE % perSite ? 1 : 0);
      // Point j of a sunflower pattern of `perSite` points, turned by the key of the site.
      const r = spread * Math.sqrt((j + 0.5) / perSite);
      const a = j * GOLDEN_ANGLE + TWO_PI * u32ToUnitFloat(siteKey);
      const off = line ? radius + startOffset : startOffset;
      cloud.add(
        cx + r * Math.cos(a) + (line ? 0 : (blocks.normal[3 * b] as number) * startOffset),
        cy + r * Math.sin(a) + (line ? 0 : (blocks.normal[3 * b + 1] as number) * startOffset),
        cz - off + (line ? 0 : (blocks.normal[3 * b + 2] as number) * startOffset),
        0,
        0,
        0,
        weight,
        diameter,
        site,
        0,
        hashU32(SPRAY_STAGE_NUMERICS.dripDomain, siteKey, j),
      );
      if (cloud.count >= SPRAY_STAGE_NUMERICS.chunk) await flush();
    }
    await flush();
  }

  const entries = landed.entries();
  const offsets = new Uint32Array(sites + 1);
  const target = new Uint32Array(entries.keys.length);
  const weight = new Uint32Array(entries.keys.length);
  for (let i = 0; i < entries.keys.length; i++) {
    const k = entries.keys[i] as number;
    const site = Math.floor(k / blocks.count);
    target[i] = k - site * blocks.count;
    weight[i] = entries.values[i] as number;
    offsets[site + 1] = (offsets[site + 1] as number) + 1;
  }
  for (let s = 0; s < sites; s++)
    offsets[s + 1] = (offsets[s + 1] as number) + (offsets[s] as number);
  const table: DripTransfer = {
    siteCount: sites,
    offsets,
    target,
    weight,
    sump: Uint32Array.from(sump),
  };
  dripTables.set(scene, { key, table });
  return table;
}

const kernels = new WeakMap<WashScene, { readonly key: string; readonly kernel: LandingKernel }>();

/**
 * The landing kernel of a scene with the parameters of `input` (`landing-kernel.ts`): it
 * depends on the geometry and the `spray.landing*` keys only, so it is kept for the scene it
 * was last built for and the spray states of a wash share it.
 */
export async function landingKernelOf(
  input: ExposureStageInput,
  backend: TraceBackend,
): Promise<LandingKernel> {
  const sp = resolveSprayParams(input.params);
  const key = `${sp.landingKernel}:${sp.landingRange}:${sp.landingGap}:${sp.landingDirections}:${sp.maxRange}:${backend.kind}`;
  const known = kernels.get(input.scene);
  if (known !== undefined && known.key === key) return known.kernel;
  const kernel = await buildLandingKernel(input.scene, backend, {
    spacing: sp.landingKernel,
    range: sp.landingRange,
    gap: sp.landingGap,
    reach: sp.maxRange,
    directions: sp.landingDirections,
  });
  kernels.set(input.scene, { key, kernel });
  return kernel;
}

/** One group of parcels that fly past the arms in one pose. */
interface PoseGroup {
  /** The angle of every rotating root, radians. */
  readonly angles: number[];
  /** Rows of the jet sources of the group, in row order. */
  readonly rows: number[];
  /** The showers flown in the group: every `stride`-th parcel of each, from parcel `first`. */
  showerFirst: number;
  showerStride: number;
}

/** The secondary-water stage: see the file comment. */
export async function secondaryWaterStage(
  input: ExposureStageInput,
  jets: JetStageOutput,
): Promise<SecondaryWaterOutput> {
  const { scene, state } = input;
  const env = stageEnv(input, 'secondaryWaterStage');
  const { sp, jp, medium, rootArm } = env;
  const seed = input.seed >>> 0;
  const blocks = scene.blocks;
  const period = state.period;
  input.onStage?.('spray:sources');
  const backend = await acquireTraceBackend(scene, input.gpu);

  // ---- the sources: those of the jets, then the showers
  const jetSources = jets.sources;
  const nJet = jetSources?.count ?? 0;
  let fromJets = 0;
  for (let i = 0; i < nJet; i++) fromJets += jetSources?.mass[i] ?? 0;
  const showerMass = state.showers.map((shower) =>
    Math.round((medium.rho * shower.flow * period) / WATER_UNIT),
  );
  const fromShowers = showerMass.reduce((sum, units) => sum + units, 0);
  const total = fromJets + fromShowers;

  const official = input.tier.id === 'official';
  // literal-ok-begin: fallback for a missing entry of a registered vector (never taken with the registry defaults)
  const parcelMass = sp.parcelMass[official ? 0 : 1] ?? 4e-8;
  // literal-ok-end
  const parcelUnits = Math.max(1, Math.round(parcelMass / WATER_UNIT));
  /** Parcels a source of `units` is flown as: its mass over the parcel mass, at least one. */
  const parcelsOf = (units: number, factor = 1): number =>
    units > 0 ? Math.max(1, Math.round(units / (factor * parcelUnits))) : 0;

  // ---- the poses of the arms the parcels fly past
  // A jet source flies past the arms as its own arm stood when it was sampled; another arm
  // that turns stands at one of its own poses, picked by a hash of the group.
  const armPoses = jets.armPoses ?? state.arms.map(() => []);
  const groups: PoseGroup[] = [];
  const groupOf = new Map<number, number>();
  const anglesFor = (armIndex: number, pose: number): number[] =>
    rootArm.map((index, r) => {
      const arm = state.arms[index];
      if (arm === undefined) return 0;
      if (arm.stalled) return arm.stallAngle;
      const poses = armPoses[index] ?? [];
      if (poses.length === 0) return 0;
      if (index === armIndex) return poses[Math.min(pose, poses.length - 1)] as number;
      return poses[
        hashU32(seed, SPRAY_STAGE_NUMERICS.armDomain, armIndex, pose, r) % poses.length
      ] as number;
    });
  const groupFor = (armIndex: number, pose: number): PoseGroup => {
    // literal-ok-begin: buffer size or fixed-point scale
    const id = armIndex * 65536 + pose;
    // literal-ok-end
    let at = groupOf.get(id);
    if (at === undefined) {
      at = groups.length;
      groupOf.set(id, at);
      groups.push({
        angles: anglesFor(armIndex, pose),
        rows: [],
        showerFirst: -1,
        showerStride: 1,
      });
    }
    return groups[at] as PoseGroup;
  };
  for (let row = 0; row < nJet; row++) {
    groupFor(jetSources?.arm?.[row] ?? 0, jetSources?.pose?.[row] ?? 0).rows.push(row);
  }
  // The showers run all the time: their parcels are spread over the poses of the master arm.
  const master = state.masterArm;
  const masterPoses = Math.max(1, (armPoses[master] ?? []).length);
  if (state.showers.length > 0) {
    for (let pose = 0; pose < masterPoses; pose++) {
      const group = groupFor(Math.max(0, master), pose);
      group.showerFirst = pose;
      group.showerStride = masterPoses;
    }
  }

  // Which walls count as wetted when a droplet lands, before the film is solved.
  const wetMaterial = scene.materials.map(
    (m) => (m.receding[sp.liquorClass] ?? m.receding[1]) < sp.wetWallAngle,
  );
  const jetWet = new Uint8Array(blocks.count);
  for (let i = 0; i < jets.arrival.block.length; i++) jetWet[jets.arrival.block[i] as number] = 1;
  const wet = (block: number): boolean =>
    jetWet[block] === 1 || wetMaterial[blocks.material[block] as number] === true;

  // The faces of the gaps between bodies: where a droplet is followed with its outline.
  const near = sp.outlineRays > 0 ? blocksInGaps(scene) : undefined;
  // The body every jet source stands on.
  const body = new Int32Array(nJet).fill(-1);
  if (jetSources?.block !== undefined) {
    for (let row = 0; row < nJet; row++) {
      const root = jetSources.block[row] as number;
      if (root < blocks.count) body[row] = blocks.instance[root] as number;
    }
  }

  input.onStage?.('spray:kernel');
  const kernel = await landingKernelOf(input, backend);
  const tally = new LandingTally(scene, kernel);
  let deposited = 0;
  let lost = 0;
  let landings = 0;
  let paths = 0;

  input.onStage?.('spray:flight');
  const point = new Float64Array(SPRAY_STAGE_NUMERICS.draws);
  const shift = new Float64Array(SPRAY_STAGE_NUMERICS.draws);
  /** Sets the shifts of the sequence of the source with stable key `key`. */
  const openSource = (domain: number, key: number): void => {
    for (let j = 0; j < shift.length; j++) {
      shift[j] = u32ToUnitFloat(hashU32(seed, domain, key, j));
    }
  };
  /**
   * Fills `point` with point `index` of the sequence of the open source: the Halton point,
   * shifted (modulo 1) by the shifts of the source.
   */
  const draw = (index: number): void => {
    for (let j = 0; j < point.length; j++) {
      const v = (shift[j] as number) + radicalInverse(index + 1, SEQUENCE_BASES[j] as number);
      point[j] = v - Math.floor(v);
    }
  };
  /** A standard normal number from the last two numbers of `point`. */
  const normal = (): number =>
    Math.sqrt(-2 * Math.log(1 - (point[4] as number))) * Math.cos(TWO_PI * (point[5] as number));

  for (const group of groups) {
    let cloud = new Cloud(SPRAY_STAGE_NUMERICS.chunk);
    const flush = async (): Promise<void> => {
      if (cloud.count === 0) return;
      paths += cloud.count;
      await fly(
        {
          ...env,
          input,
          backend,
          angles: group.angles,
          domain: SPRAY_STAGE_NUMERICS.sourceDomain,
          seed,
          near,
          body,
        },
        cloud,
        wet,
        (_owner, block, mass, dx, dy, dz) => {
          tally.add(block, mass, dx, dy, dz);
          deposited += mass;
          landings++;
        },
        (_owner, mass) => {
          lost += mass;
        },
      );
      cloud = new Cloud(SPRAY_STAGE_NUMERICS.chunk);
    };

    // ---- the fixed sprayers: uniform over the solid angle of the cone
    if (group.showerFirst >= 0) {
      for (let k = 0; k < state.showers.length; k++) {
        const shower = state.showers[k];
        const units = showerMass[k] as number;
        if (shower === undefined || !(units > 0)) continue;
        const count = parcelsOf(units, sp.showerParcelFactor);
        const each = Math.floor(units / count);
        const extra = units - each * count;
        const sourceKey = hashU32(SPRAY_STAGE_NUMERICS.showerDomain, k);
        openSource(SPRAY_STAGE_NUMERICS.showerDomain, sourceKey);
        const [ax, ay, az] = shower.axis;
        // literal-ok-begin: choice of a helper axis that is not parallel to a direction
        let bx = Math.abs(az) < 0.9 ? ay : 0;
        let by = Math.abs(az) < 0.9 ? -ax : az;
        let bz = Math.abs(az) < 0.9 ? 0 : -ay;
        // literal-ok-end
        const bn = Math.hypot(bx, by, bz);
        bx /= bn;
        by /= bn;
        bz /= bn;
        const cx = ay * bz - az * by;
        const cy = az * bx - ax * bz;
        const cz = ax * by - ay * bx;
        for (let i = group.showerFirst; i < count; i += group.showerStride) {
          draw(i);
          const cosT = 1 - (point[0] as number) * (1 - Math.cos(shower.coneHalfAngle));
          const sinT = Math.sqrt(Math.max(0, 1 - cosT * cosT));
          const phi = TWO_PI * (point[1] as number);
          const c = Math.cos(phi) * sinT;
          const sn = Math.sin(phi) * sinT;
          const dx = cosT * ax + c * bx + sn * cx;
          const dy = cosT * ay + c * by + sn * cy;
          const dz = cosT * az + c * bz + sn * cz;
          cloud.add(
            shower.origin[0] + dx * sp.showerOffset,
            shower.origin[1] + dy * sp.showerOffset,
            shower.origin[2] + dz * sp.showerOffset,
            shower.dropletSpeed * dx,
            shower.dropletSpeed * dy,
            shower.dropletSpeed * dz,
            each + (i < extra ? 1 : 0),
            sp.showerDropSize *
              sizeFactor(normal(), jp.dropGsd, 1, sp.showerSizeMin, sp.showerSizeMax),
            k,
            0,
            hashU32(sourceKey, i),
          );
          if (cloud.count >= SPRAY_STAGE_NUMERICS.chunk) await flush();
        }
      }
    }

    // ---- the sources of the jets
    for (const row of group.rows) {
      if (jetSources === undefined) break;
      const units = jetSources.mass[row] as number;
      if (!(units > 0)) continue;
      const count = parcelsOf(units);
      const each = Math.floor(units / count);
      const extra = units - each * count;
      const sourceKey = jetSources.key?.[row] ?? hashU32(SPRAY_STAGE_NUMERICS.sourceDomain, row);
      openSource(SPRAY_STAGE_NUMERICS.sourceDomain, sourceKey);
      const kind = jetSources.kind[row] as number;
      const ox = jetSources.origin[3 * row] as number;
      const oy = jetSources.origin[3 * row + 1] as number;
      const oz = jetSources.origin[3 * row + 2] as number;
      const nx = jetSources.normal[3 * row] as number;
      const ny = jetSources.normal[3 * row + 1] as number;
      const nz = jetSources.normal[3 * row + 2] as number;
      const fx = jetSources.forward[3 * row] as number;
      const fy = jetSources.forward[3 * row + 1] as number;
      const fz = jetSources.forward[3 * row + 2] as number;
      const shape = jetSources.shape[row] as number;
      const speed = jetSources.speed[row] as number;
      const size = jetSources.size[row] as number;
      for (let i = 0; i < count; i++) {
        draw(i);
        const mass = each + (i < extra ? 1 : 0);
        const parcelKey = hashU32(sourceKey, i);
        if (kind === DROPLET_SOURCE.splatter) {
          // The azimuth about the source point follows the flow split q(psi): that of a point
          // drawn evenly over the jet section, seen from the rear focus of its footprint.
          const sinPhi = Math.min(1, Math.max(jp.minSinIncidence, shape));
          const cosPhi = Math.sqrt(1 - sinPhi * sinPhi);
          const r0 = 0.5 * size;
          const rr = r0 * Math.sqrt(point[0] as number);
          const th = TWO_PI * (point[1] as number);
          const forward = (rr * Math.cos(th)) / sinPhi + (r0 * cosPhi) / sinPhi;
          const lateral = rr * Math.sin(th);
          const m = Math.hypot(forward, lateral);
          const cosPsi = m > 0 ? forward / m : 1;
          const sinPsi = m > 0 ? lateral / m : 0;
          // Lateral tangent: n x forward.
          const lx = ny * fz - nz * fy;
          const ly = nz * fx - nx * fz;
          const lz = nx * fy - ny * fx;
          const ex = cosPsi * fx + sinPsi * lx;
          const ey = cosPsi * fy + sinPsi * ly;
          const ez = cosPsi * fz + sinPsi * lz;
          const edge = (r0 * sinPhi) / (1 - cosPsi * cosPhi);
          const ring = jp.splatterRadius * 2 * edge * Math.sqrt(sinPhi);
          const elevation =
            jp.splatterElevationLo +
            (jp.splatterElevationHi - jp.splatterElevationLo) * (point[2] as number);
          const v =
            speed *
            (jp.splatterSpeedLo + (jp.splatterSpeedHi - jp.splatterSpeedLo) * (point[3] as number));
          const ce = Math.cos(elevation) * v;
          const se = Math.sin(elevation) * v;
          // The parcel starts where the jet strikes (the source point lies r0 cos / sin
          // behind it, in the plane of the wall there) and is born at its place on the ring
          // if the way to it is free (see `fly`).
          const back = (r0 * cosPhi) / sinPhi;
          let gx = ring * ex - back * fx;
          let gy = ring * ey - back * fy;
          let gz = ring * ez - back * fz;
          const run = Math.hypot(gx, gy, gz);
          if (run > 0) {
            gx /= run;
            gy /= run;
            gz /= run;
          }
          const parcel = cloud.add(
            ox + back * fx + nx * sp.spawnOffset,
            oy + back * fy + ny * sp.spawnOffset,
            oz + back * fz + nz * sp.spawnOffset,
            ce * ex + se * nx,
            ce * ey + se * ny,
            ce * ez + se * nz,
            mass,
            size *
              sizeFactor(normal(), jp.dropGsd, jp.splatterDropSize, jp.dropSizeMin, jp.dropSizeMax),
            row,
            0,
            parcelKey,
          );
          if (run > 0) cloud.leaveAlong(parcel, gx, gy, gz, run, Math.sin(elevation));
        } else {
          // A fan off a wire (axis given) or off a rim (the edge runs across normal and jet).
          let ax = nx;
          let ay = ny;
          let az = nz;
          if (kind === DROPLET_SOURCE.rimFan) {
            ax = ny * fz - nz * fy;
            ay = nz * fx - nx * fz;
            az = nx * fy - ny * fx;
            const an = Math.hypot(ax, ay, az);
            // literal-ok-begin: arithmetic tolerance
            if (an > 1e-6) {
              // literal-ok-end
              ax /= an;
              ay /= an;
              az /= an;
            } else {
              // The jet runs along the normal: any direction in the face serves as the edge.
              // literal-ok-begin: choice of a helper axis that is not parallel to a direction
              ax = Math.abs(nx) < 0.9 ? 0 : -nz;
              ay = Math.abs(nx) < 0.9 ? nz : 0;
              az = Math.abs(nx) < 0.9 ? -ny : nx;
              // literal-ok-end
              const m = Math.hypot(ax, ay, az);
              ax /= m;
              ay /= m;
              az /= m;
            }
          }
          // The jet direction across the axis.
          const along = fx * ax + fy * ay + fz * az;
          let px = fx - along * ax;
          let py = fy - along * ay;
          let pz = fz - along * az;
          let pn = Math.hypot(px, py, pz);
          // literal-ok-begin: arithmetic tolerance
          if (pn < 1e-6) {
            // literal-ok-end
            // literal-ok-begin: choice of a helper axis that is not parallel to a direction
            px = Math.abs(ax) < 0.9 ? 0 : -az;
            py = Math.abs(ax) < 0.9 ? az : 0;
            pz = Math.abs(ax) < 0.9 ? -ay : ax;
            // literal-ok-end
            pn = Math.hypot(px, py, pz);
          }
          px /= pn;
          py /= pn;
          pz /= pn;
          const side = (point[0] as number) < 0.5 ? 1 : -1;
          const turn = side * (jp.wireFanAngle + (2 * (point[1] as number) - 1) * jp.wireFanSpread);
          const lean = (2 * (point[2] as number) - 1) * jp.wireFanAlong;
          // axis x across
          const qx = ay * pz - az * py;
          const qy = az * px - ax * pz;
          const qz = ax * py - ay * px;
          let wx = px * Math.cos(turn) + qx * Math.sin(turn);
          let wy = py * Math.cos(turn) + qy * Math.sin(turn);
          let wz = pz * Math.cos(turn) + qz * Math.sin(turn);
          let sx: number;
          let sy: number;
          let sz: number;
          if (kind === DROPLET_SOURCE.rimFan) {
            // Off the struck face, never into it.
            const into = wx * nx + wy * ny + wz * nz;
            if (into < 0) {
              wx -= 2 * into * nx;
              wy -= 2 * into * ny;
              wz -= 2 * into * nz;
            }
            sx = ox + nx * sp.spawnOffset;
            sy = oy + ny * sp.spawnOffset;
            sz = oz + nz * sp.spawnOffset;
          } else {
            // From the side of the wire the sheet leaves by: the axis lies one radius behind
            // the point the jet strikes.
            sx = ox + px * shape + wx * (shape + sp.spawnOffset);
            sy = oy + py * shape + wy * (shape + sp.spawnOffset);
            sz = oz + pz * shape + wz * (shape + sp.spawnOffset);
          }
          const v = speed * jp.wireFanSpeed;
          const cl = Math.cos(lean) * v;
          const sl = Math.sin(lean) * v;
          cloud.add(
            sx,
            sy,
            sz,
            cl * wx + sl * ax,
            cl * wy + sl * ay,
            cl * wz + sl * az,
            mass,
            size *
              sizeFactor(normal(), jp.dropGsd, jp.wireDropSize, jp.dropSizeMin, jp.dropSizeMax),
            row,
            0,
            parcelKey,
          );
        }
        if (cloud.count >= SPRAY_STAGE_NUMERICS.chunk) await flush();
      }
    }
    await flush();
  }
  if (deposited + lost !== total) {
    throw new Error(
      `secondaryWaterStage: water is not conserved (${total} units emitted, ${deposited + lost} accounted for)`,
    );
  }

  input.onStage?.('spray:drips');
  const drips = await dripTransfer(input);

  input.onStage?.('spray:tables');
  // What landed where is one sample of the droplets of a revolution: the kernel shares it
  // among the faces about every landing that the droplets of its direction can reach.
  const settled = tally.settle();
  const shares = tally.shares;
  let touched = 0;
  for (let b = 0; b < blocks.count; b++) if ((settled[b] as number) > 0) touched++;
  const block = new Uint32Array(touched);
  const mass = new Float64Array(touched);
  const flux = new Float32Array(touched);
  let n = 0;
  for (let b = 0; b < blocks.count; b++) {
    const units = settled[b] as number;
    if (!(units > 0)) continue;
    block[n] = b;
    mass[n] = units;
    flux[n] = (units * WATER_UNIT) / (period * (blocks.area[b] as number));
    n++;
  }
  return {
    arrival: { blockCount: blocks.count, block, flux },
    stats: {
      paths,
      landed: landings,
      flow: (total * WATER_UNIT) / (medium.rho * period),
      lostFlow: (lost * WATER_UNIT) / (medium.rho * period),
      ...(shares.total > 0
        ? {
            settled: {
              pooledOpen: shares.pooledOpen / shares.total,
              pooledFaced: shares.pooledFaced / shares.total,
              keptOnItems: shares.keptOnItems / shares.total,
              onMachine: shares.onMachine / shares.total,
            },
          }
        : {}),
    },
    deposits: { blockCount: blocks.count, block, mass },
    drips,
    ledger: { sources: fromJets, showers: fromShowers, deposited, lost },
    backend: backend.kind,
  };
}
