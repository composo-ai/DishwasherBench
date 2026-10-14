/**
 * The rebuilt cutlery basket of the Bosch (dossier 2.4; owner's photographs IMG_9080, IMG_9081
 * and the loaded photograph of 2026-10-10): where it can stand, that its geometry and cells
 * follow it, and that its cells hold cutlery: a handle cannot pass a cell floor.
 */

import type { ItemInstance } from '../../../catalogue/src/index.ts';
import { instantiate } from '../../../catalogue/src/index.ts';
import type { Pose, Quat, Vec3 } from '@spotless/core';
import { poseInverseTransformPoint, poseTransformPoint } from '@spotless/core';
import type { Shape } from '@spotless/geometry';
import { boundingBox, signedDistance } from '@spotless/geometry';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  cutleryBasketPositionId,
  cutleryBasketPositions,
  validateMachineConfig,
  withCutleryBasketAt,
} from '../config.ts';
import { cutleryBasketFootprint, cutleryTunnelStretches } from '../cutlery-placement.ts';
import { BOSCH_SMV4HAX40G as B } from '../machines.ts';
import type { ReleasedItem } from '../test-physics.ts';
import { machineWorld, releaseItem } from '../test-physics.ts';
import { expectNear, must } from '../test-util.ts';
import { validateMachineSpec } from '../validate.ts';
import { buildMachineGeometry, getMachinePart } from './build.ts';
import { cutleryFloorOpenFraction, cutleryFloorTop } from './cutlery.ts';
import type { MachineGeometry } from './types.ts';

const mm = (m: number): number => m * 1000;
const cutlery = must(B.cutleryBasket);
/** The rack-frame origin of the lower basket in the dossier's frame (rim centre), metres. */
const RIM_CENTRE: readonly [number, number] = [0.2625, 0.256];

