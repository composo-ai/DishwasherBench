// Basins (docs/design/sim-core.md section 3.7 item 5 and M3 "Tests"; scene brief item 4): the
// volume an upward-facing cavity of a body of revolution holds before it spills, against the
// capacity of a catalogue mug and against a hand calculation for a tilted recess.
import { POSE_IDENTITY, quatFromAxisAngle, type Pose } from '@spotless/core';
import { boundingBox, signedDistance, type Shape } from '@spotless/geometry';
import { describe, expect, it } from 'vitest';
import { BASIN_LEVELS } from './params.ts';
import { buildWashScene } from './scene.ts';
import { BLOCK_FLAG, SCENE_NONE, type SceneBasin, type WashScene } from './scene-types.ts';
import { catalogueItem, catalogueMaterial, instantiate } from './testing/catalogue.ts';
import { testMaterial } from './testing/shapes.ts';

const materials = (id: string) => (id === 'test' ? testMaterial(id) : catalogueMaterial(id));

/**
 * Brimful volume of an upright vessel of revolution by an independent route: at every height
 * the free radius about the axis (sphere tracing of the kernel's signed distance outwards from
 * the axis), summed as discs from the brim down to the floor. m3.
 */
function brimfulByDiscs(shape: Shape): number {
  const box = boundingBox(shape);
  const dz = 0.02e-3;
  let volume = 0;
  for (let z = box.max[2] - dz / 2; z > box.min[2]; z -= dz) {
    if (signedDistance(shape, [0, 0, z]) <= 0) break;
    let r = 0;
    for (;;) {
      const d = signedDistance(shape, [r, 0, z]);
      if (d <= 1e-8) break;
      r += d;
    }
    volume += Math.PI * r * r * dz;
  }
  return volume;
}

/**
 * Water a flat-floored round recess of radius R and depth d holds when tilted by `alpha`: the
 * surface passes through the lowest point of the rim, so the depth of water over the floor at a
 * distance x up the slope from the centre is d - (x + R) tan(alpha). Integrated over the disc
 * by the midpoint rule. m3.
 */
function tiltedRecess(R: number, d: number, alpha: number): number {
  const n = 200000;
  const tan = Math.tan(alpha);
  let volume = 0;
  for (let i = 0; i < n; i++) {
    const x = -R + ((i + 0.5) * 2 * R) / n;
    const depth = d - (x + R) * tan;
    if (depth <= 0) break;
    volume += depth * 2 * Math.sqrt(R * R - x * x) * ((2 * R) / n);
  }
  return volume;
}

const only = (scene: WashScene): SceneBasin => {
  expect(scene.basins).toHaveLength(1);
  return scene.basins[0] as SceneBasin;
};

