// The two overlap measures against closed forms: bodies pushed into each other by a known depth.
import type { Pose } from '@spotless/core';
import { POSE_IDENTITY } from '@spotless/core';
import type { Shape } from '@spotless/geometry';
import { signedDistance } from '@spotless/geometry';
import { measurePenetration } from '@spotless/physics';
import { instantiate } from '@spotless/catalogue';
import { describe, expect, it } from 'vitest';
import {
  AXIS_SAMPLE_SPACING,
  SURFACE_SAMPLE_CHORD_ERROR,
  SURFACE_SAMPLE_SPACING,
  exactOverlapOfPair,
  shapeProbes,
} from './overlap.ts';
import type { SceneBody } from './scene.ts';
import { collisionPiecesOf } from './scene.ts';

const MM = 1e-3;

function body(id: string, shape: Shape): SceneBody {
  return { id, shape, pieces: collisionPiecesOf(shape), kind: 'static' };
}

function ball(radius: number): Shape {
  return {
    parts: [
      {
        id: 'ball',
        prim: { kind: 'capsule', a: [0, 0, 0], b: [0, 0, 0], radius },
        pose: POSE_IDENTITY,
        material: 'stainless_steel',
      },
    ],
    regions: [],
  };
}

/** A wire of radius 2.1 mm along y through the origin, 0.2 m long. */
const wire: Shape = {
  parts: [
    {
      id: 'wire',
      prim: { kind: 'capsule', a: [0, -0.1, 0], b: [0, 0.1, 0], radius: 0.0021 },
      pose: POSE_IDENTITY,
      material: 'rack_wire_pa11',
    },
  ],
  regions: [],
};

/** A slab 100 x 100 x 10 mm with sharp edges, its top face on z = 0. */
const slab: Shape = {
  parts: [
    {
      id: 'slab',
      prim: { kind: 'rbox', halfExtents: [0.05, 0.05, 0.005], radius: 0 },
      pose: { p: [0, 0, -0.005], q: [0, 0, 0, 1] },
      material: 'stainless_steel',
    },
  ],
  regions: [],
};

const at = (x: number, y: number, z: number): Pose => ({ p: [x, y, z], q: [0, 0, 0, 1] });

describe('overlap of exact shapes', () => {
  it('two balls overlap by the sum of their radii less the distance of their centres', () => {
    const [a, b] = [body('a', ball(0.02)), body('b', ball(0.03))];
    // Centres 49.2 mm apart: 0.8 mm of overlap. Both measures are exact for balls.
    const pose = at(0.0492 * 0.6, 0.0492 * 0.8, 0);
    expect(exactOverlapOfPair(a, POSE_IDENTITY, b, pose)).toBeCloseTo(0.0008, 12);
    const measured = measurePenetration(
      { pieces: a.pieces, pose: POSE_IDENTITY },
      { pieces: b.pieces, pose },
    );
    expect(measured.depth).toBeCloseTo(0.0008, 12);
    // Just touching, and apart: no overlap.
    expect(exactOverlapOfPair(a, POSE_IDENTITY, b, at(0.05, 0, 0))).toBeLessThan(1e-12);
    expect(exactOverlapOfPair(a, POSE_IDENTITY, b, at(0.0501, 0, 0))).toBe(0);
    expect(exactOverlapOfPair(a, POSE_IDENTITY, b, at(1, 0, 0))).toBe(0);
  });

  it('a wire pressed into a flat face overlaps by how far it is pressed in', () => {
    const [w, s] = [body('wire', wire), body('slab', slab)];
    // The wire lying on the face: axis one radius above it. Pressed in by 0.3 mm.
    const pressed = at(0.01, 0, 0.0021 - 0.0003);
    expect(exactOverlapOfPair(w, pressed, s, POSE_IDENTITY)).toBeCloseTo(0.0003, 9);
    expect(exactOverlapOfPair(s, POSE_IDENTITY, w, pressed)).toBeCloseTo(0.0003, 9);
    expect(exactOverlapOfPair(w, at(0.01, 0, 0.0021 + 1e-6), s, POSE_IDENTITY)).toBe(0);
    const measured = measurePenetration(
      { pieces: w.pieces, pose: pressed },
      { pieces: s.pieces, pose: POSE_IDENTITY },
    );
    expect(measured.depth).toBeCloseTo(0.0003, 9);
  });

  it('finds a wire under the round rim of a plate that the collision pieces only graze', () => {
    // A catalogue plate lying upside down on its rim over a wire, lowered 0.3 mm into it. The
    // rim is a circle; the wire crosses it at two points. The exact shapes overlap by the full
    // 0.3 mm. The collision rim is a polygon inscribed in that circle to the chord error, so
    // where the wire crosses a side it may be up to 0.5 mm clear of it: the collision pieces
    // overlap by less, or not at all.
    const plate = body('plate', instantiate('dinner_plate_porcelain_iec').shape);
    const w = body('wire', wire);
    const height = instantiate('dinner_plate_porcelain_iec').bbox.max[2];
    // Upside down: turned half a turn about x; its rim is then at z = 0 of the pose's frame when
    // the item origin is at the plate's height.
    const inverted = (z: number): Pose => ({ p: [0, 0, z], q: [1, 0, 0, 0] });
    // 100 mm off the axis the wire crosses the rim (radius 123 mm) 72 mm either side of its middle.
    const wirePose = at(0.1, 0, -0.0021);
    const depth = 0.0003;
    expect(exactOverlapOfPair(plate, inverted(height), w, wirePose)).toBeLessThan(1e-9);
    const exact = exactOverlapOfPair(plate, inverted(height - depth), w, wirePose);
    // The wire axis is sampled every 0.5 mm: the sample nearest to where the rim crosses it is
    // within 0.25 mm of that point, which costs under 0.02 mm of depth on a rim of 2 mm radius.
    expect(exact).toBeGreaterThan(depth - 0.02 * MM);
    expect(exact).toBeLessThanOrEqual(depth + 1e-9);
    const pieces = measurePenetration(
      { pieces: plate.pieces, pose: inverted(height - depth) },
      { pieces: w.pieces, pose: wirePose },
    ).depth;
    expect(pieces).toBeLessThanOrEqual(depth + 1e-9);
    expect(pieces).toBeGreaterThanOrEqual(0);
  });
});

