/**
 * Generates the standard loads and saves each under `loads/` as `<name>.json` (the load) and
 * `<name>.png` (both baskets from above, the front and the side).
 *
 *   pnpm --filter @spotless/loader generate-loads                 every standard load
 *   pnpm --filter @spotless/loader generate-loads iec-13-careful  the named ones
 *   ... generate-loads --jobs 4                                   four at a time
 *   ... generate-loads --trace iec-13-careful                     with a line per placement
 *
 * With `--jobs` every load is generated in a process of its own, so that the result cannot
 * depend on what was generated before it. A summary table is printed at the end and written to
 * `loads/SUMMARY.json`.
 */

import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writePng } from '../src/png.ts';
import { renderLoadSheet, sceneOfManifest } from '../src/scene.ts';
import type { StandardLoad } from '../src/standard-loads.ts';
import { generateStandardLoad, standardLoadSpecs, washManifestOf } from '../src/standard-loads.ts';

const here = dirname(fileURLToPath(import.meta.url));
const loadsDir = join(here, '..', 'loads');

/** One row of the summary. */
interface SummaryRow {
  readonly name: string;
  readonly policy: string;
  readonly offered: number;
  readonly placed: number;
  readonly by_basket: { readonly [rack: string]: number };
  readonly attempts_per_placed: number;
  readonly accepted_per_placed: number;
  readonly unstable: number;
  /** Deepest overlap of the convex collision pieces (not of the true surfaces), millimetres. */
  readonly deepest_overlap_mm: number;
  readonly overlap_measured_on: string;
  readonly overlaps: number;
  /** Deepest overlap of two items on their true shapes, millimetres, and pairs over 0.5 mm. */
  readonly deepest_true_overlap_mm: number;
  readonly true_overlaps: number;
  readonly points_offered: number;
  readonly points_placed: number;
  readonly mistakes: { readonly [kind: string]: number };
  readonly out_of_basket: number;
  readonly check: string;
  readonly seconds: number;
  readonly place_median_ms: number;
  readonly place_max_ms: number;
  readonly file: string;
}

function rowOf(load: StandardLoad): SummaryRow {
  return {
    name: load.name,
    policy: load.policy.name,
    offered: load.counts.offered,
    placed: load.counts.placed,
    by_basket: load.numbers.by_basket,
    attempts_per_placed: load.counts.attemptsPerPlaced,
    accepted_per_placed: load.counts.acceptedPerPlaced,
    unstable: load.numbers.unstable.length,
    deepest_overlap_mm: load.numbers.deepest_overlap_mm,
    overlap_measured_on: 'convex collision pieces of the loading physics',
    overlaps: load.numbers.overlaps.length,
    deepest_true_overlap_mm: load.numbers.deepest_true_overlap_mm,
    true_overlaps: load.numbers.true_overlaps.length,
    points_offered: load.level.items.reduce((sum, item) => sum + item.points, 0),
    points_placed: load.level.items
      .filter((item) => load.placed.includes(item.id))
      .reduce((sum, item) => sum + item.points, 0),
    mistakes: load.mistakes.reduce<{ [kind: string]: number }>((count, mistake) => {
      count[mistake.kind] = (count[mistake.kind] ?? 0) + 1;
      return count;
    }, {}),
    out_of_basket: load.numbers.out_of_basket.length + load.numbers.not_in_a_basket.length,
    check: load.numbers.check_passes ? 'passes' : load.numbers.check_findings.join('; '),
    seconds: Math.round(load.measured.totalMs / 100) / 10,
    place_median_ms: load.measured.placeMedianMs,
    place_max_ms: load.measured.placeMaxMs,
    file: `packages/loader/loads/${load.name}.json`,
  };
}

/** Writes a load as JSON with one event of the action log per line. */
function save(load: StandardLoad): void {
  const { action_log: log, ...rest } = load;
  const head = JSON.stringify(rest, null, 1);
  const events = log.map((event) => JSON.stringify(event)).join(',\n');
  writeFileSync(
    join(loadsDir, `${load.name}.json`),
    `${head.slice(0, head.lastIndexOf('}'))},\n "action_log": [\n${events}\n]\n}\n`,
  );
}

