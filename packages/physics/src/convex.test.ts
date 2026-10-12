// Convex geometry behind the collision shapes, checked against closed-form values.
import type { Vec3 } from '@spotless/core';
import { v3Add, v3Cross, v3Dot, v3Length, v3Normalise, v3Scale, v3Sub } from '@spotless/core';
import { describe, expect, it } from 'vitest';
import type { CoreEdge, FacetedHull, Point2 } from './convex.ts';
import {
  MITRE_LIMIT,
  chordSag,
  convexHull2,
  coreEdgeKey,
  exposedArc,
  faceLoop,
  facetRoundedHull,
  hullFaces,
  loopWidth,
  mitredCorners,
  pointSetDimension,
} from './convex.ts';
import { testRandom } from './test-shapes.ts';

const DEG = Math.PI / 180;

/** Distance from a point to a segment. */
function pointSegment(p: Vec3, a: Vec3, b: Vec3): number {
  const ab = v3Sub(b, a);
  const t = Math.max(0, Math.min(1, v3Dot(v3Sub(p, a), ab) / v3Dot(ab, ab)));
  return v3Length(v3Sub(p, v3Add(a, v3Scale(ab, t))));
}

function cubeCorners(h: number): Vec3[] {
  const out: Vec3[] = [];
  for (const x of [-h, h]) for (const y of [-h, h]) for (const z of [-h, h]) out.push([x, y, z]);
  return out;
}

function faceted(points: Vec3[], radius: number, sag = 1e-5): FacetedHull {
  const form = facetRoundedHull(points, radius, sag);
  if (form.kind !== 'faceted') throw new Error(`expected a faceted hull, got a ${form.kind}`);
  return form;
}

describe('pointSetDimension', () => {
  it('classifies points, segments, polygons and solids', () => {
    expect(pointSetDimension([[1, 2, 3]]).dim).toBe(0);
    // Points 0.05 micrometre apart are one point (merge distance 0.1 micrometre).
    expect(
      pointSetDimension([
        [1, 2, 3],
        [1 + 5e-8, 2, 3],
      ]).dim,
    ).toBe(0);
    const line = pointSetDimension([
      [0, 0, 0],
      [0.5, 0.5, 0],
      [1, 1, 0],
    ]);
    expect(line.dim).toBe(1);
    if (line.dim === 1) expect(v3Length(v3Sub(line.b, line.a))).toBeCloseTo(Math.SQRT2, 12);
    expect(
      pointSetDimension([
        [0, 0, 0],
        [1, 0, 0],
        [0, 1, 0],
        [1, 1, 0],
      ]).dim,
    ).toBe(2);
    expect(pointSetDimension(cubeCorners(0.01)).dim).toBe(3);
  });

  it('rejects an empty set', () => {
    expect(() => pointSetDimension([])).toThrow(/at least one point/);
  });
});

describe('convexHull2', () => {
  it('returns the corners of a square counter-clockwise, dropping interior and edge points', () => {
    const points: Point2[] = [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
      [1, 1], // inside
      [1, 0], // on an edge
      [2, 1], // on an edge
    ];
    const hull = convexHull2(points);
    expect(hull).toHaveLength(4);
    // Shoelace area: positive (counter-clockwise) and equal to 2 x 2.
    let area = 0;
    for (let i = 0; i < hull.length; i++) {
      const a = hull[i] as Point2;
      const b = hull[(i + 1) % hull.length] as Point2;
      area += (a[0] * b[1] - b[0] * a[1]) / 2;
    }
    expect(area).toBeCloseTo(4, 12);
  });
});

