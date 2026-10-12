/**
 * Measuring what an episode costs in tokens, without a model: a sequence of calls is played
 * through the real MCP tools by the standard loop of the harness (`llmPolicy` with a scripted
 * provider: the same system prompt, the same tools with their descriptions and schemas, the
 * same context policy), and every request the loop would have sent to a model's API is sized.
 *
 * Three things are reported:
 *
 *  - per call, the size of its result in characters and tokens, with its pictures;
 *  - per request, its size in tokens as the loop sends it (system prompt, tools, conversation,
 *    pictures), and how much of it the provider's prompt cache has already seen (what it has
 *    in common, from the start, with the request before);
 *  - for the episode, the totals: requests, input tokens, the largest request, the
 *    conversation at its largest.
 *
 * Tokens are estimated, because counting them exactly needs the model's API. The estimate is
 * fitted to what the endpoint of the first real episodes counted (`TOKEN_MODEL`): prose runs
 * at about 4.7 characters a token there, the JSON of a tool result at about 3, because digits
 * and punctuation cost far more than letters. `fitTokenModel` makes the fit again from the
 * transcript of any episode, and `checkTokenModel` says how far the estimate is from what an
 * episode was billed.
 */

import type { JsonValue } from '@spotless/core';
import type { Level } from '@spotless/levels';
import type { HistoryEntry, ToolSpec, TurnRequest } from './provider.ts';
import type { ScriptedTurn } from './scripted-provider.ts';

/** What a token costs in characters, by kind of character, and the fixed costs beside. */
export interface TokenModel {
  /** Tokens per letter (a to z, A to Z). */
  readonly perLetter: number;
  /** Tokens per digit. */
  readonly perDigit: number;
  /** Tokens per other character (punctuation, spaces, line breaks). */
  readonly perOther: number;
  /** Tokens of framing per item of the conversation (a message, a call, a result). */
  readonly perItem: number;
  /** Tokens of a picture of 768 by 768 pixels; other sizes in proportion to their area. */
  readonly perPicture768: number;
}

/**
 * The fit to the three first real episodes (gpt-6.1-sol on the tutorial, 11 October 2026:
 * `docs/benchmark/first-runs/sol-tutorial-1` and `-2` with the results as they were, and
 * `sol-tutorial-3` with the results as they are): least squares over what each of the 77
 * turns after a first added to its request (the calls, their results, their pictures) and
 * over the first request of the third episode (the system prompt and the tools: 55,600
 * characters, 12,784 tokens), against the tokens the endpoint counted. Mean error 19 tokens
 * a turn; the sum over all turns within 0.1 per cent, the first request within 0.5 per cent.
 * A digit costs more than a token because a number in JSON drags its separators with it.
 */
export const TOKEN_MODEL: TokenModel = {
  perLetter: 0.1647,
  perDigit: 1.2025,
  perOther: 0.3443,
  perItem: 10.28,
  perPicture768: 703.4,
};

/** Letters, digits and other characters of a text. */
export function characterClasses(text: string): { letters: number; digits: number; other: number } {
  let letters = 0;
  let digits = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 48 && code <= 57) digits += 1;
    else if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) letters += 1;
  }
  return { letters, digits, other: text.length - letters - digits };
}

/** Estimated tokens of a text (without the framing of the item it stands in). */
export function estimateTokens(text: string, model: TokenModel = TOKEN_MODEL): number {
  const { letters, digits, other } = characterClasses(text);
  return letters * model.perLetter + digits * model.perDigit + other * model.perOther;
}

/** Estimated tokens of a picture of the given size. */
export function pictureTokens(
  widthPx: number,
  heightPx: number,
  model: TokenModel = TOKEN_MODEL,
): number {
  return (model.perPicture768 * widthPx * heightPx) / (768 * 768);
}

