/**
 * The real wash through the server: the wash simulation in the wash worker process on a
 * two-item load at the fast tier. One wash is computed (some tens of seconds on a busy
 * machine); everything else here reads its outcome, washes the same load again from the
 * caches, or fails before the simulation begins.
 */

import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { instantiate } from '@spotless/catalogue';
import { signedDistance } from '@spotless/geometry';
import type {
  GetReportResult,
  GetResidueMapResult,
  StartCycleResult,
  WashReport,
  WashStageProgress,
} from '@spotless/session';
import { decodeResidueMap } from '@spotless/wash-runner/contract';
import { describe, expect, it } from 'vitest';
import type { SpotlessServer } from './app.ts';
import { DataStore } from './store.ts';
import { call, mustPlace, newSession, reportWhenEnded, useServers } from './test-util.ts';
import type { WashJobRecord } from './types.ts';
import { WashQueue } from './wash-queue.ts';
import { WASH_RUNNER } from './wash-runner.ts';

const servers = useServers();

/**
 * The washes of these tests run with the registry defaults: they must not depend on whether
 * the anchored parameter set of the day is fresh against the registry (a stale one fails a
 * wash, which has a test of its own below).
 */
const PARAMS = 'registry-defaults' as const;

/** A session with the bowl and the mug in the lower basket: the same load every time. */
async function loaded(server: SpotlessServer): Promise<string> {
  const id = await newSession(server);
  await mustPlace(server, id, {
    item_id: 'bowl_01',
    frame: 'lower_rack',
    position_mm: [420, 270, 200],
    orientation: { preset: 'inverted' },
  });
  await mustPlace(server, id, {
    item_id: 'mug_01',
    frame: 'lower_rack',
    position_mm: [150, 150, 200],
    orientation: { preset: 'upright' },
  });
  return id;
}

async function jobsOf(server: SpotlessServer): Promise<WashJobRecord[]> {
  return (await call<{ jobs: WashJobRecord[] }>(server, 'GET', '/api/jobs')).body.jobs;
}

/** The report of a session's wash once it has ended well; a real wash may take minutes. */
async function doneReport(server: SpotlessServer, id: string): Promise<WashReport> {
  const deadline = Date.now() + 280_000;
  for (;;) {
    const polled = await call<GetReportResult>(server, 'GET', `/api/sessions/${id}/get_report`);
    if (!polled.body.accepted) throw new Error('get_report was rejected');
    if (polled.body.status === 'done') return polled.body.report;
    if (polled.body.status === 'failed') throw new Error(`the wash failed: ${polled.body.error}`);
    if (Date.now() > deadline) throw new Error('the wash did not end in time');
    await new Promise<void>((next) => setTimeout(next, 100));
  }
}

