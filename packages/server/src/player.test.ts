// Who plays an episode, and the record the server keeps of it.
import { existsSync, readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { placeholderWashRunner } from '@spotless/session';
import { describe, expect, it } from 'vitest';
import { createEpisodeLink, main } from './cli.ts';
import type { EpisodeRecord } from './episode.ts';
import { EPISODE_FORMAT, isEpisodeRecord } from './episode.ts';
import { LOADING_GUIDANCE, LOADING_GUIDANCE_VERSION } from './guidance.ts';
import { parseSessionFile } from './store.ts';
import {
  TEST_ADMIN_TOKEN,
  call,
  loadLowerBasket,
  newSession,
  reportWhenEnded,
  useServers,
  watch,
} from './test-util.ts';
import type { RestoreSummary, SessionSummary } from './types.ts';

const servers = useServers();

interface PlayerAnswer {
  player: { kind: string; name: string; interface?: string } | null;
  benchmark_mode: boolean;
  name_wanted: boolean;
}

describe('the player of an episode', () => {
  it('is named by the harness when it creates the episode', async () => {
    const server = await servers.server();
    const created = await call<{ session_id: string; player: unknown }>(
      server,
      'POST',
      '/api/sessions',
      {
        level_id: 'tutorial',
        player: { kind: 'human', name: 'P07', interface: 'web' },
      },
    );
    expect(created.status).toBe(201);
    expect(created.body.player).toEqual({ kind: 'human', name: 'P07', interface: 'web' });
    const id = created.body.session_id;
    const asked = await server.app.inject({ url: `/api/sessions/${id}/player` });
    expect(asked.json<PlayerAnswer>()).toEqual({
      player: { kind: 'human', name: 'P07', interface: 'web' },
      benchmark_mode: true,
      name_wanted: false,
    });
    // A name that was given stays.
    const renamed = await server.app.inject({
      method: 'POST',
      url: `/api/sessions/${id}/player`,
      payload: { name: 'somebody else' },
    });
    expect(renamed.json()).toMatchObject({ accepted: false, reason: 'already_named' });
    expect(
      (await call<SessionSummary>(server, 'GET', `/api/sessions/${id}`)).body.player,
    ).toMatchObject({ name: 'P07' });
    // A malformed player is refused before a session exists.
    for (const player of [
      { kind: 'robot', name: 'x' },
      { kind: 'human', name: '' },
      { kind: 'human', name: 'a\nb' },
      { name: 'x' },
    ]) {
      const refused = await call(server, 'POST', '/api/sessions', { level_id: 'tutorial', player });
      expect(refused.status, JSON.stringify(player)).toBe(400);
    }
  });

  it('gives a name once in the client when the harness gave none', async () => {
    const dataDir = servers.dataDir();
    const server = await servers.server({ dataDir });
    const id = await newSession(server);
    const player = async (): Promise<PlayerAnswer> =>
      (await server.app.inject({ url: `/api/sessions/${id}/player` })).json<PlayerAnswer>();
    expect(await player()).toEqual({ player: null, benchmark_mode: true, name_wanted: true });
    for (const name of ['', '   ', 'x'.repeat(65)]) {
      const refused = await server.app.inject({
        method: 'POST',
        url: `/api/sessions/${id}/player`,
        payload: { name },
      });
      expect(refused.statusCode, JSON.stringify(name)).toBe(400);
    }
    // No admin token is needed: the player names themselves with the episode's link alone.
    const named = await server.app.inject({
      method: 'POST',
      url: `/api/sessions/${id}/player`,
      payload: { name: '  Ada L.  ' },
    });
    expect(named.json()).toEqual({
      accepted: true,
      player: { kind: 'human', name: 'Ada L.', interface: 'web' },
    });
    expect(await player()).toMatchObject({ player: { name: 'Ada L.' }, name_wanted: false });
    const second = await server.app.inject({
      method: 'POST',
      url: `/api/sessions/${id}/player`,
      payload: { name: 'Bob' },
    });
    expect(second.json()).toMatchObject({ accepted: false, reason: 'already_named' });

    // The name is in the session's file and survives a restart; it takes no part in the replay.
    await loadLowerBasket(server, id);
    await server.close();
    const again = await servers.server({ dataDir });
    const restored = await call<RestoreSummary>(again, 'POST', `/api/sessions/${id}/restore`);
    expect(restored.body).toMatchObject({ verified: true, replayed: 5 });
    expect(
      (await again.app.inject({ url: `/api/sessions/${id}/player` })).json<PlayerAnswer>().player,
    ).toEqual({
      kind: 'human',
      name: 'Ada L.',
      interface: 'web',
    });
    const stored = parseSessionFile(readFileSync(join(dataDir, 'sessions', `${id}.jsonl`), 'utf8'));
    expect(stored.player).toMatchObject({ name: 'Ada L.' });
    expect(stored.opened_at).not.toBeNull();
    expect(stored.lines.every((line) => line.type === 'event' || line.type === 'wash')).toBe(true);
  });

  it('asks nobody for a name in open mode', async () => {
    const server = await servers.server({ adminToken: undefined as never });
    const created = await server.app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { level_id: 'tutorial' },
    });
    const id = created.json<{ session_id: string }>().session_id;
    expect((await server.app.inject({ url: `/api/sessions/${id}/player` })).json()).toEqual({
      player: null,
      benchmark_mode: false,
      name_wanted: false,
    });
  });
});

