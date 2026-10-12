// Scenario h: the loading chain is deterministic. Twelve catalogue plates on the stand-in rack
// give the same state hash at every checkpoint when the run is repeated, and when the plates are
// added to a fresh world in reverse order (platform.md section 2: bodies are created in
// canonical order whatever order they are added in).
import type { Pose } from '@spotless/core';
import { afterEach, describe, expect, it } from 'vitest';
import { DINNER_PLATE, loadPlates, plateReleasePose } from './loads.ts';
import type { LoadingScene } from './scene.ts';
import { addItem, createLoadingScene, settleScene } from './scene.ts';
import type { PlateSlot } from './stand-in-rack.ts';

const scenes: LoadingScene[] = [];
afterEach(() => {
  for (const scene of scenes.splice(0)) scene.world.dispose();
});

/** Steps after which the state hash is taken (the last entries follow a settle and 10 s more). */
const CHECKPOINTS = [0, 1, 30, 120, 480];

/**
 * Runs scenario b and returns the state hash at every checkpoint, after settling and after ten
 * more seconds. `nudge` moves the release of plate 5 sideways by that many metres.
 */
async function runPlates(reverse: boolean, nudge = 0): Promise<string[]> {
  const scene = await createLoadingScene();
  scenes.push(scene);
  if (nudge === 0) {
    loadPlates(scene, { reverse });
  } else {
    for (let k = 0; k < 12; k++) {
      const pose = plateReleasePose(scene.rack, scene.rack.slots[k] as PlateSlot, DINNER_PLATE);
      const moved: Pose =
        k === 5 ? { p: [pose.p[0] + nudge, pose.p[1], pose.p[2]], q: pose.q } : pose;
      addItem(scene, `plate_${k < 10 ? `0${k}` : k}`, DINNER_PLATE, moved);
    }
  }
  const hashes: string[] = [];
  let done = 0;
  for (const at of CHECKPOINTS) {
    scene.world.step(at - done);
    done = at;
    hashes.push(scene.world.stateHash());
  }
  expect(settleScene(scene).atRest).toBe(true);
  hashes.push(scene.world.stateHash());
  scene.world.step(2400);
  hashes.push(scene.world.stateHash());
  return hashes;
}

describe('h. determinism of twelve plates on the rack', () => {
  it('gives the same state hashes twice, and with the plates added in reverse order', async () => {
    const first = await runPlates(false);
    expect(first).toHaveLength(CHECKPOINTS.length + 2);
    for (const hash of first) expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    // The plates move: the hashes of the first half second all differ from one another.
    expect(new Set(first.slice(0, CHECKPOINTS.length)).size).toBe(CHECKPOINTS.length);
    // At rest nothing changes any more: the hash after settling is the hash ten seconds later.
    expect(first[CHECKPOINTS.length + 1]).toBe(first[CHECKPOINTS.length]);

    const second = await runPlates(false);
    expect(second).toEqual(first);
    const reversed = await runPlates(true);
    expect(reversed).toEqual(first);
  });

  it('is a hash of the exact state: a release one micrometre to the side changes it', async () => {
    const reference = await runPlates(false);
    const nudged = await runPlates(false, 1e-6);
    // Different from the first hash on. (The plate still ends in its slot; only the bits differ.)
    nudged.forEach((hash, i) => expect(hash, `checkpoint ${i}`).not.toBe(reference[i]));
    // Adding the same plates one by one instead of through the loader changes nothing.
    const byHand = await runPlates(false, Number.MIN_VALUE);
    expect(byHand).toEqual(reference);
  });
});
