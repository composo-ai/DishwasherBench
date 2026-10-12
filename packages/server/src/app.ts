/**
 * The game server: an HTTP JSON API that mirrors the session's actions and queries one to one,
 * a WebSocket per session, geometry for clients, the wash queue and the web client's files.
 *
 * Routes (all under `/api`; bodies and answers are JSON):
 *
 *   GET    /api/health
 *   GET    /api/guidance                        the generic loading guidance (the same for all)
 *   GET    /api/levels                          the levels on offer
 *   GET    /api/levels/:level_id                a level card, without a session
 *   POST   /api/sessions                        { level_id, player? } -> session id, level card,
 *                                               scene (harness only when the server has an
 *                                               admin token)
 *   GET    /api/sessions                        ids of sessions in memory and stored (harness only)
 *   GET    /api/sessions/:id                    summary (free: no budget is touched)
 *   DELETE /api/sessions/:id                    take out of memory (the log stays)
 *   POST   /api/sessions/:id/restore            replay the stored log and verify its hashes
 *   POST   /api/sessions/:id/place | remove | reset | set_rack | start_cycle      actions
 *   POST   /api/sessions/:id/get_level | get_state | get_item | preview | list_slots |
 *                            check_load | get_report | render                     queries
 *   GET    /api/sessions/:id/get_level | get_state | check_load | get_report      the same
 *   GET    /api/sessions/:id/get_item?item_id=  /list_slots?rack=                 the same
 *   GET    /api/sessions/:id/wash_options       the washes on offer, with the time each takes
 *   POST   /api/sessions/:id/rewash             { wash_tier? }: a new session with the same
 *                                               load, its cycle started at that tier (open
 *                                               mode only)
 *   GET    /api/sessions/:id/scene              scene state and draw poses (free)
 *   GET    /api/sessions/:id/geometry           shapes and placement aids (free)
 *   GET    /api/sessions/:id/residue_map?item_id=   residue of one washed item, by cell (free)
 *   GET    /api/sessions/:id/log                the action log
 *   GET    /api/sessions/:id/player             who is playing, and whether a name is wanted
 *   POST   /api/sessions/:id/player             { name }: a player without a name gives one
 *   GET    /api/sessions/:id/episode            the episode record as it stands (harness only)
 *   GET    /api/sessions/:id/ws                 WebSocket: animation, state, wash progress
 *   GET    /api/jobs                            the wash queue (harness only)
 *   GET    /api/jobs/:job_id                    one wash job
 *
 * Who may do what. A session id is a random UUID and is the player's key to that session: it
 * opens every route under `/api/sessions/:id` and nothing else. No route open to players lists
 * session or job ids, so a player reaches only the sessions whose ids they were given. The
 * listings, and in benchmark mode the creation of sessions, belong to the harness: they need
 * the server's admin token (`ServerOptions.adminToken`) in the `x-spotless-admin` header. With
 * an admin token set, a player cannot open a second session of a level to wash a load there
 * and read the report before committing in the first; the harness hands out one session per
 * episode. Without one (local play) anybody may create a session and nobody may list them.
 *
 * Which web pages may call. A browser sends an `Origin` header with every request a page of
 * another site makes that could change anything, and with every WebSocket it opens. A request
 * whose `Origin` is neither the server's own (the scheme, host and port the request was sent
 * to) nor one of `AccessOptions.allowedOrigins` is answered with 403 before its route is
 * looked at, the WebSocket route included; only an allowed origin is sent CORS headers. A
 * request whose `Host` header names a host the server does not answer to, whatever the port,
 * is answered with 403 too: that is a page that reached this machine under a name of its own
 * (DNS rebinding). While the server listens on a loopback address (the default) it answers to
 * 127.0.0.1, localhost and [::1]; on one other address, to that address; on every address
 * (0.0.0.0 or ::), to the loopback names and every address of this machine; and always to the
 * names of `AccessOptions.allowedHosts`. So a page from elsewhere cannot drive a server on
 * this machine. Requests without an `Origin` (the harness, the MCP server, curl) are not
 * affected, as long as they name the server by one of those hosts.
 * What is left: a plain GET that a page of another site causes without an `Origin` (a picture,
 * a link) is answered, but the page cannot read the answer, and every GET that counts against
 * a session needs the id of that session, which no such page is told.
 *
 * A call the session rejects is answered with HTTP 200 and the rejection as a value
 * (`{ accepted: false, reason }`), exactly as the session returned it. The server's own
 * refusals have the same shape with an HTTP status that says whose fault it is: 400 a malformed
 * request, 403 a route that is the harness's or a request from a foreign origin or under a
 * foreign host name, 404 an unknown session, level or job, 409 a log that does not replay,
 * 503 no room, 500 a fault of the server.
 */

