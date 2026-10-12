/**
 * spotless-wash: runs one wash from a JSON description and writes the result as JSON.
 *
 *   pnpm --filter @spotless/sim-core run spotless-wash <input.json> [--out <result.json>]
 *        [--params <set.json>]... [--detergent <set.json>] [--dose-g <grams>]
 *        [--accept-stale-params] [--cache <dir> | --no-cache] [--cells] [--trace <seconds>]
 *        [--quiet]
 *
 * The description names the machine, the programme, the tier, the seeds, parameter overrides
 * and the items with their poses and soils (`WashDescription` in `src/input.ts`; an example is
 * `examples/plates-mugs-pan.json`). Relative paths are taken from the directory the command was
 * started in.
 *
 * `--params` names a parameter-set file (`spotless.params`, for example an anchored set of
 * `packages/calibration/anchors/`) laid over the registry defaults; it may be given several
 * times, later files over earlier ones. `--detergent` names the parameter-set file of the
 * composition of the detergent (for example `packages/calibration/detergents/...`), laid over
 * them as a detergent (a key a fitted set moved is scaled, not replaced), and `--dose-g` its
 * dose. A file whose stored hashes do not match the current parameter registry is stale: the
 * command stops and says what to do, unless `--accept-stale-params` is given. The result
 * records the sets, the detergent and the fingerprints of the source that computed it
 * (`provenance`).
 *
 * Without `--cache` or `--no-cache` the exposure sets are kept in `.spotless/exposure-cache`
 * beside the description (in a sub-directory named after the fingerprint of the exposure
 * sources), so that a second wash of the same load with other soils, another detergent or
 * other soil parameters only replays.
 */

import { isAbsolute, join } from 'node:path';
import { ParamSetFileError, runWashFile, StaleParamSetError } from '../src/node/index.ts';
import { WashDescriptionError } from '../src/input.ts';
import type { WashProgress } from '../src/wash.ts';

// pnpm runs a package script in the package directory and keeps the caller's in INIT_CWD.
const origin = process.env['INIT_CWD'] ?? process.cwd();
const fromOrigin = (path: string): string => (isAbsolute(path) ? path : join(origin, path));

const args = process.argv.slice(2).filter((a) => a !== '--');
let input: string | undefined;
let output: string | undefined;
let cacheDir: string | null | undefined;
let cells = false;
let trace: number | undefined;
let quiet = false;
const paramSets: string[] = [];
let detergent: string | undefined;
let dose: number | undefined;
let acceptStale = false;
for (let i = 0; i < args.length; i++) {
  const arg = args[i] as string;
  if (arg === '--out') output = fromOrigin(args[++i] ?? '');
  else if (arg === '--params') paramSets.push(fromOrigin(args[++i] ?? ''));
  else if (arg === '--detergent') detergent = fromOrigin(args[++i] ?? '');
  else if (arg === '--dose-g') dose = Number(args[++i]);
  else if (arg === '--accept-stale-params') acceptStale = true;
  else if (arg === '--cache') cacheDir = fromOrigin(args[++i] ?? '');
  else if (arg === '--no-cache') cacheDir = null;
  else if (arg === '--cells') cells = true;
  else if (arg === '--trace') trace = Number(args[++i]);
  else if (arg === '--quiet') quiet = true;
  else if (arg.startsWith('--')) {
    console.error(`spotless-wash: unknown option ${arg}`);
    process.exit(2);
  } else input = fromOrigin(arg);
}
if (input === undefined) {
  console.error(
    'usage: spotless-wash <input.json> [--out <result.json>] [--params <set.json>]... [--detergent <set.json>] [--dose-g <grams>] [--accept-stale-params] [--cache <dir> | --no-cache] [--cells] [--trace <seconds>] [--quiet]',
  );
  process.exit(2);
}

let lastStage = '';
let lastTenth = -1;
const onProgress = (p: WashProgress): void => {
  if (quiet) return;
  const tenth = Math.floor(p.fraction * 10);
  if (p.stage === lastStage && tenth === lastTenth) return;
  lastStage = p.stage;
  lastTenth = tenth;
  console.error(
    `  ${p.stage.padEnd(10)} ${(100 * p.fraction).toFixed(0).padStart(3)} %${p.detail === undefined ? '' : `  ${p.detail}`}`,
  );
};

try {
  const { result, outputPath } = await runWashFile(input, {
    ...(output === undefined ? {} : { output }),
    ...(cacheDir === undefined ? {} : { cacheDir }),
    cells,
    ...(trace === undefined ? {} : { traceInterval: trace }),
    ...(paramSets.length === 0 ? {} : { paramSets }),
    ...(detergent === undefined && dose === undefined
      ? {}
      : {
          detergent: {
            ...(detergent === undefined ? {} : { params: detergent }),
            ...(dose === undefined ? {} : { dose_g: dose }),
          },
        }),
    ...(acceptStale ? { acceptStaleParams: true } : {}),
    onProgress,
  });
  if (!quiet) {
    const t = result.run.timings_ms;
    console.error(
      `wash of ${result.items.length} items, ${result.machine.ticks} ticks: ` +
        Object.entries(t)
          .map(([stage, ms]) => `${stage} ${(ms / 1000).toFixed(2)} s`)
          .join(', ') +
        `; exposure ${result.run.exposureCacheHits} cached, ${result.run.exposureComputed} computed`,
    );
    for (const item of result.items) {
      console.error(
        `  ${item.clean ? 'clean    ' : 'NOT CLEAN'} ${item.itemId.padEnd(24)} score ${item.score}  ` +
          `soil ${item.residualMass_mg.toFixed(1)} of ${item.initialMass_mg.toFixed(1)} mg  ` +
          `visible ${item.visibleAreaMm2.toFixed(0)} mm2  specks ${item.specks}  water ${item.water.pooled_mL.toFixed(1)} mL`,
      );
    }
    for (const problem of result.problems) console.error(`  problem: ${problem}`);
    const p = result.provenance;
    console.error(
      `parameters: ${p.paramSets.length === 0 ? 'registry defaults with the overrides of the description' : p.paramSets.map((set) => `${set.name}${set.stale ? ' (STALE, accepted)' : ''}`).join(' + ')}; detergent ${p.detergent.name}, ${p.detergent.dose_g.toFixed(1)} g`,
    );
    console.error(
      `source: simulation ${p.sourceFingerprint.slice(0, 16)}, exposure ${p.exposureSource.slice(0, 16)}`,
    );
    console.error(`result ${p.resultHash}`);
  }
  console.log(outputPath);
} catch (error) {
  const missing = error instanceof Error && (error as { code?: string }).code === 'ENOENT';
  if (
    error instanceof WashDescriptionError ||
    error instanceof StaleParamSetError ||
    error instanceof ParamSetFileError ||
    error instanceof SyntaxError ||
    missing
  ) {
    console.error(`spotless-wash: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
  throw error;
}
