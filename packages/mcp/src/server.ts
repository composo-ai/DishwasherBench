/**
 * The MCP server of one episode: one tool per action and query of the session contract, with
 * the contract's names and arguments, answered by the game server over HTTP. Results are
 * structured (with output schemas), pictures are MCP image content, and a call the game
 * refuses is a tool error that changed nothing. The level's manual and the generic loading
 * guidance are resources.
 *
 * A server is bound to the one session its `GameClient` was made for. No tool creates,
 * lists or names sessions, and no result carries the session's id.
 *
 * The results are shaped for a player who pays for every character (`shape.ts`): an action
 * answers with what it changed and not with the whole scene, the level card names every
 * kind of piece once, and slot advice comes a screenful at a time. For that the server
 * remembers two things about its one client: the whole scene as the client was last given it
 * (the changes of the next action are stated against that; a client that has never been given
 * the whole scene gets it with its next action), and the slot list the game gave last, while
 * the scene is as it was then (a further part of it costs nothing). The game, its log and
 * the digests in it are as they were: shaping happens here, after the game has answered.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type {
  CallToolResult,
  ServerNotification,
  ServerRequest,
  ToolAnnotations,
} from '@modelcontextprotocol/sdk/types.js';
import type { ItemRecord, LevelCard, SceneState } from '@spotless/session';
import type { z } from 'zod';
import { SERVER_INSTRUCTIONS, TOOL_TEXT } from './descriptions.ts';
import type { GameAnswer, GameClient } from './game-client.ts';
import type { ToolName } from './schemas.ts';
import { INPUT_SCHEMAS, OUTPUT_SCHEMAS, TOOL_NAMES } from './schemas.ts';
import {
  shapeAction,
  shapeItemRecord,
  shapeLevel,
  shapeLoadCheck,
  shapePreview,
  shapeSlots,
  shapeState,
  tidyNumbers,
} from './shape.ts';

/**
 * Name and version the server announces. 0.2.0 (2026-10-11): the results are shaped (an
 * action answers with what it changed, the level card says everything once, slot advice is a
 * ranked list a screenful at a time), `get_state` takes `rack` and `items`, `list_slots`
 * takes `offset`, `limit` and `row`.
 */
export const MCP_SERVER_INFO = { name: 'spotless', version: '0.2.0' } as const;

/** URIs of the resources. */
export const RESOURCE_URIS = {
  guidance: 'spotless://guidance/loading',
  manual: 'spotless://level/manual',
  card: 'spotless://level/card',
} as const;

/** The tools that change the scene (the rest only read it). */
const ACTIONS: readonly ToolName[] = ['place', 'remove', 'reset', 'set_rack', 'start_cycle'];

/** The queries whose answer says how many queries are used (the others are free, or say it anyway). */
const COUNTED: readonly ToolName[] = [
  'get_level',
  'get_item',
  'render',
  'list_slots',
  'check_load',
];

function isObject(value: unknown): value is { [key: string]: unknown } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** True for an answer of the game that is a scene state. */
function isSceneState(value: unknown): value is SceneState {
  return isObject(value) && Array.isArray(value['placed']) && isObject(value['budget']);
}

/** The names of the four pictures of `get_item`, in the order they are returned. */
export const THUMBNAIL_VIEWS = ['front_above', 'back_below', 'top', 'side'] as const;

interface WireImageLike {
  readonly mime_type: string;
  readonly width_px: number;
  readonly height_px: number;
  readonly data_base64: string;
}

function isImage(value: unknown): value is WireImageLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as WireImageLike).data_base64 === 'string' &&
    typeof (value as WireImageLike).mime_type === 'string'
  );
}

/**
 * Takes the pictures out of a result: the result with every image replaced by its size and
 * type (the structured content), and the pictures in the order they were met.
 */
