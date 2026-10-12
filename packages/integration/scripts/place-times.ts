/**
 * Wall time of session actions on untidy and on orderly loads (docs/design/platform.md
 * section 5, "Cost"). Two workloads, both played through the session exactly as a player would:
 *
 *  - `pile`: a seeded random fill. Items of a level are let go at random spots and attitudes
 *    over a pulled-out basket and left where they come to rest, whatever they land on, half in
 *    the lower basket and half in the upper one, until the wanted number is in the machine.
 *    Then each basket is pushed in and the load is checked.
 *  - `careful`: the careful policy of `@spotless/loader`.
 *
 *   pnpm --filter @spotless/integration exec tsx scripts/place-times.ts pile dinner-party 60 1
 *   pnpm --filter @spotless/integration exec tsx scripts/place-times.ts careful weeknight-dinner
 *
 * Prints one line per accepted placement (wall milliseconds, simulated settle time, what it
 * touched) when `--trace` is given, then the summary: median and worst place, every basket
 * move, the mechanical check, and the final state hash (which is what must not change when
 * only the speed is worked on). Every time is given twice: wall-clock, which says nothing
 * unless the machine is idle, and the processor time of this process, which is what the work
 * costs whatever else is running (the two agree on an idle machine).
 */

import { performance } from 'node:perf_hooks';
import { findLevel } from '@spotless/levels';
import type { Level } from '@spotless/levels';
import { Player, dropAt, dropHeights, makeRng, runPolicy, viewOf } from '@spotless/loader';
import type { LoadFrame } from '@spotless/loader';
import type { Orientation } from '@spotless/session';
import { createSession } from '@spotless/session';

function unlimited(level: Level): Level {
  return { ...level, rules: { ...level.rules, actionsMax: 100000, queriesMax: 100000 } };
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] as number;
}

function summary(label: string, values: readonly number[]): string {
  if (values.length === 0) return `${label}: none`;
  const total = values.reduce((sum, v) => sum + v, 0);
  return `${label}: n ${values.length}, median ${median(values).toFixed(0)} ms, worst ${Math.max(...values).toFixed(0)} ms, total ${(total / 1000).toFixed(1)} s`;
}

/** Processor time of this process so far, milliseconds (user and system). */
function cpuNow(): number {
  const usage = process.cpuUsage();
  return (usage.user + usage.system) / 1000;
}

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const trace = process.argv.includes('--trace');
const mode = args[0] ?? 'pile';
const levelId = args[1] ?? 'dinner-party';
const level = findLevel(levelId);
if (level === undefined) throw new Error(`no level '${levelId}'`);

