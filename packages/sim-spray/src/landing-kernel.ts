/**
 * Where the droplets of a spray state settle: from the parcels that were flown to the water
 * every face receives (docs/design/scope.md, "Indirect water" and "Contacts and nesting";
 * docs/design/sim-core.md section M6, "Sampling": smoothing windows).
 *
 * The parcels of one spray state are one sample of the droplets of every revolution of that
 * state, which do not land in the same places each time. What the sample measures well is how
 * much water arrives in a neighbourhood from a direction; which of the faces there a single
 * parcel happened to strike is noise, and on a slender part (a tine, the edge of a blade) or
 * a face that droplets reach rarely it is all there is. So a landing is not booked on the
 * block it struck:
 *
 *   directions   the direction a droplet flies in when it lands falls in one of
 *                `spray.landingDirections` bins that cover the sphere evenly
 *   exposure     once per scene, for every block of an item and every bin it faces, one ray
 *                from the block against the direction says how a droplet flying that way can
 *                reach it. The block is OPEN to the bin when the ray meets neither the item
 *                itself (at any distance: the far wall of a glass, a handle) nor, within
 *                `spray.landingRange`, another item or a wall of the tub or of a basket. It
 *                is FACED when another body stands in the way within that range but further
 *                off than `spray.landingGap`: droplets of the bin reach it only from that
 *                body or past it (the splash of a jet on the plate in the next slot). It is
 *                CLOSED when the item itself is in the way, or another body nearer than the
 *                gap (a contact, a nest). A wire, a tine, a perforated part and a spray arm
 *                do not stand in the way (the ray goes on behind them). The weight of a
 *                block for a bin is the area it presents to the direction
 *   neighbourhood  nodes of a lattice of `spray.landingKernel`; a landing belongs to the eight
 *                nodes about the block it struck, by trilinear shares
 *   settling     a landing on a block that is open to its bin is pooled with the other
 *                landings on open blocks: the mass a node holds for a bin is shared among the
 *                open blocks about it in proportion to their weights for that bin (times
 *                their trilinear share of the node), so the total is unchanged and the result
 *                is smooth across the lattice. Landings on faced blocks are pooled and shared
 *                among faced blocks in the same way. A landing on a block that is closed to
 *                its bin (a splash across the inside of a vessel, a droplet that got into a
 *                narrow gap) stays on the block it struck
 *
 * This is a kernel estimate of the droplet flux with exact local shadowing: the open blocks
 * about a node are taken to see one flux from a direction, measured by what lands on them
 * together, and so are the faced ones. A face in a contact shadow, inside a nest or behind a
 * cover is closed to the directions it cannot be reached from and receives nothing from
 * them, however much lands beside it; a narrow face receives its share of what flies past,
 * whether or not a parcel happened to strike it. Faces of the machine and line elements
 * (wires, tines of the racks) keep what strikes them.
 *
 * Simplifications: the flux of one direction bin is taken to be uniform over the open faces
 * of a neighbourhood, and over its faced ones (true at a distance from its source; the
 * splash of a body a few centimetres away is blurred over the kernel); exposure is one ray
 * from the centre of a block along the centre of a bin (a way that is half open counts as
 * open or not, and a bin is 17 degrees in half-angle by default), straight (a droplet's path
 * is not), with the spray arms at their reference angle; what shadows a block from further
 * away than the range, other than the item itself, is seen only by the parcels, so the edge
 * of such a shadow is blurred by the kernel; what lands on a block from a direction it is
 * closed to is not smoothed at all.
 *
 * Deterministic: the exposure depends on the geometry only (not on the seed); sums are taken
 * in a fixed order; the result is in whole units with the total exact.
 *
 * Units: SI. Frame: tub frame.
 */

import {
  BLOCK_FLAG,
  HIT_WORDS,
  RAY_WORDS,
  SCENE_NONE,
  sceneBlockKeys,
  type TraceBackend,
  type WashScene,
} from '@spotless/sim-jets';

