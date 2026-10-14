/**
 * Every affordance the machine offers the loading layer is free at its centre in the empty
 * machine: the place a slot, a shelf or a cell names can be reached, and nothing of the machine
 * stands in it. Checked with the exact signed distance of the generated shapes, in the default
 * configuration, with the cutlery basket at each of its named positions, and with the shelves
 * the other way.
 */

import type { Vec3 } from '@spotless/core';
import {
  poseInverseTransformPoint,
  poseTransformPoint,
  v3AddScaled,
  v3Normalise,
  v3Sub,
} from '@spotless/core';
import { signedDistance } from '@spotless/geometry';
import { describe, expect, it } from 'vitest';
import { cutleryBasketPositions, withCutleryBasketAt } from '../config.ts';
import { BOSCH_SMV4HAX40G as B } from '../machines.ts';
import { must } from '../test-util.ts';
import type { MachineConfig, MachineSpec } from '../types.ts';
import { buildMachineGeometry } from './build.ts';
import type { MachineGeometry } from './types.ts';

const mm = (m: number): number => m * 1000;

/** Distance from a tub-frame point to the nearest surface of the machine's parts (arms left out). */
function clearance(geometry: MachineGeometry, p: Vec3): { distance: number; part: string } {
  let distance = Number.POSITIVE_INFINITY;
  let part = '';
  for (const candidate of geometry.parts) {
    if (candidate.role === 'arm') continue;
    const d = signedDistance(candidate.shape, poseInverseTransformPoint(candidate.pose, p));
    if (d < distance) {
      distance = d;
      part = candidate.id;
    }
  }
  return { distance, part };
}

/** The least clearance along the segment from `a` to `b`, sampled every 2 mm. */
function leastAlong(
  geometry: MachineGeometry,
  a: Vec3,
  b: Vec3,
): { distance: number; part: string } {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const steps = Math.max(1, Math.ceil(length / 0.002));
  let least = { distance: Number.POSITIVE_INFINITY, part: '' };
  for (let k = 0; k <= steps; k++) {
    const found = clearance(geometry, v3AddScaled(a, v3Sub(b, a), k / steps));
    if (found.distance < least.distance) least = found;
  }
  return least;
}

/** The configurations an affordance is checked in: the default, and each thing moved. */
function configurations(spec: MachineSpec): [string, MachineConfig][] {
  const out: [string, MachineConfig][] = [['default', spec.defaultConfig]];
  for (const position of cutleryBasketPositions(spec).slice(1)) {
    out.push([
      `cutlery basket ${position.id}`,
      withCutleryBasketAt(spec, spec.defaultConfig, position.id),
    ]);
  }
  out.push(['cutlery basket out', withCutleryBasketAt(spec, spec.defaultConfig, null)]);
  const flipped = spec.defaultConfig.shelves.map((s) => ({
    ...s,
    state: s.state === 'up' ? ('down' as const) : ('up' as const),
  }));
  if (flipped.length > 0)
    out.push(['shelves the other way', { ...spec.defaultConfig, shelves: flipped }]);
  return out;
}

