/**
 * How close a region of one item lies to another item: per triangle of the region's mesh, its
 * area and the distance of its centroid to the nearest point of the other item's mesh. What a
 * load is held to when the phenomenon it stands for is stated as a gap over an area (P03: two
 * plates in one slot some millimetres apart; P15: two nested spoons under 1 mm apart over
 * about 10 cm2); `scripts/pair-gap.ts` prints it for a built load.
 *
 * The distance is taken on the meshes (chord error 0.05 mm, so clearances are good to about
 * 0.1 mm and areas to a few per cent) and not from the geometry kernel's signed distance,
 * which for a shape scaled along one axis (the bowl of a spoon) is a lower bound and reads up
 * to a third short. The sign is the kernel's: negative where the centroid is inside the other
 * solid.
 *
 * Units: poses SI (tub frame); results in millimetres and square millimetres.
 */

import { instantiate } from '@spotless/catalogue';
import {
  poseInverseTransformPoint,
  poseTransformPoint,
  type Pose,
  type Vec3,
} from '@spotless/core';
import { buildRenderMesh, signedDistance } from '@spotless/geometry';

/** Chord error of the sampled meshes, metres. */
const CHORD_ERROR = 0.00005;
const MM = 1000;

/** One triangle of a region: its area, mm2, and its clearance to the other item, mm. */
export interface GapSample {
  readonly area: number;
  /** Distance to the other item's surface, at most the reach asked for; negative inside it. */
  readonly clearance: number;
}

const sub = (u: Vec3, v: Vec3): Vec3 => [u[0] - v[0], u[1] - v[1], u[2] - v[2]];
const dot = (u: Vec3, v: Vec3): number => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];

/** Distance from a point to a triangle (the closest point by its Voronoi regions). */
function toTriangle(p: Vec3, a: Vec3, b: Vec3, c: Vec3): number {
  const ab = sub(b, a);
  const ac = sub(c, a);
  const ap = sub(p, a);
  const d1 = dot(ab, ap);
  const d2 = dot(ac, ap);
  let closest: Vec3;
  if (d1 <= 0 && d2 <= 0) closest = a;
  else {
    const bp = sub(p, b);
    const d3 = dot(ab, bp);
    const d4 = dot(ac, bp);
    const cp = sub(p, c);
    const d5 = dot(ab, cp);
    const d6 = dot(ac, cp);
    const vc = d1 * d4 - d3 * d2;
    const vb = d5 * d2 - d1 * d6;
    const va = d3 * d6 - d5 * d4;
    if (d3 >= 0 && d4 <= d3) closest = b;
    else if (d6 >= 0 && d5 <= d6) closest = c;
    else if (vc <= 0 && d1 >= 0 && d3 <= 0) {
      const v = d1 / (d1 - d3);
      closest = [a[0] + v * ab[0], a[1] + v * ab[1], a[2] + v * ab[2]];
    } else if (vb <= 0 && d2 >= 0 && d6 <= 0) {
      const w = d2 / (d2 - d6);
      closest = [a[0] + w * ac[0], a[1] + w * ac[1], a[2] + w * ac[2]];
    } else if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
      const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
      closest = [b[0] + w * (c[0] - b[0]), b[1] + w * (c[1] - b[1]), b[2] + w * (c[2] - b[2])];
    } else {
      const sum = va + vb + vc;
      const v = vb / sum;
      const w = vc / sum;
      closest = [
        a[0] + ab[0] * v + ac[0] * w,
        a[1] + ab[1] * v + ac[1] * w,
        a[2] + ab[2] * v + ac[2] * w,
      ];
    }
  }
  const d = sub(p, closest);
  return Math.hypot(d[0], d[1], d[2]);
}

/**
 * The clearance of every triangle of a region of an item (catalogue type `typeId` at `pose`)
 * to another item (`otherTypeId` at `otherPose`), sorted from the least; distances beyond
 * `reach_mm` are returned as `reach_mm`. Throws a RangeError for a region the type lacks.
 */
