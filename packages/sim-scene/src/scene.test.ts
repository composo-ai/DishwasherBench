// The scene of a small load (scene brief, "Tests"): drip targets, contacts and near-contacts,
// gravity along the surface, the cell graph, and determinism of every buffer.
import { POSE_IDENTITY, quatFromAxisAngle, STANDARD_GRAVITY, type Pose } from '@spotless/core';
import { boundingBox, signedDistance, type Shape } from '@spotless/geometry';
import { createParamSet, createRegistry, SHARED_PARAM_DEFS } from '@spotless/sim-params';
import { describe, expect, it } from 'vitest';
import { DEFAULT_BURIED_DEPTH } from './atlas.ts';
import { resolveSceneParams, SCENE_PARAM_DEFS } from './params.ts';
import { buildWashScene } from './scene.ts';
import {
  BLOCK_FLAG,
  DRIP_TO_FLOOR,
  SCENE_NONE,
  type SceneItem,
  type SceneMachinePart,
  type WashScene,
} from './scene-types.ts';
import { catalogueItem, catalogueMaterial, instantiate } from './testing/catalogue.ts';
import { PRIMITIVES, singlePart, testMaterial } from './testing/shapes.ts';

const materials = (id: string) => (id === 'test' ? testMaterial(id) : catalogueMaterial(id));

/** A pose that puts the lowest point of a shape at height `z` with the given rotation. */
function restingAt(shape: Shape, q: Pose['q'], x: number, y: number, z: number): Pose {
  const box = boundingBox(shape, { p: [0, 0, 0], q });
  return { p: [x, y, z - box.min[2]], q };
}

const wire = (
  id: string,
  a: [number, number, number],
  b: [number, number, number],
  radius = 0.002,
) => ({
  id,
  prim: { kind: 'capsule' as const, a, b, radius },
  pose: POSE_IDENTITY,
  material: 'test',
});

