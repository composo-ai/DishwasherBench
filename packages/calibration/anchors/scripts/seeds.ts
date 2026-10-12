/**
 * Run-to-run scatter under a parameter set, of the load mean and of the verdict of every item:
 * the settled careful load washed at every combination of some level seeds (the soil layout,
 * the loading of every patch, the amount applied per item) and simulation seeds (the sampling
 * of the exposure), and, with `--fast`, at the fast tier against the official one.
 *
 *   pnpm --filter @spotless/calibration exec tsx anchors/scripts/seeds.ts
 *        [--params anchors/<current set>.json] [--set key=value,...] [--programme eco_50]
 *        [--level-seeds 1,2,3,4] [--sim-seeds 1,2,3,4] [--fast] [--out anchors/out/seeds]
 *
 * A verdict "flips" between two washes when the item is clean in one and not in the other. A
 * verdict that flips with the simulation seed is sampling noise of the water side, not a
 * property of the pose; one that flips with the level seed is the draw of the soil.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { washInputFromDescription, type ItemWashResult, type ParamValue } from '@spotless/sim-core';
import { createDiskExposureCache, washWithSource } from '@spotless/sim-core/node';
import { STANDARD_COMPOSITION } from '../src/literature.ts';
import { classMeans, type ClassMeans } from '../src/objective.ts';
import { stdEu13Description } from '../src/scenario.ts';
import { readOverrides } from '../src/sets.ts';
import { anchorCacheDir, waterSide, waterTag } from '../src/water.ts';

const origin = process.env['INIT_CWD'] ?? process.cwd();
const fromOrigin = (path: string): string => (isAbsolute(path) ? path : join(origin, path));
const args = process.argv.slice(2).filter((a) => a !== '--');
const option = (name: string): string | undefined => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const params: Record<string, ParamValue> = {};
const paramFile = option('--params');
if (paramFile !== undefined) Object.assign(params, readOverrides(fromOrigin(paramFile)));
for (const part of (option('--set') ?? '').split(',').filter((s) => s !== '')) {
  const at = part.indexOf('=');
  params[part.slice(0, at)] = Number(part.slice(at + 1));
}
const programme = option('--programme') ?? 'eco_50';
const levelSeeds = (option('--level-seeds') ?? '1,2,3,4').split(',').map(Number);
const simSeeds = (option('--sim-seeds') ?? '1,2,3,4').split(',').map(Number);
const withFast = args.includes('--fast');
const outDir = fromOrigin(option('--out') ?? 'anchors/out/seeds');
mkdirSync(outDir, { recursive: true });
const cache = createDiskExposureCache(anchorCacheDir());
const banner = `water side: ${waterSide().simVersion}, sources ${waterTag()} (${waterSide().files} files)`;
console.log(banner);

/** One wash: its seeds and tier, the class means and the items. */
interface Run {
  readonly levelSeed: number;
  readonly simSeed: number;
  readonly tier: 'official' | 'fast';
  readonly means: ClassMeans;
  readonly items: ReadonlyMap<string, Pick<ItemWashResult, 'score' | 'clean' | 'typeId'>>;
  readonly clean: number;
  readonly soiledClean: number;
}

async function run(levelSeed: number, simSeed: number, tier: 'official' | 'fast'): Promise<Run> {
  const description = stdEu13Description({
    load: 'iec-13-careful',
    programme,
    params,
    levelSeed,
    simSeed,
    tier,
  });
  const result = await washWithSource(washInputFromDescription(description), { cache });
  const soiled = result.items.filter((i) => i.initialMass_mg > 0);
  const made: Run = {
    levelSeed,
    simSeed,
    tier,
    means: classMeans(result.items, STANDARD_COMPOSITION),
    items: new Map(
      soiled.map((i) => [i.itemId, { score: i.score, clean: i.clean, typeId: i.typeId }]),
    ),
    clean: result.items.filter((i) => i.clean).length,
    soiledClean: soiled.filter((i) => i.clean).length,
  };
  console.error(
    `${tier}, level seed ${levelSeed}, simulation seed ${simSeed}: mean ${made.means.raw.all.toFixed(3)} (standard weights ${made.means.score.all.toFixed(3)}), clean ${made.clean}, soiled clean ${made.soiledClean} of ${soiled.length}; exposure ${result.run.exposureComputed} computed`,
  );
  return made;
}

