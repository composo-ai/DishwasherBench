// Workspace wiring smoke test created by the platform scaffold. The package owner may replace it
// with real tests; keep at least one test in the package so `pnpm test` exercises it.
import { POSE_IDENTITY, v3Add } from '@spotless/core';
import { describe, expect, it } from 'vitest';
import { COLLISION_CHORD_ERROR, RENDER_CHORD_ERROR, type Shape } from './index.ts';

/** Sector count of platform.md section 4.2 for maximum radius R (m) and chord error e (m). */
function sectors(radius: number, chordError: number): number {
  return Math.ceil(Math.PI / Math.acos(1 - chordError / radius));
}

describe('@spotless/geometry skeleton', () => {
  it('resolves @spotless/core from TypeScript source', () => {
    expect(v3Add([1, 2, 3], [4, 5, 6])).toEqual([5, 7, 9]);
  });

  it('the contract types describe a dinner plate', () => {
    // IEC-type dinner plate profile, docs/research/items.md section 10.2 [ESTIMATED], in metres.
    const plate: Shape = {
      parts: [
        {
          id: 'body',
          prim: {
            kind: 'sor',
            profile: [
              { r: 0, z: 0.003, t: 0.0042 },
              { r: 0.085, z: 0.003, t: 0.0042 },
              { r: 0.098, z: 0.009, t: 0.0042 },
              { r: 0.13, z: 0.024, t: 0.0042 },
            ],
          },
          pose: POSE_IDENTITY,
          material: 'porcelain_glazed',
        },
      ],
      regions: [{ id: 'well', part: 'body', side: 'in', sRange: [0, 0.6] }],
    };
    expect(plate.parts).toHaveLength(1);
    expect(plate.regions[0]?.part).toBe(plate.parts[0]?.id);
  });

  it('the collision chord error reproduces the sector counts tabulated in the items dossier', () => {
    // docs/research/items.md section 5.3: N = 37 for a dinner plate (R = 135 mm), 28 for a bowl
    // (75 mm), 20 for a cup (40 mm) at a chord error of 0.5 mm. Exact integers, no tolerance.
    expect(sectors(0.135, COLLISION_CHORD_ERROR)).toBe(37);
    expect(sectors(0.075, COLLISION_CHORD_ERROR)).toBe(28);
    expect(sectors(0.04, COLLISION_CHORD_ERROR)).toBe(20);
    expect(RENDER_CHORD_ERROR).toBeLessThan(COLLISION_CHORD_ERROR);
  });
});