describe('hullFaces and faceLoop', () => {
  it('finds the six faces of a cube with outward normals and loops of four corners', () => {
    const h = 0.01;
    const corners = cubeCorners(h);
    const faces = hullFaces(corners);
    expect(faces).toHaveLength(6);
    for (const face of faces) {
      // An axis-aligned unit normal at distance h.
      expect(Math.max(...face.normal.map(Math.abs))).toBeCloseTo(1, 12);
      expect(face.offset).toBeCloseTo(h, 12);
      const loop = faceLoop(corners, face);
      expect(loop).toHaveLength(4);
      // Counter-clockwise seen from outside: the loop's area vector points along the normal.
      let areaVector: Vec3 = [0, 0, 0];
      for (let i = 0; i < 4; i++) {
        areaVector = v3Add(areaVector, v3Cross(loop[i] as Vec3, loop[(i + 1) % 4] as Vec3));
      }
      expect(v3Dot(areaVector, face.normal) / 2).toBeCloseTo(4 * h * h, 12);
    }
  });
});

describe('loopWidth and chordSag', () => {
  it('gives the short side of a rectangle and the smallest height of a triangle', () => {
    const rect: Vec3[] = [
      [0, 0, 0],
      [0.09, 0, 0],
      [0.09, 0.0004, 0],
      [0, 0.0004, 0],
    ];
    expect(loopWidth(rect)).toBeCloseTo(0.0004, 12);
    // A 3-4-5 triangle: heights 4, 3 and 12/5; the smallest is 2.4.
    const triangle: Vec3[] = [
      [0, 0, 0],
      [3, 0, 0],
      [0, 4, 0],
    ];
    expect(loopWidth(triangle)).toBeCloseTo(2.4, 12);
  });

  it('is the height of an arc over its chord', () => {
    // A half circle of radius r stands r above its chord; a 10 degree arc 0.0038 r.
    expect(chordSag(0.002, Math.PI)).toBeCloseTo(0.002, 15);
    expect(chordSag(0.002, 10 * DEG)).toBeCloseTo(0.002 * (1 - Math.cos(5 * DEG)), 15);
    expect(chordSag(0.002, 0)).toBe(0);
  });
});

