/**
 * wash-load: washes one saved standard load of `@spotless/loader` through the wash runner,
 * exactly as the game server's wash worker would, and prints the report in short.
 *
 *   pnpm --filter @spotless/wash-runner run wash-load <name | path/to/load.json>
 *        [--tier fast|official] [--cache <dir> | --no-cache] [--timings <file>]
 *        [--out <report.json>] [--residue <dir>] [--json] [--accept-stale-params]
 *
 * Where the water goes is kept between washes in `.spotless/exposure-cache` at the root of the
 * repository (`--cache` names another directory, `--no-cache` none), so that a second wash of
 * a load takes seconds. The load is washed on the programme its level names, Eco 50, and the
 * first line printed says so. `--accept-stale-params` washes with a parameter set made for another state of the
 * simulator (the report then says so).
 *
 * `<name>` is a file of `packages/loader/loads` without `.json` (for example
 * `tutorial-careful`). With `--json` the last line printed is one JSON object with the
 * statistics of the run, for `measure.ts`; with `--residue` the residue maps are written one
 * file per item.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import type { StandardLoad } from '@spotless/loader';
import type { WashManifest, WashTier } from '@spotless/session';
import { runWash } from '../src/runner.ts';

const LOADS_DIR = fileURLToPath(new URL('../../loader/loads', import.meta.url));
/** Where the exposure of washed loads is kept unless the caller says otherwise. */
const DEFAULT_CACHE = fileURLToPath(new URL('../../../.spotless/exposure-cache', import.meta.url));
// pnpm runs a package script in the package directory and keeps the caller's in INIT_CWD.
const origin = process.env['INIT_CWD'] ?? process.cwd();
const fromOrigin = (path: string): string => (isAbsolute(path) ? path : join(origin, path));

const { values, positionals } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== '--'),
  options: {
    tier: { type: 'string', default: 'fast' },
    cache: { type: 'string' },
    'no-cache': { type: 'boolean' },
    'accept-stale-params': { type: 'boolean' },
    timings: { type: 'string' },
    out: { type: 'string' },
    residue: { type: 'string' },
    json: { type: 'boolean' },
  },
  allowPositionals: true,
});
const name = positionals[0];
if (name === undefined || (values.tier !== 'fast' && values.tier !== 'official')) {
  console.error(
    'usage: wash-load <name | load.json> [--tier fast|official] [--cache <dir> | --no-cache] [--timings <file>] [--out <report.json>] [--residue <dir>] [--json] [--accept-stale-params]',
  );
  process.exit(2);
}
const tier: WashTier = values.tier;
const named = join(LOADS_DIR, `${name}.json`);
const file = existsSync(named) ? named : fromOrigin(name);
const load = JSON.parse(readFileSync(file, 'utf8')) as StandardLoad;
const programme = load.wash_manifest.programme_id;
// A saved load keeps the mechanical check beside its manifest; the session now puts it inside.
const manifest: WashManifest = {
  ...load.wash_manifest,
  level: load.level,
  prechecks: load.wash_manifest.prechecks ?? load.check,
};
const cacheDir =
  values['no-cache'] === true
    ? undefined
    : values.cache === undefined
      ? DEFAULT_CACHE
      : fromOrigin(values.cache);
console.error(
  `washing ${load.name} on ${programme}` +
    ` at the ${tier} tier; exposure ${cacheDir === undefined ? 'not kept' : `kept in ${cacheDir}`}`,
);

let lastStage = '';
const outcome = await runWash(manifest, {
  tier,
  // The clock of the process, so that the time to load the simulation is counted.
  startedAt: 0,
  ...(cacheDir === undefined ? {} : { exposureCacheDir: cacheDir }),
  ...(values['accept-stale-params'] === true ? { acceptStaleParams: true } : {}),
  ...(values.timings === undefined ? {} : { timingsFile: fromOrigin(values.timings) }),
  onDetail: (detail) => {
    const key = `${detail.stage.stage} ${detail.stage.label}`;
    if (key === lastStage && detail.stage.fraction < 1) return;
    lastStage = key;
    console.error(
      `  ${String(Math.round(detail.fraction * 100)).padStart(3)} %  ` +
        `${detail.stage.index}/${detail.stage.count} ${detail.stage.label} ` +
        `(${Math.round(detail.stage.fraction * 100)} %), ` +
        `${detail.stage.elapsed_s.toFixed(1)} s in, about ${detail.stage.eta_s?.toFixed(0) ?? '?'} s to go`,
    );
  },
});

const { report, stats } = outcome;
console.error(
  `${load.name} at the ${tier} tier: ${report.score.points} of ${report.score.points_available} points ` +
    `(${report.score.points_loaded ?? 0} loaded), graded ${report.score.graded_points.toFixed(1)}`,
);
for (const item of report.items) {
  if (!item.loaded) continue;
  console.error(
    `  ${item.clean ? 'clean    ' : 'NOT CLEAN'} ${item.item_id.padEnd(22)} score ${item.score_iec} ` +
      `${String(item.points_awarded).padStart(3)} pt  cells ${String(item.residue_cells).padStart(6)}  ` +
      `${item.reason ?? ''}`,
  );
}
for (const note of report.job.notes ?? []) console.error(`  note: ${note}`);
console.error(
  `stages: ${Object.entries(stats.stage_s)
    .map(([stage, s]) => `${stage} ${s.toFixed(2)} s`)
    .join(', ')}; total ${stats.total_s.toFixed(1)} s; ` +
    `peak RSS ${stats.peak_rss_mb} MB; GPU buffers ${stats.gpu_buffers_mb ?? '?'} MB; ` +
    `${stats.blocks} blocks, ${stats.soil_cells} soil cells; exposure ${stats.exposure_cached} cached, ` +
    `${stats.exposure_computed} computed on the ${stats.backend}`,
);
if (values.out !== undefined) {
  writeFileSync(fromOrigin(values.out), `${JSON.stringify(report, null, 2)}\n`);
}
if (values.residue !== undefined) {
  const dir = fromOrigin(values.residue);
  mkdirSync(dir, { recursive: true });
  for (const map of outcome.residue) {
    writeFileSync(join(dir, `${map.item_id}.json`), `${JSON.stringify(map)}\n`);
  }
}
if (values.json === true) {
  console.log(
    JSON.stringify({
      load: load.name,
      stats,
      points: report.score.points,
      points_loaded: report.score.points_loaded,
      result_hash: report.job.result_hash,
      report_bytes: JSON.stringify(report).length,
      residue_bytes: outcome.residue.reduce((sum, map) => sum + JSON.stringify(map).length, 0),
    }),
  );
}
// The device is destroyed and nothing is pending: end the process rather than wait for the
// bindings to let go of their threads.
process.exit(0);
