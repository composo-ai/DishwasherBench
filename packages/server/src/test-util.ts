/**
 * Helpers for this package's tests (not exported from the package entry point).
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DropResult, ListSlotsResult, PlaceRequest } from '@spotless/session';
import { afterEach, expect } from 'vitest';
import type { SpotlessServer } from './app.ts';
import { buildServer } from './app.ts';
import type { ServerMessage, ServerOptions } from './types.ts';

/** A module of `test-runners.ts` as a runner for the wash worker. */
export function testRunner(exportName: string): {
  module: string;
  exportName: string;
  version: string;
} {
  return {
    module: new URL('./test-runners.ts', import.meta.url).href,
    exportName,
    version: 'test-1',
  };
}

/** The session's placeholder wash, which simulates nothing, as a runner for the wash worker. */
export const PLACEHOLDER_RUNNER = {
  module: '@spotless/session',
  exportName: 'placeholderWashRunner',
  version: 'placeholder_not_simulated-1',
} as const;

/**
 * Registers an `afterEach` hook that closes every server made by the returned factory and
 * removes the data directories it made. Call it once at the top of a test file.
 */
export function useServers(): {
  server: (options?: Partial<ServerOptions>) => Promise<SpotlessServer>;
  dataDir: () => string;
} {
  const live: SpotlessServer[] = [];
  const dirs: string[] = [];
  afterEach(async () => {
    for (const server of live.splice(0)) await server.close();
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });
  const dataDir = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'spotless-server-'));
    dirs.push(dir);
    return dir;
  };
  return {
    dataDir,
    server: async (options = {}) => {
      const server = await buildServer({
        dataDir: options.dataDir ?? dataDir(),
        staticDir: null,
        adminToken: TEST_ADMIN_TOKEN,
        // The server's own runner is the wash simulation, which takes minutes: a test that is
        // not about the wash gets the placeholder, as it did before the simulation was wired in.
        washRunner: PLACEHOLDER_RUNNER,
        ...options,
      });
      await server.app.ready();
      live.push(server);
      return server;
    },
  };
}

/**
 * Options that make a test server an open one (local play: no admin token, so nothing of
 * benchmark mode applies). Spread into the options of `useServers().server`.
 */
export const OPEN_MODE = { adminToken: undefined } as unknown as Partial<ServerOptions>;

/** The admin token of the servers made by {@link useServers} (unless a test gives its own). */
export const TEST_ADMIN_TOKEN = 'test-admin-token';

/** A JSON call through Fastify's injection, as the harness (with the admin token). */
export async function call<T = Record<string, unknown>>(
  server: SpotlessServer,
  method: 'GET' | 'POST' | 'DELETE',
  url: string,
  body?: unknown,
): Promise<{ status: number; body: T }> {
  const response = await server.app.inject({
    method,
    url,
    headers: { 'x-spotless-admin': TEST_ADMIN_TOKEN },
    ...(body === undefined ? {} : { payload: body as object }),
  });
  return { status: response.statusCode, body: response.json() };
}

/** Creates a session and returns its id. */
export async function newSession(server: SpotlessServer, levelId = 'tutorial'): Promise<string> {
  const created = await call<{ session_id: string }>(server, 'POST', '/api/sessions', {
    level_id: levelId,
  });
  expect(created.status).toBe(201);
  return created.body.session_id;
}

/** A WebSocket client on a session that keeps every message it receives. */
export interface Watcher {
  readonly messages: ServerMessage[];
  /** Resolves with the first message (from `from` on) that satisfies the test. */
  waitFor<M extends ServerMessage>(
    test: (message: ServerMessage) => message is M,
    from?: number,
  ): Promise<M>;
  close(): void;
}

