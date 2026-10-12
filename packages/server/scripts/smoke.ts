/**
 * Smoke test over real sockets: starts the server on a free port with a temporary data
 * directory, plays three actions of the tutorial over HTTP with a real WebSocket client
 * watching, washes in the worker process, and prints what came back and how long each call
 * took.
 *
 *   pnpm --filter @spotless/server exec tsx scripts/smoke.ts [level id]
 *
 * Exits with 0 when the episode ran to a report.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildServer } from '../src/index.ts';
import type { ServerMessage } from '../src/index.ts';

/** The part of the `ws` client this script uses (Node 20 has no WebSocket of its own). */
interface WsClient {
  on(event: 'message', listener: (data: Buffer) => void): void;
  on(event: 'open' | 'close', listener: () => void): void;
  close(): void;
}
const requireFrom = createRequire(createRequire(import.meta.url).resolve('@fastify/websocket'));
const WebSocketClient = requireFrom('ws') as new (url: string) => WsClient;

const levelId = process.argv[2] ?? 'tutorial';
const dataDir = mkdtempSync(join(tmpdir(), 'spotless-smoke-'));
const server = await buildServer({ dataDir, staticDir: null });
const address = await server.app.listen({ port: 0, host: '127.0.0.1' });
console.log(`listening on ${address}`);

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const began = performance.now();
  const response = await fetch(`${address}${path}`, {
    method,
    ...(body === undefined
      ? {}
      : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  });
  const text = await response.text();
  const ms = (performance.now() - began).toFixed(0);
  console.log(`${method} ${path} -> ${response.status} in ${ms} ms, ${text.length} bytes`);
  return JSON.parse(text) as T;
}

let ok = false;
try {
  const created = await api<{ session_id: string }>('POST', '/api/sessions', { level_id: levelId });
  const id = created.session_id;
  const messages: ServerMessage[] = [];
  const socket = new WebSocketClient(`${address.replace('http', 'ws')}/api/sessions/${id}/ws`);
  socket.on('message', (data) => {
    messages.push(JSON.parse(data.toString('utf8')) as ServerMessage);
  });
  await new Promise<void>((open) => {
    socket.on('open', open);
  });
  await api('GET', `/api/sessions/${id}/geometry`);
  const base = `/api/sessions/${id}`;
  if (levelId === 'tutorial') {
    await api('POST', `${base}/place`, {
      item_id: 'bowl_01',
      frame: 'lower_rack',
      position_mm: [420, 270, 200],
      orientation: { preset: 'inverted' },
    });
    await api('POST', `${base}/place`, {
      item_id: 'fork_01',
      frame: 'cutlery_basket',
      position_mm: [20, 28, 240],
      orientation: { preset: 'handle_down', roll_deg: 5 },
    });
  }
  await api('POST', `${base}/set_rack`, {
    rack: 'lower_rack',
    option: { name: 'position', value: 'in' },
  });
  await api('GET', `${base}/check_load`);
  await api('POST', `${base}/start_cycle`);
  let report: { status?: string } = {};
  for (let i = 0; i < 200 && report.status !== 'done' && report.status !== 'failed'; i++) {
    await new Promise<void>((next) => {
      setTimeout(next, 100);
    });
    report = await api('GET', `${base}/get_report`);
  }
  await new Promise<void>((next) => {
    setTimeout(next, 100);
  });
  const counts = new Map<string, number>();
  let frames = 0;
  let bytes = 0;
  for (const message of messages) {
    counts.set(message.type, (counts.get(message.type) ?? 0) + 1);
    if (message.type === 'animation') {
      frames += message.frames.length;
      bytes += JSON.stringify(message).length;
    }
  }
  console.log(
    `websocket: ${[...counts].map(([type, n]) => `${n} ${type}`).join(', ')}; ` +
      `${frames} animation frames in ${bytes} bytes`,
  );
  socket.close();
  ok = report.status === 'done' && (counts.get('hello') ?? 0) === 1;
  console.log(ok ? 'ok' : `FAILED: the wash ended as ${String(report.status)}`);
} finally {
  await server.close();
  rmSync(dataDir, { recursive: true, force: true });
}
process.exit(ok ? 0 : 1);
