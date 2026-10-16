// Which web pages may call the server: its own, those of an origin it was told to allow, and
// no other; and under which host names it answers.
import { request as httpRequest } from 'node:http';
import type { AddressInfo } from 'node:net';
import { networkInterfaces } from 'node:os';
import { describe, expect, it } from 'vitest';
import type { AccessOptions, SpotlessServer } from './app.ts';
import { answeredHosts, isLoopbackAddress, parseAllowedHosts, parseAllowedOrigins } from './app.ts';
import { OPEN_MODE, useServers } from './test-util.ts';

const servers = useServers();

/** An open server (local play), with the access options under test. */
const open = (access: AccessOptions = {}): Promise<SpotlessServer> =>
  servers.server({ ...OPEN_MODE, ...access });

const HOST = '127.0.0.1:8787';
const OWN = `http://${HOST}`;
const FOREIGN = 'https://evil.example';

interface Answer {
  readonly status: number;
  readonly body: Record<string, unknown>;
  readonly headers: Record<string, unknown>;
}

/** A request with the headers a browser (or a script) would send. */
async function send(
  server: SpotlessServer,
  method: 'GET' | 'POST' | 'OPTIONS',
  url: string,
  headers: Record<string, string>,
  payload?: object,
): Promise<Answer> {
  const response = await server.app.inject({
    method,
    url,
    headers,
    ...(payload === undefined ? {} : { payload }),
  });
  let body: Record<string, unknown> = {};
  try {
    body = response.json<Record<string, unknown>>();
  } catch {
    body = {};
  }
  return { status: response.statusCode, body, headers: response.headers };
}

const NEW_SESSION = { level_id: 'tutorial' };

/** Resolves with the HTTP status of a refused WebSocket, or 101 when it was opened. */
async function socketStatus(
  server: SpotlessServer,
  path: string,
  headers: Record<string, string>,
): Promise<number> {
  try {
    const socket = await server.app.injectWS(path, { headers });
    socket.terminate();
    return 101;
  } catch (error) {
    const status = /Unexpected server response: (\d+)/.exec(String(error));
    if (status === null) throw error;
    return Number(status[1]);
  }
}

