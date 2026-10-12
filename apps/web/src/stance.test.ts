import { describe, expect, it } from 'vitest';
import type { OrientationPresetCard } from '@spotless/session';
import { allLevels, levelCard } from '@spotless/levels';
import type { RowSlot, TineRowInput } from './stance.ts';
import {
  FINE_TURN_STEP_DEG,
  nearestSlot,
  nextStance,
  rowSlots,
  slotDrop,
  stanceLabel,
  stancesOf,
  standsOnEdge,
  TURN_STEP_DEG,
  turnYaw,
  WHEEL_STEP_MS,
  wheelSteps,
  yawFacing,
} from './stance.ts';

const presets = (...names: string[]): OrientationPresetCard[] =>
  names.map((name) => ({ name, quat_wxyz: [1, 0, 0, 0] }));
const names = (list: readonly { preset: string }[]): string[] => list.map((s) => s.preset);

describe('the stances of each kind of piece', () => {
  it('a plate is picked up on edge; a half turn and the lean are not stances of their own', () => {
    const plate = stancesOf(
      presets('upright', 'inverted', 'on_edge', 'on_edge_reversed', 'leaning'),
      [270, 270, 30],
    );
    expect(names(plate)).toEqual(['on_edge', 'inverted', 'upright']);
    expect(plate[0]?.label).toBe('On edge');
  });

  it('a glass and a mug are picked up upside down', () => {
    const glass = stancesOf(
      presets('upright', 'inverted', 'inverted_tilted', 'on_side'),
      [87, 87, 90],
    );
    expect(names(glass)).toEqual(['inverted', 'inverted_tilted', 'on_side', 'upright']);
    expect(glass[0]?.label).toBe('Upside down');
  });

  it('a bowl is picked up upside down, with tilted and on edge next', () => {
    const bowl = stancesOf(presets('upright', 'inverted', 'inclined', 'on_edge'), [160, 160, 70]);
    expect(names(bowl)).toEqual(['inverted', 'inclined', 'on_edge', 'upright']);
  });

  it('cutlery is picked up handle down', () => {
    const fork = stancesOf(
      presets('flat', 'flat_inverted', 'handle_down', 'handle_up', 'on_edge'),
      [185, 24, 7],
    );
    expect(names(fork)).toEqual(['handle_down', 'handle_up', 'flat', 'flat_inverted', 'on_edge']);
  });

  it('a board is picked up on its long edge', () => {
    const board = stancesOf(
      presets('flat', 'flat_inverted', 'on_long_edge', 'on_short_edge'),
      [375, 267, 8],
    );
    expect(names(board)).toEqual(['on_long_edge', 'on_short_edge', 'flat', 'flat_inverted']);
  });

  it('every item of every level has a first stance, and never more than five', () => {
    for (const level of allLevels()) {
      for (const item of levelCard(level).items) {
        const stances = stancesOf(item.orientation_presets, item.bbox_mm);
        expect(stances.length, item.class).toBeGreaterThan(0);
        expect(stances.length, item.class).toBeLessThanOrEqual(5);
        // Only presets of the item, each once.
        expect(new Set(names(stances)).size).toBe(stances.length);
        for (const stance of stances) {
          expect(item.orientation_presets.some((p) => p.name === stance.preset)).toBe(true);
          expect(stanceLabel(stance.preset)).not.toContain('_');
        }
        // What stands in a dishwasher: nothing is picked up the way it stands on a table.
        expect(['upright', 'flat'], item.class).not.toContain(stances[0]?.preset);
      }
    }
  });

  it('one key steps through them and comes round', () => {
    const plate = stancesOf(presets('upright', 'inverted', 'on_edge'), [270, 270, 30]);
    expect(nextStance(plate, 'on_edge')).toBe('inverted');
    expect(nextStance(plate, 'upright')).toBe('on_edge');
    expect(nextStance(plate, 'on_edge', -1)).toBe('upright');
    // A stance that has no picture (held as a suggestion gave it) goes to the first.
    expect(nextStance(plate, 'leaning')).toBe('on_edge');
    expect(nextStance([], 'on_edge')).toBeNull();
  });
});

describe('the turn steps', () => {
  it('a step is a quarter turn, from one row direction to the next', () => {
    expect(TURN_STEP_DEG).toBe(90);
    expect(turnYaw(0, 1)).toBe(90);
    expect(turnYaw(90, 1)).toBe(180);
    expect(turnYaw(180, 1)).toBe(-90);
    expect(turnYaw(0, -1)).toBe(-90);
    expect([1, 2, 3, 4].reduce((yaw) => turnYaw(yaw, 1), 0)).toBe(0);
  });

  it('with the modifier a step is fifteen degrees', () => {
    expect(FINE_TURN_STEP_DEG).toBe(15);
    expect(turnYaw(0, 1, true)).toBe(15);
    expect(turnYaw(-170, -1, true)).toBe(175);
    expect(Array.from({ length: 6 }).reduce((yaw: number) => turnYaw(yaw, 1, true), 0)).toBe(90);
  });

  it('a notch of a mouse wheel is one step, up to the left', () => {
    const state = { travel: 0, lastAt: -1000 };
    expect(wheelSteps(state, -100, 0)).toBe(1);
    expect(wheelSteps(state, 100, 500)).toBe(-1);
  });

  it('the stream of a touchpad swipe is one step, not dozens', () => {
    const state = { travel: 0, lastAt: -1000 };
    let steps = 0;
    for (let i = 0; i < 40; i++) steps += wheelSteps(state, 8, i * 5);
    // 320 units of travel in 200 ms: enough for five steps, held to two by the pause.
    expect(steps).toBe(-2);
    expect(WHEEL_STEP_MS).toBeGreaterThan(100);
  });
});

