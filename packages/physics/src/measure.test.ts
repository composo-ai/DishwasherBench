// The engine-independent distance and penetration measurer, checked against closed-form cases.
import type { Pose, Vec3 } from '@spotless/core';
import { quatFromAxisAngle } from '@spotless/core';
import type { CollisionBox, CollisionCapsule, CollisionHull } from '@spotless/geometry';
import { describe, expect, it } from 'vitest';
import {
  coreDistance,
  coreFromPoints,
  loopDistance,
  measurePenetration,
  pieceDistance,
  segmentSegmentDistance,
} from './measure.ts';
import { makePlate } from './test-shapes.ts';

const HERE: Pose = { p: [0, 0, 0], q: [0, 0, 0, 1] };
const at = (x: number, y: number, z: number): Pose => ({ p: [x, y, z], q: [0, 0, 0, 1] });
const sphere = (radius: number): CollisionCapsule => ({
  kind: 'capsule',
  part: 'ball',
  a: [0, 0, 0],
  b: [0, 0, 0],
  radius,
});

describe('segmentSegmentDistance', () => {
  it('handles crossed, parallel, end-to-end and degenerate segments', () => {
    // Crossed at right angles, 3 apart along z.
    expect(segmentSegmentDistance([-1, 0, 0], [1, 0, 0], [0, -1, 3], [0, 1, 3])).toBeCloseTo(3, 14);
    // Parallel, offset by 2 in y.
    expect(segmentSegmentDistance([0, 0, 0], [5, 0, 0], [1, 2, 0], [4, 2, 0])).toBeCloseTo(2, 14);
    // Collinear with a gap of 1.5 between the facing ends.
    expect(segmentSegmentDistance([0, 0, 0], [1, 0, 0], [2.5, 0, 0], [4, 0, 0])).toBeCloseTo(
      1.5,
      14,
    );
    // End of one beyond the end of the other: a 3-4-5 triangle.
    expect(segmentSegmentDistance([0, 0, 0], [1, 0, 0], [4, 4, 0], [4, 9, 0])).toBeCloseTo(5, 14);
    // Two points, and a point against a segment.
    expect(segmentSegmentDistance([0, 0, 0], [0, 0, 0], [1, 2, 2], [1, 2, 2])).toBeCloseTo(3, 14);
    expect(segmentSegmentDistance([0.5, 2, 0], [0.5, 2, 0], [0, 0, 0], [1, 0, 0])).toBeCloseTo(
      2,
      14,
    );
  });
});

describe('loopDistance and coreDistance', () => {
  const square: Vec3[] = [
    [0, 0, 0],
    [1, 0, 0],
    [1, 1, 0],
    [0, 1, 0],
  ];

  it('measures a point above the inside, an edge and a corner of a polygon', () => {
    expect(loopDistance(square, [[0.5, 0.5, 0.7]])).toBeCloseTo(0.7, 14);
    expect(loopDistance(square, [[1.3, 0.5, 0.4]])).toBeCloseTo(0.5, 14); // 3-4-5 scaled
    expect(loopDistance(square, [[1.2, 1.2, 0.1]])).toBeCloseTo(0.3, 14); // (0.2, 0.2, 0.1)
  });

  it('is zero for a segment that passes through a polygon', () => {
    expect(
      loopDistance(square, [
        [0.5, 0.5, -1],
        [0.5, 0.5, 1],
      ]),
    ).toBe(0);
  });

  it('is zero for a point inside a solid and for overlapping solids', () => {
    const cube = coreFromPoints(
      [0, 1].flatMap((x) => [0, 1].flatMap((y) => [0, 1].map((z): Vec3 => [x, y, z]))),
      0,
    );
    expect(coreDistance(cube, coreFromPoints([[0.5, 0.5, 0.5]], 0))).toBe(0);
    expect(coreDistance(cube, coreFromPoints([[0.5, 0.5, 1.25]], 0))).toBeCloseTo(0.25, 14);
    const shifted = coreFromPoints(
      [0, 1].flatMap((x) => [0, 1].flatMap((y) => [0, 1].map((z): Vec3 => [x + 0.5, y, z]))),
      0,
    );
    expect(coreDistance(cube, shifted)).toBe(0);
  });
});

