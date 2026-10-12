/**
 * Measures how long the session's calls take on a loaded machine: a saved standard load (by
 * default `breakfast-careful`, about 60 items placed by the careful policy) is replayed call by
 * call, queries included, and every call is timed; then, on the loaded machine, `preview`,
 * `list_slots`, `check_load`, four basket moves and `start_cycle`.
 *
 *   pnpm --filter @spotless/session exec tsx scripts/timing.ts
 *   pnpm --filter @spotless/session exec tsx scripts/timing.ts ../loader/loads/dinner-party-careful.json
 *   ... timing.ts --runs 3            best of three runs (default 3)
 *   ... timing.ts --targets           exit 1 when a target below is missed
 *
 * Targets (the owner's "immediate" for a human player; processor time is what is printed, so
 * run it on a quiet machine): `place` median 0.3 s and worst 3 s; a basket move and
 * `check_load` 1.5 s; `list_slots` with an item 0.5 s (median) once the seats of the machine
 * are known to the process. The first `list_slots` of a type of item in a process searches the
 * seats of the empty machine and is listed apart ("cold").
 *
 * Wall-clock times are printed; nothing in the session depends on them. The replay must
 * reproduce the saved state hashes: the script says so, and fails if it does not.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Level } from '@spotless/levels';
import type { ActionLogEvent, GameSession } from '../src/index.ts';
import { applyLoggedEvent, createSession } from '../src/index.ts';

interface SavedLoad {
  readonly name: string;
  readonly level: Level;
  readonly action_log: readonly ActionLogEvent[];
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? Number.NaN;
}

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const runsAt = args.indexOf('--runs');
const runs = runsAt >= 0 ? Math.max(1, Number(args[runsAt + 1] ?? 3)) : 3;
const file =
  args.find((a, i) => !a.startsWith('--') && (runsAt < 0 || i !== runsAt + 1)) ??
  join(here, '..', '..', 'loader', 'loads', 'breakfast-careful.json');
const load = JSON.parse(readFileSync(file, 'utf8')) as SavedLoad;

/** One run: the times of every kind of call, milliseconds. */
interface Run {
  readonly times: Map<string, number[]>;
  readonly placed: number;
  readonly mismatches: number;
}

async function once(): Promise<Run> {
  const times = new Map<string, number[]>();
  const note = (name: string, ms: number): void => {
    const list = times.get(name) ?? [];
    list.push(ms);
    times.set(name, list);
  };
  const created = performance.now();
  const session: GameSession = await createSession({ level: load.level });
  note('createSession', performance.now() - created);
  let mismatches = 0;
  // Everything up to the cycle: the load as the policy made it.
  for (const event of load.action_log) {
    if (event.name === 'start_cycle') break;
    const start = performance.now();
    const logged = applyLoggedEvent(session, event);
    const ms = performance.now() - start;
    if (logged === null) continue;
    if (logged.state_hash !== event.state_hash) mismatches += 1;
    const args0 = event.args as { option?: { name?: string }; item_id?: string } | null;
    const kind =
      event.name === 'set_rack'
        ? args0?.option?.name === 'position'
          ? 'set_rack position (while loading)'
          : 'set_rack other'
        : event.name === 'list_slots'
          ? args0?.item_id === undefined
            ? 'list_slots'
            : 'list_slots with an item'
          : event.name;
    note(logged.accepted ? kind : `${kind} (rejected)`, ms);
  }
  const state = session.getState();
  const placed = state.placed.length;
  // On the loaded machine.
  const unplaced = state.unplaced[0];
  const preset = session.card.items.find((i) => i.item_id === unplaced)?.orientation_presets[0];
  if (unplaced !== undefined && preset !== undefined) {
    for (const [x, y] of [
      [120, 120],
      [260, 300],
      [400, 420],
    ] as const) {
      const start = performance.now();
      session.preview({
        item_id: unplaced,
        frame: 'tub',
        position_mm: [x - 262, y - 762, 500],
        orientation: { preset: preset.name },
      });
      note('preview (loaded machine)', performance.now() - start);
    }
  }
  {
    const start = performance.now();
    session.checkLoad();
    note('check_load (loaded machine)', performance.now() - start);
  }
  for (const [rack, value] of [
    ['lower_rack', 'out'],
    ['lower_rack', 'in'],
    ['upper_rack', 'out'],
    ['upper_rack', 'in'],
  ] as const) {
    if (session.getState().racks[rack] === value) continue;
    const start = performance.now();
    const moved = session.setRack({ rack, option: { name: 'position', value } });
    if (moved.accepted) note('basket move (loaded machine)', performance.now() - start);
  }
  {
    const start = performance.now();
    const cycle = session.startCycle();
    if (cycle.accepted) note('start_cycle', performance.now() - start);
    await session.washSettled();
  }
  session.dispose();
  return { times, placed, mismatches };
}

const all: Run[] = [];
for (let i = 0; i < runs; i++) all.push(await once());
const first = all[0] as Run;
console.log(
  `${load.name}: ${first.placed} items in the machine; ${first.mismatches} state hashes differ from the saved log; ${runs} run(s), best run per row`,
);
console.log('call | n | median ms | worst ms | total ms');
const names = [...new Set(all.flatMap((run) => [...run.times.keys()]))].sort();
for (const name of names) {
  // The run with the smallest total for this kind of call.
  const best = all
    .map((run) => run.times.get(name) ?? [])
    .filter((list) => list.length > 0)
    .sort((a, b) => a.reduce((s, x) => s + x, 0) - b.reduce((s, x) => s + x, 0))[0];
  if (best === undefined) continue;
  const total = best.reduce((s, x) => s + x, 0);
  console.log(
    `${name} | ${best.length} | ${median(best).toFixed(1)} | ${Math.max(...best).toFixed(1)} | ${total.toFixed(0)}`,
  );
}
{
  const cold = (first.times.get('list_slots with an item') ?? []).slice();
  if (cold.length > 0) {
    console.log(
      `list_slots with an item, first run (cold: seats searched) | ${cold.length} | ${median(cold).toFixed(1)} | ${Math.max(...cold).toFixed(1)} | ${cold.reduce((s, x) => s + x, 0).toFixed(0)}`,
    );
  }
}
if (args.includes('--targets')) {
  const bestOf = (name: string): number[] =>
    all
      .map((run) => run.times.get(name) ?? [])
      .filter((list) => list.length > 0)
      .sort((a, b) => a.reduce((s, x) => s + x, 0) - b.reduce((s, x) => s + x, 0))[0] ?? [];
  const targets: [string, 'median' | 'worst', number][] = [
    ['place', 'median', 300],
    ['place', 'worst', 3000],
    ['basket move (loaded machine)', 'worst', 1500],
    ['set_rack position (while loading)', 'worst', 1500],
    ['check_load (loaded machine)', 'worst', 1500],
    ['list_slots with an item', 'median', 500],
  ];
  const missed: string[] = [];
  for (const [name, what, limit] of targets) {
    const list = bestOf(name);
    if (list.length === 0) continue;
    const value = what === 'median' ? median(list) : Math.max(...list);
    if (value > limit) missed.push(`${name} ${what} ${value.toFixed(0)} ms (target ${limit})`);
  }
  if (missed.length > 0) {
    console.error(`targets missed: ${missed.join('; ')}`);
    process.exit(1);
  }
  console.log('targets met');
}
if (all.some((run) => run.mismatches > 0)) {
  console.error('the replay did not reproduce the saved state hashes');
  process.exit(1);
}