/** Width and height of a PNG given as base64 (from its header); 768 square when unreadable. */
export function pngSize(base64: string): { width: number; height: number } {
  try {
    const head = Buffer.from(base64.slice(0, 64), 'base64');
    if (head.length >= 24 && head.readUInt32BE(12) === 0x49484452) {
      return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
    }
  } catch {
    // Not a PNG: the default below.
  }
  return { width: 768, height: 768 };
}

/** The size of one item of a request. */
interface ItemSize {
  /** A text that is equal exactly when the item is: for finding the common prefix of requests. */
  readonly key: string;
  readonly characters: number;
  readonly tokens: number;
  readonly pictures: number;
}

/** The tools as the request lists them. */
export function toolsText(tools: readonly ToolSpec[]): string {
  return JSON.stringify(
    tools.map((tool) => ({
      type: 'function',
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
      strict: false,
    })),
  );
}

/**
 * The items of a conversation as the loop sends them (one per message, per call and per
 * result), each with its size. An assistant's turn is taken as its words and its calls; what
 * a model carries beside (reasoning) is not known to a rehearsal and not counted.
 */
function itemsOf(entry: HistoryEntry, model: TokenModel): ItemSize[] {
  if (entry.role === 'user') {
    let tokens = estimateTokens(entry.text, model) + model.perItem;
    let pictures = 0;
    let key = `u:${entry.text}`;
    for (const image of entry.images ?? []) {
      if ('removed' in image) continue;
      const size = pngSize(image.data_base64);
      tokens += pictureTokens(size.width, size.height, model);
      pictures += 1;
      key += `|picture ${size.width}x${size.height} ${image.data_base64.length}`;
    }
    return [{ key, characters: entry.text.length, tokens, pictures }];
  }
  if (entry.role === 'assistant') {
    const out: ItemSize[] = [];
    if (entry.text !== '') {
      out.push({
        key: `a:${entry.text}`,
        characters: entry.text.length,
        tokens: estimateTokens(entry.text, model) + model.perItem,
        pictures: 0,
      });
    }
    for (const call of entry.tool_calls) {
      const text = `${call.name}${JSON.stringify(call.arguments ?? {})}`;
      out.push({
        key: `c:${call.id}:${text}`,
        characters: text.length,
        tokens: estimateTokens(text, model) + model.perItem,
        pictures: 0,
      });
    }
    return out;
  }
  return entry.results.map((result) => {
    let characters = result.text.length;
    let tokens = estimateTokens(result.text, model) + model.perItem;
    let pictures = 0;
    let key = `r:${result.call_id}:${result.text}`;
    for (const image of result.images) {
      if ('removed' in image) {
        characters += image.note.length;
        tokens += estimateTokens(image.note, model);
        key += `|${image.note}`;
      } else {
        const size = pngSize(image.data_base64);
        tokens += pictureTokens(size.width, size.height, model);
        pictures += 1;
        key += `|picture ${size.width}x${size.height} ${image.data_base64.length}`;
      }
    }
    return { key, characters, tokens, pictures };
  });
}

/** One call of the measured sequence and what it gave back. */
export interface MeasuredCall {
  /** Position among the calls of the episode, from 0. */
  readonly index: number;
  readonly tool: string;
  /** The request in which the model would have made the call, from 1. */
  readonly turn: number;
  readonly is_error: boolean;
  /** Characters of the call itself (name and arguments). */
  readonly call_characters: number;
  /** Characters and estimated tokens of the result's text, and its pictures. */
  readonly result_characters: number;
  readonly result_tokens: number;
  readonly pictures: number;
  readonly picture_tokens: number;
}

/** One request of the measured episode. */
export interface MeasuredRequest {
  /** From 1. */
  readonly turn: number;
  /** Estimated tokens of the whole request. */
  readonly tokens: number;
  /** Of them: the system prompt and the tools; the conversation; pictures in the conversation. */
  readonly fixed_tokens: number;
  readonly conversation_tokens: number;
  readonly picture_tokens: number;
  /** Characters of the conversation's text. */
  readonly conversation_characters: number;
  /** Pictures in the request. */
  readonly pictures: number;
  /** Tokens the request has in common, from its start, with the one before: read from the cache. */
  readonly cached_tokens: number;
  /** Entries of the conversation. */
  readonly entries: number;
}