const runs: Run[] = [];
for (const simSeed of simSeeds) {
  for (const levelSeed of levelSeeds) runs.push(await run(levelSeed, simSeed, 'official'));
}
const fast: Run[] = [];
if (withFast) {
  for (const simSeed of simSeeds.slice(0, 2)) {
    for (const levelSeed of levelSeeds.slice(0, 2))
      fast.push(await run(levelSeed, simSeed, 'fast'));
  }
}

const mean = (values: readonly number[]): number =>
  values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1);
const sd = (values: readonly number[]): number => {
  const m = mean(values);
  return Math.sqrt(
    values.reduce((a, b) => a + (b - m) * (b - m), 0) / Math.max(values.length - 1, 1),
  );
};

/** Items whose score, and whose verdict, differ between two washes. */
function differ(a: Run, b: Run): { scores: number; verdicts: number; flipped: string[] } {
  let scores = 0;
  const flipped: string[] = [];
  for (const [id, item] of a.items) {
    const other = b.items.get(id);
    if (other === undefined) continue;
    if (other.score !== item.score) scores++;
    if (other.clean !== item.clean) flipped.push(id);
  }
  return { scores, verdicts: flipped.length, flipped };
}

/** Pairs of runs that differ in one seed only, and what differs between them. */
function pairs(
  of: readonly Run[],
  same: (a: Run, b: Run) => boolean,
): { scores: number[]; verdicts: number[]; byItem: Map<string, number>; count: number } {
  const scores: number[] = [];
  const verdicts: number[] = [];
  const byItem = new Map<string, number>();
  for (let i = 0; i < of.length; i++) {
    for (let j = i + 1; j < of.length; j++) {
      const a = of[i] as Run;
      const b = of[j] as Run;
      if (!same(a, b)) continue;
      const d = differ(a, b);
      scores.push(d.scores);
      verdicts.push(d.verdicts);
      for (const id of d.flipped) byItem.set(id, (byItem.get(id) ?? 0) + 1);
    }
  }
  return { scores, verdicts, byItem, count: scores.length };
}

const soiledCount = runs[0]?.items.size ?? 0;
const bySim = pairs(runs, (a, b) => a.levelSeed === b.levelSeed && a.simSeed !== b.simSeed);
const byLevel = pairs(runs, (a, b) => a.simSeed === b.simSeed && a.levelSeed !== b.levelSeed);
/** Soiled items whose verdict is not the same in every wash of a group. */
const unstable = (groups: readonly (readonly Run[])[]): Map<string, number> => {
  const out = new Map<string, number>();
  for (const group of groups) {
    const first = group[0];
    if (first === undefined) continue;
    for (const [id, item] of first.items) {
      if (group.some((r) => r.items.get(id)?.clean !== item.clean)) {
        out.set(id, (out.get(id) ?? 0) + 1);
      }
    }
  }
  return out;
};
const perLevel = levelSeeds.map((l) => runs.filter((r) => r.levelSeed === l));
const perSim = simSeeds.map((s) => runs.filter((r) => r.simSeed === s));
const unstableBySim = unstable(perLevel);
const unstableByLevel = unstable(perSim);
const typeOf = (id: string): string => id.replace(/_\d+$/, '');
const byType = (ids: Iterable<string>): string => {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(typeOf(id), (counts.get(typeOf(id)) ?? 0) + 1);
  return (
    [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([type, n]) => `${type} ${n}`)
      .join(', ') || 'none'
  );
};

const lines: string[] = [];
lines.push(`# Run-to-run scatter (${programme}, careful load)`);
lines.push('');
lines.push(`${banner}.`);
lines.push('');
lines.push(
  '| Simulation seed | Level seed | Mean score | Mean, standard weights | Items clean | Soiled items clean | Crockery | Cutlery | Glass | Melamine |',
);
lines.push('|---|---|---|---|---|---|---|---|---|---|');
for (const r of runs) {
  lines.push(
    `| ${r.simSeed} | ${r.levelSeed} | ${r.means.raw.all.toFixed(3)} | ${r.means.score.all.toFixed(3)} | ${r.clean} | ${r.soiledClean} | ${(['crockery', 'cutlery', 'glass', 'melamine'] as const).map((c) => r.means.score[c].toFixed(2)).join(' | ')} |`,
  );
}
lines.push('');
const cls = (c: 'crockery' | 'cutlery' | 'glass' | 'melamine' | 'all'): string =>
  `${mean(runs.map((r) => r.means.score[c])).toFixed(2)} (${sd(runs.map((r) => r.means.score[c])).toFixed(2)})`;
