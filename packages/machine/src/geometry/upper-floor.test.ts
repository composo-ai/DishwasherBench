/**
 * What stands on the floor of the Bosch's upper basket, in the loading physics.
 *
 * EVIDENCE. IMG_9083 at full resolution shows a front-back floor wire on the centre line of the
 * basket (image x = 2790 against the arm hub at 2793, 8.2 px/mm), running from the tablet tray
 * back over the top of the centre ridge, with the arm's feed tube hung under it in four clips;
 * and two more on the low floor by the left wall. The dossier's list had none of the three
 * and left an 88 mm opening over the feed tube. The owner's photograph of 2026-10-10 shows a mug,
 * glasses and containers standing in this basket; the mug leans visibly, as it does here on
 * the 13 degree ramp. See `UPPER_FLOOR_WIRES_X` in the data file for the reading.
 *
 * WHAT IS ASSERTED
 * - a mug or a tumbler let down mouth down over the centre line stands on the ridge and the
 *   centre wire, leaning down the ramp by 18 degrees (the ramp falls 13), and touches nothing
 *   but the basket's wires;
 * - a saucer or a dessert plate let down on edge into a gap of rows A, B or C (rear half),
 *   midway to the partner row, never comes to rest on the feed tube (before: 23 of 28 did);
 * - across a 40 mm grid over the open floor (clear of the knife shelf, the cup shelves and the
 *   tablet tray) about six in ten mugs end within 25 degrees of mouth down (measured: 39 of 63
 *   with the floor relief and the folded cup shelves of IMG_9131; 50 of 63 with the relief
 *   before it, whose right ridge stood 16 mm nearer the middle: the last column of the grid,
 *   146 mm right of the arm axis, is now on the top of that ridge, where a mug leans 25 to 31
 *   degrees, against the folded cup shelves, which stand 27 mm inside the wall): the floor is
 *   a ramp with tines, on which vessels lean; it is not a table. The share is what this model
 *   gives, recorded so that a change of the floor shows; no photograph gives the true share.
 */

import { instantiate } from '../../../catalogue/src/index.ts';
import { quatRotate } from '@spotless/core';
import type { Pose, Quat } from '@spotless/core';
import type { JoltPhysicsWorld } from '../../../physics/src/index.ts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BOSCH_SMV4HAX40G as B } from '../machines.ts';
import { machineWorld, piecesOf, releaseItem } from '../test-physics.ts';
import { must } from '../test-util.ts';
import { buildMachineGeometry } from './build.ts';

const geometry = buildMachineGeometry(B);
const upper = must(geometry.affordances.baskets.find((b) => b.frame === 'upper_rack'));
const origin = upper.originTub;
/** x of the upper arm's axis, the dossier's origin, in the rack frame, metres. */
const AXIS_X = 0.244;

let world: JoltPhysicsWorld;
beforeAll(async () => {
  world = await machineWorld(geometry, (id) => id.startsWith('upper'));
});
afterAll(() => world.dispose());

function orientation(itemType: string, name: string): Quat {
  return must(instantiate(itemType).stablePoses.find((p) => p.name === name)).q;
}

/**
 * Lets an item down at a rack-frame position (of its origin, in plan) until it touches, lets it
 * go a millimetre above that, and reports its rest. The body is taken out again.
 */
