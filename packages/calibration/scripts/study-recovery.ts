/**
 * Study: recovery (docs/calibration/fitting.md section 9.1).
 *
 *   pnpm --filter @spotless/calibration study:recovery [a] [b] [c] [--seeds n]
 *   pnpm --filter @spotless/calibration study:recovery cover [--seeds n] [--first k] [--shares 10,50,90]
 *
 * Synthetic records are drawn from the simulator with parameters moved away from their
 * defaults and with observation noise, and fitted from the defaults. For each case the table
 * says whether the truth lies inside the stated 95 % interval of every fitted parameter.
 *
 *   a  one soil class on test tiles at ten positions, with observations at three door openings
 *   b  the same tiles observed at the end only, with a parameter the tiles cannot identify
 *   c  a realistic mixed load: the 114-item lattice with typical soils, 12 items scored,
 *      photographed and weighed
 *
 *   cover  coverage across the registered ranges: the tiles of case a with the truth of every
 *      fitted parameter at 10 %, 50 % and 90 % of its range (in the coordinate it is fitted
 *      in), 20 noise seeds each by default. Coverage is reported per truth and per parameter,
 *      not pooled, for the interval the fit reports (the profile's) and for the normal one.
 *      The fits use the defaults of `fitRecords` (three polished starts, three profiles);
 *      `--economy` uses one polished start, one restart and no profiles, which is what not to
 *      do where the soil barely comes off. `--first k` starts at seed k and `--shares` picks
 *      the truths, so that the study can be split over processes; each fit also prints a line
 *      starting with COVER.
 */

import {
  createCalibrationParams,
  EvaluatorPool,
  fitParameters,
  fitRecords,
  fmt,
  fromZ,
  synthesiseRecord,
  textTable,
  type FitResult,
  type WashRecord,
} from '../src/index.ts';
import { diskExposureCache } from '../src/node/index.ts';
import { fullLoadRecord, STUDY_CACHE, tenTiles } from './study-loads.ts';

const args = process.argv.slice(2);
const cases = ['a', 'b', 'c', 'cover'].filter((c) => args.includes(c));
const run = cases.length === 0 ? ['a', 'b', 'c'] : cases;
const valueOf = (name: string): string | undefined => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const seeds = Number(valueOf('--seeds') ?? (run.includes('cover') ? 20 : 3));
const firstSeed = Number(valueOf('--first') ?? 1);
const shares = (valueOf('--shares') ?? '10,50,90').split(',').map(Number);
const economy = args.includes('--economy');
const coverProfiles = Number(valueOf('--profiles') ?? (economy ? 0 : 3));
const cache = diskExposureCache(STUDY_CACHE);
const summary: string[][] = [
  [
    'case',
    'seed',
    'parameter',
    'default',
    'truth',
    'estimate',
    '95 % interval',
    'truth inside',
    'off by (sd)',
    'post/prior sd',
    'verdict',
  ],
];

