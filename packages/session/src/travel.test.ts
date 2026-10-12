// How a basket travels: the motion of the hand as distances per step, the drive against the
// rack travel of the physics package, and what a normal pull and push does to a load: what
// stands on its base or in a slot moves by the knock of the end stop and no more
// (v^2 / (2 mu g)), what is perched falls, and the careless shove throws things as it did.
import { STANDARD_GRAVITY } from '@spotless/core';
import type { JoltPhysicsWorld } from '@spotless/physics';
import {
  LOADING_TIME_STEP,
  RACK_TRAVEL_PROFILE,
  rackTravelDistances,
  settleOptionsFor,
  travelRack,
} from '@spotless/physics';
import { describe, expect, it } from 'vitest';
import type { GameSession } from './session.ts';
import { testLevel } from './test-level.ts';
import { mustPlace, mustSetRack, openUpperBasket, useSessions } from './test-util.ts';
import {
  BASKET_TRAVEL_PROFILES,
  basketTravelDistances,
  basketTravelSpeeds,
  driveBasket,
} from './travel.ts';

const session = useSessions();
const DT = LOADING_TIME_STEP;

/** The loading world of a session (tests only). */
function worldOf(s: GameSession): JoltPhysicsWorld {
  return (s as unknown as { world: JoltPhysicsWorld }).world;
}

describe('the motion of a basket', () => {
  it('reaches the peak speed, slows to the speed at the stop and ends exactly at the distance', () => {
    const profile = BASKET_TRAVEL_PROFILES.normal;
    const distances = basketTravelDistances(0.5, profile, DT);
    expect(distances[distances.length - 1]).toBe(0.5);
    const speeds = distances.map((d, i) => (d - (distances[i - 1] ?? 0)) / DT);
    // Never backwards, never faster than the peak.
    expect(Math.min(...speeds)).toBeGreaterThan(0);
    expect(Math.max(...speeds)).toBeLessThanOrEqual(profile.peakSpeed + 1e-9);
    expect(Math.max(...speeds)).toBeGreaterThan(profile.peakSpeed - 0.005);
    // The last step is taken at the speed of the stop (the last step is cut to end exactly).
    expect(speeds[speeds.length - 2]).toBeGreaterThan(profile.endStopSpeed - 0.005);
    expect(speeds[speeds.length - 2]).toBeLessThan(profile.endStopSpeed + 0.01);
    // Accelerations of the hand: 1 m/s^2 each way, by hand calculation of the profile.
    const changes = speeds.slice(1, -1).map((v, i) => (v - (speeds[i] as number)) / DT);
    expect(Math.max(...changes)).toBeLessThanOrEqual(profile.acceleration + 1e-6);
    expect(Math.min(...changes)).toBeGreaterThanOrEqual(-profile.deceleration - 1e-6);
    // Duration: v/a up, (v - ve)/d down, the rest at the peak: 0.35 + 0.25 + (0.5 - 0.06125
    // - 0.05625) / 0.35 = 1.693 s.
    expect(distances.length * DT).toBeCloseTo(1.693, 2);
  });

  it('never reaches the peak on a short travel, nor the stop speed on a very short one', () => {
    const profile = BASKET_TRAVEL_PROFILES.normal;
    // 30 mm: v^2 = (2 a d D + a ve^2) / (a + d) = (0.06 + 0.01) / 2.
    expect(basketTravelSpeeds(0.03, profile).peak).toBeCloseTo(Math.sqrt(0.035), 9);
    // 2 mm: accelerating all the way gives sqrt(2 a D) = 0.063 m/s, less than the stop speed.
    const short = basketTravelSpeeds(0.002, profile);
    expect(short.atStop).toBeCloseTo(Math.sqrt(0.004), 9);
    expect(short.peak).toBeCloseTo(short.atStop, 9);
    const distances = basketTravelDistances(0.002, profile, DT);
    expect(distances[distances.length - 1]).toBe(0.002);
    expect(basketTravelDistances(0, profile, DT)).toEqual([]);
    expect(() => basketTravelDistances(-1, profile, DT)).toThrow();
  });

  it('gives the distances of the physics package for a profile without a speed at the stop', () => {
    expect(BASKET_TRAVEL_PROFILES.hard).toEqual({
      peakSpeed: RACK_TRAVEL_PROFILE.peakSpeed,
      acceleration: RACK_TRAVEL_PROFILE.acceleration,
      deceleration: RACK_TRAVEL_PROFILE.endStopDeceleration,
      endStopSpeed: 0,
    });
    expect(basketTravelDistances(0.44, BASKET_TRAVEL_PROFILES.hard, DT)).toEqual(
      rackTravelDistances(0.44, RACK_TRAVEL_PROFILE, DT),
    );
  });
});

describe('the drive', () => {
  it('with the hard profile and the settle of the physics package is travelRack to the bit', async () => {
    const hashes: string[] = [];
    for (const how of ['drive', 'travelRack'] as const) {
      const s = await session(testLevel());
      openUpperBasket(s);
      mustPlace(s, {
        item_id: 'mug_01',
        frame: 'upper_rack',
        position_mm: [70, 60, 150],
        orientation: { preset: 'inverted' },
      });
      const world = worldOf(s);
      const racks = world
        .bodyIds()
        .filter((id) => id.startsWith('upper_') && world.getKind(id) === 'kinematic');
      // The upper basket's wire body first, as the session passes them.
      racks.sort((a, b) => (a === 'upper_rack' ? -1 : b === 'upper_rack' ? 1 : a < b ? -1 : 1));
      if (how === 'drive') {
        driveBasket(world, {
          racks,
          travel: [0, 0.44, 0],
          riders: ['mug_01'],
          distances: basketTravelDistances(0.44, BASKET_TRAVEL_PROFILES.hard, DT),
        });
        world.settle(settleOptionsFor(DT));
      } else {
        travelRack(world, { racks, travel: [0, 0.44, 0], riders: [{ id: 'mug_01' }] });
      }
      hashes.push(world.stateHash());
    }
    expect(hashes[0]).toBe(hashes[1]);
  });
});

