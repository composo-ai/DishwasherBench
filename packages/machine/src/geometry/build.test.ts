/**
 * `buildMachineGeometry` on the owner's Bosch and on SPOT-60: every shape goes through the
 * geometry kernel, the parts are where the dossier and the owner's tape put them, nothing leaves
 * the tub, the nozzles sit where the nozzle kinematics say, and the arms clear everything
 * through a full turn at every position of the upper basket.
 */

import type { Pose, Vec3 } from '@spotless/core';
import { poseCompose, poseTransformPoint } from '@spotless/core';
import type { Aabb, Shape } from '@spotless/geometry';
import {
  boundingBox,
  buildCollisionPieces,
  buildRenderMesh,
  COLLISION_CHORD_ERROR,
  meshTopology,
  signedDistance,
} from '@spotless/geometry';
import { describe, expect, it, vi } from 'vitest';
import { getSprayArm } from '../config.ts';
import { nozzleState } from '../kinematics.ts';
import { BOSCH_SMV4HAX40G as B, SPOT_60 } from '../machines.ts';
import { expectNear, must } from '../test-util.ts';
import type { MachineConfig, MachineSpec } from '../types.ts';
import { buildMachineGeometry, getMachinePart, machinePartPose } from './build.ts';
import { sweptClearance, sweptDistance, sweptPenetration } from './swept.ts';
import { tubInterior } from './tub.ts';
import type { MachineGeometry, MachinePart } from './types.ts';

// These tests search whole baskets and turn whole arms: slow when the machine is busy with
// the other packages' suites.
vi.setConfig({ testTimeout: 120_000 });

const mm = (m: number): number => m * 1000;
const geometry = buildMachineGeometry(B);
const LEVELS = ['1', '2', '3'] as const;
const atLevel = (level: string): MachineConfig => ({
  ...B.defaultConfig,
  basketHeights: { upper: level },
});

function boxOf(part: MachinePart, pose: Pose = part.pose): Aabb {
  return boundingBox(part.shape, pose);
}

describe('buildMachineGeometry: parts and frames', () => {
  it('returns the named parts of the Bosch in a fixed order', () => {
    expect(geometry.parts.map((p) => p.id)).toEqual([
      'tub',
      'filter',
      'door',
      'dispenser',
      'feed_duct',
      'roof_sprayer',
      'lower_rack',
      'lower_rack_fittings',
      'cutlery_basket',
      'upper_rack',
      'upper_rack_fittings',
      'upper_rack_tablet_tray',
      'upper_arm_feed',
      'lower_arm',
      'upper_arm',
    ]);
    expect(geometry.machineId).toBe(B.id);
    // The same input gives the same output (a pure function).
    expect(JSON.stringify(buildMachineGeometry(B))).toBe(JSON.stringify(geometry));
  });

  it('says what is static, what is kinematic and about which axis', () => {
    for (const id of ['tub', 'filter', 'dispenser', 'feed_duct', 'roof_sprayer']) {
      const part = getMachinePart(geometry, id);
      expect(part.body).toBe('static');
      expect(part.motion.kind).toBe('static');
      expect(part.frame).toBe('tub');
    }
    const lowerRack = getMachinePart(geometry, 'lower_rack');
    expect(lowerRack.body).toBe('kinematic');
    expect(lowerRack.frame).toBe('lower_rack');
    expect(lowerRack.motion).toEqual({ kind: 'prismatic', direction: [0, -1, 0], travel: 0.5 });
    // Rack frame: origin at the front-left corner at the top of the base grid; the dossier's
    // basket is 525 mm wide, stands 6 mm in front of the arm axis, and the top of its grid (the
    // cross wires) is at 73 mm: 8 mm above the underside of the lowest wires at 65 mm.
    expect(lowerRack.pose.q).toEqual([0, 0, 0, 1]);
    [-262.5, -262, 73].forEach((v, k) => expectNear(mm(must(lowerRack.pose.p[k])), v, 1e-9));
    for (const id of ['lower_rack_fittings', 'cutlery_basket']) {
      expect(getMachinePart(geometry, id).carriedBy).toBe('lower');
    }
    for (const id of [
      'upper_rack_fittings',
      'upper_rack_tablet_tray',
      'upper_arm_feed',
      'upper_arm',
    ]) {
      expect(getMachinePart(geometry, id).carriedBy).toBe('upper');
    }
    const lowerArm = getMachinePart(geometry, 'lower_arm');
    expect(lowerArm.role).toBe('arm');
    expect(lowerArm.frame).toBe('arm:lower');
    // Clockwise seen from above (owner update section 2.4); the upper arm counter-clockwise.
    expect(lowerArm.motion).toEqual({
      kind: 'revolute',
      point: [0, 0, 0],
      axis: [0, 0, 1],
      sense: -1,
      range: null,
    });
    expect(must(lowerArm.arm)).toEqual({
      index: 0,
      levelId: 'lower',
      hingePoint: [0, 0, 0],
      hingeAxis: [0, 0, 1],
      senseSign: -1,
    });
    expect(must(getMachinePart(geometry, 'upper_arm').arm).index).toBe(1);
    expect(must(getMachinePart(geometry, 'upper_arm').arm).senseSign).toBe(1);
    // The door turns about its hinge, which is parallel to x.
    const door = getMachinePart(geometry, 'door');
    expect(door.motion.kind).toBe('revolute');
    if (door.motion.kind === 'revolute') {
      expect(door.motion.axis).toEqual([1, 0, 0]);
      expectNear(mm(door.motion.point[1]), -250, 1e-9);
      expectNear(must(door.motion.range)[1], Math.PI / 2, 1e-12);
    }
  });

  it('gives each part a material of the catalogue and the role the wash simulation expects', () => {
    const roles = new Map(geometry.parts.map((p) => [p.id, p.role]));
    expect(roles.get('lower_rack')).toBe('wires');
    expect(roles.get('upper_rack')).toBe('wires');
    expect(roles.get('cutlery_basket')).toBe('basket');
    expect(roles.get('tub')).toBe('tub');
    expect(roles.get('upper_arm')).toBe('arm');
    const known = new Set(['stainless_steel', 'rack_wire_pa11', 'polypropylene']);
    for (const part of geometry.parts) {
      expect(known.has(part.material), part.id).toBe(true);
      for (const p of part.shape.parts)
        expect(known.has(p.material), `${part.id}/${p.id}`).toBe(true);
    }
  });

  it('rejects a configuration the machine does not have', () => {
    expect(() => buildMachineGeometry(B, atLevel('4'))).toThrow(RangeError);
    expect(() =>
      buildMachineGeometry(B, {
        ...B.defaultConfig,
        foldedTineRows: [{ basketId: 'lower', rowId: 'ml' }],
      }),
    ).toThrow(/fixed/);
  });

  it('leaves the cutlery basket out when the configuration takes it out, and turns it when asked', () => {
    const without = buildMachineGeometry(B, { ...B.defaultConfig, cutleryBasket: null });
    expect(without.parts.some((p) => p.id === 'cutlery_basket')).toBe(false);
    expect(without.affordances.cutleryCells).toHaveLength(0);
    // Long side along x, on the open floor between the second rear row and the side rows (the
    // only place it can stand turned: at the front the rails of the side rows would run
    // lengthwise under it): the bounding box swaps its plan sizes about the placement's centre.
    const placement = must(B.defaultConfig.cutleryBasket);
    expect(() =>
      buildMachineGeometry(B, {
        ...B.defaultConfig,
        cutleryBasket: { ...placement, longAxis: 'x' },
      }),
    ).toThrow(/rail runs lengthwise under the cutlery basket/);
    const centre = [0.2625, 0.25] as const;
    const turned = buildMachineGeometry(B, {
      ...B.defaultConfig,
      cutleryBasket: { basketId: 'lower', centre, longAxis: 'x' },
    });
    const a = boxOf(getMachinePart(geometry, 'cutlery_basket'));
    const b = boxOf(getMachinePart(turned, 'cutlery_basket'));
    expectNear(b.max[0] - b.min[0], a.max[1] - a.min[1], 1e-9, 'length along x');
    expectNear(b.max[1] - b.min[1], a.max[0] - a.min[0], 1e-9, 'width along y');
    const origin = must(turned.affordances.baskets.find((e) => e.basketId === 'lower')).originTub;
    expectNear((b.min[0] + b.max[0]) / 2, origin[0] + centre[0], 1e-9, 'centre x');
    expectNear((b.min[1] + b.max[1]) / 2, origin[1] + centre[1], 1e-9, 'centre y');
    expect(turned.affordances.cutleryBasket?.positionId).toBeNull();
    expect(geometry.affordances.cutleryBasket?.positionId).toBe('front_centre');
  });
});

