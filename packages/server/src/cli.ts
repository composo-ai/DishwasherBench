/**
 * Command line of the game server.
 *
 *   spotless-simd serve [--port 8787] [--host 127.0.0.1] [--allow-origin <origin>]...
 *                       [--allow-host <name>]... [--data .spotless] [--static <dir>]
 *                       [--no-static] [--log] [--admin-token <token> | SPOTLESS_ADMIN_TOKEN]
 *                       [--wash-tier official|fast | SPOTLESS_WASH_TIER]
 *                       [--wash-params <set.json>]... [--detergent <set.json> --dose-g <grams>
 *                       [--detergent-name <name>]] [--registry-defaults]
 *                       [--accept-stale-params] [--no-render]
 *   spotless-simd link --level <id> --player <name> [--agent] [--server http://127.0.0.1:8787]
 *                      [--admin-token <token> | SPOTLESS_ADMIN_TOKEN]
 *   spotless-simd replay <file> [--queries]
 *   spotless-simd levels [--json]
 *
 * Run it with `pnpm --filter @spotless/server exec tsx src/cli.ts <command>`.
 *
 * The washes of `serve` run with the parameters of the machine of the level: for the owner's
 * machine the current anchored parameter set with the owner's detergent
 * (`@spotless/wash-runner`, `defaults.ts`). `--wash-params` names parameter-set files to lay
 * over the registry defaults instead (later over earlier), `--detergent` the parameter-set
 * file of the detergent's composition with `--dose-g` its dose; `--registry-defaults` washes
 * with the registry defaults and the machine's own dose. A parameter-set file whose stored
 * hashes do not match the current parameter registry is stale: a wash with it fails and the
 * failure says what to do, unless the server was started with `--accept-stale-params`, in
 * which case the report says that a stale set was used.
 *
 * Which web pages may call `serve`. The server answers the page it serves itself. A request
 * that carries the `Origin` of another site is answered with 403, unless that origin was given
 * with `--allow-origin <origin>` (written `scheme://host[:port]`; the flag may be repeated).
 * A request whose `Host` header names a host the server does not answer to is answered with
 * 403 as well, whatever the port it names. While the server listens on a loopback address,
 * which is the default, it answers to 127.0.0.1, localhost and [::1]; with `--host <address>`
 * to that address; with `--host 0.0.0.0` or `--host ::` to the loopback names and every address
 * of this machine. `--allow-host <name>` adds a name (the one by which a container reaches its
 * host, or the name of this machine on the network), and may be repeated. The client under the Vite
 * development server needs no flag: Vite proxies `/api`, so the page and the API are one
 * origin. Requests without an `Origin` header (the harness, the MCP server, curl) are answered
 * as before.
 *
 * `replay` takes a session file of the data directory (`<data>/sessions/<id>.jsonl`), the
 * answer of `GET /api/sessions/:id/log` (`{ level_id, log }`), or `{ level, log }` as the
 * session package's own script takes it. It replays the log in a fresh session, compares the
 * hash after every event, prints the outcome as one line of JSON and exits with 0 when every
 * hash was reproduced and 1 otherwise.
 *
 * `link` asks a running server in benchmark mode for a new episode of a level for a named
 * player and prints the address to give that player: the page opens the episode, shows the
 * name, and the server writes the episode's record under `<data>/episodes/` when its wash ends.
 * With `--agent` the episode is recorded as an agent's (a model in a desktop client playing
 * through the MCP server, which is started with the episode id the command prints).
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { canonicalHash } from '@spotless/core';
import type { Level } from '@spotless/levels';
import { allLevels } from '@spotless/levels';
import type { ActionLogEvent, WashReport } from '@spotless/session';
import { createSession, placeholderWashRunner, replayActionLog } from '@spotless/session';
import { answeredHosts, buildServer, parseAllowedHosts, parseAllowedOrigins } from './app.ts';
import { createRenderService } from './render-service.ts';
import { WashGate, replayStoredSession } from './sessions.ts';
import type { WashResultRecord } from './store.ts';
import { parseSessionFile } from './store.ts';
import { WASH_OPTION_FLAGS, washOptionsOf } from './wash-options.ts';

/** Where the command line writes. */
export interface CliIo {
  readonly out: (line: string) => void;
  readonly err: (line: string) => void;
}

