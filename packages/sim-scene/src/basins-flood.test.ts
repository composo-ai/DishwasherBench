// Basins of hollows that are not bodies of revolution (review of the first build: an upright
// box-shaped vessel held no water): the terrain fill of `basins-flood.ts` against an
// independent column integral of the kernel's signed distance, at both block sizes, and the
// cell graph of a thin-walled vessel (no way from its floor round an edge that a wall covers).
import { POSE_IDENTITY, quatFromAxisAngle, type Pose } from '@spotless/core';
import { boundingBox, signedDistance, type Shape } from '@spotless/geometry';
import { describe, expect, it } from 'vitest';
import { buildWashScene } from './scene.ts';
import { BLOCK_FLAG, type WashScene } from './scene-types.ts';
import { catalogueItem, catalogueMaterial, instantiate } from './testing/catalogue.ts';

/**
 * Brimful volume of an upright open vessel by an independent route: over a grid of vertical
 * lines, the depth from the level of its highest point down to the first solid below (sphere
 * tracing of the kernel's signed distance), summed over the lines that meet solid at all. A
 * line outside the vessel meets none; a line through the rim meets it at once. m3.
 */
function brimfulByColumns(shape: Shape, step = 1e-3): number {
  const box = boundingBox(shape);
  const level = box.max[2] - 1e-5;
  let volume = 0;
  for (let x = box.min[0] + step / 2; x < box.max[0]; x += step) {
    for (let y = box.min[1] + step / 2; y < box.max[1]; y += step) {
      let z = level;
      for (;;) {
        const d = signedDistance(shape, [x, y, z]);
        if (d <= 1e-6) break;
        z -= d;
        if (z < box.min[2]) break;
      }
      if (z >= box.min[2]) volume += (level - z) * step * step;
    }
  }
  return volume;
}

function sceneOf(type: string, blockSize: number, pose: Pose = POSE_IDENTITY): WashScene {
  return buildWashScene({
    items: [catalogueItem('item', type, pose)],
    machine: [],
    blockSize,
    materials: catalogueMaterial,
  });
}