describe.each([
  ['Bosch SMV4HAX40G', B],
  ['SPOT-60', SPOT_60],
] as const)('%s: every shape is valid input to the geometry kernel', (_name, spec: MachineSpec) => {
  const built = buildMachineGeometry(spec);

  it('has no degenerate primitive', () => {
    for (const part of built.parts) {
      for (const p of part.shape.parts) {
        const where = `${part.id}/${p.id}`;
        const prim = p.prim;
        if (prim.kind === 'capsule') {
          expect(prim.radius, where).toBeGreaterThan(0.0005);
          const length = Math.hypot(
            prim.b[0] - prim.a[0],
            prim.b[1] - prim.a[1],
            prim.b[2] - prim.a[2],
          );
          // A capsule of no length is a ball: only the ball ends of tines are meant to be.
          if (length === 0) expect(p.id, where).toMatch(/\.tip\./);
          else expect(length, where).toBeGreaterThan(1e-5);
        } else if (prim.kind === 'rbox') {
          for (const k of [0, 1, 2] as const) {
            expect(prim.halfExtents[k] + prim.radius, where).toBeGreaterThan(0.0002);
          }
        } else if (prim.kind === 'hull') {
          expect(prim.points.length, where).toBeGreaterThanOrEqual(4);
        } else {
          expect(prim.profile.length, where).toBeGreaterThanOrEqual(2);
          for (const v of prim.profile) expect(v.t, where).toBeGreaterThan(0);
        }
        if (p.porosity !== undefined) {
          expect(p.porosity, where).toBeGreaterThan(0);
          expect(p.porosity, where).toBeLessThan(1);
        }
      }
      // Part ids are unique within a shape.
      expect(new Set(part.shape.parts.map((p) => p.id)).size, part.id).toBe(
        part.shape.parts.length,
      );
    }
  });

  it('gives a finite bounding box, collision pieces, a closed render mesh and a signed distance', () => {
    for (const part of built.parts) {
      const box = boxOf(part);
      for (const k of [0, 1, 2] as const) {
        expect(Number.isFinite(box.min[k]) && Number.isFinite(box.max[k]), part.id).toBe(true);
        expect(box.max[k], part.id).toBeGreaterThan(box.min[k]);
      }
      const pieces = buildCollisionPieces(part.shape, { chordError: COLLISION_CHORD_ERROR });
      expect(pieces.length, part.id).toBeGreaterThanOrEqual(part.shape.parts.length);
      const mesh = buildRenderMesh(part.shape, { chordError: COLLISION_CHORD_ERROR });
      expect(mesh.indices.length, part.id).toBeGreaterThan(0);
      // Each part's triangles form a closed surface: every part that is not a capsule, and
      // every 20th capsule (the check walks the whole mesh once per part).
      for (let p = 0; p < part.shape.parts.length; p++) {
        if (must(part.shape.parts[p]).prim.kind === 'capsule' && p % 20 !== 0) continue;
        const topology = meshTopology(mesh, p);
        expect(topology.closed, `${part.id}/${must(part.shape.parts[p]).id}`).toBe(true);
      }
      // The signed distance is negative at the centre of a part and positive far away.
      const first = must(part.shape.parts[0]);
      const inside: Vec3 =
        first.prim.kind === 'capsule'
          ? poseTransformPoint(first.pose, first.prim.a)
          : first.prim.kind === 'rbox'
            ? first.pose.p
            : first.prim.kind === 'hull'
              ? poseTransformPoint(first.pose, centroid(first.prim.points))
              : poseTransformPoint(first.pose, [
                  must(first.prim.profile[1]).r,
                  0,
                  must(first.prim.profile[1]).z,
                ]);
      expect(signedDistance(part.shape, inside), part.id).toBeLessThan(0);
      const far = signedDistance(part.shape, [5, 5, 5]);
      expect(far, part.id).toBeGreaterThan(4);
      expect(Number.isFinite(far)).toBe(true);
    }
  }, 60_000);

  it('turns each wire capsule into exactly one collision capsule', () => {
    for (const part of built.parts) {
      if (part.component !== 'basket_wires') continue;
      const pieces = buildCollisionPieces(part.shape, { chordError: COLLISION_CHORD_ERROR });
      expect(pieces).toHaveLength(part.shape.parts.length);
      expect(pieces.every((piece) => piece.kind === 'capsule')).toBe(true);
    }
  });
});