const USAGE = [
  'usage:',
  '  spotless-simd serve [--port 8787] [--host 127.0.0.1] [--allow-origin <origin>]... [--allow-host <name>]... [--data .spotless] [--static <dir>] [--no-static] [--log] [--admin-token <token>] [--wash-tier official|fast] [--wash-params <set.json>]... [--detergent <set.json> --dose-g <grams> [--detergent-name <name>]] [--registry-defaults] [--accept-stale-params] [--no-render]',
  '  spotless-simd link --level <id> --player <name> [--agent] [--server http://127.0.0.1:8787] [--admin-token <token>]',
  '  spotless-simd replay <file> [--queries]',
  '  spotless-simd levels [--json]',
  '',
  'serve answers the page it serves itself. A request with the Origin of another site gets 403',
  'unless that origin was given with --allow-origin <scheme://host[:port]> (may be repeated).',
  'It also answers 403 to a request whose Host header names another host than the addresses it',
  'listens on (127.0.0.1, localhost and [::1] by default) or one given with --allow-host <name>',
  '(may be repeated).',
].join('\n');

/** Outcome of `replay`, as printed. */
export interface CliReplayResult {
  readonly ok: boolean;
  readonly level_id: string;
  readonly replayed: number;
  readonly mismatches: readonly {
    readonly seq: number;
    readonly name: string;
    readonly field: string;
    readonly expected: string;
    readonly actual: string;
  }[];
  /** Queries whose result digest differs (only counted when queries are replayed). */
  readonly digest_mismatches: number;
  readonly final_state_hash: string;
  /** Things worth knowing that do not fail the replay. */
  readonly notes: readonly string[];
}

function levelById(levelId: string): Level {
  const level = allLevels().find((candidate) => candidate.id === levelId);
  if (level === undefined) throw new Error(`no level '${levelId}'`);
  return level;
}

/** Replays the log in a file and verifies its hashes. Throws for a file it cannot read. */
export async function replayFile(file: string, queries: boolean): Promise<CliReplayResult> {
  const text = readFileSync(file, 'utf8');
  const firstLine = text.slice(0, text.indexOf('\n') === -1 ? text.length : text.indexOf('\n'));
  let header: unknown = null;
  try {
    header = JSON.parse(firstLine) as unknown;
  } catch {
    header = null;
  }
  if (
    typeof header === 'object' &&
    header !== null &&
    (header as { type?: unknown }).type === 'session'
  ) {
    // A session file of the data directory.
    const stored = parseSessionFile(text);
    const level = levelById(stored.header.level_id);
    const notes: string[] = [];
    if (canonicalHash(level) !== stored.header.level_digest) {
      notes.push(`level '${level.id}' has changed since the session was played`);
    }
    if (stored.truncated) notes.push('the last line of the file was cut short and was left out');
    const washes = join(dirname(resolve(file)), '..', 'washes');
    const gate = new WashGate();
    const session = await createSession({ level, washRunner: gate.runner });
    try {
      const replay = await replayStoredSession(session, gate, stored, (line, manifest) => {
        const path = join(washes, `${line.cache_key}.json`);
        if (existsSync(path)) {
          const record = JSON.parse(readFileSync(path, 'utf8')) as WashResultRecord;
          return Promise.resolve<WashReport>(record.report);
        }
        // Only whether the wash ended well bears on the scene; the report itself does not.
        notes.push(`the stored result of wash ${line.job_id} was not found`);
        return placeholderWashRunner(manifest, () => undefined);
      });
      return {
        ok: replay.mismatches.length === 0,
        level_id: level.id,
        replayed: replay.replayed,
        mismatches: replay.mismatches,
        digest_mismatches: replay.digestMismatches,
        final_state_hash: session.stateHash(),
        notes,
      };
    } finally {
      session.dispose();
    }
  }
  const saved = JSON.parse(text) as {
    level?: Level;
    level_id?: string;
    log?: ActionLogEvent[];
  };
  if (!Array.isArray(saved.log)) throw new Error('the file has no log');
  const level =
    saved.level ?? (typeof saved.level_id === 'string' ? levelById(saved.level_id) : undefined);
  if (level === undefined) throw new Error('the file names no level');
  const result = await replayActionLog(level, saved.log, { queries });
  return {
    ok: result.ok,
    level_id: level.id,
    replayed: result.replayed,
    mismatches: result.mismatches.filter((m) => m.field !== 'result_digest'),
    digest_mismatches: result.mismatches.filter((m) => m.field === 'result_digest').length,
    final_state_hash: result.final_state_hash,
    notes: [],
  };
}

/**
 * Asks a server in benchmark mode for a new episode of a level for a named person, and
 * returns the address that opens it in the web client. Throws when the server refuses.
 */
