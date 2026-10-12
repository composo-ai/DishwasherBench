// The landing kernel on hand-built scenes: what lands about a place from a direction is shared
// among the faces there that the droplets of that direction can reach, by the area each
// presents; a covered face, the inside of a vessel and a contact are not filled; the total is
// exact.
import { describe, expect, it } from 'vitest';
import {
  acquireTraceBackend,
  buildWashScene,
  createParamSet,
  createRegistry,
  HYDRAULICS_PARAM_DEFS,
  JETS_PARAM_DEFS,
  SCENE_PARAM_DEFS,
  SHARED_PARAM_DEFS,
  type WashScene,
} from './index.ts';
import {
  buildLandingKernel,
  landingDirectionBin,
  landingDirections,
  LandingTally,
  SPRAY_PARAM_DEFS,
  type LandingKernel,
} from './index.ts';
import {
  cup,
  fixtureMaterial,
  slab,
  SLAB_HALF_THICKNESS,
  wire,
} from '../../sim-jets/src/testing/fixtures.ts';

const registry = createRegistry({
  contributions: [
    SHARED_PARAM_DEFS,
    SCENE_PARAM_DEFS,
    HYDRAULICS_PARAM_DEFS,
    JETS_PARAM_DEFS,
    SPRAY_PARAM_DEFS,
  ],
});
const params = createParamSet(registry);
const OPTIONS = { spacing: 0.02, range: 0.05, gap: 4e-3, reach: 2, directions: 48 };

async function kernelOf(scene: WashScene, options = OPTIONS): Promise<LandingKernel> {
  return buildLandingKernel(scene, await acquireTraceBackend(scene, null), options);
}

function sceneOf(
  items: Parameters<typeof buildWashScene>[0]['items'],
  machine: Parameters<typeof buildWashScene>[0]['machine'] = [],
  blockSize = 4e-3,
): WashScene {
  return buildWashScene({ items, machine, blockSize, materials: fixtureMaterial, params });
}

/** The block of `item` nearest to (x, y) whose normal has the z component `nz` (+1 or -1). */
function blockAt(scene: WashScene, item: string, x: number, y: number, nz: number): number {
  const instance = scene.instances[scene.itemInstance.get(item) as number];
  if (instance === undefined) throw new Error(`no item ${item}`);
  let best = -1;
  let d = Infinity;
  for (let b = instance.firstBlock; b < instance.firstBlock + instance.blockCount; b++) {
    if ((scene.blocks.normal[3 * b + 2] as number) * nz < 0.9) continue;
    const r = Math.hypot(
      (scene.blocks.centre[3 * b] as number) - x,
      (scene.blocks.centre[3 * b + 1] as number) - y,
    );
    if (r < d) {
      d = r;
      best = b;
    }
  }
  return best;
}

const isOpen = (k: LandingKernel, b: number, q: number): boolean =>
  (((k.open[k.words * b + (q >>> 5)] as number) >>> (q & 31)) & 1) === 1;
const isFaced = (k: LandingKernel, b: number, q: number): boolean =>
  (((k.faced[k.words * b + (q >>> 5)] as number) >>> (q & 31)) & 1) === 1;

describe('the direction bins', () => {
  it('cover the sphere evenly and give every bin centre back', () => {
    const count = 48;
    const direction = landingDirections(count);
    let sx = 0;
    let sy = 0;
    let sz = 0;
    for (let q = 0; q < count; q++) {
      const x = direction[3 * q] as number;
      const y = direction[3 * q + 1] as number;
      const z = direction[3 * q + 2] as number;
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 12);
      expect(landingDirectionBin(count, x, y, z)).toBe(q);
      sx += x;
      sy += y;
      sz += z;
    }
    // Evenly spread: the directions add up to nearly nothing.
    expect(Math.hypot(sx, sy, sz)).toBeLessThan(1.5);
    // The nearest centre is never further than the half-angle of a bin and a half.
    for (const [x, y, z] of [
      [0, 0, -1],
      [0.6, 0, -0.8],
      [-0.6, 0.64, 0.48],
    ] as const) {
      const q = landingDirectionBin(count, x, y, z);
      const dot =
        x * (direction[3 * q] as number) +
        y * (direction[3 * q + 1] as number) +
        z * (direction[3 * q + 2] as number);
      expect(Math.acos(dot)).toBeLessThan(0.45);
    }
  });
});