lines.push(
  `Over the ${runs.length} washes, mean (standard deviation), standard weights: crockery ${cls('crockery')}, cutlery ${cls('cutlery')}, glass ${cls('glass')}, melamine ${cls('melamine')}, all ${cls('all')}; mean over the items of the load ${mean(runs.map((r) => r.means.raw.all)).toFixed(3)} (${sd(runs.map((r) => r.means.raw.all)).toFixed(3)}); items clean ${Math.min(...runs.map((r) => r.clean))} to ${Math.max(...runs.map((r) => r.clean))}; soiled items clean ${Math.min(...runs.map((r) => r.soiledClean))} to ${Math.max(...runs.map((r) => r.soiledClean))} of ${soiledCount} (mean ${mean(runs.map((r) => r.soiledClean)).toFixed(1)}).`,
);
const within = (groups: readonly (readonly Run[])[]): string =>
  mean(groups.map((g) => sd(g.map((r) => r.means.raw.all)))).toFixed(3);
lines.push(
  `Standard deviation of the load mean: ${within(perLevel)} over the simulation seed at one level seed, ${within(perSim)} over the level seed at one simulation seed. Published repeatability of the mean score: 0.09 (standards 7.1).`,
);
lines.push('');
lines.push('## Verdicts of single items');
lines.push('');
lines.push(
  '| What changes between two washes | Pairs | Scores that differ, of the soiled items (mean, range) | Verdicts that flip (mean, range) | Soiled items whose verdict is not the same at every seed |',
);
lines.push('|---|---|---|---|---|');
const range = (v: readonly number[]): string =>
  v.length === 0 ? 'n/a' : `${mean(v).toFixed(1)}, ${Math.min(...v)} to ${Math.max(...v)}`;
const perGroup = (of: ReadonlyMap<string, number>, groups: number, held: string): string =>
  `${([...of.values()].reduce((x, y) => x + y, 0) / Math.max(groups, 1)).toFixed(1)} of ${soiledCount} at one ${held} seed on average; ${of.size} distinct items over all (${byType(of.keys())})`;
lines.push(
  `| Simulation seed only | ${bySim.count} | ${range(bySim.scores)} of ${soiledCount} | ${range(bySim.verdicts)} | ${perGroup(unstableBySim, perLevel.length, 'level')} |`,
);
lines.push(
  `| Level seed only | ${byLevel.count} | ${range(byLevel.scores)} of ${soiledCount} | ${range(byLevel.verdicts)} | ${perGroup(unstableByLevel, perSim.length, 'simulation')} |`,
);
if (fast.length > 0) {
  const tierPairs = fast.map((f) => {
    const official = runs.find((r) => r.levelSeed === f.levelSeed && r.simSeed === f.simSeed);
    return official === undefined ? undefined : { f, official, d: differ(official, f) };
  });
  const got = tierPairs.filter((p): p is NonNullable<typeof p> => p !== undefined);
  lines.push(
    `| Tier (fast against official, same seeds) | ${got.length} | ${range(got.map((p) => p.d.scores))} of ${soiledCount} | ${range(got.map((p) => p.d.verdicts))} | ${byType(got.flatMap((p) => p.d.flipped))} |`,
  );
  lines.push('');
  lines.push(
    '| Level seed | Simulation seed | Official: mean, standard weights; soiled clean | Fast: mean, standard weights; soiled clean | Verdicts that agree |',
  );
  lines.push('|---|---|---|---|---|');
  for (const p of got) {
    lines.push(
      `| ${p.f.levelSeed} | ${p.f.simSeed} | ${p.official.means.raw.all.toFixed(3)}, ${p.official.means.score.all.toFixed(3)}; ${p.official.soiledClean} | ${p.f.means.raw.all.toFixed(3)}, ${p.f.means.score.all.toFixed(3)}; ${p.f.soiledClean} | ${soiledCount - p.d.verdicts} of ${soiledCount} (${((100 * (soiledCount - p.d.verdicts)) / Math.max(soiledCount, 1)).toFixed(0)} %) |`,
    );
  }
}
lines.push('');
lines.push(
  `Items that flip with the simulation seed, by how many of the ${perLevel.length} level seeds they flip at: ${
    [...unstableBySim.entries()]
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
      .map(([id, n]) => `${id} ${n}`)
      .join(', ') || 'none'
  }.`,
);
const text = `${lines.join('\n')}\n`;
writeFileSync(join(outDir, `seeds.${programme}.md`), text);
console.log(text);