/** Arithmetic controls of the landing kernel (not physical quantities). */
export const LANDING_NUMERICS = {
  /** An exposure ray starts this far off the surface of its block, m. */
  // literal-ok-begin: named arithmetic control, documented where it is declared
  originOffset: 2e-4,
  /** Behind a wire, a perforated part or an arm the ray goes on from this far past the hit, m. */
  passStep: 1e-4,
  // literal-ok-end
  /** Times an exposure ray goes on behind something that does not close its way. */
  maxPasses: 4,
  /** Rays traced together. */
  // literal-ok-begin: buffer size or fixed-point scale
  batch: 1 << 20,
  // literal-ok-end
  /** Cells of the table that finds the bin of a direction: rows over z, columns over azimuth. */
  lookupRows: 64,
  lookupColumns: 128,
  /** A miss of the tracer: the triangle word of a hit record. */
  miss: 0xffffffff,
} as const;

/** The geometry-only part of the landing kernel of a scene. */
export interface LandingKernel {
  /** Number of direction bins D. */
  readonly directions: number;
  /** [3 x D] unit vectors: the direction a droplet of the bin flies in. */
  readonly direction: Float64Array;
  /** Spacing of the lattice of nodes, m, its origin and its node counts along x, y and z. */
  readonly spacing: number;
  readonly origin: readonly [number, number, number];
  readonly dims: readonly [number, number, number];
  /** Per block: 1 for a face of an item (it takes part in the settling), else 0. */
  readonly takesPart: Uint8Array;
  /** Words of `open` and of `faced` per block. */
  readonly words: number;
  /** Per block, D bits: 1 where the block is open to the bin (see the file comment). */
  readonly open: Uint32Array;
  /** Per block, D bits: 1 where the block is faced for the bin. */
  readonly faced: Uint32Array;
  /**
   * [2 x nodes x D] sum over the blocks about a node of their share of it times their weight
   * for the bin: first over the open blocks, then (from `nodes x D` on) over the faced ones.
   */
  readonly weightSum: Float64Array;
  /** Exposure rays traced (with those that went on behind a wire). */
  readonly rays: number;
}

/** `count` directions spread evenly over the sphere (a Fibonacci lattice), as [3 x count]. */
export function landingDirections(count: number): Float64Array {
  const out = new Float64Array(3 * count);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let k = 0; k < count; k++) {
    const z = 1 - (2 * k + 1) / count;
    const r = Math.sqrt(Math.max(0, 1 - z * z));
    out[3 * k] = r * Math.cos(k * golden);
    out[3 * k + 1] = r * Math.sin(k * golden);
    out[3 * k + 2] = z;
  }
  return out;
}

/** The bin whose direction is nearest to (dx, dy, dz), by the largest dot product. */
function nearestDirection(direction: Float64Array, dx: number, dy: number, dz: number): number {
  let best = 0;
  let bestDot = -Infinity;
  for (let q = 0; 3 * q < direction.length; q++) {
    const dot =
      (direction[3 * q] as number) * dx +
      (direction[3 * q + 1] as number) * dy +
      (direction[3 * q + 2] as number) * dz;
    if (dot > bestDot) {
      bestDot = dot;
      best = q;
    }
  }
  return best;
}

const lookups = new Map<number, Uint16Array>();

/** The table that gives the bin of a direction by its height and azimuth, for `count` bins. */
function directionLookup(count: number): Uint16Array {
  let table = lookups.get(count);
  if (table !== undefined) return table;
  const rows = LANDING_NUMERICS.lookupRows;
  const columns = LANDING_NUMERICS.lookupColumns;
  const direction = landingDirections(count);
  table = new Uint16Array(rows * columns);
  for (let r = 0; r < rows; r++) {
    const z = -1 + (2 * (r + 0.5)) / rows;
    const s = Math.sqrt(Math.max(0, 1 - z * z));
    for (let c = 0; c < columns; c++) {
      const a = -Math.PI + (2 * Math.PI * (c + 0.5)) / columns;
      table[r * columns + c] = nearestDirection(direction, s * Math.cos(a), s * Math.sin(a), z);
    }
  }
  lookups.set(count, table);
  return table;
}