describe('the probes of a shape', () => {
  it('follow the axis of a capsule with its radius, and lie on the surface of anything else', () => {
    const along = shapeProbes(wire);
    // 0.2 m at 0.5 mm: 401 points on the axis, each with the wire radius.
    expect(along.length / 4).toBe(Math.round(0.2 / AXIS_SAMPLE_SPACING) + 1);
    for (let i = 0; i < along.length; i += 4) {
      expect(along[i]).toBe(0);
      expect(along[i + 2]).toBe(0);
      expect(along[i + 3]).toBe(0.0021);
    }
    expect(along[1]).toBeCloseTo(-0.1, 12);
    expect(along[along.length - 3]).toBeCloseTo(0.1, 12);

    const mug = instantiate('mug_ceramic_300').shape;
    const probes = shapeProbes(mug);
    expect(shapeProbes(mug)).toBe(probes); // cached per shape
    let worst = 0;
    for (let i = 0; i < probes.length; i += 4) {
      expect(probes[i + 3]).toBe(0);
      const d = signedDistance(mug, [
        probes[i] as number,
        probes[i + 1] as number,
        probes[i + 2] as number,
      ]);
      worst = Math.max(worst, Math.abs(d));
    }
    // On the facets of a mesh within the sampling chord error of the surface. Where parts join,
    // the surface of one lies inside the other (the handle roots in the wall, the foot ring in
    // the base): never deeper than the thickest wall, and a few per cent of the probes.
    const wall = 0.0055;
    expect(worst).toBeLessThan(wall);
    let near = 0;
    for (let i = 0; i < probes.length; i += 4) {
      const d = signedDistance(mug, [
        probes[i] as number,
        probes[i + 1] as number,
        probes[i + 2] as number,
      ]);
      if (Math.abs(d) <= SURFACE_SAMPLE_CHORD_ERROR + 1e-6) near++;
    }
    expect(near / (probes.length / 4)).toBeGreaterThan(0.95);
    // Dense enough: at most the sample spacing apart, so at least one probe per spacing squared
    // of surface (the mug has some 0.07 m^2 of it, inside and out).
    expect(probes.length / 4).toBeGreaterThan(0.07 / SURFACE_SAMPLE_SPACING ** 2);
  });
});
