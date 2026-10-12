import {
  POSE_IDENTITY,
  poseTransformPoint,
  quatFromAxisAngle,
  v3Cross,
  v3Dot,
  v3Length,
  v3Sub,
  type Pose,
  type Vec3,
} from '@spotless/core';
import { describe, expect, it } from 'vitest';
import {
  buildCollisionPieces,
  COLLISION_TAPER_FRACTION,
  collisionSolids,
  ROUND_SURFACE_MAX_TURN,
  ROUND_SURFACE_MIN_RADIAL,
  roundSurfacesOf,
  sorCollisionLayout,
} from './collision.ts';
import { buildRenderMesh } from './mesh.ts';
import { signedDistance, signedDistanceGradient } from './sdf.ts';
import { primitiveSignedDistance } from './sdf.ts';
import {
  DOSSIER_PROFILES_MM,
  pieceShape,
  profileMm,
  singlePart,
  surfaceGap,
  testPrimitives,
  testRandom,
} from './test-util.ts';
import {
  COLLISION_CHORD_ERROR,
  ROUND_SURFACE_DEFICIT,
  type CollisionRound,
  type CollisionSolid,
  type Primitive,
  type Shape,
  type SorPrimitive,
  type SorProfilePoint,
  type TessellationOptions,
} from './types.ts';

const E = COLLISION_CHORD_ERROR;

/** The solid pieces of a shape: what all tests but those of the round surfaces are about. */
function solidPieces(shape: Shape, options: TessellationOptions): CollisionSolid[] {
  return collisionSolids(buildCollisionPieces(shape, options));
}

function sor(
  points: readonly (readonly [number, number, number])[],
  extra: Partial<SorPrimitive> = {},
): SorPrimitive {
  return { kind: 'sor', profile: profileMm(points), ...extra };
}