describe('the basin of an upright catalogue mug', () => {
  const type = 'mug_ceramic_300';
  const shape = instantiate(type).shape;
  const scene = buildWashScene({
    items: [catalogueItem('mug', type, POSE_IDENTITY)],
    machine: [],
    blockSize: 0.004,
    materials,
  });
  const basin = only(scene);

  it('holds its brimful capacity: the disc integral of its interior, and a little over its nominal 300 ml', () => {
    const discs = brimfulByDiscs(shape);
    expect(Math.abs(basin.volume - discs) / discs).toBeLessThan(0.003);
    // The product is sold as a 300 ml mug; to the brim it holds somewhat more.
    expect(basin.volume * 1e6).toBeGreaterThan(300);
    expect(basin.volume * 1e6).toBeLessThan(1.2 * 300);
    expect(basin.opening).toBe(1);
    expect(basin.parts).toContain('body');
  });

  it('spills over the top of its rim, and is under water from the floor up', () => {
    const top = boundingBox(shape).max[2];
    expect(Math.abs(basin.spillLevel - top)).toBeLessThan(2e-4);
    expect(basin.floorLevel).toBeGreaterThan(0.002);
    expect(basin.floorLevel).toBeLessThan(0.02);
    expect(Math.abs(basin.spillPoint[2] - top)).toBeLessThan(2e-4);
    expect(basin.spillBlock).not.toBe(SCENE_NONE);
    // The wetted blocks are the inside of the mug: the interior region and the inner half of the rim.
    const regions = scene.instances[0]?.shape.regions ?? [];
    let area = 0;
    basin.blocks.forEach((block, k) => {
      expect((scene.blocks.flags[block] as number) & BLOCK_FLAG.basin).toBe(BLOCK_FLAG.basin);
      expect(['interior', 'rim']).toContain(regions[scene.blocks.region[block] as number]?.id);
      expect(basin.depth[k]).toBeGreaterThan(0);
      expect(basin.depth[k]).toBeLessThanOrEqual(basin.spillLevel - basin.floorLevel + 1e-6);
      area += scene.blocks.area[block] as number;
      if (k > 0) expect(block).toBeGreaterThan(basin.blocks[k - 1] as number);
    });
    // About the area of the inside of a mug 80 mm across and 90 mm deep.
    expect(area).toBeGreaterThan(0.015);
    expect(area).toBeLessThan(0.035);
  });

  it('has a level table that rises from empty to the volume at the spill level', () => {
    expect(basin.levelTable).toHaveLength(2 * BASIN_LEVELS);
    expect(basin.levelTable[0]).toBe(0);
    expect(basin.levelTable[1]).toBe(0);
    for (let j = 1; j < BASIN_LEVELS; j++) {
      expect(basin.levelTable[2 * j]).toBeGreaterThan(basin.levelTable[2 * j - 2] as number);
      expect(basin.levelTable[2 * j + 1]).toBeGreaterThan(basin.levelTable[2 * j - 1] as number);
    }
    expect(basin.levelTable[2 * BASIN_LEVELS - 1]).toBeCloseTo(basin.volume, 12);
    expect(basin.levelTable[2 * BASIN_LEVELS - 2]).toBeCloseTo(
      basin.spillLevel - basin.floorLevel,
      6,
    );
    // Half full by depth: the volume of the lower half of a nearly cylindrical cavity.
    const half = basin.levelTable[2 * (BASIN_LEVELS / 2) + 1] as number;
    expect(half / basin.volume).toBeGreaterThan(0.4);
    expect(half / basin.volume).toBeLessThan(0.55);
  });
});

describe('a tilted round recess, R = 25 mm and 3 mm deep', () => {
  // A thin-walled dish whose inner faces are a flat floor of radius 25 mm and an upright wall
  // 3 mm high (the base recess of a mug). Its wall is 0.1 mm thick, so that its rounded rim
  // (radius 0.05 mm) is all but the sharp edge of the hand calculation.
  const t = 0.0001;
  const recess: Shape = {
    parts: [
      {
        id: 'dish',
        prim: {
          kind: 'sor',
          profile: [
            { r: 0, z: -t / 2, t },
            { r: 0.025 + t / 2, z: -t / 2, t },
            { r: 0.025 + t / 2, z: 0.003 - t / 2, t },
          ],
        },
        pose: POSE_IDENTITY,
        material: 'test',
      },
    ],
    regions: [{ id: 'inside', part: 'dish', side: 'in' }],
  };
  const tilted = (degrees: number): SceneBasin => {
    const pose: Pose = {
      p: [0.1, 0.05, 0.3],
      q: quatFromAxisAngle([0.6, 0.8, 0], (degrees * Math.PI) / 180),
    };
    return only(
      buildWashScene({
        items: [{ itemId: 'dish', typeId: 'test', shape: recess, pose, soils: [] }],
        machine: [],
        blockSize: 0.002,
        materials,
      }),
    );
  };

  it('holds 5.9 ml when level', () => {
    const basin = tilted(0);
    // pi R^2 d = 5.89 ml; the ring under the rounded rim adds under 0.1 %.
    expect(Math.abs(basin.volume * 1e6 - 5.89)).toBeLessThan(0.01);
    expect(Math.abs(basin.spillLevel - basin.floorLevel - 0.003)).toBeLessThan(1e-5);
  });

  it.each([
    [7, 1.21],
    [15, 0.4],
    [30, 0.13],
  ])(
    'holds the wedge of the hand calculation at %i degrees (%f ml in the contract)',
    (degrees, contractMl) => {
      const basin = tilted(degrees);
      const hand = tiltedRecess(0.025, 0.003, (degrees * Math.PI) / 180);
      // Against the exact integral of the circular segment: 2 % (the rounded rim lowers the
      // spill point of the dish by about 0.02 mm against the sharp edge of the hand calculation,
      // which is over 1 % of the thin wedge at 30 degrees). The contract quotes the same integral
      // to two figures (its tolerance is 3 %).
      expect(Math.abs(basin.volume - hand) / hand).toBeLessThan(0.02);
      expect(Math.abs(basin.volume * 1e6 - contractMl) / contractMl).toBeLessThan(0.03);
      // The water surface is level: the spill point is the lowest point of the rim.
      expect(Math.abs(basin.spillPoint[2] - basin.spillLevel)).toBeLessThan(1e-9);
      expect(basin.blocks.length).toBeGreaterThan(0);
    },
  );

  it('holds nothing once it is tipped past the vertical, and nothing upside down', () => {
    for (const degrees of [91, 135, 180]) {
      const pose: Pose = {
        p: [0, 0, 0.3],
        q: quatFromAxisAngle([1, 0, 0], (degrees * Math.PI) / 180),
      };
      const scene = buildWashScene({
        items: [{ itemId: 'dish', typeId: 'test', shape: recess, pose, soils: [] }],
        machine: [],
        blockSize: 0.004,
        materials,
      });
      expect(scene.basins).toHaveLength(0);
    }
  });
});

