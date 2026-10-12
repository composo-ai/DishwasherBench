/**
 * Small operations on shapes that the catalogue needs on top of the geometry kernel: weighing a
 * shape with the catalogue's materials, scaling a shape uniformly, measuring a stated dimension
 * on a shape, finding parts that are not joined to the rest of their item, and the water an
 * upright item holds.
 *
 * Units: SI (metres, kilograms) unless a name says millimetres.
 */

import type { Vec3 } from '@spotless/core';
import { mToMm, poseInverseTransformPoint, randomUniform } from '@spotless/core';
import type { MassProperties, Part, Primitive, Shape, SorProfilePoint } from '@spotless/geometry';
import {
  boundingBox,
  computeMassProperties,
  partSelectorMatches,
  primitiveSignedDistance,
  signedDistance,
} from '@spotless/geometry';
import { materialDensity } from './materials.ts';
import type { DimensionMeasure } from './types.ts';

/**
 * Mass (kg), centre of mass (m, item frame) and inertia about it (kg m^2) of a shape whose parts
 * name catalogue materials: the kernel's `computeMassProperties` with the catalogue's densities.
 * A part with a porosity (the open-area fraction of a perforated sheet or a mesh) weighs
 * `1 - porosity` times its solid weight. Throws a RangeError for an unknown material id.
 */
export function massPropertiesOf(shape: Shape): MassProperties {
  return computeMassProperties(shape, materialDensity);
}

function scaleVec(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}

function scalePrimitive(prim: Primitive, s: number): Primitive {
  switch (prim.kind) {
    case 'sor':
      return {
        ...prim,
        profile: prim.profile.map((p): SorProfilePoint => ({ r: p.r * s, z: p.z * s, t: p.t * s })),
      };
    case 'capsule':
      return { ...prim, a: scaleVec(prim.a, s), b: scaleVec(prim.b, s), radius: prim.radius * s };
    case 'rbox':
      return { ...prim, halfExtents: scaleVec(prim.halfExtents, s), radius: prim.radius * s };
    case 'hull':
      return { ...prim, points: prim.points.map((p) => scaleVec(p, s)), radius: prim.radius * s };
  }
}

/**
 * The shape scaled uniformly by `s` about the item-frame origin: every length (sizes, wall
 * thicknesses, part positions) is multiplied by `s`, so the result is geometrically similar,
 * still stands on z = 0, and its volume is `s^3` times the original. Regions are unchanged
 * (they are stated in normalised arc lengths).
 */
export function scaleShape(shape: Shape, s: number): Shape {
  if (!(s > 0) || !Number.isFinite(s)) {
    throw new RangeError(`catalogue: scale must be a finite number above zero, got ${s}`);
  }
  if (s === 1) return shape;
  return {
    parts: shape.parts.map((part): Part => ({
      ...part,
      prim: scalePrimitive(part.prim, s),
      pose: { p: scaleVec(part.pose.p, s), q: part.pose.q },
    })),
    regions: shape.regions,
  };
}

/** The shell-of-revolution profile of the named part, with its stretch factors. */
function sorPart(
  shape: Shape,
  partId: string,
): { readonly profile: readonly SorProfilePoint[]; readonly stretch: number } {
  const part = shape.parts.find((p) => p.id === partId);
  if (part === undefined) throw new RangeError(`catalogue: the shape has no part '${partId}'`);
  if (part.prim.kind !== 'sor') {
    throw new RangeError(`catalogue: part '${partId}' is not a shell of revolution`);
  }
  if (part.prim.profile.length < 2) {
    throw new RangeError(`catalogue: part '${partId}' has no profile`);
  }
  const scale = part.prim.scaleXY ?? [1, 1];
  return { profile: part.prim.profile, stretch: Math.max(scale[0], scale[1]) };
}

/**
 * A stated dimension measured on a shape, in millimetres (see `DimensionMeasure` for what each
 * kind measures). Throws a RangeError when the shape lacks the part the measure refers to.
 */
