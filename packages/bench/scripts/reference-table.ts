/**
 * reference-table: what the scripted reference policies score on every level, and what each
 * mistake of the careless load costs.
 *
 *   pnpm --filter @spotless/bench reference-table                      every level, fast tier
 *   pnpm --filter @spotless/bench reference-table --levels tutorial,weeknight-dinner
 *   ... reference-table --tier official --jobs 1 --out .spotless/reference/official
 *   ... reference-table --table-only --out <dir>                       the table of washes already made
 *   ... reference-table --by-soil                                      and the verdicts soil by soil
 *   ... reference-table --params registry-defaults | --accept-stale-params
 *
 * For every level it washes the saved reference loads of `@spotless/loader`
 * (`packages/loader/loads/<level>-careful|careless|random.json`), each in a process of its own
 * and at most `--jobs` at a time (default 2: the machine is shared), with the parameters the
 * game washes with, and writes one summary per wash into `--out` (default
 * `.spotless/reference/<tier>`). The empty policy needs no wash: it scores zero.
 *
 * A load is washed with the level as it is defined now (soils, points, programme) when that
 * still names the same items of the same types as the load was made with: the poses are those
 * of the saved load. A level whose items have changed since must have its loads generated
 * again (`pnpm --filter @spotless/loader generate-loads`); the script says so and exits 1.
 *
 * Printed: the table (points, share, strict to lenient, clean of loaded, loaded of offered,
 * items at the edge of clean and provisional), the gates each level fails
 * (`REFERENCE_GATES`), and per level what each kind of mistake cost. Exits 1 when a wash failed
 * or (with `--gates`) when a level fails a gate.
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import type { Level } from '@spotless/levels';
import { allLevels } from '@spotless/levels';
import type { StandardLoad } from '@spotless/loader';
import { standardLevels } from '@spotless/loader';
import type { WashTier } from '@spotless/session';
import type { WashParamChoice } from '@spotless/wash-runner/contract';
import type {
  MistakeCost,
  ReferenceMargins,
  ReferenceRow,
  ReferenceWash,
} from '../src/reference.ts';
import {
  marginsMarkdown,
  mistakeCostMarkdown,
  mistakeCosts,
  REFERENCE_GATES,
  referenceFindings,
  referenceMargins,
  referenceMarkdown,
  referenceRow,
} from '../src/reference.ts';
import { washSummary } from './wash-summary.ts';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const LOADS_DIR = join(HERE, '..', '..', 'loader', 'loads');
const ROOT = join(HERE, '..', '..', '..');
const origin = process.env['INIT_CWD'] ?? process.cwd();
const fromOrigin = (path: string): string => (isAbsolute(path) ? path : join(origin, path));

const POLICIES = ['careful', 'careless', 'random'] as const;

const { values, positionals } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== '--'),
  options: {
    levels: { type: 'string' },
    tier: { type: 'string', default: 'fast' },
    out: { type: 'string' },
    cache: { type: 'string' },
    jobs: { type: 'string', default: '2' },
    params: { type: 'string', default: 'machine-default' },
    'accept-stale-params': { type: 'boolean' },
    'saved-level': { type: 'boolean' },
    'table-only': { type: 'boolean' },
    'by-soil': { type: 'boolean' },
    gates: { type: 'boolean' },
    json: { type: 'string' },
    md: { type: 'string' },
    child: { type: 'string' },
  },
  allowPositionals: true,
});
if (values.tier !== 'fast' && values.tier !== 'official') {
  console.error(`'${values.tier}' is not a wash tier (official, fast)`);
  process.exit(2);
}
if (values.params !== 'machine-default' && values.params !== 'registry-defaults') {
  console.error(`--params is machine-default or registry-defaults, not '${values.params}'`);
  process.exit(2);
}
const tier: WashTier = values.tier;
const params: WashParamChoice = values.params;
const outDir = fromOrigin(values.out ?? join(ROOT, '.spotless', 'reference', tier));
const cacheDir = fromOrigin(values.cache ?? join(ROOT, '.spotless', 'reference', 'exposure-cache'));

/** Every level a reference load may be of, by id: the game's and the loader's standard ones. */
function levelsById(): Map<string, Level> {
  const out = new Map<string, Level>();
  for (const level of standardLevels()) out.set(level.id, level);
  for (const level of allLevels()) out.set(level.id, level);
  return out;
}

function readLoad(name: string): StandardLoad {
  return JSON.parse(readFileSync(join(LOADS_DIR, `${name}.json`), 'utf8')) as StandardLoad;
}