/**
 * The bin of the unit direction (dx, dy, dz) among `count` bins: the nearest of
 * {@link landingDirections}, read from a table over height and azimuth (so a direction on the
 * border of two bins may be given to either).
 */
export function landingDirectionBin(count: number, dx: number, dy: number, dz: number): number {
  const rows = LANDING_NUMERICS.lookupRows;
  const columns = LANDING_NUMERICS.lookupColumns;
  let r = Math.floor(0.5 * (dz + 1) * rows);
  if (r < 0) r = 0;
  else if (r >= rows) r = rows - 1;
  let c = Math.floor(((Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI)) * columns);
  if (c < 0) c = 0;
  else if (c >= columns) c = columns - 1;
  return directionLookup(count)[r * columns + c] as number;
}

/** What {@link buildLandingKernel} reads of the parameters. */
export interface LandingKernelOptions {
  /** `spray.landingKernel`: spacing of the nodes, m. */
  readonly spacing: number;
  /**
   * `spray.landingRange`: distance within which another body closes the way of a direction,
   * m. 0 leaves every block open to every direction it faces (no ray is traced).
   */
  readonly range: number;
  /** `spray.landingGap`: another body nearer than this closes the way altogether, m. */
  readonly gap: number;
  /** Length of an exposure ray, m: the item itself closes the way at any distance up to it. */
  readonly reach: number;
  /** `spray.landingDirections`: number of direction bins. */
  readonly directions: number;
}

/**
 * Builds the landing kernel of a scene (see the file comment): the exposure of every block of
 * an item to every direction bin, by rays on `backend`, and the weight sums of the nodes.
 */
