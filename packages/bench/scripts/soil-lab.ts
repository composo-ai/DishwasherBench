/**
 * soil-lab: washes saved reference loads with other soils on their pieces, poses unchanged, to
 * learn which soil answers to which mistake of the hand before a level is drawn with it.
 *
 *   pnpm --filter @spotless/bench exec tsx scripts/soil-lab.ts --spec <spec.json> \
 *        --loads breakfast-careful,breakfast-careless --shift 0 --out <dir> [--tier fast]
 *
 * The spec is a list of rules, the first that matches an item's catalogue type wins:
 *
 *   [{ "match": "plate", "variants": [[["tomato_sauce", {"well": 0.5}]], [["avocado", {"well": 0.3}, 1]]] }]
 *
 * A variant is the list of soils one piece gets, each `[soil id, {region: coverage}, relative
 * thickness?, hours since the meal?, heat history?]` (defaults 1, 2 hours, the soil's usual
 * history); the amount is the soil's working loading on the covered area (`typicalAmountG`).
 * The n-th piece of a kind in the level gets variant `(n - 1 + shift) mod variants`, so a
 * second run with `--shift 1` puts every soil on the next piece and, over as many runs as there
 * are variants, every soil has stood in every place and under every mistake of the load.
 * Items no rule matches keep the soils of the level.
 *
 * `--accept-stale-params` washes with a default set whose stored hashes are stale (while the
 * set is being made current again; such a lab wash is provisional).
 *
 * `--with key=value[,key=value]` lays those values over the machine's default set (to see
 * which soils answer to a parameter the anchoring has not settled); `--tag <word>` is put into
 * the names of the files written; `--loads-dir <dir>` reads the saved loads from elsewhere (a
 * copy of loads that have since been generated again).
 *
 * A lab wash is not a wash of a level: nothing it writes is read by a test or a table. It
 * reuses the exposure cache of the reference table (the water of a load does not depend on its
 * soils), so a load that has been washed before costs only the soil replay.
 */

import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import type { Level, LevelSoil } from '@spotless/levels';
import { typicalAmountG, usualHeatHistory } from '@spotless/levels';
import type { StandardLoad } from '@spotless/loader';
import type { WashParamChoice } from '@spotless/wash-runner/contract';
import { defaultsWith } from './param-layer.ts';
import { washSummary } from './wash-summary.ts';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const origin = process.env['INIT_CWD'] ?? process.cwd();
const fromOrigin = (path: string): string => (isAbsolute(path) ? path : join(origin, path));

type SoilSpec = readonly [
  type: string,
  regions: Record<string, number>,
  relative?: number,
  ageH?: number,
  heatHistory?: LevelSoil['heatHistory'],
];
interface LabRule {
  /** A regular expression tested against the catalogue type of an item. */
  readonly match: string;
  readonly variants: readonly (readonly SoilSpec[])[];
}

const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== '--'),
  options: {
    spec: { type: 'string' },
    loads: { type: 'string' },
    shift: { type: 'string', default: '0' },
    tier: { type: 'string', default: 'fast' },
    out: { type: 'string' },
    cache: { type: 'string' },
    jobs: { type: 'string', default: '2' },
    with: { type: 'string' },
    'accept-stale-params': { type: 'boolean' },
    'loads-dir': { type: 'string' },
    tag: { type: 'string', default: '' },
    child: { type: 'string' },
  },
});
if (values.spec === undefined || values.out === undefined) {
  console.error('soil-lab: --spec <file> and --out <dir> are required');
  process.exit(2);
}
if (values.tier !== 'fast' && values.tier !== 'official') {
  console.error(`'${values.tier}' is not a wash tier (official, fast)`);
  process.exit(2);
}
const tier = values.tier;
const shift = Number.parseInt(values.shift, 10) || 0;
const outDir = fromOrigin(values.out);
const LOADS_DIR =
  values['loads-dir'] === undefined
    ? join(HERE, '..', '..', 'loader', 'loads')
    : fromOrigin(values['loads-dir']);
