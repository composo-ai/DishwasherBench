import { readFileSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CliReplayResult } from './cli.ts';
import { main } from './cli.ts';
import {
  call,
  loadLowerBasket,
  mustSetRack,
  newSession,
  reportWhenEnded,
  useServers,
} from './test-util.ts';

const servers = useServers();

async function run(...argv: string[]): Promise<{ status: number; out: string[]; err: string[] }> {
  const out: string[] = [];
  const err: string[] = [];
  const status = await main(argv, { out: (line) => out.push(line), err: (line) => err.push(line) });
  return { status, out, err };
}

describe('the command line', () => {
  it('lists the levels', async () => {
    const listed = await run('levels', '--json');
    expect(listed.status).toBe(0);
    const levels = JSON.parse(listed.out[0] ?? '[]') as { id: string; items: number }[];
    expect(levels.map((level) => level.id)).toEqual(
      expect.arrayContaining(['tutorial', 'weeknight-dinner', 'dinner-party']),
    );
    const table = await run('levels');
    expect(table.out).toHaveLength(levels.length);
    expect(table.out[0]).toContain('tutorial');
  });

  it('replays a log and verifies its hashes, in each form a log comes in', async () => {
    const dataDir = servers.dataDir();
    const server = await servers.server({
      dataDir,
      washRunner: (m, p) => import('@spotless/session').then((s) => s.placeholderWashRunner(m, p)),
    });
    const id = await newSession(server);
    await loadLowerBasket(server, id);
    await mustSetRack(server, id, 'lower_rack', 'position', 'in');
    await call(server, 'POST', `/api/sessions/${id}/start_cycle`);
    await reportWhenEnded(server, id);
    const final = (await call<{ state_hash: string }>(server, 'GET', `/api/sessions/${id}`)).body
      .state_hash;

    // The session file of the data directory.
    const file = join(dataDir, 'sessions', `${id}.jsonl`);
    const stored = await run('replay', file);
    expect(stored.status).toBe(0);
    const result = JSON.parse(stored.out[0] ?? '{}') as CliReplayResult;
    expect(result).toMatchObject({
      ok: true,
      level_id: 'tutorial',
      mismatches: [],
      final_state_hash: final,
    });
    expect(result.replayed).toBeGreaterThan(5);

    // The answer of the log endpoint, with and without its queries.
    const log = await call(server, 'GET', `/api/sessions/${id}/log`);
    const saved = join(dataDir, 'log.json');
    writeFileSync(saved, JSON.stringify(log.body));
    for (const flags of [[], ['--queries']]) {
      const replayed = await run('replay', saved, ...flags);
      expect(replayed.status).toBe(0);
      expect(JSON.parse(replayed.out[0] ?? '{}')).toMatchObject({
        ok: true,
        final_state_hash: final,
      });
    }

    // A log that was altered does not verify.
    const altered = join(dataDir, 'altered.jsonl');
    writeFileSync(
      altered,
      readFileSync(file, 'utf8').replace(
        '"position_mm":[420,270,200]',
        '"position_mm":[400,270,200]',
      ),
    );
    const failed = await run('replay', altered);
    expect(failed.status).toBe(1);
    const mismatch = JSON.parse(failed.out[0] ?? '{}') as CliReplayResult;
    expect(mismatch.ok).toBe(false);
    expect(mismatch.mismatches[0]).toMatchObject({ name: 'place', field: 'state_hash' });
  });

  it('says how it is used', async () => {
    expect((await run('replay')).status).toBe(2);
    expect((await run('replay', '/no/such/file.jsonl')).status).toBe(2);
    expect((await run('serve', '--port', 'eighty')).status).toBe(2);
    const unknown = await run('wash');
    expect(unknown.status).toBe(2);
    expect(unknown.err[0]).toContain('usage');
    expect(unknown.err[0]).toContain('--allow-origin <origin>');
    expect(unknown.err[0]).toContain('--allow-host <name>');
  });

  it('refuses an allowed origin that is not one, before anything is started', async () => {
    for (const origin of ['*', 'null', 'localhost:5173', 'http://localhost:5173/play']) {
      const refused = await run('serve', '--allow-origin', origin, '--data', servers.dataDir());
      expect(refused.status, origin).toBe(2);
      expect(refused.err[0], origin).toContain('serve: --allow-origin');
      expect(refused.err[0], origin).toContain('not a web origin');
    }
    for (const host of ['box.example:8787', 'http://box.example', 'box.example/play', '']) {
      const refused = await run('serve', '--allow-host', host, '--data', servers.dataDir());
      expect(refused.status, host).toBe(2);
      expect(refused.err[0], host).toContain('serve: --allow-host');
      expect(refused.err[0], host).toContain('not a host name');
    }
  });

  it('says so in one line when the port is in use', async () => {
    const taken = createServer();
    await new Promise<void>((listening) => taken.listen(0, '127.0.0.1', listening));
    const port = (taken.address() as AddressInfo).port;
    try {
      const refused = await run(
        'serve',
        '--port',
        String(port),
        '--data',
        servers.dataDir(),
        '--no-static',
        '--no-render',
      );
      expect(refused.status).toBe(1);
      expect(refused.err).toEqual([`serve: port ${port} is in use; give --port <n>`]);
      expect(refused.out).toEqual([]);
    } finally {
      await new Promise<void>((closed) => taken.close(() => closed()));
    }
  });
});