export function splitImages(result: unknown): { structured: unknown; images: WireImageLike[] } {
  const images: WireImageLike[] = [];
  const walk = (value: unknown, key: string): unknown => {
    if (isImage(value)) {
      const index = images.length;
      images.push(value);
      return {
        mime_type: value.mime_type,
        width_px: value.width_px,
        height_px: value.height_px,
        ...(key === 'thumbnails' && THUMBNAIL_VIEWS[index] !== undefined
          ? { view: THUMBNAIL_VIEWS[index] }
          : {}),
      };
    }
    if (Array.isArray(value)) return value.map((entry) => walk(entry, key));
    if (typeof value === 'object' && value !== null) {
      const out: { [k: string]: unknown } = {};
      for (const [k, v] of Object.entries(value)) out[k] = walk(v, k);
      return out;
    }
    return value;
  };
  return { structured: walk(result, ''), images };
}

/** The rules of a level and its manual as one text, as the human client shows them. */
export function manualText(card: LevelCard): string {
  const budgets = card.rules.budgets;
  return [
    `Level: ${card.title}`,
    card.summary,
    `Scoring. ${card.rules.scoring}`,
    `Clean. ${card.rules.clean_definition}`,
    `Budgets. ${budgets.actions_max} accepted actions, ${budgets.queries_max} charged queries, ${budgets.washes_max} wash${budgets.washes_max === 1 ? '' : 'es'}. A refused call costs nothing.`,
    `End. ${card.rules.episode_end}`,
    ...(card.manual === null ? [] : ['How the game is played.', card.manual]),
  ].join('\n\n');
}

function pause(ms: number): Promise<void> {
  return new Promise<void>((next) => {
    setTimeout(next, ms);
  });
}

/** Options of {@link createSpotlessMcpServer}. */
export interface SpotlessMcpOptions {
  /** The game, bound to the episode this server is for. */
  readonly game: GameClient;
  /** Seconds between looks at a running wash while `get_report` waits; default 1. */
  readonly pollIntervalS?: number;
}

/**
 * Creates the MCP server of an episode. Connect it to a transport (`StdioServerTransport`,
 * `StreamableHTTPServerTransport`, or one end of an in-memory pair) to serve.
 */
