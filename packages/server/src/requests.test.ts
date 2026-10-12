import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SceneState } from '@spotless/session';
import { describe, expect, it } from 'vitest';
import { call, newSession, useServers } from './test-util.ts';
import type { SessionSummary } from './types.ts';

const servers = useServers();

const PLACE = {
  item_id: 'bowl_01',
  frame: 'lower_rack',
  position_mm: [420, 270, 200],
  orientation: { preset: 'inverted' },
};

describe('malformed requests', () => {
  it('are answered with 400 and a reason, and never reach the session', async () => {
    const server = await servers.server();
    const id = await newSession(server);
    const place = `/api/sessions/${id}/place`;
    const cases: [string, string, unknown, string][] = [
      ['a missing field', place, { ...PLACE, position_mm: undefined }, 'position_mm'],
      ['a position of two numbers', place, { ...PLACE, position_mm: [1, 2] }, 'position_mm'],
      ['a position of strings', place, { ...PLACE, position_mm: ['1', '2', '3'] }, 'position_mm'],
      ['an unknown key', place, { ...PLACE, postion_mm: [1, 2, 3] }, 'postion_mm'],
      [
        'an orientation that is neither form',
        place,
        { ...PLACE, orientation: { yaw_deg: 3 } },
        'orientation',
      ],
      [
        'an orientation that is both forms',
        place,
        { ...PLACE, orientation: { preset: 'upright', quat_wxyz: [1, 0, 0, 0] } },
        'orientation',
      ],
      [
        'a quaternion of three numbers',
        place,
        { ...PLACE, orientation: { quat_wxyz: [1, 0, 0] } },
        'orientation',
      ],
      ['an item id that is a number', place, { ...PLACE, item_id: 7 }, 'item_id'],
      ['a body that is an array', place, [PLACE], 'expected object'],
      [
        'set_rack without a value',
        `/api/sessions/${id}/set_rack`,
        { rack: 'lower_rack', option: { name: 'position' } },
        'option.value',
      ],
      ['remove without an item', `/api/sessions/${id}/remove`, {}, 'item_id'],
      ['reset with parameters', `/api/sessions/${id}/reset`, { everything: true }, 'everything'],
      [
        'a programme that is not a string',
        `/api/sessions/${id}/start_cycle`,
        { programme: 145 },
        'programme',
      ],
      ['list_slots without a rack', `/api/sessions/${id}/list_slots`, {}, 'rack'],
      ['a session without a level', '/api/sessions', {}, 'level_id'],
    ];
    for (const [what, url, body, mention] of cases) {
      const response = await call(server, 'POST', url, body);
      expect(response.status, what).toBe(400);
      expect(response.body, what).toMatchObject({ accepted: false, reason: 'invalid_argument' });
      expect(String(response.body.detail).toLowerCase(), what).toContain(mention.toLowerCase());
    }

    // Text that is not JSON, and a number that JSON cannot carry.
    for (const payload of [
      '{"item_id": "bowl_01"',
      '{"item_id":"bowl_01","frame":"lower_rack","position_mm":[NaN,0,0]}',
    ]) {
      const response = await server.app.inject({
        method: 'POST',
        url: place,
        headers: { 'content-type': 'application/json' },
        payload,
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ accepted: false, reason: 'invalid_argument' });
    }

    // None of it was logged or charged, and nothing moved.
    const summary = await call<SessionSummary>(server, 'GET', `/api/sessions/${id}`);
    expect(summary.body.events).toBe(0);
    expect(summary.body.budget).toMatchObject({ actions_used: 0, queries_used: 0 });
  });

  it('tells a malformed request from a call the session rejects', async () => {
    const server = await servers.server();
    const id = await newSession(server);
    const before = await call<SessionSummary>(server, 'GET', `/api/sessions/${id}`);
    const cases: [string, unknown, string][] = [
      ['place', { ...PLACE, item_id: 'teapot_09' }, 'unknown_item'],
      ['place', { ...PLACE, frame: 'worktop' }, 'invalid_argument'],
      ['place', { ...PLACE, orientation: { preset: 'sideways' } }, 'invalid_argument'],
      ['place', { ...PLACE, orientation: { quat_wxyz: [0, 0, 0, 0] } }, 'invalid_argument'],
      ['place', { ...PLACE, position_mm: [420, 270, 5000] }, 'out_of_bounds'],
      ['remove', { item_id: 'bowl_01' }, 'not_placed'],
      [
        'set_rack',
        { rack: 'third_rack', option: { name: 'position', value: 'out' } },
        'unknown_option',
      ],
      [
        'set_rack',
        { rack: 'lower_rack', option: { name: 'height', value: '9' } },
        'unknown_option',
      ],
      // (Eco 50 is the programme of the level and Auto 45-65 its secondary one: neither is unknown.)
      ['start_cycle', { programme: 'intensive_70' }, 'unknown_programme'],
      ['list_slots', { rack: 'third_rack' }, 'unknown_rack'],
      ['get_item', { item_id: 'teapot_09' }, 'unknown_item'],
      ['get_report', undefined, 'no_cycle_started'],
    ];
    for (const [name, body, reason] of cases) {
      const response = await call(server, 'POST', `/api/sessions/${id}/${name}`, body);
      expect(response.status, `${name} ${reason}`).toBe(200);
      expect(response.body, `${name} ${reason}`).toMatchObject({ accepted: false, reason });
    }
    // Rejected calls are free and change nothing, but the session logged them.
    const after = await call<SessionSummary>(server, 'GET', `/api/sessions/${id}`);
    expect(after.body.state_hash).toBe(before.body.state_hash);
    expect(after.body.budget).toEqual(before.body.budget);
    expect(after.body.events).toBe(cases.length);
  });

  it('answers 404 for what does not exist', async () => {
    const server = await servers.server();
    const cases: ['GET' | 'POST' | 'DELETE', string, unknown, string][] = [
      ['POST', '/api/sessions', { level_id: 'sunday-roast' }, 'unknown_level'],
      ['GET', '/api/levels/sunday-roast', undefined, 'unknown_level'],
      ['GET', '/api/sessions/nobody/get_state', undefined, 'unknown_session'],
      ['POST', '/api/sessions/nobody/place', PLACE, 'unknown_session'],
      ['POST', '/api/sessions/..%2F..%2Fetc/restore', undefined, 'unknown_session'],
      ['DELETE', '/api/sessions/nobody', undefined, 'unknown_session'],
      ['GET', '/api/jobs/nothing.1', undefined, 'unknown_job'],
      ['GET', '/api/nothing', undefined, 'invalid_argument'],
      ['POST', '/api/sessions/nobody/dance', {}, 'invalid_argument'],
    ];
    for (const [method, url, body, reason] of cases) {
      const response = await call(server, method, url, body);
      expect(response.status, url).toBe(404);
      expect(response.body, url).toMatchObject({ accepted: false, reason });
    }
    // A socket on a session that does not exist is told so and closed.
    const messages: string[] = [];
    const socket = await server.app.injectWS(
      '/api/sessions/nobody/ws',
      {},
      { onInit: (ws) => ws.on('message', (data: unknown) => messages.push(String(data))) },
    );
    await new Promise<void>((closed) => socket.on('close', () => closed()));
    expect(JSON.parse(messages[0] ?? '{}')).toMatchObject({
      type: 'error',
      reason: 'unknown_session',
    });
  });

  it('answers the queries by GET and by POST, with or without a body', async () => {
    const server = await servers.server();
    const id = await newSession(server);
    const byGet = await call<SceneState>(server, 'GET', `/api/sessions/${id}/get_state`);
    const byPost = await server.app.inject({
      method: 'POST',
      url: `/api/sessions/${id}/get_state`,
      headers: { 'content-type': 'application/json' },
    });
    expect(byPost.statusCode).toBe(200);
    expect(byPost.json<SceneState>().state_hash).toBe(byGet.body.state_hash);
    expect(byPost.json<SceneState>().budget.queries_used).toBe(2);
    const card = await call<{ level_id: string; items: unknown[] }>(
      server,
      'GET',
      `/api/sessions/${id}/get_level`,
    );
    expect(card.body.items).toHaveLength(12);
    const free = await call<{ items: unknown[] }>(server, 'GET', '/api/levels/tutorial');
    expect(free.body).toEqual(card.body);
    const item = await call(server, 'GET', `/api/sessions/${id}/get_item?item_id=mug_01`);
    expect(item.body).toMatchObject({ accepted: true, item: { item_id: 'mug_01' } });
    const preview = await call(server, 'POST', `/api/sessions/${id}/preview`, PLACE);
    expect(preview.body).toMatchObject({ accepted: true, collision_free: true, insertable: true });
    // No render service is attached to this server: the query is refused and not charged.
    const render = await call(server, 'POST', `/api/sessions/${id}/render`, { view: 'iso_lower' });
    expect(render.status).toBe(200);
    expect(render.body).toMatchObject({ accepted: false, reason: 'not_available' });
    const summary = await call<SessionSummary>(server, 'GET', `/api/sessions/${id}`);
    // get_state twice, get_level and get_item; the preview is answered free of charge.
    expect(summary.body.budget.queries_used).toBe(4);
  });

  it('charges a render to the query budget when a render service is attached', async () => {
    const server = await servers.server({
      renderer: (_session, request) =>
        Promise.resolve({
          mime_type: 'image/png' as const,
          width_px: request.options?.size_px ?? 768,
          height_px: 1,
          data_base64: '',
        }),
    });
    const id = await newSession(server);
    const render = await call(server, 'POST', `/api/sessions/${id}/render`, {
      view: 'top_lower',
      options: { size_px: 512, labels: true },
    });
    expect(render.body).toMatchObject({
      accepted: true,
      view: 'top_lower',
      image: { width_px: 512 },
    });
    const summary = await call<SessionSummary>(server, 'GET', `/api/sessions/${id}`);
    expect(summary.body.budget.queries_used).toBe(1);
    expect(summary.body.events).toBe(1);
  });
});