describe('an inverted mug', () => {
  const type = 'mug_ceramic_300';
  const shape = instantiate(type).shape;
  const height = boundingBox(shape).max[2];
  const scene = buildWashScene({
    items: [catalogueItem('mug', type, { p: [0, 0, height], q: [1, 0, 0, 0] })],
    machine: [],
    blockSize: 0.002,
    materials,
  });

  it('holds water in the recess of its base, between the base and the foot ring', () => {
    const basin = only(scene);
    expect(basin.opening).toBe(-1);
    // The recess is bounded by two parts: the underside of the body and the foot ring.
    expect(basin.parts).toEqual(expect.arrayContaining(['body', 'foot']));
    // A few millilitres (the catalogue notes about 7 ml for the foot recess of a mug), far less
    // than the mug itself.
    expect(basin.volume * 1e6).toBeGreaterThan(1);
    expect(basin.volume * 1e6).toBeLessThan(20);
    // It spills over the foot ring, which is now the top of the mug.
    expect(Math.abs(basin.spillLevel - height)).toBeLessThan(3e-4);
    // By an independent route: discs of free radius about the axis, in the mug turned over.
    const turned: Shape = {
      parts: shape.parts.map((part) => ({
        ...part,
        pose: {
          p: [part.pose.p[0], -part.pose.p[1], height - part.pose.p[2]],
          q: quatMulX(part.pose.q),
        },
      })),
      regions: shape.regions,
    };
    const discs = brimfulByDiscs(turned);
    expect(Math.abs(basin.volume - discs) / discs).toBeLessThan(0.01);
    const regions = scene.instances[0]?.shape.regions ?? [];
    for (const block of basin.blocks) {
      expect(['exterior', 'foot']).toContain(regions[scene.blocks.region[block] as number]?.id);
    }
    expect(basin.blocks.length).toBeGreaterThan(50);
  });
});

/** The rotation by pi about x applied after `q`: (1, 0, 0, 0) * q. */
function quatMulX(q: readonly [number, number, number, number]): [number, number, number, number] {
  const [x, y, z, w] = q;
  return [w, -z, y, -x];
}

describe('items that hold nothing', () => {
  it.each(['colander_steel_5qt', 'lid_glass_240', 'dinner_fork_185'])(
    '%s reports no basin',
    (type) => {
      const scene = buildWashScene({
        items: [catalogueItem('a', type, POSE_IDENTITY)],
        machine: [],
        blockSize: 0.004,
        materials,
      });
      expect(scene.basins).toHaveLength(0);
    },
  );

  it('a mug on its side holds only what lies below the lowest point of its rim', () => {
    const type = 'mug_ceramic_300';
    const upright = only(
      buildWashScene({
        items: [catalogueItem('a', type, POSE_IDENTITY)],
        machine: [],
        blockSize: 0.004,
        materials,
      }),
    );
    const leaning = buildWashScene({
      items: [
        catalogueItem('a', type, {
          p: [0, 0, 0.2],
          q: quatFromAxisAngle([1, 0, 0], (80 * Math.PI) / 180),
        }),
      ],
      machine: [],
      blockSize: 0.004,
      materials,
    });
    const basin = only(leaning);
    expect(basin.volume).toBeGreaterThan(0);
    expect(basin.volume).toBeLessThan(0.2 * upright.volume);
  });
});