function centroid(points: readonly Vec3[]): Vec3 {
  const sum = points.reduce<[number, number, number]>(
    (s, p) => [s[0] + p[0], s[1] + p[1], s[2] + p[2]],
    [0, 0, 0],
  );
  return [sum[0] / points.length, sum[1] / points.length, sum[2] / points.length];
}

describe('Bosch: collision cost', () => {
  it('reports the number of collision capsules per basket', () => {
    const counts = geometry.properties.capsulesByBasket;
    // The loading physics pays for each of these on every step: say how many there are.
    console.log(
      `collision capsules per basket (Bosch SMV4HAX40G, default configuration): lower ${counts.lower}, upper ${counts.upper}`,
    );
    const spot = buildMachineGeometry(SPOT_60).properties.capsulesByBasket;
    console.log(`collision capsules per basket (SPOT-60): ${JSON.stringify(spot)}`);
    expect(counts.lower).toBe(getMachinePart(geometry, 'lower_rack').shape.parts.length);
    expect(counts.upper).toBe(getMachinePart(geometry, 'upper_rack').shape.parts.length);
    // A budget, so that a change that doubles the cost is noticed. The upper basket's 14 cross
    // wires each bend eight times for the floor relief of IMG_9131 (seven for the relief before
    // it; the two slopes that fall to the low floor by the walls are new), three or four
    // capsules a bend, and there is a twelfth front-back wire: 869 capsules (under 850 before).
    expect(must(counts.lower)).toBeLessThan(450);
    expect(must(counts.upper)).toBeLessThan(900);
    // Folding rows or lowering shelves changes poses, not the number of capsules.
    const folded = buildMachineGeometry(B, {
      ...B.defaultConfig,
      foldedTineRows: [
        { basketId: 'lower', rowId: 'r1' },
        { basketId: 'upper', rowId: 'c_front' },
      ],
    });
    expect(folded.properties.capsulesByBasket).toEqual(counts);
  });
});