export async function buildLandingKernel(
  scene: WashScene,
  backend: TraceBackend,
  options: LandingKernelOptions,
): Promise<LandingKernel> {
  const blocks = scene.blocks;
  const n = blocks.count;
  const D = Math.max(1, Math.round(options.directions));
  const direction = landingDirections(D);
  const words = Math.ceil(D / 32);
  const h = options.spacing;
  if (!(h > 0)) throw new RangeError(`buildLandingKernel: node spacing ${h}`);
  const takesPart = new Uint8Array(n);
  const isItem = scene.instances.map((instance) => instance.kind === 'item');
  const rotating = scene.instances.map((instance) => instance.rotating);
  let lo: [number, number, number] = [Infinity, Infinity, Infinity];
  let hi: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  let parts = 0;
  for (let b = 0; b < n; b++) {
    if (isItem[blocks.instance[b] as number] !== true) continue;
    if (((blocks.flags[b] as number) & BLOCK_FLAG.line) !== 0) continue;
    if (!((blocks.area[b] as number) > 0)) continue;
    takesPart[b] = 1;
    parts++;
    const x = blocks.centre[3 * b] as number;
    const y = blocks.centre[3 * b + 1] as number;
    const z = blocks.centre[3 * b + 2] as number;
    lo = [Math.min(lo[0], x), Math.min(lo[1], y), Math.min(lo[2], z)];
    hi = [Math.max(hi[0], x), Math.max(hi[1], y), Math.max(hi[2], z)];
  }
  if (parts === 0) {
    return {
      directions: D,
      direction,
      spacing: h,
      origin: [0, 0, 0],
      dims: [2, 2, 2],
      takesPart,
      words,
      open: new Uint32Array(words * n),
      faced: new Uint32Array(words * n),
      weightSum: new Float64Array(2 * 8 * D),
      rays: 0,
    };
  }
  // The lattice is that of the tub frame (a node at its origin), cut to the box of the items:
  // adding or moving an item elsewhere does not shift the nodes about another.
  const origin: [number, number, number] = [
    Math.floor(lo[0] / h) * h,
    Math.floor(lo[1] / h) * h,
    Math.floor(lo[2] / h) * h,
  ];
  const dims: [number, number, number] = [
    Math.floor((hi[0] - origin[0]) / h) + 2,
    Math.floor((hi[1] - origin[1]) / h) + 2,
    Math.floor((hi[2] - origin[2]) / h) + 2,
  ];

  // ---- exposure: one ray per block and bin it faces, going on behind what does not close it
  const open = new Uint32Array(words * n);
  const faced = new Uint32Array(words * n);
  const keys = sceneBlockKeys(scene);
  const batch = LANDING_NUMERICS.batch;
  const buffer = new ArrayBuffer(4 * RAY_WORDS * batch);
  const rf = new Float32Array(buffer);
  const ru = new Uint32Array(buffer);
  const rayBlock = new Uint32Array(batch);
  const rayBin = new Uint16Array(batch);
  const rayPass = new Uint8Array(batch);
  const rayLeft = new Float32Array(batch);
  const rayGone = new Float32Array(batch);
  const angles = scene.trace.roots.filter((root) => root.rotating !== null).map(() => 0);
  const off = LANDING_NUMERICS.originOffset;
  // Rays that go on behind a wire, waiting for room in a batch: block, bin, pass, origin (three
  // numbers each) and the length left.
  const waitBlock: number[] = [];
  const waitBin: number[] = [];
  const waitPass: number[] = [];
  const waitOrigin: number[] = [];
  const waitLeft: number[] = [];
  const waitGone: number[] = [];
  let rays = 0;
  let count = 0;
  const push = (
    b: number,
    q: number,
    pass: number,
    ox: number,
    oy: number,
    oz: number,
    left: number,
    gone: number,
  ): void => {
    const o = RAY_WORDS * count;
    rf[o] = ox;
    rf[o + 1] = oy;
    rf[o + 2] = oz;
    rf[o + 3] = left;
    rf[o + 4] = -(direction[3 * q] as number);
    rf[o + 5] = -(direction[3 * q + 1] as number);
    rf[o + 6] = -(direction[3 * q + 2] as number);
    ru[o + 7] = ((keys[b] as number) + q) >>> 0;
    rayBlock[count] = b;
    rayBin[count] = q;
    rayPass[count] = pass;
    rayLeft[count] = left;
    rayGone[count] = gone;
    count++;
  };
  /** Traces the batch: marks what is open, and puts the rays that go on in the waiting list. */
  const flush = async (): Promise<void> => {
    if (count === 0) return;
    const traced = count;
    rays += traced;
    const hits = await backend.trace(buffer, traced, angles, 0);
    count = 0;
    const hf = new Float32Array(hits);
    const hu = new Uint32Array(hits);
    for (let k = 0; k < traced; k++) {
      const hw = HIT_WORDS * k;
      const b = rayBlock[k] as number;
      const q = rayBin[k] as number;
      if ((hu[hw + 3] as number) !== LANDING_NUMERICS.miss) {
        const struck = hu[hw + 1] as number;
        const at = (rayGone[k] as number) + (hf[hw] as number);
        // A surface without a live block (a dead element) is a wall all the same.
        let solid = true;
        let own = false;
        if (struck !== SCENE_NONE && struck < n) {
          const flag = blocks.flags[struck] as number;
          const other = blocks.instance[struck] as number;
          solid = rotating[other] !== true && (flag & (BLOCK_FLAG.line | BLOCK_FLAG.porous)) === 0;
          own = other === (blocks.instance[b] as number);
        }
        if (solid) {
          // The item itself closes the way wherever it stands in it. Another body closes it
          // within the gap, faces the block within the range, and beyond the range is the
          // parcels' to see.
          if (own || at < options.gap) continue;
          const w = words * b + (q >>> 5);
          if (at < options.range) faced[w] = ((faced[w] as number) | (1 << (q & 31))) >>> 0;
          else open[w] = ((open[w] as number) | (1 << (q & 31))) >>> 0;
          continue;
        }
        const pass = rayPass[k] as number;
        const step = (hf[hw] as number) + LANDING_NUMERICS.passStep;
        const left = (rayLeft[k] as number) - step;
        if (pass < LANDING_NUMERICS.maxPasses && left > 0) {
          // Behind a wire, a perforated part or an arm the ray goes on (it starts inside the
          // part it struck, which a ray leaves unhindered).
          const o = RAY_WORDS * k;
          waitBlock.push(b);
          waitBin.push(q);
          waitPass.push(pass + 1);
          waitOrigin.push(
            (rf[o] as number) + (rf[o + 4] as number) * step,
            (rf[o + 1] as number) + (rf[o + 5] as number) * step,
            (rf[o + 2] as number) + (rf[o + 6] as number) * step,
          );
          waitLeft.push(left);
          waitGone.push((rayGone[k] as number) + step);
          continue;
        }
      }
      const w = words * b + (q >>> 5);
      open[w] = ((open[w] as number) | (1 << (q & 31))) >>> 0;
    }
  };
  /**
   * Moves waiting rays into the batch and traces it whenever it is full; with `all`, traces
   * until no ray is left in the batch or waiting.
   */
  const takeWaiting = async (all: boolean): Promise<void> => {
    for (;;) {
      while (waitBlock.length > 0 && count < batch) {
        const left = waitLeft.pop() as number;
        const gone = waitGone.pop() as number;
        const oz = waitOrigin.pop() as number;
        const oy = waitOrigin.pop() as number;
        const ox = waitOrigin.pop() as number;
        push(
          waitBlock.pop() as number,
          waitBin.pop() as number,
          waitPass.pop() as number,
          ox,
          oy,
          oz,
          left,
          gone,
        );
      }
      // A trace may put more rays in the waiting list: go round again.
      if (count === batch || (all && count > 0)) await flush();
      else return;
    }
  };
  if (options.range > 0) {
    for (let b = 0; b < n; b++) {
      if (takesPart[b] === 0) continue;
      const nx = blocks.normal[3 * b] as number;
      const ny = blocks.normal[3 * b + 1] as number;
      const nz = blocks.normal[3 * b + 2] as number;
      const ox = (blocks.centre[3 * b] as number) + off * nx;
      const oy = (blocks.centre[3 * b + 1] as number) + off * ny;
      const oz = (blocks.centre[3 * b + 2] as number) + off * nz;
      for (let q = 0; q < D; q++) {
        const facing = -(
          nx * (direction[3 * q] as number) +
          ny * (direction[3 * q + 1] as number) +
          nz * (direction[3 * q + 2] as number)
        );
        if (!(facing > 0)) continue;
        push(b, q, 0, ox, oy, oz, Math.max(options.reach, options.range), 0);
        if (count === batch) {
          await flush();
          await takeWaiting(false);
        }
      }
    }
    await takeWaiting(true);
  } else {
    // No range: every bin a block faces is open to it.
    for (let b = 0; b < n; b++) {
      if (takesPart[b] === 0) continue;
      for (let q = 0; q < D; q++) {
        const facing = -(
          (blocks.normal[3 * b] as number) * (direction[3 * q] as number) +
          (blocks.normal[3 * b + 1] as number) * (direction[3 * q + 1] as number) +
          (blocks.normal[3 * b + 2] as number) * (direction[3 * q + 2] as number)
        );
        if (!(facing > 0)) continue;
        const w = words * b + (q >>> 5);
        open[w] = ((open[w] as number) | (1 << (q & 31))) >>> 0;
      }
    }
  }

  // ---- weight sums of the nodes, for the open blocks and for the faced ones
  const [nx0, ny0] = dims;
  const nodeBins = dims[0] * dims[1] * dims[2] * D;
  const weightSum = new Float64Array(2 * nodeBins);
  const node = new Int32Array(8);
  const share = new Float64Array(8);
  for (let b = 0; b < n; b++) {
    if (takesPart[b] === 0) continue;
    nodesAbout(blocks.centre, b, origin, h, nx0, ny0, node, share);
    const area = blocks.area[b] as number;
    const bx = blocks.normal[3 * b] as number;
    const by = blocks.normal[3 * b + 1] as number;
    const bz = blocks.normal[3 * b + 2] as number;
    for (let q = 0; q < D; q++) {
      const word = words * b + (q >>> 5);
      const isOpen = (((open[word] as number) >>> (q & 31)) & 1) === 1;
      if (!isOpen && (((faced[word] as number) >>> (q & 31)) & 1) === 0) continue;
      const weight =
        -area *
        (bx * (direction[3 * q] as number) +
          by * (direction[3 * q + 1] as number) +
          bz * (direction[3 * q + 2] as number));
      if (!(weight > 0)) continue;
      const base = isOpen ? 0 : nodeBins;
      for (let c = 0; c < 8; c++) {
        const at = base + (node[c] as number) * D + q;
        weightSum[at] = (weightSum[at] as number) + (share[c] as number) * weight;
      }
    }
  }
  return {
    directions: D,
    direction,
    spacing: h,
    origin,
    dims,
    takesPart,
    words,
    open,
    faced,
    weightSum,
    rays,
  };
}