describe('the episode record', () => {
  it('is written when the wash ends: what was done, with times, the report and the score', async () => {
    const dataDir = servers.dataDir();
    let tick = 0;
    const server = await servers.server({
      dataDir,
      washRunner: placeholderWashRunner,
      // A clock that advances two seconds a reading, so that the times of the record are known.
      now: () => new Date(Date.UTC(2026, 9, 10, 9, 0, 0) + 2000 * tick++).toISOString(),
    });
    const created = await call<{ session_id: string }>(server, 'POST', '/api/sessions', {
      level_id: 'tutorial',
      player: { kind: 'human', name: 'P07', interface: 'web' },
    });
    const id = created.body.session_id;
    // Before anything is played there is a record to ask for, but none on disk.
    const early = await call<EpisodeRecord>(server, 'GET', `/api/sessions/${id}/episode`);
    expect(early.body).toMatchObject({
      format: EPISODE_FORMAT,
      episode_id: id,
      events: [],
      score: null,
      wash: null,
      opened_at: null,
    });
    expect(existsSync(join(dataDir, 'episodes', `${id}.json`))).toBe(false);
    // The record is the harness's to read: a player's key does not open it.
    expect((await server.app.inject({ url: `/api/sessions/${id}/episode` })).statusCode).toBe(403);

    const watcher = await watch(server, id);
    await loadLowerBasket(server, id);
    await call(server, 'POST', `/api/sessions/${id}/place`, {
      item_id: 'bowl_01',
      frame: 'kitchen',
      position_mm: [0, 0, 0],
      orientation: { preset: 'upright' },
    });
    await call(server, 'GET', `/api/sessions/${id}/check_load`);
    await call(server, 'POST', `/api/sessions/${id}/start_cycle`, {});
    expect(await reportWhenEnded(server, id)).toMatchObject({ status: 'done' });
    await watcher.waitFor(
      (m): m is typeof m & { type: 'state' } => m.type === 'state' && m.cause.kind === 'wash',
    );
    watcher.close();

    const file = join(dataDir, 'episodes', `${id}.json`);
    expect(existsSync(file)).toBe(true);
    const record = JSON.parse(readFileSync(file, 'utf8')) as EpisodeRecord;
    expect(isEpisodeRecord(record)).toBe(true);
    expect(record).toMatchObject({
      format: EPISODE_FORMAT,
      episode_id: id,
      level: { id: 'tutorial', items: 12, points_available: 64, track: 'one_shot' },
      player: { kind: 'human', name: 'P07', interface: 'web' },
      versions: {
        guidance_version: LOADING_GUIDANCE_VERSION,
        fidelity: 'placeholder_not_simulated',
      },
      wash: { status: 'done' },
      score: {
        points: 0,
        points_available: 64,
        items_total: 12,
        items_loaded: 3,
        items_clean: 0,
        simulated: false,
      },
    });
    // No policy, no tool calls, no replay: those are the harness's to add.
    expect(record.policy).toBeUndefined();
    expect(record.agent).toBeUndefined();
    // Every call of the session's log, in order, each with the time the server wrote it.
    // (The polls of the report are in the log too; how many there were depends on the clock.)
    const names = record.events.map((event) => `${event.name}${event.accepted ? '' : '!'}`);
    expect(names.filter((name) => name !== 'get_report')).toEqual([
      'list_slots',
      'list_slots',
      'place',
      'place',
      'place',
      'place!',
      'check_load',
      'start_cycle',
    ]);
    expect(names.filter((name) => name === 'get_report').length).toBeGreaterThanOrEqual(1);
    expect(record.events.every((event) => !Number.isNaN(Date.parse(event.at)))).toBe(true);
    expect(record.counts).toMatchObject({
      actions_accepted: 4,
      actions_rejected: 1,
      queries_rejected: 0,
      by_name: { place: { accepted: 3, rejected: 1 }, start_cycle: { accepted: 1, rejected: 0 } },
    });
    expect(record.counts.queries_accepted).toBe(
      3 + (record.counts.by_name['get_report']?.accepted ?? 0),
    );
    expect(record.budget).toMatchObject({ actions_used: 3, queries_used: 3, washes_used: 1 });
    expect(record.final_state_hash).toBe(record.events[record.events.length - 1]?.state_hash);
    expect(record.load?.items.map((item) => item.item_id)).toEqual([
      'bowl_01',
      'plate_01',
      'plate_02',
    ]);
    expect(record.prechecks?.door_closes).toBe(true);
    expect(record.report?.items).toHaveLength(12);
    // The player arrived when the socket opened; the clock moved on before the cycle started.
    expect(record.opened_at).not.toBeNull();
    expect(Date.parse(record.opened_at as string)).toBeLessThan(
      Date.parse(record.events[0]?.at as string),
    );
    expect(record.time.loading_s).toBeGreaterThan(0);
    expect(record.time.loading_s).toBe(
      (Date.parse(record.cycle_started_at as string) - Date.parse(record.opened_at as string)) /
        1000,
    );
    // Actions only: nothing of the mouse, no free text, and not the seed of the wash.
    const text = JSON.stringify(record);
    expect(text).not.toMatch(/"seed"|mouse|pointer|keystroke/);
    // What the harness is given on request is the same record, brought up to date: the file
    // was written the moment the wash ended, and the report has been asked for since.
    const served = await call<EpisodeRecord>(server, 'GET', `/api/sessions/${id}/episode`);
    expect(served.body.events.slice(0, record.events.length)).toEqual(record.events);
    expect(
      served.body.events.slice(record.events.length).every((event) => event.name === 'get_report'),
    ).toBe(true);
    expect({ ...served.body, events: [], counts: null, time: null }).toEqual({
      ...record,
      events: [],
      counts: null,
      time: null,
    });
  });

  it('serves the loading guidance every player is shown', async () => {
    const server = await servers.server();
    const guidance = await server.app.inject({ url: '/api/guidance' });
    expect(guidance.json()).toEqual({
      version: LOADING_GUIDANCE_VERSION,
      title: expect.any(String) as string,
      text: LOADING_GUIDANCE,
    });
    // Manufacturer's advice only: nothing about the game or its simulation.
    expect(LOADING_GUIDANCE).not.toMatch(/simulat|\bgame\b|\bscor|Spotless|benchmark|\bmodel\b/i);
    expect(LOADING_GUIDANCE).toMatch(/spray arms/);
  });
});