export async function createEpisodeLink(options: {
  /** Base address of the server, for example `http://127.0.0.1:8787`. */
  readonly server: string;
  readonly adminToken: string;
  readonly levelId: string;
  /** The participant id the player is recorded under. */
  readonly player: string;
  /** `human` (default: a person at the web client) or `agent` (a model at the MCP server). */
  readonly kind?: 'human' | 'agent';
}): Promise<{ url: string; session_id: string }> {
  const base = options.server.replace(/\/+$/, '');
  const response = await fetch(`${base}/api/sessions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-spotless-admin': options.adminToken },
    body: JSON.stringify({
      level_id: options.levelId,
      player:
        options.kind === 'agent'
          ? { kind: 'agent', name: options.player, interface: 'mcp' }
          : { kind: 'human', name: options.player, interface: 'web' },
    }),
  });
  const body = (await response.json()) as { session_id?: string; reason?: string; detail?: string };
  if (!response.ok || typeof body.session_id !== 'string') {
    throw new Error(`the server refused: ${body.reason ?? response.status} ${body.detail ?? ''}`);
  }
  return { url: `${base}/#${body.session_id}`, session_id: body.session_id };
}

/**
 * Runs the command line with the arguments after the program name and resolves with the exit
 * status. `serve` resolves when the server has been stopped (SIGINT or SIGTERM).
 */
export async function main(argv: readonly string[], io: CliIo): Promise<number> {
  const [command, ...rest] = argv;
  if (command === 'levels') {
    const { values } = parseArgs({ args: rest, options: { json: { type: 'boolean' } } });
    const levels = allLevels().map((level) => ({
      id: level.id,
      title: level.title,
      summary: level.summary,
      items: level.items.length,
      points_available: level.items.reduce((sum, item) => sum + item.points, 0),
      programme: level.programmeId,
      machine: level.machineId,
    }));
    if (values.json === true) io.out(JSON.stringify(levels));
    else {
      for (const level of levels) {
        io.out(
          `${level.id.padEnd(20)} ${String(level.items).padStart(4)} items ` +
            `${String(level.points_available).padStart(5)} points  ${level.title}`,
        );
      }
    }
    return 0;
  }
  if (command === 'replay') {
    const { values, positionals } = parseArgs({
      args: rest,
      options: { queries: { type: 'boolean' } },
      allowPositionals: true,
    });
    const file = positionals[0];
    if (file === undefined) {
      io.err(USAGE);
      return 2;
    }
    try {
      const result = await replayFile(file, values.queries === true);
      io.out(JSON.stringify(result));
      return result.ok ? 0 : 1;
    } catch (error) {
      io.err(`replay: ${error instanceof Error ? error.message : String(error)}`);
      return 2;
    }
  }
  if (command === 'serve') {
    const { values } = parseArgs({
      args: rest,
      options: {
        port: { type: 'string', default: '8787' },
        host: { type: 'string', default: '127.0.0.1' },
        'allow-origin': { type: 'string', multiple: true },
        'allow-host': { type: 'string', multiple: true },
        data: { type: 'string', default: '.spotless' },
        static: { type: 'string' },
        'no-static': { type: 'boolean' },
        log: { type: 'boolean' },
        'admin-token': { type: 'string' },
        ...WASH_OPTION_FLAGS,
        'no-render': { type: 'boolean' },
      },
    });
    const port = Number(values.port);
    if (!Number.isInteger(port) || port < 0 || port > 65535) {
      io.err(`serve: '${values.port}' is not a port`);
      return 2;
    }
    // The web origins, beside the server's own, whose pages may call it, and the host names,
    // beside the addresses the server listens on, that requests may be sent under.
    let allowedOrigins: string[];
    let allowedHosts: string[];
    try {
      allowedOrigins = parseAllowedOrigins(values['allow-origin'] ?? []);
    } catch (error) {
      io.err(`serve: --allow-origin: ${error instanceof Error ? error.message : String(error)}`);
      return 2;
    }
    try {
      allowedHosts = parseAllowedHosts(values['allow-host'] ?? []);
    } catch (error) {
      io.err(`serve: --allow-host: ${error instanceof Error ? error.message : String(error)}`);
      return 2;
    }
    // Benchmark mode: only the harness, which knows this token, creates and lists sessions.
    const adminToken = values['admin-token'] ?? process.env['SPOTLESS_ADMIN_TOKEN'];
    if (adminToken !== undefined && adminToken.length < 8) {
      io.err('serve: the admin token must have at least 8 characters');
      return 2;
    }
    // The tier of the wash simulation (official unless said: fast is a preview) and the
    // parameters of the washes (the machine's own unless named sets or the registry defaults
    // are asked for).
    const wash = washOptionsOf(values, process.env['SPOTLESS_WASH_TIER']);
    if (typeof wash === 'string') {
      io.err(`serve: ${wash}`);
      return 2;
    }
    // The render service starts Chrome when the first picture is asked for, not before.
    const renderer =
      values['no-render'] === true
        ? undefined
        : createRenderService({ cacheDir: join(resolve(values.data), 'renders') });
    const server = await buildServer({
      dataDir: resolve(values.data),
      host: values.host,
      allowedOrigins,
      allowedHosts,
      logger: values.log === true,
      ...(renderer === undefined ? {} : { renderer }),
      ...(adminToken === undefined ? {} : { adminToken }),
      ...wash,
      ...(values['no-static'] === true
        ? { staticDir: null }
        : values.static === undefined
          ? {}
          : { staticDir: resolve(values.static) }),
    });
    let address: string;
    try {
      address = await server.app.listen({ port, host: values.host });
    } catch (error) {
      // Nothing listens: stop the wash queue and the render service, so that the process ends.
      await server.close();
      const code = (error as { code?: unknown }).code;
      io.err(
        code === 'EADDRINUSE'
          ? `serve: port ${port} is in use; give --port <n>`
          : `serve: cannot listen on ${values.host}, port ${port}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 1;
    }
    io.out(`spotless-simd listening on ${address}`);
    io.out(`  data directory: ${server.store.dir}`);
    io.out(
      adminToken === undefined
        ? '  mode:           open (anybody may start a session; no listings)'
        : '  mode:           benchmark (sessions are created with the admin token only)',
    );
    io.out(
      `  wash runner:    ${server.queue.identity.module}#${server.queue.identity.export_name}` +
        ` (${server.queue.tier} tier)`,
    );
    io.out(
      server.staticDir === null
        ? '  web client:     not built (API only)'
        : `  web client:     ${server.staticDir}`,
    );
    io.out(
      renderer === undefined
        ? '  render query:   off (--no-render)'
        : '  render query:   on (headless Chrome, started by the first picture)',
    );
    io.out(
      allowedOrigins.length === 0
        ? '  web pages:      its own page only (another origin: --allow-origin <origin>)'
        : `  web pages:      its own page and those of ${allowedOrigins.join(', ')}`,
    );
    io.out(
      `  host names:     ${answeredHosts(
        server.app.addresses().map((one) => one.address),
        values.host,
        allowedHosts,
      ).join(', ')} (another name: --allow-host <name>)`,
    );
    await new Promise<void>((stopped) => {
      const stop = (): void => {
        void server.close().then(stopped);
      };
      process.once('SIGINT', stop);
      process.once('SIGTERM', stop);
    });
    return 0;
  }
  if (command === 'link') {
    const { values } = parseArgs({
      args: rest,
      options: {
        server: { type: 'string', default: 'http://127.0.0.1:8787' },
        level: { type: 'string' },
        player: { type: 'string' },
        agent: { type: 'boolean' },
        'admin-token': { type: 'string' },
      },
    });
    const adminToken = values['admin-token'] ?? process.env['SPOTLESS_ADMIN_TOKEN'];
    if (values.level === undefined || values.player === undefined || adminToken === undefined) {
      io.err(
        'link: --level, --player and the admin token (--admin-token or SPOTLESS_ADMIN_TOKEN) are needed',
      );
      return 2;
    }
    try {
      const link = await createEpisodeLink({
        server: values.server,
        adminToken,
        levelId: values.level,
        player: values.player,
        ...(values.agent === true ? { kind: 'agent' as const } : {}),
      });
      io.out(link.url);
      io.out(`  episode: ${link.session_id}  level: ${values.level}  player: ${values.player}`);
      return 0;
    } catch (error) {
      io.err(`link: ${error instanceof Error ? error.message : String(error)}`);
      return 1;
    }
  }
  io.err(USAGE);
  return command === undefined || command === 'help' || command === '--help' ? 0 : 2;
}

const invoked = process.argv[1];
if (invoked !== undefined && import.meta.url === pathToFileURL(invoked).href) {
  main(process.argv.slice(2), {
    out: (line) => {
      console.log(line);
    },
    err: (line) => {
      console.error(line);
    },
  }).then(
    (status) => {
      process.exit(status);
    },
    (error: unknown) => {
      console.error(error);
      process.exit(1);
    },
  );
}
