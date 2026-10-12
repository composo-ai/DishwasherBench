import {
  POSE_IDENTITY,
  poseInverseTransformPoint,
  poseTransformPoint,
  quatFromAxisAngle,
  v3Length,
  v3Sub,
  type Pose,
  type Vec3,
} from '@spotless/core';
import { describe, expect, it } from 'vitest';
import { computeMassProperties, primitiveMoments, primitiveVolume } from './mass.ts';
import { meshArea, meshMoments, meshTopology, meshVolume } from './mesh-metrics.ts';
import { buildRenderMesh, triangulatePolygon } from './mesh.ts';
import { preparePrimitive, sectorCount } from './prepared.ts';
import { signedDistance, signedDistanceGradient } from './sdf.ts';
import { createProfileHit, profileClosest, hitArcLength, prepareProfile } from './sor-section.ts';
import {
  DOSSIER_PROFILES_MM,
  profileMm,
  singlePart,
  testPrimitives,
  testRandom,
} from './test-util.ts';
import {
  RENDER_CHORD_ERROR,
  type Primitive,
  type RenderMesh,
  type Shape,
  type SorProfilePoint,
} from './types.ts';

/** float32 rounding of a coordinate of up to 0.3 m. */
const F32 = 2e-8;

function vertex(mesh: RenderMesh, i: number): Vec3 {
  return [
    mesh.positions[3 * i] as number,
    mesh.positions[3 * i + 1] as number,
    mesh.positions[3 * i + 2] as number,
  ];
}

function normal(mesh: RenderMesh, i: number): Vec3 {
  return [
    mesh.normals[3 * i] as number,
    mesh.normals[3 * i + 1] as number,
    mesh.normals[3 * i + 2] as number,
  ];
}

function triangle(mesh: RenderMesh, t: number): [Vec3, Vec3, Vec3] {
  return [
    vertex(mesh, mesh.indices[3 * t] as number),
    vertex(mesh, mesh.indices[3 * t + 1] as number),
    vertex(mesh, mesh.indices[3 * t + 2] as number),
  ];
}

const POSE: Pose = { p: [0.01, -0.02, 0.03], q: quatFromAxisAngle([1, 2, 3], 0.7) };