describe('collision pieces: counts follow the platform rule', () => {
  it('N = max(minSectors, ceil(pi / acos(1 - e / R))) sectors per profile segment of constant thickness', () => {
    // docs/research/items.md 5.3 tabulates 37 sectors for R = 135 mm at 0.5 mm; the other values
    // are the same formula evaluated for the profile's largest mid-surface radius.
    const cases: [keyof typeof DOSSIER_PROFILES_MM, number, number][] = [
      ['plate270', 135, 37],
      ['plateIec', 130, 36],
      ['bowl160', 80, 29],
      ['lid', 118, 35],
    ];
    for (const [key, radiusMm, sectors] of cases) {
      expect(Math.max(16, Math.ceil(Math.PI / Math.acos(1 - 0.5 / radiusMm)))).toBe(sectors);
      const prim = sor(DOSSIER_PROFILES_MM[key]);
      const pieces = solidPieces(singlePart(prim), { chordError: E });
      const segments = prim.profile.length - 1;
      // One piece per sector and segment, but the flat floor (the first segment of the three
      // tableware profiles; the lid is a dome and has none) is a single piece.
      const floors = key === 'lid' ? 0 : 1;
      expect(pieces).toHaveLength(sectors * (segments - floors) + floors);
      const layout = sorCollisionLayout(prim, { chordError: E });
      expect(layout.sectorsPerTurn).toBe(sectors);
      expect(layout.rows).toHaveLength(segments);
      expect(layout.pieces).toBe(pieces.length);
      if (floors === 1) {
        // The floor: the rounded polygon of its outer ring, as thick as the wall.
        const floor = pieces[0];
        if (floor?.kind !== 'hull') throw new Error('expected the floor first');
        expect(floor.points).toHaveLength(sectors);
        const ring = (prim.profile[1] as SorProfilePoint).r;
        for (const p of floor.points) expect(Math.hypot(p[0], p[1])).toBeCloseTo(ring, 14);
        expect(floor.radius).toBe((prim.profile[0] as SorProfilePoint).t / 2);
      }
    }
  });

  it('small shells fall back to minSectors (default 16), which can be overridden', () => {
    const ring = sor([
      [10, 2, 2],
      [10, 8, 2],
    ]);
    expect(solidPieces(singlePart(ring), { chordError: E })).toHaveLength(16);
    expect(solidPieces(singlePart(ring), { chordError: E, minSectors: 24 })).toHaveLength(24);
  });

  it('a wall of varying thickness is cut into rows: ceil(change of half thickness / chordError)', () => {
    // Picardie tumbler: 7 mm base, 4 mm then 3 mm wall. R = 43.5 mm gives 21 sectors.
    const prim = sor(DOSSIER_PROFILES_MM.tumbler);
    const layout = sorCollisionLayout(prim, { chordError: E });
    expect(layout.sectorsPerTurn).toBe(Math.ceil(Math.PI / Math.acos(1 - 0.5 / 43.5)));
    const perSegment = [0, 0, 0, 0];
    for (const row of layout.rows)
      perSegment[row.segment] = (perSegment[row.segment] as number) + 1;
    // Segment 1 runs from half thickness 3.5 mm to 2 mm: a change of 1.5 mm, hence
    // ceil(1.5 / (2 * 0.5 * 0.5)) = 3 rows with radii 3.25, 2.75 and 2.25 mm. Segment 2 changes by
    // 0.5 mm: one row at 1.75 mm.
    expect(COLLISION_TAPER_FRACTION).toBe(0.5);
    expect(perSegment).toEqual([1, 3, 1, 1]);
    const pieces = solidPieces(singlePart(prim), { chordError: E });
    expect(pieces).toHaveLength(layout.pieces);
    const radii = layout.rows.map((r) => r.radius);
    const expected = [0.0035, 0.00325, 0.00275, 0.00225, 0.00175, 0.0015];
    expect(radii).toHaveLength(expected.length);
    radii.forEach((r, i) => expect(r).toBeCloseTo(expected[i] as number, 15));
  });

  it('a partial shell gets ceil(N * span / 2 pi) sectors', () => {
    const fillet = sor(
      [
        [0, 1, 2],
        [19, 1, 2],
        [19, 40, 2],
      ],
      { arc: [0, Math.PI / 2] },
    );
    const layout = sorCollisionLayout(fillet, { chordError: E });
    expect(layout.sectorsPerTurn).toBe(16);
    expect(layout.sectors).toBe(4);
    // Four sectors of wall, and the quarter disc of the floor as one piece of 6 points (the
    // axis point and the five ring points of four sectors).
    const pieces = solidPieces(singlePart(fillet), { chordError: E });
    expect(pieces).toHaveLength(5);
    expect(layout.pieces).toBe(5);
    const floor = pieces[0];
    if (floor?.kind !== 'hull') throw new Error('expected the floor first');
    expect(floor.points).toHaveLength(6);
  });

  it('a stretch of wall on the axis is a single capsule', () => {
    const pieces = solidPieces(
      singlePart(
        sor([
          [0, 4, 8],
          [0, 30, 8],
          [20, 30, 8],
        ]),
      ),
      { chordError: E },
    );
    // The capsule, and the flat top out to r = 20 mm as one disc of 16 points.
    expect(pieces).toHaveLength(1 + 1);
    expect(pieces[1]).toMatchObject({ kind: 'hull', radius: 0.004 });
    expect(pieces[0]).toMatchObject({
      kind: 'capsule',
      a: [0, 0, 0.004],
      b: [0, 0, 0.03],
      radius: 0.004,
    });
  });
});