async function generateOne(name: string, trace: boolean): Promise<SummaryRow> {
  const spec = standardLoadSpecs().find((s) => s.name === name);
  if (spec === undefined) throw new Error(`no standard load '${name}'`);
  const { load, session } = await generateStandardLoad(
    spec,
    () => performance.now(),
    trace ? (line) => console.error(`  ${line}`) : undefined,
  );
  session.dispose();
  mkdirSync(loadsDir, { recursive: true });
  save(load);
  writePng(join(loadsDir, `${name}.png`), renderLoadSheet(sceneOfManifest(washManifestOf(load))));
  return rowOf(load);
}

function printTable(rows: readonly SummaryRow[]): void {
  const header =
    'name | policy | offered | placed | points | by basket | attempts/placed (accepted) | unstable | mistakes | check | seconds';
  console.log(header);
  for (const row of rows) {
    const baskets = Object.keys(row.by_basket)
      .sort()
      .map((rack) => `${rack.replace('_rack', '')} ${row.by_basket[rack]}`)
      .join(', ');
    console.log(
      `${row.name} | ${row.policy} | ${row.offered} | ${row.placed} | ${row.points_placed}/${row.points_offered} | ${baskets} | ${row.attempts_per_placed} (${row.accepted_per_placed}) | ${row.unstable} | ${
        Object.entries(row.mistakes)
          .map(([kind, n]) => `${n} ${kind}`)
          .join(', ') || '-'
      } | ${row.check} | ${row.seconds}`,
    );
  }
}

const args = process.argv.slice(2);
const jobsAt = args.indexOf('--jobs');
const jobs = jobsAt >= 0 ? Math.max(1, Number(args[jobsAt + 1] ?? 1)) : 1;
const trace = args.includes('--trace');
const child = args.includes('--child');
const names = args.filter((a, i) => !a.startsWith('--') && (jobsAt < 0 || i !== jobsAt + 1));
const wanted = names.length > 0 ? names : standardLoadSpecs().map((s) => s.name);

if (child || (jobs === 1 && wanted.length === 1)) {
  const row = await generateOne(wanted[0] as string, trace);
  if (child) console.log(`ROW ${JSON.stringify(row)}`);
  else printTable([row]);
} else {
  const queue = [...wanted];
  const rows = new Map<string, SummaryRow>();
  const failures: string[] = [];
  const runNext = (): Promise<void> => {
    const name = queue.shift();
    if (name === undefined) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const proc = spawn(
        process.execPath,
        ['--import', 'tsx', fileURLToPath(import.meta.url), '--child', name],
        { cwd: join(here, '..'), stdio: ['ignore', 'pipe', 'inherit'] },
      );
      let out = '';
      proc.stdout.on('data', (chunk: Buffer) => {
        out += chunk.toString();
      });
      proc.on('close', (code) => {
        const line = out.split('\n').find((l) => l.startsWith('ROW '));
        if (code === 0 && line !== undefined) {
          rows.set(name, JSON.parse(line.slice(4)) as SummaryRow);
          console.error(`done ${name}`);
        } else {
          failures.push(name);
          console.error(`FAILED ${name} (exit ${code})`);
        }
        resolve();
      });
    }).then(runNext);
  };
  await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, runNext));
  const ordered = wanted.flatMap((name) => {
    const row = rows.get(name);
    return row === undefined ? [] : [row];
  });
  printTable(ordered);
  // Merge into the summary of the loads generated earlier.
  const summaryFile = join(loadsDir, 'SUMMARY.json');
  let known: SummaryRow[] = [];
  try {
    known = JSON.parse(readFileSync(summaryFile, 'utf8')) as SummaryRow[];
  } catch {
    known = [];
  }
  const merged = new Map(known.map((row) => [row.name, row]));
  for (const row of ordered) merged.set(row.name, row);
  const order = standardLoadSpecs().map((s) => s.name);
  writeFileSync(
    summaryFile,
    `${JSON.stringify(
      [...merged.values()].sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name)),
      null,
      1,
    )}\n`,
  );
  if (failures.length > 0) {
    console.error(`failed: ${failures.join(', ')}`);
    process.exit(1);
  }
}
