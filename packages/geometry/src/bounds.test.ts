import { POSE_IDENTITY, quatFromAxisAngle, type Pose, type Vec3 } from '@spotless/core';
import { describe, expect, it } from 'vitest';
import { boundingBox, primitiveSupport } from './bounds.ts';
import { buildRenderMesh } from './mesh.ts';
import {
  DOSSIER_PROFILES_MM,
  profileMm,
  singlePart,
  testPrimitives,
  testRandom,
} from './test-util.ts';
import type { Primitive, Shape } from './types.ts';

describe('bounding box: closed forms', () => {
  it('sphere, capsule and box at the identity pose (1e-15 m)', () => {
    const sphere = boundingBox(
      singlePart({ kind: 'capsule', a: [0.01, 0.02, 0.03], b: [0.01, 0.02, 0.03], radius: 0.005 }),
    );
    for (let k = 0; k < 3; k++) {
      expect(sphere.min[k] as number).toBeCloseTo([0.005, 0.015, 0.025][k] as number, 15);
      expect(sphere.max[k] as number).toBeCloseTo([0.015, 0.025, 0.035][k] as number, 15);
    }
    const capsule = boundingBox(
      singlePart({ kind: 'capsule', a: [0, 0, 0], b: [0.03, -0.01, 0.02], radius: 0.002 }),
    );
    for (let k = 0; k < 3; k++)
      expect(capsule.min[k] as number).toBeCloseTo([-0.002, -0.012, -0.002][k] as number, 15);
    expect(capsule.max[0]).toBeCloseTo(0.032, 15);
    expect(capsule.max[1]).toBeCloseTo(0.002, 15);
    expect(capsule.max[2]).toBeCloseTo(0.022, 15);
    const box = boundingBox(
      singlePart({ kind: 'rbox', halfExtents: [0.03, 0.02, 0.005], radius: 0.001 }),
    );
    expect(box.max[0]).toBeCloseTo(0.031, 15);
    expect(box.max[1]).toBeCloseTo(0.021, 15);
    expect(box.max[2]).toBeCloseTo(0.006, 15);
    expect(box.min[0]).toBeCloseTo(-0.031, 15);
  });

  it('a box turned 45 degrees about z spans (hx + hy) / sqrt 2 plus the radius', () => {
    const pose: Pose = { p: [0.1, 0.2, 0.3], q: quatFromAxisAngle([0, 0, 1], Math.PI / 4) };
    const box = boundingBox(
      singlePart({ kind: 'rbox', halfExtents: [0.03, 0.02, 0.005], radius: 0.001 }, pose),
    );
    const reach = (0.03 + 0.02) / Math.SQRT2 + 0.001;
    expect(box.max[0]).toBeCloseTo(0.1 + reach, 15);
    expect(box.min[1]).toBeCloseTo(0.2 - reach, 15);
    expect(box.max[2]).toBeCloseTo(0.306, 15);
  });

  it('the IEC-type plate: outer radius 132.1 mm, from 0.9 mm to 26.1 mm in height', () => {
    // Rim vertex at r = 130, z = 24 with t = 4.2: the rim circle reaches r = 132.1 and z = 26.1.
    const box = boundingBox(
      singlePart({ kind: 'sor', profile: profileMm(DOSSIER_PROFILES_MM.plateIec) }),
    );
    expect(box.max[0]).toBeCloseTo(0.1321, 15);
    expect(box.min[1]).toBeCloseTo(-0.1321, 15);
    expect(box.min[2]).toBeCloseTo(0.0009, 15);
    expect(box.max[2]).toBeCloseTo(0.0261, 15);
  });

  it('a plate standing on edge (turned 90 degrees about x) is as tall as its diameter', () => {
    const pose: Pose = { p: [0, 0, 0.1321], q: quatFromAxisAngle([1, 0, 0], Math.PI / 2) };
    const box = boundingBox(
      singlePart({ kind: 'sor', profile: profileMm(DOSSIER_PROFILES_MM.plateIec) }, pose),
    );
    expect(box.min[2]).toBeCloseTo(0, 15);
    expect(box.max[2]).toBeCloseTo(0.2642, 15);
    // Its thickness direction is now y: the plate's z from 0.9 to 26.1 mm maps to y = -z.
    expect(box.min[1]).toBeCloseTo(-0.0261, 15);
    expect(box.max[1]).toBeCloseTo(-0.0009, 15);
  });

  it('a quarter fillet only reaches its own quadrant', () => {
    const prim = testPrimitives().fillet as Primitive; // wall at r = 19 mm, t = 2 mm, azimuth 0..90
    const box = boundingBox(singlePart(prim));
    expect(box.min[0]).toBeCloseTo(0, 15);
    expect(box.min[1]).toBeCloseTo(0, 15);
    expect(box.max[0]).toBeCloseTo(0.02, 15);
    expect(box.max[1]).toBeCloseTo(0.02, 15);
    expect(box.min[2]).toBeCloseTo(0, 15);
    expect(box.max[2]).toBeCloseTo(0.041, 15);
  });

  it('a stretched shell is stretched: semi-axes sx R and sy R', () => {
    const prim: Primitive = {
      kind: 'sor',
      profile: profileMm([
        [0, 2, 4],
        [50, 2, 4],
      ]),
      scaleXY: [1.3, 0.8],
    };
    const box = boundingBox(singlePart(prim));
    expect(box.max[0]).toBeCloseTo(1.3 * 0.052, 15);
    expect(box.max[1]).toBeCloseTo(0.8 * 0.052, 15);
    expect(box.max[2]).toBeCloseTo(0.004, 15);
  });
});

