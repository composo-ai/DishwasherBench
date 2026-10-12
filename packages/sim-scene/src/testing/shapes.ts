/**
 * Test support: one shape per kind of analytic primitive the scene grids, and an independent
 * forward map from a cell of an atlas to a point of the surface.
 *
 * Units: metres. Frames: the item frame of each shape.
 */

import { quatFromAxisAngle, type Vec3 } from '@spotless/core';
import type { Part, Primitive, Shape } from '@spotless/geometry';
import { affinePoint, affineTransposeVector } from '../affine.ts';
import { PATCH_KIND, type AtlasPatch } from '../atlas-core.ts';
import type { AtlasOptions, ShapeAtlasBuilt } from '../atlas.ts';
import { createMeridianPoint, meridianAt, type MeridianRun } from '../meridian.ts';
import type { SceneMaterial } from '../scene-types.ts';

/** Atlas options at a block size, with the registry defaults for everything else. */
export function atlasOptions(blockSize: number): AtlasOptions {
  return {
    blockSize,
    lineLength: 1.5 * blockSize,
    lineMaxRadius: 3e-3,
    cutMerge: 0.25,
    deadDepth: 0.2e-3,
    stitchReach: 0.75,
    wireTouchGap: 0.3e-3,
  };
}

/** A shape of one part, with a region `all` over it and, for shells, `inside` and `outside`. */
export function singlePart(prim: Primitive, porosity?: number): Shape {
  const part: Part = {
    id: 'body',
    prim,
    pose: { p: [0.01, -0.02, 0.03], q: quatFromAxisAngle([0.3, 0.5, 0.81], 0.7) },
    material: 'test',
    ...(porosity === undefined ? {} : { porosity }),
  };
  return {
    parts: [part],
    regions:
      prim.kind === 'sor'
        ? [
            { id: 'inside', part: 'body', side: 'in' },
            { id: 'outside', part: 'body', side: 'out' },
            { id: 'all', part: 'body' },
          ]
        : [{ id: 'all', part: 'body' }],
  };
}

/** A bowl: a shell of revolution that starts on the axis (two poles). */
export const BOWL: Primitive = {
  kind: 'sor',
  profile: [
    { r: 0, z: 0.002, t: 0.004 },
    { r: 0.03, z: 0.002, t: 0.004 },
    { r: 0.055, z: 0.03, t: 0.003 },
    { r: 0.06, z: 0.05, t: 0.003 },
  ],
};

/** One primitive of every kind the atlas grids, by name. */
export const PRIMITIVES: Readonly<Record<string, Primitive>> = {
  bowl: BOWL,
  // A tube open at both ends: a meridian that never meets the axis.
  tube: {
    kind: 'sor',
    profile: [
      { r: 0.03, z: 0, t: 0.004 },
      { r: 0.034, z: 0.06, t: 0.003 },
    ],
  },
  // A quarter of a shell: two flat end faces.
  quarterShell: {
    kind: 'sor',
    profile: [
      { r: 0, z: 0.002, t: 0.004 },
      { r: 0.04, z: 0.002, t: 0.004 },
      { r: 0.05, z: 0.04, t: 0.004 },
    ],
    arc: [0.3, 0.3 + Math.PI / 2],
  },
  // A stretched shell (an oval dish).
  ovalDish: {
    kind: 'sor',
    profile: [
      { r: 0, z: 0.002, t: 0.004 },
      { r: 0.04, z: 0.002, t: 0.004 },
      { r: 0.06, z: 0.02, t: 0.003 },
    ],
    scaleXY: [1.4, 0.8],
  },
  wire: { kind: 'capsule', a: [0, 0, 0], b: [0.03, 0.1, 0.02], radius: 0.002 },
  stem: { kind: 'capsule', a: [0, 0, 0], b: [0.01, 0.0, 0.08], radius: 0.008 },
  bead: { kind: 'capsule', a: [0, 0, 0], b: [0, 0, 0], radius: 0.002 },
  ball: { kind: 'capsule', a: [0, 0, 0], b: [0, 0, 0], radius: 0.02 },
  board: { kind: 'rbox', halfExtents: [0.08, 0.05, 0.004], radius: 0.003 },
  // A flat plate: a box with one half extent of zero.
  plate: { kind: 'rbox', halfExtents: [0.06, 0.03, 0], radius: 0.0015 },
  wedge: {
    kind: 'hull',
    points: [
      [0, 0, 0],
      [0.08, 0, 0],
      [0, 0.05, 0],
      [0.01, 0.01, 0.04],
      [0.07, 0.0, 0.01],
    ],
    radius: 0.002,
  },
  // A flat hull: a rounded polygon (a knife blade).
  blade: {
    kind: 'hull',
    points: [
      [0, 0, 0],
      [0.12, 0, 0],
      [0.1, 0.025, 0],
      [0, 0.02, 0],
    ],
    radius: 0.001,
  },
};