describe('landings on an open face', () => {
  const top = 0.2 + SLAB_HALF_THICKNESS;
  const scene = sceneOf([slab('plate', 0.1, 0.1, { p: [0, 0, 0.2], q: [0, 0, 0, 1] })]);
  const struck = blockAt(scene, 'plate', 0.011, 0.007, 1);

  it('are shared over the face about them by area, smoothly, and never reach the underside', async () => {
    const kernel = await kernelOf(scene);
    const down = landingDirectionBin(48, 0, 0, -1);
    expect(isOpen(kernel, struck, down)).toBe(true);
    expect(isOpen(kernel, blockAt(scene, 'plate', 0, 0, -1), down)).toBe(false);
    const tally = new LandingTally(scene, kernel);
    const units = 10_000_019;
    tally.add(struck, units, 0, 0, -1);
    const out = tally.settle();
    let total = 0;
    let reached = 0;
    let furthest = 0;
    const cx = scene.blocks.centre[3 * struck] as number;
    const cy = scene.blocks.centre[3 * struck + 1] as number;
    for (let b = 0; b < scene.blocks.count; b++) {
      const got = out[b] as number;
      expect(Number.isInteger(got)).toBe(true);
      total += got;
      if (!(got > 0)) continue;
      reached++;
      // Only the top face, within two node spacings of the landing.
      expect(scene.blocks.normal[3 * b + 2] as number).toBeGreaterThan(-0.1);
      expect(scene.blocks.centre[3 * b + 2] as number).toBeGreaterThan(top - 2e-3);
      furthest = Math.max(
        furthest,
        Math.hypot(
          (scene.blocks.centre[3 * b] as number) - cx,
          (scene.blocks.centre[3 * b + 1] as number) - cy,
        ),
      );
    }
    expect(total).toBe(units);
    // A 20 mm lattice on 4 mm blocks: the eight nodes about the landing share with the blocks
    // within a spacing of each, so some hundreds of blocks, none further than the diagonal
    // of two cells.
    expect(reached).toBeGreaterThan(60);
    expect(reached).toBeLessThan(420);
    expect(furthest).toBeLessThan(2 * 0.02 * Math.SQRT2 + 4e-3);
    // The block that was struck keeps only its share.
    expect(out[struck] as number).toBeLessThan(0.05 * units);
    expect(tally.shares).toMatchObject({ total: units, pooledOpen: units, keptOnItems: 0 });
  });

  it('gives a uniform rain back as a uniform load, whatever the lattice', async () => {
    // The same water on every block of the top face: the kernel must leave it uniform.
    for (const spacing of [0.02, 0.031]) {
      const kernel = await kernelOf(scene, { ...OPTIONS, spacing });
      const tally = new LandingTally(scene, kernel);
      const plate = scene.instances[scene.itemInstance.get('plate') as number];
      if (plate === undefined) throw new Error('no plate');
      const perArea = 4e12; // units per m2
      for (let b = plate.firstBlock; b < plate.firstBlock + plate.blockCount; b++) {
        if ((scene.blocks.normal[3 * b + 2] as number) < 0.99) continue;
        tally.add(b, Math.round(perArea * (scene.blocks.area[b] as number)), 0, 0, -1);
      }
      const out = tally.settle();
      for (let b = plate.firstBlock; b < plate.firstBlock + plate.blockCount; b++) {
        if ((scene.blocks.normal[3 * b + 2] as number) < 0.99) continue;
        const x = Math.abs(scene.blocks.centre[3 * b] as number);
        const y = Math.abs(scene.blocks.centre[3 * b + 1] as number);
        // Away from the edge of the face by more than the reach of a node: there the rain
        // that fell beyond the edge is missing from the pool.
        if (x > 0.06 || y > 0.06) continue;
        const load = (out[b] as number) / (scene.blocks.area[b] as number);
        expect(load / perArea).toBeGreaterThan(0.97);
        expect(load / perArea).toBeLessThan(1.03);
      }
    }
  });
});