import { existsSync } from 'node:fs';
import { isIPv6 } from 'node:net';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import { reject } from '@spotless/core';
import type { LevelCard } from '@spotless/levels';
import { allLevels, levelCard } from '@spotless/levels';
import type {
  GetItemRequest,
  GetReportResult,
  ListSlotsRequest,
  PlaceRequest,
  PreviewRequest,
  RemoveRequest,
  RenderRequest,
  RenderResult,
  SetRackRequest,
  StartCycleRequest,
} from '@spotless/session';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import Fastify from 'fastify';
import type { z } from 'zod';
import { geometryPayload, sceneView } from './draw.ts';
import { guidancePayload } from './guidance.ts';
import {
  createSessionSchema,
  describeIssues,
  emptySchema,
  itemSchema,
  listSlotsSchema,
  namePlayerSchema,
  placeSchema,
  previewSchema,
  renderSchema,
  rewashSchema,
  setRackSchema,
  startCycleQuerySchema,
  startCycleSchema,
} from './schemas.ts';
import type { SessionEntry } from './sessions.ts';
import { ServerError, SessionManager } from './sessions.ts';
import { DataStore } from './store.ts';
import type {
  HelloMessage,
  LevelListing,
  RenderContext,
  ServerMessage,
  ServerOptions,
  ServerRejected,
  SessionRenderService,
  WashOptionsPayload,
} from './types.ts';
import { washOptions } from './wash-estimate.ts';
import { WashQueue } from './wash-queue.ts';
import { WASH_RUNNER } from './wash-runner.ts';

/** A running (or injectable) game server and what it is made of. */
export interface SpotlessServer {
  /** The Fastify instance: `listen`, `inject`, `injectWS`. */
  readonly app: FastifyInstance;
  readonly manager: SessionManager;
  readonly queue: WashQueue;
  readonly store: DataStore;
  /** The directory the web client is served from, or null. */
  readonly staticDir: string | null;
  /** Stops the server: closes sockets, frees every session, stops the wash queue. */
  close(): Promise<void>;
}

/**
 * How long a wash may run before it is stopped and reported as failed, unless the options say
 * otherwise: an hour, twice the half hour a full load at the official tier is meant to stay
 * under (docs/research/benchmark.md section 4.6).
 */
export const WASH_TIMEOUT_MS = 60 * 60 * 1000;

/** Where the built web client is expected in this repository. */
export const DEFAULT_STATIC_DIR = fileURLToPath(new URL('../../../apps/web/dist', import.meta.url));

/** Which web pages may call the server, beside the options of {@link ServerOptions}. */
export interface AccessOptions {
  /**
   * Web origins other than the server's own whose pages may call the API, each written as
   * `scheme://host[:port]` (for example `http://localhost:5173`). Default: none. `*` and
   * `null` are not origins and are refused. The page the server serves itself needs no entry,
   * and neither does the client under the Vite development server, which proxies `/api`.
   */
  readonly allowedOrigins?: readonly string[];
  /**
   * Host names, without a port, that the server answers to beside the addresses it listens on
   * (127.0.0.1, localhost and [::1] on a loopback address): for example the name by which a
   * container reaches its host, or the name of this machine on the network. Default: none. A
   * name given here is trusted to lead to this machine and nowhere else.
   */
  readonly allowedHosts?: readonly string[];
  /**
   * The address the server is going to listen on, as it is given to `app.listen`; default
   * `127.0.0.1`. It is asked only while the server is not listening (requests injected by a
   * test): once the server listens, the addresses it listens on are what count.
   */
  readonly host?: string;
}

/** The options of {@link buildServer}. */
export type BuildServerOptions = ServerOptions & AccessOptions;

/** The host names a server answers to for a loopback address. */
const LOOPBACK_HOSTS: readonly string[] = ['127.0.0.1', 'localhost', '[::1]'];

/** A `Host` header: a name, an IPv4 address or a bracketed IPv6 address, perhaps with a port. */
const HOST_HEADER = /^(\[[0-9a-f:.]+\]|[a-z0-9.-]+)(?::\d{1,5})?$/i;

/** The host of a `Host` header in lower case, without its port; null when it is not one. */
function hostOf(header: string): string | null {
  const match = HOST_HEADER.exec(header);
  return match === null ? null : (match[1] as string).toLowerCase();
}