export function createSpotlessMcpServer(options: SpotlessMcpOptions): McpServer {
  const { game } = options;
  const pollMs = Math.max(0.05, options.pollIntervalS ?? 1) * 1000;
  const server = new McpServer(MCP_SERVER_INFO, { instructions: SERVER_INSTRUCTIONS });

  /**
   * The whole scene as this client was last given it: by a `get_state` of the whole of it, by
   * an action that carried it, or by the changes of an action on top of those. The next
   * action's changes are stated against it. Null until the client has been given the whole
   * scene once: a `get_state` of a part (a basket, named items) is not that, so an action
   * that follows it still answers with the whole scene.
   */
  let told: SceneState | null = null;
  /**
   * The slot list the game gave last (one, as the page keeps the list of its last "Suggest
   * spots"), for the scene it was given for: a further part of it is read from here and
   * costs nothing while the scene is unchanged.
   */
  let slotList: { readonly key: string; readonly hash: string; readonly body: unknown } | null =
    null;

  /** The query counter as it stands, for the result of a charged query; nothing when it cannot be read. */
  const queriesNow = async (): Promise<{ budget?: { queries: string } }> => {
    try {
      const budget = (await game.summary()).budget;
      return { budget: { queries: `${budget.queries_used}/${budget.queries_max}` } };
    } catch {
      return {};
    }
  };

  /** One call of the game, answered in the shape this server returns. */
  const shaped = async (name: ToolName, args: unknown): Promise<GameAnswer> => {
    if (name === 'get_state') {
      // The game always gives the whole state (and logs the query as it always did); the
      // part asked for is cut out here.
      const answer = await game.call('get_state', {});
      if (answer.status !== 200 || !isSceneState(answer.body)) return answer;
      const filter = args as { rack?: string; items?: string[] };
      // Only the whole scene makes the client one that has been told the scene. A part
      // leaves `told` as it is: what the next action changed is then stated against the
      // whole scene the client last had, or, when it never had one, given whole.
      if (filter.rack === undefined && filter.items === undefined) told = answer.body;
      return {
        status: 200,
        body: shapeState(answer.body, {
          ...(filter.rack === undefined ? {} : { rack: filter.rack }),
          ...(filter.items === undefined ? {} : { items: filter.items }),
        }),
      };
    }
    if (name === 'list_slots') {
      const { offset, limit, row, ...asked } = args as {
        rack: string;
        item_id?: string;
        offset?: number;
        limit?: number;
        row?: string;
      };
      const page = {
        ...(offset === undefined ? {} : { offset }),
        ...(limit === undefined ? {} : { limit }),
        ...(row === undefined ? {} : { row }),
      };
      const key = `${asked.rack}|${asked.item_id ?? ''}`;
      // The list the game gave last, for this very scene, is not asked for again.
      let hash: string | null = null;
      try {
        hash = (await game.summary()).state_hash;
      } catch {
        hash = null;
      }
      const known = slotList;
      if (hash !== null && known !== null && known.key === key && known.hash === hash) {
        const body = shapeSlots(known.body, asked, page);
        return {
          status: 200,
          body: isObject(body) ? { ...body, repeat: true, ...(await queriesNow()) } : body,
        };
      }
      const answer = await game.call('list_slots', asked);
      if (answer.status !== 200 || !isObject(answer.body) || answer.body['accepted'] !== true) {
        return { status: answer.status, body: tidyNumbers(answer.body) };
      }
      // The list asked last takes the place of the one before it.
      slotList = hash === null ? null : { key, hash, body: answer.body };
      const body = shapeSlots(answer.body, asked, page);
      return { status: 200, body: isObject(body) ? { ...body, ...(await queriesNow()) } : body };
    }
    const answer = await game.call(name, args);
    const body = answer.body;
    if (answer.status !== 200 || !isObject(body)) return { status: answer.status, body };
    if (ACTIONS.includes(name)) {
      const result = shapeAction(name as 'place', body, told);
      if (body['accepted'] === true && isSceneState(body['state'])) told = body['state'];
      return { status: 200, body: result };
    }
    const refused = body['accepted'] === false;
    const counted = !refused && COUNTED.includes(name) ? await queriesNow() : {};
    switch (name) {
      case 'get_level':
        // The card itself has no `accepted`; a refusal has.
        return {
          status: 200,
          body: refused
            ? body
            : { ...(shapeLevel(body as unknown as LevelCard) as object), ...counted },
        };
      case 'get_item':
        return {
          status: 200,
          body:
            refused || !isObject(body['item'])
              ? body
              : {
                  ...body,
                  item: shapeItemRecord(body['item'] as unknown as ItemRecord),
                  ...counted,
                },
        };
      case 'check_load':
        return {
          status: 200,
          body: refused ? body : { ...(shapeLoadCheck(body) as object), ...counted },
        };
      case 'preview':
        return { status: 200, body: shapePreview(body) };
      case 'render':
        return { status: 200, body: refused ? body : { ...body, ...counted } };
      default:
        return { status: 200, body: tidyNumbers(body) };
    }
  };

  /** Turns an answer of the game into a tool result. */
  const toResult = (status: number, body: unknown): CallToolResult => {
    const { structured, images } = splitImages(body);
    const refused =
      status !== 200 ||
      (typeof structured === 'object' &&
        structured !== null &&
        (structured as { accepted?: unknown }).accepted === false);
    const isObject =
      typeof structured === 'object' && structured !== null && !Array.isArray(structured);
    return {
      content: [
        { type: 'text', text: JSON.stringify(structured) },
        ...images.map((image) => ({
          type: 'image' as const,
          data: image.data_base64,
          mimeType: image.mime_type,
        })),
      ],
      ...(isObject ? { structuredContent: structured as { [key: string]: unknown } } : {}),
      // A call the game refused did nothing: the model is told so as a tool error.
      ...(refused ? { isError: true } : {}),
    };
  };

  // The tools are registered in a loop over schemas of different shapes, which the SDK's
  // generic signature cannot follow: the handler takes the validated arguments as `unknown`.
  const register = server.registerTool.bind(server) as unknown as (
    name: string,
    config: {
      title: string;
      description: string;
      inputSchema: z.ZodType;
      outputSchema: z.ZodType;
      annotations: ToolAnnotations;
    },
    handler: (
      args: unknown,
      extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
    ) => Promise<CallToolResult>,
  ) => void;

  for (const name of TOOL_NAMES) {
    const text = TOOL_TEXT[name];
    register(
      name,
      {
        title: text.title,
        description: text.description,
        inputSchema: INPUT_SCHEMAS[name],
        outputSchema: OUTPUT_SCHEMAS[name],
        annotations: {
          readOnlyHint: !ACTIONS.includes(name),
          destructiveHint: false,
          idempotentHint: !ACTIONS.includes(name),
          openWorldHint: false,
        },
      },
      async (args, extra) => {
        try {
          if (name === 'get_report') {
            const waitS = (args as { wait_s?: number }).wait_s ?? 0;
            const deadline = performance.now() + waitS * 1000;
            const token = extra._meta?.progressToken;
            // Waiting looks at the free summary, so that a long wait is not a long log.
            while (waitS > 0 && performance.now() < deadline && !extra.signal.aborted) {
              const summary = await game.summary();
              if (
                summary.job === null ||
                (summary.job.status !== 'queued' && summary.job.status !== 'running')
              ) {
                break;
              }
              if (token !== undefined) {
                await extra.sendNotification({
                  method: 'notifications/progress',
                  params: { progressToken: token, progress: summary.job.progress, total: 1 },
                });
              }
              await pause(Math.min(pollMs, Math.max(0, deadline - performance.now())));
            }
            const answer = await shaped('get_report', {});
            return toResult(answer.status, answer.body);
          }
          const answer = await shaped(name, args);
          return toResult(answer.status, answer.body);
        } catch (error) {
          // The game server could not be reached: nothing happened.
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  accepted: false,
                  reason: 'game_unreachable',
                  detail: error instanceof Error ? error.message : String(error),
                }),
              },
            ],
            isError: true,
          };
        }
      },
    );
  }

  server.registerResource(
    'loading-guidance',
    RESOURCE_URIS.guidance,
    {
      title: "Loading a dishwasher: the manufacturer's advice",
      description:
        'Generic loading guidance of the kind printed in an appliance manual. The same text is shown to every player, human or model.',
      mimeType: 'text/plain',
    },
    async (uri) => {
      const guidance = await game.guidance();
      return {
        contents: [
          { uri: uri.href, mimeType: 'text/plain', text: `${guidance.title}\n\n${guidance.text}` },
        ],
      };
    },
  );
  server.registerResource(
    'level-manual',
    RESOURCE_URIS.manual,
    {
      title: 'The rules of this level and how the game is played',
      description:
        'Scoring, what clean means, budgets, what ends the episode, and the manual of the interface (frames, baskets, placing, looking, washing).',
      mimeType: 'text/plain',
    },
    async (uri) => ({
      contents: [
        { uri: uri.href, mimeType: 'text/plain', text: manualText(await game.levelCard()) },
      ],
    }),
  );
  server.registerResource(
    'level-card',
    RESOURCE_URIS.card,
    {
      title: 'The level card',
      description:
        'Machine, programme, items and rules of the level as JSON: the same as get_level, read free of charge.',
      mimeType: 'application/json',
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(shapeLevel(await game.levelCard())),
        },
      ],
    }),
  );
  return server;
}
