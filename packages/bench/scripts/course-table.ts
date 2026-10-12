/**
 * course-table: the levels of the course in their order, each with its difficulty, what the
 * four reference policies score on it, which items decide between the careful and the careless
 * load, how many verdicts sit at the edge of clean, how long the wash took, how far the fast
 * tier agrees with the official one, and whether the level passes the gates.
 *
 *   pnpm --filter @spotless/bench course-table                    the tables of the washes already made
 *   ... course-table --official <dir> --fast <dir>                wash summaries from elsewhere
 *   ... course-table --gates                                      exit 1 unless every level passes
 *   ... course-table --md <file> --json <file>
 *
 * It washes nothing: it reads the summaries `reference-table` wrote, one per saved reference
 * load (`.spotless/reference/official` and `.spotless/reference/fast` unless told otherwise),
 * and only those of the loads as they are saved now.
 *
 * The gates (`REFERENCE_GATES` of `../src/reference.ts`, judged on the official tier):
 *  - careful beats careless by at least a fifth of the points the level offers;
 *  - careless beats random, or is clearly different in kind;
 *  - a careful load cleans at least two thirds of what it loads;
 *  - no more than a tenth of the level's points rest on verdicts at the edge of clean;
 *  - a level that is not meant to fit whole leaves something on the counter;
 * and, of the course as a whole: the difficulty of the levels (`levelDifficulty` of
 * `@spotless/levels`) rises from each level to the next.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { allLevels, levelDifficulty } from '@spotless/levels';
import type { StandardLoad } from '@spotless/loader';
import type { ReferenceRow, ReferenceWash } from '../src/reference.ts';
import {
  mistakeCosts,
  REFERENCE_GATES,
  referenceFindings,
  referenceMargins,
  referenceRow,
} from '../src/reference.ts';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const LOADS_DIR = join(HERE, '..', '..', 'loader', 'loads');
const origin = process.env['INIT_CWD'] ?? process.cwd();
const fromOrigin = (path: string): string => (isAbsolute(path) ? path : join(origin, path));

const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== '--'),
  options: {
    official: { type: 'string' },
    fast: { type: 'string' },
    gates: { type: 'boolean' },
    md: { type: 'string' },
    json: { type: 'string' },
  },
});
const officialDir = fromOrigin(values.official ?? join(ROOT, '.spotless', 'reference', 'official'));
const fastDir = fromOrigin(values.fast ?? join(ROOT, '.spotless', 'reference', 'fast'));

const POLICIES = ['careful', 'careless', 'random'] as const;

/** The summary of a wash of the load as it is saved now, or why there is none. */
function washOf(dir: string, name: string, tier: string): ReferenceWash | string {
  const loadFile = join(LOADS_DIR, `${name}.json`);
  if (!existsSync(loadFile)) return 'no saved load';
  const file = join(dir, `${name}.wash.json`);
  if (!existsSync(file)) return 'not washed';
  const wash = JSON.parse(readFileSync(file, 'utf8')) as ReferenceWash;
  const load = JSON.parse(readFileSync(loadFile, 'utf8')) as StandardLoad;
  if (wash.load_state !== load.final_state_hash) return 'the load was generated again since';
  if (wash.tier !== tier) return `its summary is of the ${wash.tier} tier`;
  return wash;
}

const pct = (x: number): string => `${(x * 100).toFixed(1)} %`;

interface LevelEntry {
  readonly number: number;
  readonly level: string;
  readonly title: string;
  readonly new_here: string;
  readonly items: number;
  readonly points_available: number;
  readonly difficulty: ReturnType<typeof levelDifficulty>;
  readonly rows: { readonly [policy: string]: ReferenceRow };
  readonly sim_version: string | null;
  /** Careful less careless, points by the verdict, and as a share of the points on offer. */
  readonly careful_over_careless: number | null;
  readonly careful_over_careless_share: number | null;
  /** The same the hard way round (careful strict, careless lenient): what the gate judges. */
  readonly margin_share: number | null;
  /** Items clean in the careful load and not in the careless one, by the mistake charged. */
  readonly deciding: readonly { kind: string; made: number; items: string[]; points: number }[];
  /** Loaded items at the edge of clean, per policy, and the most points resting on them. */
  readonly undecided: { readonly [policy: string]: number };
  readonly undecided_points_max: number;
  /** Wall-clock seconds of the official washes, per policy. */
  readonly seconds: { readonly [policy: string]: number };
  /** Verdicts the fast tier gives as the official tier does, of loaded items, per policy. */
  readonly fast_agreement: { readonly [policy: string]: { same: number; of: number } };
  readonly fast_points: { readonly [policy: string]: number };
  readonly findings: readonly { gate: string; message: string }[];
  readonly missing: readonly string[];
}

