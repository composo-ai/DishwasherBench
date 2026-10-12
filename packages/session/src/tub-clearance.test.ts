// A flat piece that leans out over the side of the lower basket, when the basket is pushed in
// (found on 11 October 2026: the owner reports that in the real machine such a chopping board
// is pushed upright when the lower basket goes in; the check said, in amber, "board_01 sticks
// 7.7 mm out of lower_rack").
//
// What the machine data hold: the lower basket is 525 mm wide in a tub of 545 mm, 9.5 mm from
// the left wall and 10.5 mm from the right (the tub's width is read off a photograph, +-12 mm;
// the upper basket, 500 mm wide, has more than 20 mm either side). The side walls of the tub
// are bodies while a basket travels; the frame of the opening is their front edge, not a part
// of its own. So: a piece that leans out by less than the gap travels with the basket as it
// stands and touches nothing; one that leans out by more is pushed in by the wall as the
// basket goes, and the basket slides in. The check says which, and what the piece touches at
// the end. [MEASURED 2026-10-11 on the chopping board of the levels, 375 x 267 x 8 mm.]
import { instantiate } from '@spotless/catalogue';
import { quatRotate, v3Sub, type Quat, type Vec3 } from '@spotless/core';
import { boundingBox } from '@spotless/geometry';
import { describe, expect, it } from 'vitest';
import type { GameSession } from './session.ts';
import { testLevel } from './test-level.ts';
import { mustPlace, useSessions } from './test-util.ts';
import type { LoadCheck } from './types.ts';

const session = useSessions();
const BOARD = 'chopping_board_pp_375';
/** The gap between the left side of the lower basket and the left wall of the tub, mm. */
const GAP_LEFT_MM = 9.5;

/** How far the board reaches out over the left side of the lower basket, mm. */
function leanOut(s: GameSession): number {
  const placed = s.getState().placed.find((p) => p.item_id === 'board');
  if (placed === undefined) throw new Error('the board is not placed');
  const [w, x, y, z] = placed.quat_wxyz;
  const q: Quat = [x, y, z, w];
  const instance = instantiate(BOARD);
  const position = placed.position_mm.map((v) => v / 1000) as unknown as Vec3;
  const box = boundingBox(instance.shape, {
    p: v3Sub(position, quatRotate(q, instance.referencePoint)),
    q,
  });
  return -box.min[0] * 1000;
}

/**
 * The board stood on its long edge along the left wall of the lower basket, leaning outwards on
 * the rim, and the mechanical check of that load.
 */
async function leaning(
  position_mm: readonly [number, number, number],
  rollDeg: number,
): Promise<{ before: number; check: LoadCheck; after: number }> {
  const s = await session({
    ...testLevel(),
    id: 'tub-clearance',
    items: [{ id: 'board', itemType: BOARD, points: 1, soils: [] }],
  });
  const placed = mustPlace(s, {
    item_id: 'board',
    frame: 'lower_rack',
    position_mm: [...position_mm],
    orientation: { preset: 'on_long_edge', yaw_deg: 90, roll_deg: -rollDeg },
  });
  expect(placed.stable).toBe(true);
  const before = leanOut(s);
  const check = s.checkLoad();
  if (!check.accepted) throw new Error(`check_load was rejected: ${JSON.stringify(check)}`);
  // The check leaves the load as it found it: what it reports is read from its result.
  const after = check.protruding.find((p) => p.item_id === 'board')?.beyond_mm ?? 0;
  return { before, check, after };
}

describe('a board on edge that leans out over the side of the lower basket', () => {
  it('by 5 mm: travels with the basket as it stands and touches nothing', async () => {
    const { before, check, after } = await leaning([14, 250, 150], 5);
    expect(before).toBeGreaterThan(3);
    expect(before).toBeLessThan(7);
    expect(check.racks.every((rack) => rack.slides_in)).toBe(true);
    expect(check.door_closes).toBe(true);
    // The knock of the end stop moves it a couple of millimetres; nothing pushed it.
    const moved = check.shifted.find((m) => m.item_id === 'board');
    expect(moved?.pushed_by).toBeUndefined();
    expect(after).toBeLessThan(GAP_LEFT_MM - 1);
    expect(check.protruding).toEqual([
      { item_id: 'board', rack: 'lower_rack', beyond_mm: after, over: 'left', touching: [] },
    ]);
    expect(check.fell_out).toEqual([]);
  }, 120_000);

  it('by 10 mm and more: is pushed in by the wall of the tub, and the basket slides in', async () => {
    const { before, check, after } = await leaning([14, 250, 150], 10);
    expect(before).toBeGreaterThan(GAP_LEFT_MM + 1);
    expect(before).toBeLessThan(14);
    expect(check.racks.every((rack) => rack.slides_in)).toBe(true);
    const moved = check.shifted.find((m) => m.item_id === 'board');
    expect(moved?.pushed_by).toEqual(['tub.wall.left']);
    expect(moved?.displacement_mm).toBeGreaterThan(before - GAP_LEFT_MM);
    // It ends no further out than the wall lets it, resting against the wall.
    expect(after).toBeLessThanOrEqual(GAP_LEFT_MM + 0.5);
    expect(check.protruding.find((p) => p.item_id === 'board')?.touching).toEqual([
      'tub.wall.left',
    ]);
    expect(check.fell_out).toEqual([]);
  }, 120_000);

  it('by 20 mm and more: is pushed upright by several degrees, not refused', async () => {
    const { before, check, after } = await leaning([26, 300, 160], 14);
    expect(before).toBeGreaterThan(20);
    expect(check.racks).toEqual([
      { rack: 'lower_rack', slides_in: true },
      { rack: 'upper_rack', slides_in: true },
    ]);
    expect(check.door_closes).toBe(true);
    const moved = check.shifted.find((m) => m.item_id === 'board');
    expect(moved?.pushed_by).toEqual(['tub.wall.left']);
    expect(moved?.rotation_deg).toBeGreaterThan(2);
    expect(moved?.displacement_mm).toBeGreaterThan(before - GAP_LEFT_MM);
    expect(after).toBeLessThanOrEqual(GAP_LEFT_MM + 0.5);
    expect(check.fell_out).toEqual([]);
    expect(check.spray_arms.every((arm) => arm.full_rotation)).toBe(true);
  }, 120_000);
});
