/**
 * robustness: how far the score of a level's careful and careless reference loads moves with
 * the seed of the wash and with the parameters the anchoring names as least certain.
 *
 *   pnpm --filter @spotless/bench robustness --levels lunch-for-four,breakfast,dinner-party \
 *        [--tier official] [--seeds 2] [--cases <cases.json>] [--out <dir>] [--table-only]
 *        [--accept-stale-params]
 *
 * For each level it washes the two saved loads
 *  - as the game does (the case `base`: the level's seed, the machine's default parameters),
 *  - with `--seeds` further seeds of the wash's own sampling (the cases `seed-2`, `seed-3`, ...;
 *    each is a new exposure, so at the official tier each costs a whole wash), and
 *  - with each parameter case: the default set with some values replaced (the water of a load
 *    does not depend on them when they are of the soil group, so these reuse the exposure of
 *    `base`), or another set file.
 *
 * The default cases are both ends of the two parameters the calibration on the owner's first
 * test wash leaves least certain for the soils the levels carry
 * (docs/calibration/owner-wash-01-calibration.md section 5):
 *  - `prog.soakDuty`, the share of Eco's soak in which the pump runs: 0.8 in the set, 95 %
 *    profile interval 0.59 to 1 (confounded with the capsule's protease, which the same two
 *    cases therefore cover);
 *  - `soil.supplyExchange`, what a film left standing on a soil can take up before it is
 *    spent, which is what turning a plate to the wall costs: 0.02 in the set, not identified
 *    by the wash (0.005 to 0.08 lie within 0.63 log units).
 * The bleach rate, the third open value, moves tea, coffee and wine only, which no level
 * carries. Another list of cases is given with `--cases`.
 *
 * Printed per level: every case with the two scores, the margin, and against `base` how many
 * verdicts and points moved in each load; then whether the ranking of careful against careless
 * holds in every case. A level whose ranking can flip is not fit for the benchmark.
 *
 * Nothing here is a wash of the game: the summaries go to `--out`
 * (default `.spotless/robustness/<tier>`) and no test reads them.
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { allLevels } from '@spotless/levels';
import type { StandardLoad } from '@spotless/loader';
import type { WashTier } from '@spotless/session';
import { MACHINE_WASH_DEFAULTS } from '@spotless/wash-runner/contract';
import type { WashParamChoice } from '@spotless/wash-runner/contract';
import type { ReferenceWash } from '../src/reference.ts';
import { referenceRow } from '../src/reference.ts';
import type { RobustnessCase } from '../src/robustness.ts';
import { robustnessMarkdown, robustnessOfLevel } from '../src/robustness.ts';
import { defaultsWith } from './param-layer.ts';
import { washSummary } from './wash-summary.ts';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const LOADS_DIR = join(HERE, '..', '..', 'loader', 'loads');
const ROOT = join(HERE, '..', '..', '..');
const origin = process.env['INIT_CWD'] ?? process.cwd();
const fromOrigin = (path: string): string => (isAbsolute(path) ? path : join(origin, path));

/** A parameter case: values laid over the machine's default set, or another set file. */
interface ParamCase {
  readonly name: string;
  /** What the case is, for the table. */
  readonly what: string;
  /** Values laid over the default set (`param-layer.ts`). */
  readonly overrides?: Readonly<Record<string, number>>;
  /** A set file used instead of the default (relative to `packages/`). */
  readonly set?: string;
}

const DEFAULT_CASES: readonly ParamCase[] = [
  {
    name: 'soak-0.59',
    what: 'soak duty 0.59 (lower end of the interval the calibration on the owner\'s wash 01 gives; the set has 0.8)',
    overrides: { 'prog.soakDuty': 0.59 },
  },
  {
    name: 'soak-1.0',
    what: 'soak duty 1 (circulation throughout; the upper end)',
    overrides: { 'prog.soakDuty': 1 },
  },
  {
    name: 'exchange-0.005',
    what: 'supply exchange 0.005 (turning a plate costs less; lower end of what the wash allows; the set has 0.02)',
    overrides: { 'soil.supplyExchange': 0.005 },
  },
  {
    name: 'exchange-0.08',
    what: 'supply exchange 0.08 (upper end of what the wash allows)',
    overrides: { 'soil.supplyExchange': 0.08 },
  },
];

const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== '--'),
  options: {
    levels: { type: 'string' },
    tier: { type: 'string', default: 'official' },
    seeds: { type: 'string', default: '2' },
    cases: { type: 'string' },
    only: { type: 'string' },
    out: { type: 'string' },
    cache: { type: 'string' },
    jobs: { type: 'string', default: '2' },
    'table-only': { type: 'boolean' },
    'accept-stale-params': { type: 'boolean' },
    md: { type: 'string' },
    json: { type: 'string' },
    child: { type: 'string' },
  },
});
if (values.tier !== 'fast' && values.tier !== 'official') {
  console.error(`'${values.tier}' is not a wash tier (official, fast)`);
  process.exit(2);
}
const tier: WashTier = values.tier;
const outDir = fromOrigin(values.out ?? join(ROOT, '.spotless', 'robustness', tier));
const cacheDir = fromOrigin(values.cache ?? join(ROOT, '.spotless', 'reference', 'exposure-cache'));
const extraSeeds = Math.max(0, Number.parseInt(values.seeds, 10) || 0);
const paramCases: readonly ParamCase[] =
  values.cases === undefined
    ? DEFAULT_CASES
    : (JSON.parse(readFileSync(fromOrigin(values.cases), 'utf8')) as ParamCase[]);