async function recover(
  label: string,
  plan: WashRecord,
  truth: Record<string, number>,
  keys: string[],
  seed: number,
  options: {
    profiles?: number;
    draws?: number;
    starts?: number;
    polish?: number;
    restrict?: 'all';
    maxEvaluations?: number;
    restarts?: number;
    scan?: number;
    quiet?: boolean;
  } = {},
): Promise<FitResult> {
  const pool = new EvaluatorPool({
    cache,
    ...(options.restrict === undefined ? {} : { restrict: options.restrict }),
  });
  const record = await synthesiseRecord(plan, createCalibrationParams(truth), {
    seed,
    pool,
    id: `${plan.id}-seed${seed}`,
  });
  const start = performance.now();
  const fit = await fitRecords([record], keys, {
    pool,
    seed,
    starts: options.starts ?? 4,
    polish: options.polish ?? 1,
    profiles: options.profiles ?? 0,
    predictiveDraws: options.draws ?? 0,
    scanPoints: options.scan ?? 0,
    ...(options.maxEvaluations === undefined ? {} : { maxEvaluations: options.maxEvaluations }),
    ...(options.restarts === undefined ? {} : { restarts: options.restarts }),
    onProgress: (message) => console.error(`  [${label} seed ${seed}] ${message}`),
  });
  console.log(
    `\n===== case ${label}, noise seed ${seed}: ${record.observations.length} observations, ${fit.computed} replays in ${((performance.now() - start) / 1000).toFixed(0)} s =====`,
  );
  if (options.quiet !== true) console.log(fit.report.split('\nfit to each observation')[0]);
  for (const p of fit.parameters) {
    const t = truth[p.key] ?? p.default;
    const inside = p.interval[0] <= t && t <= p.interval[1];
    const zTruth =
      p.transform === 'log' ? Math.log(t) : p.transform === 'logit' ? Math.log(t / (1 - t)) : t;
    summary.push([
      label,
      String(seed),
      p.id,
      fmt(p.default),
      fmt(t),
      fmt(p.estimate, 4),
      `${fmt(p.interval[0])} .. ${fmt(p.interval[1])}`,
      inside ? 'yes' : 'NO',
      p.sd > 0 ? ((p.z - zTruth) / p.sd).toFixed(2) : '-',
      p.shrink.toFixed(2),
      p.status,
    ]);
  }
  return fit;
}

const EGG_TRUTH = {
  'soil.egg_yolk.rateRef': 5.0e-5,
  'liq.proteaseHalfLife': 3600,
  'soil.egg_yolk.tLag': 300,
};

if (run.includes('a')) {
  // Ten egg-yolk tiles, the residue weighed and photographed at 25, 40 and 60 min and at the end.
  const plan = tenTiles({
    id: 'recovery-a',
    disc_mm: 30,
    amount_g: 0.076,
    kinds: ['mass_fraction', 'area_fraction'],
    at_s: [1500, 2400, 3600],
    interruptedKinds: ['mass_fraction', 'area_fraction'],
  });
  for (let seed = 1; seed <= seeds; seed++) {
    await recover(
      'a: tiles, interrupted',
      plan,
      EGG_TRUTH,
      Object.keys(EGG_TRUTH),
      seed,
      seed === 1 ? { profiles: 3, draws: 20, polish: 3, scan: 24 } : {},
    );
  }
}

if (run.includes('b')) {
  // The same tiles and the same truth, observed at the end only; and a parameter of another
  // soil class (the bleaching of tea), about which egg-yolk tiles say nothing.
  const plan = tenTiles({
    id: 'recovery-b',
    disc_mm: 30,
    amount_g: 0.076,
    kinds: ['mass_fraction', 'area_fraction'],
  });
  for (let seed = 1; seed <= Math.min(seeds, 2); seed++) {
    await recover(
      'b: tiles, end only',
      plan,
      EGG_TRUTH,
      [...Object.keys(EGG_TRUTH), 'soil.bleachRate'],
      seed,
      seed === 1 ? { profiles: 2, draws: 20 } : {},
    );
  }
}

if (run.includes('c')) {
  // The lattice of 114 items with the typical soils of each; every tenth item is scored by
  // eye, photographed and weighed (12 items: plates, cutlery, glasses, a saucer). Truth moved
  // in two soil classes and in the enzyme's life. At the registry defaults every item of this
  // load scores 0, so the scores say little; the photographs and the balance carry the fit.
  // A replay of the 12 items takes seconds, so the search is given a fixed budget.
  const plan = fullLoadRecord({
    id: 'recovery-c',
    kinds: ['score', 'area_fraction', 'mass_fraction'],
    observe: (_, i) => i % 10 === 0,
  });
  const truth = {
    'soil.egg_yolk.rateRef': 6.0e-5,
    'soil.starch.rateRef': 5.0e-5,
    'liq.proteaseHalfLife': 5400,
  };
  await recover('c: mixed load', plan, truth, Object.keys(truth), 1, {
    starts: 0,
    polish: 0,
    maxEvaluations: 120,
    restarts: 1,
  });
}

