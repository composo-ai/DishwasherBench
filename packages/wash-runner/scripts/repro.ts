/**
 * repro: washes one saved standard load several times, each in a process of its own, and says
 * whether the simulation gave the same result every time. The fingerprint of the simulation's
 * source is read before and after every wash: two washes are only comparable when the source
 * did not change between them, and while the simulation is being worked on it often does.
 *
 *   pnpm --filter @spotless/wash-runner run repro [load] [--tier fast|official] [--runs 3]
 *        [--cache]
 *
 * Without `--cache` every wash computes its exposure afresh (cold); with it the first fills a
 * cache and the others read it, which compares a cold wash with warm ones.
 *
 * Exit code 0 when every comparable pair agrees, 1 when a comparable pair differs, 2 when no
 * two washes were comparable.
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { simulationFingerprint } from '../../server/src/wash-runner.ts';

const packageDir = fileURLToPath(new URL('..', import.meta.url));
const { values, positionals } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== '--'),
  options: {
    tier: { type: 'string', default: 'fast' },
    runs: { type: 'string', default: '3' },
    cache: { type: 'boolean' },
  },
  allowPositionals: true,
});
const load = positionals[0] ?? 'tutorial-careful';
const runs = Math.max(2, Number(values.runs) || 3);
const cacheDir = mkdtempSync(join(tmpdir(), 'spotless-repro-'));

interface Run {
  readonly source: string;
  readonly sourceHeld: boolean;
  readonly hash: string | null;
  readonly backend: string;
  readonly cached: number;
  readonly computed: number;
  readonly points: number | null;
}

const results: Run[] = [];
try {
  for (let i = 0; i < runs; i++) {
    const before = simulationFingerprint();
    const child = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        'scripts/wash-load.ts',
        load,
        '--tier',
        values.tier,
        '--json',
        ...(values.cache === true ? ['--cache', cacheDir] : []),
      ],
      { cwd: packageDir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    );
    const after = simulationFingerprint();
    const line = child.stdout.trim().split('\n').at(-1) ?? '';
    let parsed: {
      result_hash?: string;
      points?: number;
      stats?: { backend: string; exposure_cached: number; exposure_computed: number };
    } = {};
    if (child.status === 0 && line.startsWith('{')) parsed = JSON.parse(line) as typeof parsed;
    const run: Run = {
      source: before.slice(0, 12),
      sourceHeld: before === after,
      hash: parsed.result_hash ?? null,
      backend: parsed.stats?.backend ?? '?',
      cached: parsed.stats?.exposure_cached ?? 0,
      computed: parsed.stats?.exposure_computed ?? 0,
      points: parsed.points ?? null,
    };
    results.push(run);
    console.log(
      `wash ${i + 1}: source ${run.source}${run.sourceHeld ? '' : ' (CHANGED during the wash)'}  ` +
        `${run.hash === null ? 'FAILED' : run.hash.slice(0, 23)}  ${run.backend}  ` +
        `exposure ${run.cached} cached ${run.computed} computed  points ${run.points ?? '?'}`,
    );
  }
} finally {
  rmSync(cacheDir, { recursive: true, force: true });
}

let comparable = 0;
let differing = 0;
for (let i = 1; i < results.length; i++) {
  const a = results[i - 1] as Run;
  const b = results[i] as Run;
  if (a.hash === null || b.hash === null) continue;
  if (!a.sourceHeld || !b.sourceHeld || a.source !== b.source) continue;
  comparable += 1;
  if (a.hash !== b.hash) differing += 1;
}
console.log(
  comparable === 0
    ? 'no two washes ran on the same source: nothing to compare'
    : differing === 0
      ? `the same result in all ${comparable} comparable pair(s) of washes`
      : `DIFFERENT results in ${differing} of ${comparable} comparable pair(s) of washes on unchanged source`,
);
process.exit(comparable === 0 ? 2 : differing === 0 ? 0 : 1);
