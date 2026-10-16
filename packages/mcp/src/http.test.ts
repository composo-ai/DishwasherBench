// Who may reach the MCP endpoint over HTTP: an MCP client that names an address the endpoint
// listens on, and no web page.
import type { IncomingMessage } from 'node:http';
import { request as httpRequest } from 'node:http';
import { networkInterfaces } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { main } from './cli.ts';
import { GameClient } from './game-client.ts';
import type { McpHttpServer } from './http.ts';
import { acceptedHosts, parseAllowedHosts, refusalOf, serveMcpHttp } from './http.ts';
import { useGames } from './test-util.ts';

const games = useGames();
const live: McpHttpServer[] = [];
afterEach(async () => {
  for (const served of live.splice(0)) await served.close();
});

/** An endpoint on a free port. No request of these tests gets as far as the game. */
async function endpoint(
  options: { host?: string; allowedHosts?: readonly string[] } = {},
): Promise<{ served: McpHttpServer; port: number }> {
  const served = await serveMcpHttp({
    game: new GameClient({ server: 'http://127.0.0.1:9', sessionId: 'none' }),
    port: 0,
    ...options,
  });
  live.push(served);
  return { served, port: Number(new URL(served.url).port) };
}

/** One request on a connection of its own, with the headers given. */
function ask(
  port: number,
  headers: Record<string, string>,
  method = 'GET',
): Promise<{ status: number; message: string }> {
  return new Promise((resolve, reject) => {
    const request = httpRequest(
      { host: '127.0.0.1', port, path: '/mcp', method, headers, agent: false },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
            error?: { message?: string };
          };
          resolve({ status: response.statusCode ?? 0, message: body.error?.message ?? '' });
        });
      },
    );
    request.on('error', reject);
    request.end();
  });
}

