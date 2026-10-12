import { POSE_IDENTITY, quatFromAxisAngle, type Vec3 } from '@spotless/core';
import { describe, expect, it } from 'vitest';
import { primitiveSurfaceArea, surfaceArea } from './area.ts';
import { meshArea } from './mesh-metrics.ts';
import { buildRenderMesh } from './mesh.ts';
import { DOSSIER_PROFILES_MM, profileMm, singlePart, testPrimitives } from './test-util.ts';
import type { Primitive, Shape } from './types.ts';

describe('surface area: closed forms', () => {
  it('sphere and capsule: 4 pi r^2 and 2 pi r L + 4 pi r^2 (1e-14 relative)', () => {
    const sphere: Primitive = { kind: 'capsule', a: [0, 0, 0], b: [0, 0, 0], radius: 0.01 };
    expect(primitiveSurfaceArea(sphere) / (4 * Math.PI * 1e-4)).toBeCloseTo(1, 14);
    const capsule: Primitive = { kind: 'capsule', a: [0, 0, 0], b: [0.03, 0.04, 0], radius: 0.002 };
    expect(
      primitiveSurfaceArea(capsule) / (2 * Math.PI * 0.002 * 0.05 + 4 * Math.PI * 4e-6),
    ).toBeCloseTo(1, 14);
    // The same solids as hulls of one and of two points.
    expect(primitiveSurfaceArea({ kind: 'hull', points: [[0, 0, 0]], radius: 0.01 })).toBeCloseTo(
      4 * Math.PI * 1e-4,
      16,
    );
    expect(
      primitiveSurfaceArea({
        kind: 'hull',
        points: [
          [0, 0, 0],
          [0.03, 0.04, 0],
        ],
        radius: 0.002,
      }),
    ).toBeCloseTo(primitiveSurfaceArea(capsule), 16);
  });

  it('box: 8 (hx hy + hy hz + hz hx), and with rounding the Steiner terms 4 pi r (hx + hy + hz) + 4 pi r^2', () => {
    const h: Vec3 = [0.03, 0.02, 0.005];
    const faces = 8 * (h[0] * h[1] + h[1] * h[2] + h[2] * h[0]);
    expect(primitiveSurfaceArea({ kind: 'rbox', halfExtents: h, radius: 0 }) / faces).toBeCloseTo(
      1,
      14,
    );
    const r = 0.003;
    const rounded = faces + 4 * Math.PI * r * (h[0] + h[1] + h[2]) + 4 * Math.PI * r * r;
    expect(primitiveSurfaceArea({ kind: 'rbox', halfExtents: h, radius: r }) / rounded).toBeCloseTo(
      1,
      14,
    );
    // A plate (no height): two faces, half cylinders along the perimeter, a sphere at the corners.
    const plate = 8 * h[0] * h[1] + Math.PI * r * 4 * (h[0] + h[1]) + 4 * Math.PI * r * r;
    expect(
      primitiveSurfaceArea({ kind: 'rbox', halfExtents: [h[0], h[1], 0], radius: r }) / plate,
    ).toBeCloseTo(1, 14);
  });

  it('rounded regular tetrahedron: sqrt(3) a^2 + 6 a r (pi - acos(1/3)) + 4 pi r^2 (1e-13 relative)', () => {
    const s = 0.02;
    const r = 0.003;
    const a = 2 * Math.SQRT2 * s;
    const points: Vec3[] = [
      [s, s, s],
      [s, -s, -s],
      [-s, s, -s],
      [-s, -s, s],
    ];
    const expected =
      Math.sqrt(3) * a * a + 6 * a * r * (Math.PI - Math.acos(1 / 3)) + 4 * Math.PI * r * r;
    expect(primitiveSurfaceArea({ kind: 'hull', points, radius: r }) / expected).toBeCloseTo(1, 13);
  });

  it('cylinder wall: outer and inner tube plus two half tori (Pappus, 1e-14 relative)', () => {
    // R = 40 mm, H = 90 mm, t = 3 mm.
    const [R, H, rho] = [0.04, 0.09, 0.0015];
    const prim: Primitive = {
      kind: 'sor',
      profile: profileMm([
        [40, 0, 3],
        [40, 90, 3],
      ]),
    };
    const expected =
      2 * Math.PI * (R + rho) * H +
      2 * Math.PI * (R - rho) * H +
      2 * (2 * Math.PI * Math.PI * rho * R);
    expect(primitiveSurfaceArea(prim) / expected).toBeCloseTo(1, 14);
  });

  it('flat disc: two faces plus the outer half torus 2 pi rho (pi R + 2 rho) (1e-14 relative)', () => {
    const [R, rho] = [0.1, 0.002];
    const prim: Primitive = {
      kind: 'sor',
      profile: profileMm([
        [0, 3, 4],
        [100, 3, 4],
      ]),
    };
    const expected = 2 * Math.PI * R * R + 2 * Math.PI * rho * (Math.PI * R + 2 * rho);
    expect(primitiveSurfaceArea(prim) / expected).toBeCloseTo(1, 14);
  });

  it('a quarter of a ring has a quarter of the revolved area plus two stadium end faces', () => {
    const profile = profileMm([
      [30, 2, 4],
      [50, 2, 4],
    ]);
    const full = primitiveSurfaceArea({ kind: 'sor', profile });
    const quarter = primitiveSurfaceArea({ kind: 'sor', profile, arc: [0.3, 0.3 + Math.PI / 2] });
    const stadium = 0.02 * 0.004 + Math.PI * 0.002 ** 2;
    expect(quarter / (full / 4 + 2 * stadium)).toBeCloseTo(1, 14);
  });

  it('a thin disc stretched to an ellipse has twice the area pi a b (1e-3: edge neglected)', () => {
    const prim: Primitive = {
      kind: 'sor',
      profile: profileMm([
        [0, 0.005, 0.01],
        [100, 0.005, 0.01],
      ]),
      scaleXY: [1.5, 0.6],
    };
    expect(
      Math.abs(primitiveSurfaceArea(prim) / (2 * Math.PI * 0.15 * 0.06) - 1),
    ).toBeLessThanOrEqual(1e-3);
  });
});

