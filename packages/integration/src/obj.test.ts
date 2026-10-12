// The OBJ export read back as text: what a viewer will see is the kernel's render mesh, posed.
import type { Pose, Vec3 } from '@spotless/core';
import { quatFromAxisAngle } from '@spotless/core';
import type { Shape } from '@spotless/geometry';
import { RENDER_CHORD_ERROR, boundingBox, buildRenderMesh } from '@spotless/geometry';
import { describe, expect, it } from 'vitest';
import { instantiate } from '@spotless/catalogue';
import { buildObj } from './obj.ts';
import { buildStandInRack } from './stand-in-rack.ts';

interface ParsedObj {
  readonly objects: string[];
  readonly groups: string[];
  readonly v: Vec3[];
  readonly vn: Vec3[];
  /** Per face: three 0-based vertex indices and three 0-based normal indices. */
  readonly f: { v: [number, number, number]; n: [number, number, number] }[];
}

function parse(text: string): ParsedObj {
  const out: ParsedObj = { objects: [], groups: [], v: [], vn: [], f: [] };
  for (const line of text.split('\n')) {
    const [tag, ...rest] = line.split(' ');
    if (tag === 'o') out.objects.push(rest.join(' '));
    else if (tag === 'g') out.groups.push(rest.join(' '));
    else if (tag === 'v') out.v.push(rest.map(Number) as unknown as Vec3);
    else if (tag === 'vn') out.vn.push(rest.map(Number) as unknown as Vec3);
    else if (tag === 'f') {
      const corners = rest.map((corner) => corner.split('//').map((x) => Number(x) - 1));
      out.f.push({
        v: corners.map((c) => c[0]) as [number, number, number],
        n: corners.map((c) => c[1]) as [number, number, number],
      });
    } else if (tag !== '#' && line.length > 0) {
      throw new Error(`unexpected OBJ line: ${line}`);
    }
  }
  return out;
}

/** Volume enclosed by the faces of a parsed OBJ (divergence theorem), in its length unit cubed. */
function enclosedVolume(obj: ParsedObj): number {
  let six = 0;
  for (const face of obj.f) {
    const [a, b, c] = face.v.map((i) => obj.v[i] as Vec3) as [Vec3, Vec3, Vec3];
    six +=
      a[0] * (b[1] * c[2] - b[2] * c[1]) +
      a[1] * (b[2] * c[0] - b[0] * c[2]) +
      a[2] * (b[0] * c[1] - b[1] * c[0]);
  }
  return six / 6;
}

function ball(radius: number): Shape {
  return {
    parts: [
      {
        id: 'ball',
        prim: { kind: 'capsule', a: [0, 0, 0], b: [0, 0, 0], radius },
        pose: { p: [0, 0, 0], q: [0, 0, 0, 1] },
        material: 'stainless_steel',
      },
    ],
    regions: [],
  };
}