describe.each([['Bosch SMV4HAX40G', B]])(
  '%s: every affordance is free at its centre',
  (_name, spec) => {
    describe.each(configurations(spec))('%s', (_label, config) => {
      const geometry = buildMachineGeometry(spec, config);
      const A = geometry.affordances;
      const originOf = (basketId: string): Vec3 =>
        must(A.baskets.find((b) => b.basketId === basketId)).originTub;

      it('tine slots: the line midway between the two tines, from the rail to their tips', () => {
        let checked = 0;
        for (const row of A.tineRows) {
          if (row.state !== 'up') continue;
          const origin = originOf(row.basketId);
          for (const slot of row.slots) {
            if (slot.blockedBy !== null) continue;
            const a = must(row.tines[slot.index]);
            const b = must(row.tines[slot.index + 1]);
            // Parallel tines: midway between them all the way up. Tines that lean apart (a wide
            // slot) or stand upright: straight up from the middle of the gap.
            const parallel = slot.lean > 0 && !slot.vGap;
            const direction = parallel ? v3Normalise(v3Sub(a.tip, a.base)) : ([0, 0, 1] as Vec3);
            const reach = Math.min(a.tip[2] - a.base[2], b.tip[2] - b.base[2]);
            const start = row.railTopZ - slot.centre[2] + 0.004;
            const from = poseTransformPoint(
              { p: origin, q: [0, 0, 0, 1] },
              v3AddScaled(slot.centre, direction, start / direction[2]),
            );
            const to = poseTransformPoint(
              { p: origin, q: [0, 0, 0, 1] },
              v3AddScaled(slot.centre, direction, reach / direction[2]),
            );
            const found = leastAlong(geometry, from, to);
            expect(
              mm(found.distance),
              `${row.basketId}.${row.rowId} slot ${slot.index} against ${found.part}`,
            ).toBeGreaterThan(3);
            checked++;
          }
        }
        expect(checked).toBeGreaterThan(20);
      });

      it('tine slots under the cutlery basket are marked, and only those', () => {
        const cutlery = A.cutleryBasket;
        for (const row of A.tineRows) {
          for (const slot of row.slots) {
            const covered =
              cutlery !== null &&
              row.basketId === cutlery.basketId &&
              slot.centre[0] > cutlery.box.min[0] &&
              slot.centre[0] < cutlery.box.max[0] &&
              slot.centre[1] > cutlery.box.min[1] &&
              slot.centre[1] < cutlery.box.max[1];
            if (covered)
              expect(slot.blockedBy, `${row.rowId}.${slot.index}`).toBe('cutlery_basket');
            if (slot.blockedBy !== null) expect(cutlery).not.toBeNull();
          }
        }
      });

      it('cup shelves: 60 mm of air over the middle of a lowered shelf, and beside its free edge', () => {
        for (const shelf of A.cupShelves) {
          if (shelf.surface === null) continue;
          const origin = originOf(shelf.basketId);
          const { x, y, z } = shelf.surface;
          const centre: Vec3 = [
            origin[0] + (x[0] + x[1]) / 2,
            origin[1] + (y[0] + y[1]) / 2,
            origin[2] + z,
          ];
          const found = leastAlong(
            geometry,
            v3AddScaled(centre, [0, 0, 1], 0.004),
            v3AddScaled(centre, [0, 0, 1], 0.06),
          );
          expect(mm(found.distance), `${shelf.shelfId} against ${found.part}`).toBeGreaterThan(3);
          // A stem stands in a notch beside the free edge: 8 mm off the edge the way is clear
          // from the base grid to 60 mm above the shelf.
          const middleX = (shelf.box.min[0] + shelf.box.max[0]) / 2;
          for (const notch of shelf.stemwareNotches) {
            const inward = notch[0] > middleX ? 1 : -1;
            const beside: Vec3 = [
              origin[0] + notch[0] + inward * 0.008,
              origin[1] + notch[1],
              origin[2] + notch[2],
            ];
            const stem = leastAlong(
              geometry,
              v3AddScaled(beside, [0, 0, 1], -0.02),
              v3AddScaled(beside, [0, 0, 1], 0.06),
            );
            expect(
              mm(stem.distance),
              `${shelf.shelfId} notch against ${stem.part}`,
            ).toBeGreaterThan(3);
          }
        }
      });

      it('holders: air over the middle of the floor of a lowered holder', () => {
        for (const holder of A.holders) {
          if (holder.state !== 'down') continue;
          const origin = originOf(holder.basketId);
          const centre: Vec3 = [
            origin[0] + (holder.box.min[0] + holder.box.max[0]) / 2,
            origin[1] + (holder.box.min[1] + holder.box.max[1]) / 2,
            origin[2] + holder.floorZ,
          ];
          const found = leastAlong(
            geometry,
            v3AddScaled(centre, [0, 0, 1], 0.004),
            v3AddScaled(centre, [0, 0, 1], 0.05),
          );
          expect(mm(found.distance), `${holder.holderId} against ${found.part}`).toBeGreaterThan(3);
        }
      });

      it('cutlery cells: the vertical through the centre of the opening, from the floor to above the handle', () => {
        const cutlery = spec.cutleryBasket;
        if (A.cutleryBasket === null || cutlery === null) {
          expect(A.cutleryCells).toHaveLength(0);
          return;
        }
        expect(A.cutleryCells.length).toBeGreaterThan(0);
        const pose = A.cutleryBasket.poseTub;
        for (const cell of A.cutleryCells) {
          const cx = (cell.box.min[0] + cell.box.max[0]) / 2;
          const cy = (cell.box.min[1] + cell.box.max[1]) / 2;
          const from = poseTransformPoint(pose, [cx, cy, cell.box.min[2] + 0.004]);
          const to = poseTransformPoint(pose, [cx, cy, cutlery.heightWithHandle + 0.03]);
          const found = leastAlong(geometry, from, to);
          expect(mm(found.distance), `cell ${cell.id} against ${found.part}`).toBeGreaterThan(3);
          // The listed floor centre is that point on the floor, which is a surface of the basket.
          const floor = clearance(geometry, cell.floorCentreTub);
          expect(Math.abs(mm(floor.distance)), `cell ${cell.id} floor`).toBeLessThan(0.01);
          expect(floor.part).toBe('cutlery_basket');
          // Every corner of the opening is clear too: 4 mm in from each, over the whole height.
          for (const x of [cell.box.min[0] + 0.004, cell.box.max[0] - 0.004]) {
            for (const y of [cell.box.min[1] + 0.004, cell.box.max[1] - 0.004]) {
              const corner = leastAlong(
                geometry,
                poseTransformPoint(pose, [x, y, cell.box.min[2] + 0.003]),
                poseTransformPoint(pose, [x, y, cutlery.heightWithHandle + 0.03]),
              );
              expect(
                mm(corner.distance),
                `cell ${cell.id} corner against ${corner.part}`,
              ).toBeGreaterThan(1.5);
            }
          }
        }
      });

      it('the tablet tray: the middle of the trough, from its floor to its rim', () => {
        const path = A.tabletPath;
        if (path.caughtBy !== 'tray') return;
        const landing = must(path.points[path.points.length - 1]);
        const centre: Vec3 = [
          (path.target.x[0] + path.target.x[1]) / 2,
          (path.target.y[0] + path.target.y[1]) / 2,
          landing[2],
        ];
        const found = leastAlong(geometry, v3AddScaled(centre, [0, 0, 1], -0.03), centre);
        expect(mm(found.distance), `tray against ${found.part}`).toBeGreaterThan(3);
      });
    });
  },
);