/** Two rows running along x, 100 mm apart, their tines leaning to the left (-x). */
function row(id: string, y: number, partner: string): TineRowInput {
  const tines = [0.1, 0.12, 0.14, 0.16].map((x) => ({
    base: [x, y, 0.01] as const,
    tip: [x - 0.01, y, 0.07] as const,
  }));
  return {
    rowId: id,
    label: id.toUpperCase(),
    frame: 'lower_rack',
    runs: 'x',
    state: 'up',
    tines,
    slots: [0, 1, 2].map((index) => ({
      index,
      centre: [0.11 + 0.02 * index, y, 0.01] as const,
      lean: 0.15,
      leanToward: '-x',
      plateNormal: [1, 0, 0] as const,
      blockedBy: index === 2 ? 'cutlery_basket' : null,
    })),
    partner: { rowId: partner, railSpacing: 0.1 },
  };
}

describe('the rows of tines a piece on edge takes up', () => {
  const rows = [row('r1', 0.3, 'r2'), row('r2', 0.4, 'r1')];
  const slots = rowSlots(rows, 'lower_rack');

  it('lists the free gaps of the rows that stand up, facing away from the lean', () => {
    // Two rows, three gaps each, the third covered by the cutlery basket.
    expect(slots.map((slot) => `${slot.row}:${slot.index}`)).toEqual([
      'r1:0',
      'r1:1',
      'r2:0',
      'r2:1',
    ]);
    const first = slots[0] as RowSlot;
    expect(first.face).toEqual([1, 0]);
    expect(first.along).toBe(0);
    // Midway to the partner row, and over the middle between the two tine tips.
    expect(first.across_mm).toBeCloseTo(350, 6);
    expect(first.tips_mm[0]).toBeCloseTo(100, 6);
    expect(first.tips_mm[2]).toBeCloseTo(70, 6);
    expect(rowSlots([{ ...(rows[0] as TineRowInput), state: 'folded' }], 'lower_rack')).toEqual([]);
    expect(rowSlots(rows, 'upper_rack')).toEqual([]);
  });

  it('a face to the right is a quarter turn to the left of the on-edge presets', () => {
    expect(yawFacing([0, -1])).toBe(0);
    expect(yawFacing([1, 0])).toBe(90);
    expect(yawFacing([0, 1])).toBe(180);
    expect(yawFacing([-1, 0])).toBe(-90);
    // A stance that turns the face to the right needs no turn to face right.
    expect(yawFacing([1, 0], [1, 0])).toBe(0);
  });

  it('holds the rim over the gap and the middle between the rows', () => {
    // A plate 30 mm deep, 270 mm across, its origin at the back of its foot, face to +x.
    const box = { min: [0, -135, -135] as const, max: [30, 135, 135] as const };
    const drop = slotDrop(slots[0] as RowSlot, box, [15, 0, 0], null);
    // Rim 2.5 mm past the middle between the tips; the reference point is mid-depth.
    expect(drop[0]).toBeCloseTo(100 - (30 - 2.5) + 15, 6);
    expect(drop[1]).toBeCloseTo(350, 6);
    // Kept clear of the walls of the basket.
    const walled = slotDrop(slots[0] as RowSlot, box, [15, 0, 0], { min: [0, 0], max: [500, 460] });
    expect(walled[1]).toBeCloseTo(460 - 4 - 135, 6);
  });

  it('takes the nearest gap within reach, and none far from a row', () => {
    const dropOf = (slot: RowSlot): readonly [number, number] => [slot.tips_mm[0], slot.across_mm];
    expect(nearestSlot(slots, [104, 330], dropOf)?.slot.index).toBe(0);
    expect(nearestSlot(slots, [117, 372], dropOf)?.slot.index).toBe(1);
    expect(nearestSlot(slots, [104, 200], dropOf)).toBeNull();
    expect(nearestSlot(slots, [300, 350], dropOf)).toBeNull();
  });

  it('only a piece that stands on edge takes up a row', () => {
    expect(standsOnEdge('on_edge')).toBe(true);
    expect(standsOnEdge('on_long_edge')).toBe(true);
    expect(standsOnEdge('inverted')).toBe(false);
    expect(standsOnEdge('handle_down')).toBe(false);
  });
});
