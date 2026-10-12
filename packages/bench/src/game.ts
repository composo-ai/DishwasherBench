/**
 * The game server a harness run plays on: a server of this process in benchmark mode (its own
 * data directory, a fresh admin token, the wash at the tier asked for, the render service),
 * or a server that is already running somewhere, reached by its address and admin token.
 */

import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import type { Level } from '@spotless/levels';
import { allLevels } from '@spotless/levels';
import { requestOnce } from '@spotless/mcp';
import type {
  EpisodePlayer,
  EpisodeRecord,
  ServerOptions,
  SessionSummary,
  SpotlessServer,
} from '@spotless/server';
import { buildServer, createRenderService } from '@spotless/server';
import type { WashTier } from '@spotless/session';

/** A game server in benchmark mode, as the harness uses it. */
export interface HarnessGame {
  /** Base address, for example `http://127.0.0.1:51234`. */
  readonly url: string;
  /** The levels the server offers, by id (the harness replays logs on them). */
  readonly levels: ReadonlyMap<string, Level>;
  /** Creates the episode of a level for a player and returns its id. */
  createEpisode(levelId: string, player: EpisodePlayer): Promise<string>;
  /** Phase, budget and wash job of an episode (free, not logged). */
  summary(episodeId: string): Promise<SessionSummary>;
  /**
   * Starts the cycle of an episode on the harness's own account (logged like any call), on the
   * programme the level is scored on unless one of its secondary programmes is named.
   */
  startCycle(
    episodeId: string,
    programme?: string,
  ): Promise<{ accepted: boolean; reason?: string; detail?: string }>;
  /** The episode record as the server holds it. */
  record(episodeId: string): Promise<EpisodeRecord>;
  /** Stops a server this process started; nothing for a server that was only reached. */
  close(): Promise<void>;
}

/** Options of {@link startGame}. */
export interface StartGameOptions {
  /** Directory for the server's data (session logs, wash results, pictures); created if missing. */
  readonly dataDir: string;
  /** The tier washes are run at; default `official`, as benchmark mode has it. */
  readonly washTier?: WashTier;
  /** Attach the render service (headless Chrome, started by the first picture); default true. */
  readonly render?: boolean;
  /** The levels on offer; default every level of the game (starter and generated). */
  readonly levels?: readonly Level[];
  /** Further options of the server (the tests give a wash runner that simulates nothing). */
  readonly server?: Partial<ServerOptions>;
}

async function json<T>(
  method: 'GET' | 'POST',
  url: string,
  what: string,
  options: { body?: unknown; headers?: { [name: string]: string } } = {},
): Promise<T> {
  // A connection of its own per request: a scripted policy keeps this process busy for
  // minutes at a time, and a pooled connection would not survive that.
  const response = await requestOnce(method, url, options);
  let body: T & { reason?: string; detail?: string };
  try {
    body = JSON.parse(response.text) as T & { reason?: string; detail?: string };
  } catch {
    throw new Error(
      `${what}: the game server answered with something that is not JSON (HTTP ${response.status})`,
    );
  }
  if (response.status < 200 || response.status >= 300) {
    throw new Error(
      `${what}: the game server refused (${response.status} ${body.reason ?? ''} ${body.detail ?? ''})`,
    );
  }
  return body;
}

function gameAt(
  url: string,
  adminToken: string,
  levels: readonly Level[],
  close: () => Promise<void>,
): HarnessGame {
  const admin = { 'x-spotless-admin': adminToken };
  return {
    url,
    levels: new Map(levels.map((level) => [level.id, level])),
    async createEpisode(levelId, player) {
      const created = await json<{ session_id: string }>(
        'POST',
        `${url}/api/sessions`,
        'creating the episode',
        {
          body: { level_id: levelId, player },
          headers: admin,
        },
      );
      return created.session_id;
    },
    summary: (episodeId) =>
      json<SessionSummary>('GET', `${url}/api/sessions/${episodeId}`, 'the summary'),
    startCycle: (episodeId, programme) =>
      json('POST', `${url}/api/sessions/${episodeId}/start_cycle`, 'start_cycle', {
        body: programme === undefined ? {} : { programme },
      }),
    record: (episodeId) =>
      json<EpisodeRecord>('GET', `${url}/api/sessions/${episodeId}/episode`, 'the episode record', {
        headers: admin,
      }),
    close,
  };
}

/** Starts a game server of this process in benchmark mode on a free port. */
export async function startGame(
  options: StartGameOptions,
): Promise<HarnessGame & { server: SpotlessServer }> {
  mkdirSync(options.dataDir, { recursive: true });
  const adminToken = randomUUID();
  const levels = options.levels ?? allLevels();
  const renderer =
    options.render === false
      ? undefined
      : createRenderService({ cacheDir: join(options.dataDir, 'renders') });
  const server = await buildServer({
    dataDir: options.dataDir,
    staticDir: null,
    adminToken,
    levels,
    washTier: options.washTier ?? 'official',
    ...(renderer === undefined ? {} : { renderer }),
    ...options.server,
  });
  await server.app.listen({ port: 0, host: '127.0.0.1' });
  const port = (server.app.server.address() as AddressInfo).port;
  const game = gameAt(`http://127.0.0.1:${port}`, adminToken, levels, () => server.close());
  return { ...game, server };
}

/**
 * A game server that is already running in benchmark mode, reached by its address and admin
 * token. The harness takes the server's levels to be the levels of this repository and
 * checks each episode's level digest against them before it replays a log.
 */
export function connectGame(
  url: string,
  adminToken: string,
  levels?: readonly Level[],
): HarnessGame {
  return gameAt(url.replace(/\/+$/, ''), adminToken, levels ?? allLevels(), () =>
    Promise.resolve(),
  );
}