describe('a slender part between broad ones', () => {
  // A bar 3 mm wide lies between two plates, 6 mm from each, all level: rain is booked on
  // the plates only, as if no parcel had happened to strike the bar.
  const scene = sceneOf(
    [
      slab('left', 0.04, 0.04, { p: [0, 0, 0.2], q: [0, 0, 0, 1] }),
      slab('tine', 1.5e-3, 0.04, { p: [0.0475, 0, 0.2], q: [0, 0, 0, 1] }),
      slab('right', 0.04, 0.04, { p: [0.095, 0, 0.2], q: [0, 0, 0, 1] }),
    ],
    [],
    2e-3,
  );

  it('receives its share of what falls about it although no parcel struck it', async () => {
    const kernel = await kernelOf(scene);
    const tally = new LandingTally(scene, kernel);
    const tine = scene.instances[scene.itemInstance.get('tine') as number];
    if (tine === undefined) throw new Error('no tine');
    const perArea = 5e12;
    let rained = 0;
    for (const id of ['left', 'right']) {
      const plate = scene.instances[scene.itemInstance.get(id) as number];
      if (plate === undefined) throw new Error('no plate');
      for (let b = plate.firstBlock; b < plate.firstBlock + plate.blockCount; b++) {
        if ((scene.blocks.normal[3 * b + 2] as number) < 0.99) continue;
        const units = Math.round(perArea * (scene.blocks.area[b] as number));
        tally.add(b, units, 0, 0, -1);
        rained += units;
      }
    }
    const out = tally.settle();
    let onTine = 0;
    let tineTop = 0;
    let total = 0;
    for (let b = 0; b < scene.blocks.count; b++) total += out[b] as number;
    for (let b = tine.firstBlock; b < tine.firstBlock + tine.blockCount; b++) {
      const nz = scene.blocks.normal[3 * b + 2] as number;
      // Away from its ends, where the plates end too.
      if (Math.abs(scene.blocks.centre[3 * b + 1] as number) > 0.02) continue;
      if (nz < 0.01) {
        // Its underside and its upright sides present no area to falling drops.
        expect(out[b]).toBe(0);
      } else if (nz > 0.99) {
        onTine += out[b] as number;
        tineTop += scene.blocks.area[b] as number;
      }
    }
    expect(total).toBe(rained);
    // The top of the tine is loaded like the plates beside it: the rain measured on them is
    // taken to fall evenly on every open face about a node, the tine's among them (a little
    // less than on the plates, because the rain that would have struck the tine itself was
    // not booked).
    const load = onTine / tineTop;
    expect(load / perArea).toBeGreaterThan(0.8);
    expect(load / perArea).toBeLessThan(1.05);
  });
});

describe('a covered face', () => {
  // A small slab lies 3 mm above the middle of a larger one (nearer than the gap), and in a
  // second scene 20 mm above it (within the range).
  const lower = slab('lower', 0.08, 0.08, { p: [0, 0, 0.2], q: [0, 0, 0, 1] });
  const coverAt = (gap: number): WashScene =>
    sceneOf([
      lower,
      slab('cover', 0.03, 0.03, {
        p: [0, 0, 0.2 + 2 * SLAB_HALF_THICKNESS + gap],
        q: [0, 0, 0, 1],
      }),
    ]);
  const down = landingDirectionBin(48, 0, 0, -1);

  it('is closed to the rain where the cover lies on it, and takes none of what lands beside', async () => {
    const scene = coverAt(3e-3);
    const kernel = await kernelOf(scene);
    const under = blockAt(scene, 'lower', 0, 0, 1);
    const beside = blockAt(scene, 'lower', 0.044, 0, 1);
    expect(isOpen(kernel, under, down)).toBe(false);
    expect(isFaced(kernel, under, down)).toBe(false);
    expect(isOpen(kernel, beside, down)).toBe(true);
    const tally = new LandingTally(scene, kernel);
    tally.add(beside, 5_000_000, 0, 0, -1);
    const out = tally.settle();
    let total = 0;
    for (let b = 0; b < scene.blocks.count; b++) {
      total += out[b] as number;
      if (!((out[b] as number) > 0)) continue;
      if ((scene.blocks.instance[b] as number) !== scene.itemInstance.get('lower')) continue;
      // Nothing under the cover (its half-width is 30 mm, less the rounded edge).
      const x = Math.abs(scene.blocks.centre[3 * b] as number);
      const y = Math.abs(scene.blocks.centre[3 * b + 1] as number);
      expect(Math.max(x, y)).toBeGreaterThan(0.028);
    }
    expect(total).toBe(5_000_000);
    // A droplet that did get into the gap stays on the block it struck.
    const inside = new LandingTally(scene, kernel);
    inside.add(under, 1000, 0, 0, -1);
    const kept = inside.settle();
    expect(kept[under]).toBe(1000);
    expect(inside.shares.keptOnItems).toBe(1000);
  });

  it('is faced where the cover stands further off, and shares only with faces in the same situation', async () => {
    const scene = coverAt(0.02);
    const kernel = await kernelOf(scene);
    const under = blockAt(scene, 'lower', 0, 0, 1);
    const beside = blockAt(scene, 'lower', 0.044, 0, 1);
    expect(isOpen(kernel, under, down)).toBe(false);
    expect(isFaced(kernel, under, down)).toBe(true);
    // Rain beside the cover is not put under it.
    const rain = new LandingTally(scene, kernel);
    rain.add(beside, 5_000_000, 0, 0, -1);
    const out = rain.settle();
    expect(out[under]).toBe(0);
    // A splash that lands under the cover is shared among the faced blocks about it.
    const splash = new LandingTally(scene, kernel);
    splash.add(under, 2_000_000, 0, 0, -1);
    const shared = splash.settle();
    let underCover = 0;
    let elsewhere = 0;
    for (let b = 0; b < scene.blocks.count; b++) {
      const got = shared[b] as number;
      if (!(got > 0)) continue;
      const x = Math.abs(scene.blocks.centre[3 * b] as number);
      const y = Math.abs(scene.blocks.centre[3 * b + 1] as number);
      if (Math.max(x, y) < 0.031) underCover += got;
      else elsewhere += got;
    }
    expect(underCover).toBe(2_000_000);
    expect(elsewhere).toBe(0);
    expect(splash.shares.pooledFaced).toBe(2_000_000);
  });

  it('is not closed by a rack wire in the way: the ray goes on behind it', async () => {
    const scene = sceneOf([lower], [wire('rack', [-0.1, 0, 0.215], [0.1, 0, 0.215], 2e-3)]);
    const kernel = await kernelOf(scene);
    expect(isOpen(kernel, blockAt(scene, 'lower', 0, 0, 1), down)).toBe(true);
    expect(kernel.rays).toBeGreaterThan(0);
  });
});

