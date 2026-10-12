/**
 * Measures the wall-clock cost of stepping the loading world with real catalogue items on the
 * stand-in rack and prints it:
 *
 *   pnpm --filter @spotless/integration step-times
 *
 * Two loads, each from release until it has come to rest and then, with the engine forbidden to
 * put bodies to sleep, with every body simulated in every step:
 *   - scenario b: twelve dinner plates in adjacent tine slots;
 *   - the mixed load: sixty items on two racks.
 * The numbers depend on the machine and on what else it is doing.
 */

import {
  createLoadingScene,
  formatStepTimes,
  loadMixedLoad,
  loadPlates,
  measureOverlap,
  settleScene,
  summariseStepTimes,
  timeSteps,
  type LoadingScene,
} from '../src/index.ts';

async function measure(
  label: string,
  load: (scene: LoadingScene) => void,
  seconds: number,
): Promise<void> {
  const steps = Math.round(seconds * 240);
  const scene = await createLoadingScene();
  load(scene);
  const pieces = scene.items.reduce((sum, item) => sum + item.pieces.length, 0);
  const fixed = scene.fixtures.reduce((sum, body) => sum + body.pieces.length, 0);
  console.log(
    `${label}: ${scene.items.length} items of ${pieces} collision pieces on ${fixed} fixed pieces`,
  );
  let manifolds = 0;
  let firstAsleep = -1;
  const times = timeSteps(scene.world, steps, (i) => {
    const stats = scene.world.stats();
    manifolds = Math.max(manifolds, stats.manifolds);
    if (firstAsleep < 0 && stats.activeBodies === 0) firstAsleep = i + 1;
  });
  const settled = settleScene(scene);
  console.log(
    `  ${formatStepTimes(`release to rest, first ${seconds} s`, summariseStepTimes(times, scene.world.timeStep))}`,
  );
  const landing = times.slice(0, 60);
  console.log(
    `  ${formatStepTimes('of which the first 0.25 s', summariseStepTimes(landing, scene.world.timeStep))}`,
  );
  console.log(
    `  at rest: ${String(settled.atRest)}; all asleep after ${(firstAsleep / 240).toFixed(2)} s; ` +
      `most contact manifolds in a step ${manifolds}; deepest overlap at rest ` +
      `${(measureOverlap(scene).deepest * 1000).toFixed(3)} mm; state ${scene.world.stateHash().slice(0, 23)}`,
  );
  scene.world.dispose();

  // The same load with sleeping off: what a step costs while everything is simulated.
  const awake = await createLoadingScene({ settings: { allowSleeping: false } });
  load(awake);
  awake.world.step(steps);
  const resting = timeSteps(awake.world, 240);
  console.log(
    `  ${formatStepTimes('resting, every body awake, 1 s', summariseStepTimes(resting, awake.world.timeStep))}`,
  );
  awake.world.dispose();
}

await measure('scenario b', (scene) => void loadPlates(scene), 2);
await measure('mixed load', (scene) => void loadMixedLoad(scene), 4);