describe('pieceDistance', () => {
  it('gives centre distance minus radii for two spheres, negative when they overlap', () => {
    expect(pieceDistance(sphere(0.002), HERE, sphere(0.003), at(0.01, 0, 0))).toBeCloseTo(
      0.005,
      15,
    );
    expect(pieceDistance(sphere(0.002), HERE, sphere(0.003), at(0.004, 0, 0))).toBeCloseTo(
      -0.001,
      15,
    );
  });

  it('measures crossed wires', () => {
    const wire = (along: 'x' | 'y', radius: number): CollisionCapsule => ({
      kind: 'capsule',
      part: 'wire',
      a: along === 'x' ? [-0.1, 0, 0] : [0, -0.1, 0],
      b: along === 'x' ? [0.1, 0, 0] : [0, 0.1, 0],
      radius,
    });
    // Axes 4.5 mm apart, radii 2 mm each: 0.5 mm of clearance.
    expect(pieceDistance(wire('x', 0.002), HERE, wire('y', 0.002), at(0, 0, 0.0045))).toBeCloseTo(
      0.0005,
      15,
    );
  });

  it('measures a rounded quad against a sphere over its face, its edge and its corner', () => {
    const r = 0.002;
    const quad: CollisionHull = {
      kind: 'hull',
      part: 'wall',
      radius: r,
      points: [
        [0, 0, 0],
        [0.03, 0, 0],
        [0.03, 0.02, 0],
        [0, 0.02, 0],
      ],
    };
    const ball = sphere(0.001);
    // Over the face, 5 mm up: 5 - 2 - 1 = 2 mm.
    expect(pieceDistance(quad, HERE, ball, at(0.015, 0.01, 0.005))).toBeCloseTo(0.002, 15);
    // Beside an edge: 3 mm out and 4 mm up is 5 mm from the edge.
    expect(pieceDistance(quad, HERE, ball, at(0.033, 0.01, 0.004))).toBeCloseTo(0.002, 15);
    // Off a corner: (2, 3, 6) mm is 7 mm from it.
    expect(pieceDistance(quad, HERE, ball, at(0.032, 0.023, 0.006))).toBeCloseTo(0.004, 15);
    // Pressed 0.4 mm into the face.
    expect(pieceDistance(quad, HERE, ball, at(0.015, 0.01, 0.0026))).toBeCloseTo(-0.0004, 15);
  });

  it('measures a rounded box in any orientation', () => {
    const box: CollisionBox = {
      kind: 'box',
      part: 'board',
      halfExtents: [0.05, 0.02, 0.004],
      radius: 0.001,
      pose: { p: [0, 0, 0], q: [0, 0, 0, 1] },
    };
    const ball = sphere(0.002);
    // Above the top face: 10 - 4 - 1 - 2 = 3 mm.
    expect(pieceDistance(box, HERE, ball, at(0, 0, 0.01))).toBeCloseTo(0.003, 15);
    // The same box turned a quarter turn about x: its thin direction is now y.
    const turned: Pose = { p: [0, 0, 0], q: quatFromAxisAngle([1, 0, 0], Math.PI / 2) };
    expect(pieceDistance(box, turned, ball, at(0, 0.01, 0))).toBeCloseTo(0.003, 12);
    expect(pieceDistance(box, turned, ball, at(0, 0, 0.03))).toBeCloseTo(0.007, 12);
  });

  it('saturates at minus the sum of the radii once the cores intersect', () => {
    expect(pieceDistance(sphere(0.002), HERE, sphere(0.003), HERE)).toBeCloseTo(-0.005, 15);
  });
});

describe('measurePenetration', () => {
  it('finds no overlap between two plates stacked with clearance and the overlap when pressed', () => {
    const plate = makePlate(24);
    // Identical coaxial plates: the upper foot ring (bottom at z = 0) comes down on the lower
    // well (top at z = 8 mm).
    const clear = measurePenetration(
      { pieces: plate.pieces, pose: HERE },
      { pieces: plate.pieces, pose: at(0, 0, 0.0085) },
    );
    expect(clear.depth).toBe(0);
    expect(clear.pieceA).toBe(-1);
    const pressed = measurePenetration(
      { pieces: plate.pieces, pose: HERE },
      { pieces: plate.pieces, pose: at(0, 0, 0.0077) },
    );
    // 0.3 mm of the foot ring is inside the well.
    expect(pressed.depth).toBeCloseTo(0.0003, 9);
    expect(plate.pieces[pressed.pieceA]?.part).toBe('body');
    expect(plate.pieces[pressed.pieceB]?.part).toBe('foot');
  });
});