describe('the link command', () => {
  it('creates an episode for a named player and prints the address that opens it', async () => {
    const server = await servers.server();
    await server.app.listen({ port: 0, host: '127.0.0.1' });
    const base = `http://127.0.0.1:${(server.app.server.address() as AddressInfo).port}`;
    const lines: string[] = [];
    const io = {
      out: (line: string) => lines.push(line),
      err: (line: string) => lines.push(`ERR ${line}`),
    };
    expect(
      await main(
        [
          'link',
          '--server',
          base,
          '--admin-token',
          TEST_ADMIN_TOKEN,
          '--level',
          'tutorial',
          '--player',
          'P12',
        ],
        io,
      ),
    ).toBe(0);
    const url = lines[0] ?? '';
    expect(url).toMatch(new RegExp(`^${base}/#[0-9a-f-]{36}$`));
    const id = url.split('#')[1] as string;
    expect(
      (await server.app.inject({ url: `/api/sessions/${id}/player` })).json<PlayerAnswer>(),
    ).toEqual({
      player: { kind: 'human', name: 'P12', interface: 'web' },
      benchmark_mode: true,
      name_wanted: false,
    });
    // Without the token, or for a level that is not there, no link.
    await expect(
      createEpisodeLink({
        server: base,
        adminToken: 'wrong-token',
        levelId: 'tutorial',
        player: 'P13',
      }),
    ).rejects.toThrow(/refused/);
    expect(
      await main(
        [
          'link',
          '--server',
          base,
          '--admin-token',
          TEST_ADMIN_TOKEN,
          '--level',
          'brunch',
          '--player',
          'P13',
        ],
        io,
      ),
    ).toBe(1);
    expect(await main(['link', '--server', base, '--level', 'tutorial'], io)).toBe(2);
  });
});