/**
 * The eight nodes about the centre of block `b` and its trilinear share of each: fills `node`
 * (indices into the lattice) and `share` (they add up to 1).
 */
function nodesAbout(
  centre: Float32Array,
  b: number,
  origin: readonly [number, number, number],
  h: number,
  nx: number,
  ny: number,
  node: Int32Array,
  share: Float64Array,
): void {
  const gx = ((centre[3 * b] as number) - origin[0]) / h;
  const gy = ((centre[3 * b + 1] as number) - origin[1]) / h;
  const gz = ((centre[3 * b + 2] as number) - origin[2]) / h;
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  const iz = Math.floor(gz);
  const fx = gx - ix;
  const fy = gy - iy;
  const fz = gz - iz;
  for (let c = 0; c < 8; c++) {
    const cx = c & 1;
    const cy = (c >> 1) & 1;
    const cz = (c >> 2) & 1;
    node[c] = ((iz + cz) * ny + (iy + cy)) * nx + (ix + cx);
    share[c] = (cx === 1 ? fx : 1 - fx) * (cy === 1 ? fy : 1 - fy) * (cz === 1 ? fz : 1 - fz);
  }
}

/** How the landings of a spray state were settled, in whole units of water. */
export interface LandingShares {
  readonly total: number;
  /** Shared among the open blocks of their neighbourhood, and among the faced ones. */
  readonly pooledOpen: number;
  readonly pooledFaced: number;
  /** Kept on the block of an item they struck: it is closed to their direction. */
  readonly keptOnItems: number;
  /** Landed on the machine or on a line element. */
  readonly onMachine: number;
}