describe('collision pieces: shape of the pieces', () => {
  it('every shell piece is a planar convex polygon (a quad, a triangle at the axis, or the floor) with radius t / 2', () => {
    for (const key of ['plateIec', 'bowl160', 'mug', 'wineBowl'] as const) {
      const prim = sor(DOSSIER_PROFILES_MM[key]);
      const pose: Pose = { p: [0.1, 0.2, 0.3], q: quatFromAxisAngle([1, 1, 0], 0.9) };
      const pieces = solidPieces(singlePart(prim, pose), { chordError: E });
      const thickness = prim.profile.map((p) => p.t);
      for (const piece of pieces) {
        if (piece.kind !== 'hull') throw new Error(`unexpected ${piece.kind} piece`);
        expect(piece.radius).toBeGreaterThanOrEqual(Math.min(...thickness) / 2 - 1e-15);
        expect(piece.radius).toBeLessThanOrEqual(Math.max(...thickness) / 2 + 1e-15);
        const pts = piece.points;
        // A flat floor that reaches the axis is one polygon of as many points as there are
        // sectors; everything else is a quad, or a triangle where a sloping wall starts on
        // the axis.
        const isFloor = piece === pieces[0] && key !== 'wineBowl';
        expect(isFloor ? pts.length >= 16 : pts.length === 3 || pts.length === 4).toBe(true);
        const p0 = pts[0] as Vec3;
        const normal = v3Cross(v3Sub(pts[1] as Vec3, p0), v3Sub(pts[2] as Vec3, p0));
        const scale = v3Length(normal);
        expect(scale).toBeGreaterThan(0);
        // Planar: every point within 1e-12 m of the plane of the first three.
        for (const p of pts)
          expect(Math.abs(v3Dot(v3Sub(p, p0), normal)) / scale).toBeLessThanOrEqual(1e-12);
        // Convex and not self-intersecting: every corner turns the same way.
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i] as Vec3;
          const b = pts[(i + 1) % pts.length] as Vec3;
          const c = pts[(i + 2) % pts.length] as Vec3;
          expect(v3Dot(v3Cross(v3Sub(b, a), v3Sub(c, b)), normal)).toBeGreaterThan(0);
        }
      }
    }
  });

  it('constant-thickness shells use exactly t / 2', () => {
    const prim = sor(DOSSIER_PROFILES_MM.plateIec);
    const pieces = solidPieces(singlePart(prim), { chordError: E });
    for (const piece of collisionSolids(pieces)) {
      expect(piece.radius).toBe((prim.profile[0]?.t ?? 0) / 2);
    }
  });

  it('carries the part id and material, and is deterministic', () => {
    const shape: Shape = {
      parts: [
        {
          id: 'body',
          prim: sor(DOSSIER_PROFILES_MM.mug),
          pose: POSE_IDENTITY,
          material: 'porcelain_glazed',
        },
        {
          id: 'handle.0',
          prim: { kind: 'capsule', a: [0.05, 0, 0.03], b: [0.07, 0, 0.03], radius: 0.004 },
          pose: POSE_IDENTITY,
          material: 'porcelain_glazed',
        },
        {
          id: 'foot',
          prim: sor([
            [30, 1, 2],
            [32, 1, 2],
          ]),
          pose: POSE_IDENTITY,
          material: 'porcelain_unglazed',
        },
      ],
      regions: [],
    };
    const first = solidPieces(shape, { chordError: E });
    const second = solidPieces(shape, { chordError: E });
    expect(second).toEqual(first);
    // Parts in shape order.
    const parts = first.map((p) => p.part);
    expect(parts.indexOf('handle.0')).toBe(parts.lastIndexOf('body') + 1);
    expect(parts.indexOf('foot')).toBe(parts.indexOf('handle.0') + 1);
    for (const piece of first) {
      expect(piece.material).toBe(
        piece.part === 'foot' ? 'porcelain_unglazed' : 'porcelain_glazed',
      );
    }
    // Within a shell: the first piece is the flat base, the polygon of its outer ring, which
    // starts at azimuth 0 (+x) and goes round by increasing azimuth.
    const firstPiece = first[0];
    if (firstPiece === undefined || firstPiece.kind !== 'hull') throw new Error('expected a hull');
    expect(firstPiece.points).toHaveLength(20);
    expect(firstPiece.points[0]).toEqual([0.036, 0, 0.0025]);
    expect((firstPiece.points[1] as Vec3)[1]).toBeCloseTo(0.036 * Math.sin((2 * Math.PI) / 20), 15);
    expect((firstPiece.points[1] as Vec3)[0]).toBeCloseTo(0.036 * Math.cos((2 * Math.PI) / 20), 15);
    // The second is the first sector of the wall above it.
    const second2 = first[1];
    if (second2 === undefined || second2.kind !== 'hull') throw new Error('expected a hull');
    expect(second2.points).toHaveLength(4);
    expect(second2.points[0]).toEqual([0.036, 0, 0.0025]);
  });

  it('capsules, boxes and hulls map directly, in the item frame', () => {
    const pose: Pose = { p: [0.1, -0.2, 0.05], q: quatFromAxisAngle([0, 0, 1], Math.PI / 2) };
    const shape: Shape = {
      parts: [
        {
          id: 'c',
          prim: { kind: 'capsule', a: [0.01, 0, 0], b: [0.03, 0, 0], radius: 0.002 },
          pose,
          material: 'steel',
        },
        {
          id: 'b',
          prim: { kind: 'rbox', halfExtents: [0.03, 0.02, 0.001], radius: 0.003 },
          pose,
          material: 'pp',
        },
        {
          id: 'h',
          prim: {
            kind: 'hull',
            points: [
              [0, 0, 0],
              [0.02, 0, 0],
              [0, 0.01, 0],
              [0.005, 0.002, 0],
            ],
            radius: 0.001,
          },
          pose,
          material: 'steel',
        },
        {
          id: 's',
          prim: {
            kind: 'hull',
            points: [
              [0, 0, 0],
              [0.02, 0, 0],
              [0.01, 0, 0],
            ],
            radius: 0.001,
          },
          pose,
          material: 'steel',
        },
      ],
      regions: [],
    };
    const [capsule, box, hull, segment] = solidPieces(shape, { chordError: E });
    if (
      capsule?.kind !== 'capsule' ||
      box?.kind !== 'box' ||
      hull?.kind !== 'hull' ||
      segment?.kind !== 'capsule'
    ) {
      throw new Error('unexpected piece kinds');
    }
    // A quarter turn about z maps (x, y, z) to (-y, x, z).
    expect(v3Length(v3Sub(capsule.a, [0.1, -0.19, 0.05]))).toBeLessThanOrEqual(1e-15);
    expect(v3Length(v3Sub(capsule.b, [0.1, -0.17, 0.05]))).toBeLessThanOrEqual(1e-15);
    expect(capsule.radius).toBe(0.002);
    expect(box.halfExtents).toEqual([0.03, 0.02, 0.001]);
    expect(box.radius).toBe(0.003);
    expect(box.pose).toEqual(pose);
    // The interior point of the flat hull is dropped; the three corners remain.
    expect(hull.points).toHaveLength(3);
    expect(hull.radius).toBe(0.001);
    for (const p of hull.points) expect(Math.abs(p[2] - 0.05)).toBeLessThanOrEqual(1e-15);
    // Collinear points are a capsule between the extremes.
    expect(v3Length(v3Sub(segment.b, segment.a))).toBeCloseTo(0.02, 15);
  });
});