export function regionClearance(
  typeId: string,
  pose: Pose,
  regionId: string,
  otherTypeId: string,
  otherPose: Pose,
  reach_mm: number,
): GapSample[] {
  const shape = instantiate(typeId).shape;
  const otherShape = instantiate(otherTypeId).shape;
  const mesh = buildRenderMesh(shape, { chordError: CHORD_ERROR });
  const region = mesh.regionIds.indexOf(regionId);
  if (region < 0) {
    throw new RangeError(`${typeId} has no region ${regionId} (${mesh.regionIds.join(', ')})`);
  }
  // The other item's mesh in the tub frame, in a grid of cells as wide as the reach.
  const reach = reach_mm / MM + CHORD_ERROR;
  const otherMesh = buildRenderMesh(otherShape, { chordError: CHORD_ERROR });
  const corners: Vec3[] = [];
  for (let i = 0; i < otherMesh.positions.length; i += 3) {
    corners.push(
      poseTransformPoint(otherPose, [
        otherMesh.positions[i] as number,
        otherMesh.positions[i + 1] as number,
        otherMesh.positions[i + 2] as number,
      ]),
    );
  }
  const cellOf = (v: number): number => Math.floor(v / reach);
  const grid = new Map<string, number[]>();
  for (let t = 0; t < otherMesh.indices.length; t += 3) {
    const a = corners[otherMesh.indices[t] as number] as Vec3;
    const b = corners[otherMesh.indices[t + 1] as number] as Vec3;
    const c = corners[otherMesh.indices[t + 2] as number] as Vec3;
    const lo = [0, 1, 2].map((k) =>
      cellOf(Math.min(a[k] as number, b[k] as number, c[k] as number)),
    );
    const hi = [0, 1, 2].map((k) =>
      cellOf(Math.max(a[k] as number, b[k] as number, c[k] as number)),
    );
    for (let i = lo[0] as number; i <= (hi[0] as number); i++) {
      for (let j = lo[1] as number; j <= (hi[1] as number); j++) {
        for (let k = lo[2] as number; k <= (hi[2] as number); k++) {
          const key = `${i},${j},${k}`;
          const list = grid.get(key);
          if (list === undefined) grid.set(key, [t]);
          else list.push(t);
        }
      }
    }
  }
  /** Distance from a point of the tub frame to the other item's mesh, at most the reach. */
  const toOther = (p: Vec3): number => {
    let least = reach;
    const at = [cellOf(p[0]), cellOf(p[1]), cellOf(p[2])] as const;
    for (let i = at[0] - 1; i <= at[0] + 1; i++) {
      for (let j = at[1] - 1; j <= at[1] + 1; j++) {
        for (let k = at[2] - 1; k <= at[2] + 1; k++) {
          for (const t of grid.get(`${i},${j},${k}`) ?? []) {
            const d = toTriangle(
              p,
              corners[otherMesh.indices[t] as number] as Vec3,
              corners[otherMesh.indices[t + 1] as number] as Vec3,
              corners[otherMesh.indices[t + 2] as number] as Vec3,
            );
            if (d < least) least = d;
          }
        }
      }
    }
    return least;
  };
  const vertex = (i: number): Vec3 => [
    mesh.positions[3 * i] as number,
    mesh.positions[3 * i + 1] as number,
    mesh.positions[3 * i + 2] as number,
  ];
  const samples: GapSample[] = [];
  for (let t = 0; t < mesh.triRegion.length; t++) {
    if (mesh.triRegion[t] !== region) continue;
    const a = vertex(mesh.indices[3 * t] as number);
    const b = vertex(mesh.indices[3 * t + 1] as number);
    const c = vertex(mesh.indices[3 * t + 2] as number);
    const u = sub(b, a);
    const v = sub(c, a);
    const area =
      0.5 *
      Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]);
    const third = 1 / 3;
    const centroid = poseTransformPoint(pose, [
      (a[0] + b[0] + c[0]) * third,
      (a[1] + b[1] + c[1]) * third,
      (a[2] + b[2] + c[2]) * third,
    ]);
    // Inside the other solid the kernel's signed distance is negative (its size there is a
    // lower bound for a scaled shape; the sign is exact).
    const inside = signedDistance(otherShape, poseInverseTransformPoint(otherPose, centroid)) < 0;
    const distance = Math.min(toOther(centroid), reach_mm / MM);
    samples.push({ area: area * MM * MM, clearance: (inside ? -distance : distance) * MM });
  }
  return samples.sort((x, y) => x.clearance - y.clearance);
}

/** The area of the samples whose clearance is at most `within_mm`, mm2. */
export function areaWithin(samples: readonly GapSample[], within_mm: number): number {
  return samples.filter((s) => s.clearance <= within_mm).reduce((sum, s) => sum + s.area, 0);
}
