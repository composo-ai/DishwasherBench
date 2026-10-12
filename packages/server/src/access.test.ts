// Who may reach what: a session id opens that session and nothing lists the ids.
import { describe, expect, it } from 'vitest';
import { TEST_ADMIN_TOKEN, call, newSession, useServers } from './test-util.ts';

const servers = useServers();

describe('access to sessions and jobs', () => {
  it('in benchmark mode only the harness creates and lists sessions', async () => {
    const server = await servers.server();
    const asPlayer = async (method: 'GET' | 'POST', url: string, body?: object) => {
      const response = await server.app.inject({
        method,
        url,
        ...(body === undefined ? {} : { payload: body }),
      });
      return { status: response.statusCode, body: response.json<Record<string, unknown>>() };
    };
    const health = await asPlayer('GET', '/api/health');
    expect(health.body).toMatchObject({ ok: true, benchmark_mode: true });

    // A player cannot open a session, so cannot wash a copy of an episode on the side.
    const refused = await asPlayer('POST', '/api/sessions', { level_id: 'tutorial' });
    expect(refused.status).toBe(403);
    expect(refused.body).toMatchObject({ accepted: false, reason: 'forbidden' });
    const wrong = await server.app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { 'x-spotless-admin': `${TEST_ADMIN_TOKEN}x` },
      payload: { level_id: 'tutorial' },
    });
    expect(wrong.statusCode).toBe(403);
    expect((await call(server, 'GET', '/api/sessions')).body).toEqual({ live: [], stored: [] });

    // The harness opens the episode; the player plays it with nothing but its id.
    const id = await newSession(server);
    const state = await asPlayer('GET', `/api/sessions/${id}/get_state`);
    expect(state.status).toBe(200);
    expect(state.body).toMatchObject({ phase: 'loading' });
    const placed = await asPlayer('POST', `/api/sessions/${id}/place`, {
      item_id: 'bowl_01',
      frame: 'lower_rack',
      position_mm: [420, 270, 200],
      orientation: { preset: 'inverted' },
    });
    expect(placed.body).toMatchObject({ accepted: true });

    // Nothing open to the player names a session or a job.
    for (const url of ['/api/sessions', '/api/jobs']) {
      const listing = await asPlayer('GET', url);
      expect(listing.status).toBe(403);
      expect(listing.body).toMatchObject({ accepted: false, reason: 'forbidden' });
      expect(JSON.stringify(listing.body)).not.toContain(id);
    }
    expect(JSON.stringify(health.body)).not.toContain(id);
    expect(
      (await asPlayer('GET', '/api/sessions/00000000-0000-4000-8000-000000000000')).status,
    ).toBe(404);
    expect((await call<{ live: string[] }>(server, 'GET', '/api/sessions')).body.live).toEqual([
      id,
    ]);
  });

  it('without an admin token anybody starts a session and nobody lists them', async () => {
    const server = await servers.server({ adminToken: undefined as never });
    const created = await server.app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { level_id: 'tutorial' },
    });
    expect(created.statusCode).toBe(201);
    expect((await call(server, 'GET', '/api/sessions')).status).toBe(403);
    expect((await call(server, 'GET', '/api/jobs')).status).toBe(403);
    expect((await call(server, 'GET', '/api/health')).body).toMatchObject({
      benchmark_mode: false,
    });
  });

  it('refuses an admin token that is too short to be a secret', async () => {
    await expect(servers.server({ adminToken: 'abc' })).rejects.toThrow(/admin token/);
  });
});