describe('render mesh: every primitive kind at 0.5 mm and 0.1 mm', () => {
  for (const chordError of [0.0005, RENDER_CHORD_ERROR]) {
    for (const [name, prim] of Object.entries(testPrimitives())) {
      const label = `${name} at ${chordError * 1000} mm`;
      const shape = singlePart(prim, POSE);
      const mesh = buildRenderMesh(shape, { chordError });
      const triangles = mesh.indices.length / 3;

      it(`${label}: closed and consistently oriented once welded by position`, () => {
        const topology = meshTopology(mesh);
        expect(topology.openEdges).toBe(0);
        expect(topology.repeatedEdges).toBe(0);
        expect(topology.degenerateTriangles).toBe(0);
        expect(topology.closed).toBe(true);
        expect(triangles).toBeGreaterThanOrEqual(4);
      });

      it(`${label}: faces outwards (signed volume) and encloses the analytic volume within chordError * area`, () => {
        const volume = meshVolume(mesh);
        const exact = primitiveVolume(prim);
        expect(volume).toBeGreaterThan(0);
        expect(Math.abs(volume - exact)).toBeLessThanOrEqual(chordError * meshArea(mesh) + 1e-12);
      });

      it(`${label}: every vertex is on the surface and every facet within chordError of it`, () => {
        let worstVertex = 0;
        for (let v = 0; v < mesh.positions.length / 3; v++) {
          worstVertex = Math.max(worstVertex, Math.abs(signedDistance(shape, vertex(mesh, v))));
        }
        expect(worstVertex).toBeLessThanOrEqual(F32);
        let worstFacet = 0;
        for (let t = 0; t < triangles; t++) {
          const [a, b, c] = triangle(mesh, t);
          // Edge midpoints (which include the diagonal of every quad) and the centroid.
          const samples: Vec3[] = [
            [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
            [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2, (b[2] + c[2]) / 2],
            [(c[0] + a[0]) / 2, (c[1] + a[1]) / 2, (c[2] + a[2]) / 2],
            [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3],
          ];
          for (const p of samples)
            worstFacet = Math.max(worstFacet, Math.abs(signedDistance(shape, p)));
        }
        expect(worstFacet).toBeLessThanOrEqual(chordError + F32);
      });

      it(`${label}: vertex normals are unit, agree with the facets and with the distance gradient`, () => {
        let worstLength = 0;
        for (let v = 0; v < mesh.normals.length / 3; v++) {
          worstLength = Math.max(worstLength, Math.abs(v3Length(normal(mesh, v)) - 1));
        }
        expect(worstLength).toBeLessThanOrEqual(1e-6);
        for (let t = 0; t < triangles; t++) {
          const [a, b, c] = triangle(mesh, t);
          const u = v3Sub(b, a);
          const w = v3Sub(c, a);
          const g: Vec3 = [
            u[1] * w[2] - u[2] * w[1],
            u[2] * w[0] - u[0] * w[2],
            u[0] * w[1] - u[1] * w[0],
          ];
          for (let k = 0; k < 3; k++) {
            const n = normal(mesh, mesh.indices[3 * t + k] as number);
            expect(g[0] * n[0] + g[1] * n[1] + g[2] * n[2]).toBeGreaterThan(0);
          }
        }
        // The gradient just outside a vertex is the surface normal there. Skipped: vertices on
        // a crease (several normals at one position), where the nearest surface just outside is
        // the other face.
        const normalsAt = new Map<string, Vec3[]>();
        const key = (v: number): string => vertex(mesh, v).join(',');
        for (let v = 0; v < mesh.positions.length / 3; v++) {
          const list = normalsAt.get(key(v)) ?? [];
          list.push(normal(mesh, v));
          normalsAt.set(key(v), list);
        }
        let compared = 0;
        for (let v = 0; v < mesh.positions.length / 3; v++) {
          const n = normal(mesh, v);
          if ((normalsAt.get(key(v)) ?? []).some((o) => v3Length(v3Sub(o, n)) > 1e-3)) continue;
          const p = vertex(mesh, v);
          // Also skipped: the pole of a shell of revolution, which may be the apex of a cone;
          // its normal is the axis by convention.
          const local = poseInverseTransformPoint(POSE, p);
          if (prim.kind === 'sor' && Math.hypot(local[0], local[1]) < 1e-6) continue;
          const out: Vec3 = [p[0] + 2e-5 * n[0], p[1] + 2e-5 * n[1], p[2] + 2e-5 * n[2]];
          const g = signedDistanceGradient(shape, out);
          expect(g[0] * n[0] + g[1] * n[1] + g[2] * n[2]).toBeGreaterThan(0.999);
          compared++;
        }
        // A sharp box has nothing but creases.
        if (name !== 'sharpBox') expect(compared).toBeGreaterThan(0);
      });
    }
  }
});

describe('render mesh: random shapes', () => {
  /** A random profile: 3 to 6 vertices, bends up to 50 degrees, thickness 1 to 6 mm. */
  function randomProfile(seed: number): SorProfilePoint[] {
    const rnd = testRandom(seed);
    const count = 3 + Math.floor(rnd.next() * 4);
    const points: SorProfilePoint[] = [];
    let r = rnd.next() < 0.5 ? 0 : rnd.range(0.004, 0.02);
    let z = rnd.range(0.002, 0.01);
    let heading = rnd.range(-0.2, 0.4);
    for (let i = 0; i < count; i++) {
      points.push({ r, z, t: rnd.range(0.001, 0.006) });
      const length = rnd.range(0.012, 0.05);
      heading = Math.min(1.7, Math.max(-0.3, heading + rnd.range(-0.3, 0.9)));
      r = Math.max(0.002, r + length * Math.cos(heading));
      z += length * Math.sin(heading);
    }
    return points;
  }

  function check(shape: Shape, prim: Primitive, chordError: number, label: string): void {
    const mesh = buildRenderMesh(shape, { chordError });
    expect(meshTopology(mesh).closed, label).toBe(true);
    const volume = meshVolume(mesh);
    expect(Math.abs(volume - primitiveVolume(prim)), label).toBeLessThanOrEqual(
      chordError * meshArea(mesh),
    );
    let worst = 0;
    for (let t = 0; t < mesh.indices.length / 3; t++) {
      const [a, b, c] = triangle(mesh, t);
      for (const p of [
        a,
        [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3] as Vec3,
      ]) {
        worst = Math.max(worst, Math.abs(signedDistance(shape, p)));
      }
    }
    expect(worst, label).toBeLessThanOrEqual(chordError + F32);
  }

  it('40 random shells of revolution: closed, right volume, facets within the chord error', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const prim: Primitive = { kind: 'sor', profile: randomProfile(seed) };
      check(singlePart(prim), prim, 0.0003, `profile ${seed}`);
    }
  });

  it('20 random stretched and partial shells', () => {
    const rnd = testRandom(77);
    for (let seed = 41; seed <= 60; seed++) {
      const profile = randomProfile(seed);
      const prim: Primitive =
        seed % 2 === 0
          ? { kind: 'sor', profile, scaleXY: [rnd.range(0.6, 1.6), rnd.range(0.6, 1.6)] }
          : { kind: 'sor', profile, arc: [rnd.range(-3, 0), rnd.range(0.3, 3)] };
      check(singlePart(prim, POSE), prim, 0.0003, `profile ${seed}`);
    }
  });

  it('30 random rounded hulls of 4 to 12 points, and their flat and sharp variants', () => {
    const rnd = testRandom(78);
    for (let trial = 0; trial < 30; trial++) {
      const count = 4 + Math.floor(rnd.next() * 9);
      const points: Vec3[] = [];
      for (let i = 0; i < count; i++) {
        const p = rnd.vec3(0.03);
        // Every third hull is flat (all points in one tilted plane).
        points.push(trial % 3 === 0 ? [p[0], p[1], 0.3 * p[0] - 0.2 * p[1]] : p);
      }
      const radius = trial % 3 === 1 ? 0 : rnd.range(0.0005, 0.005);
      const prim: Primitive = { kind: 'hull', points, radius };
      check(singlePart(prim, POSE), prim, 0.0002, `hull ${trial}`);
    }
  });
});