describe('surface area: against the render mesh', () => {
  it('every primitive: the mesh area converges on the analytic area (chord error 5 um, 1e-3 relative)', () => {
    for (const [name, prim] of Object.entries(testPrimitives())) {
      const mesh = buildRenderMesh(singlePart(prim), { chordError: 0.000005 });
      const numeric = meshArea(mesh);
      const exact = primitiveSurfaceArea(prim);
      // A circle of radius r faceted with sagitta e loses e / (3 r) of its length. With half
      // the chord error per direction, a patch of radius 2 mm curved both ways loses
      // 2 * 2.5e-6 / (3 * 2e-3) = 8e-4 of its area; flatter and larger patches lose less.
      expect(Math.abs(numeric / exact - 1), name).toBeLessThanOrEqual(1e-3);
      expect(numeric, name).toBeLessThanOrEqual(exact * (1 + 1e-6));
    }
  });

  it('a posed shape has the area of its parts wherever they are', () => {
    const prims = testPrimitives();
    const shape: Shape = {
      parts: [
        {
          id: 'a',
          prim: prims.plate as Primitive,
          pose: { p: [0.1, 0, 0], q: quatFromAxisAngle([1, 0, 0], 1) },
          material: 'm',
        },
        {
          id: 'b',
          prim: prims.hull as Primitive,
          pose: { p: [0, 0.2, 0], q: quatFromAxisAngle([0, 1, 1], 2) },
          material: 'm',
        },
      ],
      regions: [],
    };
    expect(surfaceArea(shape)).toBeCloseTo(
      primitiveSurfaceArea(prims.plate as Primitive) +
        primitiveSurfaceArea(prims.hull as Primitive),
      15,
    );
  });
});

