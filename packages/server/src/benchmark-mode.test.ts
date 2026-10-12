// Benchmark mode beyond who creates sessions: what a participant's link does not open, the
// load that is frozen once the cycle has been started, the report that is kept as delivered,
// and the record of every wash of an episode.
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { GetReportResult, LevelCard, WashRunner } from '@spotless/session';
import { placeholderWashRunner } from '@spotless/session';
import { describe, expect, it } from 'vitest';
import type { SpotlessServer } from './app.ts';
import type { EpisodeRecord } from './episode.ts';
import {
  OPEN_MODE,
  call,
  mustPlace,
  newSession,
  reportWhenEnded,
  useServers,
} from './test-util.ts';
import type { RestoreSummary } from './types.ts';

const servers = useServers();

const BOWL = {
  item_id: 'bowl_01',
  frame: 'lower_rack',
  position_mm: [420, 270, 200],
  orientation: { preset: 'inverted' },
} as const;

/** A call without the admin token: what a participant with a link can make. */
async function asPlayer(
  server: SpotlessServer,
  method: 'GET' | 'POST' | 'DELETE',
  url: string,
  body?: object,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await server.app.inject({
    method,
    url,
    ...(body === undefined ? {} : { payload: body }),
  });
  return { status: response.statusCode, body: response.json<Record<string, unknown>>() };
}

/** Fails the first wash it is asked for and answers the rest like the placeholder. */
function failingOnce(): WashRunner {
  let calls = 0;
  return (manifest, onProgress) => {
    calls += 1;
    if (calls === 1) return Promise.reject(new Error('the GPU was lost'));
    return placeholderWashRunner(manifest, onProgress);
  };
}

