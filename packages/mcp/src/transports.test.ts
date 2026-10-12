// The MCP server over its two real transports: stdio (a child process, as a desktop client
// starts it) and streamable HTTP.
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { SessionSummary } from '@spotless/server';
import { describe, expect, it } from 'vitest';
import { GameClient } from './game-client.ts';
import { serveMcpHttp } from './http.ts';
import { callTool, useGames } from './test-util.ts';

const games = useGames();
const PACKAGE_DIR = fileURLToPath(new URL('../', import.meta.url));
const CLI = fileURLToPath(new URL('./cli.ts', import.meta.url));

const BOWL = {
  item_id: 'bowl_01',
  frame: 'lower_rack',
  position_mm: [420, 270, 200],
  orientation: { preset: 'inverted' },
};

describe('transports', () => {
  it('plays over stdio, started as a command with the episode it is bound to', async () => {
    const game = await games.game();
    const id = await game.episode();
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ['--import', 'tsx', CLI, '--server', game.url, '--session', id],
      cwd: PACKAGE_DIR,
      stderr: 'pipe',
    });
    const client = new Client({ name: 'stdio-test', version: '0.0.0' });
    await client.connect(transport as unknown as Transport);
    try {
      expect((await client.listTools()).tools).toHaveLength(13);
      const placed = await callTool(client, 'place', BOWL);
      expect(placed.structured).toMatchObject({ accepted: true, item_id: 'bowl_01' });
      const state = await callTool(client, 'get_state');
      expect((state.structured['placed'] as { rows: unknown[] }).rows).toHaveLength(1);
      // What the child did is in the game server's episode, and nowhere else.
      const summary = (await game.http('GET', `/api/sessions/${id}`)).body as SessionSummary;
      expect(summary.budget.actions_used).toBe(1);
    } finally {
      await client.close();
    }
  });

  it('refuses to start for an episode the game server does not know', async () => {
    const game = await games.game();
    const { main } = await import('./cli.ts');
    const errors: string[] = [];
    const original = console.error;
    console.error = (line: unknown) => {
      errors.push(String(line));
    };
    try {
      expect(
        await main(['--server', game.url, '--session', '00000000-0000-4000-8000-000000000000']),
      ).toBe(1);
      expect(await main(['--server', game.url])).toBe(2);
    } finally {
      console.error = original;
    }
    expect(errors.join('\n')).toMatch(/does not know this episode/);
  });

  it('plays over streamable HTTP, every client on the one episode the endpoint is bound to', async () => {
    const game = await games.game();
    const id = await game.episode();
    const other = await game.episode();
    const served = await serveMcpHttp({
      game: new GameClient({ server: game.url, sessionId: id }),
      port: 0,
    });
    const connect = async (): Promise<Client> => {
      const client = new Client({ name: 'http-test', version: '0.0.0' });
      await client.connect(
        new StreamableHTTPClientTransport(new URL(served.url)) as unknown as Transport,
      );
      return client;
    };
    const first = await connect();
    const second = await connect();
    try {
      expect((await first.listTools()).tools.map((tool) => tool.name)).toContain('start_cycle');
      expect((await callTool(first, 'place', BOWL)).structured).toMatchObject({ accepted: true });
      // A second client of the endpoint sees the same episode.
      const state = await callTool(second, 'get_state');
      expect(
        (state.structured['placed'] as { rows: unknown[][] }).rows.map((row) => row[0]),
      ).toEqual(['bowl_01']);
      // The other episode was not touched.
      const untouched = (await game.http('GET', `/api/sessions/${other}`)).body as SessionSummary;
      expect(untouched.events).toBe(0);
      // The process stalls for longer than a server keeps an idle connection (a scripted
      // policy planning, a long physics step): the next call still gets through.
      const until = Date.now() + 7500;
      while (Date.now() < until) Math.sqrt(until);
      expect((await callTool(first, 'get_state')).isError).toBe(false);
      // A request for an MCP session the endpoint never opened is refused.
      const stray = await fetch(served.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          'mcp-session-id': 'not-a-session',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      });
      expect(stray.status).toBe(404);
    } finally {
      await first.close();
      await second.close();
      await served.close();
    }
  });
});