/** Every typed array of a scene, by a path name, for comparing two builds. */
function buffers(scene: WashScene): Map<string, Uint8Array> {
  const out = new Map<string, Uint8Array>();
  const visit = (path: string, value: unknown): void => {
    if (value instanceof ArrayBuffer) {
      out.set(path, new Uint8Array(value));
    } else if (ArrayBuffer.isView(value)) {
      out.set(path, new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
    } else if (Array.isArray(value)) {
      value.forEach((entry, i) => visit(`${path}[${i}]`, entry));
    } else if (typeof value === 'object' && value !== null && !(value instanceof Map)) {
      for (const key of Object.keys(value).sort()) {
        if (key === 'rays' || key === 'shape') continue;
        visit(`${path}.${key}`, (value as Record<string, unknown>)[key]);
      }
    }
  };
  visit('scene', scene);
  return out;
}

describe('a plate held above a bowl', () => {
  const bowlShape = instantiate('cereal_bowl_porcelain_160').shape;
  const plateShape = instantiate('dinner_plate_porcelain_270').shape;
  // The plate stands on edge, its axis along x, its lowest point 150 mm above the table.
  const onEdge = quatFromAxisAngle([0, 1, 0], Math.PI / 2);
  const items: SceneItem[] = [
    { ...catalogueItem('bowl', 'cereal_bowl_porcelain_160', POSE_IDENTITY, ['interior']) },
    {
      ...catalogueItem(
        'plate',
        'dinner_plate_porcelain_270',
        restingAt(plateShape, onEdge, 0, 0, 0.15),
        ['well'],
      ),
    },
  ];
  const scene = buildWashScene({ items, machine: [], blockSize: 0.004, materials });
  const bowl = scene.instances[
    scene.itemInstance.get('bowl') as number
  ] as WashScene['instances'][number];
  const plate = scene.instances[
    scene.itemInstance.get('plate') as number
  ] as WashScene['instances'][number];
  const bowlTop = boundingBox(bowlShape).max[2];

  it('drips from its lower edge onto the bowl', () => {
    const { drips, blocks } = scene;
    let onBowl = 0;
    let lowest = Number.POSITIVE_INFINITY;
    for (let b = plate.firstBlock; b < plate.firstBlock + plate.blockCount; b++) {
      lowest = Math.min(lowest, blocks.centre[3 * b + 2] as number);
    }
    for (let k = 0; k < drips.count; k++) {
      const site = drips.block[k] as number;
      expect((blocks.flags[site] as number) & BLOCK_FLAG.dripSite).toBe(BLOCK_FLAG.dripSite);
      expect(drips.ofBlock[site]).toBe(k);
      const target = drips.target[k] as number;
      if (blocks.instance[site] !== plate.index) continue;
      // A drop from the plate lands on the bowl or misses it and falls to the floor.
      if (target === DRIP_TO_FLOOR) continue;
      expect(blocks.instance[target]).toBe(bowl.index);
      // It fell from the plate to somewhere on the bowl: between the gap to the bowl's rim and
      // the height of the plate's lowest point above the table.
      expect(drips.fall[k]).toBeGreaterThan(0.15 - bowlTop - 0.002);
      expect(drips.fall[k]).toBeLessThan(0.15 + 0.03);
      expect(
        Math.abs(
          (blocks.centre[3 * site + 2] as number) -
            (drips.fall[k] as number) -
            (blocks.centre[3 * target + 2] as number),
        ),
      ).toBeLessThan(0.006);
      onBowl++;
    }
    expect(onBowl).toBeGreaterThan(0);
    // The lowest block of the plate is one of the drip sites that reach the bowl.
    let lowestDrips = false;
    for (let k = 0; k < drips.count; k++) {
      const site = drips.block[k] as number;
      if (
        blocks.instance[site] === plate.index &&
        (blocks.centre[3 * site + 2] as number) < lowest + 1e-4
      ) {
        lowestDrips =
          drips.target[k] !== DRIP_TO_FLOOR &&
          blocks.instance[drips.target[k] as number] === bowl.index;
      }
    }
    expect(lowestDrips).toBe(true);
  });

  it('leaves the water in the bowl: its floor is a pit, not a drip site, and it is a basin', () => {
    const { blocks } = scene;
    // The block nearest the middle of the bowl's inner floor.
    let floor = -1;
    let best = Number.POSITIVE_INFINITY;
    for (let b = bowl.firstBlock; b < bowl.firstBlock + bowl.blockCount; b++) {
      if ((blocks.normal[3 * b + 2] as number) < 0.99) continue;
      const d = Math.hypot(blocks.centre[3 * b] as number, blocks.centre[3 * b + 1] as number);
      if (d < best) {
        best = d;
        floor = b;
      }
    }
    expect(floor).toBeGreaterThanOrEqual(0);
    expect((blocks.flags[floor] as number) & BLOCK_FLAG.dripSite).toBe(0);
    expect((blocks.flags[floor] as number) & BLOCK_FLAG.basin).toBe(BLOCK_FLAG.basin);
    expect(scene.basins.some((basin) => basin.instance === bowl.index)).toBe(true);
    expect(scene.basins.some((basin) => basin.instance === plate.index)).toBe(false);
  });

  it('carries gravity along the surface and the tilt of every block', () => {
    const { blocks } = scene;
    for (let b = 0; b < blocks.count; b += 13) {
      const n = [
        blocks.normal[3 * b] as number,
        blocks.normal[3 * b + 1] as number,
        blocks.normal[3 * b + 2] as number,
      ];
      const d = [
        blocks.gravityDir[3 * b] as number,
        blocks.gravityDir[3 * b + 1] as number,
        blocks.gravityDir[3 * b + 2] as number,
      ];
      const tilt = blocks.tilt[b] as number;
      expect(Math.abs(Math.cos(tilt) - (n[2] as number))).toBeLessThan(1e-5);
      expect(
        Math.abs((blocks.gravityAlong[b] as number) - STANDARD_GRAVITY * Math.sin(tilt)),
      ).toBeLessThan(1e-4);
      const length = Math.hypot(d[0] as number, d[1] as number, d[2] as number);
      if ((blocks.gravityAlong[b] as number) > 1e-3) {
        // Along the surface, downhill: the tangential part of (0, 0, -g), normalised.
        expect(Math.abs(length - 1)).toBeLessThan(1e-5);
        expect(
          Math.abs(
            (d[0] as number) * (n[0] as number) +
              (d[1] as number) * (n[1] as number) +
              (d[2] as number) * (n[2] as number),
          ),
        ).toBeLessThan(1e-5);
        expect(Math.abs((d[2] as number) + Math.sin(tilt))).toBeLessThan(1e-4);
      }
    }
    // The faces of the standing plate are upright: gravity runs straight down them.
    let upright = 0;
    for (let b = plate.firstBlock; b < plate.firstBlock + plate.blockCount; b++) {
      if (Math.abs(blocks.normal[3 * b] as number) < 0.999) continue;
      expect(Math.abs((blocks.tilt[b] as number) - Math.PI / 2)).toBeLessThan(0.05);
      expect(blocks.gravityDir[3 * b + 2]).toBeLessThan(-0.998);
      upright++;
    }
    expect(upright).toBeGreaterThan(100);
  });

  it('has a symmetric cell graph with ascending neighbours and positive shared edges', () => {
    const { graph, blocks } = scene;
    expect(graph.offsets[blocks.count]).toBe(graph.neighbour.length);
    let asymmetric = 0;
    for (let a = 0; a < blocks.count; a++) {
      for (let k = graph.offsets[a] as number; k < (graph.offsets[a + 1] as number); k++) {
        const b = graph.neighbour[k] as number;
        let back = -1;
        for (let j = graph.offsets[b] as number; j < (graph.offsets[b + 1] as number); j++) {
          if (graph.neighbour[j] === a) back = j;
        }
        if (
          back < 0 ||
          graph.length[back] !== graph.length[k] ||
          graph.kind[back] !== graph.kind[k]
        )
          asymmetric++;
      }
    }
    expect(asymmetric).toBe(0);
    for (let a = 0; a < blocks.count; a += 5) {
      let previous = -1;
      for (let k = graph.offsets[a] as number; k < (graph.offsets[a + 1] as number); k++) {
        const b = graph.neighbour[k] as number;
        expect(b).toBeGreaterThan(previous);
        previous = b;
        expect(b).not.toBe(a);
        expect(graph.length[k]).toBeGreaterThan(0);
        // The link back, with the same edge.
        let back = -1;
        for (let j = graph.offsets[b] as number; j < (graph.offsets[b + 1] as number); j++) {
          if (graph.neighbour[j] === a) back = j;
        }
        expect(back).toBeGreaterThanOrEqual(0);
        expect(graph.length[back]).toBe(graph.length[k]);
        expect(graph.kind[back]).toBe(graph.kind[k]);
        // Links stay inside one instance.
        expect(blocks.instance[b]).toBe(blocks.instance[a]);
      }
    }
  });

  it('gives soil cells to the soiled regions only, and wetting data to every block', () => {
    const { blocks } = scene;
    const well = plate.shape.regions.findIndex((r) => r.id === 'well');
    let soiled = 0;
    for (let b = plate.firstBlock; b < plate.firstBlock + plate.blockCount; b++) {
      const has = (blocks.soilFirst[b] as number) !== SCENE_NONE;
      expect(has).toBe(plate.shape.regions[blocks.region[b] as number]?.id === 'well');
      expect(((blocks.flags[b] as number) & BLOCK_FLAG.soiled) !== 0).toBe(has);
      if (has) soiled++;
    }
    expect(well).toBeGreaterThanOrEqual(0);
    expect(soiled).toBeGreaterThan(100);
    expect(scene.soilCells.count).toBeGreaterThan(4 * soiled);
    expect(scene.materials.map((m) => m.id)).toEqual([...scene.materials.map((m) => m.id)].sort());
    const material = scene.materials[blocks.material[plate.firstBlock] as number];
    expect(material?.id).toBe('porcelain_glazed');
    expect(material?.wettingClass).toBe('continuous_film');
    expect(material?.receding[1]).toBeLessThan(material?.advancing[1] as number);
  });

  it('does not depend on the order the items are given in', () => {
    const reversed = buildWashScene({
      items: [...items].reverse(),
      machine: [],
      blockSize: 0.004,
      materials,
    });
    expect(reversed.instances.map((i) => i.id)).toEqual(['bowl', 'plate']);
    const a = buffers(scene);
    const b = buffers(reversed);
    expect([...b.keys()]).toEqual([...a.keys()]);
    for (const [path, bytes] of a)
      expect(Buffer.compare(bytes, b.get(path) as Uint8Array), path).toBe(0);
  });
});

describe('a mug inverted over two tines', () => {
  const mugShape = instantiate('mug_porcelain_240').shape;
  const height = boundingBox(mugShape).max[2];
  // The inner face of the mug's floor: down the axis from mid-height until the floor is met.
  let floor = height / 2;
  while (signedDistance(mugShape, [0, 0, floor]) > 0) floor -= 1e-5;
  const tip = 0.1 + 0.002;
  const rack: Shape = {
    parts: [
      wire('rail', [-0.05, 0, 0], [0.25, 0, 0]),
      wire('tine_a', [0.015, 0, 0], [0.015, 0, 0.1]),
      wire('tine_b', [-0.015, 0, 0], [-0.015, 0, 0.1]),
      wire('tine_far', [0.2, 0, 0], [0.2, 0, 0.1]),
    ],
    regions: [{ id: 'wires', part: '*' }],
  };
  const machine: SceneMachinePart[] = [
    { id: 'rack', role: 'wires', shape: rack, pose: POSE_IDENTITY },
  ];
  // Upside down, its floor 1 mm above the tips of the two tines inside it.
  const mugPose: Pose = { p: [0, 0, tip + 0.001 + floor], q: [1, 0, 0, 0] };
  const items = [catalogueItem('mug', 'mug_porcelain_240', mugPose, ['interior'])];
  const scene = buildWashScene({ items, machine, blockSize: 0.002, materials });

  it('reports the tines as near-contacts, with the gap, and not the tine that is far away', () => {
    const { contacts, blocks } = scene;
    const mug = scene.itemInstance.get('mug') as number;
    const rackIndex = scene.instances.findIndex((i) => i.id === 'rack');
    const parts = new Map<string, number[]>();
    for (let k = 0; k < contacts.count; k++) {
      expect(blocks.instance[contacts.blockA[k] as number]).toBe(mug);
      expect(blocks.instance[contacts.blockB[k] as number]).toBe(rackIndex);
      expect(contacts.gap[k]).toBeGreaterThanOrEqual(0);
      expect(contacts.gap[k]).toBeLessThan(0.004);
      const part = scene.parts[blocks.part[contacts.blockB[k] as number] as number]?.id ?? '';
      parts.set(part, [...(parts.get(part) ?? []), contacts.gap[k] as number]);
      // The link starts on the inside of the mug.
      const region =
        scene.instances[mug]?.shape.regions[blocks.region[contacts.blockA[k] as number] as number]
          ?.id;
      expect(['interior', 'rim']).toContain(region);
    }
    expect([...parts.keys()].sort()).toEqual(['tine_a', 'tine_b']);
    // The narrowest gap to each tine is the 1 mm between its tip and the floor of the mug, seen
    // from the centre of a 2 mm block (so at most a block's sagitta more).
    for (const gaps of parts.values()) {
      expect(Math.min(...gaps)).toBeGreaterThan(0.00095);
      expect(Math.min(...gaps)).toBeLessThan(0.0013);
    }
    // The tines are line elements: a block for each stretch of wire.
    expect((blocks.flags[contacts.blockB[0] as number] as number) & BLOCK_FLAG.line).toBe(
      BLOCK_FLAG.line,
    );
  });

  it('finds no near-contact when the contact gap is set below the gap', () => {
    const registry = createRegistry({ contributions: [SHARED_PARAM_DEFS, SCENE_PARAM_DEFS] });
    const narrow = buildWashScene({
      items,
      machine,
      blockSize: 0.002,
      materials,
      params: createParamSet(registry, { 'scene.contactGap': 0.0006 }),
    });
    expect(narrow.contacts.count).toBe(0);
    expect(scene.contacts.count).toBeGreaterThan(10);
  });

  it('describes the wires: line elements with the slope of the wire, stitched where they meet', () => {
    const { blocks, graph } = scene;
    const rackInstance = scene.instances.find(
      (i) => i.id === 'rack',
    ) as WashScene['instances'][number];
    let upright = 0;
    let level = 0;
    for (
      let b = rackInstance.firstBlock;
      b < rackInstance.firstBlock + rackInstance.blockCount;
      b++
    ) {
      expect((blocks.flags[b] as number) & BLOCK_FLAG.line).toBe(BLOCK_FLAG.line);
      const part = scene.parts[blocks.part[b] as number]?.id;
      if (part === 'rail') {
        level++;
        expect(blocks.tilt[b]).toBeLessThan(1e-6);
        expect(blocks.gravityAlong[b]).toBeLessThan(1e-6);
        // Across a level wire the normal points up.
        expect(blocks.normal[3 * b + 2]).toBeGreaterThan(1 - 1e-6);
      } else {
        upright++;
        expect(Math.abs((blocks.tilt[b] as number) - Math.PI / 2)).toBeLessThan(1e-6);
        expect(Math.abs((blocks.gravityAlong[b] as number) - STANDARD_GRAVITY)).toBeLessThan(1e-5);
        expect(blocks.gravityDir[3 * b + 2]).toBeLessThan(-1 + 1e-6);
        expect(Math.abs(blocks.normal[3 * b + 2] as number)).toBeLessThan(1e-6);
      }
      // A line element carries the whole circumference: 2 pi r times its length (3 mm), more at an end.
      expect(blocks.area[b]).toBeGreaterThan(2 * Math.PI * 0.002 * 0.0029);
    }
    expect(level).toBe(100);
    expect(upright).toBe(3 * 33);
    // Every tine is joined to the rail: the whole rack is one graph.
    const reached = new Uint8Array(blocks.count);
    const queue = [rackInstance.firstBlock];
    reached[rackInstance.firstBlock] = 1;
    for (let head = 0; head < queue.length; head++) {
      const a = queue[head] as number;
      for (let k = graph.offsets[a] as number; k < (graph.offsets[a + 1] as number); k++) {
        const b = graph.neighbour[k] as number;
        if (reached[b] === 0) {
          reached[b] = 1;
          queue.push(b);
        }
      }
    }
    expect(queue.length).toBe(rackInstance.blockCount);
    // Water on the rail has nowhere lower to go: its elements drip, straight to the floor.
    const railBlock = rackInstance.firstBlock + 50;
    expect((blocks.flags[railBlock] as number) & BLOCK_FLAG.dripSite).toBe(BLOCK_FLAG.dripSite);
    expect(scene.drips.target[scene.drips.ofBlock[railBlock] as number]).toBe(DRIP_TO_FLOOR);
  });

  it('builds identical buffers twice, from fresh copies of the shapes', () => {
    // Fresh shape objects, so that nothing is taken from the caches of the first build.
    const again = buildWashScene({
      items: [{ ...(items[0] as SceneItem), shape: structuredClone(mugShape) }],
      machine: [{ ...(machine[0] as SceneMachinePart), shape: structuredClone(rack) }],
      blockSize: 0.002,
      materials,
    });
    const a = buffers(scene);
    const b = buffers(again);
    expect(a.size).toBeGreaterThan(40);
    expect([...b.keys()]).toEqual([...a.keys()]);
    for (const [path, bytes] of a)
      expect(Buffer.compare(bytes, b.get(path) as Uint8Array), path).toBe(0);
    expect(again.counts).toEqual(scene.counts);
    expect(
      JSON.stringify(
        again.basins.map((basin) => ({
          ...basin,
          levelTable: [...basin.levelTable],
          blocks: [...basin.blocks],
          depth: [...basin.depth],
        })),
      ),
    ).toBe(
      JSON.stringify(
        scene.basins.map((basin) => ({
          ...basin,
          levelTable: [...basin.levelTable],
          blocks: [...basin.blocks],
          depth: [...basin.depth],
        })),
      ),
    );
  });
});

describe('machine parts', () => {
  const sheet: Shape = {
    parts: [
      {
        id: 'floor',
        prim: { kind: 'rbox', halfExtents: [0.1, 0.08, 0.0005], radius: 0 },
        pose: { p: [0, 0, -0.0005], q: [0, 0, 0, 1] },
        material: 'test',
      },
    ],
    regions: [{ id: 'floor', part: 'floor', side: 'in' }],
  };

  it('are gridded at the machine block ratio, and an enclosure only where it faces the chamber', () => {
    const part: SceneMachinePart = {
      id: 'tub',
      role: 'tub',
      shape: sheet,
      pose: POSE_IDENTITY,
      enclosure: true,
    };
    const whole = buildWashScene({ items: [], machine: [part], blockSize: 0.002, materials });
    const inside = buildWashScene({
      items: [],
      machine: [part],
      blockSize: 0.002,
      materials,
      chamber: { min: [-0.1, -0.08, 0], max: [0.1, 0.08, 0.5] },
    });
    const ratio = resolveSceneParams().machineBlockRatio;
    expect(whole.instances[0]?.blockSize).toBe(ratio * 0.002);
    // Six faces without a chamber; with one, the top face alone: 0.2 m x 0.16 m in 4 mm blocks.
    expect(inside.blocks.count).toBe((0.2 / 0.004) * (0.16 / 0.004));
    expect(whole.blocks.count).toBeGreaterThan(2 * inside.blocks.count);
    for (let b = 0; b < inside.blocks.count; b++) {
      expect(inside.blocks.normal[3 * b + 2]).toBe(1);
      expect(Math.abs(inside.blocks.centre[3 * b + 2] as number)).toBeLessThan(1e-9);
      expect((inside.blocks.flags[b] as number) & BLOCK_FLAG.pit).toBe(BLOCK_FLAG.pit);
    }
    // A ray from inside the chamber still finds the floor and its block.
    const hit = {
      t: 0,
      block: 0,
      soilCell: 0,
      triangle: 0,
      surf: 0,
      nx: 0,
      ny: 0,
      nz: 0,
      cosInc: 0,
      residual: 0,
      corrected: false,
    };
    expect(inside.rays.trace(0.01, 0.01, 0.2, 0, 0, -1, 1, 0, 0, hit)).toBe(true);
    expect(Math.abs(hit.t - 0.2)).toBeLessThan(1e-9);
    expect(hit.block).not.toBe(SCENE_NONE);
    expect(inside.unsupported).toEqual([]);
    // The edge faces of the sheet lost their blocks (their centres are below the chamber), but a
    // ray that strikes one still names a block: the nearest one that was kept.
    expect(inside.rays.trace(0.2, 0.01, -0.0005, -1, 0, 0, 1, 0, 0, hit)).toBe(true);
    expect(Math.abs(hit.t - 0.1)).toBeLessThan(1e-9);
    expect(hit.block).not.toBe(SCENE_NONE);
    expect(Math.abs((inside.blocks.centre[3 * hit.block] as number) - 0.1 + 0.002)).toBeLessThan(
      1e-6,
    );
  });

  it('rejects two instances with one id', () => {
    const part: SceneMachinePart = { id: 'tub', role: 'tub', shape: sheet, pose: POSE_IDENTITY };
    expect(() =>
      buildWashScene({ items: [], machine: [part, part], blockSize: 0.002, materials }),
    ).toThrow(/duplicate/);
  });
});

describe('slender items', () => {
  // A blade 200 mm x 20 mm x 2 mm (a knife) and a slab 200 mm x 120 mm x 2 mm (a tray), both
  // soiled all over.
  const slab = (id: string, halfWidth: number): SceneItem => ({
    itemId: id,
    typeId: id,
    shape: {
      parts: [
        {
          id: 'body',
          prim: { kind: 'rbox', halfExtents: [0.1, halfWidth, 0.001], radius: 0 },
          pose: POSE_IDENTITY,
          material: 'test',
        },
      ],
      regions: [{ id: 'all', part: '*' }],
    },
    pose: { p: [0, id === 'blade' ? 0.2 : -0.2, 0.3], q: [0, 0, 0, 1] },
    soils: [
      {
        type: 'any',
        regions: [{ region: 'all', coverage: 1 }],
        amount_g: 1,
        age_h: 0,
        heat_history: 'none',
      },
    ],
  });
  const registry = createRegistry({ contributions: [SHARED_PARAM_DEFS, SCENE_PARAM_DEFS] });
  const sceneAt = (ratio: number): WashScene =>
    buildWashScene({
      items: [slab('blade', 0.01), slab('tray', 0.06)],
      machine: [],
      blockSize: 0.004,
      materials,
      params: createParamSet(registry, { 'scene.slenderBlockRatio': ratio }),
    });

  it('carry blocks of the slender ratio, and items wider than the slender width do not', () => {
    const plain = sceneAt(1);
    const fine = sceneAt(0.5);
    const blade = (scene: WashScene) => scene.instances[scene.itemInstance.get('blade') as number];
    const tray = (scene: WashScene) => scene.instances[scene.itemInstance.get('tray') as number];
    expect(blade(plain)?.blockSize).toBe(0.004);
    expect(blade(fine)?.blockSize).toBe(0.002);
    expect(tray(fine)?.blockSize).toBe(0.004);
    // Four times the blocks on the blade (its two faces in whole blocks at both sizes; its
    // 2 mm rim is one row at both, so a little under four times in all), none more on the tray.
    const ratio = (blade(fine)?.blockCount as number) / (blade(plain)?.blockCount as number);
    expect(ratio).toBeGreaterThan(3.3);
    expect(ratio).toBeLessThanOrEqual(4);
    expect(tray(fine)?.blockCount).toBe(tray(plain)?.blockCount);
    // The area of the blade is the same to 1 %, and its largest soil cell a quarter of what it
    // was: 1 mm2 where one cell of a 4 mm block is the 4 mm2 of the inspection's score 4.
    const cellsOf = (scene: WashScene, id: string): { area: number; largest: number } => {
      const inst = scene.instances[scene.itemInstance.get(id) as number];
      if (inst === undefined) throw new Error(`no ${id}`);
      let area = 0;
      let largest = 0;
      for (let b = inst.firstBlock; b < inst.firstBlock + inst.blockCount; b++) {
        const first = scene.blocks.soilFirst[b] as number;
        if (first === SCENE_NONE) continue;
        for (let q = 0; q < 4; q++) {
          const a = scene.soilCells.area[first + q] as number;
          area += a;
          if (a > largest) largest = a;
        }
      }
      return { area, largest };
    };
    const a = cellsOf(plain, 'blade');
    const b = cellsOf(fine, 'blade');
    expect(Math.abs(b.area / a.area - 1)).toBeLessThan(0.01);
    expect(a.largest).toBeGreaterThan(3.9e-6);
    expect(b.largest).toBeLessThan(1.05e-6);
  });

  it('are no finer at the default ratio: the scene is the one built without the rule', () => {
    const plain = sceneAt(1);
    const none = buildWashScene({
      items: [slab('blade', 0.01), slab('tray', 0.06)],
      machine: [],
      blockSize: 0.004,
      materials,
      params: createParamSet(registry, { 'scene.slenderWidth': 0, 'scene.slenderBlockRatio': 0.5 }),
    });
    expect(none.blocks.count).toBe(plain.blocks.count);
    expect(resolveSceneParams().slenderBlockRatio).toBe(1);
  });
});

describe('soil records', () => {
  const shell = singlePart(PRIMITIVES['bowl'] as NonNullable<(typeof PRIMITIVES)[string]>);
  const soilOn = (...regions: string[]): SceneItem => ({
    itemId: 'a',
    typeId: 'test',
    shape: shell,
    pose: POSE_IDENTITY,
    soils: [
      {
        type: 'egg_yolk_dried',
        regions: regions.map((region) => ({ region, coverage: 1 })),
        amount_g: 1,
        age_h: 1,
        heat_history: 'none',
      },
    ],
  });
  const soiledBlocks = (scene: WashScene): number => {
    let n = 0;
    for (let b = 0; b < scene.blocks.count; b++) {
      if (((scene.blocks.flags[b] as number) & BLOCK_FLAG.soiled) !== 0) n++;
    }
    return n;
  };
  const build = (item: SceneItem): WashScene =>
    buildWashScene({ items: [item], machine: [], blockSize: 0.004, materials });

  it('on a region the shape does not have are refused, not dropped', () => {
    expect(() => build(soilOn('no_such_region'))).toThrow(
      /item 'a' \(test\) has soil on region 'no_such_region'.*inside, outside, all/,
    );
    // Also when the coverage is zero: the record is still wrong.
    const zero = soilOn('rim');
    expect(() =>
      build({
        ...zero,
        soils: zero.soils.map((soil) => ({
          ...soil,
          regions: soil.regions.map((region) => ({ ...region, coverage: 0 })),
        })),
      }),
    ).toThrow(RangeError);
  });

  it('on a region that overlaps others soil every block the region holds', () => {
    // The test shape has the regions inside, outside and all (in that order) over one shell: a
    // block's first region is inside or outside, yet soil on `all` lies on every block.
    const inside = build(soilOn('inside'));
    const outside = build(soilOn('outside'));
    const all = build(soilOn('all'));
    const count = all.blocks.count;
    expect(soiledBlocks(inside)).toBeGreaterThan(0.3 * count);
    expect(soiledBlocks(outside)).toBeGreaterThan(0.3 * count);
    expect(soiledBlocks(inside) + soiledBlocks(outside)).toBe(count);
    expect(soiledBlocks(all)).toBe(count);
    expect(all.soilCells.count).toBe(4 * count);
    expect(all.unsupported).toEqual([]);
    // The region of a block stays the first that holds it.
    const names = new Set<string>();
    for (let b = 0; b < count; b++) {
      names.add(shell.regions[all.blocks.region[b] as number]?.id ?? '');
    }
    expect([...names].sort()).toEqual(['inside', 'outside']);
  });

  it('on a region that receives no block are reported', () => {
    // A region that selects a stretch of the profile shorter than a block row may hold no row.
    const sliver: Shape = {
      parts: shell.parts,
      regions: [
        { id: 'sliver', part: 'body', side: 'in', sRange: [0.5, 0.5001] },
        { id: 'all', part: 'body' },
      ],
    };
    const scene = build({ ...soilOn('sliver'), shape: sliver });
    expect(scene.soilCells.count).toBe(0);
    expect(scene.unsupported).toHaveLength(1);
    expect(scene.unsupported[0]).toMatch(/soil on region 'sliver' lies on no block/);
  });
});

describe('the registered parameters of the scene', () => {
  it('compose into the registry, every one under scene.* with its default inside its range', () => {
    const registry = createRegistry({ contributions: [SHARED_PARAM_DEFS, SCENE_PARAM_DEFS] });
    for (const def of SCENE_PARAM_DEFS) {
      expect(def.key.startsWith('scene.')).toBe(true);
      expect(def.group).toBe('hydro');
      expect(registry.has(def.key)).toBe(true);
      expect(def.source.length).toBeGreaterThan(10);
      if (def.kind === undefined || def.kind === 'scalar') {
        expect(def.default).toBeGreaterThanOrEqual(def.min);
        expect(def.default).toBeLessThanOrEqual(def.max);
      }
    }
    const params = resolveSceneParams(createParamSet(registry));
    // The values the scene brief and the contract name.
    expect(params.contactGap).toBe(0.004);
    expect(params.deadDepth).toBe(0.0002);
    expect(params.buriedDepth).toBe(DEFAULT_BURIED_DEPTH);
    expect(params.stitchReach).toBe(0.75);
    expect(params.cutMerge).toBe(0.25);
    expect(params.gravity).toBe(STANDARD_GRAVITY);
    expect(
      resolveSceneParams(createParamSet(registry, { 'scene.rayChordError': 0.0001 })).rayChordError,
    ).toBe(0.0001);
  });
});