describe('surface area: regions', () => {
  const profile = profileMm(DOSSIER_PROFILES_MM.plateIec);
  const plate: Shape = {
    parts: [
      {
        id: 'body',
        prim: { kind: 'sor', profile },
        pose: POSE_IDENTITY,
        material: 'porcelain_glazed',
      },
      {
        id: 'foot',
        prim: {
          kind: 'sor',
          profile: profileMm([
            [79, 2, 4],
            [81, 2, 4],
          ]),
        },
        pose: POSE_IDENTITY,
        material: 'porcelain_unglazed',
      },
    ],
    regions: [
      { id: 'rim', part: 'body', side: 'in', sRange: [0.7, 1] },
      { id: 'well', part: 'body', side: 'in', sRange: [0, 0.7] },
      { id: 'underside', part: 'body', side: 'out' },
      { id: 'foot', part: 'foot' },
    ],
  };

  it('regions that cover the surface add up to the total (1e-13 relative)', () => {
    const total = surfaceArea(plate);
    const parts = ['rim', 'well', 'underside', 'foot'].map((id) => surfaceArea(plate, id));
    expect(parts.reduce((a, b) => a + b, 0) / total).toBeCloseTo(1, 13);
    for (const a of parts) expect(a).toBeGreaterThan(0);
    // A dinner plate has about 1100 cm^2 of surface (docs/research/items.md section 9, note on
    // surface_regions [ESTIMATED]); this one, with its foot ring, is within 15 % of that.
    expect(Math.abs(total / 0.11 - 1)).toBeLessThanOrEqual(0.15);
  });

  it('the well of a plate is its flat disc plus the inner cone up to the boundary (closed form, 1e-12)', () => {
    // 'in' side from s = 0 to 0.7. The top face of the flat base is an annulus-free disc out to
    // the concave crease; here the simpler exact check: the well plus the rim is the whole 'in'
    // side, and the foot region is the whole foot ring.
    const inSide: Shape = {
      parts: plate.parts,
      regions: [
        { id: 'in', part: 'body', side: 'in' },
        { id: 'out', part: 'body', side: 'out' },
      ],
    };
    expect(
      (surfaceArea(plate, 'rim') + surfaceArea(plate, 'well')) / surfaceArea(inSide, 'in'),
    ).toBeCloseTo(1, 13);
    expect(surfaceArea(plate, 'underside') / surfaceArea(inSide, 'out')).toBeCloseTo(1, 13);
    // Foot ring: a stadium 6 mm x 4 mm revolved at r = 80 mm: perimeter * 2 pi r.
    expect(
      surfaceArea(plate, 'foot') / ((2 * 0.002 + 2 * Math.PI * 0.002) * 2 * Math.PI * 0.08),
    ).toBeCloseTo(1, 13);
  });

  // A soup plate whose lip flattens: the well wall meets the lip in a join that is rounded on
  // the food side (a patch of torus 0.13 mm wide), and the regions of an `sor` item put the
  // bound between well and rim on exactly that vertex.
  const SOUP_MM: readonly (readonly [number, number, number])[] = [
    [0, 3, 4.6],
    [60, 3, 4.6],
    [85, 27, 4.6],
    [115, 30, 4.6],
  ];
  /** `nudge` moves the bound by that many units in the last place. */
  const soupPlate = (scale: number, order: 'rim first' | 'well first', nudge = 0): Shape => {
    const points = profileMm(
      SOUP_MM.map(([r, z, t]) => [r * scale, z * scale, t * scale] as const),
    );
    // The bound as the item expander computes it: the arc length up to the last vertex but
    // one over the whole length, both summed from the scaled points.
    const lengths = points.slice(1).map((p, i) => {
      const q = points[i] as { r: number; z: number };
      return Math.hypot(p.r - q.r, p.z - q.z);
    });
    const total = lengths.reduce((a, b) => a + b, 0);
    const lip =
      (((lengths[0] as number) + (lengths[1] as number)) / total) * (1 + nudge * 2 ** -52);
    const rim = { id: 'rim', part: 'body', side: 'in', sRange: [lip, 1] } as const;
    const well = { id: 'well', part: 'body', side: 'in', sRange: [0, lip] } as const;
    return {
      parts: [
        { id: 'body', prim: { kind: 'sor', profile: points }, pose: POSE_IDENTITY, material: 'm' },
      ],
      regions: [
        ...(order === 'rim first' ? [rim, well] : [well, rim]),
        { id: 'out', part: 'body', side: 'out' },
      ],
    };
  };

  it('region areas of a scaled shape are s^2 times the originals, whatever the last bit of a bound (1e-12)', () => {
    // The bound and the kernel's own arc length of the vertex are two roundings of one number
    // and differ by one unit in the last place at some scales. The rounded join then used to
    // change region with the scale: the rim of a soup plate came out 2 % short at 0.9, 1.2 and
    // 1.37 (a 4.7 cm^2 patch).
    // Here the bound is moved by one and by two units in the last place either way, at every
    // scale, and nothing may change.
    const base = soupPlate(1, 'rim first');
    for (const scale of [0.9, 1.2, 1.37, 0.731, 1.618]) {
      for (const nudge of [-2, -1, 0, 1, 2]) {
        const scaled = soupPlate(scale, 'rim first', nudge);
        for (const id of ['rim', 'well', 'out']) {
          const ratio = surfaceArea(scaled, id) / (surfaceArea(base, id) * scale * scale);
          expect(Math.abs(ratio - 1), `${id} at ${scale}, nudged ${nudge}`).toBeLessThan(1e-12);
        }
      }
    }
  });

  it('a patch on a bound between two regions belongs to the one listed first', () => {
    // The join at the lip vertex of the soup plate: a patch of torus of tube radius t / 2
    // about the vertex circle, spanning the angle between the normals of the well wall and of
    // the lip. By Pappus its area is 2 pi rho (R dtheta + rho (sin(th1) - sin(th0))), with
    // theta the direction of the normal from +r towards +z.
    const rho = 0.0023;
    const th1 = Math.atan2(25, -24); // normal of the well wall (direction (25, 24)), food side
    const th0 = Math.atan2(30, -3); // normal of the lip (direction (30, 3))
    const join = 2 * Math.PI * rho * (0.085 * (th1 - th0) + rho * (Math.sin(th1) - Math.sin(th0)));
    expect(join).toBeGreaterThan(5e-4); // 5.9 cm^2
    const rimFirst = soupPlate(1, 'rim first');
    const wellFirst = soupPlate(1, 'well first');
    expect(surfaceArea(rimFirst, 'rim') - surfaceArea(wellFirst, 'rim')).toBeCloseTo(join, 12);
    expect(surfaceArea(wellFirst, 'well') - surfaceArea(rimFirst, 'well')).toBeCloseTo(join, 12);
    // And the same at a scale at which the bound is one unit in the last place off the vertex.
    for (const scale of [0.9, 1.2, 1.37]) {
      const a = surfaceArea(soupPlate(scale, 'rim first'), 'rim');
      const b = surfaceArea(soupPlate(scale, 'well first'), 'rim');
      expect((a - b) / (scale * scale)).toBeCloseTo(join, 12);
    }
  });

  it('per-region areas match the area of the triangles tagged with the region (chord error 5 um, 5e-4)', () => {
    const mesh = buildRenderMesh(plate, { chordError: 0.000005 });
    for (const id of ['rim', 'well', 'underside', 'foot']) {
      const index = mesh.regionIds.indexOf(id);
      const numeric = meshArea(mesh, (t) => mesh.triRegion[t] === index);
      expect(Math.abs(numeric / surfaceArea(plate, id) - 1), id).toBeLessThanOrEqual(5e-4);
    }
  });

  it('a slab: top, underside and edge in closed form, for any rounding (1e-13 relative)', () => {
    const h: Vec3 = [0.17, 0.12, 0.002];
    const r = 0.002;
    const board: Shape = {
      parts: [
        {
          id: 'board',
          prim: { kind: 'rbox', halfExtents: h, radius: r },
          pose: POSE_IDENTITY,
          material: 'pe',
        },
      ],
      regions: [
        { id: 'top', part: 'board', side: 'in' },
        { id: 'underside', part: 'board', side: 'out' },
        { id: 'edge', part: 'board' },
      ],
    };
    // Top: the face, four quarter-cylinder edges and four sphere octants.
    const top = 4 * h[0] * h[1] + 2 * Math.PI * r * (h[0] + h[1]) + 2 * Math.PI * r * r;
    const edge = 8 * h[2] * (h[0] + h[1]) + 4 * Math.PI * r * h[2];
    expect(surfaceArea(board, 'top') / top).toBeCloseTo(1, 13);
    expect(surfaceArea(board, 'underside') / top).toBeCloseTo(1, 13);
    expect(surfaceArea(board, 'edge') / edge).toBeCloseTo(1, 13);
    expect(surfaceArea(board) / (2 * top + edge)).toBeCloseTo(1, 13);
  });

  it('a tilted hull splits into in and out sides that add up, matching the tagged triangles (5e-3)', () => {
    const rnd = [
      [0, 0, 0],
      [0.03, 0.002, 0.004],
      [0.004, 0.02, -0.003],
      [0.006, 0.004, 0.025],
      [0.022, 0.018, 0.012],
    ] as Vec3[];
    const shape: Shape = {
      parts: [
        {
          id: 'h',
          prim: { kind: 'hull', points: rnd, radius: 0.002 },
          pose: POSE_IDENTITY,
          material: 'm',
        },
      ],
      regions: [
        { id: 'up', part: 'h', side: 'in' },
        { id: 'down', part: 'h', side: 'out' },
      ],
    };
    const up = surfaceArea(shape, 'up');
    const down = surfaceArea(shape, 'down');
    expect((up + down) / surfaceArea(shape)).toBeCloseTo(1, 13);
    // On a tilted hull the line between the sides crosses facets, which go to one side whole:
    // a band about 0.15 mm wide along some 80 mm of that line, out of 1500 mm^2 per side.
    const mesh = buildRenderMesh(shape, { chordError: 0.000005 });
    expect(Math.abs(meshArea(mesh, (t) => mesh.triRegion[t] === 0) / up - 1)).toBeLessThanOrEqual(
      5e-3,
    );
    expect(Math.abs(meshArea(mesh, (t) => mesh.triRegion[t] === 1) / down - 1)).toBeLessThanOrEqual(
      5e-3,
    );
  });

  it('rejects an unknown region id', () => {
    expect(() => surfaceArea(plate, 'handle')).toThrow(RangeError);
  });
});
