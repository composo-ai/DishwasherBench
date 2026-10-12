import type { Vec3 } from '@spotless/core';
import { describe, expect, it } from 'vitest';
import { surfaceArea } from './area.ts';
import { expandGeometryMm, type GeometryDefMm } from './authoring.ts';
import { boundingBox } from './bounds.ts';
import { buildCollisionPieces } from './collision.ts';
import { EXAMPLE_ITEMS, type ExampleItem } from './example-items.ts';
import { computeMassProperties } from './mass.ts';
import { meshTopology } from './mesh-metrics.ts';
import { buildRenderMesh } from './mesh.ts';
import { signedDistance } from './sdf.ts';
import { surfaceGap } from './test-util.ts';
import { COLLISION_CHORD_ERROR, RENDER_CHORD_ERROR, type Shape } from './types.ts';

type Name = keyof typeof EXAMPLE_ITEMS;

const shapes = new Map<Name, Shape>();
function shapeOf(name: Name): Shape {
  let shape = shapes.get(name);
  if (shape === undefined) {
    shape = expandGeometryMm(EXAMPLE_ITEMS[name].def as GeometryDefMm);
    shapes.set(name, shape);
  }
  return shape;
}

function massOf(name: Name): ReturnType<typeof computeMassProperties> {
  const item: ExampleItem = EXAMPLE_ITEMS[name];
  return computeMassProperties(shapeOf(name), (material) => {
    const density = item.densities[material];
    if (density === undefined) throw new Error(`no density for '${material}'`);
    return density;
  });
}

/**
 * How far the collision pieces may be from the true surface, per item, in metres: the chord
 * error; plus half of it where the wall thickness varies along the profile; plus the documented
 * rim approximation of the stretched spoon bowl, t / 2 * (1 - 42 / 62). Items made only of
 * capsules, boxes and hulls map exactly.
 */
const COLLISION_BOUND: Record<Name, number> = {
  dinnerPlate: COLLISION_CHORD_ERROR,
  bowl: COLLISION_CHORD_ERROR,
  mug: 1.5 * COLLISION_CHORD_ERROR,
  tumbler: 1.5 * COLLISION_CHORD_ERROR,
  wineGlass: 1.5 * COLLISION_CHORD_ERROR,
  fork: 0,
  spoon: COLLISION_CHORD_ERROR + 0.00075 * (1 - 42 / 62),
  knife: 0,
  foodContainer: COLLISION_CHORD_ERROR,
};

/** Outer size along x, y and z in millimetres, with the tolerance to check it to. */
const OUTER_SIZE_MM: Record<Name, readonly [number, number, number, number]> = {
  dinnerPlate: [270, 270, 29.6, 0.01], // D 270, H 30 [VERIFIED]
  bowl: [160, 160, 70, 0.01], // D 160, H 70 [VERIFIED]
  mug: [80 + 29.6, 80, 100, 0.2], // D 80, H 100 [VERIFIED], handle 30 mm beyond the wall
  tumbler: [87, 87, 90, 0.01], // D 87, H 90 [VERIFIED]
  wineGlass: [92, 92, 244, 0.5], // D 92, H 244 [VERIFIED]
  // Cutlery: the rounded ends add half a thickness at the handle end and at the tip.
  fork: [1.5 + 136 + 53 + 1.1, 24, 3, 0.01], // L 185 to 211 [VERIFIED]
  spoon: [1.5 + 128 + 62 + 0.75, (62 + 1.5) * (42 / 62), 9.75 + 1.5, 0.01], // L 190 [VERIFIED]
  knife: [3.5 + 100 + 120, 19, 7, 0.01], // L 210 to 248 [VERIFIED]
  foodContainer: [178, 128, 60, 0.01], // 170 x 120 x 60 plus a 4 mm flange
};