const entries: LevelEntry[] = [];
let before = 0;
const courseFindings: string[] = [];
for (const level of allLevels()) {
  const difficulty = levelDifficulty(level);
  const available = level.items.reduce((sum, item) => sum + item.points, 0);
  const missing: string[] = [];
  const official = new Map<string, ReferenceWash>();
  const fast = new Map<string, ReferenceWash>();
  for (const policy of POLICIES) {
    const name = `${level.id}-${policy}`;
    const o = washOf(officialDir, name, 'official');
    if (typeof o === 'string') missing.push(`${name} (official): ${o}`);
    else official.set(policy, o);
    const f = washOf(fastDir, name, 'fast');
    if (typeof f === 'string') missing.push(`${name} (fast): ${f}`);
    else fast.set(policy, f);
  }
  const rows: { [policy: string]: ReferenceRow } = {};
  const first = official.get('careful') ?? official.get('careless') ?? official.get('random');
  if (first !== undefined) {
    rows['empty'] = referenceRow({
      ...first,
      policy: 'empty',
      items: first.items.map((item) => ({
        item_id: item.item_id,
        points: item.points,
        loaded: false,
      })),
      mistakes: [],
    });
  }
  for (const policy of POLICIES) {
    const wash = official.get(policy);
    if (wash !== undefined) rows[policy] = referenceRow(wash);
  }
  const ordered = ['empty', ...POLICIES].flatMap((policy) =>
    rows[policy] === undefined ? [] : [rows[policy] as ReferenceRow],
  );
  const findings =
    ordered.length === 0
      ? [{ gate: 'washes', message: 'no official reference wash of the level as it is saved now' }]
      : referenceFindings(ordered).map(({ gate, message }) => ({ gate, message }));
  const margins = ordered.length === 0 ? null : referenceMargins(ordered);
  const careful = official.get('careful');
  const careless = official.get('careless');
  const deciding =
    careful === undefined || careless === undefined
      ? []
      : mistakeCosts(careful, careless)
          .filter((cost) => cost.points_lost > 0 || cost.made > 0)
          .map((cost) => ({
            kind: cost.kind,
            made: cost.made,
            items: [...cost.lost_items],
            points: cost.points_lost - cost.points_gained,
          }));
  const undecided: { [policy: string]: number } = {};
  const seconds: { [policy: string]: number } = {};
  const agreement: { [policy: string]: { same: number; of: number } } = {};
  const fastPoints: { [policy: string]: number } = {};
  let undecidedMax = 0;
  for (const policy of POLICIES) {
    const wash = official.get(policy);
    if (wash === undefined) continue;
    undecided[policy] = rows[policy]?.edge ?? 0;
    undecidedMax = Math.max(undecidedMax, rows[policy]?.edge_points ?? 0);
    seconds[policy] = wash.seconds;
    const other = fast.get(policy);
    if (other === undefined) continue;
    const verdicts = new Map(other.items.map((item) => [item.item_id, item.clean === true]));
    let same = 0;
    let of = 0;
    for (const item of wash.items) {
      if (!item.loaded) continue;
      of += 1;
      if (verdicts.get(item.item_id) === (item.clean === true)) same += 1;
    }
    agreement[policy] = { same, of };
    fastPoints[policy] = referenceRow(other).points;
  }
  if (difficulty.difficulty <= before) {
    courseFindings.push(
      `${level.id}: difficulty ${difficulty.difficulty} does not rise over the level before it (${before})`,
    );
  }
  before = difficulty.difficulty;
  const gap =
    rows['careful'] === undefined || rows['careless'] === undefined
      ? null
      : rows['careful'].points - rows['careless'].points;
  entries.push({
    number: level.number ?? entries.length + 1,
    level: level.id,
    title: level.title,
    new_here: level.newHere ?? '',
    items: level.items.length,
    points_available: available,
    difficulty,
    rows,
    sim_version: first?.sim_version ?? null,
    careful_over_careless: gap,
    careful_over_careless_share: gap === null ? null : gap / available,
    margin_share: margins?.careful_over_careless?.of_level ?? null,
    deciding,
    undecided,
    undecided_points_max: undecidedMax,
    seconds,
    fast_agreement: agreement,
    fast_points: fastPoints,
    findings,
    missing,
  });
}

const out: string[] = [];
const cell = (row: ReferenceRow | undefined): string =>
  row === undefined ? '-' : `${row.points} (${pct(row.share)})`;