describe('render mesh: mass moments of the mesh against the analytic ones', () => {
  it('volume, first and second moments are within chordError * area * extent^k of the closed forms', () => {
    // Moving a surface of area A by at most e changes the integral of f over the solid by at
    // most e * A * max|f|; f is 1, a coordinate or a product of two coordinates.
    const chordError = 0.00002;
    for (const [name, prim] of Object.entries(testPrimitives())) {
      const mesh = buildRenderMesh(singlePart(prim), { chordError });
      const numeric = meshMoments(mesh);
      const exact = primitiveMoments(prim);
      let extent = 0;
      for (const x of mesh.positions) extent = Math.max(extent, Math.abs(x));
      const bound = chordError * meshArea(mesh);
      expect(Math.abs(numeric.volume - exact.volume), name).toBeLessThanOrEqual(bound);
      expect(Math.abs(numeric.volume / exact.volume - 1), name).toBeLessThanOrEqual(0.01);
      for (let k = 0; k < 3; k++) {
        expect(
          Math.abs((numeric.first[k] as number) - (exact.first[k] as number)),
          name,
        ).toBeLessThanOrEqual(bound * extent);
      }
      for (let k = 0; k < 9; k++) {
        expect(
          Math.abs((numeric.second[k] as number) - (exact.second[k] as number)),
          name,
        ).toBeLessThanOrEqual(bound * extent * extent);
      }
    }
  });

  it('a posed two-part shape: mesh integrals match computeMassProperties (1e-3 relative)', () => {
    const shape: Shape = {
      parts: [
        {
          id: 'body',
          prim: { kind: 'sor', profile: profileMm(DOSSIER_PROFILES_MM.mug) },
          pose: POSE_IDENTITY,
          material: 'm',
        },
        {
          id: 'handle',
          prim: { kind: 'capsule', a: [0, 0, -0.02], b: [0, 0, 0.02], radius: 0.004 },
          pose: { p: [0.07, 0, 0.05], q: quatFromAxisAngle([0, 1, 0], 0.3) },
          material: 'm',
        },
      ],
      regions: [],
    };
    const mesh = buildRenderMesh(shape, { chordError: 0.00002 });
    // The two parts do not overlap, so the mesh integral is the integral over the union.
    const numeric = meshMoments(mesh);
    const exact = computeMassProperties(shape, () => 1);
    expect(Math.abs(numeric.volume / exact.mass - 1)).toBeLessThanOrEqual(1e-3);
    for (let k = 0; k < 3; k++) {
      expect(
        Math.abs((numeric.first[k] as number) / numeric.volume - (exact.com[k] as number)),
      ).toBeLessThanOrEqual(2e-5);
    }
    // Inertia about the origin from the mesh, shifted to the centre of mass.
    const c = [
      numeric.first[0] / numeric.volume,
      numeric.first[1] / numeric.volume,
      numeric.first[2] / numeric.volume,
    ] as const;
    const trace = numeric.second[0] + numeric.second[4] + numeric.second[8];
    const izz = trace - numeric.second[8] - numeric.volume * (c[0] * c[0] + c[1] * c[1]);
    const ixx = trace - numeric.second[0] - numeric.volume * (c[1] * c[1] + c[2] * c[2]);
    expect(Math.abs(izz / exact.inertia[8] - 1)).toBeLessThanOrEqual(2e-3);
    expect(Math.abs(ixx / exact.inertia[0] - 1)).toBeLessThanOrEqual(2e-3);
    // Each part is closed on its own.
    expect(meshTopology(mesh, 0).closed).toBe(true);
    expect(meshTopology(mesh, 1).closed).toBe(true);
    expect(mesh.partIds).toEqual(['body', 'handle']);
  });
});

