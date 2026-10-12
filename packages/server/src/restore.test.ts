import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GetReportResult, SceneState, StartCycleResult, WashRunner } from '@spotless/session';
import { placeholderWashRunner } from '@spotless/session';
import { describe, expect, it } from 'vitest';
import {
  OPEN_MODE,
  call,
  loadLowerBasket,
  mustPlace,
  mustSetRack,
  newSession,
  reportWhenEnded,
  useServers,
} from './test-util.ts';
import type { RestoreSummary, SessionSummary } from './types.ts';

const servers = useServers();

const inline: WashRunner = (manifest, onProgress) => placeholderWashRunner(manifest, onProgress);

describe('restoring a session from its log', () => {
  it('brings a session back after it left memory, and after the server was restarted', async () => {
    const dataDir = servers.dataDir();
    const first = await servers.server({ dataDir, washRunner: inline });
    const id = await newSession(first);
    await loadLowerBasket(first, id);
    await mustSetRack(first, id, 'lower_rack', 'tine_row_r2', 'folded');
    // A rejected action and a query are part of the log too.
    const rejected = await call(first, 'POST', `/api/sessions/${id}/remove`, { item_id: 'mug_01' });
    expect(rejected.body).toMatchObject({ accepted: false, reason: 'not_placed' });
    const state = await call<SceneState>(first, 'GET', `/api/sessions/${id}/get_state`);
    const before = await call<SessionSummary>(first, 'GET', `/api/sessions/${id}`);
    // Two list_slots queries for the plates and the get_state.
    expect(before.body.budget).toMatchObject({ actions_used: 4, queries_used: 3 });

    // Out of memory: the next call restores it by replaying the log.
    const closed = await call(first, 'DELETE', `/api/sessions/${id}`);
    expect(closed.body).toMatchObject({ closed: true, stored: true });
    expect(
      (await call<{ live: string[]; stored: string[] }>(first, 'GET', '/api/sessions')).body,
    ).toEqual({
      live: [],
      stored: [id],
    });
    const back = await call<SessionSummary>(first, 'GET', `/api/sessions/${id}`);
    expect(back.body).toEqual(before.body);
    expect(back.body.state_hash).toBe(state.body.state_hash);

    // A new server on the same data directory.
    await first.close();
    const second = await servers.server({ dataDir, washRunner: inline });
    const restored = await call<RestoreSummary>(second, 'POST', `/api/sessions/${id}/restore`);
    expect(restored.status).toBe(200);
    expect(restored.body).toMatchObject({
      session_id: id,
      level_id: 'tutorial',
      replayed: before.body.events,
      verified: true,
      digest_mismatches: 0,
      wash_resumed: false,
      state_hash: state.body.state_hash,
    });

    // The game goes on where it stood, and its log goes on in the same file.
    const again = await call<SceneState>(second, 'GET', `/api/sessions/${id}/get_state`);
    expect(again.body.placed).toEqual(state.body.placed);
    expect(again.body.rack_options['lower_rack.tine_row_r2']).toBe('folded');
    await mustPlace(second, id, {
      item_id: 'fork_01',
      frame: 'cutlery_basket',
      position_mm: [20, 28, 240],
      orientation: { preset: 'handle_down', roll_deg: 5 },
    });
    const log = await call<{ log: { seq: number; name: string }[] }>(
      second,
      'GET',
      `/api/sessions/${id}/log`,
    );
    expect(log.body.log.map((event) => event.seq)).toEqual(log.body.log.map((_, index) => index));
    expect(log.body.log.at(-1)?.name).toBe('place');
    // The file holds the header and one line per event, each once (and the note of the
    // player's arrival, which is no event).
    const lines = readFileSync(join(dataDir, 'sessions', `${id}.jsonl`), 'utf8')
      .trim()
      .split('\n')
      .filter((line) => (JSON.parse(line) as { type: string }).type !== 'note');
    expect(lines).toHaveLength(1 + log.body.log.length);
  });

  it('restores a finished episode with its report, without washing again', async () => {
    const dataDir = servers.dataDir();
    let washes = 0;
    const counting: WashRunner = (manifest, onProgress) => {
      washes += 1;
      return placeholderWashRunner(manifest, onProgress);
    };
    const first = await servers.server({ dataDir, washRunner: counting });
    const id = await newSession(first);
    await loadLowerBasket(first, id);
    const started = await call<StartCycleResult>(first, 'POST', `/api/sessions/${id}/start_cycle`);
    expect(started.body.accepted).toBe(true);
    const report = await reportWhenEnded(first, id);
    expect(report.status).toBe('done');
    const late = await call(first, 'POST', `/api/sessions/${id}/reset`);
    expect(late.body).toMatchObject({ accepted: false, reason: 'episode_over' });
    expect(washes).toBe(1);
    await first.close();

    const second = await servers.server({ dataDir, washRunner: counting });
    const restored = await call<RestoreSummary>(second, 'POST', `/api/sessions/${id}/restore`);
    expect(restored.body).toMatchObject({ verified: true, wash_resumed: false });
    const summary = await call<SessionSummary>(second, 'GET', `/api/sessions/${id}`);
    expect(summary.body.phase).toBe('finished');
    expect(summary.body.job).toMatchObject({ status: 'done', progress: 1 });
    const again = await call<GetReportResult>(second, 'GET', `/api/sessions/${id}/get_report`);
    expect(again.body).toMatchObject({ accepted: true, status: 'done' });
    expect(again.body.accepted && again.body.status === 'done' && again.body.report).toEqual(
      report.report,
    );
    expect(washes).toBe(1);
  });

  it('queues again a wash that was in hand when the server went away', async () => {
    const dataDir = servers.dataDir();
    // A wash that never ends, as one cut off by the server going down.
    const first = await servers.server({ dataDir, washRunner: () => new Promise(() => undefined) });
    const id = await newSession(first);
    await mustPlace(first, id, {
      item_id: 'bowl_01',
      frame: 'lower_rack',
      position_mm: [420, 270, 200],
      orientation: { preset: 'inverted' },
    });
    const started = await call<StartCycleResult>(first, 'POST', `/api/sessions/${id}/start_cycle`);
    expect(started.body.accepted).toBe(true);
    const during = await call(first, 'POST', `/api/sessions/${id}/reset`);
    expect(during.body).toMatchObject({ accepted: false, reason: 'episode_over' });
    await first.close();

    const second = await servers.server({ dataDir, washRunner: inline });
    const restored = await call<RestoreSummary>(second, 'POST', `/api/sessions/${id}/restore`);
    expect(restored.body).toMatchObject({ verified: true, wash_resumed: true });
    const report = await reportWhenEnded(second, id);
    expect(report).toMatchObject({ accepted: true, status: 'done' });
  });

  it('replays a wash that failed as a failure, with the actions that followed it', async () => {
    const dataDir = servers.dataDir();
    const failing: WashRunner = () => Promise.reject(new Error('the pump model blew up'));
    // Local play: in benchmark mode the load is frozen once the cycle has been started.
    const first = await servers.server({ dataDir, washRunner: failing, ...OPEN_MODE });
    const id = await newSession(first);
    const bowl = {
      item_id: 'bowl_01',
      frame: 'lower_rack',
      position_mm: [420, 270, 200],
      orientation: { preset: 'inverted' },
    } as const;
    await mustPlace(first, id, bowl);
    await call(first, 'POST', `/api/sessions/${id}/start_cycle`);
    const report = await reportWhenEnded(first, id);
    expect(report).toMatchObject({ status: 'failed', error: 'the pump model blew up' });
    // The wash was given back, so the player can go on: this action is accepted.
    const removed = await call(first, 'POST', `/api/sessions/${id}/remove`, { item_id: 'bowl_01' });
    expect(removed.body).toMatchObject({ accepted: true });
    const before = await call<SessionSummary>(first, 'GET', `/api/sessions/${id}`);
    await first.close();

    // Restored by a server whose wash would succeed: the log's outcome is what counts.
    const second = await servers.server({ dataDir, washRunner: inline, ...OPEN_MODE });
    const restored = await call<RestoreSummary>(second, 'POST', `/api/sessions/${id}/restore`);
    expect(restored.body).toMatchObject({ verified: true, wash_resumed: false });
    const after = await call<SessionSummary>(second, 'GET', `/api/sessions/${id}`);
    expect(after.body).toEqual(before.body);
    expect(after.body.phase).toBe('loading');
    expect(after.body.budget.washes_used).toBe(0);
  });

  it('refuses a log that does not replay, and survives a line cut short', async () => {
    const dataDir = servers.dataDir();
    const first = await servers.server({ dataDir, washRunner: inline });
    const id = await newSession(first);
    await loadLowerBasket(first, id);
    const summary = await call<SessionSummary>(first, 'GET', `/api/sessions/${id}`);
    await first.close();
    const file = join(dataDir, 'sessions', `${id}.jsonl`);
    const original = readFileSync(file, 'utf8');

    // The process died in the middle of writing a line: the line is left out.
    appendFileSync(file, '{"type":"event","event":{"seq":4,"kind":"act');
    const second = await servers.server({ dataDir, washRunner: inline });
    const cut = await call<RestoreSummary>(second, 'POST', `/api/sessions/${id}/restore`);
    expect(cut.body).toMatchObject({ verified: true, state_hash: summary.body.state_hash });
    await second.close();

    // A log whose second plate went somewhere else no longer leads to the recorded hashes.
    const lines = original.trim().split('\n');
    const tampered = lines.map((line) => {
      const parsed = JSON.parse(line) as {
        event?: { name: string; args: { item_id?: string; position_mm?: number[] } };
      };
      if (parsed.event?.name === 'place' && parsed.event.args.item_id === 'plate_02') {
        const position = parsed.event.args.position_mm as [number, number, number];
        position[1] += 3;
      }
      return JSON.stringify(parsed);
    });
    writeFileSync(file, `${tampered.join('\n')}\n`);
    const third = await servers.server({ dataDir, washRunner: inline });
    const refused = await call(third, 'POST', `/api/sessions/${id}/restore`);
    expect(refused.status).toBe(409);
    expect(refused.body).toMatchObject({ accepted: false, reason: 'restore_failed' });
    expect(String(refused.body.detail)).toMatch(/event 3\) (state_hash|accepted)/);
    // Any other call on it is refused the same way: no session is made up from a bad log.
    const state = await call(third, 'GET', `/api/sessions/${id}/get_state`);
    expect(state.status).toBe(409);
  });

  it('sets the least recently used session aside when memory is full', async () => {
    const server = await servers.server({ maxSessions: 2, washRunner: inline });
    const a = await newSession(server);
    const b = await newSession(server);
    await mustPlace(server, a, {
      item_id: 'bowl_01',
      frame: 'lower_rack',
      position_mm: [420, 270, 200],
      orientation: { preset: 'inverted' },
    });
    await call(server, 'GET', `/api/sessions/${b}`);
    const c = await newSession(server);
    const ids = await call<{ live: string[]; stored: string[] }>(server, 'GET', '/api/sessions');
    expect(ids.body.live.sort()).toEqual([b, c].sort());
    expect(ids.body.stored).toEqual([a]);
    // A comes back with its bowl when it is next asked for, and B makes way.
    const back = await call<SceneState>(server, 'GET', `/api/sessions/${a}/get_state`);
    expect(back.body.placed.map((item) => item.item_id)).toEqual(['bowl_01']);
    expect((await call<{ live: string[] }>(server, 'GET', '/api/sessions')).body.live).toContain(a);
  });
});
