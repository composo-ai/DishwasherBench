import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RENDER_CHORD_ERROR, buildRenderMesh } from '@spotless/geometry';
import type {
  CheckLoadResult,
  GetReportResult,
  LevelCard,
  StartCycleResult,
} from '@spotless/session';
import { describe, expect, it } from 'vitest';
import { replayFile } from './cli.ts';
import { parseSessionFile } from './store.ts';
import {
  call,
  loadLowerBasket,
  mustPlace,
  mustSetRack,
  newSession,
  useServers,
  watch,
} from './test-util.ts';
import type {
  AnimationMessage,
  GeometryPayload,
  SceneView,
  ServerMessage,
  StateMessage,
  WashMessage,
} from './types.ts';

const servers = useServers();

const isAnimation = (m: ServerMessage): m is AnimationMessage => m.type === 'animation';
const isState = (m: ServerMessage): m is StateMessage => m.type === 'state';
const isWash = (m: ServerMessage): m is WashMessage => m.type === 'wash';

describe('a whole episode on the tutorial level', () => {
  it('is played over HTTP with a WebSocket watching, washed, reported and replayable', async () => {
    const dataDir = servers.dataDir();
    const server = await servers.server({ dataDir });

    const levels = await call<{
      levels: { id: string; items: number; points_available: number }[];
    }>(server, 'GET', '/api/levels');
    expect(levels.body.levels.map((l) => l.id)).toContain('tutorial');
    expect(levels.body.levels.find((l) => l.id === 'tutorial')).toMatchObject({
      items: 12,
      points_available: 64,
    });

    const created = await call<{ session_id: string; level: LevelCard; scene: SceneView }>(
      server,
      'POST',
      '/api/sessions',
      { level_id: 'tutorial' },
    );
    expect(created.status).toBe(201);
    const id = created.body.session_id;
    expect(created.body.level.items).toHaveLength(12);
    expect(created.body.scene.state.unplaced).toHaveLength(12);
    // Creating a session and looking at it costs the player nothing.
    expect(created.body.scene.state.budget).toMatchObject({ actions_used: 0, queries_used: 0 });
    // Nothing a player is given holds the seed of the wash.
    expect(JSON.stringify(created.body)).not.toContain('"seed"');

    const watcher = await watch(server, id);
    const hello = await watcher.waitFor(
      (m): m is ServerMessage & { type: 'hello' } => m.type === 'hello',
    );
    expect(hello.scene.state.state_hash).toBe(created.body.scene.state.state_hash);
    expect(hello.animation_rate_hz).toBe(30);
    expect(Object.keys(hello.scene.poses.parts)).toContain('lower_rack');

    // The lower basket and the cutlery basket.
    await loadLowerBasket(server, id);
    for (const [item, x] of [
      ['fork_01', 20],
      ['knife_01', 108],
    ] as const) {
      await mustPlace(server, id, {
        item_id: item,
        frame: 'cutlery_basket',
        position_mm: [x, 28, 240],
        orientation: { preset: 'handle_down', roll_deg: 5 },
      });
    }

    // Every accepted action was animated and followed by the scene.
    const animation = await watcher.waitFor(isAnimation);
    expect(animation.action).toBe('place');
    expect(animation.rate_hz).toBe(30);
    expect(animation.frames.length).toBeGreaterThan(1);
    expect(Object.keys(animation.frames[0]?.items ?? {})).toEqual(['plate_01']);
    const times = animation.frames.map((frame) => frame.t_s);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    const states = watcher.messages.filter(isState);
    expect(states).toHaveLength(5);
    // The last frame of an animation is where the scene says the item is.
    const firstState = states[0] as StateMessage;
    const lastSeen = [...animation.frames].reverse().find((f) => f.items.plate_01 !== undefined);
    expect(lastSeen?.items.plate_01).toEqual(firstState.scene.poses.items.plate_01);

    // The upper basket: push the lower one in, pull the upper one out.
    await mustSetRack(server, id, 'lower_rack', 'position', 'in');
    await mustSetRack(server, id, 'upper_rack', 'position', 'out');
    const travel = await watcher.waitFor(
      (m): m is AnimationMessage => m.type === 'animation' && m.action === 'set_rack',
    );
    expect(travel.frames.some((frame) => frame.parts.lower_rack !== undefined)).toBe(true);
    await mustPlace(server, id, {
      item_id: 'mug_01',
      frame: 'upper_rack',
      position_mm: [250, 380, 130],
      orientation: { preset: 'inverted' },
    });
    const glass = await mustPlace(server, id, {
      item_id: 'glass_01',
      frame: 'upper_rack',
      position_mm: [160, 440, 130],
      orientation: { preset: 'inverted' },
    });
    // Seven of the tutorial's twelve items are loaded; the rest stay on the counter.
    expect(glass.state.unplaced).toEqual([
      'fork_02',
      'glass_02',
      'soup_plate_01',
      'spoon_01',
      'spoon_02',
    ]);
    expect(glass.state.budget.actions_used).toBe(9);

    const scene = await call<SceneView>(server, 'GET', `/api/sessions/${id}/scene`);
    expect(scene.body.state.state_hash).toBe(glass.state_hash);
    expect(Object.keys(scene.body.poses.items)).toHaveLength(7);

    const check = await call<CheckLoadResult>(server, 'GET', `/api/sessions/${id}/check_load`);
    expect(check.body).toMatchObject({ accepted: true, door_closes: true, fell_out: [] });

    const before = watcher.messages.length;
    const started = await call<StartCycleResult>(server, 'POST', `/api/sessions/${id}/start_cycle`);
    expect(started.body.accepted).toBe(true);
    if (!started.body.accepted) return;
    expect(started.body.load.items).toHaveLength(7);
    expect(JSON.stringify(started.body)).not.toContain('"seed"');

    // The wash runs in the worker process and its end is pushed.
    const ended = await watcher.waitFor(
      (m): m is WashMessage => isWash(m) && (m.status === 'done' || m.status === 'failed'),
      before,
    );
    expect(ended).toMatchObject({ status: 'done', progress: 1, job_id: started.body.job_id });
    const after = await watcher.waitFor(
      (m): m is StateMessage => isState(m) && m.cause.kind === 'wash',
      before,
    );
    expect(after.scene.state.phase).toBe('finished');

    const report = await call<GetReportResult>(server, 'GET', `/api/sessions/${id}/get_report`);
    expect(report.body).toMatchObject({ accepted: true, status: 'done' });
    if (report.body.accepted && report.body.status === 'done') {
      expect(report.body.report.score.points_available).toBe(64);
      expect(report.body.report.items).toHaveLength(12);
      expect(report.body.report.items.filter((item) => item.loaded)).toHaveLength(7);
      expect(report.body.report.state_hash).toBe(started.body.state_hash);
    }

    // The episode is over: a further action is a rejection by value.
    const late = await call(server, 'POST', `/api/sessions/${id}/reset`);
    expect(late.status).toBe(200);
    expect(late.body).toMatchObject({ accepted: false, reason: 'episode_over' });
    watcher.close();

    // The log is on disk, event by event, with the outcome of the wash, and replays to the
    // same hashes in a session that nothing watched.
    const file = join(dataDir, 'sessions', `${id}.jsonl`);
    const stored = parseSessionFile(readFileSync(file, 'utf8'));
    expect(stored.header).toMatchObject({ session_id: id, level_id: 'tutorial' });
    expect(stored.lines.filter((l) => l.type === 'wash')).toHaveLength(1);
    const log = await call<{ log: { name: string }[] }>(server, 'GET', `/api/sessions/${id}/log`);
    expect(stored.lines.filter((l) => l.type === 'event')).toHaveLength(log.body.log.length);
    const replay = await replayFile(file, true);
    expect(replay).toMatchObject({ ok: true, mismatches: [], digest_mismatches: 0 });
    expect(replay.final_state_hash).toBe(started.body.state_hash);
  });

  it('serves the geometry a client draws with', async () => {
    const server = await servers.server();
    const id = await newSession(server);
    const response = await server.app.inject({ url: `/api/sessions/${id}/geometry` });
    const geometry = response.json<GeometryPayload>();
    expect(geometry.units).toEqual({ length: 'm', angle: 'rad', quaternion: 'xyzw' });
    expect(geometry.machine.machine_id).toBe('bosch_smv4hax40g');
    expect(geometry.machine.parts.map((part) => part.id)).toEqual(
      expect.arrayContaining([
        'tub',
        'door',
        'lower_rack',
        'upper_rack',
        'cutlery_basket',
        'lower_arm',
      ]),
    );
    expect(geometry.machine.affordances.tineRows.length).toBeGreaterThan(0);
    expect(geometry.items).toHaveLength(12);
    expect(Object.keys(geometry.item_types).sort()).toEqual(
      [...new Set(geometry.items.map((item) => item.item_type))].sort(),
    );
    // The shapes are what the geometry kernel builds meshes from, after the JSON round trip.
    const plate = geometry.item_types.dinner_plate_porcelain_270;
    expect(plate?.orientation_presets.map((p) => p.name)).toContain('on_edge');
    if (plate === undefined) throw new Error('no plate');
    const mesh = buildRenderMesh(plate.shape, { chordError: RENDER_CHORD_ERROR });
    expect(mesh.positions.length).toBeGreaterThan(100);
    const rack = geometry.machine.parts.find((part) => part.id === 'lower_rack');
    if (rack === undefined) throw new Error('no rack');
    expect(buildRenderMesh(rack.shape, { chordError: 0.001 }).positions.length).toBeGreaterThan(
      1000,
    );
    // Nothing in it predicts the wash or tells the soils.
    expect(JSON.stringify(geometry)).not.toMatch(/seed|soil/i);

    // The geometry is cacheable, and its key changes with the machine's configuration.
    const again = await server.app.inject({
      url: `/api/sessions/${id}/geometry`,
      headers: { 'if-none-match': response.headers.etag as string },
    });
    expect(again.statusCode).toBe(304);
    await mustSetRack(server, id, 'lower_rack', 'tine_row_r1', 'folded');
    const folded = await call<GeometryPayload>(server, 'GET', `/api/sessions/${id}/geometry`);
    expect(folded.body.geometry_key).not.toBe(geometry.geometry_key);
    const scene = await call<SceneView>(server, 'GET', `/api/sessions/${id}/scene`);
    expect(scene.body.geometry_key).toBe(folded.body.geometry_key);
    // Neither endpoint is charged to the player.
    expect(scene.body.state.budget.queries_used).toBe(0);
  });

  it('runs two sessions at once without one touching the other', async () => {
    const server = await servers.server();
    const a = await newSession(server);
    const b = await newSession(server);
    expect(a).not.toBe(b);
    const watcherA = await watch(server, a);
    const watcherB = await watch(server, b);

    // Interleaved: a plate into A, a bowl into B, the rest of A's load, a plate into B.
    const bowl = {
      item_id: 'bowl_01',
      frame: 'lower_rack' as const,
      position_mm: [420, 270, 200] as const,
      orientation: { preset: 'inverted' },
    };
    await Promise.all([loadLowerBasket(server, a), mustPlace(server, b, bowl)]);
    const stateA = await call<SceneView>(server, 'GET', `/api/sessions/${a}/scene`);
    const stateB = await call<SceneView>(server, 'GET', `/api/sessions/${b}/scene`);
    expect(stateA.body.state.placed.map((p) => p.item_id)).toEqual([
      'bowl_01',
      'plate_01',
      'plate_02',
    ]);
    expect(stateB.body.state.placed.map((p) => p.item_id)).toEqual(['bowl_01']);
    expect(stateA.body.state.budget.actions_used).toBe(3);
    expect(stateB.body.state.budget.actions_used).toBe(1);

    // Each watcher saw its own session only.
    await watcherA.waitFor(isState);
    await watcherB.waitFor(isState);
    expect(watcherA.messages.filter(isState)).toHaveLength(3);
    expect(watcherB.messages.filter(isState)).toHaveLength(1);

    // B alone, in a server of its own, comes to the same scene: A made no difference to it.
    const other = await servers.server();
    const solo = await newSession(other);
    const placed = await mustPlace(other, solo, bowl);
    expect(placed.state_hash).toBe(stateB.body.state.state_hash);

    // Both wash; the queue takes one at a time and each gets its own report.
    const [startA, startB] = await Promise.all([
      call<StartCycleResult>(server, 'POST', `/api/sessions/${a}/start_cycle`, {}),
      call<StartCycleResult>(server, 'POST', `/api/sessions/${b}/start_cycle`, {}),
    ]);
    expect(startA.body.accepted && startB.body.accepted).toBe(true);
    const doneA = await watcherA.waitFor((m): m is WashMessage => isWash(m) && m.status === 'done');
    const doneB = await watcherB.waitFor((m): m is WashMessage => isWash(m) && m.status === 'done');
    expect(doneA.job_id).toBe(doneB.job_id); // the session's own name for its first wash
    const reportA = await call<GetReportResult>(server, 'GET', `/api/sessions/${a}/get_report`);
    const reportB = await call<GetReportResult>(server, 'GET', `/api/sessions/${b}/get_report`);
    const loaded = (r: GetReportResult): number =>
      r.accepted && r.status === 'done' ? r.report.items.filter((i) => i.loaded).length : -1;
    expect(loaded(reportA.body)).toBe(3);
    expect(loaded(reportB.body)).toBe(1);
    const jobs = await call<{ jobs: { session_id: string; status: string }[] }>(
      server,
      'GET',
      '/api/jobs',
    );
    expect(jobs.body.jobs.map((job) => job.session_id).sort()).toEqual([a, b].sort());
    expect(jobs.body.jobs.every((job) => job.status === 'done')).toBe(true);
    watcherA.close();
    watcherB.close();
  });
});
