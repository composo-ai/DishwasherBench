/**
 * measure: times the wash of the tutorial and of full levels at both tiers, each in a process
 * of its own as the game server's wash worker runs it, and prints wall time by stage and the
 * memory of the process.
 *
 *   pnpm --filter @spotless/wash-runner run measure [--loads a,b,c] [--tiers fast,official]
 *        [--warm] [--out <file.json>]
 *
 * The loads are saved standard loads of `@spotless/loader` (default: `tutorial-careful`,
 * `weeknight-dinner-careful` and `dinner-party-careful`: 7, 37 and 74 items). Every wash
 * starts with an empty exposure cache (a cold wash, what a player's first wash of a load
 * always is); with `--warm` each is then repeated on the cache it filled.
 *
 * Memory: the resident set of the child is sampled four times a second from outside (`ps`),
 * and the child reports its own peak (`getrusage`) and the largest total of live GPU buffers.
 * On Apple silicon GPU buffers are in the same memory as everything else, but the resident
 * set does not count all of them: read the two together.
 */

import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import type { WashRunStats } from '../src/contract.ts';

const origin = process.env['INIT_CWD'] ?? process.cwd();
const fromOrigin = (path: string): string => (isAbsolute(path) ? path : join(origin, path));
const packageDir = fileURLToPath(new URL('..', import.meta.url));

const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== '--'),
  options: {
    loads: {
      type: 'string',
      default: 'tutorial-careful,weeknight-dinner-careful,dinner-party-careful',
    },
    tiers: { type: 'string', default: 'fast,official' },
    warm: { type: 'boolean' },
    out: { type: 'string' },
  },
});

interface Measurement {
  readonly load: string;
  readonly tier: string;
  readonly cache: 'cold' | 'warm';
  /** Wall-clock seconds of the whole process, from start to exit. */
  readonly process_s: number;
  /** Largest resident set seen from outside, megabytes. */
  readonly sampled_rss_mb: number;
  readonly stats: WashRunStats;
  readonly points: number;
  readonly points_loaded: number;
  readonly result_hash: string;
  readonly report_bytes: number;
  readonly residue_bytes: number;
}

/** Resident set of a process, megabytes, or 0 when it has gone. */
function rssMb(pid: number): number {
  const out = spawnSync('ps', ['-o', 'rss=', '-p', String(pid)], { encoding: 'utf8' });
  const kb = Number(out.stdout.trim());
  return Number.isFinite(kb) ? kb / 1024 : 0;
}

function washOnce(
  load: string,
  tier: string,
  cacheDir: string,
  cache: 'cold' | 'warm',
): Promise<Measurement> {
  return new Promise((resolve, reject) => {
    const started = performance.now();
    const child = spawn(
      process.execPath,
      [
        '--import',
        'tsx',
        'scripts/wash-load.ts',
        load,
        '--tier',
        tier,
        '--cache',
        cacheDir,
        '--json',
      ],
      { cwd: packageDir, stdio: ['ignore', 'pipe', 'inherit'] },
    );
    let stdout = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    let peak = 0;
    const sampler = setInterval(() => {
      if (child.pid !== undefined) peak = Math.max(peak, rssMb(child.pid));
    }, 250);
    child.on('error', (error) => {
      clearInterval(sampler);
      reject(error);
    });
    child.on('exit', (code) => {
      clearInterval(sampler);
      const seconds = (performance.now() - started) / 1000;
      const line = stdout.trim().split('\n').at(-1) ?? '';
      if (code !== 0 || !line.startsWith('{')) {
        reject(new Error(`the wash of ${load} at the ${tier} tier failed (exit code ${code})`));
        return;
      }
      const result = JSON.parse(line) as Omit<
        Measurement,
        'tier' | 'cache' | 'process_s' | 'sampled_rss_mb'
      >;
      resolve({
        ...result,
        tier,
        cache,
        process_s: Math.round(seconds * 10) / 10,
        sampled_rss_mb: Math.round(peak),
      });
    });
  });
}

const STAGES = ['starting', 'scene', 'hydraulics', 'exposure', 'soil', 'replay', 'result'];

function row(m: Measurement): string {
  const stage = (name: string): string => (m.stats.stage_s[name] ?? 0).toFixed(1).padStart(7);
  return (
    `${m.load.padEnd(26)} ${m.tier.padEnd(8)} ${m.cache.padEnd(4)} ${String(m.stats.items).padStart(5)} ` +
    `${String(m.stats.blocks).padStart(8)} ${STAGES.map(stage).join(' ')} ${m.stats.total_s.toFixed(1).padStart(7)} ` +
    `${m.process_s.toFixed(1).padStart(7)} ${String(Math.round(m.stats.peak_rss_mb)).padStart(6)} ` +
    `${String(m.sampled_rss_mb).padStart(6)} ${String(m.stats.gpu_buffers_mb ?? '?').padStart(6)} ` +
    `${String(m.points).padStart(4)}/${String(m.points_loaded).padEnd(4)} ` +
    `${String(Math.round(m.report_bytes / 1024)).padStart(5)} ${String(Math.round(m.residue_bytes / 1024)).padStart(6)}`
  );
}

const measurements: Measurement[] = [];
const header =
  `${'load'.padEnd(26)} ${'tier'.padEnd(8)} ${'c'.padEnd(4)} ${'items'.padStart(5)} ${'blocks'.padStart(8)} ` +
  `${STAGES.map((name) => name.slice(0, 7).padStart(7)).join(' ')} ${'wash s'.padStart(7)} ${'proc s'.padStart(7)} ` +
  `${'rss MB'.padStart(6)} ${'ps MB'.padStart(6)} ${'gpu MB'.padStart(6)} ${'points'.padStart(9)} ${'rep kB'.padStart(5)} ${'res kB'.padStart(6)}`;
console.log(header);
for (const load of values.loads.split(',')) {
  for (const tier of values.tiers.split(',')) {
    const cacheDir = mkdtempSync(join(tmpdir(), 'spotless-measure-'));
    try {
      const cold = await washOnce(load, tier, cacheDir, 'cold');
      measurements.push(cold);
      console.log(row(cold));
      if (values.warm === true) {
        const warm = await washOnce(load, tier, cacheDir, 'warm');
        measurements.push(warm);
        console.log(row(warm));
        if (warm.result_hash !== cold.result_hash) {
          console.log(
            `  the warm wash gave another result: ${warm.result_hash} / ${cold.result_hash}`,
          );
        }
      }
    } catch (error) {
      console.log(
        `${load.padEnd(26)} ${tier.padEnd(8)} FAILED: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      rmSync(cacheDir, { recursive: true, force: true });
    }
  }
}
if (values.out !== undefined) {
  writeFileSync(fromOrigin(values.out), `${JSON.stringify(measurements, null, 2)}\n`);
}