if (run.includes('cover')) {
  // Coverage across the registered ranges: the design of case a (20 mm discs, to keep a
  // replay short), the truth of all three parameters at the same share of their ranges.
  const keys = Object.keys(EGG_TRUTH);
  const parameters = fitParameters(keys);
  const plan = tenTiles({
    id: 'recovery-cover',
    disc_mm: 20,
    amount_g: 0.034,
    kinds: ['mass_fraction', 'area_fraction'],
    at_s: [1500, 2400, 3600],
    interruptedKinds: ['mass_fraction', 'area_fraction'],
  });
  const table: string[][] = [
    [
      'truth at',
      'parameter',
      'truth',
      'inside 95 % interval',
      'coverage',
      'inside the normal interval',
      'returned to prior',
      'at a bound',
      'mean off (sd)',
    ],
  ];
  for (const share of shares) {
    const truth: Record<string, number> = {};
    parameters.forEach((p) => {
      truth[p.key] = fromZ(p, p.lower + (share / 100) * (p.upper - p.lower));
    });
    const counts = parameters.map(() => ({
      inside: 0,
      normal: 0,
      returned: 0,
      bound: 0,
      off: 0,
      n: 0,
    }));
    for (let seed = firstSeed; seed < firstSeed + seeds; seed++) {
      const fit = await recover(`cover ${share} %`, plan, truth, keys, seed, {
        starts: 4,
        polish: economy ? 1 : 3,
        ...(economy ? { restarts: 1 } : {}),
        profiles: coverProfiles,
        quiet: true,
      });
      fit.parameters.forEach((p, j) => {
        const t = truth[p.key] as number;
        const inside = p.interval[0] <= t && t <= p.interval[1];
        const insideNormal = p.normalInterval[0] <= t && t <= p.normalInterval[1];
        const zTruth = p.transform === 'log' ? Math.log(t) : t;
        const c = counts[j] as (typeof counts)[number];
        c.n++;
        if (inside) c.inside++;
        if (insideNormal) c.normal++;
        if (p.returnedPrior) c.returned++;
        if (p.atBound !== null) c.bound++;
        c.off += p.sd > 0 ? (p.z - zTruth) / p.sd : 0;
        console.log(
          [
            'COVER',
            share,
            seed,
            p.id,
            fmt(t, 4),
            fmt(p.estimate, 4),
            fmt(p.interval[0], 4),
            fmt(p.interval[1], 4),
            inside ? 1 : 0,
            p.returnedPrior ? 1 : 0,
            p.atBound ?? '-',
            (p.sd > 0 ? (p.z - zTruth) / p.sd : 0).toFixed(3),
            p.shrink.toFixed(3),
            fit.computed,
            p.intervalFrom,
            insideNormal ? 1 : 0,
            p.status,
          ].join('\t'),
        );
      });
    }
    parameters.forEach((p, j) => {
      const c = counts[j] as (typeof counts)[number];
      table.push([
        `${share} % of the range`,
        p.id,
        fmt(truth[p.key] as number),
        `${c.inside} of ${c.n}`,
        c.n > 0 ? (c.inside / c.n).toFixed(2) : '-',
        `${c.normal} of ${c.n}`,
        String(c.returned),
        String(c.bound),
        c.n > 0 ? (c.off / c.n).toFixed(2) : '-',
      ]);
    });
  }
  console.log('\n===== coverage across the registered ranges =====');
  console.log(textTable(table, [2, 4, 6, 7, 8]));
}

console.log('\n===== recovery summary =====');
console.log(textTable(summary, [1, 3, 4, 5, 8, 9]));
const fitted = summary.slice(1).filter((row) => !row[10]?.startsWith('not identified'));
const inside = fitted.filter((row) => row[7] === 'yes').length;
console.log(
  `\n${inside} of ${fitted.length} identified or weakly identified parameters have the truth inside their 95 % interval; ` +
    `${summary.length - 1 - fitted.length} were not identified and returned to their priors.`,
);