/** Opens a WebSocket on a session through the server's injection. */
export async function watch(server: SpotlessServer, sessionId: string): Promise<Watcher> {
  const messages: ServerMessage[] = [];
  const waiting: (() => void)[] = [];
  // The listener goes on before the socket opens: the server greets at once.
  const socket = await server.app.injectWS(
    `/api/sessions/${sessionId}/ws`,
    {},
    {
      onInit: (ws) => {
        ws.on('message', (data: unknown) => {
          messages.push(JSON.parse(String(data)) as ServerMessage);
          for (const wake of waiting.splice(0)) wake();
        });
      },
    },
  );
  return {
    messages,
    async waitFor(test, from = 0) {
      const deadline = Date.now() + 20_000;
      for (;;) {
        for (let i = from; i < messages.length; i++) {
          const message = messages[i] as ServerMessage;
          if (test(message)) return message;
        }
        if (Date.now() > deadline) {
          throw new Error(`no such message among ${messages.map((m) => m.type).join(', ')}`);
        }
        await new Promise<void>((wake) => {
          waiting.push(wake);
          setTimeout(wake, 100);
        });
      }
    },
    close() {
      socket.terminate();
    },
  };
}

/** Places an item through the API and requires it to be accepted. */
export async function mustPlace(
  server: SpotlessServer,
  sessionId: string,
  request: PlaceRequest,
): Promise<Extract<DropResult, { accepted: true }>> {
  const placed = await call<DropResult>(
    server,
    'POST',
    `/api/sessions/${sessionId}/place`,
    request,
  );
  expect(placed.status).toBe(200);
  if (!placed.body.accepted) {
    throw new Error(`place ${request.item_id} was rejected: ${JSON.stringify(placed.body)}`);
  }
  return placed.body;
}

/** Sets a rack option through the API and requires it to be accepted. */
export async function mustSetRack(
  server: SpotlessServer,
  sessionId: string,
  rack: string,
  name: string,
  value: string,
): Promise<void> {
  const set = await call(server, 'POST', `/api/sessions/${sessionId}/set_rack`, {
    rack,
    option: { name, value },
  });
  expect(set.body, `set_rack ${rack} ${name}=${value}`).toMatchObject({ accepted: true });
}

/** Where `list_slots` suggests dropping an item into a slot of the lower basket. */
export async function slotDrop(
  server: SpotlessServer,
  sessionId: string,
  slotId: string,
  itemId: string,
): Promise<Pick<PlaceRequest, 'position_mm' | 'orientation'>> {
  const slots = await call<ListSlotsResult>(
    server,
    'GET',
    `/api/sessions/${sessionId}/list_slots?rack=lower_rack&item_id=${itemId}`,
  );
  if (!slots.body.accepted) throw new Error('list_slots was rejected');
  const drop = slots.body.slots.find((s) => s.id === slotId)?.suggested_drop;
  if (drop === undefined) throw new Error(`no suggested drop for ${itemId} in ${slotId}`);
  return drop;
}

/**
 * Loads the two plates and the bowl of the tutorial into the lower basket: three accepted
 * actions (and two `list_slots` queries). Returns the requests, for replaying the same load
 * elsewhere.
 */
export async function loadLowerBasket(
  server: SpotlessServer,
  sessionId: string,
): Promise<PlaceRequest[]> {
  const requests: PlaceRequest[] = [
    {
      item_id: 'plate_01',
      frame: 'lower_rack',
      ...(await slotDrop(server, sessionId, 'tine_row_r1.slot_06', 'plate_01')),
    },
    {
      item_id: 'plate_02',
      frame: 'lower_rack',
      ...(await slotDrop(server, sessionId, 'tine_row_r1.slot_02', 'plate_02')),
    },
    {
      item_id: 'bowl_01',
      frame: 'lower_rack',
      position_mm: [420, 270, 200],
      orientation: { preset: 'inverted' },
    },
  ];
  for (const request of requests) await mustPlace(server, sessionId, request);
  return requests;
}

/** Polls `get_report` until the wash has ended, and returns the last answer. */
export async function reportWhenEnded(
  server: SpotlessServer,
  sessionId: string,
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + 30_000;
  for (;;) {
    const report = await call(server, 'GET', `/api/sessions/${sessionId}/get_report`);
    const status = report.body.status;
    if (status === 'done' || status === 'failed' || report.body.accepted === false) {
      return report.body;
    }
    if (Date.now() > deadline) throw new Error('the wash did not end');
    await new Promise<void>((next) => {
      setTimeout(next, 25);
    });
  }
}