describe('render mesh: structure', () => {
  it('uses the platform sector rule at half the chord error (plate: R = 132.1 mm)', () => {
    const prim = testPrimitives().plate;
    if (prim === undefined) throw new Error('no plate');
    const prep = preparePrimitive(prim);
    if (prep.kind !== 'sor') throw new Error('not a sor');
    const rOuter = prep.section().rMax;
    expect(rOuter).toBeCloseTo(0.1321, 6);
    for (const chordError of [0.0005, 0.0001]) {
      const mesh = buildRenderMesh(singlePart(prim), { chordError });
      // Count the vertices of the outermost ring: all at the largest radius.
      let rMax = 0;
      for (let v = 0; v < mesh.positions.length / 3; v++)
        rMax = Math.max(rMax, Math.hypot(...vertex(mesh, v).slice(0, 2)));
      let onRing = 0;
      for (let v = 0; v < mesh.positions.length / 3; v++) {
        if (Math.hypot(...vertex(mesh, v).slice(0, 2)) > rMax - 1e-7) onRing++;
      }
      const expected = Math.max(16, Math.ceil(Math.PI / Math.acos(1 - chordError / 2 / rOuter)));
      expect(sectorCount(rOuter, chordError / 2, 16)).toBe(expected);
      expect(onRing % expected).toBe(0);
      expect(onRing).toBeGreaterThanOrEqual(expected);
    }
  });

  it('honours minSectors', () => {
    const prim = testPrimitives().ring;
    if (prim === undefined) throw new Error('no ring');
    // At a chord error of 10 mm the rule alone asks for 6 sectors on a 32 mm radius.
    const coarse = buildRenderMesh(singlePart(prim), { chordError: 0.01, minSectors: 12 });
    const fine = buildRenderMesh(singlePart(prim), { chordError: 0.01, minSectors: 48 });
    expect(fine.indices.length).toBe(4 * coarse.indices.length);
  });

  it('follows the part pose: the mesh of a posed part is the posed mesh (float32 accuracy)', () => {
    const prim = testPrimitives().tumbler;
    if (prim === undefined) throw new Error('no tumbler');
    const plain = buildRenderMesh(singlePart(prim), { chordError: 0.0005 });
    const posed = buildRenderMesh(singlePart(prim, POSE), { chordError: 0.0005 });
    expect(posed.indices).toEqual(plain.indices);
    let worst = 0;
    for (let v = 0; v < plain.positions.length / 3; v++) {
      worst = Math.max(
        worst,
        v3Length(v3Sub(poseTransformPoint(POSE, vertex(plain, v)), vertex(posed, v))),
      );
    }
    expect(worst).toBeLessThanOrEqual(5e-8);
  });

  it('rejects invalid options', () => {
    const shape = singlePart({ kind: 'capsule', a: [0, 0, 0], b: [0, 0, 0.01], radius: 0.002 });
    expect(() => buildRenderMesh(shape, { chordError: 0 })).toThrow(RangeError);
    expect(() => buildRenderMesh(shape, { chordError: Number.NaN })).toThrow(RangeError);
    expect(() => buildRenderMesh(shape, { chordError: 0.0001, minSectors: 2 })).toThrow(RangeError);
  });
});