/** Wetting data for the materials the test shapes name. */
export function testMaterial(id: string): SceneMaterial {
  return {
    id,
    wettingClass: 'continuous_film',
    advancing: [0.6, 0.3, 0.4],
    receding: [0.2, 0.1, 0.15],
  };
}

/**
 * A point of the surface inside a cell of a patch, with its outward unit normal, in the item
 * frame: the forward map of the patch written out from its generator (meridian point and
 * azimuth, or face coordinates), independently of the inverse map the tracers use. `fa` and `fb`
 * are the fractions of the way across the cell along its row and column axes. Returns null for
 * a point of a face cell that lies off the face.
 */
export function cellPoint(
  atlas: ShapeAtlasBuilt,
  patchIndex: number,
  row: number,
  col: number,
  fa: number,
  fb: number,
): { p: Vec3; n: Vec3 } | null {
  const patch = atlas.patches[patchIndex] as AtlasPatch;
  const cols = atlas.rows[2 * (patch.rowStart + row) + 1] as number;
  const unit = (v: readonly number[]): Vec3 => {
    const len = Math.hypot(v[0] as number, v[1] as number, v[2] as number) || 1;
    return [(v[0] as number) / len, (v[1] as number) / len, (v[2] as number) / len];
  };
  if (patch.line) {
    const z = ((row + fa) * patch.length) / patch.rowCount;
    const th = 2 * Math.PI * fb;
    const c = Math.cos(th);
    const s = Math.sin(th);
    return {
      p: affinePoint(patch.toItem, patch.radius * c, patch.radius * s, z),
      n: unit(affineTransposeVector(patch.frame, c, s, 0)),
    };
  }
  if (patch.kind === PATCH_KIND.rev) {
    const pt = meridianAt(patch.run as MeridianRun, (row + fa) * patch.da, createMeridianPoint());
    const th = patch.b0 + ((col + fb) * patch.db) / cols;
    const c = Math.cos(th);
    const s = Math.sin(th);
    return {
      p: affinePoint(patch.toItem, pt.r * c, pt.r * s, pt.z),
      n: unit(affineTransposeVector(patch.frame, pt.nr * c, pt.nr * s, pt.nz)),
    };
  }
  const u = patch.b0 + (col + fb) * patch.db;
  const v = patch.a0 + (row + fa) * patch.da;
  if (patch.polygon !== null) {
    const poly = patch.polygon;
    for (let i = 0; i < poly.length; i += 2) {
      const x0 = poly[i] as number;
      const y0 = poly[i + 1] as number;
      const x1 = poly[(i + 2) % poly.length] as number;
      const y1 = poly[(i + 3) % poly.length] as number;
      // Outside the edge (the outline is counter-clockwise), or within a micrometre of it.
      if ((x1 - x0) * (v - y0) - (y1 - y0) * (u - x0) < 1e-6 * Math.hypot(x1 - x0, y1 - y0))
        return null;
    }
  } else if (patch.mask !== null && !patch.mask(u, v)) {
    return null;
  }
  return {
    p: affinePoint(patch.toItem, u, v, 0),
    n: unit(affineTransposeVector(patch.frame, 0, 0, 1)),
  };
}
