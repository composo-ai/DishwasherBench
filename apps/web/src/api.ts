/**
 * The client's side of the server: one function per endpoint, and the session's WebSocket.
 * Every action and query of the game goes through here to the session layer on the server;
 * the client computes nothing that decides the game.
 */

import type {
  EpisodePlayer,
  GeometryPayload,
  GuidancePayload,
  LevelListing,
  SceneView,
  ServerMessage,
  SessionSummary,
  WashOptionsPayload,
} from '@spotless/server';
import type {
  CheckLoadResult,
  DropResult,
  GetReportResult,
  GetResidueMapResult,
  LevelCard,
  ListSlotsResult,
  PlaceRequest,
  PreviewRequest,
  PreviewResult,
  RackId,
  RemoveResult,
  ResetResult,
  SetRackRequest,
  SetRackResult,
  StartCycleResult,
  WashTier,
} from '@spotless/session';

/** A refusal by the server itself (not by the session): an HTTP status other than 2xx. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly reason: string,
    detail: string,
  ) {
    super(detail === '' ? reason : `${reason}: ${detail}`);
  }
}

/** Answer of `POST /api/sessions`. */
export interface CreatedSession {
  readonly session_id: string;
  readonly level_id: string;
  readonly level: LevelCard;
  readonly scene: SceneView;
  readonly ws_path: string;
}

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    ...(body === undefined
      ? {}
      : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text === '' ? null : JSON.parse(text);
  } catch {
    throw new ApiError(response.status, 'bad_response', text.slice(0, 200));
  }
  if (!response.ok) {
    const refusal = (data ?? {}) as { reason?: string; detail?: string };
    throw new ApiError(response.status, refusal.reason ?? 'http_error', refusal.detail ?? '');
  }
  return data as T;
}

/**
 * A level as the list of levels shows it. `difficulty` is read when the server's listing
 * carries it: a number (1 the easiest) or a word.
 */
export type LevelEntry = LevelListing & { readonly difficulty?: number | string };

/** The levels on offer, in the order the server gives them. */
export async function listLevels(): Promise<LevelEntry[]> {
  return (await request<{ levels: LevelEntry[] }>('GET', '/api/levels')).levels;
}

/** The washes a session can be started with, and how long each takes. */
export type WashChoice = WashOptionsPayload;

/** A level card, without a session. */
export function levelCard(levelId: string): Promise<LevelCard> {
  return request('GET', `/api/levels/${encodeURIComponent(levelId)}`);
}

/** What the server says about itself. */
export interface ServerHealth {
  readonly ok: boolean;
  /** True when only the harness creates sessions: a player needs the link of an episode. */
  readonly benchmark_mode: boolean;
  /** True when the page may choose the tier of each wash (a server in open mode). */
  readonly wash_choice?: boolean;
}

/** Whether the server is in benchmark mode. */
export function health(): Promise<ServerHealth> {
  return request('GET', '/api/health');
}

/** The generic loading guidance, the same text for every player. */
export function guidance(): Promise<GuidancePayload> {
  return request('GET', '/api/guidance');
}

/** Who is playing a session, and whether the server wants a name. */
export interface PlayerAnswer {
  readonly player: EpisodePlayer | null;
  readonly benchmark_mode: boolean;
  readonly name_wanted: boolean;
}

/** Starts a session of a level. */
export function createSession(levelId: string): Promise<CreatedSession> {
  return request('POST', '/api/sessions', { level_id: levelId });
}

/** The calls of one session. */
export class SessionApi {
  private readonly base: string;

  constructor(readonly sessionId: string) {
    this.base = `/api/sessions/${encodeURIComponent(sessionId)}`;
  }

  /** Phase, budget and wash job, free of charge. */
  summary(): Promise<SessionSummary> {
    return request('GET', this.base);
  }
  /** Who is playing this session. */
  player(): Promise<PlayerAnswer> {
    return request('GET', `${this.base}/player`);
  }
  /** Gives the player's name, once. */
  namePlayer(
    name: string,
  ): Promise<{ accepted: boolean; player?: EpisodePlayer; reason?: string }> {
    return request('POST', `${this.base}/player`, { name });
  }
  /** Scene state and draw poses, free of charge. */
  scene(): Promise<SceneView> {
    return request('GET', `${this.base}/scene`);
  }
  /** Shapes of the machine and of the level's item types, free of charge. */
  geometry(): Promise<GeometryPayload> {
    return request('GET', `${this.base}/geometry`);
  }
  place(body: PlaceRequest): Promise<DropResult> {
    return request('POST', `${this.base}/place`, body);
  }
  remove(itemId: string): Promise<RemoveResult> {
    return request('POST', `${this.base}/remove`, { item_id: itemId });
  }
  reset(): Promise<ResetResult> {
    return request('POST', `${this.base}/reset`, {});
  }
  setRack(body: SetRackRequest): Promise<SetRackResult> {
    return request('POST', `${this.base}/set_rack`, body);
  }
  /**
   * Starts the cycle on the programme the level is scored on. `washTier` asks for the quick
   * preview (`fast`) or the full wash (`official`); a server in benchmark mode washes at its
   * own tier whatever is asked, and without it the server's tier is used.
   */
  startCycle(washTier?: WashTier): Promise<StartCycleResult> {
    return request(
      'POST',
      `${this.base}/start_cycle${washTier === undefined ? '' : `?wash_tier=${washTier}`}`,
      {},
    );
  }
  /** The washes on offer for the load as it stands, with the time each is expected to take. */
  washOptions(): Promise<WashChoice> {
    return request('GET', `${this.base}/wash_options`);
  }
  /**
   * A new session with the same load, its cycle started at the full wash: what the report of
   * a preview offers. The server replays the moves of this session into it.
   */
  rewash(washTier: WashTier = 'official'): Promise<CreatedSession> {
    return request('POST', `${this.base}/rewash`, { wash_tier: washTier });
  }
  preview(body: PreviewRequest): Promise<PreviewResult> {
    return request('POST', `${this.base}/preview`, body);
  }
  /** The slots of a basket; with an item, where to drop it and whether that is free now. */
  listSlots(rack: RackId, itemId?: string): Promise<ListSlotsResult> {
    return request('POST', `${this.base}/list_slots`, {
      rack,
      ...(itemId === undefined ? {} : { item_id: itemId }),
    });
  }
  /** The card of the session's level (free; in benchmark mode the only way to a card). */
  card(): Promise<LevelCard> {
    return request('GET', `${this.base}/card`);
  }
  checkLoad(): Promise<CheckLoadResult> {
    return request('POST', `${this.base}/check_load`, {});
  }
  getReport(): Promise<GetReportResult> {
    return request('GET', `${this.base}/get_report`);
  }
  /** The residue left on one washed item, cell by cell: part of the report, free of charge. */
  residueMap(itemId: string): Promise<GetResidueMapResult> {
    return request('GET', `${this.base}/residue_map?item_id=${encodeURIComponent(itemId)}`);
  }

  /**
   * Opens the session's WebSocket. `onMessage` gets every message of the server; `onClose` is
   * called when the socket closes for whatever reason.
   */
  connect(onMessage: (message: ServerMessage) => void, onClose: () => void): WebSocket {
    const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${scheme}://${location.host}${this.base}/ws`);
    socket.addEventListener('message', (event) => {
      try {
        onMessage(JSON.parse(String(event.data)) as ServerMessage);
      } catch {
        // A message that is not JSON is not one of ours.
      }
    });
    socket.addEventListener('close', onClose);
    return socket;
  }
}