describe("Bosch: the vertical stack of the generated shapes against the owner's tape", () => {
  // docs/reference/owner-measurements.md. The specification was set to these readings, so the
  // tolerance here is that of the arithmetic (0.5 mm), not that of the tape (5 mm).
  const lowerArm = boxOf(getMachinePart(geometry, 'lower_arm'));
  const upperArm = boxOf(getMachinePart(geometry, 'upper_arm'));
  const lowerRack = getMachinePart(geometry, 'lower_rack');
  const upperRack = getMachinePart(geometry, 'upper_rack');
  // Every wire of the lower basket's floor, both layers: the tape was held between the arm and
  // the basket, so the reading is to the lowest of them, whichever family that is.
  const floorWires: Shape = {
    parts: lowerRack.shape.parts.filter((p) => p.id.startsWith('floor.')),
    regions: [],
  };
  const lowestWire = boundingBox(floorWires, lowerRack.pose).min[2];

  it('top of the lower arm to the lowest lower-basket floor wire: 1.5 cm', () => {
    // The top face of the blades (the nozzle rings stand 2 mm higher) to the underside of the
    // lowest wire of the floor. Nothing of the basket is nearer to the arm than that.
    const armTop = getMachinePart(geometry, 'lower_arm').pose.p[2];
    expectNear(mm(lowestWire - armTop), 15, 0.5);
    expectNear(mm(boxOf(lowerRack).min[2] - armTop), 15, 0.5, 'the whole wire basket');
    expectNear(mm(lowerArm.max[2] - armTop), 2, 0.01, 'nozzle rings');
    // The lowest wires are the five front-back ones; the two cross wires lie 4 mm higher.
    const family = (prefix: string): number =>
      boundingBox(
        { parts: floorWires.parts.filter((p) => p.id.startsWith(prefix)), regions: [] },
        lowerRack.pose,
      ).min[2];
    expectNear(mm(family('floor.y.') - lowestWire), 0, 1e-6);
    expectNear(mm(family('floor.x.') - lowestWire), 4, 1e-6);
  });

  it('lowest lower-basket floor wire to the underside of the upper arm: 30 cm', () => {
    expectNear(mm(upperArm.min[2] - lowestWire), 300, 0.5);
  });

  it('top-basket floor to roof: 22 cm, and filter plate to roof: 64 cm', () => {
    const tub = getMachinePart(geometry, 'tub');
    const roof: Shape = { parts: tub.shape.parts.filter((p) => p.id === 'roof'), regions: [] };
    const roofUnderside = boundingBox(roof).min[2];
    expectNear(mm(roofUnderside), 640, 1e-6);
    // The floor of the upper basket is the top of its front-back wires in the left trough of
    // the floor relief (those at x = -108 and -41 from the arm axis, 136 and 203 mm in the rack
    // frame): the rack-frame origin. The lowest of them lie on the low floor by the walls, 1 mm
    // (left) and 1.5 mm (right) under it (IMG_9131); the highest is the centre wire, on the
    // ramp 31 mm up, just right of the centre ridge.
    const frontBack = upperRack.shape.parts.filter(
      (p) =>
        p.id.startsWith('floor.y.') && p.prim.kind === 'capsule' && p.prim.a[2] === p.prim.b[2],
    );
    const topOfWire = (p: (typeof frontBack)[number]) =>
      boundingBox({ parts: [p], regions: [] }, upperRack.pose).max[2];
    const tops = frontBack.map(topOfWire);
    const inTrough = frontBack
      .filter((p) => p.prim.kind === 'capsule' && p.prim.a[0] > 0.11 && p.prim.a[0] < 0.21)
      .map(topOfWire);
    expect(inTrough.length).toBeGreaterThanOrEqual(2);
    for (const top of inTrough) expectNear(mm(roofUnderside - top), 220, 1e-6);
    expectNear(mm(roofUnderside - Math.min(...tops)), 220 + 1.5, 1e-6, 'by the right wall');
    expectNear(mm(roofUnderside - Math.max(...tops)), 220 - 31, 0.5, 'the centre wire');
    // The floor wires away from the walls (where they turn up to the rim): their highest
    // point is the top of the right ridge, 33.5 mm above the trough level of the cross wires,
    // which is 3.5 mm under the floor: 30 mm above the floor.
    const middle: Shape = {
      parts: upperRack.shape.parts.filter(
        (p) =>
          p.id.startsWith('floor.x.') &&
          p.prim.kind === 'capsule' &&
          Math.min(p.prim.a[0], p.prim.b[0]) > 0.05 &&
          Math.max(p.prim.a[0], p.prim.b[0]) < 0.45,
      ),
      regions: [],
    };
    expectNear(
      mm(roofUnderside - boundingBox(middle, upperRack.pose).max[2]),
      220 - 30,
      1,
      'ridge',
    );
    // The filter plate's top is the datum.
    const filter = getMachinePart(geometry, 'filter');
    const plate: Shape = {
      parts: filter.shape.parts.filter((p) => p.id === 'flat_plate'),
      regions: [],
    };
    expectNear(mm(boundingBox(plate).max[2]), 0, 1e-6);
  });

  it('moves the upper basket and everything it carries down 25 mm per level', () => {
    const carried = [
      'upper_rack',
      'upper_rack_fittings',
      'upper_rack_tablet_tray',
      'upper_arm_feed',
      'upper_arm',
    ];
    const z1 = carried.map((id) => boxOf(getMachinePart(geometry, id)).min[2]);
    LEVELS.forEach((level, k) => {
      const g = buildMachineGeometry(B, atLevel(level));
      carried.forEach((id, i) => {
        expectNear(
          mm(must(z1[i]) - boxOf(getMachinePart(g, id)).min[2]),
          25 * k,
          1e-6,
          `${id} at level ${level}`,
        );
      });
      // What is fixed to the tub does not move.
      expect(boxOf(getMachinePart(g, 'lower_rack'))).toEqual(
        boxOf(getMachinePart(geometry, 'lower_rack')),
      );
      expect(boxOf(getMachinePart(g, 'roof_sprayer'))).toEqual(
        boxOf(getMachinePart(geometry, 'roof_sprayer')),
      );
    });
  });
});

describe('Bosch: nothing outside the tub', () => {
  const inside = tubInterior(B);

  it('keeps every basket, arm and fitting inside the chamber at every upper-basket position', () => {
    // The chamber: between the side walls (545 mm), from the door liner to the rear wall, from
    // the filter plate to the roof at 640 mm.
    expectNear(mm(inside.max[0] - inside.min[0]), 545, 1e-9);
    expectNear(mm(inside.max[2] - inside.min[2]), 640, 1e-9);
    const exempt = new Set(['tub', 'door', 'filter']);
    for (const level of LEVELS) {
      for (const shelves of ['default', 'other'] as const) {
        const base = atLevel(level);
        const config: MachineConfig =
          shelves === 'default'
            ? base
            : {
                ...base,
                shelves: [
                  { basketId: 'upper', shelfId: 'cup_front', state: 'down' },
                  { basketId: 'upper', shelfId: 'cup_rear', state: 'down' },
                  { basketId: 'upper', shelfId: 'knife_shelf', state: 'up' },
                ],
                foldedTineRows: [
                  { basketId: 'lower', rowId: 'r1' },
                  { basketId: 'lower', rowId: 'r2' },
                  { basketId: 'upper', rowId: 'c_rear' },
                  { basketId: 'upper', rowId: 'c_front' },
                ],
              };
        const g = buildMachineGeometry(B, config);
        for (const part of g.parts) {
          if (exempt.has(part.id)) continue;
          // A spray arm must stay inside at every angle: test it through a turn.
          const angles = part.arm === undefined ? [0] : [0, 0.3, 0.9, 1.5708, 2.4];
          for (const armAngle of angles) {
            const box = boxOf(part, machinePartPose(g, part, { armAngle }));
            for (const k of [0, 1, 2] as const) {
              expect(
                box.min[k],
                `${part.id} at level ${level} (${shelves}), axis ${k}`,
              ).toBeGreaterThanOrEqual(inside.min[k] - 1e-9);
              expect(
                box.max[k],
                `${part.id} at level ${level} (${shelves}), axis ${k}`,
              ).toBeLessThanOrEqual(inside.max[k] + 1e-9);
            }
          }
        }
      }
    }
  });

  it('keeps the filter parts above the floor under the lower arm, and the sump below the floor', () => {
    const filter = getMachinePart(geometry, 'filter');
    const top = (id: string): number =>
      mm(boundingBox({ parts: filter.shape.parts.filter((p) => p.id === id), regions: [] }).max[2]);
    // Coarse-filter crown about 28 mm and salt cap about 25 mm above the plate, both under the
    // arm's underside at 36 mm (dossier 5.5).
    expectNear(top('coarse_crown'), 28, 0.01);
    expectNear(top('salt_cap'), 25, 0.01);
    expect(top('sump_well')).toBeLessThan(0);
    // The perforated sheets carry their open fraction: 0.30 for the flat filter.
    expect(must(filter.shape.parts.find((p) => p.id === 'flat_plate')).porosity).toBe(0.3);
  });

  it('closes the chamber: the tub and the door liner bound the interior on all six sides', () => {
    const tub = getMachinePart(geometry, 'tub');
    const door = getMachinePart(geometry, 'door');
    const centre: Vec3 = [0, 0, 0.3];
    // Rays from the middle of the chamber to far outside must end inside a wall.
    const directions: Vec3[] = [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0.3, 0.2, -1],
      [1, 1, 0],
      [-1, 1, 0.2],
    ];
    for (const d of directions) {
      let hit = false;
      for (let t = 0; t < 1.2 && !hit; t += 0.0005) {
        const p: Vec3 = [centre[0] + d[0] * t, centre[1] + d[1] * t, centre[2] + d[2] * t];
        hit =
          signedDistance(tub.shape, p) < 0 ||
          signedDistance(door.shape, p) < 0 ||
          signedDistance(getMachinePart(geometry, 'filter').shape, p) < 0;
      }
      expect(hit, `ray ${d.join(',')}`).toBe(true);
    }
    expect(signedDistance(tub.shape, centre)).toBeGreaterThan(0.2);
  });
});

