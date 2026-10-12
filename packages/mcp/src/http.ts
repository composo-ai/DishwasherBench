/**
 * The MCP server of an episode over streamable HTTP: one endpoint (`/mcp`) on a port of this
 * machine, bound to one episode. Every MCP client that connects gets its own MCP session on
 * the same game: the endpoint cannot be pointed at another episode.
 *
 * The endpoint has no authentication, so it must not be driven by a web page. Two checks come
 * before anything else, and each answers 403:
 *
 *  - the `Host` header must name an address the endpoint listens on, whatever the port: on a
 *    loopback address (the default) that is 127.0.0.1, localhost or [::1]; on one address of
 *    the machine, that address; on every address (0.0.0.0, ::), any address of the machine.
 *    Further names are given with `allowedHosts`. A page that reached this machine under a
 *    name of its own (DNS rebinding) is refused by this;
 *  - a request that carries an `Origin` header is refused: a browser sends one with every
 *    request by which a page could do anything here (a POST, a request with headers of its
 *    own, the question that goes before it), and an MCP client that is a program sends none.
 *
 * The SDK's transport has options for the same purpose (`enableDnsRebindingProtection`,
 * `allowedHosts`, `allowedOrigins`); version 1.32.1 marks them as deprecated in favour of a
 * check outside the transport, they compare the whole header with its port, and an empty list
 * of origins switches the check of the origin off. So the check is made here.
 */

import { randomUUID } from 'node:crypto';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { isIPv6 } from 'node:net';
import { networkInterfaces } from 'node:os';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { SpotlessMcpOptions } from './server.ts';
import { createSpotlessMcpServer } from './server.ts';

/** Options of {@link serveMcpHttp}. */
export interface McpHttpOptions extends SpotlessMcpOptions {
  /** Port to listen on; 0 for any free port. Default 8788. */
  readonly port?: number;
  /** Address to listen on; default 127.0.0.1 (this machine only). */
  readonly host?: string;
  /**
   * Host names the endpoint answers to beside the addresses it listens on, without a port: a
   * name of this machine, or the name a container reaches its host by. Default: none.
   */
  readonly allowedHosts?: readonly string[];
}

/** A listening MCP endpoint. */
export interface McpHttpServer {
  /** The address of the endpoint, for example `http://127.0.0.1:8788/mcp`. */
  readonly url: string;
  readonly http: Server;
  /** Stops listening and closes every MCP session. */
  close(): Promise<void>;
}

function readBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('error', reject);
    request.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      if (text === '') {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(text) as unknown);
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  });
}

function refuse(response: ServerResponse, status: number, message: string): void {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message }, id: null }));
}

/** The host names an endpoint that listens on this machine only answers to. */
const LOOPBACK_HOSTS: readonly string[] = ['127.0.0.1', 'localhost', '[::1]'];

/** A `Host` header: a name, an IPv4 address or a bracketed IPv6 address, perhaps with a port. */
const HOST_HEADER = /^(\[[0-9a-f:.]+\]|[a-z0-9.-]+)(?::\d{1,5})?$/i;

/** An address or a name as a `Host` header writes it: lower case, IPv6 in brackets. */
function asHost(address: string): string {
  const lower = address.toLowerCase();
  return isIPv6(lower) ? `[${lower}]` : lower;
}

/**
 * The host names of a list as a `Host` header writes them. Throws a `RangeError` for an entry
 * that is not a host name or an address: one with a port, a scheme or a path would never
 * match, and nobody would see why.
 */
export function parseAllowedHosts(hosts: readonly string[]): string[] {
  return hosts.map((entry) => {
    const match = HOST_HEADER.exec(asHost(entry));
    if (match === null || match[0] !== match[1]) {
      throw new RangeError(
        `'${entry}' is not a host name: write the name or the address alone, without a port`,
      );
    }
    return match[0].toLowerCase();
  });
}

/**
 * The host names an endpoint answers to: `bound` is the address it listens on, `given` the
 * address it was asked to listen on (a name, perhaps), `allowed` the further names.
 */
export function acceptedHosts(
  bound: string,
  given: string,
  allowed: readonly string[] = [],
): string[] {
  const address = bound.toLowerCase();
  const names = [bound, given, ...allowed];
  if (address === '::1' || /^127(\.\d{1,3}){3}$/.test(address)) {
    names.push(...LOOPBACK_HOSTS);
  } else if (address === '0.0.0.0' || address === '::') {
    // Every address of this machine, as they are at this moment.
    names.push(...LOOPBACK_HOSTS);
    for (const addresses of Object.values(networkInterfaces())) {
      for (const one of addresses ?? []) names.push(one.address);
    }
  }
  return [...new Set(names.map(asHost))];
}