/** The level a load is washed with, or why the current one cannot be used. */
function levelFor(load: StandardLoad): { level: Level; changed: boolean } | string {
  if (values['saved-level'] === true) return { level: load.level, changed: false };
  const current = levelsById().get(load.level.id);
  if (current === undefined) return { level: load.level, changed: false };
  const types = new Map(current.items.map((item) => [item.id, item.itemType]));
  for (const item of load.level.items) {
    if (types.get(item.id) !== item.itemType) {
      return `the level '${current.id}' no longer has ${item.id} as a ${item.itemType}: generate its loads again`;
    }
  }
  if (current.items.length !== load.level.items.length) {
    return `the level '${current.id}' has ${current.items.length} items and the load was made with ${load.level.items.length}: generate its loads again`;
  }
  if (current.config !== null || load.level.config !== null) {
    if (JSON.stringify(current.config) !== JSON.stringify(load.level.config)) {
      return `the level '${current.id}' starts with another configuration of the machine: generate its loads again`;
    }
  }
  return { level: current, changed: JSON.stringify(current) !== JSON.stringify(load.level) };
}

/** Washes one saved load and writes its summary. The child process of the driver. */
async function washOne(name: string): Promise<void> {
  // A wash that fails must leave a gap and not the answer of an earlier run.
  rmSync(join(outDir, `${name}.wash.json`), { force: true });
  const load = readLoad(name);
  const chosen = levelFor(load);
  if (typeof chosen === 'string') throw new Error(chosen);
  const summary = await washSummary(load, chosen.level, {
    tier,
    cacheDir,
    params,
    acceptStaleParams: values['accept-stale-params'] === true,
    notes: chosen.changed
      ? ['washed with the level as it is defined now, not as the load was saved with']
      : [],
  });
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, `${name}.wash.json`), `${JSON.stringify(summary, null, 1)}\n`);
  const row = referenceRow(summary);
  console.error(
    `${name}: ${row.points} of ${row.points_available} (${row.clean} of ${row.loaded} clean) in ${summary.seconds} s`,
  );
}