describe('collision pieces: the union follows the true surface', () => {
  it('constant thickness: within the chord error both ways (plate, bowl, wine glass bowl, lid, cone, ring)', () => {
    for (const name of ['plate', 'bowl', 'lid', 'cone', 'ring'] as const) {
      const prim = testPrimitives()[name] as Primitive;
      const shape = singlePart(prim);
      const pieces = solidPieces(shape, { chordError: E });
      const gap = surfaceGap(shape, pieces);
      expect(gap.samples).toBeGreaterThan(200);
      expect(gap.piecesToTrue, name).toBeLessThanOrEqual(E + 1e-6);
      expect(gap.trueToPieces, name).toBeLessThanOrEqual(E + 1e-6);
    }
  });

  it('the actual gap of a plate is its sagitta R (1 - cos(pi / N)), reached at the rim', () => {
    const prim = sor(DOSSIER_PROFILES_MM.plateIec);
    const shape = singlePart(prim);
    const gap = surfaceGap(shape, solidPieces(shape, { chordError: E }));
    const sagitta = 0.13 * (1 - Math.cos(Math.PI / 36));
    expect(sagitta).toBeLessThan(E);
    expect(gap.piecesToTrue).toBeLessThanOrEqual(sagitta + 1e-6);
    expect(gap.piecesToTrue).toBeGreaterThanOrEqual(0.9 * sagitta);
  });

  it('varying thickness: within chordError * (1 + taper fraction) both ways (tumbler, pint, wine bowl, mug)', () => {
    for (const key of ['tumbler', 'pint', 'wineBowl', 'mug'] as const) {
      const shape = singlePart(sor(DOSSIER_PROFILES_MM[key]));
      const gap = surfaceGap(shape, solidPieces(shape, { chordError: E }));
      const bound = E * (1 + COLLISION_TAPER_FRACTION) + 1e-6;
      expect(gap.piecesToTrue, key).toBeLessThanOrEqual(bound);
      expect(gap.trueToPieces, key).toBeLessThanOrEqual(bound);
    }
  });

  it('a finer chord error tightens the fit in proportion (0.1 mm)', () => {
    const shape = singlePart(sor(DOSSIER_PROFILES_MM.bowl160));
    const gap = surfaceGap(shape, solidPieces(shape, { chordError: 0.0001 }));
    expect(gap.piecesToTrue).toBeLessThanOrEqual(0.0001 + 1e-6);
    expect(gap.trueToPieces).toBeLessThanOrEqual(0.0001 + 1e-6);
  });

  it('stretched shell: within the chord error plus t / 2 * |s - 1| (documented rim approximation)', () => {
    const prim = testPrimitives().oval as SorPrimitive;
    const shape = singlePart(prim);
    const gap = surfaceGap(shape, solidPieces(shape, { chordError: E }));
    const bound = E + 0.0015 * 0.3 + 1e-6;
    expect(gap.piecesToTrue).toBeLessThanOrEqual(bound);
    expect(gap.trueToPieces).toBeLessThanOrEqual(bound);
  });

  it('partial shell: within the chord error, except that the end pieces reach t / 2 past the end faces', () => {
    const prim = testPrimitives().fillet as SorPrimitive;
    const shape = singlePart(prim);
    const gap = surfaceGap(shape, solidPieces(shape, { chordError: E }));
    // The exact solid is covered: its surface is never further than the chord error from the union.
    expect(gap.trueToPieces).toBeLessThanOrEqual(E + 1e-6);
    // The union overshoots only by the rounding of the end pieces (t / 2 = 1 mm).
    expect(gap.piecesToTrue).toBeLessThanOrEqual(0.001 + 1e-6);
    expect(gap.piecesToTrue).toBeGreaterThan(E);
  });

  it('random tapering profiles: within 1.5 chord errors both ways, piece count as laid out', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const rnd = testRandom(1000 + seed);
      const profile: SorProfilePoint[] = [];
      let r = seed % 2 === 0 ? 0 : rnd.range(0.004, 0.02);
      let z = rnd.range(0.002, 0.01);
      let heading = rnd.range(-0.2, 0.4);
      const count = 3 + Math.floor(rnd.next() * 3);
      for (let i = 0; i < count; i++) {
        profile.push({ r, z, t: rnd.range(0.0015, 0.006) });
        const length = rnd.range(0.015, 0.05);
        heading = Math.min(1.6, Math.max(-0.2, heading + rnd.range(-0.2, 0.8)));
        r = Math.max(0.003, r + length * Math.cos(heading));
        z += length * Math.sin(heading);
      }
      const prim: SorPrimitive = { kind: 'sor', profile };
      const shape = singlePart(prim);
      const pieces = solidPieces(shape, { chordError: E });
      const layout = sorCollisionLayout(prim, { chordError: E });
      expect(pieces).toHaveLength(layout.pieces);
      const gap = surfaceGap(shape, pieces);
      const bound = E * (1 + COLLISION_TAPER_FRACTION) + 1e-6;
      expect(gap.piecesToTrue, `seed ${seed}`).toBeLessThanOrEqual(bound);
      expect(gap.trueToPieces, `seed ${seed}`).toBeLessThanOrEqual(bound);
    }
  }, 60000);

  it('pieces follow the part pose', () => {
    const prim = sor(DOSSIER_PROFILES_MM.mug);
    const pose: Pose = { p: [0.2, 0.1, -0.05], q: quatFromAxisAngle([1, 0, 1], 1.1) };
    const plain = solidPieces(singlePart(prim), { chordError: E });
    const posed = solidPieces(singlePart(prim, pose), { chordError: E });
    expect(posed).toHaveLength(plain.length);
    for (let i = 0; i < plain.length; i++) {
      const a = plain[i];
      const b = posed[i];
      if (a?.kind !== 'hull' || b?.kind !== 'hull') throw new Error('expected hulls');
      for (let k = 0; k < a.points.length; k++) {
        expect(
          v3Length(v3Sub(poseTransformPoint(pose, a.points[k] as Vec3), b.points[k] as Vec3)),
        ).toBeLessThanOrEqual(1e-15);
      }
    }
  });

  it('each piece on its own is the rounded quad the signed distance of a hull describes', () => {
    // A point at height h above the middle of a wall quad is h - t / 2 from the piece.
    const pieces = solidPieces(
      singlePart(
        sor([
          [40, 0, 4],
          [40, 60, 4],
        ]),
      ),
      { chordError: E },
    );
    const piece = pieces[0];
    if (piece?.kind !== 'hull') throw new Error('expected a hull');
    const centre: Vec3 = [0, 0, 0].map(
      (_, k) => piece.points.reduce((s, p) => s + (p[k] as number), 0) / 4,
    ) as unknown as Vec3;
    const normal = v3Cross(
      v3Sub(piece.points[1] as Vec3, piece.points[0] as Vec3),
      v3Sub(piece.points[3] as Vec3, piece.points[0] as Vec3),
    );
    const n = v3Length(normal);
    const p: Vec3 = [
      centre[0] + (0.01 * normal[0]) / n,
      centre[1] + (0.01 * normal[1]) / n,
      centre[2] + (0.01 * normal[2]) / n,
    ];
    expect(primitiveSignedDistance(pieceShape(piece).prim, p)).toBeCloseTo(0.01 - 0.002, 14);
  });
});