const levels = (values.levels ?? '')
  .split(',')
  .map((part) => part.trim())
  .filter((part) => part !== '');
if (levels.length === 0 && values.child === undefined) {
  console.error('robustness: --levels a,b,c is required');
  process.exit(2);
}

/** Every case of the study, in the order of the table: base, the seeds, the parameters. */
const CASES: readonly RobustnessCase[] = [
  { name: 'base', what: 'as the game washes it', kind: 'base' } satisfies RobustnessCase,
  ...Array.from({ length: extraSeeds }, (_, i): RobustnessCase => ({
    name: `seed-${i + 2}`,
    what: `another seed of the wash (${i + 2})`,
    kind: 'seed',
  })),
  ...paramCases.map((entry): RobustnessCase => ({
    name: entry.name,
    what: entry.what,
    kind: 'params',
  })),
].filter((entry) => values.only === undefined || values.only.split(',').includes(entry.name));

/** The parameters of a case: the default, another set file, or the default with a layer written beside the summaries. */
function paramsOf(name: string, machineId: string): WashParamChoice {
  const entry = paramCases.find((candidate) => candidate.name === name);
  if (entry === undefined) return 'machine-default';
  const base = MACHINE_WASH_DEFAULTS[machineId];
  if (base === undefined) {
    throw new Error(`the machine ${machineId} has no default parameter set to vary`);
  }
  if (entry.set !== undefined) return { ...base, paramSets: [entry.set] };
  return defaultsWith(
    machineId,
    entry.name,
    entry.what,
    entry.overrides ?? {},
    join(outDir, 'sets', `${entry.name}.json`),
  );
}

const summaryFile = (load: string, name: string): string =>
  join(outDir, `${load}.${name}.wash.json`);

async function washOne(spec: string): Promise<void> {
  const [loadName, caseName] = spec.split('@') as [string, string];
  const load = JSON.parse(
    readFileSync(join(LOADS_DIR, `${loadName}.json`), 'utf8'),
  ) as StandardLoad;
  const level = allLevels().find((candidate) => candidate.id === load.level.id) ?? load.level;
  const seedMatch = /^seed-(\d+)$/.exec(caseName);
  const summary = await washSummary(load, level, {
    tier,
    cacheDir,
    params: paramsOf(caseName, level.machineId),
    acceptStaleParams: values['accept-stale-params'] === true,
    notes: [`robustness study, case ${caseName}`],
    // The game's own seed for every case but the seed cases, which take whole numbers far
    // from anything a level's seed derives.
    ...(seedMatch === null ? {} : { simSeed: 7_000_000 + Number(seedMatch[1]) }),
  });
  mkdirSync(outDir, { recursive: true });
  writeFileSync(summaryFile(loadName, caseName), `${JSON.stringify(summary, null, 1)}\n`);
  const row = referenceRow(summary);
  console.error(
    `${loadName} ${caseName}: ${row.points} of ${row.points_available} (${row.clean} of ${row.loaded} clean) in ${summary.seconds} s`,
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

const POLICIES = ['careful', 'careless'] as const;
let failed = 0;
if (values['table-only'] !== true) {
  // The base case of every load first: the parameter cases reuse its exposure.
  const queue: string[] = [];
  for (const kind of ['base', 'seed', 'params'] as const) {
    for (const entry of CASES.filter((candidate) => candidate.kind === kind)) {
      for (const level of levels) {
        for (const policy of POLICIES) {
          const spec = `${level}-${policy}@${entry.name}`;
          if (!existsSync(summaryFile(`${level}-${policy}`, entry.name))) queue.push(spec);
        }
      }
    }
  }
  const jobs = Math.max(1, Math.min(2, Number.parseInt(values.jobs, 10) || 2));
  const passed = process.argv.slice(2).filter((arg, i, all) => {
    if (arg === '--') return false;
    for (const own of ['--levels', '--jobs', '--md', '--json', '--only']) {
      if (arg === own || all[i - 1] === own) return false;
    }
    return arg !== '--table-only';
  });
  const next = (): Promise<void> => {
    const spec = queue.shift();
    if (spec === undefined) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const child = spawn(
        process.execPath,
        ['--import', 'tsx', fileURLToPath(import.meta.url), ...passed, '--child', spec],
        { cwd: join(HERE, '..'), stdio: ['ignore', 'ignore', 'pipe'] },
      );
      let err = '';
      child.stderr.on('data', (chunk: Buffer) => {
        err += chunk.toString();
      });
      child.on('close', (code) => {
        if (code !== 0) failed += 1;
        console.error(
          code === 0
            ? (err.trim().split('\n').slice(-1)[0] ?? '')
            : `FAILED ${spec} (exit ${code}): ${err.trim().split('\n').slice(-6).join('\n')}`,
        );
        resolve();
      });
    }).then(next);
  };
  await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, next));
}

const read = (load: string, name: string): ReferenceWash | null => {
  const file = summaryFile(load, name);
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as ReferenceWash) : null;
};
const results = levels.map((level) =>
  robustnessOfLevel(
    level,
    CASES.map((entry) => ({
      ...entry,
      careful: read(`${level}-careful`, entry.name),
      careless: read(`${level}-careless`, entry.name),
    })),
  ),
);
const markdown = robustnessMarkdown(results);
console.log(markdown);
if (values.md !== undefined) writeFileSync(fromOrigin(values.md), markdown);
if (values.json !== undefined) {
  writeFileSync(fromOrigin(values.json), `${JSON.stringify({ tier, levels: results }, null, 1)}\n`);
}
process.exit(failed === 0 ? 0 : 1);
