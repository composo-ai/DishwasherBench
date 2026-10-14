// The command line of the harness: which wash it asks for, what it passes on to the game
// server it starts, and that an episode without a result is a failure of the run.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { EpisodeRecord } from '@spotless/server';
import { afterEach, describe, expect, it } from 'vitest';
import { runBatch } from './batch.ts';
import { main } from './cli.ts';
import { episodeProblem } from './episode.ts';
import { scriptedPolicy } from './scripted.ts';
import { useHarness } from './test-util.ts';

const harness = useHarness();
const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

async function run(args: readonly string[]): Promise<{ status: number; out: string; err: string }> {
  const out: string[] = [];
  const err: string[] = [];
  const status = await main(args, {
    out: (line) => out.push(line),
    err: (line) => err.push(line),
  });
  return { status, out: out.join('\n'), err: err.join('\n') };
}

describe('spotless-bench run: the options of the wash', () => {
  const base = ['run', '--levels', 'tutorial', '--policies', 'empty'];

  it('refuses a tier, a dose or a combination that makes no sense, before anything starts', async () => {
    expect(await run([...base, '--tier', 'quick'])).toMatchObject({
      status: 2,
      err: "run: 'quick' is not a wash tier (official, fast)",
    });
    expect(await run([...base, '--wash-tier', 'slow'])).toMatchObject({ status: 2 });
    expect(await run([...base, '--dose-g', 'much'])).toMatchObject({
      status: 2,
      err: "run: 'much' is not a dose in grams",
    });
    expect(await run([...base, '--registry-defaults', '--wash-params', 'a.json'])).toMatchObject({
      status: 2,
      err: 'run: --registry-defaults goes with no --wash-params, --detergent or --dose-g',
    });
    expect(await run([...base, '--detergent', 'd.json'])).toMatchObject({
      status: 2,
      err: 'run: --detergent needs --dose-g (the mass of the dose in grams)',
    });
  });

  it('leaves the tier and the parameters of a server it did not start to that server', async () => {
    const result = await run([
      ...base,
      '--server',
      'http://127.0.0.1:1',
      '--admin-token',
      'a-token-of-the-server',
      '--tier',
      'fast',
    ]);
    expect(result.status).toBe(2);
    expect(result.err).toMatch(/those of the server named with --server/);
  });
});

describe('spotless-bench: the environment file', () => {
  it('is read, and named, only when a run starts', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'spotless-cli-env-'));
    dirs.push(dir);
    const envFile = join(dir, '.env');
    const name = 'SPOTLESS_TEST_ONLY_WHEN_A_RUN_STARTS';
    writeFileSync(envFile, `${name}=a-value-nobody-prints\n`);
    const saying = async (
      args: readonly string[],
    ): Promise<{ status: number; out: string; err: string }> => {
      const out: string[] = [];
      const err: string[] = [];
      const status = await main(
        args,
        { out: (line) => out.push(line), err: (line) => err.push(line) },
        { envFile },
      );
      return { status, out: out.join('\n'), err: err.join('\n') };
    };
    try {
      // A table, a usage error: no key is needed, nothing is read, nothing is said.
      const table = await saying(['table', dir]);
      expect(table.status).toBe(0);
      expect(`${table.out}${table.err}`).not.toContain('.env');
      expect(process.env[name]).toBeUndefined();
      expect((await saying(['run', '--levels', 'tutorial'])).err).not.toContain('.env');
      expect(process.env[name]).toBeUndefined();
      // A run: the names it set are said once, never a value.
      const started = await saying([
        'run',
        '--levels',
        'tutorial',
        '--policies',
        'empty',
        '--tier',
        'quick',
      ]);
      expect(started.status).toBe(2);
      expect(started.err).toContain(`.env: set ${name}`);
      expect(`${started.out}${started.err}`).not.toContain('a-value-nobody-prints');
      expect(process.env[name]).toBe('a-value-nobody-prints');
    } finally {
      delete process.env[name];
    }
  });

  it('takes the room of the context policy from the command line, as whole numbers', async () => {
    const base = ['run', '--levels', 'tutorial', '--policies', 'empty'];
    expect(await run([...base, '--fold-above', 'lots'])).toMatchObject({
      status: 2,
      err: 'run: --fold-above takes a whole number above zero',
    });
    expect(await run([...base, '--keep-recent', '0'])).toMatchObject({ status: 2 });
  });
});

describe('an episode without a result', () => {
  it('is named for what it is', () => {
    const record = (more: Partial<EpisodeRecord>): EpisodeRecord =>
      ({ wash: null, score: null, ...more }) as EpisodeRecord;
    expect(
      episodeProblem(
        record({
          wash: {
            job_id: 'j',
            status: 'failed',
            cache_key: 'k',
            cached: null,
            error: 'the parameter set is stale\n  at somewhere',
          },
        }),
      ),
    ).toBe('the wash failed: the parameter set is stale');
    expect(episodeProblem(record({}))).toBe('no cycle was started: there is nothing to score');
    expect(
      episodeProblem(
        record({ wash: { job_id: 'j', status: 'done', cache_key: 'k', cached: false } }),
      ),
    ).toBe('the episode has no score');
    expect(
      episodeProblem(
        record({
          wash: { job_id: 'j', status: 'done', cache_key: 'k', cached: false },
          score: { points: 0 } as EpisodeRecord['score'],
        }),
      ),
    ).toBeNull();
  });

  it('is listed by the batch when its wash fails, twice over: never a score of zero', async () => {
    let washes = 0;
    const game = await harness.game({
      washRunner: () => {
        washes += 1;
        return Promise.reject(new Error('the simulation fell over'));
      },
    });
    const batch = await runBatch({
      game,
      levels: ['tutorial'],
      policies: [() => scriptedPolicy('random', { items: ['bowl_01'] })],
      outDir: harness.outDir(),
    });
    // The harness started the wash again once (benchmark.md 4.6) and then gave up.
    expect(washes).toBe(2);
    expect(batch.failures).toEqual([]);
    expect(batch.records).toHaveLength(1);
    expect(batch.records[0]?.score).toBeNull();
    expect(batch.unscored).toEqual([
      {
        episode_id: batch.records[0]?.episode_id,
        problem: 'the wash failed: the simulation fell over',
      },
    ]);
    // The table says so too.
    expect(batch.table.rows[0]).toMatchObject({ scored: 0, wash_failed: 1, points: null });
  });

  it('makes the command exit with 1: a wash with a parameter set that is not there fails', async () => {
    // The whole chain: the option reaches the wash worker of the server the command starts,
    // the worker cannot read the set, the wash fails (and fails again when it is retried),
    // and the command says so and does not exit with 0.
    const out = mkdtempSync(join(tmpdir(), 'spotless-bench-cli-'));
    dirs.push(out);
    const result = await run([
      'run',
      '--levels',
      'tutorial',
      '--policies',
      'careful',
      '--tier',
      'fast',
      '--wash-params',
      join(out, 'no-such-set.json'),
      '--no-render',
      '--out',
      out,
    ]);
    expect(result.out).toMatch(
      /started here, fast tier: a preview, not a result, parameters as named/,
    );
    expect(result.out).toContain('not scored');
    expect(result.err).toMatch(/no result: [0-9a-f-]+: the wash failed: /);
    expect(result.status).toBe(1);
  }, 240_000);
});
