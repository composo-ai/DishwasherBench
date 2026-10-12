/**
 * The MCP server's side of the game server: a thin HTTP client bound to one session. It can
 * call the actions and queries of that session, read the free facts about it (who is playing,
 * the level card, the guidance), and nothing else: it holds no admin token, so it can neither
 * create nor list sessions, and it never sends another session's id.
 */

import type { LevelCard } from '@spotless/session';
import { requestOnce } from './http-once.ts';
import type { ToolName } from './schemas.ts';

/** What the game answered to a call. */
export interface GameAnswer {
  /** HTTP status: 200 for an answer of the game (accepted or refused), 4xx/5xx for the server's own refusals. */
  readonly status: number;
  /** The JSON body. */
  readonly body: unknown;
}

/** The session as the free summary endpoint describes it. */
export interface GameSummary {
  readonly session_id: string;
  readonly level_id: string;
  readonly phase: string;
  /** `sha256:<hex>` of the scene as it is now. */
  readonly state_hash: string;
  /** The budget counters as they are now. */
  readonly budget: {
    readonly actions_used: number;
    readonly actions_max: number;
    readonly queries_used: number;
    readonly queries_max: number;
    readonly washes_used: number;
    readonly washes_max: number;
  };
  readonly job: {
    readonly job_id: string;
    readonly status: string;
    readonly progress: number;
  } | null;
}

/** Options of {@link GameClient}. */
export interface GameClientOptions {
  /** Base address of the game server, for example `http://127.0.0.1:8787`. */
  readonly server: string;
  /** The session (episode) this client is bound to. */
  readonly sessionId: string;
  /** A `fetch` to send the calls with; default a connection of its own per call. */
  readonly fetch?: typeof fetch;
}

/** Calls of one session of the game server. */
export class GameClient {
  private readonly base: string;
  private readonly root: string;
  private readonly fetcher: typeof fetch | undefined;

  constructor(options: GameClientOptions) {
    this.root = options.server.replace(/\/+$/, '');
    this.base = `${this.root}/api/sessions/${encodeURIComponent(options.sessionId)}`;
    this.fetcher = options.fetch;
  }

  private async request(method: 'GET' | 'POST', url: string, body?: unknown): Promise<GameAnswer> {
    let status: number;
    let text: string;
    if (this.fetcher === undefined) {
      // One connection per call (see `http-once.ts`): a call of the game is never sent twice,
      // so it must not go out on a connection that may have died while this process was busy.
      const answer = await requestOnce(method, url, body === undefined ? {} : { body });
      status = answer.status;
      text = answer.text;
    } else {
      const response = await this.fetcher(url, {
        method,
        ...(body === undefined
          ? {}
          : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
      });
      status = response.status;
      text = await response.text();
    }
    let parsed: unknown = null;
    try {
      parsed = text === '' ? null : (JSON.parse(text) as unknown);
    } catch {
      parsed = { accepted: false, reason: 'bad_response', detail: text.slice(0, 200) };
    }
    return { status, body: parsed };
  }

  /** One action or query of the session contract, by its wire name, with its request as body. */
  call(name: ToolName, args: unknown): Promise<GameAnswer> {
    return this.request('POST', `${this.base}/${name}`, args ?? {});
  }

  /** Phase and wash job of the session, free of charge and not logged. */
  async summary(): Promise<GameSummary> {
    const answer = await this.request('GET', this.base);
    if (answer.status !== 200) {
      throw new Error(`the game server does not know this episode (HTTP ${answer.status})`);
    }
    return answer.body as GameSummary;
  }

  /** The level card of the session's level, free of charge (it is delivered at the start). */
  async levelCard(): Promise<LevelCard> {
    // Through the session: in benchmark mode the cards of other levels are the harness's.
    const answer = await this.request('GET', `${this.base}/card`);
    if (answer.status !== 200) throw new Error(`no level card (HTTP ${answer.status})`);
    return answer.body as LevelCard;
  }

  /** The generic loading guidance every player is shown. */
  async guidance(): Promise<{ version: string; title: string; text: string }> {
    const answer = await this.request('GET', `${this.root}/api/guidance`);
    if (answer.status !== 200) throw new Error(`no guidance (HTTP ${answer.status})`);
    return answer.body as { version: string; title: string; text: string };
  }
}
