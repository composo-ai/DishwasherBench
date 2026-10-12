import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GetReportResult, StartCycleResult } from '@spotless/session';
import { describe, expect, it } from 'vitest';
import type { SpotlessServer } from './app.ts';
import {
  call,
  mustPlace,
  newSession,
  PLACEHOLDER_RUNNER,
  reportWhenEnded,
  testRunner,
  useServers,
  watch,
} from './test-util.ts';
import type {
  ServerMessage,
  SessionSummary,
  StateMessage,
  WashJobRecord,
  WashMessage,
} from './types.ts';
import { simulationFingerprint, WASH_RUNNER } from './wash-runner.ts';

const servers = useServers();

const isWash = (m: ServerMessage): m is WashMessage => m.type === 'wash';

/** A session with the bowl in the lower basket: the same load every time. */
async function loaded(server: SpotlessServer): Promise<string> {
  const id = await newSession(server);
  await mustPlace(server, id, {
    item_id: 'bowl_01',
    frame: 'lower_rack',
    position_mm: [420, 270, 200],
    orientation: { preset: 'inverted' },
  });
  return id;
}

describe('wash jobs', () => {
  it('runs the wash in the worker process with progress by WebSocket and by polling', async () => {
    const dataDir = servers.dataDir();
    const server = await servers.server({ dataDir, washRunner: testRunner('steppedRunner') });
    const id = await loaded(server);
    const watcher = await watch(server, id);
    const started = await call<StartCycleResult>(server, 'POST', `/api/sessions/${id}/start_cycle`);
    expect(started.body.accepted).toBe(true);
    if (!started.body.accepted) return;

    // Polling while it runs: the server answers, and the answers are never a score.
    const seen = new Set<string>();
    const polled: number[] = [];
    for (;;) {
      const report = await call<GetReportResult>(server, 'GET', `/api/sessions/${id}/get_report`);
      if (!report.body.accepted) throw new Error('get_report was rejected');
      seen.add(report.body.status);
      if (report.body.status === 'running') polled.push(report.body.progress);
      if (report.body.status === 'done' || report.body.status === 'failed') break;
      expect(report.body).not.toHaveProperty('report');
      await new Promise<void>((next) => setTimeout(next, 20));
    }
    expect(seen.has('done')).toBe(true);
    expect(seen.has('running')).toBe(true);
    expect(Math.max(...polled)).toBeGreaterThan(0);
    expect([...polled].sort((x, y) => x - y)).toEqual(polled);

    // The same over the WebSocket: queued, running with rising progress, done, then the scene.
    await watcher.waitFor((m): m is StateMessage => m.type === 'state' && m.cause.kind === 'wash');
    const pushed = watcher.messages.filter(isWash);
    expect(pushed[0]).toMatchObject({ status: 'queued', progress: 0 });
    expect(pushed.at(-1)).toMatchObject({ status: 'done', progress: 1 });
    const running = pushed.filter((m) => m.status === 'running').map((m) => m.progress);
    expect(running.length).toBeGreaterThan(3);
    expect([...running].sort((x, y) => x - y)).toEqual(running);
    expect(pushed.every((m) => m.job_id === (started.body as { job_id: string }).job_id)).toBe(
      true,
    );
    watcher.close();

    // The job and its result are on disk.
    const jobs = await call<{ jobs: WashJobRecord[] }>(server, 'GET', '/api/jobs');
    const job = jobs.body.jobs[0];
    expect(job).toMatchObject({ session_id: id, status: 'done', cached: false, progress: 1 });
    if (job === undefined) return;
    expect(job.runner.export_name).toBe('steppedRunner');
    const byId = await call<WashJobRecord>(server, 'GET', `/api/jobs/${job.job_id}`);
    expect(byId.body).toEqual(job);
    expect(JSON.parse(readFileSync(join(dataDir, 'jobs', `${job.job_id}.json`), 'utf8'))).toEqual(
      job,
    );
    const result = JSON.parse(
      readFileSync(join(dataDir, 'washes', `${job.cache_key}.json`), 'utf8'),
    ) as { report: { state_hash: string } };
    expect(result.report.state_hash).toBe(started.body.state_hash);

    // The same load in another session is answered from the cache; another load is not.
    const twin = await loaded(server);
    await call(server, 'POST', `/api/sessions/${twin}/start_cycle`);
    const twinReport = await reportWhenEnded(server, twin);
    expect(twinReport.status).toBe('done');
    const other = await newSession(server);
    await mustPlace(server, other, {
      item_id: 'bowl_01',
      frame: 'lower_rack',
      position_mm: [400, 270, 200],
      orientation: { preset: 'inverted' },
    });
    await call(server, 'POST', `/api/sessions/${other}/start_cycle`);
    await reportWhenEnded(server, other);
    const all = (await call<{ jobs: WashJobRecord[] }>(server, 'GET', '/api/jobs')).body.jobs;
    expect(all.map((j) => [j.session_id, j.cached])).toEqual([
      [id, false],
      [twin, true],
      [other, false],
    ]);
    expect(all[1]?.cache_key).toBe(job.cache_key);
    expect(all[2]?.cache_key).not.toBe(job.cache_key);
    expect(readdirSync(join(dataDir, 'washes'))).toHaveLength(2);
  });

  it('takes one wash at a time: the second waits as queued', async () => {
    const server = await servers.server({ washRunner: testRunner('steppedRunner') });
    const a = await loaded(server);
    const b = await newSession(server);
    await mustPlace(server, b, {
      item_id: 'mug_01',
      frame: 'lower_rack',
      position_mm: [420, 270, 200],
      orientation: { preset: 'inverted' },
    });
    await call(server, 'POST', `/api/sessions/${a}/start_cycle`);
    await call(server, 'POST', `/api/sessions/${b}/start_cycle`);
    const waiting = await call<GetReportResult>(server, 'GET', `/api/sessions/${b}/get_report`);
    expect(waiting.body).toMatchObject({ accepted: true, status: 'queued' });
    expect((await call<SessionSummary>(server, 'GET', `/api/sessions/${b}`)).body.job?.status).toBe(
      'queued',
    );
    const health = await call<{ washes_pending: number }>(server, 'GET', '/api/health');
    expect(health.body.washes_pending).toBe(2);
    expect((await reportWhenEnded(server, a)).status).toBe('done');
    expect((await reportWhenEnded(server, b)).status).toBe('done');
    const jobs = (await call<{ jobs: WashJobRecord[] }>(server, 'GET', '/api/jobs')).body.jobs;
    const [first, second] = jobs;
    if (first?.finished_at === undefined || second?.started_at === undefined) {
      throw new Error('the jobs have no times');
    }
    expect(second.started_at >= first.finished_at).toBe(true);
  });

  it.each([
    ['throwingRunner', 'the simulated GPU was lost'],
    ['crashingRunner', 'ended without a report'],
    ['emptyReportRunner', 'the report is for another level'],
  ])('reports a wash that fails (%s) as a failure, never as a score', async (runner, error) => {
    const dataDir = servers.dataDir();
    const server = await servers.server({ dataDir, washRunner: testRunner(runner) });
    const id = await loaded(server);
    const watcher = await watch(server, id);
    const started = await call<StartCycleResult>(server, 'POST', `/api/sessions/${id}/start_cycle`);
    expect(started.body.accepted).toBe(true);
    const report = await reportWhenEnded(server, id);
    expect(report).toMatchObject({ accepted: true, status: 'failed' });
    expect(String(report.error)).toContain(error);
    expect(report).not.toHaveProperty('report');
    expect(JSON.stringify(report)).not.toContain('points');
    const pushed = await watcher.waitFor(
      (m): m is WashMessage => isWash(m) && m.status === 'failed',
    );
    expect(pushed.error).toContain(error);
    watcher.close();
    // Nothing went into the result cache, the wash was given back and the player can go on.
    expect(readdirSync(join(dataDir, 'washes'))).toEqual([]);
    const summary = await call<SessionSummary>(server, 'GET', `/api/sessions/${id}`);
    expect(summary.body.phase).toBe('loading');
    expect(summary.body.budget.washes_used).toBe(0);
    const job = (await call<{ jobs: WashJobRecord[] }>(server, 'GET', '/api/jobs')).body.jobs[0];
    expect(job).toMatchObject({ status: 'failed' });
    expect(existsSync(join(dataDir, 'jobs', `${job?.job_id}.json`))).toBe(true);
  });

  it('stops a wash that overruns its time limit', async () => {
    const server = await servers.server({
      washRunner: () => new Promise(() => undefined),
      washTimeoutMs: 50,
    });
    const id = await loaded(server);
    await call(server, 'POST', `/api/sessions/${id}/start_cycle`);
    const report = await reportWhenEnded(server, id);
    expect(report).toMatchObject({ status: 'failed', error: 'wash timed out after 50 ms' });
  });

  it('is wired to the wash simulation, keyed by the source of the simulation', () => {
    expect(WASH_RUNNER).toMatchObject({
      module: '@spotless/wash-runner',
      exportName: 'simWashRunner',
    });
    // The version carries a fingerprint of the source: the same while nothing changes.
    expect(WASH_RUNNER.version).toMatch(/^wash-runner \d+\+src\.[0-9a-f]{16}$/);
    expect(simulationFingerprint()).toMatch(/^[0-9a-f]{64}$/);
  });

  it('fingerprints the source of what a wash depends on, and nothing else', () => {
    const dir = servers.dataDir();
    const write = (path: string, text: string): void => {
      mkdirSync(join(dir, path, '..'), { recursive: true });
      writeFileSync(join(dir, path), text);
    };
    write('sim-jets/src/jets.ts', 'export const a = 1;\n');
    write('sim-jets/src/jets.test.ts', 'a test\n');
    write('catalogue/src/data/soils.json', '{}\n');
    write('server/src/app.ts', 'not part of a wash\n');
    const before = simulationFingerprint(dir);
    // Tests and packages a wash does not depend on leave it alone.
    write('sim-jets/src/jets.test.ts', 'another test\n');
    write('server/src/app.ts', 'changed\n');
    expect(simulationFingerprint(dir)).toBe(before);
    // Code and data of the simulation change it.
    write('sim-jets/src/jets.ts', 'export const a = 2;\n');
    const afterCode = simulationFingerprint(dir);
    expect(afterCode).not.toBe(before);
    write('catalogue/src/data/soils.json', '{"x":1}\n');
    expect(simulationFingerprint(dir)).not.toBe(afterCode);
  });

  it('runs the placeholder when asked to, which says that it simulates nothing', async () => {
    const server = await servers.server({ washRunner: PLACEHOLDER_RUNNER });
    const id = await loaded(server);
    await call(server, 'POST', `/api/sessions/${id}/start_cycle`);
    const report = (await reportWhenEnded(server, id)) as unknown as GetReportResult;
    if (!report.accepted || report.status !== 'done') throw new Error('the wash did not end well');
    expect(report.report.job.fidelity).toBe('placeholder_not_simulated');
    const bowl = report.report.items.find((item) => item.item_id === 'bowl_01');
    expect(bowl).toMatchObject({ loaded: true, simulated: false });
    // A runner that makes no residue maps leaves none to fetch.
    const residue = await call(server, 'GET', `/api/sessions/${id}/residue_map?item_id=bowl_01`);
    expect(residue.body).toMatchObject({ accepted: false, reason: 'no_residue_map' });
  });
});