if (mode === 'careful') {
  const session = await createSession({ level });
  const started = performance.now();
  const cpuStarted = cpuNow();
  // The stopwatch handed to the policy is the processor time of this process, so that its
  // per-action figures do not depend on what else the machine is doing.
  const result = runPolicy(session, {
    policy: 'careful',
    seed: Number(args[2] ?? 1),
    now: cpuNow,
  });
  const total = performance.now() - started;
  const cpuTotal = cpuNow() - cpuStarted;
  console.log(
    `careful ${levelId}: placed ${result.counts.placed} of ${result.counts.offered}, ` +
      `${result.counts.placeCalls} place calls (${result.counts.placeAccepted} accepted), ` +
      `${result.counts.rackMoves} basket moves, ${result.counts.checks} checks, ` +
      `${(total / 1000).toFixed(1)} s wall and ${(cpuTotal / 1000).toFixed(1)} s processor in all`,
  );
  console.log(
    `processor time: accepted place median ${result.measured.placeMedianMs.toFixed(0)} ms, worst ${result.measured.placeMaxMs.toFixed(0)} ms, ` +
      `total ${(result.measured.placeTotalMs / 1000).toFixed(1)} s; basket move median ${result.measured.rackMoveMedianMs.toFixed(0)} ms; ` +
      `check median ${result.measured.checkMedianMs.toFixed(0)} ms`,
  );
  console.log(`final state ${result.finalState.state_hash}`);
  session.dispose();
} else {
  const wanted = Number(args[2] ?? 60);
  const seed = Number(args[3] ?? 1);
  const session = await createSession({ level: unlimited(level) });
  const player = new Player(session, () => performance.now());
  const rng = makeRng(seed, 0);
  const items = [...player.items.keys()];
  const placeMs: number[] = [];
  const placeCpu: number[] = [];
  const rackMs: number[] = [];
  const rackCpu: number[] = [];
  let next = 0;
  let fellOut = 0;

  const moveRack = (rack: 'lower_rack' | 'upper_rack', position: 'in' | 'out'): void => {
    const started = performance.now();
    const cpuStarted = cpuNow();
    const result = session.setRack({ rack, option: { name: 'position', value: position } });
    const ms = performance.now() - started;
    const cpu = cpuNow() - cpuStarted;
    rackMs.push(ms);
    rackCpu.push(cpu);
    console.log(
      `${rack} ${position}: ${ms.toFixed(0)} ms wall, ${cpu.toFixed(0)} ms processor, ${result.accepted ? 'accepted' : `rejected ${result.reason}`}`,
    );
    player.refresh();
  };

  const fill = (frame: LoadFrame, count: number): void => {
    let placed = 0;
    let draws = 0;
    while (placed < count && next < items.length && draws < 40 * count) {
      const id = items[next] as string;
      const view = viewOf(player.item(id));
      const [ex, ey] = player.envelope(frame);
      draws++;
      const x = 40 + rng.next() * (ex - 80);
      const y = 40 + rng.next() * (ey - 80);
      const preset = rng.pick(view.record.orientation_presets).name;
      const orientation: Orientation = { preset, yaw_deg: rng.int(360) };
      const started = performance.now();
      const cpuStarted = cpuNow();
      const result = dropAt(
        player,
        id,
        frame,
        x,
        y,
        orientation,
        dropHeights(player, frame, y, view.longest / 2 + 4, view.longest / 2),
      );
      const ms = performance.now() - started;
      const cpu = cpuNow() - cpuStarted;
      if (!result.accepted) continue;
      next++;
      // Every accepted placement counts, also one that ends on the floor: the player waits
      // for it all the same.
      placeMs.push(ms);
      placeCpu.push(cpu);
      const lost = result.fell_out || result.fell_through;
      if (lost) fellOut++;
      else placed++;
      if (trace) {
        console.log(
          `${String(placeMs.length).padStart(3)} ${id.padEnd(22)} ${ms.toFixed(0).padStart(6)} ms wall ${cpu.toFixed(0).padStart(6)} ms processor  settle ${result.settle_time_s.toFixed(2)} s  ` +
            `stable ${result.stable ? 'y' : 'n'}  moved ${result.moved_items.length}  ${lost ? 'FELL OUT  ' : ''}touches ${result.contacts.map((c) => c.with).join(', ')}`,
        );
      }
    }
  };

  const half = Math.ceil(wanted / 2);
  moveRack('lower_rack', 'out');
  fill('lower_rack', half);
  moveRack('lower_rack', 'in');
  moveRack('upper_rack', 'out');
  fill('upper_rack', wanted - half);
  moveRack('upper_rack', 'in');
  const started = performance.now();
  const cpuStarted = cpuNow();
  const check = session.checkLoad();
  const checkMs = performance.now() - started;
  const checkCpu = cpuNow() - cpuStarted;

  const state = session.getState();
  console.log(
    `pile ${levelId} seed ${seed}: ${state.placed.length} items in the machine, ${fellOut} placements ended outside it`,
  );
  console.log(summary('place, wall', placeMs));
  console.log(summary('place, processor', placeCpu));
  console.log(summary('basket move, wall', rackMs));
  console.log(summary('basket move, processor', rackCpu));
  console.log(
    `check_load: ${checkMs.toFixed(0)} ms wall, ${checkCpu.toFixed(0)} ms processor, ${check.accepted ? 'answered' : 'rejected'}`,
  );
  console.log(`final state ${state.state_hash}`);
  session.dispose();
}