export function measureDimensionMm(shape: Shape, measure: DimensionMeasure): number {
  switch (measure.kind) {
    case 'bbox': {
      const selector = measure.parts;
      let subject = shape;
      if (selector !== undefined) {
        const parts = shape.parts.filter((p) => partSelectorMatches(selector, p.id));
        if (parts.length === 0) {
          throw new RangeError(`catalogue: no part of the shape matches '${selector}'`);
        }
        subject = { parts, regions: [] };
      }
      const box = boundingBox(subject);
      const axis = measure.axis === 'x' ? 0 : measure.axis === 'y' ? 1 : 2;
      return mToMm((box.max[axis] as number) - (box.min[axis] as number));
    }
    case 'rim_diameter': {
      const { profile, stretch } = sorPart(shape, measure.part ?? 'body');
      const rim = profile[profile.length - 1] as SorProfilePoint;
      return mToMm(2 * (rim.r + rim.t / 2) * stretch);
    }
    case 'base_diameter': {
      const { profile, stretch } = sorPart(shape, measure.part ?? 'body');
      const corner = profile[1] as SorProfilePoint;
      return mToMm(2 * (corner.r + corner.t / 2) * stretch);
    }
    case 'inner_depth': {
      const { profile } = sorPart(shape, measure.part ?? 'body');
      const base = profile[0] as SorProfilePoint;
      const rim = profile[profile.length - 1] as SorProfilePoint;
      return mToMm(rim.z + rim.t / 2 - (base.z + base.t / 2));
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Joints between the parts of an item
// ---------------------------------------------------------------------------------------------

/**
 * Overlap by which two parts must interpenetrate to count as joined, metres (0.05 mm; the
 * kernel attaches a base disc to its pot with 0.1 mm). Parts that merely touch along a line,
 * or miss each other by a hair, are not one rigid body in any derived product that takes the
 * union of the parts.
 */
export const MIN_JOINT_OVERLAP = 0.00005;

/** Number of random starting points of the search for the deepest common point of two parts. */
const JOINT_SAMPLES = 400;
/** Number of the best starting points that are refined. */
const JOINT_STARTS = 6;
/** Seed of the counter-based generator for the starting points (any constant). */
const JOINT_SEED = 0x6a6f696e;

/**
 * How deep two parts of a shape reach into each other, metres: the largest `d` such that some
 * point is at least `d` inside both (the negative of the minimum over space of the larger of
 * the two signed distances). Negative when the parts are apart: minus half the gap between
 * them (at least; for parts whose bounding boxes are more than 2 mm apart it is half the
 * distance between the boxes). Found
 * by a deterministic search (random starts in the box the two parts share, then a compass
 * search), so a lower bound on the depth; the kernel's signed distance is itself a lower bound
 * in magnitude inside some primitives.
 */
export function partOverlap(shape: Shape, first: number, second: number): number {
  const a = shape.parts[first];
  const b = shape.parts[second];
  if (a === undefined || b === undefined) throw new RangeError('catalogue: no such part');
  const boxA = boundingBox({ parts: [a], regions: [] });
  const boxB = boundingBox({ parts: [b], regions: [] });
  const lo: number[] = [];
  const hi: number[] = [];
  let apart = 0;
  for (let k = 0; k < 3; k++) {
    const l = Math.max(boxA.min[k] as number, boxB.min[k] as number);
    const h = Math.min(boxA.max[k] as number, boxB.max[k] as number);
    if (l > h) apart = Math.max(apart, l - h);
    // Where the boxes do not overlap along an axis, search the gap between them.
    lo.push(Math.min(l, h) - MIN_JOINT_OVERLAP);
    hi.push(Math.max(l, h) + MIN_JOINT_OVERLAP);
  }
  // Boxes well apart: the parts are at least that far from each other.
  if (apart > 0.002) return -apart / 2;
  const depth = (p: Vec3): number =>
    Math.max(
      primitiveSignedDistance(a.prim, poseInverseTransformPoint(a.pose, p)),
      primitiveSignedDistance(b.prim, poseInverseTransformPoint(b.pose, p)),
    );
  const starts: { p: Vec3; f: number }[] = [];
  for (let i = 0; i < JOINT_SAMPLES; i++) {
    const p: Vec3 = [0, 1, 2].map(
      (k) =>
        (lo[k] as number) +
        randomUniform(JOINT_SEED, first, second, i, k) * ((hi[k] as number) - (lo[k] as number)),
    ) as unknown as Vec3;
    starts.push({ p, f: depth(p) });
  }
  starts.sort((x, y) => x.f - y.f);
  const size = Math.max(hi[0]! - lo[0]!, hi[1]! - lo[1]!, hi[2]! - lo[2]!);
  let best = Number.POSITIVE_INFINITY;
  for (const start of starts.slice(0, JOINT_STARTS)) {
    let p = start.p;
    let f = start.f;
    for (let step = size / 8; step > 1e-7;) {
      let moved = false;
      for (let k = 0; k < 3; k++) {
        for (const sign of [-1, 1]) {
          const q: Vec3 = [
            p[0] + (k === 0 ? sign * step : 0),
            p[1] + (k === 1 ? sign * step : 0),
            p[2] + (k === 2 ? sign * step : 0),
          ];
          const fq = depth(q);
          if (fq < f) {
            p = q;
            f = fq;
            moved = true;
          }
        }
      }
      if (!moved) step /= 2;
    }
    best = Math.min(best, f);
  }
  return -best;
}

/** A part that is not joined to the first part of its shape, with how nearly it is. */
export interface LoosePart {
  /** Id of the part. */
  readonly part: string;
  /**
   * The deepest overlap found between any part joined to this one (itself included) and any
   * part of the rest of the item, metres: below {@link MIN_JOINT_OVERLAP}, and minus half the
   * gap when they are apart.
   */
  readonly overlap: number;
  /** The two parts that overlap was found between. */
  readonly between: readonly [string, string];
}

/**
 * The parts of a shape that are not joined to its first part through a chain of parts that
 * interpenetrate by at least `minOverlap` metres. Empty for an item in one piece.
 */
export function looseParts(shape: Shape, minOverlap: number = MIN_JOINT_OVERLAP): LoosePart[] {
  const n = shape.parts.length;
  const group = shape.parts.map((_, i) => i);
  const find = (i: number): number => {
    let root = i;
    while (group[root] !== root) root = group[root] as number;
    return root;
  };
  const overlaps = new Map<number, number>();
  const overlapOf = (i: number, j: number): number => {
    const key = i * n + j;
    let found = overlaps.get(key);
    if (found === undefined) {
      found = partOverlap(shape, i, j);
      overlaps.set(key, found);
    }
    return found;
  };
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      // Already known to be joined through other parts: nothing to learn.
      if (find(i) === find(j)) continue;
      if (overlapOf(i, j) >= minOverlap) group[find(j)] = find(i);
    }
  }
  const main = find(0);
  const loose: LoosePart[] = [];
  for (let i = 0; i < n; i++) {
    if (find(i) === main) continue;
    // The nearest approach of this part's group to the rest of the item.
    let overlap = Number.NEGATIVE_INFINITY;
    let between: [string, string] = ['', ''];
    for (let j = 0; j < n; j++) {
      if (find(j) !== find(i)) continue;
      for (let k = 0; k < n; k++) {
        if (find(k) === find(i)) continue;
        const d = overlapOf(Math.min(j, k), Math.max(j, k));
        if (d > overlap) {
          overlap = d;
          between = [(shape.parts[j] as Part).id, (shape.parts[k] as Part).id];
        }
      }
    }
    loose.push({ part: (shape.parts[i] as Part).id, overlap, between });
  }
  return loose;
}

// ---------------------------------------------------------------------------------------------
// Material counted twice
// ---------------------------------------------------------------------------------------------

/** Spacing of the sample grid in the box two parts share, metres (0.3 mm). */
const EXCESS_SPACING = 0.0003;
/** Fewest and most samples along an axis of that box. */
const EXCESS_MIN_SAMPLES = 10;
const EXCESS_MAX_SAMPLES = 24;
/** Seed of the counter-based generator that jitters the samples (any constant). */
const EXCESS_SEED = 0x65786365;

/** What summing the parts of a shape counts more than once. */
export interface CountedTwice {
  /**
   * Volume by which the sum of the parts exceeds the solid they make together, cubic metres:
   * the integral over space of (number of parts containing the point, less one).
   */
  readonly volume: number;
  /**
   * Mass by which the sum of the parts exceeds that of the solid they make together when every
   * point is given the densest of the parts it lies in, kilograms (the steel tang inside a
   * wooden handle is steel; the wood it displaces is what is counted on top).
   */
  readonly mass: number;
}

/**
 * How much of a shape the kernel's mass properties count twice. They are sums over parts
 * (`computeMassProperties`), so where parts overlap the material is weighed once per part; the
 * wall thicknesses that the catalogue fits to stated masses hide it.
 *
 * Estimated by jittered sampling of the box every pair of parts shares. A point in m parts lies
 * in the boxes of m (m - 1) / 2 pairs, so each sample in both parts of its pair is weighted by
 * what the point is over-counted by (m - 1 volumes; the densities of its parts less the largest
 * of them) divided by that number of pairs. Densities are the catalogue's, less the porosity of
 * a perforated part. Deterministic; accurate to about a percent of the result.
 */
export function countedTwice(shape: Shape): CountedTwice {
  const parts = shape.parts;
  const boxes = parts.map((part) => boundingBox({ parts: [part], regions: [] }));
  const densities = parts.map(
    (part) => materialDensity(part.material) * (1 - (part.porosity ?? 0)),
  );
  const inside = (index: number, p: Vec3): boolean => {
    const box = boxes[index] as (typeof boxes)[number];
    if (
      p[0] < box.min[0] ||
      p[0] > box.max[0] ||
      p[1] < box.min[1] ||
      p[1] > box.max[1] ||
      p[2] < box.min[2] ||
      p[2] > box.max[2]
    ) {
      return false;
    }
    const part = parts[index] as Part;
    return primitiveSignedDistance(part.prim, poseInverseTransformPoint(part.pose, p)) <= 0;
  };
  let volume = 0;
  let mass = 0;
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      const a = boxes[i] as (typeof boxes)[number];
      const b = boxes[j] as (typeof boxes)[number];
      const lo: Vec3 = [
        Math.max(a.min[0], b.min[0]),
        Math.max(a.min[1], b.min[1]),
        Math.max(a.min[2], b.min[2]),
      ];
      const hi: Vec3 = [
        Math.min(a.max[0], b.max[0]),
        Math.min(a.max[1], b.max[1]),
        Math.min(a.max[2], b.max[2]),
      ];
      if (!(hi[0] > lo[0] && hi[1] > lo[1] && hi[2] > lo[2])) continue;
      const counts = [0, 1, 2].map((k) =>
        Math.min(
          EXCESS_MAX_SAMPLES,
          Math.max(
            EXCESS_MIN_SAMPLES,
            Math.ceil(((hi[k] as number) - (lo[k] as number)) / EXCESS_SPACING),
          ),
        ),
      ) as [number, number, number];
      const cell =
        ((hi[0] - lo[0]) / counts[0]) *
        ((hi[1] - lo[1]) / counts[1]) *
        ((hi[2] - lo[2]) / counts[2]);
      let volumeWeight = 0;
      let massWeight = 0;
      let sample = 0;
      for (let x = 0; x < counts[0]; x++) {
        for (let y = 0; y < counts[1]; y++) {
          for (let z = 0; z < counts[2]; z++, sample++) {
            const jitter = (axis: number): number => randomUniform(EXCESS_SEED, i, j, sample, axis);
            const p: Vec3 = [
              lo[0] + ((x + jitter(0)) / counts[0]) * (hi[0] - lo[0]),
              lo[1] + ((y + jitter(1)) / counts[1]) * (hi[1] - lo[1]),
              lo[2] + ((z + jitter(2)) / counts[2]) * (hi[2] - lo[2]),
            ];
            if (!inside(i, p) || !inside(j, p)) continue;
            let m = 2;
            let total = (densities[i] as number) + (densities[j] as number);
            let densest = Math.max(densities[i] as number, densities[j] as number);
            for (let k = 0; k < parts.length; k++) {
              if (k === i || k === j || !inside(k, p)) continue;
              m++;
              total += densities[k] as number;
              densest = Math.max(densest, densities[k] as number);
            }
            const pairs = (m * (m - 1)) / 2;
            volumeWeight += (m - 1) / pairs;
            massWeight += (total - densest) / pairs;
          }
        }
      }
      volume += volumeWeight * cell;
      mass += massWeight * cell;
    }
  }
  return { volume, mass };
}