describe('the web client', () => {
  it('is served when it has been built, beside the API', async () => {
    const dir = join(servers.dataDir(), 'dist');
    mkdirSync(join(dir, 'assets'), { recursive: true });
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>Spotless</title>');
    writeFileSync(join(dir, 'assets', 'app.js'), 'console.log("spotless");');
    const server = await servers.server({ staticDir: dir });
    expect(server.staticDir).toBe(dir);
    const index = await server.app.inject({ url: '/' });
    expect(index.statusCode).toBe(200);
    expect(index.headers['content-type']).toContain('text/html');
    expect(index.body).toContain('Spotless');
    const script = await server.app.inject({ url: '/assets/app.js' });
    expect(script.body).toContain('spotless');
    // A path of the client's own router gets the page; the API keeps its own answers.
    const deep = await server.app.inject({ url: '/play/tutorial' });
    expect(deep.statusCode).toBe(200);
    expect(deep.body).toContain('Spotless');
    expect((await server.app.inject({ url: '/api/nothing' })).statusCode).toBe(404);
    expect((await call(server, 'GET', '/api/levels')).body).toHaveProperty('levels');
  });

  it('is left out when it has not been built', async () => {
    const server = await servers.server({ staticDir: join(servers.dataDir(), 'no-such-dist') });
    expect(server.staticDir).toBeNull();
    const index = await server.app.inject({ url: '/' });
    expect(index.statusCode).toBe(404);
    expect((await server.app.inject({ url: '/api/health' })).json()).toMatchObject({ ok: true });
  });
});