describe('benchmark mode', () => {
  it('keeps levels, logs, jobs, closing and restoring to the harness, and serves the card through the session', async () => {
    const server = await servers.server({ washRunner: placeholderWashRunner });
    const id = await newSession(server);
    await mustPlace(server, id, BOWL);
    await call(server, 'POST', `/api/sessions/${id}/start_cycle`, {});
    await reportWhenEnded(server, id);
    for (const [method, url] of [
      ['GET', '/api/levels'],
      ['GET', '/api/levels/weeknight-dinner'],
      ['GET', `/api/sessions/${id}/log`],
      ['GET', `/api/jobs/${id}.1`],
      ['POST', `/api/sessions/${id}/restore`],
      ['DELETE', `/api/sessions/${id}`],
    ] as const) {
      const refused = await asPlayer(server, method, url);
      expect(refused.status, `${method} ${url}`).toBe(403);
      expect(refused.body, `${method} ${url}`).toMatchObject({ reason: 'forbidden' });
    }
    // The harness reaches all of them.
    expect((await call(server, 'GET', `/api/jobs/${id}.1`)).status).toBe(200);
    expect((await call(server, 'GET', `/api/sessions/${id}/log`)).status).toBe(200);
    // The participant gets the card of their own level, free and unlogged.
    const before = (await call<{ events: number }>(server, 'GET', `/api/sessions/${id}`)).body;
    const card = await asPlayer(server, 'GET', `/api/sessions/${id}/card`);
    expect(card.status).toBe(200);
    expect((card.body as unknown as LevelCard).level_id).toBe('tutorial');
    const after = (await call<{ events: number }>(server, 'GET', `/api/sessions/${id}`)).body;
    expect(after.events).toBe(before.events);
    // A camera nobody could hold is a malformed request, not a picture.
    const absurd = await asPlayer(server, 'POST', `/api/sessions/${id}/render`, {
      view: 'custom',
      options: {
        camera: {
          azimuth_deg: 1e308,
          elevation_deg: 0,
          target_mm: [0, 0, 0],
          distance_mm: 1e-300,
          fov_deg: 35,
        },
      },
    });
    expect(absurd.status).toBe(400);
  });

  it('freezes the load after a failed wash and records every wash of the episode', async () => {
    const server = await servers.server({ washRunner: failingOnce() });
    const id = await newSession(server);
    await mustPlace(server, id, BOWL);
    const started = await call<{ state_hash: string }>(
      server,
      'POST',
      `/api/sessions/${id}/start_cycle`,
      {},
    );
    expect(await reportWhenEnded(server, id)).toMatchObject({ status: 'failed' });
    // The wash was given back, but what was committed is what is washed: no change of load.
    for (const [action, body] of [
      ['place', { ...BOWL, item_id: 'mug_01', position_mm: [150, 150, 200] }],
      ['remove', { item_id: 'bowl_01' }],
      ['reset', {}],
      ['set_rack', { rack: 'upper_rack', option: { name: 'position', value: 'out' } }],
    ] as const) {
      const refused = await asPlayer(server, 'POST', `/api/sessions/${id}/${action}`, body);
      expect(refused.status, action).toBe(409);
      expect(refused.body, action).toMatchObject({ accepted: false, reason: 'load_frozen' });
    }
    // Nothing of that reached the session's log.
    const log = (await call<{ log: { name: string }[] }>(server, 'GET', `/api/sessions/${id}/log`))
      .body.log;
    expect(log.filter((event) => event.name !== 'get_report').map((event) => event.name)).toEqual([
      'place',
      'start_cycle',
    ]);
    const again = await call(server, 'POST', `/api/sessions/${id}/start_cycle`, {});
    expect(again.body).toMatchObject({ accepted: true });
    expect(await reportWhenEnded(server, id)).toMatchObject({ status: 'done' });

    const record = (await call<EpisodeRecord>(server, 'GET', `/api/sessions/${id}/episode`)).body;
    expect(record.washes).toHaveLength(2);
    expect(record.washes?.[0]).toMatchObject({
      job_id: `${id}.1`,
      status: 'failed',
      error: 'the GPU was lost',
      state_hash: started.body.state_hash,
    });
    expect(record.washes?.[1]).toMatchObject({ job_id: `${id}.2`, status: 'done' });
    // The same load both times.
    expect(record.washes?.[1]?.state_hash).toBe(record.washes?.[0]?.state_hash);
    expect(record.wash).toMatchObject({ job_id: `${id}.2`, status: 'done', tier: 'official' });
  });

  it('keeps the report as it was delivered, and does not restore an episode by washing it again', async () => {
    const dataDir = servers.dataDir();
    let washes = 0;
    const counting: WashRunner = (manifest, onProgress) => {
      washes += 1;
      return placeholderWashRunner(manifest, onProgress);
    };
    const first = await servers.server({ dataDir, washRunner: counting });
    const id = await newSession(first);
    await mustPlace(first, id, BOWL);
    await call(first, 'POST', `/api/sessions/${id}/start_cycle`, {});
    const delivered = await reportWhenEnded(first, id);
    if (!delivered.accepted || delivered.status !== 'done') throw new Error('no report');
    expect(existsSync(join(dataDir, 'reports', `${id}.1.json`))).toBe(true);
    await first.close();

    // The result cache is gone (as for a wash whose result was never kept): the restored
    // session answers with the report it was given, and nothing is washed.
    for (const name of readdirSync(join(dataDir, 'washes'))) rmSync(join(dataDir, 'washes', name));
    const second = await servers.server({ dataDir, washRunner: counting });
    const restored = await call<RestoreSummary>(second, 'POST', `/api/sessions/${id}/restore`);
    expect(restored.body).toMatchObject({ verified: true });
    const again = (await call<GetReportResult>(second, 'GET', `/api/sessions/${id}/get_report`))
      .body;
    expect(again).toMatchObject({ status: 'done' });
    if (!again.accepted || again.status !== 'done') throw new Error('no report');
    expect(again.report).toEqual(delivered.report);
    expect(washes).toBe(1);
    await second.close();

    // Without the delivered report either, benchmark mode refuses to restore.
    rmSync(join(dataDir, 'reports', `${id}.1.json`));
    const third = await servers.server({ dataDir, washRunner: counting });
    const refused = await call(third, 'POST', `/api/sessions/${id}/restore`);
    expect(refused.status).toBe(409);
    expect(refused.body).toMatchObject({ reason: 'restore_failed' });
    expect(String((refused.body as { detail?: string }).detail)).toContain('no longer stored');
    expect(washes).toBe(1);
    await third.close();

    // Local play washes the load again, and the record says so.
    const open = await servers.server({ dataDir, washRunner: counting, ...OPEN_MODE });
    const rewashed = await call<RestoreSummary>(open, 'POST', `/api/sessions/${id}/restore`);
    expect(rewashed.body).toMatchObject({ verified: true });
    expect(washes).toBe(2);
    const entry = await open.manager.get(id);
    const record = open.manager.episodeRecord(entry);
    expect(record.wash?.rewashed_with).toBeDefined();
    expect(record.report).not.toBeNull();
  });
});
