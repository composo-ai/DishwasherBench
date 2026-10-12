import { POSE_IDENTITY, quatFromAxisAngle, type Pose, type Vec3 } from '@spotless/core';
import { describe, expect, it } from 'vitest';
import { expandGeometryMm, type GeometryDefMm } from './authoring.ts';
import { EXAMPLE_ITEMS } from './example-items.ts';
import { buildRenderMesh } from './mesh.ts';
import { sampleSignedDistance, surfaceRegionAt } from './sdf.ts';
import { DOSSIER_PROFILES_MM, profileMm, testPrimitives } from './test-util.ts';
import type { Shape } from './types.ts';

/**
 * Compares `surfaceRegionAt` at the centroid of every triangle of the render mesh with the
 * region the mesh tagged the triangle with. Triangles hidden inside another part, or nearer to
 * another part than to their own (at joints), are skipped. Returns the counts.
 */
function compare(shape: Shape, chordError: number): { compared: number; different: number } {
  const mesh = buildRenderMesh(shape, { chordError });
  let compared = 0;
  let different = 0;
  for (let t = 0; t < mesh.indices.length / 3; t++) {
    const c: Vec3 = [0, 1, 2].map((k) => {
      let sum = 0;
      for (let j = 0; j < 3; j++)
        sum += mesh.positions[3 * (mesh.indices[3 * t + j] as number) + k] as number;
      return sum / 3;
    }) as unknown as Vec3;
    const sample = sampleSignedDistance(shape, c);
    if (sample.part !== mesh.triPart[t] || sample.distance < -chordError) continue;
    compared++;
    if (surfaceRegionAt(shape, c) !== mesh.triRegion[t]) different++;
  }
  return { compared, different };
}

const POSE: Pose = { p: [0.02, -0.01, 0.03], q: quatFromAxisAngle([2, 1, 3], 0.8) };

describe('surfaceRegionAt', () => {
  it('names the well, the rim, the underside and the foot of a plate at points on them', () => {
    const shape = expandGeometryMm({
      class: 'sor',
      material: 'porcelain',
      profileMm: DOSSIER_PROFILES_MM.plateIec,
      footRing: { rMm: 80, widthMm: 5, heightMm: 4 },
    });
    const id = (p: Vec3): string | undefined => shape.regions[surfaceRegionAt(shape, p)]?.id;
    expect(id([0.03, 0.01, 0.0051])).toBe('well'); // on the flat of the food side
    expect(id([0.03, 0.01, 0.02])).toBe('well'); // 15 mm above it
    expect(id([0.115, 0, 0.0193])).toBe('rim'); // on the lip, food side
    expect(id([0.03, 0, 0.0009])).toBe('underside');
    expect(id([-0.05, 0.02, -0.01])).toBe('underside'); // below the plate, inside the foot ring
    expect(id([0.08, 0, -0.001])).toBe('foot'); // under the foot ring
    // The rim circle is centred on (130, 24) mm and the lip arrives along u = (32, 15) / 35.3;
    // its crest is 2.1 mm along u. Half a millimetre to the left of u is the food side.
    expect(id([0.13178, 0, 0.025387])).toBe('rim');
    expect(id([0.132204, 0, 0.024481])).toBe('underside');
  });

  it('agrees with the tags of the render mesh on every kind of primitive', () => {
    for (const [name, prim] of Object.entries(testPrimitives())) {
      const shape: Shape = {
        parts: [{ id: 'body', prim, pose: POSE, material: 'm' }],
        regions: [
          { id: 'in-near', part: 'body', side: 'in', sRange: [0, 0.4] },
          { id: 'in-far', part: 'body', side: 'in', sRange: [0.4, 1] },
          { id: 'out', part: 'body', side: 'out' },
          { id: 'rest', part: 'body' },
        ],
      };
      const { compared, different } = compare(shape, 0.0002);
      expect(compared, name).toBeGreaterThan(10);
      // On a hull that is tilted in its part frame the line between the two sides crosses
      // facets, which the mesh tags whole: up to 3 % of them differ. Elsewhere none do.
      const tilted = name === 'hull' || name === 'triangle' || name === 'wedge';
      expect(different / compared, name).toBeLessThanOrEqual(tilted ? 0.03 : 0);
    }
  });

  it('agrees with the tags of the render mesh on the example items', () => {
    for (const [name, item] of Object.entries(EXAMPLE_ITEMS)) {
      const shape = expandGeometryMm(item.def as GeometryDefMm);
      const { compared, different } = compare(shape, 0.0002);
      expect(compared, name).toBeGreaterThan(500);
      expect(different / compared, name).toBeLessThanOrEqual(name === 'knife' ? 0.03 : 0.002);
    }
  });

  it('gives -1 where the nearest surface is in no region, and follows the nearest part', () => {
    const shape: Shape = {
      parts: [
        {
          id: 'cup',
          prim: { kind: 'sor', profile: profileMm(DOSSIER_PROFILES_MM.mug) },
          pose: POSE_IDENTITY,
          material: 'm',
        },
        {
          id: 'ball',
          prim: { kind: 'capsule', a: [0.1, 0, 0.05], b: [0.1, 0, 0.05], radius: 0.01 },
          pose: POSE_IDENTITY,
          material: 'm',
        },
      ],
      regions: [{ id: 'inside', part: 'cup', side: 'in' }],
    };
    expect(surfaceRegionAt(shape, [0, 0, 0.05])).toBe(0); // in the cavity
    expect(surfaceRegionAt(shape, [-0.06, 0, 0.05])).toBe(-1); // outside the wall
    expect(surfaceRegionAt(shape, [0.1, 0.02, 0.05])).toBe(-1); // next to the ball
  });
});