describe('a normal pull and push', () => {
  it('moves a mug and a glass standing mouth down by the knock of the stop and no more', async () => {
    const s = await session(testLevel());
    openUpperBasket(s);
    // The mug between two rows of tines at the rear, leaning 8 degrees on a tine of row A, the
    // glass at the front left, in front of the knife shelf (scanned 2026-10-10: measured 1.6 to
    // 2.4 mm a move for the mug). Since IMG_9131 the floor there is the rest along the left
    // wall, falling 33 degrees to it, and not a level strip: the glass stands leaning on it.
    mustPlace(s, {
      item_id: 'mug_01',
      frame: 'upper_rack',
      position_mm: [165, 390, 150],
      orientation: { preset: 'inverted' },
    });
    mustPlace(s, {
      item_id: 'glass_01',
      frame: 'upper_rack',
      position_mm: [70, 60, 150],
      orientation: { preset: 'inverted' },
    });
    // v^2 / (2 mu g) at the stop: 0.1 m/s; glazed ceramic on coated wire 0.25, glass 0.20.
    const v = BASKET_TRAVEL_PROFILES.normal.endStopSpeed;
    const slideGlass = ((v * v) / (2 * 0.2 * STANDARD_GRAVITY)) * 1000; // 2.55 mm
    for (const position of ['in', 'out', 'in', 'out'] as const) {
      const moved = mustSetRack(s, 'upper_rack', 'position', position);
      for (const item of moved.moved_items) {
        // A few millimetres at most (measured: the glass 2.4 mm every time, the mug, which
        // leans on a tine and rocks, 1.9 to 2.9 mm).
        expect(item.displacement_mm, `${item.item_id} ${position}`).toBeLessThan(4);
        expect(item.rotation_deg, `${item.item_id} ${position}`).toBeLessThan(3);
      }
      expect(moved.state.placed.every((p) => p.stable)).toBe(true);
    }
    // The glass slides along the wires of the rest by the knock of the stop: no further than
    // a glass standing free on level wires does by the closed form (2.55 mm; that case is
    // `packages/physics/src/travel.test.ts`), and not much less. Measured 1.8 mm, 0.71 of the
    // closed form: leaning, it also bears on the wires that cross its way. No level stretch of
    // floor wide enough for a tumbler is left in this basket to test the closed form on (until
    // IMG_9131 this spot was taken for one, and the band was 0.75 to 1.25).
    const push = mustSetRack(s, 'upper_rack', 'position', 'in');
    const glass = push.moved_items.find((m) => m.item_id === 'glass_01');
    expect(glass?.displacement_mm).toBeGreaterThan(slideGlass * 0.5);
    expect(glass?.displacement_mm).toBeLessThan(slideGlass * 1.25);
  }, 120_000);

  it('throws a glass perched on tine tips and shifts a knife laid flat; the careless shove slides a mug ten times as far', async () => {
    const s = await session(testLevel());
    openUpperBasket(s);
    // A glass let down mouth down onto the tips of the short tines at the front left: it
    // stands there, 43 mm above the floor, and stays under a nudge.
    const glass = mustPlace(s, {
      item_id: 'glass_01',
      frame: 'upper_rack',
      position_mm: [160, 98, 150],
      orientation: { preset: 'inverted' },
    });
    expect(glass.resting?.on_base).toBe(false);
    expect(glass.stable).toBe(true);
    // A knife laid flat across the floor wires.
    const knife = mustPlace(s, {
      item_id: 'knife_01',
      frame: 'upper_rack',
      position_mm: [330, 200, 160],
      orientation: { preset: 'flat' },
    });
    expect(knife.stable).toBe(true);
    const push = mustSetRack(s, 'upper_rack', 'position', 'in');
    // The glass comes off its perch; the knife slides by the knock (steel on wire 0.22: 2.3 mm).
    expect(push.moved_items.find((m) => m.item_id === 'glass_01')?.displacement_mm).toBeGreaterThan(
      15,
    );
    const slid = push.moved_items.find((m) => m.item_id === 'knife_01')?.displacement_mm ?? 0;
    expect(slid).toBeGreaterThan(1);
    expect(slid).toBeLessThan(4);

    // The careless shove (0.5 m/s braked at 5 m/s^2): the same glass, free on the floor wires,
    // which a normal move slides 2.4 mm, goes 7 to 23 mm (a free block: 39 mm for mu 0.2).
    const hard = await session(testLevel(), { travel: BASKET_TRAVEL_PROFILES.hard });
    openUpperBasket(hard);
    mustPlace(hard, {
      item_id: 'glass_01',
      frame: 'upper_rack',
      position_mm: [70, 60, 150],
      orientation: { preset: 'inverted' },
    });
    let furthest = 0;
    for (const position of ['in', 'out', 'in'] as const) {
      const shove = mustSetRack(hard, 'upper_rack', 'position', position);
      furthest = Math.max(furthest, ...shove.moved_items.map((m) => m.displacement_mm));
    }
    expect(furthest).toBeGreaterThan(15);
  }, 120_000);
});