/** Sizes of the results of one tool over an episode. */
export interface ToolSizes {
  readonly tool: string;
  readonly calls: number;
  readonly refused: number;
  readonly characters_median: number;
  readonly characters_max: number;
  readonly characters_total: number;
  readonly tokens_median: number;
  readonly tokens_max: number;
  readonly tokens_total: number;
  readonly pictures: number;
}

/** A measured episode. */
export interface Measurement {
  readonly requests: number;
  readonly calls: number;
  /** Tokens of the system prompt and of the tools, sent with every request. */
  readonly system_tokens: number;
  readonly tools_tokens: number;
  readonly system_characters: number;
  readonly tools_characters: number;
  /** Sum over the requests: what the episode is billed as input. */
  readonly input_tokens: number;
  /** Of them read from the provider's cache, and newly written. */
  readonly cached_tokens: number;
  readonly written_tokens: number;
  readonly largest_request_tokens: number;
  readonly largest_request_turn: number;
  /** The conversation (everything but the system prompt and the tools) at its largest. */
  readonly largest_conversation_tokens: number;
  readonly largest_conversation_characters: number;
  /** Characters of every result of the episode, and estimated tokens. */
  readonly result_characters: number;
  readonly result_tokens: number;
  readonly pictures: number;
  readonly by_tool: readonly ToolSizes[];
  readonly per_call: readonly MeasuredCall[];
  readonly per_request: readonly MeasuredRequest[];
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

/**
 * Sizes the requests of an episode, in the order they were sent. Each request is taken as the
 * loop sends it: the system prompt, the tools, and the conversation as it stood then (after
 * the context policy). The results of the calls are read from the request that first carried
 * them, where they are whole.
 */
export function measureRequests(
  requests: readonly TurnRequest[],
  model: TokenModel = TOKEN_MODEL,
): Measurement {
  const sizes = new WeakMap<HistoryEntry, ItemSize[]>();
  const sized = (entry: HistoryEntry): ItemSize[] => {
    let known = sizes.get(entry);
    if (known === undefined) {
      known = itemsOf(entry, model);
      sizes.set(entry, known);
    }
    return known;
  };
  const first = requests[0];
  const system = first?.system ?? '';
  const tools = toolsText(first?.tools ?? []);
  const systemTokens = estimateTokens(system, model);
  const toolsTokens = estimateTokens(tools, model);
  const fixed = systemTokens + toolsTokens;

  const perRequest: MeasuredRequest[] = [];
  const perCall: MeasuredCall[] = [];
  let previous: ItemSize[] = [];
  let inputTokens = 0;
  let cachedTokens = 0;
  let pictures = 0;
  requests.forEach((request, index) => {
    const items = request.history.flatMap(sized);
    let conversation = 0;
    let characters = 0;
    let pictureCount = 0;
    let pictureTok = 0;
    for (const item of items) {
      conversation += item.tokens;
      characters += item.characters;
      pictureCount += item.pictures;
    }
    for (const entry of request.history) {
      const images =
        entry.role === 'tool'
          ? entry.results.flatMap((result) => result.images)
          : entry.role === 'user'
            ? (entry.images ?? [])
            : [];
      for (const image of images) {
        if ('removed' in image) continue;
        const size = pngSize(image.data_base64);
        pictureTok += pictureTokens(size.width, size.height, model);
      }
    }
    // What this request has in common with the one before, from the start: the system prompt
    // and the tools always, then the items of the conversation while they are the same.
    let shared = index === 0 ? 0 : fixed;
    if (index > 0) {
      const n = Math.min(previous.length, items.length);
      for (let i = 0; i < n; i++) {
        if ((previous[i] as ItemSize).key !== (items[i] as ItemSize).key) break;
        shared += (items[i] as ItemSize).tokens;
      }
    }
    const tokens = fixed + conversation;
    inputTokens += tokens;
    cachedTokens += shared;
    perRequest.push({
      turn: index + 1,
      tokens: Math.round(tokens),
      fixed_tokens: Math.round(fixed),
      conversation_tokens: Math.round(conversation),
      picture_tokens: Math.round(pictureTok),
      conversation_characters: characters,
      pictures: pictureCount,
      cached_tokens: Math.round(shared),
      entries: request.history.length,
    });
    previous = items;

    // The results this request carries for the first time: those of the calls of the turn before.
    const tail = request.history[request.history.length - 1];
    const before = request.history[request.history.length - 2];
    if (tail?.role === 'tool' && before?.role === 'assistant') {
      tail.results.forEach((result, i) => {
        const call = before.tool_calls[i];
        let pictureTokensOfCall = 0;
        let n = 0;
        for (const image of result.images) {
          if ('removed' in image) continue;
          const size = pngSize(image.data_base64);
          pictureTokensOfCall += pictureTokens(size.width, size.height, model);
          n += 1;
        }
        pictures += n;
        perCall.push({
          index: perCall.length,
          tool: result.name,
          turn: index,
          is_error: result.is_error,
          call_characters:
            call === undefined ? 0 : call.name.length + JSON.stringify(call.arguments ?? {}).length,
          result_characters: result.text.length,
          result_tokens: Math.round(estimateTokens(result.text, model)),
          pictures: n,
          picture_tokens: Math.round(pictureTokensOfCall),
        });
      });
    }
  });

  const byTool = new Map<string, MeasuredCall[]>();
  for (const call of perCall) {
    const list = byTool.get(call.tool) ?? [];
    list.push(call);
    byTool.set(call.tool, list);
  }
  const toolSizes: ToolSizes[] = [...byTool.entries()]
    .map(([tool, calls]) => ({
      tool,
      calls: calls.length,
      refused: calls.filter((call) => call.is_error).length,
      characters_median: Math.round(median(calls.map((call) => call.result_characters))),
      characters_max: Math.max(...calls.map((call) => call.result_characters)),
      characters_total: calls.reduce((sum, call) => sum + call.result_characters, 0),
      tokens_median: Math.round(median(calls.map((call) => call.result_tokens))),
      tokens_max: Math.max(...calls.map((call) => call.result_tokens)),
      tokens_total: calls.reduce((sum, call) => sum + call.result_tokens, 0),
      pictures: calls.reduce((sum, call) => sum + call.pictures, 0),
    }))
    .sort((a, b) => b.tokens_total - a.tokens_total);

  let largest = perRequest[0];
  let largestConversation = perRequest[0];
  for (const request of perRequest) {
    if (largest === undefined || request.tokens > largest.tokens) largest = request;
    if (
      largestConversation === undefined ||
      request.conversation_tokens > largestConversation.conversation_tokens
    ) {
      largestConversation = request;
    }
  }
  return {
    requests: requests.length,
    calls: perCall.length,
    system_tokens: Math.round(systemTokens),
    tools_tokens: Math.round(toolsTokens),
    system_characters: system.length,
    tools_characters: tools.length,
    input_tokens: Math.round(inputTokens),
    cached_tokens: Math.round(cachedTokens),
    written_tokens: Math.round(inputTokens - cachedTokens),
    largest_request_tokens: largest?.tokens ?? 0,
    largest_request_turn: largest?.turn ?? 0,
    largest_conversation_tokens: largestConversation?.conversation_tokens ?? 0,
    largest_conversation_characters: largestConversation?.conversation_characters ?? 0,
    result_characters: perCall.reduce((sum, call) => sum + call.result_characters, 0),
    result_tokens: perCall.reduce((sum, call) => sum + call.result_tokens, 0),
    pictures,
    by_tool: toolSizes,
    per_call: perCall,
    per_request: perRequest,
  };
}

// ---------------------------------------------------------------------------------------------
// The sequence of calls of a saved load
// ---------------------------------------------------------------------------------------------

/** A saved load, as far as the measurement reads it (`@spotless/loader`, `StandardLoad`). */
export interface LoadLike {
  readonly name?: string;
  readonly level: Level;
  readonly action_log: readonly JsonValue[];
}

/** Which calls of the load's log are played. */
export interface SequenceOptions {
  /**
   * The policy's `preview` calls: `none` leaves them out (the loader tests thousands of poses
   * in a search no model makes one turn at a time), `all` plays every one. Default `none`.
   */
  readonly previews?: 'none' | 'all';
  /** A look after every this many accepted placements; 0 for none. Default 10. */
  readonly lookEvery?: number;
}

/** What a sequence is made of. */
export interface Sequence {
  readonly turns: readonly ScriptedTurn[];
  /** Calls by tool. */
  readonly counts: { readonly [tool: string]: number };
  /** Calls taken from the log, and looks added. */
  readonly from_log: number;
  readonly looks: number;
  /** Calls of the log left out (previews). */
  readonly left_out: number;
}

const PLAYED = new Set([
  'place',
  'remove',
  'reset',
  'set_rack',
  'start_cycle',
  'get_level',
  'get_item',
  'get_state',
  'preview',
  'list_slots',
  'check_load',
]);

/**
 * The calls of a saved load as a script for the standard loop, one call a turn: every call
 * the policy made, in order, accepted or refused (its previews as the options say), and a
 * look after every tenth accepted placement: by turns a labelled plan view of the basket
 * just loaded, with its grid, and the scene state. The sequence ends with the policy's own
 * `start_cycle`.
 */
export function sequenceOfLoad(load: LoadLike, options: SequenceOptions = {}): Sequence {
  const previews = options.previews ?? 'none';
  const lookEvery = options.lookEvery ?? 10;
  const turns: ScriptedTurn[] = [];
  const counts: { [tool: string]: number } = {};
  const add = (name: string, args: unknown): void => {
    turns.push({ calls: [{ name, arguments: args }] });
    counts[name] = (counts[name] ?? 0) + 1;
  };
  let fromLog = 0;
  let looks = 0;
  let leftOut = 0;
  let placed = 0;
  for (const raw of load.action_log) {
    const event = raw as {
      name?: string;
      accepted?: boolean;
      args?: { [key: string]: unknown };
    };
    if (event.name === undefined || !PLAYED.has(event.name)) continue;
    if (event.name === 'preview' && previews === 'none') {
      leftOut += 1;
      continue;
    }
    add(event.name, event.args ?? {});
    fromLog += 1;
    // The loop ends at the accepted start of the cycle; what the policy asked afterwards is not played.
    if (event.name === 'start_cycle' && event.accepted === true) break;
    if (event.name === 'place' && event.accepted === true) {
      placed += 1;
      if (lookEvery > 0 && placed % lookEvery === 0) {
        looks += 1;
        if (looks % 2 === 1) {
          const frame = String(event.args?.['frame'] ?? 'lower_rack');
          const view =
            frame === 'upper_rack'
              ? 'top_upper'
              : frame === 'cutlery_basket'
                ? 'top_cutlery'
                : 'top_lower';
          add('render', { view, options: { labels: true, grid: true } });
        } else {
          add('get_state', {});
        }
      }
    }
  }
  return { turns, counts, from_log: fromLog, looks, left_out: leftOut };
}

// ---------------------------------------------------------------------------------------------
// Calibration against a real episode
// ---------------------------------------------------------------------------------------------

/** The transcript of an episode, as far as the calibration reads it (`transcript.json`). */
export interface TranscriptLike {
  /**
   * Letters, digits and other characters of the system prompt and the tools as the first
   * request carried them, when the transcript says (transcripts since 2026-10-11 do).
   */
  readonly fixed_characters?: {
    readonly letters: number;
    readonly digits: number;
    readonly other: number;
  };
  readonly history: readonly {
    readonly role: string;
    readonly text?: string;
    readonly tool_calls?: readonly { readonly name: string; readonly arguments: unknown }[];
    readonly results?: readonly {
      readonly name: string;
      readonly text: string;
      readonly images: readonly string[];
    }[];
  }[];
  readonly turns: readonly {
    readonly usage: {
      readonly input_tokens: number;
      readonly cache_read_input_tokens: number;
      readonly cache_creation_input_tokens: number;
    };
    /** Folds of the conversation before the request of this turn, when the transcript says. */
    readonly folds_so_far?: number;
  }[];
}

/** What one turn of a real episode added to the request, and the tokens counted for it. */
export interface CalibrationRow {
  readonly letters: number;
  readonly digits: number;
  readonly other: number;
  readonly items: number;
  /** Pictures, counted in pictures of 768 pixels square (a smaller one is a fraction). */
  readonly pictures: number;
  /** Tokens the request grew by, as the endpoint counted. */
  readonly tokens: number;
}

/**
 * The rows of a transcript for the fit: for every turn after the first, what the request
 * gained over the one before (the calls of the turn before and their results) and by how
 * many tokens the endpoint's count of the input grew; and, when the transcript says what the
 * system prompt and the tools were made of, a row for the first request. A turn whose request
 * followed a fold of the conversation is left out (the transcript says which; one where the
 * count fell is left out in any case); `history` must be the whole conversation, as the
 * transcript keeps it.
 */
export function calibrationRows(transcript: TranscriptLike): CalibrationRow[] {
  const assistants: number[] = [];
  transcript.history.forEach((entry, i) => {
    if (entry.role === 'assistant') assistants.push(i);
  });
  const rows: CalibrationRow[] = [];
  let before = 0;
  transcript.turns.forEach((turn, k) => {
    const total =
      turn.usage.input_tokens +
      turn.usage.cache_read_input_tokens +
      turn.usage.cache_creation_input_tokens;
    const grew = total - before;
    before = total;
    if (k === 0) {
      // The first request: the system prompt, the tools and the opening message.
      const fixed = transcript.fixed_characters;
      const opening = transcript.history[0];
      if (fixed !== undefined && opening !== undefined) {
        const text = characterClasses(opening.text ?? '');
        rows.push({
          letters: fixed.letters + text.letters,
          digits: fixed.digits + text.digits,
          other: fixed.other + text.other,
          items: 1,
          pictures: 0,
          tokens: total,
        });
      }
      return;
    }
    // A request that follows a fold is not the one before with more at its end.
    const folded =
      turn.folds_so_far !== undefined &&
      turn.folds_so_far !== (transcript.turns[k - 1]?.folds_so_far ?? turn.folds_so_far);
    if (grew <= 0 || folded) return;
    const from = assistants[k - 1];
    const to = assistants[k];
    if (from === undefined || to === undefined) return;
    let text = '';
    let items = 0;
    let pictures = 0;
    for (let i = from; i < to; i++) {
      const entry = transcript.history[i];
      if (entry === undefined) continue;
      if (entry.role === 'assistant') {
        if ((entry.text ?? '') !== '') {
          text += entry.text ?? '';
          items += 1;
        }
        for (const call of entry.tool_calls ?? []) {
          text += `${call.name}${JSON.stringify(call.arguments ?? {})}`;
          items += 1;
        }
      } else if (entry.role === 'tool') {
        for (const result of entry.results ?? []) {
          text += result.text;
          items += 1;
          for (const image of result.images) {
            if (!image.startsWith('[png')) continue;
            // In pictures of 768 pixels square: a transcript that states the size says so
            // (`[png, 256x256, 9120 bytes]`); one that does not held pictures of that size.
            const size = /^\[png, (\d+)x(\d+),/.exec(image);
            pictures += size === null ? 1 : (Number(size[1]) * Number(size[2])) / (768 * 768);
          }
        }
      } else {
        text += entry.text ?? '';
        items += 1;
      }
    }
    rows.push({ ...characterClasses(text), items, pictures, tokens: grew });
  });
  return rows;
}

/** Solves the normal equations of a least-squares fit (Gauss-Jordan with pivoting). */
function leastSquares(rows: readonly (readonly number[])[], target: readonly number[]): number[] {
  const n = rows[0]?.length ?? 0;
  const m: number[][] = Array.from({ length: n }, () => new Array<number>(n + 1).fill(0));
  rows.forEach((row, r) => {
    for (let i = 0; i < n; i++) {
      const mi = m[i] as number[];
      for (let j = 0; j < n; j++)
        mi[j] = (mi[j] as number) + (row[i] as number) * (row[j] as number);
      mi[n] = (mi[n] as number) + (row[i] as number) * (target[r] as number);
    }
  });
  for (let i = 0; i < n; i++) {
    let pivot = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs((m[k] as number[])[i] as number) > Math.abs((m[pivot] as number[])[i] as number))
        pivot = k;
    }
    [m[i], m[pivot]] = [m[pivot] as number[], m[i] as number[]];
    const mi = m[i] as number[];
    if (Math.abs(mi[i] as number) < 1e-12) continue;
    for (let k = 0; k < n; k++) {
      if (k === i) continue;
      const mk = m[k] as number[];
      const f = (mk[i] as number) / (mi[i] as number);
      for (let j = i; j <= n; j++) mk[j] = (mk[j] as number) - f * (mi[j] as number);
    }
  }
  return m.map((row, i) =>
    Math.abs(row[i] as number) < 1e-12 ? 0 : (row[n] as number) / (row[i] as number),
  );
}