function letDown(
  itemType: string,
  preset: string,
  xy: readonly [number, number],
): { tiltDeg: number; touches: string[]; bottom: number } {
  const instance = instantiate(itemType);
  const q = orientation(itemType, preset);
  const high: Pose = { p: [origin[0] + xy[0], origin[1] + xy[1], origin[2] + 0.35], q };
  const low: Pose = { p: [high.p[0], high.p[1], origin[2] - 0.1], q };
  const hit = world.sweep(piecesOf(instance.shape), high, low);
  const z = high.p[2] - hit.fraction * 0.45 + 0.001;
  const rest = releaseItem(world, 'probe', instance, { p: [high.p[0], high.p[1], z], q });
  const axis0 = quatRotate(q, [0, 0, 1]);
  const axis1 = quatRotate(rest.pose.q, [0, 0, 1]);
  const dot = axis0[0] * axis1[0] + axis0[1] * axis1[1] + axis0[2] * axis1[2];
  const touches = [...new Set(rest.contacts.map((c) => (c.a === 'probe' ? c.b : c.a)))].sort();
  world.removeBody('probe');
  return {
    tiltDeg: (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI,
    touches,
    bottom: rest.bottomZ - origin[2],
  };
}

describe('Bosch upper basket floor: vessels', () => {
  it.each(['mug_ceramic_300', 'tumbler_250'])(
    'a %s let down over the centre line stands on the ridge, leaning down the ramp, clear of the feed tube',
    (itemType) => {
      const tilts: number[] = [];
      for (const y of [0.15, 0.3, 0.36, 0.42]) {
        const rest = letDown(itemType, 'inverted', [AXIS_X, y]);
        tilts.push(rest.tiltDeg);
        expect(rest.touches, `y ${y}`).toEqual(['upper_rack']);
        // On the ridge and the centre wire: its rim is 10 mm and more above the trough level,
        // where the feed tube's top is 1 mm below it.
        expect(rest.bottom, `y ${y}`).toBeGreaterThan(0.01);
        // It leans down the ramp, by the fall of the ramp and a little more (13 + 5 degrees).
        expect(rest.tiltDeg, `y ${y}`).toBeLessThan(22);
      }
      console.log(
        `${itemType} over the centre line: ${tilts.map((t) => t.toFixed(1)).join(', ')} degrees`,
      );
    },
    60_000,
  );

  it('about six in ten mugs let down over the open floor end within 25 degrees of mouth down', () => {
    let standing = 0;
    let total = 0;
    const rows: string[] = [];
    // Clear of the knife shelf (x < 110 mm behind y = 105), the cup shelves (x > 400) and the
    // tablet tray and front wall (y < 90).
    for (let y = 0.1; y <= 0.441; y += 0.04) {
      let line = '';
      for (let x = 0.15; x <= 0.391; x += 0.04) {
        const rest = letDown('mug_ceramic_300', 'inverted', [x, y]);
        total += 1;
        if (rest.tiltDeg <= 25) standing += 1;
        line += String(Math.round(rest.tiltDeg)).padStart(4);
      }
      rows.push(line);
    }
    console.log(
      `mug, tilt from mouth down on a 40 mm grid (x 150 to 390, y 100 to 420 mm):\n${rows.join('\n')}\n${standing} of ${total} within 25 degrees`,
    );
    // 39 of 63 with the relief and the cup shelves of IMG_9131 (see the head of this file):
    // a band, so that a change of the floor shows whichever way it goes.
    expect(total).toBe(63);
    expect(standing).toBeGreaterThanOrEqual(35);
    expect(standing).toBeLessThanOrEqual(45);
  }, 120_000);
});

describe('Bosch upper basket floor: plates in rows A, B and C', () => {
  it.each(['saucer_porcelain_140', 'dessert_plate_porcelain_190'])(
    'a %s on edge in a gap of rows A, B or C (rear) does not come to rest on the feed tube',
    (itemType) => {
      const rows = geometry.affordances.tineRows.filter(
        (row) => row.frame === 'upper_rack' && ['a', 'b', 'c_rear'].includes(row.rowId),
      );
      expect(rows).toHaveLength(3);
      let tested = 0;
      for (const row of rows) {
        const partner = geometry.affordances.tineRows.find(
          (other) => other.frame === 'upper_rack' && other.rowId === row.partner?.rowId,
        );
        for (const slot of row.slots) {
          const across =
            partner === undefined
              ? slot.centre[0]
              : (slot.centre[0] + must(partner.tines[0]).base[0]) / 2;
          const rest = letDown(itemType, 'on_edge', [across, slot.centre[1]]);
          tested += 1;
          expect(rest.touches, `${row.rowId} slot ${slot.index}`).not.toContain('upper_arm_feed');
        }
      }
      expect(tested).toBeGreaterThanOrEqual(14);
    },
    120_000,
  );
});
