import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { WashManifest } from '@spotless/session';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { WashProgressDetail } from './contract.ts';
import { runWash, simWashRunner } from './runner.ts';
import { manifestOf, TILTED_LOAD, tutorialLevel } from './test-util.ts';

let loaded: WashManifest;
let empty: WashManifest;
const dir = mkdtempSync(join(tmpdir(), 'spotless-wash-runner-'));

beforeAll(async () => {
  loaded = await manifestOf(tutorialLevel(), TILTED_LOAD);
  empty = await manifestOf(tutorialLevel(), []);
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('the wash runner without a wash', () => {
  it('does not simulate an empty machine: nothing loaded, nothing scored, and it says so', async () => {
    const details: WashProgressDetail[] = [];
    const fractions: number[] = [];
    const outcome = await runWash(empty, {
      tier: 'official',
      onDetail: (detail) => details.push(detail),
    });
    expect(outcome.report.job).toMatchObject({ status: 'done', fidelity: 'official' });
    expect(outcome.report.job.notes?.[0]).toMatch(/Nothing was in the machine/);
    expect(outcome.report.score).toMatchObject({ points: 0, graded_points: 0, points_loaded: 0 });
    expect(outcome.report.score.points_available).toBeGreaterThan(0);
    expect(outcome.report.items.every((item) => !item.loaded)).toBe(true);
    expect(outcome.report.items).toHaveLength(empty.level.items.length);
    expect(outcome.residue).toEqual([]);
    expect(outcome.stats).toMatchObject({ tier: 'official', items: 0, backend: 'none' });
    expect(details.at(-1)).toMatchObject({ fraction: 1, stage: { stage: 'result', fraction: 1 } });
    // The same through the session's hook, with the plain fraction.
    const report = await simWashRunner(empty, (fraction) => fractions.push(fraction));
    expect(report.items.every((item) => !item.loaded)).toBe(true);
    // Without a tier asked for: the official one, at which scores are compared.
    expect(report.job.fidelity).toBe('official');
    expect(fractions.at(-1)).toBe(1);
  });

  it('fails, before simulating anything, when the poses are not those of the load shown', async () => {
    const shifted: WashManifest = {
      ...loaded,
      items: loaded.items.map((item) => ({
        ...item,
        pose: { p: [item.pose.p[0] + 0.01, item.pose.p[1], item.pose.p[2]], q: item.pose.q },
      })),
    };
    await expect(runWash(shifted, { tier: 'fast' })).rejects.toThrow(
      // 10 mm, to within the tenth of a millimetre the load manifest states positions to.
      /poses of the wash do not match the load manifest: bowl_01 is (9\.9|10\.0)\d mm/,
    );
    const turned: WashManifest = {
      ...loaded,
      items: loaded.items.map((item) => {
        const [x, y, z, w] = item.pose.q;
        return { ...item, pose: { p: item.pose.p, q: [w, x, y, z] } };
      }),
    };
    await expect(runWash(turned, { tier: 'fast' })).rejects.toThrow(/do not match the load/);
    await expect(runWash({ ...loaded, machine_id: 'nope' }, { tier: 'fast' })).rejects.toThrow(
      /unknown machine/,
    );
  });

  it('stops when it is told to before it has begun', async () => {
    const abort = new AbortController();
    abort.abort();
    // (With the registry defaults: the wash of this test must not depend on whether the
    // anchored set of the day is fresh.)
    await expect(
      runWash(loaded, { tier: 'fast', signal: abort.signal, params: 'registry-defaults' }),
    ).rejects.toThrow(/the wash was stopped|destroyed/);
    // Nothing was kept of a wash that did not end.
    const timings = join(dir, 'timings.json');
    expect(() => readFileSync(timings)).toThrow();
  });
});