describe('render mesh: surface regions', () => {
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
  const mesh = buildRenderMesh(plate, { chordError: 0.0002 });
  const prepared = prepareProfile(profile);

  it('lists parts and regions in shape order and tags every triangle', () => {
    expect(mesh.partIds).toEqual(['body', 'foot']);
    expect(mesh.regionIds).toEqual(['rim', 'well', 'underside', 'foot']);
    for (let t = 0; t < mesh.indices.length / 3; t++) {
      const part = mesh.triPart[t] as number;
      const region = mesh.triRegion[t] as number;
      expect(region).toBeGreaterThanOrEqual(0);
      if (part === 1) expect(region).toBe(3);
      else expect(region).toBeLessThan(3);
    }
  });

  it('assigns side and arc length as an independent classification of each centroid does', () => {
    // Independent rule: the food side is the side the left normal of the nearest profile segment
    // points to; arc length is that of the nearest mid-surface point.
    const hit = createProfileHit();
    let checked = 0;
    for (let t = 0; t < mesh.indices.length / 3; t++) {
      if (mesh.triPart[t] !== 0) continue;
      const [a, b, c] = triangle(mesh, t);
      const p: Vec3 = [
        (a[0] + b[0] + c[0]) / 3,
        (a[1] + b[1] + c[1]) / 3,
        (a[2] + b[2] + c[2]) / 3,
      ];
      const r = Math.hypot(p[0], p[1]);
      profileClosest(prepared, r, p[2], 0, hit);
      const s = hitArcLength(prepared, hit);
      const seg = hit.segment;
      const pa = profile[seg] as { r: number; z: number };
      const pb = profile[seg + 1] as { r: number; z: number };
      const left = (pb.r - pa.r) * (p[2] - hit.cz) - (pb.z - pa.z) * (r - hit.cr) > 0;
      // Skip centroids too close to a boundary between regions to classify robustly.
      if (Math.abs(s - 0.7) < 0.02 || s > 0.995) continue;
      const expected = left ? (s > 0.7 ? 'rim' : 'well') : 'underside';
      expect(mesh.regionIds[mesh.triRegion[t] as number]).toBe(expected);
      checked++;
    }
    expect(checked).toBeGreaterThan(500);
  });

  it('puts a ring of vertices on the region boundary: no triangle straddles s = 0.7', () => {
    const hit = createProfileHit();
    const arcLength = (p: Vec3): number => {
      profileClosest(prepared, Math.hypot(p[0], p[1]), p[2], 0, hit);
      return hitArcLength(prepared, hit);
    };
    for (let t = 0; t < mesh.indices.length / 3; t++) {
      const id = mesh.regionIds[mesh.triRegion[t] as number];
      if (id !== 'rim' && id !== 'well') continue;
      const s = triangle(mesh, t).map(arcLength);
      if (id === 'rim') expect(Math.min(...s)).toBeGreaterThanOrEqual(0.7 - 1e-5);
      else expect(Math.max(...s)).toBeLessThanOrEqual(0.7 + 1e-5);
    }
  });

  it('rounded boxes and plates split into an in side (+z of the part frame) and an out side', () => {
    const shape: Shape = {
      parts: [
        {
          id: 'board',
          prim: { kind: 'rbox', halfExtents: [0.1, 0.06, 0.002], radius: 0.002 },
          pose: POSE,
          material: 'pe',
        },
      ],
      regions: [
        { id: 'top', part: 'board', side: 'in' },
        { id: 'underside', part: 'board', side: 'out' },
        { id: 'edge', part: 'board' },
      ],
    };
    const board = buildRenderMesh(shape, { chordError: 0.0002 });
    const zAxis = poseTransformPoint({ p: [0, 0, 0], q: POSE.q }, [0, 0, 1]);
    const counts = [0, 0, 0];
    for (let t = 0; t < board.indices.length / 3; t++) {
      // Component of the three vertex normals along the part's +z axis.
      const nz = [0, 1, 2].map((k) => {
        const n = normal(board, board.indices[3 * t + k] as number);
        return n[0] * zAxis[0] + n[1] * zAxis[1] + n[2] * zAxis[2];
      });
      const region = board.triRegion[t] as number;
      counts[region] = (counts[region] as number) + 1;
      if (region === 0) expect(Math.min(...nz)).toBeGreaterThan(-1e-6);
      if (region === 1) expect(Math.max(...nz)).toBeLessThan(1e-6);
      if (region === 2) expect(Math.max(...nz.map(Math.abs))).toBeLessThan(1e-6);
    }
    expect(counts[0]).toBe(counts[1]);
    expect(counts[2]).toBeGreaterThan(0);
  });

  it('rejects regions that select nothing or have a bad range', () => {
    const part = plate.parts[0];
    if (part === undefined) throw new Error('no part');
    expect(() =>
      buildRenderMesh(
        { parts: [part], regions: [{ id: 'x', part: 'nope' }] },
        { chordError: 0.001 },
      ),
    ).toThrow(RangeError);
    expect(() =>
      buildRenderMesh(
        { parts: [part], regions: [{ id: 'x', part: 'body', sRange: [0.5, 0.5] }] },
        { chordError: 0.001 },
      ),
    ).toThrow(RangeError);
    expect(() =>
      buildRenderMesh({ parts: [part, part], regions: [] }, { chordError: 0.001 }),
    ).toThrow(RangeError);
  });
});

describe('polygon triangulation (end faces of partial shells)', () => {
  it('covers an L-shaped polygon exactly, using every vertex, with no flat triangle', () => {
    // L shape with an extra collinear vertex on the long edge.
    const points: [number, number][] = [
      [0, 0],
      [2, 0],
      [4, 0],
      [4, 1],
      [1, 1],
      [1, 3],
      [0, 3],
    ];
    const tris = triangulatePolygon(points);
    expect(tris.length).toBe(3 * (points.length - 2));
    let area = 0;
    const used = new Set<number>();
    for (let k = 0; k < tris.length; k += 3) {
      const [a, b, c] = [
        points[tris[k] as number],
        points[tris[k + 1] as number],
        points[tris[k + 2] as number],
      ] as [[number, number], [number, number], [number, number]];
      const twice = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      expect(twice).toBeGreaterThan(1e-12);
      area += twice / 2;
      used
        .add(tris[k] as number)
        .add(tris[k + 1] as number)
        .add(tris[k + 2] as number);
    }
    expect(area).toBeCloseTo(4 + 2, 12);
    expect(used.size).toBe(points.length);
  });
});
