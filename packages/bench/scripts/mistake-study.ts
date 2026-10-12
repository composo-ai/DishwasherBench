/**
 * mistake-study: what each kind of loading mistake costs on a level, one kind at a time.
 *
 *   pnpm --filter @spotless/bench mistake-study --level tutorial
 *   pnpm --filter @spotless/bench mistake-study --level breakfast --kinds bowls_nested,cup_upright
 *   ... mistake-study --level tutorial --tier official --jobs 3 --out .spotless/mistakes/official
 *   ... mistake-study --level tutorial --table-only
 *
 * The sanity suite of paired loads that docs/research/benchmark.md section 5.7 asks for
 * ("recommended practice against the corresponding malpractice, same items"): for every kind
 * of mistake the careless policy knows (`MISTAKE_KINDS` of `@spotless/loader`), the careful
 * reference load of the level with that one kind of mistake made on it, washed, and compared
 * item by item with the careful load itself. A pair holds the same items in the same places
 * but for the mistake, so what the mistaken load loses is what the mistake costs. The two
 * mistakes that act on the whole machine (a blocked tablet, a stopped arm), which the careless
 * reference policy does not make, are measured here.
 *
 * Each load is generated in a process of its own (the careless policy plays the whole careful
 * load first, then its mistake) and saved under `<out>/loads/`; each wash runs in a process of
 * its own, at most two at a time. A kind that could not be made on the level (no item it can be
 * made with, or the physics did not leave it standing) is listed as not made.
 *
 * Printed: per kind how many mistakes the load holds, the items they are charged with, which of
 * them lost their points, and the points lost. Exits 1 when a load or a wash failed.
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { allLevels } from '@spotless/levels';
import type { MistakeKind, StandardLoad } from '@spotless/loader';
import {
  MACHINE_MISTAKE_KINDS,
  MISTAKE_KINDS,
  generateStandardLoad,
  referenceSeed,
} from '@spotless/loader';
import type { WashTier } from '@spotless/session';
import type { ReferenceWash } from '../src/reference.ts';
import { mistakeCosts, referenceRow } from '../src/reference.ts';
import { washSummary } from './wash-summary.ts';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const LOADS_DIR = join(HERE, '..', '..', 'loader', 'loads');
const ROOT = join(HERE, '..', '..', '..');
const origin = process.env['INIT_CWD'] ?? process.cwd();
const fromOrigin = (path: string): string => (isAbsolute(path) ? path : join(origin, path));

const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== '--'),
  options: {
    level: { type: 'string' },
    kinds: { type: 'string' },
    tier: { type: 'string', default: 'fast' },
    out: { type: 'string' },
    cache: { type: 'string' },
    jobs: { type: 'string', default: '4' },
    'table-only': { type: 'boolean' },
    json: { type: 'string' },
    md: { type: 'string' },
    'child-generate': { type: 'string' },
    'child-wash': { type: 'string' },
  },
});
if (values.tier !== 'fast' && values.tier !== 'official') {
  console.error(`'${values.tier}' is not a wash tier (official, fast)`);
  process.exit(2);
}
const tier: WashTier = values.tier;
const level = allLevels().find((candidate) => candidate.id === values.level);
if (level === undefined) {
  console.error(
    `--level names a level of the game (${allLevels()
      .map((l) => l.id)
      .join(', ')})`,
  );
  process.exit(2);
}
const outDir = fromOrigin(values.out ?? join(ROOT, '.spotless', 'mistakes', tier));
const cacheDir = fromOrigin(values.cache ?? join(ROOT, '.spotless', 'reference', 'exposure-cache'));
const loadsOut = join(outDir, 'loads');
const kinds = (
  values.kinds === undefined
    ? [...MISTAKE_KINDS]
    : values.kinds.split(',').map((part) => part.trim())
).filter((kind): kind is MistakeKind => (MISTAKE_KINDS as readonly string[]).includes(kind));
const nameOf = (kind: string): string => `${level.id}-only-${kind}`;

/** Writes a load as JSON with one event of the action log per line (as the loader saves its own). */
function save(load: StandardLoad, file: string): void {
  const { action_log: log, ...rest } = load;
  const head = JSON.stringify(rest, null, 1);
  const events = log.map((event) => JSON.stringify(event)).join(',\n');
  writeFileSync(
    file,
    `${head.slice(0, head.lastIndexOf('}'))},\n "action_log": [\n${events}\n]\n}\n`,
  );
}

if (values['child-generate'] !== undefined) {
  const kind = values['child-generate'] as MistakeKind;
  const { load, session } = await generateStandardLoad({
    name: nameOf(kind),
    description: `Level '${level.title}': the careful load with the mistake '${kind}' made on it.`,
    level,
    policy: 'careless',
    seed: referenceSeed(level, 1),
    mistakes: [kind],
  });
  session.dispose();
  mkdirSync(loadsOut, { recursive: true });
  save(load, join(loadsOut, `${nameOf(kind)}.json`));
  console.error(
    `${nameOf(kind)}: ${load.placed.length} placed, ${load.mistakes.filter((m) => m.kind === kind).length} of the kind in the load`,
  );
  process.exit(0);
}