describe('an upright food container (a box shell of thin sheets)', () => {
  const type = 'food_container_1l';
  const reference = brimfulByColumns(instantiate(type).shape);

  it('holds what the column integral of its interior says, at both block sizes', () => {
    // 24,200 mm2 of floor under 64.6 mm of wall that leans out: about 1.6 L to the brim.
    expect(reference * 1e6).toBeGreaterThan(1450);
    expect(reference * 1e6).toBeLessThan(1750);
    const volumes = [0.004, 0.002].map((blockSize) => {
      const scene = sceneOf(type, blockSize);
      expect(scene.basins).toHaveLength(1);
      const basin = scene.basins[0]!;
      expect(Math.abs(basin.volume - reference) / reference, `${blockSize}`).toBeLessThan(0.05);
      // The water stands up to the flange: 64 to 66 mm over the floor.
      expect(basin.spillLevel - basin.floorLevel).toBeGreaterThan(0.062);
      expect(basin.spillLevel - basin.floorLevel).toBeLessThan(0.067);
      // The level table rises from empty to the volume.
      expect(basin.levelTable[1]).toBe(0);
      for (let k = 1; k < basin.levelTable.length / 2; k++) {
        expect(basin.levelTable[2 * k + 1]!).toBeGreaterThanOrEqual(basin.levelTable[2 * k - 1]!);
      }
      expect(basin.levelTable[basin.levelTable.length - 1]).toBeCloseTo(basin.volume, 9);
      // Its blocks are those of the inside: under the level, flagged, none looking down.
      expect(basin.blocks.length).toBeGreaterThan(1000);
      basin.blocks.forEach((b, i) => {
        expect(scene.blocks.flags[b]! & BLOCK_FLAG.basin).not.toBe(0);
        expect(basin.depth[i]).toBeGreaterThan(0);
        expect(scene.blocks.normal[3 * b + 2]).toBeGreaterThan(-0.2);
      });
      // The crest it spills over is at the level and belongs to the item.
      expect(scene.blocks.centre[3 * basin.spillBlock + 2]).toBeCloseTo(basin.spillLevel, 6);
      return basin.volume;
    });
    // The two block sizes agree with each other.
    expect(volumes[1]! / volumes[0]!).toBeGreaterThan(0.97);
    expect(volumes[1]! / volumes[0]!).toBeLessThan(1.03);
  });

  it('holds nothing upside down, and less when it is tipped', () => {
    const inverted = sceneOf(type, 0.004, {
      p: [0, 0, 0.1],
      q: quatFromAxisAngle([1, 0, 0], Math.PI),
    });
    expect(inverted.basins).toHaveLength(0);
    const level = sceneOf(type, 0.004).basins[0]!.volume;
    const tipped = sceneOf(type, 0.004, { p: [0, 0, 0.1], q: quatFromAxisAngle([1, 0, 0], 0.2) });
    expect(tipped.basins).toHaveLength(1);
    // Tipped 11.5 degrees about its long axis, the low side spills 0.2 x 130 mm = 26 mm sooner
    // at the far wall: it keeps between a half and nine tenths.
    expect(tipped.basins[0]!.volume / level).toBeGreaterThan(0.5);
    expect(tipped.basins[0]!.volume / level).toBeLessThan(0.9);
  });

  it('has no way in its cell graph from the floor to its own underside', () => {
    // The edge of the floor sheet is covered by the walls that stand on it: a film on the
    // floor does not run round that edge. (It did: the seam across every edge of a part was
    // linked whether the edge was surface of the shape or not.)
    for (const blockSize of [0.004, 0.002]) {
      const scene = sceneOf(type, blockSize);
      const { blocks, graph, parts } = scene;
      let floor = 0;
      for (let b = 0; b < blocks.count; b++) {
        if (!parts[blocks.part[b]!]!.id.startsWith('floor') || blocks.normal[3 * b + 2]! < 0.9)
          continue;
        floor++;
        for (let e = graph.offsets[b]!; e < graph.offsets[b + 1]!; e++) {
          const other = graph.neighbour[e]!;
          // No neighbour of a floor block looks down, and none lies below the floor.
          expect(blocks.normal[3 * other + 2]).toBeGreaterThan(-0.5);
          expect(blocks.centre[3 * other + 2]! - blocks.centre[3 * b + 2]!).toBeGreaterThan(-1e-4);
        }
      }
      expect(floor).toBeGreaterThan(500);
    }
  });
});

describe('other hollows', () => {
  it('finds the brimful volume of a loaf tin, a lunch box and a stoneware dish', () => {
    // Thin sheet: within 6 %. The stoneware dish has walls 6 mm thick that lean and a wide
    // rounding at the floor, of which a 4 mm block grid keeps less: within 10 %, low.
    const cases: readonly (readonly [string, number])[] = [
      ['loaf_pan_nonstick_210', 0.06],
      ['lunch_box_2l', 0.06],
      ['oven_dish_stoneware_320', 0.1],
    ];
    for (const [type, tolerance] of cases) {
      const reference = brimfulByColumns(instantiate(type).shape, 2e-3);
      const scene = sceneOf(type, 0.004);
      expect(scene.basins, type).toHaveLength(1);
      const error = (scene.basins[0]!.volume - reference) / reference;
      expect(Math.abs(error), type).toBeLessThan(tolerance);
    }
  });

  it('finds the few millilitres a soup spoon lying face up holds', () => {
    // A tablespoon holds 15 mL heaped to its rim; the bowl of the catalogue soup spoon, level
    // with its lowest rim point, 5 to 12 mL.
    for (const blockSize of [0.004, 0.002]) {
      const scene = sceneOf('soup_spoon_190', blockSize);
      expect(scene.basins).toHaveLength(1);
      expect(scene.basins[0]!.volume * 1e6).toBeGreaterThan(5);
      expect(scene.basins[0]!.volume * 1e6).toBeLessThan(12);
      expect(scene.basins[0]!.parts).toEqual(['head']);
    }
  });

  it('leaves the cavity of a body of revolution to the closed form: a mug has one basin', () => {
    const scene = sceneOf('mug_ceramic_300', 0.004);
    expect(scene.basins).toHaveLength(1);
    // The closed form walks the union of body and foot.
    expect(scene.basins[0]!.parts).toContain('body');
    expect(scene.basins[0]!.volume * 1e6).toBeGreaterThan(300);
  });
});
