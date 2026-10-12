import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GetReportResult, SceneState, StartCycleResult, WashRunner } from '@spotless/session';
import { placeholderWashRunner } from '@spotless/session';
import { describe, expect, it } from 'vitest';
import type { SpotlessServer } from './app.ts';
import {
  call,
  mustPlace,
  newSession,
  OPEN_MODE,
  reportWhenEnded,
  TEST_ADMIN_TOKEN,
  useServers,
} from './test-util.ts';
import type { SessionSummary, WashJobRecord, WashOptionsPayload } from './types.ts';
import { estimateWashSeconds, WASH_SECONDS_MODEL } from './wash-estimate.ts';

const servers = useServers();

/** A runner that notes the tier it was asked for and washes nothing. */
function tierRunner(): { runner: WashRunner; tiers: (string | undefined)[] } {
  const tiers: (string | undefined)[] = [];
  const runner = (async (
    manifest: Parameters<WashRunner>[0],
    onProgress: Parameters<WashRunner>[1],
    context?: { readonly tier?: string },
  ) => {
    tiers.push(context?.tier);
    return placeholderWashRunner(manifest, onProgress);
  }) as WashRunner;
  return { runner, tiers };
}

/** A session with the bowl in the lower basket and a fork beside it. */
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

/** The job record of the first wash of a session (the helper calls as the harness). */
const jobOf = async (server: SpotlessServer, id: string): Promise<WashJobRecord> =>
  (await call<WashJobRecord>(server, 'GET', `/api/jobs/${id}.1`)).body;

/** The hash of the washed load in an answer of `get_report`, when the wash is done. */
function washedHash(answer: Record<string, unknown>): string | null {
  const report = answer['report'] as { state_hash?: unknown } | undefined;
  return answer['status'] === 'done' && typeof report?.state_hash === 'string'
    ? report.state_hash
    : null;
}