/** True for an address only this machine reaches: 127.0.0.0/8, `::1` and `localhost`. */
export function isLoopbackAddress(address: string): boolean {
  const bare = address.toLowerCase().replace(/^\[(.*)\]$/, '$1');
  return bare === 'localhost' || bare === '::1' || /^127(\.\d{1,3}){3}$/.test(bare);
}

/** An address as a `Host` header writes it: lower case, an IPv6 address in brackets. */
function asHost(address: string): string {
  const lower = address.toLowerCase();
  return isIPv6(lower) ? `[${lower}]` : lower;
}

/**
 * The host names a request may be sent under, as a `Host` header writes them without its port:
 * the addresses the server listens on (`bound`), the address it was asked to listen on
 * (`given`, a name perhaps) and the names it was given (`allowed`, already in that form); the
 * loopback names for a loopback address; and for "every address" (0.0.0.0 or ::) the loopback
 * names and every address of this machine as they are at this moment. A name that leads here
 * by DNS is not among them unless it was given: that is what refuses a rebound name.
 */
export function answeredHosts(
  bound: readonly string[],
  given: string,
  allowed: readonly string[] = [],
): string[] {
  const names = [...bound, given];
  for (const address of bound) {
    if (isLoopbackAddress(address)) {
      names.push(...LOOPBACK_HOSTS);
    } else if (address === '0.0.0.0' || address === '::') {
      names.push(...LOOPBACK_HOSTS);
      for (const addresses of Object.values(networkInterfaces())) {
        for (const one of addresses ?? []) names.push(one.address);
      }
    }
  }
  return [...new Set([...names.map(asHost), ...allowed])];
}

/** The origin of an address as a browser writes it, or null when the text is not one. */
function originOf(text: string): string | null {
  try {
    const origin = new URL(text).origin;
    return origin === 'null' ? null : origin;
  } catch {
    return null;
  }
}

/**
 * The web origins of a list, each in the form a browser sends (`scheme://host[:port]`, lower
 * case, without the port its scheme implies). Throws a `RangeError` for an entry that is not
 * the origin of an http or https address: `*`, `null`, an address with a path.
 */
export function parseAllowedOrigins(origins: readonly string[]): string[] {
  return origins.map((entry) => {
    let url: URL | null = null;
    try {
      url = new URL(entry);
    } catch {
      url = null;
    }
    if (
      url === null ||
      (url.protocol !== 'http:' && url.protocol !== 'https:') ||
      url.username !== '' ||
      url.password !== '' ||
      `${url.pathname}${url.search}${url.hash}` !== '/'
    ) {
      throw new RangeError(
        `'${entry}' is not a web origin: write it as scheme://host[:port], for example http://localhost:5173`,
      );
    }
    return url.origin;
  });
}

/**
 * The host names of a list as a `Host` header writes them (lower case, IPv6 in brackets).
 * Throws a `RangeError` for an entry that is not a host name or an address: one with a port,
 * a scheme or a path.
 */
export function parseAllowedHosts(hosts: readonly string[]): string[] {
  return hosts.map((entry) => {
    const host = asHost(entry);
    if (hostOf(host) !== host) {
      throw new RangeError(
        `'${entry}' is not a host name: write the name or the address alone, without a port`,
      );
    }
    return host;
  });
}

/** A header's value cut short, for a message. */
const shown = (value: string): string => (value.length > 120 ? `${value.slice(0, 120)}…` : value);

interface SessionParams {
  readonly session_id: string;
}

/** Thrown by a route for a body that fails its schema. */
function invalid(detail: string): ServerError {
  return new ServerError('invalid_argument', 400, detail);
}

function parse<S extends z.ZodType>(schema: S, body: unknown): z.output<S> {
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) throw invalid(describeIssues(parsed.error));
  return parsed.data;
}

/**
 * Builds the server without listening. Call `app.listen` to serve, or `app.inject` and
 * `app.injectWS` to exercise it.
 */
/**
 * The difficulty of a level for the listing, when the level carries one (`difficulty`: a
 * number, 1 the easiest, or a word). The levels are listed in the order the levels package
 * gives them, which is the order they are meant to be played in.
 */
function levelDifficulty(level: object): { difficulty?: number | string } {
  const value = (level as { readonly difficulty?: unknown }).difficulty;
  return typeof value === 'number' || typeof value === 'string' ? { difficulty: value } : {};
}