/**
 * The landings of one spray state, gathered and settled through a {@link LandingKernel}.
 * `add` books a landing; `settle` returns what every block receives, in whole units, with the
 * total equal to what was added.
 */
export class LandingTally {
  private readonly scene: WashScene;
  private readonly kernel: LandingKernel;
  /** [2 x nodes x D] mass held by a node for a bin: open landings, then faced ones. */
  private readonly held: Float64Array;
  /** [3 x 2 x nodes x D] the same mass times the direction every landing flew in. */
  private readonly heading: Float64Array;
  /** Per block: mass that stays on the block that was struck. */
  private readonly direct: Float64Array;
  private readonly node = new Int32Array(8);
  private readonly share = new Float64Array(8);
  private total = 0;
  private pooledOpen = 0;
  private pooledFaced = 0;
  private keptOnItems = 0;

  constructor(scene: WashScene, kernel: LandingKernel) {
    this.scene = scene;
    this.kernel = kernel;
    this.held = new Float64Array(kernel.weightSum.length);
    this.heading = new Float64Array(3 * kernel.weightSum.length);
    this.direct = new Float64Array(scene.blocks.count);
  }

  /**
   * Books `units` (a whole number) that landed on `block`, flying in the unit direction
   * (dx, dy, dz).
   */
  add(block: number, units: number, dx: number, dy: number, dz: number): void {
    const k = this.kernel;
    this.total += units;
    if (k.takesPart[block] === 0) {
      this.direct[block] = (this.direct[block] as number) + units;
      return;
    }
    const D = k.directions;
    const q = landingDirectionBin(D, dx, dy, dz);
    // Pooled only when the block faces the bin and is open to it or faced for it: its own
    // weight is then in the weight sum of every node it shares.
    const normal = this.scene.blocks.normal;
    const facing = -(
      (normal[3 * block] as number) * (k.direction[3 * q] as number) +
      (normal[3 * block + 1] as number) * (k.direction[3 * q + 1] as number) +
      (normal[3 * block + 2] as number) * (k.direction[3 * q + 2] as number)
    );
    const word = k.words * block + (q >>> 5);
    const isOpen = (((k.open[word] as number) >>> (q & 31)) & 1) === 1;
    if (!(facing > 0) || (!isOpen && (((k.faced[word] as number) >>> (q & 31)) & 1) === 0)) {
      this.direct[block] = (this.direct[block] as number) + units;
      this.keptOnItems += units;
      return;
    }
    if (isOpen) this.pooledOpen += units;
    else this.pooledFaced += units;
    nodesAbout(
      this.scene.blocks.centre,
      block,
      k.origin,
      k.spacing,
      k.dims[0],
      k.dims[1],
      this.node,
      this.share,
    );
    const base = isOpen ? 0 : this.held.length / 2;
    for (let c = 0; c < 8; c++) {
      const at = base + (this.node[c] as number) * D + q;
      const part = units * (this.share[c] as number);
      this.held[at] = (this.held[at] as number) + part;
      this.heading[3 * at] = (this.heading[3 * at] as number) + part * dx;
      this.heading[3 * at + 1] = (this.heading[3 * at + 1] as number) + part * dy;
      this.heading[3 * at + 2] = (this.heading[3 * at + 2] as number) + part * dz;
    }
  }