if (values['child-wash'] !== undefined) {
  const file = values['child-wash'];
  const load = JSON.parse(readFileSync(file, 'utf8')) as StandardLoad;
  const summary = await washSummary(load, level, {
    tier,
    cacheDir,
    params: 'machine-default',
    acceptStaleParams: false,
  });
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, `${load.name}.wash.json`), `${JSON.stringify(summary, null, 1)}\n`);
  const row = referenceRow(summary);
  console.error(`${load.name}: ${row.points} of ${row.points_available} in ${summary.seconds} s`);
  process.exit(0);
}

/** Runs the tasks in child processes, `jobs` at a time; returns the names of those that failed. */
async function runAll(
  tasks: readonly { readonly name: string; readonly args: readonly string[] }[],
  jobs: number,
): Promise<string[]> {
  const queue = [...tasks];
  const failed: string[] = [];
  const base = ['--level', level?.id ?? '', '--tier', tier, '--out', outDir, '--cache', cacheDir];
  const next = (): Promise<void> => {
    const task = queue.shift();
    if (task === undefined) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const child = spawn(
        process.execPath,
        ['--import', 'tsx', fileURLToPath(import.meta.url), ...base, ...task.args],
        { cwd: join(HERE, '..'), stdio: ['ignore', 'ignore', 'pipe'] },
      );
      let err = '';
      child.stderr.on('data', (chunk: Buffer) => {
        err += chunk.toString();
      });
      child.on('close', (code) => {
        if (code === 0) console.error(err.trim().split('\n').slice(-1)[0] ?? '');
        else {
          failed.push(task.name);
          console.error(`FAILED ${task.name}: ${err.trim().split('\n').slice(-4).join(' | ')}`);
        }
        resolve();
      });
    }).then(next);
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(jobs, queue.length)) }, next));
  return failed;
}

const carefulFile = join(LOADS_DIR, `${level.id}-careful.json`);
if (!existsSync(carefulFile)) {
  console.error(`no saved careful load of '${level.id}': generate its reference loads first`);
  process.exit(1);
}
const failures: string[] = [];
if (values['table-only'] !== true) {
  const jobs = Number.parseInt(values.jobs, 10) || 4;
  failures.push(
    ...(await runAll(
      kinds.map((kind) => ({ name: nameOf(kind), args: ['--child-generate', kind] })),
      jobs,
    )),
  );
  failures.push(
    ...(await runAll(
      [
        { name: `${level.id}-careful`, args: ['--child-wash', carefulFile] },
        ...kinds
          .filter((kind) => existsSync(join(loadsOut, `${nameOf(kind)}.json`)))
          .map((kind) => ({
            name: nameOf(kind),
            args: ['--child-wash', join(loadsOut, `${nameOf(kind)}.json`)],
          })),
      ],
      2,
    )),
  );
}

const read = (name: string): ReferenceWash | null => {
  const file = join(outDir, `${name}.wash.json`);
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as ReferenceWash) : null;
};
const careful = read(`${level.id}-careful`);
if (careful === null) {
  console.error('the careful load was not washed');
  process.exit(1);
}
const carefulRow = referenceRow(careful);
const lines = [
  `Level ${level.id}, ${tier} tier: the careful load scores ${carefulRow.points} of ${carefulRow.points_available} (${carefulRow.clean} of ${carefulRow.loaded} loaded items clean).`,
  '',
  '| Mistake | Acts on | Made | Items it is charged with | Items that lost their points | Points lost | Points the rest of the load lost | Load scores |',
  '|---|---|---|---|---|---|---|---|',
];
const table: unknown[] = [];
for (const kind of kinds) {
  const wash = read(nameOf(kind));
  if (wash === null) {
    lines.push(`| ${kind} | - | not generated | - | - | - | - | - |`);
    continue;
  }
  const costs = mistakeCosts(careful, wash);
  const own = costs.find((cost) => cost.kind === kind);
  const others = costs.filter((cost) => cost.kind !== kind);
  const row = referenceRow(wash);
  const made = wash.mistakes.filter((mistake) => mistake.kind === kind).length;
  const otherKinds = [...new Set(wash.mistakes.map((m) => m.kind).filter((k) => k !== kind))];
  table.push({ kind, made, points: row.points, costs });
  lines.push(
    `| ${kind} | ${MACHINE_MISTAKE_KINDS.includes(kind) ? 'the machine' : 'the item'} | ${made === 0 ? 'not made' : made}${otherKinds.length === 0 ? '' : ` (settled as ${otherKinds.join(', ')})`} | ${own?.items.length ?? 0} | ${own?.lost_items.join(', ') || '-'} | ${own?.points_lost ?? 0} | ${others.reduce((sum, cost) => sum + cost.points_lost - cost.points_gained, 0)} | ${row.points} of ${row.points_available} |`,
  );
}
const text = `${lines.join('\n')}\n`;
console.log(text);
if (values.md !== undefined) writeFileSync(fromOrigin(values.md), text);
if (values.json !== undefined) {
  writeFileSync(
    fromOrigin(values.json),
    `${JSON.stringify({ level: level.id, tier, careful: carefulRow, kinds: table }, null, 1)}\n`,
  );
}
if (failures.length > 0) {
  console.error(`failed: ${failures.join(', ')}`);
  process.exit(1);
}
process.exit(0);