describe('Bosch: nozzles and arm kinematics', () => {
  it("has one boss per nozzle of the owner update's tables: 11 on the lower arm, 8 on the upper", () => {
    const count = (id: string): number =>
      getMachinePart(geometry, id).shape.parts.filter((p) => p.id.startsWith('nozzle.')).length;
    expect(count('lower_arm')).toBe(11);
    expect(count('upper_arm')).toBe(8);
    // Lower arm: 8 round holes and 2 tip slots on top, 5 holes on the "+" blade and 3 on the
    // "-" blade, 1 outlet underneath (owner update section 0, item 1). Read from the shape: a
    // boss on the "+" blade has x > 0 in the arm frame.
    const lower = getMachinePart(geometry, 'lower_arm').shape.parts.filter((p) =>
      p.id.startsWith('nozzle.'),
    );
    const x = (id: string): number => {
      const part = must(lower.find((p) => p.id === `nozzle.${id}`));
      return part.prim.kind === 'capsule' ? mm(part.prim.a[0]) : NaN;
    };
    // Radii of the update's table, mm; negative on the "-" blade.
    const table: Record<string, number> = {
      l1: 45,
      l2: -69,
      l3: 91,
      l4: 114,
      l5: 138,
      l6: -161,
      l7: 183,
      l8: -207,
      l9: 225,
      l10: -225,
      l11: 207,
    };
    for (const [id, r] of Object.entries(table)) expectNear(x(id), r, 1e-6, id);
    const upper = getMachinePart(geometry, 'upper_arm').shape.parts.filter((p) =>
      p.id.startsWith('nozzle.'),
    );
    const ux = (id: string): number => {
      const part = must(upper.find((p) => p.id === `nozzle.${id}`));
      return part.prim.kind === 'capsule' ? mm(part.prim.a[0]) : NaN;
    };
    const upperTable: Record<string, number> = {
      u1: 41,
      u2: -85,
      u3: 130,
      u4: 160,
      u5: -193,
      u6: 219,
      u7: -223,
      u8: 38,
    };
    for (const [id, r] of Object.entries(upperTable)) expectNear(ux(id), r, 1e-6, id);
  });

  it('puts every nozzle boss where nozzleState puts the nozzle, at any arm angle and level', () => {
    for (const level of LEVELS) {
      const config = atLevel(level);
      const g = buildMachineGeometry(B, config);
      for (const armId of ['lower', 'upper']) {
        const arm = getSprayArm(B, armId);
        const part = getMachinePart(g, `${armId}_arm`);
        for (const angle of [0, 0.7, 2.1, -1.3, 3.9]) {
          const pose = machinePartPose(g, part, { armAngle: angle });
          for (const nozzle of arm.nozzles) {
            const boss = must(part.shape.parts.find((p) => p.id === `nozzle.${nozzle.id}`));
            const box = boundingBox({ parts: [boss], regions: [] }, pose);
            const state = nozzleState(B, armId, nozzle.id, angle, 0, 0, config);
            const where = `${nozzle.id} at ${angle} rad, level ${level}`;
            expectNear((box.min[0] + box.max[0]) / 2, state.position[0], 1e-9, where);
            expectNear((box.min[1] + box.max[1]) / 2, state.position[1], 1e-9, where);
            // The exit plane is the top of an upward boss and the bottom of a downward one.
            const exit = nozzle.face === 'top' ? box.max[2] : box.min[2];
            expectNear(exit, state.position[2], 1e-9, where);
          }
        }
      }
    }
  });

  it("spans 460 mm tip to tip on both arms (part pages; 457.6 mm on the owner's tape)", () => {
    for (const id of ['lower_arm', 'upper_arm']) {
      const box = boxOf(getMachinePart(geometry, id));
      expectNear(mm(box.max[0] - box.min[0]), 460, 0.01, id);
    }
    // Lower arm: blades 14 mm thick with the top face at 50 mm, on a 28.5 mm stem to the floor.
    const lower = getMachinePart(geometry, 'lower_arm');
    const blade: Shape = {
      parts: lower.shape.parts.filter((p) => p.id.startsWith('blade.')),
      regions: [],
    };
    const bladeBox = boundingBox(blade, lower.pose);
    expectNear(mm(bladeBox.max[2]), 50, 1e-6);
    expectNear(mm(bladeBox.min[2]), 36, 1e-6);
    // About 39 mm wide near the hub (owner update section 6).
    expectNear(mm(bladeBox.max[1] - bladeBox.min[1]), 39, 0.01);
    const stem = boundingBox(
      { parts: lower.shape.parts.filter((p) => p.id === 'stem'), regions: [] },
      lower.pose,
    );
    expectNear(mm(stem.max[0] - stem.min[0]), 28.5, 1e-6);
    expectNear(mm(stem.min[2]), 0, 1e-6);
    expectNear(mm(stem.max[2]), 36, 1e-6);
    // Upper arm: hub 49 mm across and 30 mm deep, its lowest point 55 mm under the basket floor.
    const upper = getMachinePart(geometry, 'upper_arm');
    const hub = boundingBox(
      { parts: upper.shape.parts.filter((p) => p.id === 'hub'), regions: [] },
      upper.pose,
    );
    expectNear(mm(hub.max[0] - hub.min[0]), 49, 1e-6);
    expectNear(mm(hub.max[2] - hub.min[2]), 30, 1e-6);
    expectNear(mm(hub.min[2]), 420 - 55, 1e-6);
  });
});