  /**
   * Where the landings went, in units: pooled among open blocks, pooled among faced blocks,
   * kept on the block of an item that was struck (closed to the direction), and landed on
   * the machine or on a line element (which keep what strikes them).
   */
  get shares(): LandingShares {
    return {
      total: this.total,
      pooledOpen: this.pooledOpen,
      pooledFaced: this.pooledFaced,
      keptOnItems: this.keptOnItems,
      onMachine: this.total - this.pooledOpen - this.pooledFaced - this.keptOnItems,
    };
  }

  /**
   * Whole units per block: what was added, shared out by the kernel.
   *
   * The area a block presents to what a node holds for a bin is taken against the mean
   * direction of the landings the node holds (not against the centre of the bin, which may be
   * a bin's half-angle off: vertical rain would wet an upright wall). Where no block about a
   * node presents any area to that mean direction, the centre of the bin serves: the blocks
   * that were struck face it.
   */
  settle(): Float64Array {
    const k = this.kernel;
    const blocks = this.scene.blocks;
    const n = blocks.count;
    const D = k.directions;
    const held = this.held;
    const half = held.length / 2;
    const node = this.node;
    const share = this.share;
    // The mean direction of what every node holds for a bin (the centre of the bin where it
    // holds nothing, or nothing with a direction).
    const mean = new Float32Array(3 * held.length);
    for (let i = 0; i < held.length; i++) {
      if (!((held[i] as number) > 0)) continue;
      const hx = this.heading[3 * i] as number;
      const hy = this.heading[3 * i + 1] as number;
      const hz = this.heading[3 * i + 2] as number;
      const length = Math.hypot(hx, hy, hz);
      const q = i % D;
      // literal-ok-begin: arithmetic tolerance
      if (length > 1e-9 * (held[i] as number)) {
        // literal-ok-end
        mean[3 * i] = hx / length;
        mean[3 * i + 1] = hy / length;
        mean[3 * i + 2] = hz / length;
      } else {
        mean[3 * i] = k.direction[3 * q] as number;
        mean[3 * i + 1] = k.direction[3 * q + 1] as number;
        mean[3 * i + 2] = k.direction[3 * q + 2] as number;
      }
    }
    // The bins the blocks about a node may receive from, visited twice: first to add up the
    // weights against the mean directions, then to share out.
    const weightSum = new Float64Array(held.length);
    const visit = (
      b: number,
      each: (at: number, shareOfNode: number, area: number, facing: number) => void,
    ): void => {
      nodesAbout(blocks.centre, b, k.origin, k.spacing, k.dims[0], k.dims[1], node, share);
      const area = blocks.area[b] as number;
      const bx = blocks.normal[3 * b] as number;
      const by = blocks.normal[3 * b + 1] as number;
      const bz = blocks.normal[3 * b + 2] as number;
      for (let q = 0; q < D; q++) {
        const word = k.words * b + (q >>> 5);
        const isOpen = (((k.open[word] as number) >>> (q & 31)) & 1) === 1;
        if (!isOpen && (((k.faced[word] as number) >>> (q & 31)) & 1) === 0) continue;
        const base = isOpen ? 0 : half;
        for (let c = 0; c < 8; c++) {
          const at = base + (node[c] as number) * D + q;
          if (!((held[at] as number) > 0)) continue;
          const facing = -(
            bx * (mean[3 * at] as number) +
            by * (mean[3 * at + 1] as number) +
            bz * (mean[3 * at + 2] as number)
          );
          each(at, share[c] as number, area, facing);
        }
      }
    };
    for (let b = 0; b < n; b++) {
      if (k.takesPart[b] === 0) continue;
      visit(b, (at, shareOfNode, area, facing) => {
        if (facing > 0) weightSum[at] = (weightSum[at] as number) + shareOfNode * area * facing;
      });
    }
    // Mass per unit of weight; where the mean direction finds no face, per unit of the
    // weight against the centre of the bin (marked by a negative rate).
    const rate = new Float64Array(held.length);
    for (let i = 0; i < held.length; i++) {
      const m = held[i] as number;
      if (!(m > 0)) continue;
      if ((weightSum[i] as number) > 0) rate[i] = m / (weightSum[i] as number);
      else if ((k.weightSum[i] as number) > 0) rate[i] = -m / (k.weightSum[i] as number);
      else throw new Error('LandingTally: a node holds water that no block about it can take');
    }
    const out = new Float64Array(n);
    let running = 0;
    let given = 0;
    let last = -1;
    for (let b = 0; b < n; b++) {
      let amount = this.direct[b] as number;
      if (k.takesPart[b] === 1) {
        const bx = blocks.normal[3 * b] as number;
        const by = blocks.normal[3 * b + 1] as number;
        const bz = blocks.normal[3 * b + 2] as number;
        visit(b, (at, shareOfNode, area, facing) => {
          const r = rate[at] as number;
          if (r > 0) {
            if (facing > 0) amount += shareOfNode * area * facing * r;
            return;
          }
          const q = at % D;
          const centre = -(
            bx * (k.direction[3 * q] as number) +
            by * (k.direction[3 * q + 1] as number) +
            bz * (k.direction[3 * q + 2] as number)
          );
          if (centre > 0) amount += shareOfNode * area * centre * -r;
        });
      }
      if (!(amount > 0)) continue;
      // Whole units by rounding the running total: the sum stays that of what was added.
      running += amount;
      const upTo = Math.min(this.total, Math.round(running));
      const units = upTo - given;
      if (units > 0) {
        out[b] = units;
        given = upTo;
        last = b;
      }
    }
    // The last unit of rounding goes to the last block that received.
    if (given !== this.total && last >= 0) out[last] = (out[last] as number) + (this.total - given);
    else if (given !== this.total) {
      throw new Error('LandingTally: landings were added but no block received them');
    }
    return out;
  }
}
