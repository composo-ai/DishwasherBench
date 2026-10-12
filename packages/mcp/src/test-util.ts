/**
 * Helpers for this package's tests (not exported from the package entry point): a real game
 * server on a port of this machine, episodes on it, and MCP clients connected to the MCP
 * server of an episode over an in-memory pair.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { ServerOptions, SpotlessServer } from '@spotless/server';
import { buildServer } from '@spotless/server';
import { placeholderWashRunner } from '@spotless/session';
import { afterEach } from 'vitest';
import { GameClient } from './game-client.ts';
import { createSpotlessMcpServer } from './server.ts';

/** The admin token of the test servers. */
export const ADMIN = 'mcp-test-admin-token';

/** A game server that listens. */
export interface TestGame {
  readonly server: SpotlessServer;
  /** Base address, for example `http://127.0.0.1:51234`. */
  readonly url: string;
  /** Creates an episode as the harness does and returns its id. */
  episode(levelId?: string): Promise<string>;
  /** A call of the HTTP API as a player makes it (no admin token). */
  http(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<{ status: number; body: unknown }>;
}

/**
 * Registers an `afterEach` hook that closes what the returned factories made. Call once at
 * the top of a test file.
 */
export function useGames(): {
  game: (options?: Partial<ServerOptions>) => Promise<TestGame>;
  connect: (game: TestGame, sessionId: string) => Promise<Client>;
} {
  const cleanup: (() => Promise<void> | void)[] = [];
  afterEach(async () => {
    for (const undo of cleanup.splice(0).reverse()) await undo();
  });
  return {
    async game(options = {}) {
      const dataDir = mkdtempSync(join(tmpdir(), 'spotless-mcp-'));
      const server = await buildServer({
        dataDir,
        staticDir: null,
        adminToken: ADMIN,
        // Nothing here is about the wash: the placeholder runs in this process.
        washRunner: placeholderWashRunner,
        ...options,
      });
      await server.app.listen({ port: 0, host: '127.0.0.1' });
      const port = (server.app.server.address() as AddressInfo).port;
      const url = `http://127.0.0.1:${port}`;
      cleanup.push(async () => {
        await server.close();
        rmSync(dataDir, { recursive: true, force: true });
      });
      return {
        server,
        url,
        async episode(levelId = 'tutorial') {
          const response = await fetch(`${url}/api/sessions`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-spotless-admin': ADMIN },
            body: JSON.stringify({ level_id: levelId, player: { kind: 'agent', name: 'test' } }),
          });
          return ((await response.json()) as { session_id: string }).session_id;
        },
        async http(method, path, body) {
          const response = await fetch(`${url}${path}`, {
            method,
            ...(body === undefined
              ? {}
              : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
          });
          return { status: response.status, body: (await response.json()) as unknown };
        },
      };
    },
    async connect(game, sessionId) {
      const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
      const mcp = createSpotlessMcpServer({
        game: new GameClient({ server: game.url, sessionId }),
        pollIntervalS: 0.05,
      });
      await mcp.connect(serverSide as unknown as Transport);
      const client = new Client({ name: 'spotless-test', version: '0.0.0' });
      await client.connect(clientSide as unknown as Transport);
      cleanup.push(async () => {
        await client.close();
        await mcp.close();
      });
      return client;
    },
  };
}

/** The structured result of a tool call, and whether it was an error. */
export async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
): Promise<{
  structured: Record<string, unknown>;
  isError: boolean;
  images: { data: string; mimeType: string }[];
  text: string;
}> {
  const result = await client.callTool({ name, arguments: args });
  const content = (result.content ?? []) as {
    type: string;
    text?: string;
    data?: string;
    mimeType?: string;
  }[];
  return {
    structured: (result.structuredContent ?? {}) as Record<string, unknown>,
    isError: result.isError === true,
    images: content
      .filter((part) => part.type === 'image')
      .map((part) => ({ data: part.data as string, mimeType: part.mimeType as string })),
    text: content.find((part) => part.type === 'text')?.text ?? '',
  };
}