describe('example items', () => {
  for (const name of Object.keys(EXAMPLE_ITEMS) as Name[]) {
    const item: ExampleItem = EXAMPLE_ITEMS[name];

    it(`${name}: expands into a valid shape whose regions cover its outer surface`, () => {
      const shape = shapeOf(name);
      expect(shape.parts.length).toBeGreaterThan(0);
      expect(shape.regions.length).toBeGreaterThan(0);
      for (const part of shape.parts) expect(Object.keys(item.densities)).toContain(part.material);
      const total = surfaceArea(shape);
      const ids = [...new Set(shape.regions.map((r) => r.id))];
      const covered = ids.reduce((sum, id) => sum + surfaceArea(shape, id), 0);
      for (const id of ids) expect(surfaceArea(shape, id)).toBeGreaterThan(0);
      // Only buried faces are in no region: the ends of the straight pieces of a box shell and
      // the end faces of its corner pieces.
      expect(covered / total).toBeGreaterThan(name === 'foodContainer' ? 0.97 : 1 - 1e-12);
      expect(covered / total).toBeLessThanOrEqual(1 + 1e-12);
    });

    it(`${name}: has the mass the items dossier gives (${item.massSource})`, () => {
      const m = massOf(name);
      expect(Number.isFinite(m.mass)).toBe(true);
      expect(m.mass).toBeGreaterThanOrEqual(item.massRangeKg[0]);
      expect(m.mass).toBeLessThanOrEqual(item.massRangeKg[1]);
      for (const x of [...m.com, ...m.inertia]) expect(Number.isFinite(x)).toBe(true);
      // A physical inertia tensor: positive principal moments obeying the triangle inequality.
      expect(m.inertia[0]).toBeGreaterThan(0);
      expect(m.inertia[4]).toBeGreaterThan(0);
      expect(m.inertia[8]).toBeGreaterThan(0);
      expect(m.inertia[0] + m.inertia[4]).toBeGreaterThanOrEqual(m.inertia[8] * (1 - 1e-12));
      expect(m.inertia[4] + m.inertia[8]).toBeGreaterThanOrEqual(m.inertia[0] * (1 - 1e-12));
      expect(m.inertia[0] + m.inertia[8]).toBeGreaterThanOrEqual(m.inertia[4] * (1 - 1e-12));
    });

    it(`${name}: stands on z = 0 and has the outer dimensions of the product`, () => {
      const box = boundingBox(shapeOf(name));
      const [sx, sy, sz, tolerance] = OUTER_SIZE_MM[name];
      expect(Math.abs(box.min[2]) * 1000).toBeLessThanOrEqual(1e-6);
      expect(Math.abs((box.max[0] - box.min[0]) * 1000 - sx)).toBeLessThanOrEqual(tolerance);
      expect(Math.abs((box.max[1] - box.min[1]) * 1000 - sy)).toBeLessThanOrEqual(tolerance);
      expect(Math.abs((box.max[2] - box.min[2]) * 1000 - sz)).toBeLessThanOrEqual(tolerance);
    });

    it(`${name}: the render mesh is closed part by part and lies on the signed distance's zero set`, () => {
      const shape = shapeOf(name);
      const mesh = buildRenderMesh(shape, { chordError: RENDER_CHORD_ERROR });
      shape.parts.forEach((part, index) => {
        expect(meshTopology(mesh, index).closed, part.id).toBe(true);
      });
      // No vertex is outside the shape: a vertex is either on its surface or inside another
      // part (at a joint). Every part shows some of its surface.
      const vertices = mesh.positions.length / 3;
      const exposed = new Uint8Array(vertices);
      for (let v = 0; v < vertices; v++) {
        const d = signedDistance(shape, [
          mesh.positions[3 * v] as number,
          mesh.positions[3 * v + 1] as number,
          mesh.positions[3 * v + 2] as number,
        ]);
        expect(d).toBeLessThanOrEqual(2e-8);
        if (d > -2e-8) exposed[v] = 1;
      }
      const shown = shape.parts.map(() => 0);
      for (let t = 0; t < mesh.indices.length / 3; t++) {
        const partIndex = mesh.triPart[t] as number;
        for (let j = 0; j < 3; j++)
          shown[partIndex] =
            (shown[partIndex] as number) + (exposed[mesh.indices[3 * t + j] as number] as number);
      }
      shape.parts.forEach((part, index) => expect(shown[index], part.id).toBeGreaterThan(0));
      // No facet strays outside by more than the chord error.
      for (let t = 0; t < mesh.indices.length / 3; t++) {
        const c: Vec3 = [0, 1, 2].map((k) => {
          let sum = 0;
          for (let j = 0; j < 3; j++)
            sum += mesh.positions[3 * (mesh.indices[3 * t + j] as number) + k] as number;
          return sum / 3;
        }) as unknown as Vec3;
        expect(signedDistance(shape, c)).toBeLessThanOrEqual(RENDER_CHORD_ERROR + 2e-8);
      }
      // Every triangle is tagged with a region unless it is one of a box shell's buried faces.
      let tagged = 0;
      for (const region of mesh.triRegion) if (region >= 0) tagged++;
      expect(tagged / mesh.triRegion.length).toBeGreaterThan(
        name === 'foodContainer' ? 0.8 : 1 - 1e-12,
      );
    });

    it(`${name}: the collision pieces follow the signed distance's zero set within ${(COLLISION_BOUND[name] * 1000).toFixed(2)} mm`, () => {
      const shape = shapeOf(name);
      const pieces = buildCollisionPieces(shape, { chordError: COLLISION_CHORD_ERROR });
      expect(pieces.length).toBeGreaterThan(0);
      for (const piece of pieces) {
        expect(shape.parts.some((part) => part.id === piece.part)).toBe(true);
        if (piece.kind !== 'round') expect(piece.radius).toBeGreaterThan(0);
      }
      const gap = surfaceGap(shape, pieces);
      expect(gap.samples).toBeGreaterThan(100);
      expect(gap.piecesToTrue).toBeLessThanOrEqual(COLLISION_BOUND[name] + 2e-6);
      expect(gap.trueToPieces).toBeLessThanOrEqual(COLLISION_BOUND[name] + 2e-6);
    });
  }

  it('the plate balances where the dossier model does: centre of mass about 11 mm up', () => {
    // items.md 10.2: IKEA 365+ plate, model z_c = 11 mm [ESTIMATED].
    const m = massOf('dinnerPlate');
    expect(m.com[0]).toBe(0);
    expect(m.com[1]).toBe(0);
    expect(Math.abs(m.com[2] * 1000 - 11)).toBeLessThanOrEqual(1.5);
    // A disc-like body: the moment about the axis is about twice the transverse ones.
    expect(m.inertia[8] / m.inertia[0]).toBeGreaterThan(1.8);
    expect(m.inertia[8] / m.inertia[0]).toBeLessThan(2.0);
  });

  it('the handle pulls the centre of mass of the mug a few millimetres towards itself', () => {
    // items.md 10.2: "mug 7 mm toward the handle" for a 45 g handle [ESTIMATED]; this handle
    // (12 x 8 mm section) weighs about half of that.
    const m = massOf('mug');
    expect(m.com[0] * 1000).toBeGreaterThan(2);
    expect(m.com[0] * 1000).toBeLessThan(8);
    expect(Math.abs(m.com[1])).toBeLessThanOrEqual(1e-12);
  });

  it('the wine glass is top-heavy as the dossier says: centre of mass at 43 to 47 % of its height', () => {
    // items.md 10.2: stemware COM at 43 to 47 % of total height [ESTIMATED]; model z_c 114 mm.
    const m = massOf('wineGlass');
    expect(m.com[2] / 0.244).toBeGreaterThan(0.43);
    expect(m.com[2] / 0.244).toBeLessThan(0.48);
  });

  it('cutlery is long and thin: the inertia about its length is far below the transverse ones', () => {
    for (const name of ['fork', 'spoon', 'knife'] as const) {
      const m = massOf(name);
      expect(m.inertia[0]).toBeLessThan(0.05 * m.inertia[4]);
      expect(m.inertia[4] / m.inertia[8]).toBeGreaterThan(0.9);
      expect(m.inertia[4] / m.inertia[8]).toBeLessThan(1.1);
    }
  });

  it('piece counts stay modest: at most 150 solid collision pieces per item at 0.5 mm', () => {
    for (const name of Object.keys(EXAMPLE_ITEMS) as Name[]) {
      const pieces = buildCollisionPieces(shapeOf(name), { chordError: COLLISION_CHORD_ERROR });
      const rounds = pieces.filter((piece) => piece.kind === 'round').length;
      expect(pieces.length - rounds, name).toBeLessThanOrEqual(150);
      // The round rolling surfaces are a handful per shell: one per stretch of wall, a few
      // chords per rim.
      expect(rounds, name).toBeLessThanOrEqual(24);
    }
  });
});