describe('where the cutlery basket can stand', () => {
  it('names the two photographed positions and the mirror image of the second', () => {
    expect(cutlery.positions.map((p) => [p.id, p.tag])).toEqual([
      ['front_centre', 'photo'],
      ['front_right', 'photo'],
      ['front_left', 'estimated'],
    ]);
    const at = (id: string): number[] => {
      const p = must(cutlery.positions.find((q) => q.id === id)).placement;
      return [mm(p.centre[0] - RIM_CENTRE[0]), mm(p.centre[1] - RIM_CENTRE[1])];
    };
    // Dossier frame, mm: (8, -133) in the photographs of the empty machine; 104 to 123 mm right
    // of the centre line in the owner's loaded photograph, taken as 110.
    expectNear(must(at('front_centre')[0]), 8, 1e-9);
    expectNear(must(at('front_right')[0]), 110, 1e-9);
    expectNear(must(at('front_left')[0]), -110, 1e-9);
    for (const id of ['front_centre', 'front_right', 'front_left']) {
      expectNear(must(at(id)[1]), -133, 1e-9, id);
    }
    expect(cutlery.positions[0]?.placement).toEqual(cutlery.defaultPlacement);
    expect(validateMachineSpec(B).filter((p) => p.code.startsWith('cutlery_position'))).toEqual([]);
  });

  it('reads the position of a configuration and sets it', () => {
    expect(cutleryBasketPositionId(B, B.defaultConfig)).toBe('front_centre');
    const right = withCutleryBasketAt(B, B.defaultConfig, 'front_right');
    expect(cutleryBasketPositionId(B, right)).toBe('front_right');
    expect(validateMachineConfig(B, right)).toEqual([]);
    const out = withCutleryBasketAt(B, B.defaultConfig, null);
    expect(out.cutleryBasket).toBeNull();
    expect(cutleryBasketPositionId(B, out)).toBeNull();
    expect(validateMachineConfig(B, out)).toEqual([]);
    expect(() => withCutleryBasketAt(B, B.defaultConfig, 'on_the_roof')).toThrow(RangeError);
    // Everything else of the configuration is left as it was.
    expect({ ...right, cutleryBasket: null }).toEqual({ ...B.defaultConfig, cutleryBasket: null });
    expect(cutleryBasketPositions(B).map((p) => p.id)).toEqual([
      'front_centre',
      'front_right',
      'front_left',
    ]);
  });

  it('lets it slide along the side rows from wall to wall, and nowhere its feet would stand on a rail', () => {
    const problemsAt = (x: number, y: number, longAxis: 'x' | 'y' = 'y'): string[] =>
      validateMachineConfig(B, {
        ...B.defaultConfig,
        cutleryBasket: {
          basketId: 'lower',
          centre: [RIM_CENTRE[0] + x / 1000, RIM_CENTRE[1] + y / 1000],
          longAxis,
        },
      }).map((p) => p.code);
    // Astride the two side-row rail lines (y = -80 and -186, 106 mm apart like its tunnels):
    // anywhere across the basket. The tines of those rows lean along the rails, inside the
    // 14 mm tunnels.
    for (let x = -140; x <= 140; x += 10) expect(problemsAt(x, -133), `x ${x}`).toEqual([]);
    // Further out it meets the chamfered front corner of the basket: over its lid grids it is
    // 149 mm wide, and 8 mm behind the front line the chamfer leaves 220 mm either side of the
    // centre line inside the rim wire, so its centre can be 145 mm out at most.
    expect(problemsAt(150, -133)).toEqual(['config_cutlery_basket_outside']);
    expect(problemsAt(-150, -133)).toEqual(['config_cutlery_basket_outside']);
    // 10 mm further back or forward the rails are under its feet, not in its tunnels (the
    // tunnels are 14 mm wide and the rail 4 mm: 5 mm of play either way).
    expect(problemsAt(8, -133 + 4)).toEqual([]);
    expect(new Set(problemsAt(8, -133 + 10))).toEqual(new Set(['config_cutlery_basket_on_tines']));
    // (10 mm further forward it is through the front wall of the basket.)
    expect(problemsAt(8, -133 - 10)).toEqual(['config_cutlery_basket_outside']);
    // Turned a quarter turn at the front, the side rails would run lengthwise under it.
    expect(new Set(problemsAt(8, -133, 'x'))).toEqual(new Set(['config_cutlery_basket_on_tines']));
    // Astride the two hinged rear rows (99 mm apart, inside the play of the tunnels) the rule
    // lets it stand; with one of them folded, its tines lie where the feet would stand.
    expect(problemsAt(0, 117.5)).toEqual([]);
    const folded = validateMachineConfig(B, {
      ...B.defaultConfig,
      foldedTineRows: [{ basketId: 'lower', rowId: 'r1' }],
      cutleryBasket: {
        basketId: 'lower',
        centre: [RIM_CENTRE[0], RIM_CENTRE[1] + 0.1175],
        longAxis: 'y',
      },
    });
    expect(folded.map((p) => p.code)).toEqual(['config_cutlery_basket_on_tines']);
    expect(must(folded[0]).message).toContain('tine row "r1"');
  });

  it('puts the tunnels over the rail lines of the side rows at every named position', () => {
    const lower = must(B.baskets.find((b) => b.id === 'lower'));
    const rails = ['ml', 'fl'].map((id) => must(lower.tineRows.find((r) => r.id === id)).railAt);
    for (const position of cutlery.positions) {
      const tunnels = cutleryTunnelStretches(cutlery, position.placement);
      expect(tunnels).toHaveLength(2);
      for (const rail of rails) {
        const tunnel = must(tunnels.find(([a, b]) => rail > a && rail < b));
        // 14 mm clear, the rail on its centre line.
        expectNear(mm(tunnel[1] - tunnel[0]), 14, 1e-9);
        expectNear(mm((tunnel[0] + tunnel[1]) / 2 - rail), 0, 1e-9, position.id);
      }
      const footprint = cutleryBasketFootprint(cutlery, position.placement);
      expectNear(mm(footprint.body.x[1] - footprint.body.x[0]), 128, 1e-9);
      expectNear(mm(footprint.x[1] - footprint.x[0]), 149, 1e-9);
      expectNear(mm(footprint.y[1] - footprint.y[0]), 230, 1e-9);
    }
  });
});