describe('OBJ export', () => {
  it('writes a ball as a closed, outward-facing surface of the analytic volume, where it was posed', () => {
    const radius = 0.03;
    const pose: Pose = { p: [0.2, -0.1, 0.4], q: quatFromAxisAngle([1, 2, 3], 0.7) };
    const document = buildObj([{ name: 'steel ball', shape: ball(radius), pose }]);
    const obj = parse(document.text);
    expect(obj.objects).toEqual(['steel_ball']);
    expect(obj.groups).toEqual(['steel_ball.ball']);
    expect(obj.v).toHaveLength(document.vertices);
    expect(obj.vn).toHaveLength(document.vertices);
    expect(obj.f).toHaveLength(document.triangles);
    expect(document.objects).toEqual([
      { name: 'steel_ball', vertices: document.vertices, triangles: document.triangles },
    ]);
    // Every vertex is on the sphere about the posed centre (coordinates are written to a
    // micrometre) and carries the radial unit normal.
    for (let i = 0; i < obj.v.length; i++) {
      const v = obj.v[i] as Vec3;
      const n = obj.vn[i] as Vec3;
      const d: Vec3 = [v[0] - pose.p[0], v[1] - pose.p[1], v[2] - pose.p[2]];
      expect(Math.abs(Math.hypot(...d) - radius)).toBeLessThan(2e-6);
      expect(Math.abs(Math.hypot(...n) - 1)).toBeLessThan(2e-6);
      expect((d[0] * n[0] + d[1] * n[1] + d[2] * n[2]) / radius).toBeGreaterThan(1 - 1e-4);
    }
    // Faces wind counter-clockwise seen from outside: the enclosed volume is positive, and that
    // of the sphere less what flat facets within the chord error cut off (under area x error).
    const volume = enclosedVolume(obj);
    const exact = (4 / 3) * Math.PI * radius ** 3;
    expect(volume).toBeLessThan(exact);
    expect(exact - volume).toBeLessThan(4 * Math.PI * radius ** 2 * RENDER_CHORD_ERROR);
    // Indices are 1-based in the file and refer to this object's own vertices.
    for (const face of obj.f) {
      expect(face.n).toEqual(face.v);
      for (const i of face.v) {
        expect(i).toBeGreaterThanOrEqual(0);
        expect(i).toBeLessThan(obj.v.length);
      }
    }
  });

  it('writes several bodies with running indices, a group per part, and shares meshes of one shape', () => {
    const mug = instantiate('mug_ceramic_300');
    const rack = buildStandInRack();
    const chordError = 0.0005;
    const poses: Pose[] = [
      { p: [0.1, 0.1, 0], q: [0, 0, 0, 1] },
      { p: [0.3, 0.1, 0.1], q: quatFromAxisAngle([1, 0, 0], Math.PI) },
    ];
    const document = buildObj(
      [
        { name: 'mug_a', shape: mug.shape, pose: poses[0] as Pose },
        { name: 'mug_b', shape: mug.shape, pose: poses[1] as Pose },
        { name: 'basket', shape: rack.basket, pose: { p: [0, 0, 0], q: [0, 0, 0, 1] } },
      ],
      { chordError, comments: ['two mugs and a basket'] },
    );
    expect(document.text.split('\n').slice(0, 4)).toEqual([
      '# Spotless scene: render meshes of the geometry kernel',
      '# frame: right-handed, z up; units: metres',
      '# chord error: 0.500 mm',
      '# two mugs and a basket',
    ]);
    const obj = parse(document.text);
    const mugMesh = buildRenderMesh(mug.shape, { chordError });
    const basketMesh = buildRenderMesh(rack.basket, { chordError });
    const mugVertices = mugMesh.positions.length / 3;
    const mugTriangles = mugMesh.indices.length / 3;
    expect(document.objects).toEqual([
      { name: 'mug_a', vertices: mugVertices, triangles: mugTriangles },
      { name: 'mug_b', vertices: mugVertices, triangles: mugTriangles },
      {
        name: 'basket',
        vertices: basketMesh.positions.length / 3,
        triangles: basketMesh.indices.length / 3,
      },
    ]);
    expect(document.vertices).toBe(2 * mugVertices + basketMesh.positions.length / 3);
    expect(obj.v).toHaveLength(document.vertices);
    expect(obj.f).toHaveLength(document.triangles);
    // One group per part of each body, in part order.
    expect(obj.groups).toEqual([
      ...mug.shape.parts.map((part) => `mug_a.${part.id}`),
      ...mug.shape.parts.map((part) => `mug_b.${part.id}`),
      ...rack.basket.parts.map((part) => `basket.${part.id}`),
    ]);
    // The faces of the second mug use the second mug's vertices only.
    const second = obj.f.slice(mugTriangles, 2 * mugTriangles);
    for (const face of second) {
      for (const i of face.v) {
        expect(i).toBeGreaterThanOrEqual(mugVertices);
        expect(i).toBeLessThan(2 * mugVertices);
      }
    }
    // Each body is where its pose puts it: the box around its vertices is the kernel's bounding
    // box of the posed shape, short of it by no more than the chord error (facets are inscribed)
    // and the micrometre of the file.
    const boxOf = (from: number, count: number): { min: number[]; max: number[] } => {
      const min = [Infinity, Infinity, Infinity];
      const max = [-Infinity, -Infinity, -Infinity];
      for (const v of obj.v.slice(from, from + count)) {
        for (let k = 0; k < 3; k++) {
          min[k] = Math.min(min[k] as number, v[k] as number);
          max[k] = Math.max(max[k] as number, v[k] as number);
        }
      }
      return { min, max };
    };
    poses.forEach((pose, b) => {
      const exact = boundingBox(mug.shape, pose);
      const got = boxOf(b * mugVertices, mugVertices);
      for (let k = 0; k < 3; k++) {
        expect((got.min[k] as number) - (exact.min[k] as number)).toBeGreaterThan(-2e-6);
        expect((got.min[k] as number) - (exact.min[k] as number)).toBeLessThan(chordError + 2e-6);
        expect((exact.max[k] as number) - (got.max[k] as number)).toBeGreaterThan(-2e-6);
        expect((exact.max[k] as number) - (got.max[k] as number)).toBeLessThan(chordError + 2e-6);
      }
    });
    // The upside-down mug really is upside down: its handle, which is above mid height in the
    // item, is in the lower half of the posed mug... and its rim is at the bottom.
    const upright = boxOf(0, mugVertices);
    const inverted = boxOf(mugVertices, mugVertices);
    expect((upright.max[2] as number) - (upright.min[2] as number)).toBeCloseTo(
      (inverted.max[2] as number) - (inverted.min[2] as number),
      5,
    );
    expect(inverted.max[2] as number).toBeCloseTo(0.1, 5);
    expect(inverted.min[2] as number).toBeCloseTo(0, 5);
  });
});