describe('the MCP endpoint over HTTP', () => {
  it('answers under the names of this machine, whatever the port named', async () => {
    const { served, port } = await endpoint();
    expect(served.url).toBe(`http://127.0.0.1:${port}/mcp`);
    // Not refused: the endpoint goes on to say that no MCP session was opened.
    for (const host of [`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`, 'localhost']) {
      const answer = await ask(port, { host });
      expect(answer.status, host).toBe(400);
      expect(answer.message, host).toMatch(/initialize first/);
    }
    // With no Host header set by hand, a client names the address it connects to.
    expect((await ask(port, {})).status).toBe(400);
  });

  it('refuses a foreign host name with 403, before the path or the body is looked at', async () => {
    const { port } = await endpoint();
    const foreign = [
      `evil.example:${port}`,
      'evil.example',
      `127.0.0.1.evil.example:${port}`,
      `192.168.1.20:${port}`,
      `evil.example@127.0.0.1:${port}`,
    ];
    for (const host of foreign) {
      for (const method of ['GET', 'POST', 'DELETE']) {
        const answer = await ask(port, { host }, method);
        expect(answer.status, `${method} ${host}`).toBe(403);
        expect(answer.message, host).toContain('Host header');
        expect(answer.message, host).toContain('--allow-host');
      }
    }
  });

  it('refuses every request that carries an Origin header', async () => {
    const { port } = await endpoint();
    const origins = [
      'https://evil.example',
      // Even its own address: the endpoint serves no page, so no page is its own.
      `http://127.0.0.1:${port}`,
      `http://localhost:${port}`,
      'null',
    ];
    for (const origin of origins) {
      for (const method of ['GET', 'POST', 'OPTIONS']) {
        const answer = await ask(port, { origin }, method);
        expect(answer.status, `${method} ${origin}`).toBe(403);
        expect(answer.message, origin).toContain('Origin header');
      }
    }
  });

  it('answers to a further name it was given', async () => {
    const { port } = await endpoint({ allowedHosts: ['Host.Docker.Internal'] });
    expect((await ask(port, { host: 'host.docker.internal:9000' })).status).toBe(400);
    expect((await ask(port, { host: `localhost:${port}` })).status).toBe(400);
    expect((await ask(port, { host: 'other.internal:9000' })).status).toBe(403);
    // A name does not make a web page welcome.
    expect(
      (await ask(port, { host: 'host.docker.internal', origin: 'http://host.docker.internal' }))
        .status,
    ).toBe(403);
  });

  it('takes only host names as further names', async () => {
    expect(parseAllowedHosts(['Box.Example', '::1', '[::1]', '192.168.1.20'])).toEqual([
      'box.example',
      '[::1]',
      '[::1]',
      '192.168.1.20',
    ]);
    for (const entry of ['box.example:8788', 'http://box.example', 'box.example/mcp', '*', '']) {
      expect(() => parseAllowedHosts([entry]), entry).toThrow(RangeError);
      await expect(endpoint({ allowedHosts: [entry] }), entry).rejects.toThrow(/not a host name/);
    }
  });

  it('says in one line that its port is in use, or that a name is not one', async () => {
    const game = await games.game();
    const id = await game.episode();
    const { port } = await endpoint();
    const errors: string[] = [];
    const original = console.error;
    console.error = (line: unknown) => {
      errors.push(String(line));
    };
    try {
      const args = ['--server', game.url, '--session', id, '--http'];
      expect(await main([...args, '--port', String(port)])).toBe(1);
      expect(await main([...args, '--port', '0', '--allow-host', 'box.example:8788'])).toBe(2);
      expect(await main([...args, '--port', 'eighty'])).toBe(2);
    } finally {
      console.error = original;
    }
    expect(errors).toHaveLength(3);
    expect(errors[0]).toBe(`spotless-mcp: port ${port} is in use; give --port <n>`);
    expect(errors[1]).toMatch(
      /^spotless-mcp: --allow-host: 'box\.example:8788' is not a host name/,
    );
    expect(errors[2]).toBe("spotless-mcp: 'eighty' is not a port");
  });

  it('knows the names of the address it listens on', () => {
    const loopback = ['127.0.0.1', 'localhost', '[::1]'];
    expect(acceptedHosts('127.0.0.1', '127.0.0.1')).toEqual(loopback);
    expect(acceptedHosts('::1', 'localhost')).toEqual(['[::1]', 'localhost', '127.0.0.1']);
    // One address of the machine: that address and the name it was asked for by, no other.
    expect(acceptedHosts('192.168.1.20', '192.168.1.20')).toEqual(['192.168.1.20']);
    expect(acceptedHosts('192.168.1.20', 'Box.Example', ['a.example'])).toEqual([
      '192.168.1.20',
      'box.example',
      'a.example',
    ]);
    // Every address: the loopback names and the addresses of the machine, nothing else.
    for (const every of ['0.0.0.0', '::']) {
      const hosts = acceptedHosts(every, every);
      expect(hosts, every).toEqual(expect.arrayContaining(loopback));
      expect(hosts, every).not.toContain('evil.example');
      for (const host of hosts)
        expect(host, every).toMatch(/^(\[[0-9a-f:.%a-z]+\]|[0-9.]+|localhost)$/);
    }
    // The machine's own addresses, whatever they are on this host.
    const addresses = new Set<string>();
    for (const list of Object.values(networkInterfaces())) {
      for (const one of list ?? []) addresses.add(one.address.toLowerCase());
    }
    expect(addresses.size).toBeGreaterThan(0);
    const wide = acceptedHosts('0.0.0.0', '0.0.0.0');
    for (const address of addresses) {
      const written = address.includes(':') ? `[${address}]` : address;
      expect(wide, address).toContain(written);
    }
  });

  it('answers a real connection under a machine address when wide open', async () => {
    const { served, port } = await endpoint({ host: '0.0.0.0' });
    void served;
    const machine = Object.values(networkInterfaces())
      .flatMap((list) => list ?? [])
      .find((one) => one.family === 'IPv4' && !one.internal)?.address;
    if (machine !== undefined) {
      // No session exists, so 400 — but not 403: the Host was answered.
      expect((await ask(port, { host: `${machine}:${port}` })).status).toBe(400);
    }
    expect((await ask(port, { host: `evil.example:${port}` })).status).toBe(403);
  });

  it('judges a request by its Host and Origin headers alone', () => {
    const hosts = ['127.0.0.1', 'localhost', '[::1]'];
    const request = (headers: Record<string, string>): IncomingMessage =>
      ({ headers }) as unknown as IncomingMessage;
    expect(refusalOf(request({ host: '127.0.0.1:8788' }), hosts)).toBeNull();
    expect(refusalOf(request({ host: 'LOCALHOST:8788' }), hosts)).toBeNull();
    expect(refusalOf(request({ host: '[::1]' }), hosts)).toBeNull();
    expect(refusalOf(request({}), hosts)).toMatch(/names no host/);
    expect(refusalOf(request({ host: 'evil.example:8788' }), hosts)).toMatch(
      /'evil\.example:8788'/,
    );
    expect(refusalOf(request({ host: '127.0.0.1:8788', origin: 'null' }), hosts)).toMatch(
      /Origin header/,
    );
  });
});