describe.each(cutlery.positions.map((p) => [p.id] as const))(
  'the geometry and the cells follow the cutlery basket to %s',
  (positionId) => {
    const config = withCutleryBasketAt(B, B.defaultConfig, positionId);
    const geometry = buildMachineGeometry(B, config);
    const part = getMachinePart(geometry, 'cutlery_basket');
    const placement = must(config.cutleryBasket);
    const origin = must(geometry.affordances.baskets.find((b) => b.basketId === 'lower')).originTub;

    it('stands with its body centred on the placement, feet on the base grid', () => {
      const body: Shape = {
        parts: part.shape.parts.filter((p) => !p.id.startsWith('lid.')),
        regions: [],
      };
      const box = boundingBox(body, part.pose);
      expectNear(mm((box.min[0] + box.max[0]) / 2 - origin[0]), mm(placement.centre[0]), 1e-6);
      expectNear(mm((box.min[1] + box.max[1]) / 2 - origin[1]), mm(placement.centre[1]), 1e-6);
      expectNear(mm(box.min[2] - origin[2]), 0, 1e-6);
      expectNear(mm(box.max[2] - origin[2]), 220, 1e-6);
      expect(part.carriedBy).toBe('lower');
      expect(geometry.affordances.cutleryBasket?.positionId).toBe(positionId);
      expect(geometry.affordances.cutleryBasket?.poseTub).toEqual(part.pose);
    });

    it('lists eight cells whose floor centres are on its floors', () => {
      expect(geometry.affordances.cutleryCells).toHaveLength(8);
      for (const cell of geometry.affordances.cutleryCells) {
        const local = poseInverseTransformPoint(part.pose, cell.floorCentreTub);
        expectNear(mm(local[2]), 6, 1e-6, cell.id);
        expect(local[0]).toBeGreaterThan(cell.box.min[0]);
        expect(local[0]).toBeLessThan(cell.box.max[0]);
        expect(local[1]).toBeGreaterThan(cell.box.min[1]);
        expect(local[1]).toBeLessThan(cell.box.max[1]);
      }
    });

    it('has no wire of the lower basket in its walls, floors or handle', () => {
      // The rails and the tines of the side rows pass through the tunnels; the lid grids, which
      // hang on hinges outside the long walls, are left out (a tine pushes one aside).
      const rack = getMachinePart(geometry, 'lower_rack');
      const body: Shape = {
        parts: part.shape.parts.filter((p) => !p.id.startsWith('lid.')),
        regions: [],
      };
      let deepest = Number.POSITIVE_INFINITY;
      let where = '';
      for (const wire of rack.shape.parts) {
        if (wire.prim.kind !== 'capsule') continue;
        const { a, b, radius } = wire.prim;
        const steps = Math.max(
          1,
          Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 0.002),
        );
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const p: Vec3 = [
            a[0] + (b[0] - a[0]) * t,
            a[1] + (b[1] - a[1]) * t,
            a[2] + (b[2] - a[2]) * t,
          ];
          const d =
            signedDistance(
              body,
              poseInverseTransformPoint(part.pose, poseTransformPoint(rack.pose, p)),
            ) - radius;
          if (d < deepest) {
            deepest = d;
            where = wire.id;
          }
        }
      }
      // Wire surfaces may touch the feet from below (they stand on the grid) but not enter them.
      expect(mm(deepest), `deepest at ${where}`).toBeGreaterThan(-0.05);
    });

    it('marks the slots of the side rows it stands over, and leaves the others free', () => {
      const footprint = cutleryBasketFootprint(cutlery, placement);
      const blocked = geometry.affordances.tineRows
        .filter((r) => r.basketId === 'lower')
        .flatMap((r) =>
          r.slots.filter((s) => s.blockedBy !== null).map((s) => `${r.rowId}.${s.index}`),
        );
      expect(blocked.length).toBeGreaterThanOrEqual(2);
      for (const row of geometry.affordances.tineRows) {
        if (row.basketId !== 'lower') continue;
        for (const slot of row.slots) {
          const inside =
            slot.centre[0] > footprint.x[0] - 0.005 && slot.centre[0] < footprint.x[1] + 0.005;
          const side = ['ml', 'mr', 'fl', 'fr'].includes(row.rowId);
          expect(slot.blockedBy, `${row.rowId}.${slot.index}`).toBe(
            side && inside ? 'cutlery_basket' : null,
          );
        }
      }
    });
  },
);

describe('the cell floors', () => {
  it('are slabs 6 mm deep that carry the open fraction of the lattice for the wash scene', () => {
    const shape = getMachinePart(buildMachineGeometry(B), 'cutlery_basket').shape;
    const floors = shape.parts.filter((p) => /^foot\.\d\.floor$/.test(p.id));
    expect(floors).toHaveLength(3);
    for (const floor of floors) {
      const box = boundingBox({ parts: [floor], regions: [] }, { p: [0, 0, 0], q: [0, 0, 0, 1] });
      expectNear(mm(box.min[2]), 0, 1e-6);
      expectNear(mm(box.max[2]), 6, 1e-6);
      expectNear(mm(box.max[0] - box.min[0]), 128, 1e-6);
      expect(floor.porosity).toBe(cutleryFloorOpenFraction(cutlery));
    }
    expectNear(mm(cutleryFloorTop(cutlery)), 6, 1e-9);
    // Every part of the basket but the handle, the roofs of the tunnels and the rim strips the
    // lid grids hang on is lattice.
    for (const p of shape.parts) {
      const solid = p.id.startsWith('handle.') || p.id.endsWith('.roof') || p.id.endsWith('.hinge');
      expect(p.porosity === undefined, p.id).toBe(solid);
    }
  });
});

