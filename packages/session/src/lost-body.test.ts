// When the engine loses the position of a body (seen once, on 2026-10-10: a roasting tin let go
// on a random pile left nineteen items without a position), the action is refused as
// `physics_limit` and the world is put back. Putting the poses back was not enough: the world
// then behaved differently from one in which the action had never been tried. The session now
// rebuilds every body before restoring; this test makes the engine "lose" a pose once and
// compares what follows, hash for hash, with a session in which nothing went wrong.
import { describe, expect, it } from 'vitest';
import type { GameSession } from './session.ts';
import { testLevel } from './test-level.ts';
import { mustPlace, mustSetRack, useSessions } from './test-util.ts';

const session = useSessions();

interface WorldWithPoses {
  getPose(id: string): { p: readonly number[]; q: readonly number[] };
}

function load(s: GameSession): void {
  for (const [i, x] of [120, 200, 300].entries()) {
    const listed = s.listSlots({ rack: 'lower_rack', item_id: `soup_plate_0${i + 1}` });
    if (!listed.accepted) throw new Error('list_slots was rejected');
    const slot = listed.slots.find(
      (candidate) => candidate.drop_free === true && candidate.centre_mm[0] > x,
    );
    if (slot?.suggested_drop === undefined) throw new Error('no seat');
    mustPlace(s, {
      item_id: `soup_plate_0${i + 1}`,
      frame: 'lower_rack',
      ...slot.suggested_drop,
    });
  }
}

describe('an action in which the engine loses a body', () => {
  it('is refused as physics_limit and leaves a world that goes on exactly as if it had not been tried', async () => {
    const clean = await session(testLevel());
    const hurt = await session(testLevel());
    load(clean);
    load(hurt);
    expect(hurt.stateHash()).toBe(clean.stateHash());

    // During the next action a body has no position.
    const world = (hurt as unknown as { world: WorldWithPoses }).world;
    const getPose = world.getPose.bind(world);
    let armed = false;
    world.getPose = (id) => {
      const pose = getPose(id);
      if (armed && id === 'soup_plate_02') {
        return { p: [Number.NaN, pose.p[1] as number, pose.p[2] as number], q: pose.q };
      }
      return pose;
    };
    const fork = {
      item_id: 'fork_01',
      frame: 'cutlery_basket' as const,
      position_mm: [32, 28, 120] as const,
      orientation: { preset: 'handle_down' },
    };
    const before = hurt.getState();
    armed = true;
    const lost = hurt.place(fork);
    armed = false;
    expect(lost.accepted).toBe(false);
    expect(!lost.accepted && lost.reason).toBe('physics_limit');
    const after = hurt.getState();
    expect(after.state_hash).toBe(before.state_hash);
    expect(after.budget.actions_used).toBe(before.budget.actions_used);

    // From here both sessions must do the same, to the last bit.
    for (const s of [clean, hurt]) mustPlace(s, fork);
    expect(hurt.stateHash()).toBe(clean.stateHash());
    for (const position of ['in', 'out'] as const) {
      const a = mustSetRack(clean, 'lower_rack', 'position', position);
      const b = mustSetRack(hurt, 'lower_rack', 'position', position);
      expect(b.state.state_hash).toBe(a.state.state_hash);
      expect(b.state.placed.every((item) => item.stable)).toBe(true);
    }
  }, 120_000);
});