out.push('The course, official tier:\n');
out.push(
  '| # | Level | Items | Points | Difficulty | choice / punishing / tenacity / awkward | Empty | Random | Careless | Careful | Careful less careless | the hard way round (gate 20 %) | Gates |',
);
out.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const entry of entries) {
  const d = entry.difficulty;
  out.push(
    `| ${entry.number} | ${entry.level} | ${entry.items} | ${entry.points_available} | ${d.difficulty.toFixed(1)} | ${d.choice.toFixed(2)} / ${d.punishing.toFixed(2)} / ${d.tenacity.toFixed(2)} / ${d.awkward.toFixed(2)} | ${entry.rows['empty'] === undefined ? '-' : '0'} | ${cell(entry.rows['random'])} | ${cell(entry.rows['careless'])} | ${cell(entry.rows['careful'])} | ${entry.careful_over_careless === null ? '-' : `${entry.careful_over_careless} (${pct(entry.careful_over_careless_share ?? 0)})`} | ${entry.margin_share === null ? '-' : pct(entry.margin_share)} | ${entry.findings.length === 0 ? 'passes' : entry.findings.map((f) => f.gate).join(', ')} |`,
  );
}
out.push('');
out.push('Clean of loaded, verdicts at the edge of clean, wall time and the fast tier:\n');
out.push(
  '| # | Level | Careful: clean of loaded, loaded of offered | Careless | Random | At the edge (careful / careless / random) | Most points at the edge | Wash, seconds (careful / careless / random) | Fast tier: same verdicts (careful / careless / random) | Fast tier: points (careful / careless / random) |',
);
out.push('|---|---|---|---|---|---|---|---|---|---|');
const three = (of: { readonly [policy: string]: unknown }, show: (value: never) => string): string =>
  POLICIES.map((policy) => (of[policy] === undefined ? '-' : show(of[policy] as never))).join(
    ' / ',
  );
for (const entry of entries) {
  const loaded = (policy: string): string => {
    const row = entry.rows[policy];
    return row === undefined
      ? '-'
      : `${row.clean} of ${row.loaded}, ${row.loaded} of ${row.offered}`;
  };
  out.push(
    `| ${entry.number} | ${entry.level} | ${loaded('careful')} | ${loaded('careless')} | ${loaded('random')} | ${three(entry.undecided, (n: number) => String(n))} | ${entry.undecided_points_max} of ${entry.points_available} (${pct(entry.undecided_points_max / entry.points_available)}) | ${three(entry.seconds, (s: number) => String(Math.round(s)))} | ${three(entry.fast_agreement, (a: { same: number; of: number }) => `${a.same} of ${a.of}`)} | ${three(entry.fast_points, (p: number) => String(p))} |`,
  );
}
out.push('');
out.push('What decides between the careful and the careless load (items clean in the careful load and not in the careless one, by the mistake they are charged to):\n');
out.push('| # | Level | Mistake | Made | Items that lost their points | Points lost |');
out.push('|---|---|---|---|---|---|');
for (const entry of entries) {
  for (const cost of entry.deciding) {
    out.push(
      `| ${entry.number} | ${entry.level} | ${cost.kind} | ${cost.made} | ${cost.items.join(', ') || '-'} | ${cost.points} |`,
    );
  }
}
out.push('');
out.push('What is new in each level:\n');
for (const entry of entries) out.push(`${entry.number}. ${entry.title}: ${entry.new_here}`);
out.push('');
const failing = entries.filter((entry) => entry.findings.length > 0);
if (failing.length === 0 && courseFindings.length === 0) {
  out.push('Every level passes the gates, and the difficulty rises along the course.\n');
} else {
  out.push('Gates not passed:\n');
  for (const entry of failing) {
    for (const finding of entry.findings) {
      out.push(`- ${entry.level}, ${finding.gate}: ${finding.message}`);
    }
  }
  for (const line of courseFindings) out.push(`- course: ${line}`);
  out.push('');
}
const versions = [...new Set(entries.map((entry) => entry.sim_version).filter(Boolean))];
out.push(`Washed with: ${versions.join(' | ') || 'nothing'}\n`);
const text = out.join('\n');
console.log(text);
const missing = entries.flatMap((entry) => entry.missing);
for (const line of missing) console.error(`missing: ${line}`);
if (values.md !== undefined) writeFileSync(fromOrigin(values.md), text);
if (values.json !== undefined) {
  writeFileSync(
    fromOrigin(values.json),
    `${JSON.stringify({ gates: REFERENCE_GATES, levels: entries, course: courseFindings, missing }, null, 1)}\n`,
  );
}
if (values.gates === true && (failing.length > 0 || courseFindings.length > 0)) process.exit(1);
if (values.gates === true && missing.some((line) => line.includes('(official)'))) process.exit(1);
process.exit(0);