describe('facetRoundedHull', () => {
  it('turns coincident points into a sphere and collinear points into a capsule', () => {
    const sphere = facetRoundedHull(
      [
        [1, 2, 3],
        [1, 2, 3],
      ],
      0.004,
      1e-5,
    );
    expect(sphere).toEqual({ kind: 'sphere', centre: [1, 2, 3], radius: 0.004 });
    const capsule = facetRoundedHull(
      [
        [0, 0, 0],
        [0, 0.02, 0],
        [0, 0.05, 0],
      ],
      0.003,
      1e-5,
    );
    expect(capsule.kind).toBe('capsule');
    if (capsule.kind === 'capsule') {
      expect(v3Length(v3Sub(capsule.b, capsule.a))).toBeCloseTo(0.05, 12);
      expect(capsule.radius).toBe(0.003);
    }
  });

  it('turns a flat quad into a prism of the true thickness and four inward-facing edges', () => {
    const r = 0.002;
    const quad: Vec3[] = [
      [0, 0, 0.01],
      [0.03, 0, 0.01],
      [0.03, 0.02, 0.01],
      [0, 0.02, 0.01],
    ];
    const form = faceted(quad, r);
    expect(form.solid).not.toBeNull();
    const prism = form.solid?.points ?? [];
    expect(prism).toHaveLength(8);
    // Every prism corner is exactly r above or below a corner of the quad.
    for (const p of prism) {
      expect(Math.abs(p[2] - 0.01)).toBeCloseTo(r, 12);
      expect(quad.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-12)).toBe(true);
    }
    expect(form.edges).toHaveLength(4);
    const centre: Vec3 = [0.015, 0.01, 0.01];
    for (const edge of form.edges) {
      expect(edge.radius).toBe(r);
      expect(edge.halfAngle).toBeCloseTo(Math.PI / 2, 12);
      // Unit, perpendicular to the edge, in the plane of the quad and pointing at its centre.
      expect(v3Length(edge.inward)).toBeCloseTo(1, 12);
      expect(v3Dot(edge.inward, v3Sub(edge.b, edge.a))).toBeCloseTo(0, 12);
      expect(edge.inward[2]).toBeCloseTo(0, 12);
      expect(v3Dot(edge.inward, v3Sub(centre, edge.a))).toBeGreaterThan(0);
    }
  });

  it('the prism and edge capsules of a flat quad are exactly the rounded quad', () => {
    // Membership in the union against the definition: within r of the quad.
    const r = 0.0025;
    const quad: Vec3[] = [
      [0, 0, 0],
      [0.02, 0.001, 0],
      [0.018, 0.012, 0],
      [0.002, 0.01, 0],
    ];
    const form = faceted(quad, r);
    const inPolygon = (p: Vec3): boolean =>
      quad.every((a, i) => {
        const b = quad[(i + 1) % 4] as Vec3;
        return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= 0;
      });
    const distanceToQuad = (p: Vec3): number => {
      if (inPolygon(p)) return Math.abs(p[2]);
      return Math.min(...quad.map((a, i) => pointSegment(p, a, quad[(i + 1) % 4] as Vec3)));
    };
    const inUnion = (p: Vec3, slack: number): boolean =>
      (inPolygon(p) && Math.abs(p[2]) <= r + slack) ||
      form.edges.some((e) => pointSegment(p, e.a, e.b) <= r + slack);
    const random = testRandom(31);
    let inside = 0;
    for (let i = 0; i < 4000; i++) {
      const p: Vec3 = [
        -0.004 + 0.028 * random(),
        -0.004 + 0.02 * random(),
        -0.004 + 0.008 * random(),
      ];
      const d = distanceToQuad(p);
      // Skip the points within 1e-9 m of the surface, where rounding decides.
      if (Math.abs(d - r) < 1e-9) continue;
      expect(inUnion(p, 0)).toBe(d < r);
      if (d < r) inside++;
    }
    // The sample really did probe both sides of the surface.
    expect(inside).toBeGreaterThan(500);
    expect(inside).toBeLessThan(3500);
  });

  it('leaves a flat that is narrower than the sag allows to its edge capsules', () => {
    // 0.1 mm wide and 90 mm long with r = 0.2 mm: the capsules sag (0.1^2 / (8 x 0.2)) mm =
    // 6.25 micrometres across the flat, below the 10 micrometres accepted here.
    const sliver: Vec3[] = [
      [0, 0, 0],
      [0.09, 0, 0],
      [0.09, 0.0001, 0],
      [0, 0.0001, 0],
    ];
    expect(faceted(sliver, 0.0002, 1e-5).solid).toBeNull();
    expect(faceted(sliver, 0.0002, 1e-5).edges).toHaveLength(4);
    // With a 5 micrometre allowance the flat is kept.
    expect(faceted(sliver, 0.0002, 5e-6).solid).not.toBeNull();
  });

  it('moves each face of a cube out by the radius and reports its twelve edges', () => {
    const h = 0.01;
    const r = 0.003;
    const form = faceted(cubeCorners(h), r);
    const points = form.solid?.points ?? [];
    // Four corners per face, each exactly r from the cube and on a face moved out by r.
    expect(points).toHaveLength(24);
    for (const p of points) {
      const beyond = p.map((x) => Math.max(0, Math.abs(x) - h));
      expect(Math.hypot(beyond[0] ?? 0, beyond[1] ?? 0, beyond[2] ?? 0)).toBeCloseTo(r, 12);
      expect(Math.max(...p.map(Math.abs))).toBeCloseTo(h + r, 12);
    }
    expect(form.edges).toHaveLength(12);
    for (const edge of form.edges) {
      // The cube fills three quarters of the turn around each edge: 135 degrees either side of
      // the inward diagonal.
      expect(edge.halfAngle).toBeCloseTo(135 * DEG, 12);
      const mid = v3Scale(v3Add(edge.a, edge.b), 0.5);
      expect(v3Dot(edge.inward, v3Normalise(mid))).toBeCloseTo(-1, 12);
      expect(v3Length(v3Sub(edge.b, edge.a))).toBeCloseTo(2 * h, 12);
    }
    // The fallback is the plain mitred envelope: the cube grown to h + r.
    const fallback = form.solid?.fallback;
    expect(Array.isArray(fallback)).toBe(true);
    if (Array.isArray(fallback)) {
      expect(fallback).toHaveLength(8);
      for (const p of fallback as Vec3[]) {
        for (const x of p) expect(Math.abs(x)).toBeCloseTo(h + r, 12);
      }
    }
  });

  it('rejects a radius of zero and points that are not finite', () => {
    expect(() => facetRoundedHull(cubeCorners(0.01), 0, 1e-5)).toThrow(/radius above zero/);
    expect(() => facetRoundedHull([[0, 0, Number.NaN]], 0.001, 1e-5)).toThrow(/not finite/);
  });
});

