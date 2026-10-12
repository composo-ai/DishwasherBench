/**
 * Command line of the MCP server.
 *
 *   spotless-mcp --server http://127.0.0.1:8787 --session <episode id>
 *                [--http] [--port 8788] [--host 127.0.0.1] [--allow-host <name>]...
 *
 * Without `--http` it speaks MCP over stdio, which is how a desktop client starts it. With
 * `--http` it listens for streamable HTTP on `/mcp`. Either way it is bound to the one
 * episode named: the harness (or `spotless-simd link`) creates the episode on the game
 * server and passes its id here. The server address and the episode id may also come from
 * `SPOTLESS_SERVER` and `SPOTLESS_SESSION`.
 *
 * Over HTTP the endpoint answers 403 to a request whose `Host` header does not name an address
 * it listens on (127.0.0.1, localhost or [::1] by default) or a name given with `--allow-host`,
 * and to any request that carries an `Origin` header: it is for MCP clients, not for web
 * pages (`http.ts`).
 *
 * Run it with `pnpm --filter @spotless/mcp exec tsx src/cli.ts ...`.
 */

import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { GameClient } from './game-client.ts';
import { parseAllowedHosts, serveMcpHttp } from './http.ts';
import { createSpotlessMcpServer } from './server.ts';

const USAGE =
  'usage: spotless-mcp --server <http://host:port> --session <episode id> [--http] [--port 8788] [--host 127.0.0.1] [--allow-host <name>]...';

/**
 * Runs the command line with the arguments after the program name. Resolves with an exit
 * status when it cannot start; otherwise it serves until the client goes away (stdio) or the
 * process is stopped (HTTP), and resolves with 0.
 */
export async function main(argv: readonly string[]): Promise<number> {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      server: { type: 'string' },
      session: { type: 'string' },
      http: { type: 'boolean' },
      port: { type: 'string', default: '8788' },
      host: { type: 'string', default: '127.0.0.1' },
      'allow-host': { type: 'string', multiple: true },
    },
  });
  const serverUrl = values.server ?? process.env['SPOTLESS_SERVER'];
  const sessionId = values.session ?? process.env['SPOTLESS_SESSION'];
  if (serverUrl === undefined || sessionId === undefined) {
    console.error(USAGE);
    return 2;
  }
  const game = new GameClient({ server: serverUrl, sessionId });
  try {
    await game.summary();
  } catch (error) {
    console.error(`spotless-mcp: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
  if (values.http === true) {
    const port = Number(values.port);
    if (!Number.isInteger(port) || port < 0 || port > 65535) {
      console.error(`spotless-mcp: '${values.port}' is not a port`);
      return 2;
    }
    let allowedHosts: string[];
    try {
      allowedHosts = parseAllowedHosts(values['allow-host'] ?? []);
    } catch (error) {
      console.error(
        `spotless-mcp: --allow-host: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 2;
    }
    let served;
    try {
      served = await serveMcpHttp({ game, port, host: values.host, allowedHosts });
    } catch (error) {
      const code = (error as { code?: unknown }).code;
      console.error(
        code === 'EADDRINUSE'
          ? `spotless-mcp: port ${port} is in use; give --port <n>`
          : `spotless-mcp: cannot listen on ${values.host}, port ${port}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 1;
    }
    // stdout is free in HTTP mode.
    console.log(`spotless-mcp listening on ${served.url}`);
    await new Promise<void>((stopped) => {
      const stop = (): void => {
        void served.close().then(stopped);
      };
      process.once('SIGINT', stop);
      process.once('SIGTERM', stop);
    });
    return 0;
  }
  // stdio: stdout carries the protocol, so nothing else may be written to it.
  const transport = new StdioServerTransport();
  const server = createSpotlessMcpServer({ game });
  await new Promise<void>((closed) => {
    transport.onclose = () => closed();
    void server.connect(transport as unknown as Transport);
  });
  return 0;
}

const invoked = process.argv[1];
if (invoked !== undefined && import.meta.url === pathToFileURL(invoked).href) {
  main(process.argv.slice(2)).then(
    (status) => {
      process.exit(status);
    },
    (error: unknown) => {
      console.error(error);
      process.exit(1);
    },
  );
}