describe('cutlery let go over a cell of the cutlery basket', () => {
  let geometry: MachineGeometry;
  let world: Awaited<ReturnType<typeof machineWorld>>;
  let basketPose: Pose;
  let floorZ: number;
  beforeAll(async () => {
    geometry = buildMachineGeometry(B);
    world = await machineWorld(geometry, (id) => id === 'lower_rack' || id === 'cutlery_basket');
    basketPose = must(geometry.affordances.cutleryBasket).poseTub;
    floorZ = basketPose.p[2] + cutleryFloorTop(cutlery);
  });
  afterAll(() => world.dispose());

  /**
   * The lower end of an item standing handle down: the middle of its lowest part in plan and
   * its lowest z, in the item's frame turned to that pose.
   */
  function lowerEnd(instance: ItemInstance, q: Quat): Vec3 {
    let best: Vec3 = [0, 0, Number.POSITIVE_INFINITY];
    for (const part of instance.shape.parts) {
      const box = boundingBox({ parts: [part], regions: [] }, { p: [0, 0, 0], q });
      if (box.min[2] < best[2]) {
        best = [(box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2, box.min[2]];
      }
    }
    return best;
  }

  /**
   * Lets an item go standing handle down with its lower end over the centre of a cell's
   * opening, `drop` metres above the floor, and takes it out again once it has settled.
   */
  function letGo(
    itemId: string,
    cellId: string,
    drop: number,
  ): ReleasedItem & { readonly id: string; readonly floorContactAt: Vec3 | null } {
    const instance = instantiate(itemId);
    const cell = must(geometry.affordances.cutleryCells.find((c) => c.id === cellId));
    const q = must(instance.stablePoses.find((p) => p.name === 'handle_down')).q;
    const end = lowerEnd(instance, q);
    const centre = poseTransformPoint(basketPose, [
      (cell.box.min[0] + cell.box.max[0]) / 2,
      (cell.box.min[1] + cell.box.max[1]) / 2,
      0,
    ]);
    const id = `${itemId}_${cellId}_${Math.round(drop * 1000)}`;
    const released = releaseItem(world, id, instance, {
      p: [centre[0] - end[0], centre[1] - end[1], floorZ + drop - end[2]],
      q,
    });
    const floorContact = released.contacts.find((c) =>
      /^foot\.\d\.floor$/.test(c.a === id ? c.partB : c.partA),
    );
    world.removeBody(id);
    return {
      ...released,
      id,
      floorContactAt:
        floorContact === undefined
          ? null
          : poseInverseTransformPoint(basketPose, floorContact.position),
    };
  }

  it.each([
    ['ladle_steel_311', 'c13', 0.15],
    ['ladle_steel_311', 'c00', 0.3],
    ['dinner_knife_210', 'c11', 0.01],
    ['dinner_knife_210', 'c03', 0.3],
    ['dinner_fork_185', 'c02', 0.15],
    ['soup_spoon_190', 'c10', 0.15],
    ['teaspoon_130', 'c01', 0.01],
    ['teaspoon_130', 'c12', 0.5],
  ] as const)(
    '%s let go over %s, %f m above its floor, stands on the floor: its handle does not pass it',
    (itemId, cellId, drop) => {
      const r = letGo(itemId, cellId, drop);
      // Nothing of it is below the top of the floor (0.3 mm for the resting overlap of the
      // contact), and it is held by the cutlery basket alone: it touches nothing of the lower
      // basket under it.
      expect(mm(r.bottomZ - floorZ), `${r.id} lowest point above the floor`).toBeGreaterThan(-0.3);
      expect(mm(r.bottomZ - floorZ), `${r.id} lowest point above the floor`).toBeLessThan(2);
      expect(r.atRest, r.id).toBe(true);
      const others = r.contacts.map((c) => (c.a === r.id ? c.b : c.a));
      expect(new Set(others)).toEqual(new Set(['cutlery_basket']));
      // Its lower end is on the floor of the cell it was let down into.
      const at = must(r.floorContactAt, `${r.id} floor contact`);
      const cell = must(geometry.affordances.cutleryCells.find((c) => c.id === cellId));
      expect(at[0], r.id).toBeGreaterThan(cell.interior.min[0] - 0.001);
      expect(at[0], r.id).toBeLessThan(cell.interior.max[0] + 0.001);
      expect(at[1], r.id).toBeGreaterThan(cell.interior.min[1] - 0.001);
      expect(at[1], r.id).toBeLessThan(cell.interior.max[1] + 0.001);
    },
    20_000,
  );

  it("the review's ladle went down beside the basket, not through a floor, and no longer can", () => {
    // The reproduction that was read as "a 311 mm ladle goes through the cell floor" let the
    // ladle go with the middle of its bounding box over a cell. Standing handle down its bowl
    // reaches 77 mm to one side of its handle, so the handle came down 39 mm from that point:
    // outside the long wall of the basket, between the wall and the lid grid that hangs on it.
    const instance = instantiate('ladle_steel_311');
    const q = must(instance.stablePoses.find((p) => p.name === 'handle_down')).q;
    const box = boundingBox(instance.shape, { p: [0, 0, 0], q });
    const end = lowerEnd(instance, q);
    const offset = Math.hypot(
      end[0] - (box.min[0] + box.max[0]) / 2,
      end[1] - (box.min[1] + box.max[1]) / 2,
    );
    expect(mm(offset)).toBeGreaterThan(30);
    expect(mm(offset)).toBeLessThan(45);
    // 96 mm across the basket plus that offset is outside its 128 mm body.
    expect(96 + mm(offset)).toBeGreaterThan(128);
    expect(96 + mm(offset)).toBeLessThan(128 + (149 - 128) / 2);
    // That gap is closed now by the rim the lid hangs on: straight down the middle of it, all
    // along both long walls, the way is shut 1.5 mm under the top of the body. (A ladle let go
    // on that rim falls over, into the basket or out of it; it no longer goes down beside it.)
    const shape = getMachinePart(geometry, 'cutlery_basket').shape;
    for (const x of [-(149 - 128) / 4, 128 + (149 - 128) / 4]) {
      for (let y = 5; y <= 225; y += 10) {
        expect(
          signedDistance(shape, [x / 1000, y / 1000, 0.127 - 0.0015]),
          `x ${x}, y ${y}`,
        ).toBeLessThan(0);
      }
    }
  });

  it('a knife let down on the listed centre of every cell stays in that cell', () => {
    // Before the cells were rebuilt the two middle compartments were listed whole, with their
    // divider at the listed centre: a knife let down there ended 157 mm away.
    expect(geometry.affordances.cutleryCells).toHaveLength(8);
    for (const cell of geometry.affordances.cutleryCells) {
      const instance = instantiate('dinner_knife_210');
      const q = must(instance.stablePoses.find((p) => p.name === 'handle_down')).q;
      const end = lowerEnd(instance, q);
      const centre = poseTransformPoint(basketPose, [
        (cell.box.min[0] + cell.box.max[0]) / 2,
        (cell.box.min[1] + cell.box.max[1]) / 2,
        0,
      ]);
      const id = `knife_${cell.id}`;
      const released = releaseItem(world, id, instance, {
        p: [centre[0] - end[0], centre[1] - end[1], floorZ + 0.01 - end[2]],
        q,
      });
      // Its lower end is on the floor of this cell: inside the cell's walls in plan.
      const settled = boundingBox(instance.shape, released.pose);
      expect(mm(settled.min[2] - floorZ), id).toBeLessThan(2);
      expect(mm(settled.min[2] - floorZ), id).toBeGreaterThan(-0.3);
      const floorContact = must(
        released.contacts.find((c) => /^foot\.\d\.floor$/.test(c.a === id ? c.partB : c.partA)),
        `${id} floor contact`,
      );
      const at = poseInverseTransformPoint(basketPose, floorContact.position);
      expect(at[0], id).toBeGreaterThan(cell.interior.min[0] - 0.001);
      expect(at[0], id).toBeLessThan(cell.interior.max[0] + 0.001);
      expect(at[1], id).toBeGreaterThan(cell.interior.min[1] - 0.001);
      expect(at[1], id).toBeLessThan(cell.interior.max[1] + 0.001);
      // It stands leaning in the cell: its top is still above the rim.
      expect(mm(settled.max[2] - basketPose.p[2]), id).toBeGreaterThan(127);
      world.removeBody(id);
    }
  });
});