export async function buildServer(options: BuildServerOptions): Promise<SpotlessServer> {
  const now = options.now ?? ((): string => new Date().toISOString());
  const allowedOrigins = new Set(parseAllowedOrigins(options.allowedOrigins ?? []));
  const allowedHosts = parseAllowedHosts(options.allowedHosts ?? []);
  const store = new DataStore(options.dataDir);
  const queue = new WashQueue({
    store,
    runner: options.washRunner ?? WASH_RUNNER,
    ...(options.washRunnerVersion === undefined
      ? {}
      : { runnerVersion: options.washRunnerVersion }),
    timeoutMs: options.washTimeoutMs ?? WASH_TIMEOUT_MS,
    // Every scored wash comes from the official tier, local play included: the fast tier is a
    // preview whose verdicts differ from the official ones on a few items of a full load
    // (the variance study of the water side, 10 October 2026), so a score at the fast tier
    // is not comparable with one at the official tier. It is there to be asked for.
    tier: options.washTier ?? 'official',
    ...(options.washParams === undefined ? {} : { params: options.washParams }),
    ...(options.acceptStaleParams === true ? { acceptStaleParams: true } : {}),
    // Where scores are published a wash is the keyed code's or it is no result.
    strictSource: options.adminToken !== undefined,
    now,
  });
  const manager = new SessionManager({
    store,
    queue,
    levels: options.levels ?? allLevels(),
    maxSessions: options.maxSessions ?? 32,
    animationRateHz: options.animationRateHz ?? 30,
    now,
    benchmarkMode: options.adminToken !== undefined,
  });
  const renderer: SessionRenderService | undefined =
    typeof options.renderer === 'function' ? { render: options.renderer } : options.renderer;
  /** What a renderer may ask about the wash of a session. */
  const renderContext = (entry: SessionEntry): RenderContext => ({
    session_id: entry.id,
    washKey: () => queue.lastWashKey(entry.id),
    // The report the player was given (kept with the session), never the result cache: a
    // wash whose result was not kept there still has a report, and it is that one the
    // pictures must agree with.
    report: () => manager.reportOf(entry),
    residueOf: (itemId) => queue.residueOf(entry.id, itemId),
  });

  const app = Fastify({ logger: options.logger ?? false, bodyLimit: 1024 * 1024 });
  await app.register(fastifyWebsocket);

  // A JSON body may be absent even when the content type says JSON (calls without parameters).
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, body, done) => {
    const text = typeof body === 'string' ? body : body.toString('utf8');
    if (text.trim() === '') {
      done(null, undefined);
      return;
    }
    try {
      done(null, JSON.parse(text) as unknown);
    } catch {
      done(invalid('the body is not JSON'));
    }
  });

  /** The host names a request may be sent under at this moment (see {@link answeredHosts}). */
  const hostsNow = (): readonly string[] => {
    const given = options.host ?? '127.0.0.1';
    const listening = app.addresses().map((address) => address.address);
    return answeredHosts(listening.length > 0 ? listening : [given], given, allowedHosts);
  };

  // Which web pages may call (see the head of this file). It runs before the route is looked
  // at and before a body is read, for every request: the API, the WebSocket, the page's files.
  app.addHook('onRequest', async (request, reply) => {
    const refuse = (detail: string): FastifyReply =>
      reply.code(403).send(reject('forbidden', detail));
    const host = request.headers.host;
    // A browser always names the host it believes it is talking to. A client that names none
    // (HTTP/1.0, a socket injected by a test) is not a browser.
    const hosts = hostsNow();
    if (host !== undefined && !hosts.includes(hostOf(host) ?? '')) {
      // The answer does not list the names: a page under a rebound name can read it, and on
      // `--host 0.0.0.0` the names are the machine's network addresses.
      return refuse(
        `the Host header names '${shown(host)}', which this server does not answer to (another name: --allow-host <name>)`,
      );
    }
    const sent = request.headers.origin;
    if (sent === undefined) return undefined;
    const origin = originOf(sent);
    // The server speaks plain HTTP, so its own origin is `http://` and the host it was sent to.
    const own = host !== undefined && hostOf(host) !== null ? originOf(`http://${host}`) : null;
    if (origin !== null && origin === own) return undefined;
    if (origin === null || !allowedOrigins.has(origin)) {
      return refuse(
        `a page of the origin '${shown(sent)}' may not call this server: it answers its own page, and the origins it was started with (--allow-origin <origin>)`,
      );
    }
    // An origin the server was told to allow: CORS headers for that origin, and no other.
    reply.header('access-control-allow-origin', origin).header('vary', 'Origin');
    if (
      request.method === 'OPTIONS' &&
      request.headers['access-control-request-method'] !== undefined
    ) {
      return reply
        .header('access-control-allow-methods', 'GET, POST, DELETE, OPTIONS')
        .header('access-control-allow-headers', 'content-type, x-spotless-admin')
        .code(204)
        .send();
    }
    return undefined;
  });

  app.setErrorHandler((error: unknown, _request, reply) => {
    if (error instanceof ServerError) {
      return reply.code(error.status).send(reject(error.reason, error.message));
    }
    const status = (error as { statusCode?: unknown }).statusCode;
    const message = error instanceof Error ? error.message : String(error);
    if (typeof status === 'number' && status >= 400 && status < 500) {
      return reply.code(status).send(reject('invalid_argument', message));
    }
    app.log.error(error);
    return reply.code(500).send(reject('internal_error', message));
  });

  const entryOf = (request: FastifyRequest): Promise<SessionEntry> =>
    manager.get((request.params as SessionParams).session_id);

  const adminToken = options.adminToken;
  if (adminToken !== undefined && adminToken.length < 8) {
    throw new RangeError('server: the admin token must have at least 8 characters');
  }
  /** Refuses a request that does not carry the admin token (or when the server has none). */
  const harnessOnly = (request: FastifyRequest, what: string): void => {
    const given = request.headers['x-spotless-admin'];
    if (adminToken === undefined || given !== adminToken) {
      throw new ServerError(
        'forbidden',
        403,
        `${what} is for the harness: it needs the server's admin token in the x-spotless-admin header`,
      );
    }
  };

  // -------------------------------------------------------------------------------------------
  // Levels
  // -------------------------------------------------------------------------------------------

  const cards = new Map<string, LevelCard>();

  app.get('/api/health', () => ({
    ok: true,
    benchmark_mode: adminToken !== undefined,
    sessions: manager.sessionIds().live.length,
    washes_pending: queue.pending,
    wash_runner: queue.identity,
    wash_tier: queue.tier,
    // Open mode: the page chooses the tier of each wash (`start_cycle?wash_tier=`).
    wash_choice: adminToken === undefined,
    render: renderer !== undefined,
  }));

  // The generic loading guidance: one text, the same for every player.
  app.get('/api/guidance', () => guidancePayload());

  // In benchmark mode the levels are the harness's to hand out: a participant with a link to
  // one episode does not read the cards of levels they have not played yet.
  app.get('/api/levels', (request): { levels: LevelListing[] } => {
    if (adminToken !== undefined) harnessOnly(request, 'the list of levels');
    return {
      levels: manager.allLevels().map((level) => ({
        id: level.id,
        title: level.title,
        summary: level.summary,
        items: level.items.length,
        points_available: level.items.reduce((sum, item) => sum + item.points, 0),
        ...levelDifficulty(level),
      })),
    };
  });

  app.get('/api/levels/:level_id', (request): LevelCard => {
    if (adminToken !== undefined) harnessOnly(request, 'a level card without a session');
    const { level_id: levelId } = request.params as { level_id: string };
    const level = manager.level(levelId);
    if (level === undefined) throw new ServerError('unknown_level', 404, `no level '${levelId}'`);
    let card = cards.get(levelId);
    if (card === undefined) {
      card = levelCard(level);
      cards.set(levelId, card);
    }
    return card;
  });

  // -------------------------------------------------------------------------------------------
  // Sessions
  // -------------------------------------------------------------------------------------------

  app.post('/api/sessions', async (request, reply) => {
    // In benchmark mode the harness opens the one session of an episode and hands its id on.
    if (adminToken !== undefined) harnessOnly(request, 'creating a session');
    const body = parse(createSessionSchema, request.body);
    const player =
      body.player === undefined
        ? undefined
        : {
            kind: body.player.kind,
            name: body.player.name,
            ...(body.player.interface === undefined ? {} : { interface: body.player.interface }),
          };
    const entry = await manager.create(body.level_id, player);
    return reply.code(201).send({
      session_id: entry.id,
      level_id: entry.level.id,
      level: entry.session.card,
      scene: sceneView(entry.session),
      ws_path: `/api/sessions/${entry.id}/ws`,
      player: manager.playerOf(entry),
    });
  });

  // Who is playing. In benchmark mode an episode belongs to a named player: the harness names
  // them when it creates the session, or the player gives a name once in the client.
  app.get('/api/sessions/:session_id/player', async (request) => {
    const entry = await entryOf(request);
    const player = manager.playerOf(entry);
    return {
      player,
      benchmark_mode: adminToken !== undefined,
      name_wanted: adminToken !== undefined && player === null,
    };
  });

  app.post('/api/sessions/:session_id/player', async (request) => {
    const entry = await entryOf(request);
    const body = parse(namePlayerSchema, request.body);
    const named = manager.namePlayer(entry, { kind: 'human', name: body.name, interface: 'web' });
    if (!named) {
      return reject('already_named', 'this session already has a player; its name stays');
    }
    return { accepted: true, player: manager.playerOf(entry) };
  });

  app.get('/api/sessions/:session_id/episode', async (request) => {
    harnessOnly(request, 'the episode record');
    return manager.episodeRecord(await entryOf(request));
  });

  app.get('/api/sessions', (request) => {
    harnessOnly(request, 'the list of sessions');
    return manager.sessionIds();
  });

  app.get('/api/sessions/:session_id', async (request) => manager.summary(await entryOf(request)));

  // The card of the session's own level, free and unlogged (it is what the page shows beside
  // the machine and what the MCP server offers as a resource).
  app.get(
    '/api/sessions/:session_id/card',
    async (request): Promise<LevelCard> => (await entryOf(request)).session.card,
  );

  app.delete('/api/sessions/:session_id', (request) => {
    if (adminToken !== undefined) harnessOnly(request, 'closing a session');
    const { session_id: sessionId } = request.params as SessionParams;
    if (!manager.close(sessionId) && !store.hasSession(sessionId)) {
      throw new ServerError('unknown_session', 404, `no session '${sessionId}'`);
    }
    return { closed: true, session_id: sessionId, stored: store.hasSession(sessionId) };
  });

  app.post('/api/sessions/:session_id/restore', async (request) => {
    if (adminToken !== undefined) harnessOnly(request, 'restoring a session');
    const { session_id: sessionId } = request.params as SessionParams;
    return (await manager.restore(sessionId)).summary;
  });

  // Actions.
  app.post('/api/sessions/:session_id/place', async (request) => {
    const entry = await entryOf(request);
    const body = parse(placeSchema, request.body) as unknown as PlaceRequest;
    return manager.act(entry, 'place', (session) => session.place(body));
  });

  app.post('/api/sessions/:session_id/remove', async (request) => {
    const entry = await entryOf(request);
    const body = parse(itemSchema, request.body) as RemoveRequest;
    return manager.act(entry, 'remove', (session) => session.remove(body));
  });

  app.post('/api/sessions/:session_id/reset', async (request) => {
    const entry = await entryOf(request);
    parse(emptySchema, request.body);
    return manager.act(entry, 'reset', (session) => session.reset());
  });

  app.post('/api/sessions/:session_id/set_rack', async (request) => {
    const entry = await entryOf(request);
    const body = parse(setRackSchema, request.body) as unknown as SetRackRequest;
    return manager.act(entry, 'set_rack', (session) => session.setRack(body));
  });

  app.post('/api/sessions/:session_id/start_cycle', async (request) => {
    const entry = await entryOf(request);
    const body = parse(startCycleSchema, request.body) as StartCycleRequest;
    // The tier of this wash, when the page names one: the server's affair, not the session's,
    // so it travels beside the request (the query string) and is not logged with it. In
    // benchmark mode it is not taken: every wash runs at the server's tier.
    const { wash_tier: tier } = parse(startCycleQuerySchema, request.query);
    if (tier !== undefined) manager.chooseWashTier(entry, tier);
    return manager.act(entry, 'start_cycle', (session) => session.startCycle(body));
  });

  // The washes a player may choose between, with an estimate of the time each takes for the
  // load as it stands. Free and unlogged: it says nothing about the game.
  app.get(
    '/api/sessions/:session_id/wash_options',
    async (request): Promise<WashOptionsPayload> => {
      const entry = await entryOf(request);
      const items = entry.session
        .peekState()
        .placed.filter((placed) => placed.location !== 'outside').length;
      return {
        choice: adminToken === undefined,
        tier: manager.washTierOf(entry),
        items,
        options: washOptions(items, join(store.dir, 'wash-timings.json')),
      };
    },
  );

  // The full wash after a preview: a new session of the same level with the same moves,
  // its cycle started at the tier asked for (the official one unless said).
  app.post('/api/sessions/:session_id/rewash', async (request, reply) => {
    const source = await entryOf(request);
    const body = parse(rewashSchema, request.body);
    const entry = await manager.rewash(source, body.wash_tier ?? 'official');
    return reply.code(201).send({
      session_id: entry.id,
      level_id: entry.level.id,
      level: entry.session.card,
      scene: sceneView(entry.session),
      ws_path: `/api/sessions/${entry.id}/ws`,
      player: manager.playerOf(entry),
      rewash_of: source.id,
    });
  });

  // Queries.
  const getLevel = async (request: FastifyRequest): Promise<LevelCard> => {
    const entry = await entryOf(request);
    return manager.query(entry, (session) => session.getLevel());
  };
  app.get('/api/sessions/:session_id/get_level', getLevel);
  app.post('/api/sessions/:session_id/get_level', getLevel);

  const getState = async (request: FastifyRequest): Promise<unknown> => {
    const entry = await entryOf(request);
    return manager.query(entry, (session) => session.getState());
  };
  app.get('/api/sessions/:session_id/get_state', getState);
  app.post('/api/sessions/:session_id/get_state', getState);

  const getItem = async (request: FastifyRequest): Promise<unknown> => {
    const entry = await entryOf(request);
    const source = request.method === 'GET' ? request.query : request.body;
    const body = parse(itemSchema, source) as GetItemRequest;
    const result = manager.query(entry, (session) => session.getItem(body));
    // The pictures of the item come from the render service, when one is attached and can
    // draw; they are no part of the logged result (its digest leaves images out).
    if (result.accepted && renderer?.thumbnails !== undefined) {
      try {
        const thumbnails = await renderer.thumbnails(entry.session, body.item_id);
        if (thumbnails.length > 0) return { ...result, item: { ...result.item, thumbnails } };
      } catch (error) {
        app.log.warn(error, 'get_item: no thumbnails');
      }
    }
    return result;
  };
  app.get('/api/sessions/:session_id/get_item', getItem);
  app.post('/api/sessions/:session_id/get_item', getItem);

  app.post('/api/sessions/:session_id/preview', async (request) => {
    const entry = await entryOf(request);
    const body = parse(previewSchema, request.body) as unknown as PreviewRequest;
    return manager.query(entry, (session) => session.preview(body));
  });

  const listSlots = async (request: FastifyRequest): Promise<unknown> => {
    const entry = await entryOf(request);
    const source = request.method === 'GET' ? request.query : request.body;
    const body = parse(listSlotsSchema, source) as unknown as ListSlotsRequest;
    return manager.query(entry, (session) => session.listSlots(body));
  };
  app.get('/api/sessions/:session_id/list_slots', listSlots);
  app.post('/api/sessions/:session_id/list_slots', listSlots);

  const checkLoad = async (request: FastifyRequest): Promise<unknown> => {
    const entry = await entryOf(request);
    return manager.query(entry, (session) => session.checkLoad());
  };
  app.get('/api/sessions/:session_id/check_load', checkLoad);
  app.post('/api/sessions/:session_id/check_load', checkLoad);

  const getReport = async (request: FastifyRequest): Promise<GetReportResult> => {
    const entry = await entryOf(request);
    const result = manager.query(entry, (session) => session.getReport());
    // The session knows nothing of the queue: a wash that waits its turn is `queued`, and the
    // stage a running wash is in is the queue's to say.
    if (result.accepted && result.status === 'running') {
      if (manager.washQueued(entry)) {
        return { accepted: true, job_id: result.job_id, status: 'queued' };
      }
      const stage = queue.stageOf(entry.id);
      if (stage !== null) return { ...result, stage };
    }
    return result;
  };
  app.get('/api/sessions/:session_id/get_report', getReport);
  app.post('/api/sessions/:session_id/get_report', getReport);

  app.post('/api/sessions/:session_id/render', async (request): Promise<RenderResult> => {
    const entry = await entryOf(request);
    const body = parse(renderSchema, request.body) as unknown as RenderRequest;
    if (renderer === undefined) {
      return reject('not_available', 'no render service is attached to this server');
    }
    const context = renderContext(entry);
    // A request that cannot be drawn is refused before anything is charged or logged.
    const refusal = renderer.check?.(entry.session, body, context) ?? null;
    if (refusal !== null) return refusal;
    const charge = (): ReturnType<typeof entry.session.chargeQuery> =>
      manager.query(entry, (session) =>
        session.chargeQuery('render', JSON.parse(JSON.stringify(body)) as never),
      );
    // With the query budget used up there is nothing to draw: the session says so (and logs it).
    const budget = entry.session.peekState().budget;
    if (budget.queries_used >= budget.queries_max) {
      const refused = charge();
      if (!refused.accepted) return refused;
    }
    let image;
    try {
      image = await renderer.render(entry.session, body, context);
    } catch (error) {
      // A render service that cannot start (no Chrome on this machine) is not a fault of the
      // request, and costs the player nothing.
      if (error instanceof Error && error.name === 'RenderUnavailableError') {
        return reject('not_available', error.message);
      }
      throw error;
    }
    // The picture exists: now the query is charged and logged.
    if (budget.queries_used < budget.queries_max) {
      const charged = charge();
      if (!charged.accepted) return charged;
    }
    return { accepted: true, view: body.view, image };
  });

  // What clients draw; none of it is charged or logged.
  app.get('/api/sessions/:session_id/scene', async (request) =>
    sceneView((await entryOf(request)).session),
  );

  app.get('/api/sessions/:session_id/geometry', async (request, reply) => {
    const payload = geometryPayload((await entryOf(request)).session);
    const tag = `"${payload.geometry_key}"`;
    reply.header('etag', tag);
    if (request.headers['if-none-match'] === tag) return reply.code(304).send();
    return payload;
  });

  // The residue left on one washed item, cell by cell: part of the report of the session's
  // last finished wash, fetched on demand. Free, like the report itself.
  app.get('/api/sessions/:session_id/residue_map', async (request) => {
    const entry = await entryOf(request);
    const { item_id: itemId } = parse(itemSchema, request.query);
    const map = queue.residueOf(entry.id, itemId);
    if (map === null) {
      return reject(
        'no_residue_map',
        `no residue map of '${itemId}': the session has no finished wash, the item was not washed, or the wash kept no maps`,
      );
    }
    return { accepted: true, map };
  });

  app.get('/api/sessions/:session_id/log', async (request) => {
    if (adminToken !== undefined) harnessOnly(request, 'the action log');
    const entry = await entryOf(request);
    return { session_id: entry.id, level_id: entry.level.id, log: manager.log(entry) };
  });

  // -------------------------------------------------------------------------------------------
  // WebSocket
  // -------------------------------------------------------------------------------------------

  app.get('/api/sessions/:session_id/ws', { websocket: true }, (socket, request) => {
    const send = (message: ServerMessage): void => {
      if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
    };
    let unsubscribe: (() => void) | null = null;
    let gone = false;
    socket.on('message', (data: unknown) => {
      // The channel is one-way but for a keep-alive.
      if (String(data).includes('ping')) send({ type: 'pong' });
    });
    socket.on('close', () => {
      gone = true;
      unsubscribe?.();
    });
    entryOf(request).then(
      (entry) => {
        if (gone) return;
        const hello: HelloMessage = {
          type: 'hello',
          session_id: entry.id,
          level_id: entry.level.id,
          scene: sceneView(entry.session),
          animation_rate_hz: manager.animationRate(entry),
        };
        send(hello);
        unsubscribe = manager.subscribe(entry, (message) => {
          send(message);
          if (message.type === 'error') socket.close(1001, message.reason);
        });
      },
      (error: unknown) => {
        const rejected: ServerRejected =
          error instanceof ServerError
            ? reject(error.reason, error.message)
            : reject('internal_error', error instanceof Error ? error.message : String(error));
        send({
          type: 'error',
          reason: rejected.reason,
          ...(rejected.detail === undefined ? {} : { detail: rejected.detail }),
        });
        socket.close(1008, rejected.reason);
      },
    );
  });

  // -------------------------------------------------------------------------------------------
  // Wash jobs
  // -------------------------------------------------------------------------------------------

  app.get('/api/jobs', (request) => {
    harnessOnly(request, 'the list of wash jobs');
    return { pending: queue.pending, jobs: queue.jobs() };
  });

  app.get('/api/jobs/:job_id', (request) => {
    // Job ids can be formed from a session id; in benchmark mode the record (cache key, the
    // code that ran, run statistics) is the harness's.
    if (adminToken !== undefined) harnessOnly(request, 'a wash job');
    const { job_id: jobId } = request.params as { job_id: string };
    const job = queue.job(jobId);
    if (job === null) throw new ServerError('unknown_job', 404, `no wash job '${jobId}'`);
    return job;
  });

  // -------------------------------------------------------------------------------------------
  // The web client
  // -------------------------------------------------------------------------------------------

  let staticDir: string | null = null;
  const wanted = options.staticDir === undefined ? DEFAULT_STATIC_DIR : options.staticDir;
  if (wanted !== null && existsSync(join(wanted, 'index.html'))) {
    staticDir = wanted;
    await app.register(fastifyStatic, { root: wanted, wildcard: false });
  }
  const served = staticDir;

  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    const path = request.url.split('?')[0] ?? '';
    if (served !== null && request.method === 'GET' && !path.startsWith('/api/')) {
      // The client is a single page: any other path is its own to route.
      return reply.sendFile('index.html');
    }
    return reply
      .code(404)
      .send(reject('invalid_argument', `no such endpoint: ${request.method} ${path}`));
  });

  app.addHook('onClose', async () => {
    manager.closeAll();
    queue.close();
    await renderer?.close?.();
  });

  return {
    app,
    manager,
    queue,
    store,
    staticDir,
    close: async () => {
      await app.close();
    },
  };
}