describe('bounding box: against the vertices of a fine mesh', () => {
  it('contains every vertex and is tight to within the chord error, for random poses of every primitive', () => {
    const rnd = testRandom(81);
    const chordError = 0.00002;
    for (const [name, prim] of Object.entries(testPrimitives())) {
      for (let trial = 0; trial < 3; trial++) {
        const pose: Pose = trial === 0 ? POSE_IDENTITY : { p: rnd.vec3(0.2), q: rnd.unitQuat() };
        const shape = singlePart(prim, pose);
        const box = boundingBox(shape);
        const mesh = buildRenderMesh(shape, { chordError });
        const lo = [Infinity, Infinity, Infinity];
        const hi = [-Infinity, -Infinity, -Infinity];
        for (let v = 0; v < mesh.positions.length; v++) {
          lo[v % 3] = Math.min(lo[v % 3] as number, mesh.positions[v] as number);
          hi[v % 3] = Math.max(hi[v % 3] as number, mesh.positions[v] as number);
        }
        for (let k = 0; k < 3; k++) {
          // Vertices are on the surface (to float32 rounding), so the exact box contains them,
          // and the extreme point of the surface is within a facet of some vertex.
          expect(box.min[k] as number, name).toBeLessThanOrEqual((lo[k] as number) + 5e-8);
          expect(box.max[k] as number, name).toBeGreaterThanOrEqual((hi[k] as number) - 5e-8);
          expect((lo[k] as number) - (box.min[k] as number), name).toBeLessThanOrEqual(
            chordError + 5e-8,
          );
          expect((box.max[k] as number) - (hi[k] as number), name).toBeLessThanOrEqual(
            chordError + 5e-8,
          );
        }
      }
    }
  });

  it('boundingBox(shape, pose) equals the box of the shape with the pose folded into its parts', () => {
    const rnd = testRandom(82);
    const prims = testPrimitives();
    const partPose: Pose = { p: [0.05, 0, 0.02], q: quatFromAxisAngle([0, 1, 0], 0.4) };
    const shape: Shape = {
      parts: [
        { id: 'a', prim: prims.bowl as Primitive, pose: POSE_IDENTITY, material: 'm' },
        { id: 'b', prim: prims.capsule as Primitive, pose: partPose, material: 'm' },
      ],
      regions: [],
    };
    const pose: Pose = { p: rnd.vec3(0.3), q: rnd.unitQuat() };
    const viaPose = boundingBox(shape, pose);
    const mesh = buildRenderMesh(shape, { chordError: 0.00002 });
    // Transform the mesh vertices by the pose and take their extents.
    const q = pose.q;
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    for (let v = 0; v < mesh.positions.length / 3; v++) {
      const x: Vec3 = [
        mesh.positions[3 * v] as number,
        mesh.positions[3 * v + 1] as number,
        mesh.positions[3 * v + 2] as number,
      ];
      const tx = 2 * (q[1] * x[2] - q[2] * x[1]);
      const ty = 2 * (q[2] * x[0] - q[0] * x[2]);
      const tz = 2 * (q[0] * x[1] - q[1] * x[0]);
      const w: Vec3 = [
        pose.p[0] + x[0] + q[3] * tx + (q[1] * tz - q[2] * ty),
        pose.p[1] + x[1] + q[3] * ty + (q[2] * tx - q[0] * tz),
        pose.p[2] + x[2] + q[3] * tz + (q[0] * ty - q[1] * tx),
      ];
      for (let k = 0; k < 3; k++) {
        lo[k] = Math.min(lo[k] as number, w[k] as number);
        hi[k] = Math.max(hi[k] as number, w[k] as number);
      }
    }
    for (let k = 0; k < 3; k++) {
      expect(Math.abs((viaPose.min[k] as number) - (lo[k] as number))).toBeLessThanOrEqual(0.00003);
      expect(Math.abs((viaPose.max[k] as number) - (hi[k] as number))).toBeLessThanOrEqual(0.00003);
      expect(viaPose.min[k] as number).toBeLessThanOrEqual((lo[k] as number) + 1e-7);
      expect(viaPose.max[k] as number).toBeGreaterThanOrEqual((hi[k] as number) - 1e-7);
    }
  });

  it('primitiveSupport is the largest projection of the surface on a direction', () => {
    const rnd = testRandom(83);
    for (const [name, prim] of Object.entries(testPrimitives())) {
      const mesh = buildRenderMesh(singlePart(prim), { chordError: 0.00002 });
      for (let trial = 0; trial < 5; trial++) {
        const d = rnd.unitVec3();
        let best = -Infinity;
        for (let v = 0; v < mesh.positions.length / 3; v++) {
          best = Math.max(
            best,
            d[0] * (mesh.positions[3 * v] as number) +
              d[1] * (mesh.positions[3 * v + 1] as number) +
              d[2] * (mesh.positions[3 * v + 2] as number),
          );
        }
        const support = primitiveSupport(prim, d);
        expect(support, name).toBeGreaterThanOrEqual(best - 5e-8);
        expect(support - best, name).toBeLessThanOrEqual(0.00002 + 5e-8);
      }
    }
  });
});