describe('the wash simulation through the server', () => {
  it('washes a load in the worker, reports by stage, scores it, and answers again from its caches', async () => {
    const dataDir = servers.dataDir();
    // Benchmark mode would ask for the official tier; the options say fast.
    const server = await servers.server({
      dataDir,
      washRunner: WASH_RUNNER,
      washParams: PARAMS,
      washTier: 'fast',
    });
    const health = await call<{ wash_tier: string; wash_runner: { module: string } }>(
      server,
      'GET',
      '/api/health',
    );
    expect(health.body).toMatchObject({
      wash_tier: 'fast',
      wash_runner: { module: '@spotless/wash-runner' },
    });

    const id = await loaded(server);
    const started = await call<StartCycleResult>(server, 'POST', `/api/sessions/${id}/start_cycle`);
    if (!started.body.accepted) throw new Error('start_cycle was rejected');
    // Nothing is known of the residue before the wash has ended.
    const early = await call(server, 'GET', `/api/sessions/${id}/residue_map?item_id=bowl_01`);
    expect(early.body).toMatchObject({ accepted: false, reason: 'no_residue_map' });

    // Polling: real stages with a time estimate, never a score before the end.
    const stages: WashStageProgress[] = [];
    const fractions: number[] = [];
    let report: WashReport | null = null;
    const deadline = Date.now() + 280_000;
    while (report === null) {
      if (Date.now() > deadline) throw new Error('the wash did not end in time');
      const polled = await call<GetReportResult>(server, 'GET', `/api/sessions/${id}/get_report`);
      if (!polled.body.accepted) throw new Error('get_report was rejected');
      if (polled.body.status === 'failed') throw new Error(`the wash failed: ${polled.body.error}`);
      if (polled.body.status === 'done') report = polled.body.report;
      else {
        expect(polled.body).not.toHaveProperty('report');
        if (polled.body.status === 'running') {
          fractions.push(polled.body.progress);
          if (polled.body.stage !== undefined) stages.push(polled.body.stage);
        }
        await new Promise<void>((next) => setTimeout(next, 100));
      }
    }
    expect(stages.length).toBeGreaterThan(0);
    const names = new Set(stages.map((stage) => stage.stage));
    // The exposure is by far the longest stage: a poll every 100 ms sees it.
    expect(names.has('exposure')).toBe(true);
    for (const stage of stages) {
      expect(stage.count).toBe(7);
      expect(stage.index).toBeGreaterThanOrEqual(1);
      expect(stage.index).toBeLessThanOrEqual(7);
      expect(stage.label.length).toBeGreaterThan(10);
      expect(stage.fraction).toBeGreaterThanOrEqual(0);
      expect(stage.fraction).toBeLessThanOrEqual(1);
      expect(stage.eta_s).toBeGreaterThanOrEqual(0);
      expect(stage.elapsed_s).toBeGreaterThanOrEqual(0);
    }
    expect(stages.map((stage) => stage.index)).toEqual(
      [...stages.map((stage) => stage.index)].sort((a, b) => a - b),
    );
    expect([...fractions].sort((a, b) => a - b)).toEqual(fractions);

    // The report: the two loaded items judged by the simulation, the rest not loaded.
    expect(report.state_hash).toBe(started.body.state_hash);
    expect(report.job).toMatchObject({ status: 'done', fidelity: 'fast' });
    expect(report.job.sim_version).toMatch(/spotless-sim/);
    expect(report.job.runner_version).toMatch(/wash-runner/);
    expect(report.job.result_hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(report.job.runtime_s).toBeGreaterThan(1);
    const points = new Map(server.manager.level('tutorial')?.items.map((i) => [i.id, i.points]));
    let total = 0;
    for (const item of report.items) {
      if (item.item_id !== 'bowl_01' && item.item_id !== 'mug_01') {
        expect(item).toEqual({ item_id: item.item_id, loaded: false });
        continue;
      }
      if (!item.loaded) throw new Error(`${item.item_id} was not washed`);
      expect(item.simulated).toBeUndefined();
      expect(typeof item.clean).toBe('boolean');
      expect(item.points_awarded).toBe(item.clean ? points.get(item.item_id) : 0);
      expect(item.score_iec).toBeGreaterThanOrEqual(0);
      expect(item.score_iec).toBeLessThanOrEqual(5);
      expect(item.graded_score).toBeCloseTo((item.score_iec ?? -1) / 5, 9);
      // A reason exactly when it is not clean, and it names soil or water.
      if (item.clean) expect(item.reason).toBeUndefined();
      else expect(item.reason).toMatch(/left on the|ml of water/);
      expect(item.retained_water_ml).toBeGreaterThanOrEqual(0);
      total += item.points_awarded;
    }
    expect(report.score.points).toBe(total);
    expect(report.score.points_loaded).toBe(
      (points.get('bowl_01') ?? 0) + (points.get('mug_01') ?? 0),
    );
    // The mug stands upright and open: it comes out full of water, which is not clean.
    const mug = report.items.find((item) => item.item_id === 'mug_01');
    const bowl = report.items.find((item) => item.item_id === 'bowl_01');
    if (mug?.loaded !== true || bowl?.loaded !== true) throw new Error('not loaded');
    // Nothing of the simulation's inside is in the report.
    const text = JSON.stringify(report);
    for (const word of ['exposure', 'hydro', 'liquor', 'seed', 'params']) {
      expect(text).not.toContain(word);
    }

    // The residue maps, fetched one item at a time: the cells lie on the item's surface.
    for (const item of [bowl, mug]) {
      const fetched = await call<GetResidueMapResult>(
        server,
        'GET',
        `/api/sessions/${id}/residue_map?item_id=${item.item_id}`,
      );
      if (!fetched.body.accepted) throw new Error(`no residue map of ${item.item_id}`);
      const map = fetched.body.map;
      expect(map.item_id).toBe(item.item_id);
      expect(map.cells).toBe(item.residue_cells);
      const cells = decodeResidueMap(map);
      // A region that still shows soil has cells to show it with.
      if (item.residue_regions.length > 0) expect(cells.count).toBeGreaterThan(0);
      const type = item.item_id === 'bowl_01' ? 'cereal_bowl_porcelain_160' : 'mug_ceramic_300';
      const shape = instantiate(type).shape;
      let visibleArea = 0;
      for (let i = 0; i < cells.count; i++) {
        const p: [number, number, number] = [
          cells.centre[3 * i] as number,
          cells.centre[3 * i + 1] as number,
          cells.centre[3 * i + 2] as number,
        ];
        const n = [cells.normal[3 * i], cells.normal[3 * i + 1], cells.normal[3 * i + 2]] as [
          number,
          number,
          number,
        ];
        // On the surface of the item, in the item's own frame, within a millimetre.
        const distance = signedDistance(shape, p);
        expect(Math.abs(distance)).toBeLessThan(0.001);
        // And the normal points out of the material: a millimetre along it is outside.
        const out = signedDistance(shape, [
          p[0] + 0.001 * n[0],
          p[1] + 0.001 * n[1],
          p[2] + 0.001 * n[2],
        ]);
        expect(out).toBeGreaterThan(distance + 0.0005);
        expect(Math.hypot(...n)).toBeCloseTo(1, 1);
        if (cells.visible[i] === 1) visibleArea += cells.areaMm2[i] as number;
      }
      // The visibly soiled cells of the map are the visibly soiled area of the report.
      expect(visibleArea).toBeCloseTo(item.visible_area_mm2 ?? -1, -1);
      expect(cells.soils.length).toBeGreaterThan(0);
    }
    const none = await call(server, 'GET', `/api/sessions/${id}/residue_map?item_id=plate_01`);
    expect(none.body).toMatchObject({ accepted: false, reason: 'no_residue_map' });

    // The job record: tier, time per stage, memory of the worker; the caches on disk.
    const [job] = await jobsOf(server);
    if (job === undefined) throw new Error('no job');
    expect(job).toMatchObject({ status: 'done', cached: false, tier: 'fast', progress: 1 });
    // Keyed by the source of the simulation as it was when the wash was queued. While the
    // simulation is being edited the worker may find another version when it has washed: the
    // report is then delivered and not kept, and nothing below about the caches would hold.
    expect(job.runner.version).toMatch(/^wash-runner \d+\+src\.[0-9a-f]{16}$/);
    expect(job.ran_with, 'the source of the simulation changed under the wash').toBe(
      job.runner.version,
    );
    expect(job.stage).toBeUndefined();
    expect(job.stats).toMatchObject({ tier: 'fast', items: 2, exposure_cached: 0 });
    expect(job.stats?.exposure_computed).toBeGreaterThan(0);
    expect(job.stats?.stage_s['exposure']).toBeGreaterThan(0);
    expect(job.stats?.stage_s['scene']).toBeGreaterThan(0);
    expect(job.stats?.peak_rss_mb).toBeGreaterThan(100);
    expect(existsSync(join(dataDir, 'washes', `${job.cache_key}.json`))).toBe(true);
    expect(existsSync(join(dataDir, 'residue', `${job.cache_key}.json`))).toBe(true);
    expect(existsSync(join(dataDir, 'wash-timings.json'))).toBe(true);
    const exposureDirs = readdirSync(join(dataDir, 'exposure-cache'));
    expect(exposureDirs).toHaveLength(1);
    // Under the runner's version, one directory per fingerprint of the exposure sources (the
    // simulation's own key of what an exposure set depends on), holding the sets.
    const versionDir = join(dataDir, 'exposure-cache', exposureDirs[0] as string);
    const sourceDirs = readdirSync(versionDir);
    expect(sourceDirs).toHaveLength(1);
    expect(sourceDirs[0]).toMatch(/^src-[0-9a-f]{16}$/);
    const exposureFiles = readdirSync(join(versionDir, sourceDirs[0] as string));
    expect(exposureFiles.length).toBe(job.stats?.exposure_computed);

    // The same load in another session: answered from the result cache, maps and all.
    const twin = await loaded(server);
    await call(server, 'POST', `/api/sessions/${twin}/start_cycle`);
    expect(await doneReport(server, twin)).toEqual(report);
    const twinJob = (await jobsOf(server))[1];
    expect(twinJob).toMatchObject({ status: 'done', cached: true, cache_key: job.cache_key });
    expect(twinJob?.started_at).toBeUndefined();
    const twinMap = await call<GetResidueMapResult>(
      server,
      'GET',
      `/api/sessions/${twin}/residue_map?item_id=bowl_01`,
    );
    expect(twinMap.body).toMatchObject({ accepted: true, map: { cells: bowl.residue_cells } });

    // With the stored result gone the load is washed again: the exposure comes from the
    // cache on disk, and the simulation gives the same result to the last bit.
    rmSync(join(dataDir, 'washes', `${job.cache_key}.json`));
    const again = await loaded(server);
    await call(server, 'POST', `/api/sessions/${again}/start_cycle`);
    const second = await doneReport(server, again);
    expect(second.job.result_hash).toBe(report.job.result_hash);
    expect(second.items).toEqual(report.items);
    expect(second.score).toEqual(report.score);
    const againJob = (await jobsOf(server))[2];
    expect(againJob).toMatchObject({ status: 'done', cached: false, cache_key: job.cache_key });
    expect(againJob?.stats).toMatchObject({ exposure_computed: 0 });
    expect(againJob?.stats?.exposure_cached).toBe(job.stats?.exposure_computed);

    // A restarted server restores the session and still serves its report and its maps.
    await server.close();
    const restarted = await servers.server({
      dataDir,
      washRunner: WASH_RUNNER,
      washParams: PARAMS,
      washTier: 'fast',
    });
    const restored = (
      await call<GetReportResult>(restarted, 'GET', `/api/sessions/${id}/get_report`)
    ).body;
    if (!restored.accepted || restored.status !== 'done') throw new Error('not restored');
    expect(restored.report.job.result_hash).toBe(report.job.result_hash);
    const restoredMap = await call<GetResidueMapResult>(
      restarted,
      'GET',
      `/api/sessions/${id}/residue_map?item_id=mug_01`,
    );
    expect(restoredMap.body).toMatchObject({ accepted: true, map: { cells: mug.residue_cells } });
    expect((await jobsOf(restarted)).length).toBe(0);
  }, 300_000);

  it('reports a wash over its time limit as a failure and stops the worker', async () => {
    const dataDir = servers.dataDir();
    const server = await servers.server({
      dataDir,
      washRunner: WASH_RUNNER,
      washParams: PARAMS,
      washTier: 'fast',
      washTimeoutMs: 400,
    });
    const id = await loaded(server);
    await call(server, 'POST', `/api/sessions/${id}/start_cycle`);
    const report = await reportWhenEnded(server, id);
    expect(report).toMatchObject({ status: 'failed', error: 'wash timed out after 400 ms' });
    expect(JSON.stringify(report)).not.toContain('points');
    expect(readdirSync(join(dataDir, 'washes'))).toEqual([]);
    expect(existsSync(join(dataDir, 'residue'))).toBe(false);
    const [job] = await jobsOf(server);
    expect(job).toMatchObject({ status: 'failed' });
    // The wash was given back: the player can go on and wash again.
    const summary = await call<{ phase: string; budget: { washes_used: number } }>(
      server,
      'GET',
      `/api/sessions/${id}`,
    );
    expect(summary.body).toMatchObject({ phase: 'loading', budget: { washes_used: 0 } });
  });

  it('reports a load the simulation cannot take as a failure with the cause', async () => {
    const dataDir = servers.dataDir();
    const server = await servers.server({ dataDir });
    const id = await loaded(server);
    await call(server, 'POST', `/api/sessions/${id}/start_cycle`);
    await reportWhenEnded(server, id);
    const manifest = (await server.manager.get(id)).session.washManifest();
    if (manifest === null) throw new Error('no manifest');

    const queue = new WashQueue({
      store: new DataStore(dataDir),
      runner: WASH_RUNNER,
      params: PARAMS,
      tier: 'fast',
      now: () => new Date().toISOString(),
    });
    try {
      // A machine the simulation does not know.
      const unknown = queue.submit({
        jobId: 'unknown-machine',
        sessionId: 'none',
        manifest: { ...manifest, machine_id: 'no_such_machine' },
      });
      await expect(unknown.done).rejects.toThrow(/unknown machine 'no_such_machine'/);
      // Poses that are not those of the load the player was shown: never washed, never scored.
      const moved = queue.submit({
        jobId: 'moved-items',
        sessionId: 'none',
        manifest: {
          ...manifest,
          items: manifest.items.map((item) => ({
            ...item,
            pose: { p: [item.pose.p[0], item.pose.p[1] + 0.05, item.pose.p[2]], q: item.pose.q },
          })),
        },
      });
      await expect(moved.done).rejects.toThrow(/do not match the load manifest/);
      expect(queue.job('unknown-machine')).toMatchObject({ status: 'failed' });
      expect(queue.job('moved-items')).toMatchObject({ status: 'failed' });
      expect(queue.job('moved-items')?.error).toContain('WashManifestError');
      // Neither left anything in the caches.
      const stored = readdirSync(join(dataDir, 'washes')).map(
        (name) =>
          (JSON.parse(readFileSync(join(dataDir, 'washes', name), 'utf8')) as { runner: unknown })
            .runner,
      );
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({ export_name: 'placeholderWashRunner' });
      expect(existsSync(join(dataDir, 'residue'))).toBe(false);
    } finally {
      queue.close();
    }
  });

  it('names the code that ran in the report, and in benchmark mode gives no result when it is not the code the wash was keyed by', async () => {
    const dataDir = servers.dataDir();
    const server = await servers.server({ dataDir });
    const id = await loaded(server);
    await call(server, 'POST', `/api/sessions/${id}/start_cycle`);
    await reportWhenEnded(server, id);
    const manifest = (await server.manager.get(id)).session.washManifest();
    if (manifest === null) throw new Error('no manifest');
    const store = new DataStore(dataDir);
    const now = (): string => new Date().toISOString();
    // A wash keyed by a source that is no longer the source: what happens when a file of
    // the simulation changes between the submission and the worker's start.
    const stale = { ...WASH_RUNNER, version: 'wash-runner 1+src.0000000000000000' };
    const lenient = new WashQueue({ store, runner: stale, params: PARAMS, tier: 'fast', now });
    const strict = new WashQueue({
      store,
      runner: stale,
      params: PARAMS,
      tier: 'fast',
      now,
      strictSource: true,
    });
    try {
      const before = WASH_RUNNER.version;
      const delivered = await lenient.submit({
        jobId: 'stale-lenient',
        sessionId: 'none',
        manifest,
      }).done;
      const job = lenient.job('stale-lenient');
      expect(job).toMatchObject({ status: 'done', cached: false });
      // The report says what computed it: the worker's code, not the stale key.
      expect(job?.ran_with).toMatch(/^wash-runner \d+\+src\.[0-9a-f]{16}$/);
      expect(job?.ran_with).not.toBe(stale.version);
      expect(delivered.job.runner_version).toBe(job?.ran_with);
      // And it is not kept under a key that names other code.
      expect(store.readWash(lenient.cacheKey(manifest))).toBeNull();
      // Benchmark mode: no result at all, an infrastructure failure to be started again.
      const refused = strict.submit({ jobId: 'stale-strict', sessionId: 'none', manifest });
      await expect(refused.done).rejects.toThrow(/source of the simulation changed/);
      expect(strict.job('stale-strict')).toMatchObject({ status: 'failed' });
      expect(strict.job('stale-strict')?.ran_with).toBeDefined();
      expect(WASH_RUNNER.version, 'the source of the simulation changed under this test').toBe(
        before,
      );
    } finally {
      lenient.close();
      strict.close();
    }
  }, 300_000);

  it('keys results by runner, tier and load', async () => {
    const dataDir = servers.dataDir();
    const server = await servers.server({ dataDir });
    const id = await loaded(server);
    await call(server, 'POST', `/api/sessions/${id}/start_cycle`);
    await reportWhenEnded(server, id);
    const manifest = (await server.manager.get(id)).session.washManifest();
    if (manifest === null) throw new Error('no manifest');
    const store = new DataStore(dataDir);
    const now = (): string => 'now';
    const fast = new WashQueue({ store, runner: WASH_RUNNER, tier: 'fast', now });
    const official = new WashQueue({ store, runner: WASH_RUNNER, tier: 'official', now });
    const other = new WashQueue({
      store,
      runner: { ...WASH_RUNNER, version: 'wash-runner 1+src.0000000000000000' },
      tier: 'fast',
      now,
    });
    const key = fast.cacheKey(manifest);
    expect(fast.cacheKey(manifest)).toBe(key);
    expect(official.cacheKey(manifest)).not.toBe(key);
    expect(other.cacheKey(manifest)).not.toBe(key);
    expect(fast.cacheKey({ ...manifest, seed: manifest.seed + 1 })).not.toBe(key);
    // What the session found mechanically is part of the load.
    const { prechecks: _prechecks, ...without } = manifest;
    expect(fast.cacheKey(without)).not.toBe(key);
    // The parameters the washes are run with: the registry defaults, another dose, accepting
    // stale sets are each another wash.
    const plain = new WashQueue({ store, runner: WASH_RUNNER, params: PARAMS, tier: 'fast', now });
    const dosed = new WashQueue({
      store,
      runner: WASH_RUNNER,
      params: { paramSets: [], detergent: { name: 'Capsule', dose_g: 12.9 } },
      tier: 'fast',
      now,
    });
    const accepting = new WashQueue({
      store,
      runner: WASH_RUNNER,
      params: PARAMS,
      acceptStaleParams: true,
      tier: 'fast',
      now,
    });
    expect(plain.cacheKey(manifest)).not.toBe(key);
    expect(dosed.cacheKey(manifest)).not.toBe(plain.cacheKey(manifest));
    expect(accepting.cacheKey(manifest)).not.toBe(plain.cacheKey(manifest));
    for (const queue of [fast, official, other, plain, dosed, accepting]) queue.close();
  });

  it('fails a wash with a stale parameter set and says what to do; washes with it when that is accepted', async () => {
    const dataDir = servers.dataDir();
    // A parameter set written against another state of the registry: its stored hash of the
    // water side is not the current one.
    const set = join(dataDir, 'anchored-old.json');
    writeFileSync(
      set,
      JSON.stringify({
        format: 'spotless.params',
        version: 1,
        provenance: { name: 'anchored-old', origin: 'calibration' },
        overrides: { 'soil.egg_yolk.rateRef': 3.4e-5 },
        definitions: { 'soil.egg_yolk.rateRef': { kind: 'scalar', unit: 'kg/(m2 s)' } },
        registryHash: `sha256:${'0'.repeat(64)}`,
        hydroHash: `sha256:${'0'.repeat(64)}`,
        soilHash: `sha256:${'0'.repeat(64)}`,
      }),
    );
    const washParams = { paramSets: [set], detergent: { name: 'Capsule', dose_g: 12.9 } };

    const strict = await servers.server({
      dataDir,
      washRunner: WASH_RUNNER,
      washParams,
      washTier: 'fast',
    });
    const id = await loaded(strict);
    await call(strict, 'POST', `/api/sessions/${id}/start_cycle`);
    const failed = await reportWhenEnded(strict, id);
    expect(failed.status).toBe('failed');
    const error = (failed as { error?: string }).error ?? '';
    expect(error).toMatch(/parameter set "anchored-old"/);
    expect(error).toMatch(/is stale/);
    expect(error).toMatch(/What to do/);
    expect(error).toMatch(/--accept-stale-params/);
    expect(JSON.stringify(failed)).not.toContain('points');
    await strict.close();

    // Accepted knowingly: the wash runs, and the report says which sets, which detergent and
    // which source produced it, and that the set was stale.
    const accepting = await servers.server({
      dataDir: servers.dataDir(),
      washRunner: WASH_RUNNER,
      washParams,
      acceptStaleParams: true,
      washTier: 'fast',
    });
    const again = await loaded(accepting);
    await call(accepting, 'POST', `/api/sessions/${again}/start_cycle`);
    const report = await doneReport(accepting, again);
    expect(report.job.sim_version).toMatch(
      /parameters anchored-old \(stale\); detergent Capsule 12\.9 g; source [0-9a-f]{16}$/,
    );
    expect(report.job.notes?.join(' ')).toMatch(/anchored-old was made for another state/);
    const [job] = await jobsOf(accepting);
    expect(job?.stats).toMatchObject({
      param_sets: [{ name: 'anchored-old', stale: true }],
      detergent: { name: 'Capsule', dose_g: 12.9 },
    });
    expect(job?.stats?.source).toMatch(/^[0-9a-f]{64}$/);
  }, 300_000);
});