describe('the guide rails of the upper basket on the tub walls', () => {
  it('draws the two 460 x 51 x 16 mm rails of the part page on the side walls, beside the upper basket', () => {
    // Dossier 2.5: guide rail 00668097, 460 mm long, section 51 x 16 mm, one on each side wall.
    // Its height on the wall is not recorded: placed with its lower edge level with the floor
    // of the upper basket at level 1 (420 mm).
    const tub = getMachinePart(geometry, 'tub');
    const rails = tub.shape.parts.filter((p) => p.id.startsWith('feature.guide_rail_'));
    expect(rails.map((p) => p.id).sort()).toEqual([
      'feature.guide_rail_left',
      'feature.guide_rail_right',
    ]);
    const inside = tubInterior(B);
    for (const rail of rails) {
      const box = boundingBox({ parts: [rail], regions: [] });
      expectNear(mm(box.max[1] - box.min[1]), 460, 1e-6, 'length');
      expectNear(mm(box.max[2] - box.min[2]), 51, 1e-6, 'height');
      expectNear(mm(box.max[0] - box.min[0]), 16, 1e-6, 'proud of the wall');
      expectNear(mm(box.min[2]), 420, 1e-6, 'lower edge');
      // It stands on its wall, inside the chamber.
      const onLeft = rail.id.endsWith('left');
      expectNear(mm(onLeft ? box.min[0] : box.max[0]), mm(inside[onLeft ? 'min' : 'max'][0]), 1e-6);
      expect(box.min[1]).toBeGreaterThanOrEqual(B.tub.y[0]);
      expect(box.max[1]).toBeLessThanOrEqual(B.tub.y[1]);
    }
    // The upper basket runs between them at every level, and nothing it carries touches them.
    for (const level of LEVELS) {
      const g = buildMachineGeometry(B, atLevel(level));
      const rack = boxOf(getMachinePart(g, 'upper_rack'));
      const [left, right] = ['left', 'right'].map((side) =>
        boundingBox({
          parts: [must(rails.find((p) => p.id.endsWith(side)))],
          regions: [],
        }),
      );
      expect(rack.min[0]).toBeGreaterThan(must(left).max[0]);
      expect(rack.max[0]).toBeLessThan(must(right).min[0]);
    }
    // The other wall features have no recorded position and are not drawn.
    expect(B.wallFeatures.filter((f) => f.position !== null).map((f) => f.kind)).toEqual([
      'guide_rail',
      'guide_rail',
    ]);
    expect(tub.shape.parts.filter((p) => p.id.startsWith('feature.'))).toHaveLength(2);
    // SPOT-60 records no wall feature positions: its tub has none.
    const spot = getMachinePart(buildMachineGeometry(SPOT_60), 'tub');
    expect(spot.shape.parts.some((p) => p.id.startsWith('feature.'))).toBe(false);
  });
});

describe('how far a point is inside a swept volume', () => {
  it('is the distance to the nearest face of the ring, and zero outside', () => {
    const sweep = {
      levelId: 'x',
      partId: 'x_arm',
      axis: [0.1, -0.03] as const,
      rings: [
        { id: 'blades', rMin: 0, rMax: 0.23, zMin: 0.386, zMax: 0.399 },
        { id: 'hub', rMin: 0, rMax: 0.0245, zMin: 0.365, zMax: 0.395 },
      ],
      radius: 0.23,
      zMin: 0.365,
      zMax: 0.399,
    };
    // 3 mm above the underside of the blades, far from the tip: 3 mm in.
    expectNear(sweptPenetration(sweep, [0.2, -0.03, 0.389]), 0.003, 1e-12);
    // 2 mm inside the tip circle at mid-height: 2 mm in.
    expectNear(sweptPenetration(sweep, [0.1 + 0.228, -0.03, 0.3925]), 0.002, 1e-12);
    // On the axis inside the hub, 10 mm above its underside: the hub is the deeper ring.
    expectNear(sweptPenetration(sweep, [0.1, -0.03, 0.375]), 0.01, 1e-12);
    // Outside: below the blades, beyond the tip, on a face.
    expect(sweptPenetration(sweep, [0.2, -0.03, 0.38])).toBe(0);
    expect(sweptPenetration(sweep, [0.1 + 0.24, -0.03, 0.39])).toBe(0);
    expect(sweptPenetration(sweep, [0.2, -0.03, 0.386])).toBe(0);
    // Where it is zero the distance is positive, and the other way round.
    expect(sweptDistance(sweep, [0.2, -0.03, 0.38])).toBeGreaterThan(0);
    expect(sweptDistance(sweep, [0.2, -0.03, 0.389])).toBe(0);
  });
});