describe('a choice of wash', () => {
  it('open mode: the page chooses the tier of each wash, and the server says so', async () => {
    const { runner, tiers } = tierRunner();
    const server = await servers.server({ ...OPEN_MODE, washRunner: runner });
    const health = await call<{ wash_choice: boolean; wash_tier: string }>(
      server,
      'GET',
      '/api/health',
    );
    expect(health.body.wash_choice).toBe(true);
    expect(health.body.wash_tier).toBe('official');

    const id = await loaded(server);
    const options = await call<WashOptionsPayload>(
      server,
      'GET',
      `/api/sessions/${id}/wash_options`,
    );
    expect(options.body.choice).toBe(true);
    expect(options.body.tier).toBe('official');
    expect(options.body.items).toBe(1);
    expect(options.body.options.map((o) => [o.tier, o.scored])).toEqual([
      ['fast', false],
      ['official', true],
    ]);
    expect(options.body.options[0]?.seconds).toBeLessThan(options.body.options[1]?.seconds ?? 0);

    const started = await call<StartCycleResult>(
      server,
      'POST',
      `/api/sessions/${id}/start_cycle?wash_tier=fast`,
    );
    expect(started.body.accepted).toBe(true);
    await reportWhenEnded(server, id);
    expect(tiers).toEqual(['fast']);
    expect((await jobOf(server, id)).tier).toBe('fast');
    // The choice is noted with the session, not logged as part of the game's request.
    const file = readFileSync(join(server.store.dir, 'sessions', `${id}.jsonl`), 'utf8');
    expect(file).toContain('"wash_tier":"fast"');
    const log = await call<{ log: { name: string; args: unknown }[] }>(
      server,
      'GET',
      `/api/sessions/${id}/log`,
    );
    expect(log.body.log.find((event) => event.name === 'start_cycle')?.args).toEqual({});
  });

  it('open mode: without a choice the wash runs at the tier of the server', async () => {
    const { runner, tiers } = tierRunner();
    const server = await servers.server({ ...OPEN_MODE, washRunner: runner, washTier: 'fast' });
    const id = await loaded(server);
    await call(server, 'POST', `/api/sessions/${id}/start_cycle`);
    await reportWhenEnded(server, id);
    expect(tiers).toEqual(['fast']);
  });

  it('refuses a tier that is none', async () => {
    const server = await servers.server({ ...OPEN_MODE, washRunner: tierRunner().runner });
    const id = await loaded(server);
    const bad = await call(server, 'POST', `/api/sessions/${id}/start_cycle?wash_tier=quick`);
    expect(bad.status).toBe(400);
    const summary = await call<SessionSummary>(server, 'GET', `/api/sessions/${id}`);
    expect(summary.body.phase).toBe('loading');
  });

  it('benchmark mode: the wash runs at the official tier whatever is asked', async () => {
    const { runner, tiers } = tierRunner();
    const server = await servers.server({ adminToken: TEST_ADMIN_TOKEN, washRunner: runner });
    const health = await call<{ wash_choice: boolean }>(server, 'GET', '/api/health');
    expect(health.body.wash_choice).toBe(false);
    const id = await loaded(server);
    const options = await call<WashOptionsPayload>(
      server,
      'GET',
      `/api/sessions/${id}/wash_options`,
    );
    expect(options.body.choice).toBe(false);
    expect(options.body.tier).toBe('official');
    const started = await call<StartCycleResult>(
      server,
      'POST',
      `/api/sessions/${id}/start_cycle?wash_tier=fast`,
    );
    expect(started.body.accepted).toBe(true);
    await reportWhenEnded(server, id);
    expect(tiers).toEqual(['official']);
    expect((await jobOf(server, id)).tier).toBe('official');
    const file = readFileSync(join(server.store.dir, 'sessions', `${id}.jsonl`), 'utf8');
    expect(file).not.toContain('wash_tier');
    // And no second session is made to wash the load again.
    const again = await call(server, 'POST', `/api/sessions/${id}/rewash`, {});
    expect(again.status).toBe(403);
  });

  it('after a preview the same load is washed in full in a session of its own', async () => {
    const { runner, tiers } = tierRunner();
    const server = await servers.server({ ...OPEN_MODE, washRunner: runner });
    const id = await loaded(server);
    await mustPlace(server, id, {
      item_id: 'glass_01',
      frame: 'lower_rack',
      position_mm: [150, 150, 250],
      orientation: { preset: 'inverted' },
    });
    // A query and a refused action on the way: both are part of what is replayed.
    await call(server, 'POST', `/api/sessions/${id}/check_load`, {});
    await call(server, 'POST', `/api/sessions/${id}/remove`, { item_id: 'mug_01' });
    const before = await call<{ state: SceneState }>(server, 'GET', `/api/sessions/${id}/scene`);
    expect(before.body.state.placed.length).toBe(2);
    await call(server, 'POST', `/api/sessions/${id}/start_cycle?wash_tier=fast`);
    const preview = await reportWhenEnded(server, id);
    expect(preview['status']).toBe('done');

    const again = await call<{ session_id: string; rewash_of: string }>(
      server,
      'POST',
      `/api/sessions/${id}/rewash`,
      {},
    );
    expect(again.status).toBe(201);
    const next = again.body.session_id;
    expect(next).not.toBe(id);
    expect(again.body.rewash_of).toBe(id);
    const full = await reportWhenEnded(server, next);
    expect(full['status']).toBe('done');
    expect(tiers).toEqual(['fast', 'official']);
    expect((await jobOf(server, next)).tier).toBe('official');

    // The same load: the same scene hash when the cycle started, the same budgets used.
    const first = await call<SessionSummary>(server, 'GET', `/api/sessions/${id}`);
    const second = await call<SessionSummary>(server, 'GET', `/api/sessions/${next}`);
    expect(second.body.state_hash).toBe(first.body.state_hash);
    expect(second.body.budget).toEqual(first.body.budget);
    expect(second.body.phase).toBe('finished');
    expect(washedHash(full)).not.toBeNull();
    expect(washedHash(full)).toBe(washedHash(preview));
    // The first session keeps its preview and is not touched.
    const kept = await call<GetReportResult>(server, 'GET', `/api/sessions/${id}/get_report`);
    expect(kept.body.accepted && kept.body.status === 'done').toBe(true);
    // The new session's file says what it is.
    const file = readFileSync(join(server.store.dir, 'sessions', `${next}.jsonl`), 'utf8');
    expect(file).toContain(`"rewash_of":"${id}"`);
    expect(file).toContain('"wash_tier":"official"');
  });

  it('a session that has not washed has nothing to wash again', async () => {
    const server = await servers.server({ ...OPEN_MODE, washRunner: tierRunner().runner });
    const id = await loaded(server);
    const again = await call(server, 'POST', `/api/sessions/${id}/rewash`, {});
    expect(again.status).toBe(400);
  });
});