describe('round rolling surfaces of shells of revolution', () => {
  /** A point of the side of a round surface: `u` along it from a to b, at the azimuth `phi`. */
  function sidePoint(round: CollisionRound, u: number, phi: number): Vec3 {
    // The tests below use unposed parts, whose axis is +z through the origin.
    const r = round.radiusA + u * (round.radiusB - round.radiusA);
    const z = round.a[2] + u * (round.b[2] - round.a[2]);
    return [r * Math.cos(phi), r * Math.sin(phi), z];
  }
  /** Outward normal of the side in the meridian plane: [radial, axial]. */
  function sideNormal(round: CollisionRound): [number, number] {
    const height = round.b[2] - round.a[2];
    const slant = Math.hypot(height, round.radiusB - round.radiusA);
    return [height / slant, -(round.radiusB - round.radiusA) / slant];
  }
  const names = ['plateIec', 'plate270', 'bowl160', 'tumbler', 'wineBowl', 'lid', 'mug'] as const;
  const profiles = names.filter(
    (name) => name in DOSSIER_PROFILES_MM,
  ) as readonly (keyof typeof DOSSIER_PROFILES_MM)[];

  it('lie on the true surface: exactly along straight walls, within 0.05 mm along rims and joins', () => {
    expect(ROUND_SURFACE_DEFICIT).toBe(0.00005);
    let surfaces = 0;
    for (const name of profiles) {
      const shape = singlePart(sor(DOSSIER_PROFILES_MM[name]));
      const part = shape.parts[0];
      if (part === undefined) throw new Error('no part');
      for (const round of roundSurfacesOf(part)) {
        surfaces++;
        expect(round.a[0]).toBe(0);
        expect(round.a[1]).toBe(0);
        expect(round.b[2]).toBeGreaterThan(round.a[2]);
        for (const phi of [0, 1.1, 2.9, 4.4]) {
          // The two end circles are on the surface (the kernel's signed distance is exact
          // outside an unscaled full shell and its zero set is exact).
          expect(Math.abs(signedDistance(shape, sidePoint(round, 0, phi)))).toBeLessThan(1e-9);
          expect(Math.abs(signedDistance(shape, sidePoint(round, 1, phi)))).toBeLessThan(1e-9);
          // In between, the side is on the surface (a straight wall) or a chord just inside it.
          for (const u of [0.25, 0.5, 0.75]) {
            const d = signedDistance(shape, sidePoint(round, u, phi));
            expect(d).toBeLessThan(1e-9);
            expect(d).toBeGreaterThan(-ROUND_SURFACE_DEFICIT - 1e-9);
          }
        }
        // It faces away from the axis, within 60 degrees (less the half turn of a chord).
        const [radial] = sideNormal(round);
        expect(radial).toBeGreaterThan(
          Math.cos(Math.acos(ROUND_SURFACE_MIN_RADIAL) + ROUND_SURFACE_MAX_TURN / 2) - 1e-9,
        );
      }
    }
    expect(surfaces).toBeGreaterThan(20);
  });

  it('cover every part of the outer surface that faces away from the axis', () => {
    // Independent reference: the vertices of a fine render mesh, with the gradient of the
    // signed distance as normal. Every vertex whose normal is within 55 degrees of the radial
    // direction must be within 0.05 mm (plus the 0.02 mm of the mesh) of the side of a round
    // surface, measured in the meridian plane.
    for (const name of profiles) {
      const shape = singlePart(sor(DOSSIER_PROFILES_MM[name]));
      const part = shape.parts[0];
      if (part === undefined) throw new Error('no part');
      const rounds = roundSurfacesOf(part);
      const mesh = buildRenderMesh(shape, { chordError: 0.00002 });
      let checked = 0;
      for (let v = 0; v < mesh.positions.length / 3; v += 7) {
        const p: Vec3 = [
          mesh.positions[3 * v] as number,
          mesh.positions[3 * v + 1] as number,
          mesh.positions[3 * v + 2] as number,
        ];
        const rho = Math.hypot(p[0], p[1]);
        if (rho < 1e-4) continue;
        const g = signedDistanceGradient(shape, p);
        const radial = (g[0] * p[0] + g[1] * p[1]) / rho;
        if (radial < Math.cos((55 * Math.PI) / 180)) continue;
        let nearest = Infinity;
        for (const round of rounds) {
          // Distance from (rho, z) to the generator segment of the surface.
          const ar = round.radiusA;
          const az = round.a[2];
          const dr = round.radiusB - ar;
          const dz = round.b[2] - az;
          const t = Math.max(
            0,
            Math.min(1, ((rho - ar) * dr + (p[2] - az) * dz) / (dr * dr + dz * dz)),
          );
          nearest = Math.min(nearest, Math.hypot(rho - ar - t * dr, p[2] - az - t * dz));
        }
        expect(nearest, `${name} at rho ${rho}, z ${p[2]}`).toBeLessThan(
          ROUND_SURFACE_DEFICIT + 0.00003,
        );
        checked++;
      }
      expect(checked, name).toBeGreaterThan(50);
    }
  });

  it('a straight tumbler wall is one cone on the outer face, with the thickness of the wall', () => {
    // A cone frustum wall 2 mm thick from r 30 mm at z 5 mm to r 40 mm at z 105 mm: the outer
    // face is the mid-surface moved 1 mm along its normal (100, -10) / |..|.
    const prim = sor([
      [0, 5, 2],
      [30, 5, 2],
      [40, 105, 2],
    ]);
    const rounds = roundSurfacesOf(singlePart(prim).parts[0] as Shape['parts'][number]);
    const slant = Math.hypot(10, 100);
    const wall = rounds.find((r) => Math.abs(r.b[2] - r.a[2] - 0.1) < 1e-3);
    expect(wall).toBeDefined();
    expect(wall?.radiusA).toBeCloseTo(0.03 + (0.001 * 100) / slant, 12);
    expect(wall?.a[2]).toBeCloseTo(0.005 - (0.001 * 10) / slant, 12);
    expect(wall?.radiusB).toBeCloseTo(0.04 + (0.001 * 100) / slant, 12);
    expect(wall?.b[2]).toBeCloseTo(0.105 - (0.001 * 10) / slant, 12);
    expect(wall?.wallThickness).toBe(0.002);
    // The inner face of the wall faces the axis and gets none: no surface is narrower than the
    // mid-surface at its own height.
    for (const round of rounds) {
      for (const [r, z] of [
        [round.radiusA, round.a[2]],
        [round.radiusB, round.b[2]],
      ] as const) {
        if (z > 0.006 && z < 0.104) expect(r).toBeGreaterThan(0.03 + ((z - 0.005) / 0.1) * 0.01);
      }
    }
  });

  it('are emitted after the hulls of their part, carry its id and material, and follow its pose', () => {
    const prim = sor(DOSSIER_PROFILES_MM.tumbler);
    const pose: Pose = { p: [0.1, -0.2, 0.3], q: quatFromAxisAngle([1, 0, 0], Math.PI / 2) };
    const shape: Shape = {
      parts: [{ id: 'glass', prim, pose, material: 'glass_soda_lime' }],
      regions: [],
    };
    const pieces = buildCollisionPieces(shape, { chordError: E });
    const rounds = pieces.filter((piece): piece is CollisionRound => piece.kind === 'round');
    const plain = roundSurfacesOf(singlePart(prim).parts[0] as Shape['parts'][number]);
    expect(rounds.length).toBe(plain.length);
    expect(rounds.length).toBeGreaterThan(0);
    // After every solid piece of the part.
    expect(pieces.slice(0, pieces.length - rounds.length).every((p) => p.kind !== 'round')).toBe(
      true,
    );
    rounds.forEach((round, i) => {
      const reference = plain[i] as CollisionRound;
      expect(round.part).toBe('glass');
      expect(round.material).toBe('glass_soda_lime');
      const a = poseTransformPoint(pose, reference.a);
      const b = poseTransformPoint(pose, reference.b);
      for (let k = 0; k < 3; k++) {
        expect(round.a[k]).toBeCloseTo(a[k] as number, 14);
        expect(round.b[k]).toBeCloseTo(b[k] as number, 14);
      }
      expect(round.radiusA).toBe(reference.radiusA);
      expect(round.radiusB).toBe(reference.radiusB);
    });
    // The solid is the same with and without them.
    expect(collisionSolids(pieces)).toEqual(
      buildCollisionPieces(shape, { chordError: E, roundSurfaces: false }),
    );
  });

  it('are not given to shells that are not round, nor to other primitives', () => {
    const profile = DOSSIER_PROFILES_MM.bowl160;
    const none: Primitive[] = [
      sor(profile, { scaleXY: [1.3, 1] }),
      sor(profile, { arc: [0, Math.PI] }),
      { kind: 'capsule', a: [0, 0, 0], b: [0, 0, 0.1], radius: 0.003 },
      { kind: 'rbox', halfExtents: [0.01, 0.02, 0.03], radius: 0.001 },
    ];
    for (const prim of none) {
      const shape = singlePart(prim);
      expect(roundSurfacesOf(shape.parts[0] as Shape['parts'][number])).toEqual([]);
      expect(
        buildCollisionPieces(shape, { chordError: E }).some((piece) => piece.kind === 'round'),
      ).toBe(false);
    }
    // A wall thinner than 0.3 mm gets none either.
    const foil = sor([
      [0, 0, 0.2],
      [30, 0, 0.2],
      [30, 50, 0.2],
    ]);
    expect(roundSurfacesOf(singlePart(foil).parts[0] as Shape['parts'][number])).toEqual([]);
  });
});