describe('Bosch: swept volumes', () => {
  it('contain the arm at every angle (the render mesh turned through a full turn)', () => {
    for (const level of LEVELS) {
      const g = buildMachineGeometry(B, atLevel(level));
      for (const sweep of g.affordances.armSweeps) {
        const part = getMachinePart(g, sweep.partId);
        const mesh = buildRenderMesh(part.shape, { chordError: COLLISION_CHORD_ERROR });
        let worst = 0;
        for (let step = 0; step < 12; step++) {
          const pose = machinePartPose(g, part, { armAngle: (step * Math.PI) / 6 });
          for (let v = 0; v < mesh.positions.length; v += 3) {
            const p = poseTransformPoint(pose, [
              must(mesh.positions[v]),
              must(mesh.positions[v + 1]),
              must(mesh.positions[v + 2]),
            ]);
            worst = Math.max(worst, sweptDistance(sweep, p));
          }
        }
        // Float32 mesh vertices: 0.01 mm.
        expect(worst, `${sweep.levelId} at level ${level}`).toBeLessThan(1e-5);
      }
    }
  });

  it('are as tight as the arm: tip radius 230 mm, blades and hub at their heights', () => {
    const lower = must(geometry.affordances.armSweeps.find((s) => s.levelId === 'lower'));
    const upper = must(geometry.affordances.armSweeps.find((s) => s.levelId === 'upper'));
    // The corners of a 30 mm wide tip are 0.3 mm further out than its middle.
    expectNear(mm(lower.radius), 230, 0.5);
    expectNear(mm(upper.radius), 230, 0.5);
    expectNear(mm(lower.zMin), 0, 1e-6, 'the stem stands on the floor');
    expectNear(mm(lower.zMax), 52, 1e-6, 'nozzle exits');
    const blades = must(upper.rings.find((r) => r.id === 'blades'));
    const hub = must(upper.rings.find((r) => r.id === 'hub'));
    // Owner update 4.3: blade underside 386, hub 365 mm at level 1.
    expectNear(mm(blades.zMin), 386, 1e-6);
    expectNear(mm(hub.zMin), 365, 1e-6);
    expectNear(mm(hub.rMax), 24.5, 1e-6);
  });

  it('are clear of everything in the machine through a full turn at every upper-basket position', () => {
    const report: string[] = [];
    for (const level of LEVELS) {
      const g = buildMachineGeometry(B, atLevel(level));
      for (const sweep of g.affordances.armSweeps) {
        let least = { gap: Number.POSITIVE_INFINITY, what: '' };
        const baskets: string[] = [];
        for (const part of g.parts) {
          if (part.id === sweep.partId) continue;
          // The roof and the walls bound the chamber; an arm's own stem stands on the floor.
          if (part.id === 'tub' || part.id === 'door' || part.id === 'dispenser') continue;
          const shape: Shape =
            part.id === 'filter'
              ? {
                  parts: part.shape.parts.filter(
                    (p) => p.id === 'coarse_crown' || p.id === 'salt_cap',
                  ),
                  regions: [],
                }
              : part.shape;
          const rings =
            part.id === 'filter'
              ? { ...sweep, rings: sweep.rings.filter((r) => r.id !== 'stem') }
              : sweep;
          const c = sweptClearance(rings, shape, part.pose);
          expect(
            c.gap,
            `${sweep.levelId} arm against ${part.id}/${c.part} at level ${level}`,
          ).toBeGreaterThan(0);
          if (c.gap < least.gap) least = { gap: c.gap, what: `${part.id}/${c.part}` };
          if (part.component === 'basket_wires' || part.component === 'cutlery_basket') {
            baskets.push(`${part.id} ${mm(c.gap).toFixed(1)}`);
          }
        }
        report.push(
          `level ${level}: ${sweep.levelId} arm clears everything by at least ${mm(least.gap).toFixed(1)} mm (${least.what}); baskets, mm: ${baskets.join(', ')}`,
        );
      }
    }
    console.log(report.join('\n'));
  });

  it('finds an item that does reach into a sweep', () => {
    // A check of the check: a 290 mm tall post standing in the lower basket under the hub of
    // the upper arm reaches it at level 2 (hub at 340 mm, basket floor at 69 mm) but not at
    // level 1 (365 mm).
    const post: Shape = {
      parts: [
        {
          id: 'post',
          prim: {
            kind: 'capsule',
            a: [0, -0.03, 0.069],
            b: [0, -0.03, 0.069 + 0.285],
            radius: 0.005,
          },
          pose: { p: [0, 0, 0], q: [0, 0, 0, 1] },
          material: 'stainless_steel',
        },
      ],
      regions: [],
    };
    const identity: Pose = { p: [0, 0, 0], q: [0, 0, 0, 1] };
    const gap = (level: string): number =>
      sweptClearance(
        must(
          buildMachineGeometry(B, atLevel(level)).affordances.armSweeps.find(
            (s) => s.levelId === 'upper',
          ),
        ),
        post,
        identity,
      ).gap;
    expectNear(mm(gap('1')), 365 - (69 + 290), 0.01);
    expect(gap('2')).toBeLessThan(0);
  });
});