describe('the time a wash is expected to take', () => {
  it('without a history it is the figure measured on the reference machine', () => {
    const fast = estimateWashSeconds('fast', 44, null);
    const official = estimateWashSeconds('official', 44, null);
    expect(fast).toEqual({
      seconds: Math.round(WASH_SECONDS_MODEL.fast.base + 44 * WASH_SECONDS_MODEL.fast.perItem),
      basis: 'built-in',
    });
    expect(official.seconds).toBe(150);
    expect(official.seconds).toBeGreaterThan(5 * fast.seconds);
    expect(estimateWashSeconds('fast', 44, 'not json').basis).toBe('built-in');
  });

  it('with a history it follows what washes took on this machine', () => {
    const record = (tier: string, items: number, total: number, computed = 1): unknown => ({
      tier,
      items,
      stage_s: { scene: total / 4, exposure: (3 * total) / 4 },
      exposure_computed: computed,
    });
    const history = JSON.stringify({
      version: 1,
      records: [
        // Twice as slow as the reference machine at the official tier, on two loads.
        record('official', 10, 2 * (74.3 + 17.1)),
        record('official', 40, 2 * (74.3 + 68.4)),
        // A wash answered from the exposure cache says nothing about computing one.
        record('official', 40, 3, 0),
        record('fast', 40, 21.1),
      ],
    });
    const official = estimateWashSeconds('official', 20, history);
    expect(official.basis).toBe('history');
    expect(official.seconds).toBe(Math.round(2 * (74.3 + 34.2)));
    const fast = estimateWashSeconds('fast', 40, history);
    expect(fast).toEqual({ seconds: 21, basis: 'history' });
  });

  it('a tier not washed at yet takes the pace of the other', () => {
    // Previews four times slower than on the reference machine, and no full wash yet.
    const history = JSON.stringify({
      version: 1,
      records: [
        { tier: 'fast', items: 7, stage_s: { all: 4 * (10.3 + 7 * 0.27) }, exposure_computed: 1 },
      ],
    });
    const official = estimateWashSeconds('official', 7, history);
    expect(official.basis).toBe('history');
    expect(official.seconds).toBe(Math.round(4 * (74.3 + 7 * 1.71)));
  });

  it('is read from the timings file of the data directory', async () => {
    const dataDir = servers.dataDir();
    const server = await servers.server({ ...OPEN_MODE, dataDir, washRunner: tierRunner().runner });
    writeFileSync(
      join(dataDir, 'wash-timings.json'),
      JSON.stringify({
        version: 1,
        records: [{ tier: 'fast', items: 1, stage_s: { exposure: 60 }, exposure_computed: 1 }],
      }),
    );
    const id = await loaded(server);
    const options = await call<WashOptionsPayload>(
      server,
      'GET',
      `/api/sessions/${id}/wash_options`,
    );
    expect(options.body.options[0]).toMatchObject({ tier: 'fast', basis: 'history' });
    expect(options.body.options[0]?.seconds).toBeGreaterThan(50);
    // The full wash, not yet run here, is estimated at the pace of the previews.
    expect(options.body.options[1]).toMatchObject({ tier: 'official', basis: 'history' });
    expect(options.body.options[1]?.seconds).toBeGreaterThan(300);
  });
});