describe('which web pages may call the server', () => {
  it('answers its own page: an Origin that is the host the request was sent to', async () => {
    const server = await open();
    for (const host of [HOST, 'localhost:8787', '[::1]:8787', 'LOCALHOST:8787']) {
      const created = await send(
        server,
        'POST',
        '/api/sessions',
        { host, origin: `http://${host.toLowerCase()}` },
        NEW_SESSION,
      );
      expect(created.status, host).toBe(201);
      // Its own page needs no CORS header, and gets none.
      expect(created.headers['access-control-allow-origin'], host).toBeUndefined();
    }
  });

  it('answers a request without an Origin, as the harness, the MCP server and curl send it', async () => {
    const server = await open();
    expect((await send(server, 'GET', '/api/health', { host: HOST })).status).toBe(200);
    const created = await send(server, 'POST', '/api/sessions', { host: HOST }, NEW_SESSION);
    expect(created.status).toBe(201);
    expect(created.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('refuses a page of another origin with 403, before anything is done', async () => {
    const server = await open();
    const foreign = [
      FOREIGN,
      // Another port or another scheme of this machine is another origin.
      'http://127.0.0.1:5173',
      'https://127.0.0.1:8787',
      'http://localhost:8787',
      // What a page opened from a file, or a sandboxed frame, sends.
      'null',
      'not an origin',
    ];
    for (const origin of foreign) {
      const read = await send(server, 'GET', '/api/health', { host: HOST, origin });
      expect(read.status, origin).toBe(403);
      expect(read.body, origin).toMatchObject({ accepted: false, reason: 'forbidden' });
      expect(String(read.body['detail']), origin).toContain('--allow-origin');
      expect(read.headers['access-control-allow-origin'], origin).toBeUndefined();
      const created = await send(
        server,
        'POST',
        '/api/sessions',
        { host: HOST, origin },
        NEW_SESSION,
      );
      expect(created.status, origin).toBe(403);
      // A preflight is refused like any other request: no page is told it may go on.
      const preflight = await send(server, 'OPTIONS', '/api/sessions', {
        host: HOST,
        origin,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      });
      expect(preflight.status, origin).toBe(403);
      expect(preflight.headers['access-control-allow-origin'], origin).toBeUndefined();
      expect(preflight.headers['access-control-allow-methods'], origin).toBeUndefined();
    }
    // Nothing was created by the refused requests.
    expect(server.manager.sessionIds().live).toEqual([]);
  });

  it('answers an origin it was told to allow, with CORS headers for that origin only', async () => {
    const allowed = 'http://localhost:5173';
    const server = await open({ allowedOrigins: [`${allowed}/`, 'https://Game.Example'] });
    const preflight = await send(server, 'OPTIONS', '/api/sessions', {
      host: HOST,
      origin: allowed,
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type',
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers['access-control-allow-origin']).toBe(allowed);
    expect(preflight.headers['access-control-allow-methods']).toBe('GET, POST, DELETE, OPTIONS');
    expect(preflight.headers['access-control-allow-headers']).toBe(
      'content-type, x-spotless-admin',
    );
    const created = await send(
      server,
      'POST',
      '/api/sessions',
      { host: HOST, origin: allowed },
      NEW_SESSION,
    );
    expect(created.status).toBe(201);
    expect(created.headers['access-control-allow-origin']).toBe(allowed);
    expect(created.headers['vary']).toBe('Origin');
    // The second entry, as a browser writes it.
    const other = await send(server, 'GET', '/api/health', {
      host: HOST,
      origin: 'https://game.example',
    });
    expect(other.status).toBe(200);
    expect(other.headers['access-control-allow-origin']).toBe('https://game.example');
    // Every other origin is refused as before, and is never named in an answer.
    const refused = await send(server, 'GET', '/api/health', { host: HOST, origin: FOREIGN });
    expect(refused.status).toBe(403);
    expect(refused.headers['access-control-allow-origin']).toBeUndefined();
    // The server's own page is still its own.
    const own = await send(server, 'GET', '/api/health', { host: HOST, origin: OWN });
    expect(own.status).toBe(200);
    expect(own.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('takes only origins as allowed origins', () => {
    expect(parseAllowedOrigins(['http://LOCALHOST:5173/', 'https://a.example:443'])).toEqual([
      'http://localhost:5173',
      'https://a.example',
    ]);
    for (const entry of ['*', 'null', 'localhost:5173', 'http://a.example/page', 'ftp://a.example'])
      expect(() => parseAllowedOrigins([entry]), entry).toThrow(RangeError);
  });

  it('refuses to be built with an allowed origin that is not one', async () => {
    await expect(open({ allowedOrigins: ['*'] })).rejects.toThrow(/not a web origin/);
  });
});

describe('the host a request names', () => {
  it('on a loopback address: only 127.0.0.1, localhost and [::1], whatever the port', async () => {
    const server = await open();
    for (const host of [HOST, 'localhost:8787', '[::1]:8787', 'localhost:5173', '127.0.0.1']) {
      expect((await send(server, 'GET', '/api/health', { host })).status, host).toBe(200);
    }
    const foreign = [
      'evil.example:8787',
      'evil.example',
      '127.0.0.1.evil.example:8787',
      'localhost.evil.example',
      '192.168.1.20:8787',
      'evil.example@127.0.0.1:8787',
    ];
    for (const host of foreign) {
      const read = await send(server, 'GET', '/api/health', { host });
      expect(read.status, host).toBe(403);
      expect(read.body, host).toMatchObject({ accepted: false, reason: 'forbidden' });
      expect(String(read.body['detail']), host).toContain('Host header');
      // The page's files and unknown paths are refused the same way.
      expect((await send(server, 'GET', '/', { host })).status, host).toBe(403);
      // A second path, with a body: refusal happens before the path or body is looked at.
      const posted = await send(server, 'POST', '/api/levels', { host }, { level_id: 'tutorial' });
      expect(posted.status, host).toBe(403);
      expect(String(posted.body['detail']), host).toContain('Host header');
      // A page that reached this machine under its own name is its own origin to the browser
      // (DNS rebinding): the name gives it away.
      const rebound = await send(
        server,
        'POST',
        '/api/sessions',
        { host, origin: `http://${host}` },
        NEW_SESSION,
      );
      expect(rebound.status, host).toBe(403);
    }
    expect(server.manager.sessionIds().live).toEqual([]);
  });

  it('on a loopback address other than 127.0.0.1: that address too', async () => {
    const server = await open({ host: '127.0.0.2' });
    expect((await send(server, 'GET', '/api/health', { host: '127.0.0.2:8787' })).status).toBe(200);
    expect((await send(server, 'GET', '/api/health', { host: HOST })).status).toBe(200);
    expect((await send(server, 'GET', '/api/health', { host: '127.0.0.3:8787' })).status).toBe(403);
  });

  it('on a loopback address: a further name it was given, and its origin', async () => {
    const server = await open({ allowedHosts: ['Host.Docker.Internal'] });
    const host = 'host.docker.internal:9000';
    expect((await send(server, 'GET', '/api/health', { host })).status).toBe(200);
    const own = await send(
      server,
      'POST',
      '/api/sessions',
      { host, origin: `http://${host}` },
      NEW_SESSION,
    );
    expect(own.status).toBe(201);
    expect((await send(server, 'GET', '/api/health', { host: 'other.internal:9000' })).status).toBe(
      403,
    );
    // The name is no licence for another origin.
    expect((await send(server, 'GET', '/api/health', { host, origin: FOREIGN })).status).toBe(403);
    expect(parseAllowedHosts(['Box.Example', '::1', '[::1]', '192.168.1.20'])).toEqual([
      'box.example',
      '[::1]',
      '[::1]',
      '192.168.1.20',
    ]);
    for (const entry of ['box.example:8787', 'http://box.example', 'box.example/x', '*', ''])
      expect(() => parseAllowedHosts([entry]), entry).toThrow(RangeError);
  });

  it('on an address other machines reach: its own addresses, a name it was given, no other', async () => {
    // A page that reaches the machine under a name of its own (DNS rebinding) has an Origin
    // equal to that name, so the own-origin test alone would let it through.
    const rebound = 'game.example:8787';
    const cases: readonly (readonly [string, string])[] = [
      ['0.0.0.0', '127.0.0.1:8787'],
      ['0.0.0.0', 'localhost:8787'],
      ['::', '[::1]:8787'],
      ['192.168.1.20', '192.168.1.20:8787'],
    ];
    for (const [bound, host] of cases) {
      const server = await open({ host: bound });
      expect((await send(server, 'GET', '/api/health', { host })).status, bound).toBe(200);
      const own = await send(
        server,
        'POST',
        '/api/sessions',
        { host, origin: `http://${host}` },
        NEW_SESSION,
      );
      expect(own.status, bound).toBe(201);
      const foreign = await send(
        server,
        'POST',
        '/api/sessions',
        { host, origin: FOREIGN },
        NEW_SESSION,
      );
      expect(foreign.status, bound).toBe(403);
      const named = await send(
        server,
        'POST',
        '/api/sessions',
        { host: rebound, origin: `http://${rebound}` },
        NEW_SESSION,
      );
      expect(named.status, bound).toBe(403);
      expect(named.body['reason'], bound).toBe('forbidden');
      expect((await send(server, 'GET', '/api/health', { host: rebound })).status, bound).toBe(403);
    }
    // One address: that address, and not the loopback names.
    const one = await open({ host: '192.168.1.20' });
    expect((await send(one, 'GET', '/api/health', { host: HOST })).status).toBe(403);
    // The name the machine has on the network, once it is given.
    const given = await open({ host: '0.0.0.0', allowedHosts: ['game.example'] });
    const allowed = await send(
      given,
      'POST',
      '/api/sessions',
      { host: rebound, origin: `http://${rebound}` },
      NEW_SESSION,
    );
    expect(allowed.status).toBe(201);
  });

  it('lists the host names it answers to', () => {
    expect(answeredHosts(['127.0.0.1'], '127.0.0.1')).toEqual(['127.0.0.1', 'localhost', '[::1]']);
    expect(answeredHosts(['::1'], 'localhost', ['box.example'])).toEqual([
      '[::1]',
      'localhost',
      '127.0.0.1',
      'box.example',
    ]);
    expect(answeredHosts(['192.168.1.20'], '192.168.1.20')).toEqual(['192.168.1.20']);
    const every = answeredHosts(['0.0.0.0'], '0.0.0.0');
    for (const name of ['0.0.0.0', '127.0.0.1', 'localhost', '[::1]'])
      expect(every, name).toContain(name);
    expect(every).not.toContain('game.example');
  });

  it('knows a loopback address', () => {
    for (const address of ['127.0.0.1', '127.8.9.10', '::1', '[::1]', 'localhost', 'LOCALHOST'])
      expect(isLoopbackAddress(address), address).toBe(true);
    for (const address of ['0.0.0.0', '::', '192.168.1.20', '1127.0.0.1', 'localhost.example'])
      expect(isLoopbackAddress(address), address).toBe(false);
  });
});

describe('the WebSocket of a session', () => {
  it('is opened by the page the server serves and by a client without an Origin', async () => {
    const server = await open();
    const created = await send(server, 'POST', '/api/sessions', { host: HOST }, NEW_SESSION);
    const path = `/api/sessions/${String(created.body['session_id'])}/ws`;
    expect(await socketStatus(server, path, { host: HOST, origin: OWN })).toBe(101);
    expect(await socketStatus(server, path, { host: HOST })).toBe(101);
    expect(await socketStatus(server, path, {})).toBe(101);
  });

  it('is refused with 403 to a page of another origin, and under a foreign host name', async () => {
    const server = await open({ allowedOrigins: ['http://localhost:5173'] });
    const created = await send(server, 'POST', '/api/sessions', { host: HOST }, NEW_SESSION);
    const path = `/api/sessions/${String(created.body['session_id'])}/ws`;
    // A browser sends the Origin of the page with every WebSocket it opens, and no CORS rule
    // stands in the way: this check is the only one.
    expect(await socketStatus(server, path, { host: HOST, origin: FOREIGN })).toBe(403);
    expect(await socketStatus(server, path, { host: HOST, origin: 'null' })).toBe(403);
    expect(
      await socketStatus(server, path, {
        host: 'evil.example:8787',
        origin: 'http://evil.example:8787',
      }),
    ).toBe(403);
    expect(await socketStatus(server, path, { host: 'evil.example:8787' })).toBe(403);
    // An allowed origin opens it.
    expect(await socketStatus(server, path, { host: HOST, origin: 'http://localhost:5173' })).toBe(
      101,
    );
  });
});

/** One request over a real connection; resolves with the status (101 for an opened socket). */
function overTheWire(
  port: number,
  path: string,
  headers: Record<string, string>,
  method = 'GET',
): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const request = httpRequest({ host: '127.0.0.1', port, path, method, headers, agent: false });
    request.on('response', (response) => {
      response.resume();
      response.on('end', () => resolve(response.statusCode ?? 0));
    });
    request.on('upgrade', (_response, socket) => {
      socket.destroy();
      resolve(101);
    });
    request.on('error', reject);
    request.end();
  });
}

describe('a server that listens', () => {
  it('judges by the address it listens on, over real connections', async () => {
    // The option says loopback; the server listens on every address, and that counts:
    // a Host naming this machine is answered. If the implementation judged by the
    // option alone, the machine address below would be refused.
    const server = await open();
    await server.app.listen({ port: 0, host: '0.0.0.0' });
    const port = (server.app.server.address() as AddressInfo).port;
    const host = `127.0.0.1:${port}`;
    const machine = Object.values(networkInterfaces())
      .flatMap((list) => list ?? [])
      .find((one) => one.family === 'IPv4' && !one.internal)?.address;
    if (machine !== undefined) {
      expect(await overTheWire(port, '/api/health', { host: `${machine}:${port}` })).toBe(200);
    }
    expect(await overTheWire(port, '/api/health', {})).toBe(200);
    expect(await overTheWire(port, '/api/health', { origin: `http://${host}` })).toBe(200);
    expect(await overTheWire(port, '/api/health', { origin: `http://localhost:${port}` })).toBe(
      403,
    );
    expect(await overTheWire(port, '/api/health', { origin: FOREIGN })).toBe(403);
    expect(await overTheWire(port, '/api/health', { host: `evil.example:${port}` })).toBe(403);
    expect(
      await overTheWire(port, '/api/sessions', { origin: FOREIGN, 'content-length': '0' }, 'POST'),
    ).toBe(403);

    const created = await send(server, 'POST', '/api/sessions', { host }, NEW_SESSION);
    const upgrade = {
      connection: 'Upgrade',
      upgrade: 'websocket',
      'sec-websocket-version': '13',
      'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==',
    };
    const path = `/api/sessions/${String(created.body['session_id'])}/ws`;
    expect(await overTheWire(port, path, { ...upgrade, origin: `http://${host}` })).toBe(101);
    expect(await overTheWire(port, path, upgrade)).toBe(101);
    expect(await overTheWire(port, path, { ...upgrade, origin: FOREIGN })).toBe(403);
    expect(await overTheWire(port, path, { ...upgrade, host: `evil.example:${port}` })).toBe(403);
  });
});

describe('the addresses of this machine', () => {
  it('every networkInterfaces() address is answered for 0.0.0.0', async () => {
    const addresses = new Set<string>();
    for (const list of Object.values(networkInterfaces())) {
      for (const one of list ?? []) addresses.add(one.address.toLowerCase());
    }
    expect(addresses.size).toBeGreaterThan(0);
    const names = answeredHosts(['0.0.0.0'], '0.0.0.0');
    for (const address of addresses) {
      const written = address.includes(':') ? `[${address}]` : address;
      expect(names, address).toContain(written);
    }
  });
});