/**
 * Why a request is refused before it is looked at, or null: its `Host` header does not name
 * one of `hosts` (whatever the port), or it carries an `Origin` header.
 */
export function refusalOf(request: IncomingMessage, hosts: readonly string[]): string | null {
  const host = request.headers.host;
  const name = host === undefined ? null : HOST_HEADER.exec(host);
  if (name === null || !hosts.includes((name[1] as string).toLowerCase())) {
    const shown = host === undefined ? 'no host' : `'${host.slice(0, 120)}'`;
    // The names are not listed: a page under a rebound name could read them.
    return `the Host header names ${shown}, which this MCP endpoint does not answer to (another name: --allow-host <name>)`;
  }
  if (request.headers.origin !== undefined) {
    return 'a request with an Origin header is refused: this MCP endpoint is for MCP clients, not for web pages';
  }
  return null;
}

/** Serves the MCP server of an episode over streamable HTTP. Resolves when it listens. */
export async function serveMcpHttp(options: McpHttpOptions): Promise<McpHttpServer> {
  const transports = new Map<string, StreamableHTTPServerTransport>();
  const host = options.host ?? '127.0.0.1';
  const allowedHosts = parseAllowedHosts(options.allowedHosts ?? []);
  /** The address the endpoint listens on, once it does. */
  let bound: AddressInfo | null = null;

  const handle = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    // Who is asking, before what is asked.
    const refusal = refusalOf(request, acceptedHosts(bound?.address ?? host, host, allowedHosts));
    if (refusal !== null) {
      refuse(response, 403, refusal);
      return;
    }
    const path = (request.url ?? '').split('?')[0];
    if (path !== '/mcp') {
      refuse(response, 404, 'the MCP endpoint is /mcp');
      return;
    }
    const header = request.headers['mcp-session-id'];
    const sessionId = Array.isArray(header) ? header[0] : header;
    const known = sessionId === undefined ? undefined : transports.get(sessionId);
    if (known !== undefined) {
      await known.handleRequest(
        request,
        response,
        request.method === 'POST' ? await readBody(request) : undefined,
      );
      return;
    }
    if (request.method !== 'POST' || sessionId !== undefined) {
      refuse(
        response,
        sessionId === undefined ? 400 : 404,
        'no such MCP session; initialize first',
      );
      return;
    }
    // A new client: its own transport and MCP server, on the same episode.
    const body = await readBody(request);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        transports.set(id, transport);
      },
    });
    transport.onclose = () => {
      if (transport.sessionId !== undefined) transports.delete(transport.sessionId);
    };
    // The SDK's transport classes declare their optional callbacks without `undefined`.
    await createSpotlessMcpServer(options).connect(transport as unknown as Transport);
    await transport.handleRequest(request, response, body);
  };

  const http = createServer((request, response) => {
    handle(request, response).catch((error: unknown) => {
      if (!response.headersSent) {
        refuse(response, 400, error instanceof Error ? error.message : String(error));
      } else {
        response.end();
      }
    });
  });
  // This server never closes an idle connection itself; the client does. A client that pools
  // connections (every `fetch` does) would otherwise send its next call on one this server
  // has meanwhile closed, whenever client and server were busy for longer than the server's
  // idle limit (5 s by default): a harness whose scripted policy plans for a minute in the
  // same process, a slow placement. A call of the game that fails that way cannot be retried
  // safely. (The SDK's transport answers `Connection: keep-alive` whatever is set here, so
  // asking the client to close after every response is not an option.)
  http.keepAliveTimeout = 0;
  await new Promise<void>((resolve, reject) => {
    http.once('error', reject);
    http.listen(options.port ?? 8788, host, () => resolve());
  });
  const address = http.address() as AddressInfo;
  bound = address;
  return {
    url: `http://${asHost(host)}:${address.port}/mcp`,
    http,
    async close(): Promise<void> {
      for (const transport of [...transports.values()])
        await transport.close().catch(() => undefined);
      transports.clear();
      await new Promise<void>((resolve) => {
        http.close(() => resolve());
        http.closeAllConnections();
      });
    },
  };
}
