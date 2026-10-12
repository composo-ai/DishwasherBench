/**
 * Checks every saved standard load by numbers: measures the saved wash manifest again
 * (overlaps, items outside their basket), reads the session's stability verdicts and the
 * mechanical check from the file, and in a fresh process per load replays the action log, moves
 * both baskets out and in again and reads every recorded mistake against the settled poses.
 *
 *   pnpm --filter @spotless/loader check-loads [names...] [--no-replay] [--jobs 6]
 *
 * Prints one line per load. Exit status 1 if a load does not replay to its saved hash, if a
 * recorded mistake is not what the settled poses show, or if a load of the careful policy
 * cannot have its baskets pulled out and pushed in again, has an item lying on others without
 * touching a basket, or has a plate touching another item.
 */

import { spawn } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StandardLoad } from '../src/standard-loads.ts';
import { verifyLoad } from '../src/verify.ts';

const here = dirname(fileURLToPath(import.meta.url));
const loadsDir = join(here, '..', 'loads');
const args = process.argv.slice(2);
const replay = !args.includes('--no-replay');
const jobsAt = args.indexOf('--jobs');
const jobs = jobsAt >= 0 ? Math.max(1, Number(args[jobsAt + 1] ?? 1)) : 4;
const names = args.filter((a, i) => !a.startsWith('--') && (jobsAt < 0 || i !== jobsAt + 1));
const files = readdirSync(loadsDir)
  .filter((f) => f.endsWith('.json') && f !== 'SUMMARY.json')
  .filter((f) => names.length === 0 || names.includes(f.replace(/\.json$/, '')))
  .sort();

/** What `replay-load.ts` prints. */
interface ReplayOutput {
  readonly ok?: boolean;
  readonly replay?: { readonly ok: boolean; readonly mismatches: number };
  readonly baskets_travel?: boolean;
  readonly blocked?: readonly {
    readonly rack: string;
    readonly position: string;
    readonly blocked_by: readonly string[];
  }[];
  readonly thrown?: readonly string[];
  readonly posture?: readonly {
    readonly item_id: string;
    readonly kind: string;
    readonly deg: number;
  }[];
  readonly shifted_most?: number;
  readonly shifted_worst?: {
    readonly item_id: string;
    readonly mm: number;
    readonly deg: number;
  } | null;
  readonly mistakes?: number;
  readonly mistakes_wrong?: readonly {
    readonly mistake: { readonly kind: string; readonly item_id: string };
    readonly why: string | null;
  }[];
  readonly touching?: readonly { readonly item_id: string; readonly with: readonly string[] }[];
  readonly laid_over?: readonly string[];
  readonly plates_touching?: readonly string[];
}

