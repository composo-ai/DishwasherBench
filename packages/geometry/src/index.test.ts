// The package through its public entry point only: what another package sees.
import { describe, expect, it } from 'vitest';
import * as geometry from './index.ts';
import {
  COLLISION_CHORD_ERROR,
  RENDER_CHORD_ERROR,
  boundingBox,
  buildCollisionPieces,
  buildRenderMesh,
  computeMassProperties,
  expandGeometry,
  expandGeometryMm,
  geometryKernel,
  meshTopology,
  meshVolume,
  sectorCount,
  shapeVolume,
  signedDistance,
  signedDistanceGradient,
  surfaceArea,
  type GeometryKernel,
  type Shape,
} from './index.ts';

describe('@spotless/geometry entry point', () => {
  it('exposes the eight contract functions, also collected as geometryKernel', () => {
    const kernel: GeometryKernel = geometryKernel;
    expect(kernel.expandGeometry).toBe(expandGeometry);
    expect(kernel.buildRenderMesh).toBe(buildRenderMesh);
    expect(kernel.buildCollisionPieces).toBe(buildCollisionPieces);
    expect(kernel.computeMassProperties).toBe(computeMassProperties);
    expect(kernel.signedDistance).toBe(signedDistance);
    expect(kernel.signedDistanceGradient).toBe(signedDistanceGradient);
    expect(kernel.boundingBox).toBe(boundingBox);
    expect(kernel.surfaceArea).toBe(surfaceArea);
    expect(Object.keys(kernel).sort()).toEqual([
      'boundingBox',
      'buildCollisionPieces',
      'buildRenderMesh',
      'computeMassProperties',
      'expandGeometry',
      'signedDistance',
      'signedDistanceGradient',
      'surfaceArea',
    ]);
    // Test-only modules are not part of the entry point.
    expect('EXAMPLE_ITEMS' in geometry).toBe(false);
    expect('testPrimitives' in geometry).toBe(false);
  });

  it('one definition yields consistent products: a 60 mm steel ball bearing in closed form', () => {
    // A ball as the simplest wire item: one polyline of a single point. Radius 30 mm, steel 7800.
    const shape: Shape = expandGeometryMm({
      class: 'wire',
      material: 'steel',
      wires: [{ pointsMm: [[0, 0, 30]], radiusMm: 30 }],
    });
    const r = 0.03;
    const volume = (4 / 3) * Math.PI * r ** 3;
    expect(shapeVolume(shape) / volume).toBeCloseTo(1, 14);
    const mass = computeMassProperties(shape, () => 7800);
    expect(mass.mass / (7800 * volume)).toBeCloseTo(1, 14);
    expect(mass.com[2]).toBeCloseTo(r, 15);
    expect(mass.inertia[0] / (0.4 * mass.mass * r * r)).toBeCloseTo(1, 13);
    expect(surfaceArea(shape) / (4 * Math.PI * r * r)).toBeCloseTo(1, 14);
    expect(surfaceArea(shape, 'wire')).toBeCloseTo(surfaceArea(shape), 15);
    const box = boundingBox(shape);
    expect(box.min[2]).toBeCloseTo(0, 15);
    expect(box.max[2]).toBeCloseTo(0.06, 15);
    expect(signedDistance(shape, [0, 0, 0.1])).toBeCloseTo(0.04, 15);
    expect(signedDistanceGradient(shape, [0.1, 0, 0.03])).toEqual([1, 0, 0]);
    const pieces = buildCollisionPieces(shape, { chordError: COLLISION_CHORD_ERROR });
    expect(pieces).toEqual([
      {
        kind: 'capsule',
        part: 'wire.0.0',
        material: 'steel',
        a: [0, 0, 0.03],
        b: [0, 0, 0.03],
        radius: 0.03,
      },
    ]);
    const mesh = buildRenderMesh(shape, { chordError: RENDER_CHORD_ERROR });
    expect(meshTopology(mesh).closed).toBe(true);
    // An inscribed mesh of a sphere within 0.1 mm: its volume is short by less than area * 0.1 mm.
    expect(meshVolume(mesh)).toBeLessThan(volume);
    expect(volume - meshVolume(mesh)).toBeLessThan(4 * Math.PI * r * r * RENDER_CHORD_ERROR);
    expect(mesh.partIds).toEqual(['wire.0.0']);
    expect(mesh.regionIds).toEqual(['wire']);
  });

  it('sectorCount is the platform rule of section 4.2', () => {
    // docs/research/items.md 5.3: 37, 28 and 20 sectors for R = 135, 75 and 40 mm at 0.5 mm.
    expect(sectorCount(0.135, COLLISION_CHORD_ERROR, 16)).toBe(37);
    expect(sectorCount(0.075, COLLISION_CHORD_ERROR, 16)).toBe(28);
    expect(sectorCount(0.04, COLLISION_CHORD_ERROR, 16)).toBe(20);
    expect(sectorCount(0.005, COLLISION_CHORD_ERROR, 16)).toBe(16);
    expect(() => sectorCount(0.1, 0, 16)).toThrow(RangeError);
  });
});