/** The token model that fits a set of calibration rows best (least squares). */
export function fitTokenModel(rows: readonly CalibrationRow[]): TokenModel {
  const [perLetter, perDigit, perOther, perItem, perPicture] = leastSquares(
    rows.map((row) => [row.letters, row.digits, row.other, row.items, row.pictures]),
    rows.map((row) => row.tokens),
  );
  return {
    perLetter: perLetter ?? 0,
    perDigit: perDigit ?? 0,
    perOther: perOther ?? 0,
    perItem: perItem ?? 0,
    perPicture768: perPicture ?? 0,
  };
}

/** How far a token model is from the rows of a real episode. */
export function checkTokenModel(
  rows: readonly CalibrationRow[],
  model: TokenModel = TOKEN_MODEL,
): {
  readonly rows: number;
  readonly measured_tokens: number;
  readonly estimated_tokens: number;
  /** Estimated over measured, of the sums. */
  readonly ratio: number;
  readonly mean_abs_error: number;
  readonly max_abs_error: number;
} {
  let measured = 0;
  let estimated = 0;
  let absolute = 0;
  let worst = 0;
  for (const row of rows) {
    const estimate =
      row.letters * model.perLetter +
      row.digits * model.perDigit +
      row.other * model.perOther +
      row.items * model.perItem +
      row.pictures * model.perPicture768;
    measured += row.tokens;
    estimated += estimate;
    absolute += Math.abs(estimate - row.tokens);
    worst = Math.max(worst, Math.abs(estimate - row.tokens));
  }
  return {
    rows: rows.length,
    measured_tokens: measured,
    estimated_tokens: Math.round(estimated),
    ratio: measured === 0 ? 0 : estimated / measured,
    mean_abs_error: rows.length === 0 ? 0 : absolute / rows.length,
    max_abs_error: worst,
  };
}