/** Runs `replay-load.ts` on a file in a process of its own. */
function replayOf(path: string): Promise<{ status: number | null; out: string; err: string }> {
  return new Promise((resolve) => {
    const proc = spawn(process.execPath, ['--import', 'tsx', join(here, 'replay-load.ts'), path], {
      cwd: join(here, '..'),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    proc.stdout.on('data', (chunk: Buffer) => {
      out += chunk.toString();
    });
    proc.stderr.on('data', (chunk: Buffer) => {
      err += chunk.toString();
    });
    proc.on('close', (status) => resolve({ status, out, err }));
  });
}

let failed = false;

async function check(file: string): Promise<string> {
  const path = join(loadsDir, file);
  const load = JSON.parse(readFileSync(path, 'utf8')) as StandardLoad;
  // The stability flags are those of the scene the load was saved with.
  const numbers = await verifyLoad(
    load.wash_manifest,
    {
      state_hash: load.final_state_hash,
      phase: 'washing',
      racks: {},
      rack_options: {},
      placed: [],
      unplaced: [],
      budget: {
        actions_max: 0,
        queries_max: 0,
        washes_max: 0,
        actions_used: 0,
        queries_used: 0,
        washes_used: 0,
      },
    },
    load.check,
  );
  let replayed = 'skipped';
  let travel = 'skipped';
  let mistakes = 'skipped';
  let touching = 'skipped';
  let posture = 'skipped';
  let shifted = 'skipped';
  if (replay) {
    const run = await replayOf(path);
    if (run.status !== 0) failed = true;
    try {
      const out = JSON.parse(run.out.trim().split('\n').pop() ?? '{}') as ReplayOutput;
      replayed =
        out.replay?.ok === true ? 'same hashes' : `DIFFERS (${out.replay?.mismatches ?? '?'})`;
      const thrown = out.thrown ?? [];
      travel =
        out.baskets_travel === true
          ? `yes${thrown.length > 0 ? ` (throws ${thrown.join(', ')})` : ''}`
          : `NO: ${(out.blocked ?? []).map((b) => `${b.rack} ${b.position} by ${b.blocked_by.join(', ')}`).join('; ')}`;
      const wrong = out.mistakes_wrong ?? [];
      mistakes =
        wrong.length === 0
          ? `${out.mistakes ?? 0} hold`
          : `${wrong.length} of ${out.mistakes ?? 0} WRONG: ${wrong.map((w) => `${w.mistake.kind} ${w.mistake.item_id} (${w.why ?? ''})`).join('; ')}`;
      touching = `${(out.touching ?? []).length} / ${(out.laid_over ?? []).length} / ${(out.plates_touching ?? []).length}`;
      const findings = out.posture ?? [];
      posture =
        findings.length === 0
          ? 'none'
          : findings
              .map(
                (f) =>
                  `${f.item_id} ${f.kind === 'plate_against_row' ? 'against its row' : 'leans'} ${f.deg}`,
              )
              .join(', ');
      const worst = out.shifted_worst ?? null;
      shifted = `${out.shifted_most ?? 0}${worst === null ? '' : ` (worst ${worst.item_id} ${worst.mm} mm ${worst.deg} deg)`}`;
    } catch {
      replayed = `FAILED ${run.out.trim().slice(0, 200)} ${run.err.trim().slice(0, 200)}`;
    }
  }
  const same =
    numbers.deepest_overlap_mm === load.numbers.deepest_overlap_mm &&
    numbers.overlaps.length === load.numbers.overlaps.length &&
    numbers.deepest_true_overlap_mm === load.numbers.deepest_true_overlap_mm;
  return [
    load.name,
    numbers.items,
    load.numbers.unstable.length,
    `${numbers.deepest_overlap_mm}${same ? '' : ' (file says ' + load.numbers.deepest_overlap_mm + ')'}`,
    numbers.overlaps.length,
    `${numbers.deepest_true_overlap_mm} (${numbers.true_overlaps.length} over 0.5)`,
    numbers.out_of_basket.length + numbers.not_in_a_basket.length,
    numbers.check_passes ? 'passes' : numbers.check_findings.join('; '),
    replayed,
    travel,
    mistakes,
    touching,
    posture,
    shifted,
  ].join(' | ');
}

console.log(
  'name | items | unstable | deepest overlap mm (collision pieces) | pairs over 0.5 mm | deepest overlap mm (true shapes) | outside basket | check_load | replay | baskets travel | mistakes | non-cutlery items touching another / lying on others only / plates touching | plates against their row, vessels leaning over 25 deg | most items one basket move shifts over 5 mm or 10 deg',
);
const rows = new Map<string, string>();
const queue = [...files];
const worker = async (): Promise<void> => {
  for (;;) {
    const file = queue.shift();
    if (file === undefined) return;
    rows.set(file, await check(file));
  }
};
await Promise.all(Array.from({ length: Math.min(jobs, Math.max(1, files.length)) }, worker));
for (const file of files) console.log(rows.get(file) ?? `${file} | not checked`);
process.exit(failed ? 1 : 0);