describe('Bosch: parts carried by the baskets do not stand in each other', () => {
  it('lets the tine rails and tines pass through the tunnels of the cutlery basket', () => {
    // Dossier 2.4: the basket stands astride the two side-row rail lines, which pass through
    // its tunnels with their tines. No wire of the lower basket may be inside its walls.
    const cutlery = getMachinePart(geometry, 'cutlery_basket');
    const rack = getMachinePart(geometry, 'lower_rack');
    const toCutlery = (p: Vec3): Vec3 => {
      const tub = poseTransformPoint(rack.pose, p);
      return [tub[0] - cutlery.pose.p[0], tub[1] - cutlery.pose.p[1], tub[2] - cutlery.pose.p[2]];
    };
    // The lid grids, which hang outside the long walls, are left out: see the next test.
    const body: Shape = {
      parts: cutlery.shape.parts.filter((p) => !p.id.startsWith('lid.')),
      regions: [],
    };
    let deepest = Number.POSITIVE_INFINITY;
    let where = '';
    for (const part of rack.shape.parts) {
      if (part.prim.kind !== 'capsule') continue;
      const { a, b, radius } = part.prim;
      const steps = Math.max(
        1,
        Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 0.002),
      );
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const d =
          signedDistance(
            body,
            toCutlery([
              a[0] + (b[0] - a[0]) * t,
              a[1] + (b[1] - a[1]) * t,
              a[2] + (b[2] - a[2]) * t,
            ]),
          ) - radius;
        if (d < deepest) {
          deepest = d;
          where = part.id;
        }
      }
    }
    // Wire surfaces may touch the feet from below (they stand on the grid) but not enter them.
    expect(mm(deepest), `deepest at ${where}`).toBeGreaterThan(-0.05);
  });

  it('runs the 17 mm feed tube of the upper arm under the centre ridge of the floor, above the arm', () => {
    const feed = boxOf(getMachinePart(geometry, 'upper_arm_feed'));
    const arm = boxOf(getMachinePart(geometry, 'upper_arm'));
    // The part page's 17 mm, not squeezed: the ridge of the floor relief makes the room that a
    // flat floor (14 mm between the wires and the nozzles) did not have.
    expectNear(mm(feed.max[2] - feed.min[2]), 17, 1e-6, 'diameter');
    expectNear(mm(feed.max[0] - feed.min[0]), 17, 1e-6, 'diameter');
    expect(geometry.assumptions.some((a) => a.id === 'upper_arm_feed_diameter')).toBe(false);
    // Above the arm's nozzle exits (399 mm at level 1) by the 3 mm clearance.
    expectNear(mm(feed.min[2] - arm.max[2]), 3, 1e-6);
    expectNear(mm(arm.max[2]), 420 - 21, 1e-6);
    // Under the cross wires that pass over it: on the arm axis (x = 0) they are on the centre
    // ridge, at least 29 mm above the troughs over the width of the tube (34 x 109.5 / 127),
    // so their undersides are at least 420 - 5.25 - 1.75 + 29 = 442 mm up and the tube's top
    // is at 419 mm.
    expectNear(mm(feed.max[2]), 399 + 3 + 17, 1e-6);
    const upperRack = getMachinePart(geometry, 'upper_rack');
    // No wire of the basket is within 10 mm of the tube anywhere along its run (both shapes
    // are in the rack frame; the tube is one capsule).
    const tube = must(getMachinePart(geometry, 'upper_arm_feed').shape.parts[0]).prim;
    if (tube.kind !== 'capsule') throw new Error('the feed tube is not a capsule');
    let nearest = Number.POSITIVE_INFINITY;
    for (let k = 0; k <= 60; k++) {
      const t = k / 60;
      const p: Vec3 = [
        tube.a[0] + (tube.b[0] - tube.a[0]) * t,
        tube.a[1] + (tube.b[1] - tube.a[1]) * t,
        tube.a[2] + (tube.b[2] - tube.a[2]) * t,
      ];
      nearest = Math.min(nearest, signedDistance(upperRack.shape, p) - tube.radius);
    }
    expect(mm(nearest)).toBeGreaterThan(10);
  });
});

/** The stand-in the wash simulation declared before this package had a geometry (sim-scene). */
interface StandInPart {
  readonly id: string;
  readonly role: 'wires' | 'basket' | 'tub' | 'arm';
  readonly shape: Shape;
  readonly pose: Pose;
  readonly arm?: { readonly index: number; readonly hingePoint: Vec3; readonly hingeAxis: Vec3 };
}

describe('MachineGeometry and the simulation boundary', () => {
  it('is assignable to the MachineGeometry stand-in of @spotless/sim-scene', () => {
    // A compile-time property: this assignment is checked by `pnpm typecheck`.
    const standIn: { readonly parts: readonly StandInPart[] } = geometry satisfies MachineGeometry;
    expect(standIn.parts).toHaveLength(geometry.parts.length);
    // Arm indices count the rotating arms in the order of the specification's spray levels.
    expect(standIn.parts.filter((p) => p.arm !== undefined).map((p) => must(p.arm).index)).toEqual([
      0, 1,
    ]);
  });

  it('poses a pulled-out basket and what it carries along its travel', () => {
    const pulled = { basketTravel: { lower: 0.3 } };
    for (const id of ['lower_rack', 'lower_rack_fittings', 'cutlery_basket']) {
      const part = getMachinePart(geometry, id);
      const pose = machinePartPose(geometry, part, pulled);
      expectNear(pose.p[1] - part.pose.p[1], -0.3, 1e-12, id);
      expectNear(pose.p[0], part.pose.p[0], 1e-12, id);
    }
    const upper = getMachinePart(geometry, 'upper_rack');
    expect(machinePartPose(geometry, upper, pulled)).toEqual(upper.pose);
    // Travel is limited to what the specification gives (500 mm).
    const far = machinePartPose(geometry, getMachinePart(geometry, 'lower_rack'), {
      basketTravel: { lower: 2 },
    });
    expectNear(far.p[1] - getMachinePart(geometry, 'lower_rack').pose.p[1], -0.5, 1e-12);
    // An arm carried by a pulled-out basket turns about its moved axis.
    const arm = getMachinePart(geometry, 'upper_arm');
    const turned = machinePartPose(geometry, arm, {
      armAngle: Math.PI / 2,
      basketTravel: { upper: 0.1 },
    });
    const tip = poseTransformPoint(turned, [0.23, 0, 0]);
    expectNear(tip[0], arm.pose.p[0], 1e-9);
    expectNear(tip[1], arm.pose.p[1] - 0.1 + 0.23, 1e-9);
    expect(poseCompose(arm.pose, { p: [0, 0, 0], q: [0, 0, 0, 1] })).toEqual(arm.pose);
  });
});