describe('the inside of a vessel', () => {
  // A cup 60 mm wide and 90 mm deep, mouth down.
  const scene = sceneOf([cup('glass', 0.03, 0.09, { p: [0, 0, 0.3], q: [1, 0, 0, 0] })]);
  const glass = scene.instances[scene.itemInstance.get('glass') as number];
  if (glass === undefined) throw new Error('no glass');
  const inner = (b: number): boolean => {
    const x = scene.blocks.centre[3 * b] as number;
    const y = scene.blocks.centre[3 * b + 1] as number;
    // The normal of an inside face points towards the axis.
    return (
      x * (scene.blocks.normal[3 * b] as number) + y * (scene.blocks.normal[3 * b + 1] as number) <
      -1e-4
    );
  };

  it('is closed to the directions its own wall stands in the way of, at any distance', async () => {
    const kernel = await kernelOf(scene);
    // Droplets flying sideways (the bin about +x) strike the outside of the wall at x < 0.
    // The inside of the opposite wall faces the same way, and is closed to them: the near
    // wall is in the way, 60 mm off, further than the range. (Near the mouth, which is at the
    // bottom, a bin that points a little upward does get in: those blocks are left out.)
    const sideways = landingDirectionBin(48, 1, 0, 0);
    const dz = kernel.direction[3 * sideways + 2] as number;
    const mouth = 0.3 - 0.093;
    const deep = mouth + 0.06 * Math.abs(dz / Math.sqrt(1 - dz * dz)) + 0.01;
    let outside = -1;
    let insideFacing = 0;
    let insideOpen = 0;
    for (let b = glass.firstBlock; b < glass.firstBlock + glass.blockCount; b++) {
      const nx = scene.blocks.normal[3 * b] as number;
      if (nx > -0.9) continue;
      if (inner(b)) {
        if ((scene.blocks.centre[3 * b + 2] as number) < deep) continue;
        insideFacing++;
        if (isOpen(kernel, b, sideways) || isFaced(kernel, b, sideways)) insideOpen++;
      } else if (outside < 0 && isOpen(kernel, b, sideways)) {
        outside = b;
      }
    }
    expect(outside).toBeGreaterThanOrEqual(0);
    expect(insideFacing).toBeGreaterThan(5);
    expect(insideOpen).toBe(0);
    // What lands on the outside stays outside.
    const tally = new LandingTally(scene, kernel);
    tally.add(
      outside,
      3_000_000,
      kernel.direction[3 * sideways] as number,
      kernel.direction[3 * sideways + 1] as number,
      dz,
    );
    const out = tally.settle();
    let total = 0;
    for (let b = glass.firstBlock; b < glass.firstBlock + glass.blockCount; b++) {
      total += out[b] as number;
      if ((out[b] as number) > 0 && (scene.blocks.centre[3 * b + 2] as number) >= deep) {
        expect(inner(b)).toBe(false);
      }
    }
    expect(total).toBe(3_000_000);
  });
});
