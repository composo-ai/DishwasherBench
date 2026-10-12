/**
 * Measurements of a triangle mesh: closedness, volume, area and mass moments.
 *
 * These are integrals over the facets themselves (divergence theorem), independent of the
 * analytic formulas of the kernel, which makes them the natural cross-check of
 * `computeMassProperties` and `surfaceArea`. They are also what a consumer needs to turn a render
 * mesh into surface elements.
 *
 * Units: metres, in the frame of the mesh (the item frame for `buildRenderMesh`).
 */

import type { Mat3, Vec3 } from '@spotless/core';
import type { RenderMesh } from './types.ts';

/** Result of {@link meshTopology}. */
export interface MeshTopology {
  /** Number of distinct vertex positions. */
  readonly weldedVertices: number;
  /** Triangles with two corners at the same position (they bound nothing). */
  readonly degenerateTriangles: number;
  /** Directed edges with no oppositely directed partner: the surface has a hole there. */
  readonly openEdges: number;
  /** Directed edges used by more than one triangle: the surface is not a manifold there. */
  readonly repeatedEdges: number;
  /** True when the surface is closed and consistently oriented. */
  readonly closed: boolean;
}

/**
 * Checks that the triangles of a mesh (optionally only those of one part) form a closed,
 * consistently oriented surface once vertices at identical positions are welded: every directed
 * edge must be used exactly once and have exactly one oppositely directed partner.
 */
export function meshTopology(mesh: RenderMesh, part?: number): MeshTopology {
  const ids = new Map<string, number>();
  const welded = new Uint32Array(mesh.positions.length / 3);
  for (let v = 0; v < welded.length; v++) {
    const key = `${mesh.positions[3 * v]},${mesh.positions[3 * v + 1]},${mesh.positions[3 * v + 2]}`;
    let id = ids.get(key);
    if (id === undefined) {
      id = ids.size;
      ids.set(key, id);
    }
    welded[v] = id;
  }
  const edges = new Map<number, number>();
  const n = ids.size;
  let degenerateTriangles = 0;
  for (let t = 0; t < mesh.indices.length / 3; t++) {
    if (part !== undefined && mesh.triPart[t] !== part) continue;
    const a = welded[mesh.indices[3 * t] as number] as number;
    const b = welded[mesh.indices[3 * t + 1] as number] as number;
    const c = welded[mesh.indices[3 * t + 2] as number] as number;
    if (a === b || b === c || a === c) {
      degenerateTriangles++;
      continue;
    }
    for (const [u, v] of [
      [a, b],
      [b, c],
      [c, a],
    ] as const) {
      edges.set(u * n + v, (edges.get(u * n + v) ?? 0) + 1);
    }
  }
  let openEdges = 0;
  let repeatedEdges = 0;
  for (const [key, count] of edges) {
    if (count > 1) repeatedEdges++;
    const u = Math.floor(key / n);
    const v = key % n;
    if (!edges.has(v * n + u)) openEdges++;
  }
  return {
    weldedVertices: n,
    degenerateTriangles,
    openEdges,
    repeatedEdges,
    closed: openEdges === 0 && repeatedEdges === 0 && degenerateTriangles === 0,
  };
}

function corner(mesh: RenderMesh, index: number): Vec3 {
  return [
    mesh.positions[3 * index] as number,
    mesh.positions[3 * index + 1] as number,
    mesh.positions[3 * index + 2] as number,
  ];
}

/**
 * Area of a mesh in m^2: all triangles, or those accepted by `select(triangle index)`.
 */
export function meshArea(mesh: RenderMesh, select?: (triangle: number) => boolean): number {
  let area = 0;
  for (let t = 0; t < mesh.indices.length / 3; t++) {
    if (select !== undefined && !select(t)) continue;
    const a = corner(mesh, mesh.indices[3 * t] as number);
    const b = corner(mesh, mesh.indices[3 * t + 1] as number);
    const c = corner(mesh, mesh.indices[3 * t + 2] as number);
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    area += 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
  }
  return area;
}

/** Volume, first moment and second-moment tensor of the solid enclosed by a closed mesh. */
export interface MeshMoments {
  /** Enclosed volume, m^3 (positive for outward-facing triangles). */
  readonly volume: number;
  /** Integral of x over the solid, m^4. */
  readonly first: Vec3;
  /** Integral of x x^T over the solid, m^5 (symmetric, row-major). */
  readonly second: Mat3;
}

/**
 * Volume and moments of the solid bounded by the triangles of a mesh (optionally only those of
 * one part), by summing signed tetrahedra from the origin (divergence theorem). The triangles
 * must form a closed surface.
 */
export function meshMoments(mesh: RenderMesh, part?: number): MeshMoments {
  let volume = 0;
  const f = [0, 0, 0];
  const s = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let t = 0; t < mesh.indices.length / 3; t++) {
    if (part !== undefined && mesh.triPart[t] !== part) continue;
    const a = corner(mesh, mesh.indices[3 * t] as number);
    const b = corner(mesh, mesh.indices[3 * t + 1] as number);
    const c = corner(mesh, mesh.indices[3 * t + 2] as number);
    const v =
      (a[0] * (b[1] * c[2] - b[2] * c[1]) +
        a[1] * (b[2] * c[0] - b[0] * c[2]) +
        a[2] * (b[0] * c[1] - b[1] * c[0])) /
      6;
    volume += v;
    const sum = [a[0] + b[0] + c[0], a[1] + b[1] + c[1], a[2] + b[2] + c[2]];
    for (let i = 0; i < 3; i++) {
      f[i] = (f[i] as number) + (v * (sum[i] as number)) / 4;
      for (let j = 0; j < 3; j++) {
        // Tetrahedron with one corner at the origin: V / 20 * (sum of p p^T + s s^T).
        s[3 * i + j] =
          (s[3 * i + j] as number) +
          (v / 20) *
            ((a[i] as number) * (a[j] as number) +
              (b[i] as number) * (b[j] as number) +
              (c[i] as number) * (c[j] as number) +
              (sum[i] as number) * (sum[j] as number));
      }
    }
  }
  return {
    volume,
    first: [f[0] as number, f[1] as number, f[2] as number],
    second: s as unknown as Mat3,
  };
}

/** Volume enclosed by a closed mesh (optionally one part of it), m^3. */
export function meshVolume(mesh: RenderMesh, part?: number): number {
  return meshMoments(mesh, part).volume;
}