/** Default number of grid cells `brimfulVolume` spreads over the bounding box of the shape. */
export const BRIMFUL_GRID_CELLS = 400_000;

/**
 * The water an item holds when it stands in its item frame (z up) and is filled until it spills,
 * m^3: the capacity of a vessel filled to the brim, or of whatever hollows an item has that face
 * upwards (a plate's well, a muffin tin's cups). Works for any shape, including stemware and
 * drafted box shells, because it uses only the signed distance.
 *
 * Method: the bounding box plus one empty layer is cut into about `cells` cubic cells. Every cell
 * outside the solid gets its spill level, the lowest height water in it must rise to before a path
 * of cells leads it out of the grid (a priority flood from the grid boundary). A cell lying below
 * its spill level is wet. Cells whose centre is inside the solid count as dry, and cells whose
 * centre is within half a cell outside it count as wall, so that a wall thinner than a cell cannot
 * leak; a wall cell beside a wet cell and below that cell's spill level counts as wet, which makes
 * up on average for the half cells lost on the solid side. The result is within about 4 % of the
 * exact capacity for vessels at the default cell count, and less accurate for shallow hollows a
 * few cells deep (plates).
 */
export function brimfulVolume(shape: Shape, cells: number = BRIMFUL_GRID_CELLS): number {
  if (!(cells >= 1000) || !Number.isFinite(cells)) {
    throw new RangeError(`catalogue: brimfulVolume needs at least 1000 cells, got ${cells}`);
  }
  const box = boundingBox(shape);
  const size: Vec3 = [box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2]];
  const h = Math.cbrt((size[0] * size[1] * size[2]) / cells);
  if (!(h > 0)) return 0;
  const nx = Math.ceil(size[0] / h) + 2;
  const ny = Math.ceil(size[1] / h) + 2;
  const nz = Math.ceil(size[2] / h) + 2;
  const total = nx * ny * nz;
  const layer = nx * ny;
  const EMPTY = 0;
  const SOLID = 1;
  const WALL = 2;
  const state = new Uint8Array(total);
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const d = signedDistance(shape, [
          box.min[0] + (i - 0.5) * h,
          box.min[1] + (j - 0.5) * h,
          box.min[2] + (k - 0.5) * h,
        ]);
        state[i + nx * j + layer * k] = d <= 0 ? SOLID : d <= h / 2 ? WALL : EMPTY;
      }
    }
  }

  // Spill level of every empty cell, in layers: a shortest path from the grid boundary whose cost
  // is the highest layer on the way. A binary heap of cell indices ordered by level.
  const level = new Float64Array(total).fill(Infinity);
  const heap: number[] = [];
  const levelAt = (slot: number): number => level[heap[slot] as number] as number;
  const swap = (a: number, b: number): void => {
    const t = heap[a] as number;
    heap[a] = heap[b] as number;
    heap[b] = t;
  };
  const push = (cell: number): void => {
    heap.push(cell);
    let a = heap.length - 1;
    while (a > 0) {
      const parent = (a - 1) >> 1;
      if (levelAt(parent) <= levelAt(a)) break;
      swap(a, parent);
      a = parent;
    }
  };
  const pop = (): number => {
    const top = heap[0] as number;
    const last = heap.pop() as number;
    if (heap.length > 0) {
      heap[0] = last;
      let a = 0;
      for (;;) {
        const l = 2 * a + 1;
        const r = l + 1;
        let least = a;
        if (l < heap.length && levelAt(l) < levelAt(least)) least = l;
        if (r < heap.length && levelAt(r) < levelAt(least)) least = r;
        if (least === a) break;
        swap(a, least);
        a = least;
      }
    }
    return top;
  };
  const STEPS = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ] as const;
  /** Calls `visit` with each of the six neighbours of `cell` inside the grid and its layer. */
  const eachNeighbour = (cell: number, visit: (other: number, layerOf: number) => void): void => {
    const i = cell % nx;
    const j = Math.floor(cell / nx) % ny;
    const k = Math.floor(cell / layer);
    for (const [di, dj, dk] of STEPS) {
      const ii = i + di;
      const jj = j + dj;
      const kk = k + dk;
      if (ii < 0 || jj < 0 || kk < 0 || ii >= nx || jj >= ny || kk >= nz) continue;
      visit(ii + nx * jj + layer * kk, kk);
    }
  };
  // The outermost layer of cells lies outside the bounding box, so it is empty.
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        if (i > 0 && j > 0 && k > 0 && i < nx - 1 && j < ny - 1 && k < nz - 1) continue;
        const cell = i + nx * j + layer * k;
        level[cell] = k;
        push(cell);
      }
    }
  }
  const done = new Uint8Array(total);
  while (heap.length > 0) {
    const cell = pop();
    if (done[cell] === 1) continue;
    done[cell] = 1;
    const here = level[cell] as number;
    eachNeighbour(cell, (other, layerOf) => {
      if (state[other] !== EMPTY || done[other] === 1) return;
      const reached = Math.max(here, layerOf);
      if (reached < (level[other] as number)) {
        level[other] = reached;
        push(other);
      }
    });
  }

  let wet = 0;
  for (let cell = 0; cell < total; cell++) {
    const k = Math.floor(cell / layer);
    if (state[cell] === EMPTY) {
      if ((level[cell] as number) > k) wet++;
    } else if (state[cell] === WALL) {
      let beside = -Infinity;
      eachNeighbour(cell, (other, layerOf) => {
        const spill = level[other] as number;
        if (state[other] === EMPTY && spill > layerOf) beside = Math.max(beside, spill);
      });
      if (beside > k) wet++;
    }
  }
  return wet * h * h * h;
}