if (values.child !== undefined) {
  try {
    await washOne(values.child);
    process.exit(0);
  } catch (error) {
    console.error(`${values.child}: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------------------------
// The driver
// ---------------------------------------------------------------------------------------------

const wantedLevels =
  values.levels === undefined
    ? allLevels().map((level) => level.id)
    : values.levels
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part !== '');
const names =
  positionals.length > 0
    ? positionals
    : wantedLevels.flatMap((level) => POLICIES.map((policy) => `${level}-${policy}`));
const missing = names.filter((name) => !existsSync(join(LOADS_DIR, `${name}.json`)));
const present = names.filter((name) => !missing.includes(name));
for (const name of missing) console.error(`no saved load ${name}: skipped`);

const failed: string[] = [];
if (values['table-only'] !== true) {
  const queue = [...present];
  const jobs = Math.max(1, Math.min(2, Number.parseInt(values.jobs, 10) || 2));
  const passed = process.argv.slice(2).filter((arg, i, all) => {
    if (arg === '--') return false;
    if (positionals.includes(arg)) return false;
    // The driver's own options do not go to a child.
    for (const own of ['--levels', '--jobs', '--json', '--md']) {
      if (arg === own || all[i - 1] === own) return false;
    }
    return !['--table-only', '--by-soil', '--gates'].includes(arg);
  });
  const next = (): Promise<void> => {
    const name = queue.shift();
    if (name === undefined) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const child = spawn(
        process.execPath,
        ['--import', 'tsx', fileURLToPath(import.meta.url), ...passed, '--child', name],
        { cwd: join(HERE, '..'), stdio: ['ignore', 'ignore', 'pipe'] },
      );
      let err = '';
      child.stderr.on('data', (chunk: Buffer) => {
        err += chunk.toString();
      });
      child.on('close', (code) => {
        const last = err.trim().split('\n').slice(-1)[0] ?? '';
        if (code === 0) console.error(last);
        else {
          failed.push(name);
          console.error(
            `FAILED ${name} (exit ${code}): ${err.trim().split('\n').slice(-6).join('\n')}`,
          );
        }
        resolve();
      });
    }).then(next);
  };
  await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, next));
}

// The summaries to table: only those of the loads as they are saved now. A summary of a load
// that has been generated again since it was washed is of another load and is left out, and
// a named load without a current summary makes the table incomplete: an incomplete table is
// printed for the eye and never written to the files that tests and documents read.
const washes: ReferenceWash[] = [];
const incomplete: string[] = [...missing.map((name) => `${name}: no saved load`)];
for (const name of present) {
  const file = join(outDir, `${name}.wash.json`);
  if (!existsSync(file)) {
    incomplete.push(`${name}: not washed`);
    continue;
  }
  const wash = JSON.parse(readFileSync(file, 'utf8')) as ReferenceWash;
  if (wash.load_state !== readLoad(name).final_state_hash) {
    incomplete.push(`${name}: the load was generated again after it was washed`);
    continue;
  }
  if (wash.tier !== tier) {
    incomplete.push(`${name}: its summary is of the ${wash.tier} tier`);
    continue;
  }
  washes.push(wash);
}
const order = [...new Set(washes.map((wash) => wash.level))];
const rows: ReferenceRow[] = [];
const margins: ReferenceMargins[] = [];
const costs: { level: string; costs: MistakeCost[] }[] = [];
const findings: { level: string; gate: string; message: string }[] = [];
for (const level of order) {
  const ofLevel = washes.filter((wash) => wash.level === level);
  const first = ofLevel[0] as ReferenceWash;
  const levelRows = [
    // The empty machine: nothing loaded, nothing washed, no points.
    referenceRow({
      ...first,
      policy: 'empty',
      items: first.items.map((item) => ({
        item_id: item.item_id,
        points: item.points,
        loaded: false,
      })),
      mistakes: [],
    }),
    ...POLICIES.flatMap((policy) => {
      const wash = ofLevel.find((candidate) => candidate.policy === policy);
      return wash === undefined ? [] : [referenceRow(wash)];
    }),
  ];
  rows.push(...levelRows);
  findings.push(...referenceFindings(levelRows));
  const levelMargins = referenceMargins(levelRows);
  if (levelMargins !== null) margins.push(levelMargins);
  const careful = ofLevel.find((wash) => wash.policy === 'careful');
  const careless = ofLevel.find((wash) => wash.policy === 'careless');
  if (careful !== undefined && careless !== undefined) {
    costs.push({ level, costs: mistakeCosts(careful, careless) });
  }
}

const out: string[] = [];
out.push(referenceMarkdown(rows));
out.push(
  'The margins the gates judge (a policy read by the strictest eye against the next read by the most lenient):\n',
);
out.push(marginsMarkdown(margins));
if (findings.length > 0) {
  out.push('Gates not passed:\n');
  for (const finding of findings)
    out.push(`- ${finding.level}, ${finding.gate}: ${finding.message}`);
  out.push('');
} else if (rows.length > 0) out.push('Every level passes the gates.\n');
out.push('What the mistakes of the careless loads cost:\n');
for (const entry of costs) out.push(mistakeCostMarkdown(entry.level, entry.costs));

if (values['by-soil'] === true) {
  const bySoil = new Map<
    string,
    { cls: string; policy: string; n: number; clean: number; edge: number; left: number }
  >();
  for (const wash of washes) {
    for (const item of wash.items) {
      if (!item.loaded) continue;
      for (const soil of item.soils ?? []) {
        const key = `${soil.type}|${wash.policy}`;
        const entry = bySoil.get(key) ?? {
          cls: soil.model_class,
          policy: wash.policy,
          n: 0,
          clean: 0,
          edge: 0,
          left: 0,
        };
        entry.n += 1;
        if (item.clean === true) entry.clean += 1;
        if (item.decided === false) entry.edge += 1;
        entry.left += soil.left;
        bySoil.set(key, entry);
      }
    }
  }
  out.push('Items by the soil they carry (an item with two soils is counted under each):\n');
  out.push(
    '| Soil | Model class | Policy | Items | Clean | At the edge | Mean share of the soil left |',
  );
  out.push('|---|---|---|---|---|---|---|');
  for (const key of [...bySoil.keys()].sort()) {
    const entry = bySoil.get(key) as NonNullable<ReturnType<typeof bySoil.get>>;
    out.push(
      `| ${key.split('|')[0]} | ${entry.cls} | ${entry.policy} | ${entry.n} | ${entry.clean} | ${entry.edge} | ${((entry.left / entry.n) * 100).toFixed(2)} % |`,
    );
  }
  out.push('');
}
const text = out.join('\n');
console.log(text);
const whole = failed.length === 0 && incomplete.length === 0;
if (!whole) {
  for (const line of incomplete) console.error(`incomplete: ${line}`);
  if (values.md !== undefined || values.json !== undefined) {
    console.error('the table above is incomplete: --md and --json were not written');
  }
}
if (whole && values.md !== undefined) writeFileSync(fromOrigin(values.md), text);
if (whole && values.json !== undefined) {
  writeFileSync(
    fromOrigin(values.json),
    `${JSON.stringify(
      {
        tier,
        gates: REFERENCE_GATES,
        rows,
        margins,
        findings,
        costs,
        washes: washes.map((wash) => ({
          load: wash.load,
          load_state: wash.load_state,
          sim_version: wash.sim_version,
          result_hash: wash.result_hash,
          seconds: wash.seconds,
        })),
      },
      null,
      1,
    )}\n`,
  );
}
if (failed.length > 0) {
  console.error(`washes failed: ${failed.join(', ')}`);
  process.exit(1);
}
// A table that lacks a load it was asked for, or was asked for one whose wash is of another
// load, is not the table that was asked for.
if (incomplete.length > 0) process.exit(1);
if (values.gates === true && findings.length > 0) process.exit(1);
process.exit(0);