describe('mitredCorners', () => {
  it('cuts the mitre of a knife edge back to the limit', () => {
    // A wedge with a 6 degree edge along y: the exact mitre would be 1 / sin(3 deg) = 19 radii.
    const half = 3 * DEG;
    const wedge: Vec3[] = [];
    for (const y of [0, 0.05]) {
      wedge.push([0, y, 0]);
      wedge.push([0.02, y, 0.02 * Math.tan(half)]);
      wedge.push([0.02, y, -0.02 * Math.tan(half)]);
    }
    const r = 0.0002;
    const corners = mitredCorners(wedge, hullFaces(wedge), r);
    expect(corners).toHaveLength(6);
    const atEdge = corners.filter((p) => p[0] < 0.001);
    expect(atEdge).toHaveLength(2);
    for (const p of atEdge) {
      const from: Vec3 = [0, p[1] < 0.025 ? 0 : 0.05, 0];
      expect(v3Length(v3Sub(p, from))).toBeCloseTo(MITRE_LIMIT * r, 12);
    }
  });
});

describe('exposedArc', () => {
  const a: Vec3 = [0, 0, 0];
  const b: Vec3 = [0, 0.02, 0];
  /** The edge a-b as seen by a flat piece lying in the direction `angle` from +x about y. */
  const flat = (angle: number, radius = 0.002): CoreEdge => ({
    a,
    b,
    radius,
    inward: [Math.cos(angle), 0, Math.sin(angle)],
    halfAngle: Math.PI / 2,
  });

  it('is half a turn for the free edge of one flat piece', () => {
    expect(exposedArc([flat(0)])).toBeCloseTo(Math.PI, 12);
    expect(exposedArc([flat(2.5)])).toBeCloseTo(Math.PI, 12);
  });

  it('is the fold angle where two flat pieces meet', () => {
    for (const foldDeg of [0, 5, 10, 31, 90, 170]) {
      // The second piece continues the first, bent by the fold angle.
      const second = flat(Math.PI - foldDeg * DEG);
      expect(exposedArc([flat(0), second])).toBeCloseTo(foldDeg * DEG, 10);
      // The same edge seen in the other direction, and in the other order, gives the same.
      const reversed: CoreEdge = { ...second, a: b, b: a };
      expect(exposedArc([reversed, flat(0)])).toBeCloseTo(foldDeg * DEG, 10);
    }
  });

  it('is zero when the pieces close around the edge and a quarter turn for a cube', () => {
    expect(exposedArc([flat(0), flat((2 * Math.PI) / 3), flat((4 * Math.PI) / 3)])).toBeCloseTo(
      0,
      12,
    );
    const cube = faceted(cubeCorners(0.01), 0.002);
    for (const edge of cube.edges) expect(exposedArc([edge])).toBeCloseTo(Math.PI / 2, 12);
  });

  it('identifies an edge by its end points in either direction', () => {
    expect(coreEdgeKey(a, b)).toBe(coreEdgeKey(b, a));
    expect(coreEdgeKey(a, [0, 0.02, 1e-9])).toBe(coreEdgeKey(a, b));
    expect(coreEdgeKey(a, [0, 0.021, 0])).not.toBe(coreEdgeKey(a, b));
    expect(coreEdgeKey(a, [1e-9, 0, 0])).toBeNull();
  });
});