const cacheDir = fromOrigin(values.cache ?? join(ROOT, '.spotless', 'reference', 'exposure-cache'));
const rules = JSON.parse(readFileSync(fromOrigin(values.spec), 'utf8')) as LabRule[];

/** The level of a load with the lab's soils on the pieces the rules match. */
function labLevel(load: StandardLoad): { level: Level; assigned: Map<string, string> } {
  const seen = new Map<number, number>();
  const assigned = new Map<string, string>();
  const items = load.level.items.map((item) => {
    const index = rules.findIndex((rule) => new RegExp(rule.match).test(item.itemType));
    const rule = rules[index];
    if (rule === undefined || rule.variants.length === 0) return item;
    const nth = seen.get(index) ?? 0;
    seen.set(index, nth + 1);
    const variant = rule.variants[(nth + shift) % rule.variants.length] as readonly SoilSpec[];
    const soils: LevelSoil[] = variant.map(([type, regions, relative, ageH, heatHistory]) => ({
      type,
      regions: Object.keys(regions).map((region) => ({
        region,
        coverage: regions[region] as number,
      })),
      amountG: typicalAmountG(item.itemType, { type, regions, ageH: ageH ?? 2 }, relative ?? 1),
      ageH: ageH ?? 2,
      heatHistory: heatHistory ?? usualHeatHistory(type),
    }));
    assigned.set(
      item.id,
      variant
        .map(
          ([type, , relative, ageH, heat]) =>
            `${type}${relative === undefined || relative === 1 ? '' : `x${relative}`}@${ageH ?? 2}h${heat === undefined ? '' : `/${heat}`}`,
        )
        .join('+'),
    );
    return { ...item, soils };
  });
  return { level: { ...load.level, items }, assigned };
}

async function washOne(name: string): Promise<void> {
  const load = JSON.parse(readFileSync(join(LOADS_DIR, `${name}.json`), 'utf8')) as StandardLoad;
  const { level, assigned } = labLevel(load);
  const params: WashParamChoice =
    values.with === undefined
      ? 'machine-default'
      : defaultsWith(
          level.machineId,
          `lab-${values.tag}`,
          values.with,
          Object.fromEntries(
            values.with.split(',').map((pair) => {
              const [key, value] = pair.split('=') as [string, string];
              return [key.trim(), Number(value)];
            }),
          ),
          join(outDir, 'sets', `${values.tag === '' ? 'with' : values.tag}.${process.pid}.json`),
        );
  const summary = await washSummary(load, level, {
    tier,
    cacheDir,
    params,
    acceptStaleParams: values['accept-stale-params'] === true,
    notes: [`soil lab, shift ${shift}: not a wash of the level`],
  });
  const types = new Map(level.items.map((item) => [item.id, item.itemType]));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, `${name}.s${shift}${values.tag === '' ? '' : `.${values.tag}`}.lab.json`),
    `${JSON.stringify(
      {
        ...summary,
        shift,
        tag: values.tag,
        items: summary.items.map((item) => ({
          ...item,
          item_type: types.get(item.item_id),
          lab: assigned.get(item.item_id) ?? null,
        })),
      },
      null,
      1,
    )}\n`,
  );
  const loaded = summary.items.filter((item) => item.loaded);
  console.error(
    `${name} shift ${shift}: ${loaded.filter((item) => item.clean === true).length} of ${loaded.length} clean in ${summary.seconds} s`,
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

const queue = (values.loads ?? '')
  .split(',')
  .map((part) => part.trim())
  .filter((part) => part !== '');
const jobs = Math.max(1, Math.min(2, Number.parseInt(values.jobs, 10) || 2));
let failed = 0;
const passed = process.argv
  .slice(2)
  .filter(
    (arg, i, all) =>
      arg !== '--' && !['--loads', '--jobs'].some((own) => arg === own || all[i - 1] === own),
  );
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
      if (code !== 0) failed += 1;
      console.error(
        code === 0
          ? (err.trim().split('\n').slice(-1)[0] ?? '')
          : `FAILED ${name}: ${err.trim().split('\n').slice(-4).join('\n')}`,
      );
      resolve();
    });
  }).then(next);
};
await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, next));
process.exit(failed === 0 ? 0 : 1);
