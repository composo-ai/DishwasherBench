/**
 * The context policy of the standard harness (docs/research/benchmark.md section 10.2,
 * item 8; stated in full in docs/benchmark/README.md section 2). Fixed and published, so
 * that every model is run the same way; its version is in every episode record.
 *
 * An episode of a full level is hundreds of calls. A conversation that keeps them all grows
 * past any model's context, and every request pays for all of it. So the conversation is
 * kept in three parts:
 *
 *  1. **What never leaves.** The system prompt (the rules, the manual, the guidance and the
 *     level card) and the opening message.
 *  2. **A note of the harness in place of the oldest turns** (`fold`). When the recent turns
 *     have grown past `foldAbove` estimated tokens (or past `foldAboveNote` times the note,
 *     when a large load has made the note large), the oldest are taken out, down to about
 *     `keepRecent`, and a note is put in their place, joined to the opening message: how
 *     many calls were taken out, the load as it stood after the last of them exactly as
 *     `get_state` returns it (the harness keeps its own copy from the results alone, see
 *     `LoadTracker` of `@spotless/mcp`), the slot advice asked last, and the sheet of every
 *     item if one was drawn. Only turns that an accepted action has since followed are taken
 *     out: their results describe a scene that is no more, and the scene that is, is in the
 *     note. Results of the scene as it stands (everything since the last accepted action)
 *     stay, unless the recent turns alone pass `hardLimit`: then they go too, and the record
 *     counts it. A note never says less than is true of the load: the harness's copy is
 *     whole from the first accepted action on (a client's first action answers with the
 *     whole scene unless it asked `get_state` for the whole of it before), and if it ever
 *     were not, turns with accepted actions would stay until a fold is forced, and the note
 *     of that fold would say that it has no scene to give.
 *  3. **The recent turns, word for word**, with only the most recent few pictures: when the
 *     conversation holds more than `keep + slack`, the oldest are replaced by a line of
 *     text, down to `keep`.
 *
 * Both removals happen in batches, not a little every turn: between two of them the
 * conversation only grows at its end, which is what a provider's prompt cache (and, for
 * models that sign their reasoning against the conversation, the reasoning carried from turn
 * to turn) depends on. After a fold the system prompt and the tools are still read from the
 * cache; the note and the recent turns are written to it anew.
 *
 * Sizes are estimated by one fixed rule over characters (`estimateTokens` of `measure.ts`),
 * the same for every model: the policy does not depend on a provider's tokenizer. One guard
 * does: a request the provider counted above `requestLimit` tokens forces a fold at once,
 * so that no model is sent more than its context holds whatever it carries beside the text.
 *
 * Pure in this sense: what the conversation holds depends only on what was added to it.
 */

import { LoadTracker } from '@spotless/mcp';
import { TOKEN_MODEL, estimateTokens, pictureTokens, pngSize } from './measure.ts';
import type { HistoryEntry, HistoryImage, ToolCallRequest, ToolResultEntry } from './provider.ts';

/** Version of the context policy; part of every episode record. */
export const CONTEXT_POLICY_VERSION = 'standard-2';

/** How many pictures a conversation keeps. */
export interface ImagePolicy {
  /** Pictures left after a pruning. */
  readonly keep: number;
  /** Pictures beyond `keep` that are tolerated before the next pruning. */
  readonly slack: number;
}

/**
 * The standard harness's policy: at most 8 pictures, pruned to the 4 most recent. An upper
 * bound: a fold takes a picture out with its turn, usually long before.
 */
export const STANDARD_IMAGE_POLICY: ImagePolicy = { keep: 4, slack: 4 };

/** The context policy. Sizes are estimated tokens of the conversation after the opening message. */
export interface ContextPolicy {
  readonly images: ImagePolicy;
  /** The recent turns may grow to this before the oldest are folded. */
  readonly foldAbove: number;
  /**
   * Or to this many times the size of the first message with its note, if that is more: a
   * fold writes the note anew, so a large note (a large load) is not rewritten every few calls.
   */
  readonly foldAboveNote: number;
  /** A fold keeps about this much of the most recent turns. */
  readonly keepRecent: number;
  /**
   * Past this, a fold no longer spares the turns since the last accepted action; and a single
   * turn whose results have passed it has its further calls put off to the next turn.
   */
  readonly hardLimit: number;
  /** A request the provider counted above this many input tokens forces a fold. */
  readonly requestLimit: number;
}

/** The standard harness's context policy. */
export const STANDARD_CONTEXT_POLICY: ContextPolicy = {
  images: STANDARD_IMAGE_POLICY,
  foldAbove: 12_000,
  foldAboveNote: 2,
  keepRecent: 5_000,
  hardLimit: 40_000,
  requestLimit: 120_000,
};

/** The policy as an episode record states it. */
export function contextSettings(policy: ContextPolicy): {
  readonly [key: string]: string | number;
} {
  return {
    version: CONTEXT_POLICY_VERSION,
    images_kept: policy.images.keep,
    images_slack: policy.images.slack,
    fold_above_tokens: policy.foldAbove,
    fold_above_note_factor: policy.foldAboveNote,
    keep_recent_tokens: policy.keepRecent,
    hard_limit_tokens: policy.hardLimit,
    request_limit_tokens: policy.requestLimit,
    sizes: 'estimated by a fixed rule over characters, the same for every model',
  };
}

/** Number of pictures still in a history (those of tool results; a pinned sheet is not counted). */
export function countImages(history: readonly HistoryEntry[]): number {
  let count = 0;
  for (const entry of history) {
    if (entry.role !== 'tool') continue;
    for (const result of entry.results) {
      for (const image of result.images) if (!('removed' in image)) count += 1;
    }
  }
  return count;
}

/**
 * Applies the picture policy: the history unchanged (the same array) while it holds at most
 * `keep + slack` pictures; otherwise a copy in which all but the `keep` most recent pictures
 * are replaced by notes. `removed` is the number taken out by this call.
 */
export function pruneImages(
  history: readonly HistoryEntry[],
  policy: ImagePolicy,
): { history: readonly HistoryEntry[]; removed: number } {
  const total = countImages(history);
  if (total <= policy.keep + policy.slack) return { history, removed: 0 };
  let toRemove = total - policy.keep;
  const removed = toRemove;
  const pruned = history.map((entry): HistoryEntry => {
    if (entry.role !== 'tool' || toRemove === 0) return entry;
    if (!entry.results.some((result) => result.images.some((image) => !('removed' in image)))) {
      return entry;
    }
    return {
      role: 'tool',
      results: entry.results.map((result) => ({
        ...result,
        images: result.images.map((image): HistoryImage => {
          if ('removed' in image || toRemove === 0) return image;
          toRemove -= 1;
          return {
            removed: true,
            note: `[picture returned by ${result.name} removed from the conversation to save space; call the tool again to see it]`,
          };
        }),
      })),
    };
  });
  return { history: pruned, removed };
}

/** Estimated tokens of one entry of a conversation, by the fixed rule of the policy. */
export function entryTokens(entry: HistoryEntry): number {
  if (entry.role === 'user') {
    let tokens = estimateTokens(entry.text) + TOKEN_MODEL.perItem;
    for (const image of entry.images ?? []) {
      if ('removed' in image) continue;
      const size = pngSize(image.data_base64);
      tokens += pictureTokens(size.width, size.height);
    }
    return tokens;
  }
  if (entry.role === 'assistant') {
    let tokens = entry.text === '' ? 0 : estimateTokens(entry.text) + TOKEN_MODEL.perItem;
    for (const call of entry.tool_calls) {
      tokens +=
        estimateTokens(`${call.name}${JSON.stringify(call.arguments ?? {})}`) + TOKEN_MODEL.perItem;
    }
    return tokens;
  }
  let tokens = 0;
  for (const result of entry.results) {
    tokens += estimateTokens(result.text) + TOKEN_MODEL.perItem;
    for (const image of result.images) {
      if ('removed' in image) tokens += estimateTokens(image.note);
      else {
        const size = pngSize(image.data_base64);
        tokens += pictureTokens(size.width, size.height);
      }
    }
  }
  return tokens;
}

/** One call of a turn with what the tools gave back, as the conversation takes it in. */
export interface TurnResult {
  readonly call: ToolCallRequest;
  readonly result: ToolResultEntry;
  /** The structured result of the tool, when it gave one. */
  readonly structured: { readonly [key: string]: unknown } | null;
}

/** A turn of the model with everything that answers it: taken out of a conversation whole. */
interface Group {
  entries: HistoryEntry[];
  readonly results: readonly TurnResult[];
  /** True when one of its calls was an accepted action: it changed the scene. */
  readonly acted: boolean;
}

/** One fold of a conversation, for the transcript. */
export interface FoldRecord {
  /** Calls of the episode made when the fold happened. */
  readonly at_call: number;
  /** Calls taken out by this fold, and in all so far. */
  readonly calls_folded: number;
  readonly calls_folded_total: number;
  /** Estimated tokens of the conversation before and after. */
  readonly tokens_before: number;
  readonly tokens_after: number;
  /** True when turns since the last accepted action were taken out as well. */
  readonly forced: boolean;
  /** Why: `size`, `hard_limit` or `request_limit`. */
  readonly reason: string;
}

const ACTIONS = new Set(['place', 'remove', 'reset', 'set_rack', 'start_cycle']);

/** The conversation of one episode under the context policy. */
export class Conversation {
  private readonly opening: string;
  private readonly policy: ContextPolicy;
  /** The sheet of every item, once a folded turn carried one. */
  private sheet: HistoryImage | null = null;
  private first: HistoryEntry;
  private groups: Group[] = [];
  /** The load after the last folded call, and after the last call. */
  private base = new LoadTracker();
  private now = new LoadTracker();
  private callsMade = 0;
  private callsFolded = 0;
  /** Accepted actions among the folded calls. */
  private actionsFolded = 0;
  private readonly foldedByTool = new Map<string, number>();
  /** The slot advice asked last among the folded calls. */
  private lastSlots: { call: number; args: string; text: string } | null = null;
  /** Every fold so far. */
  readonly folds: FoldRecord[] = [];
  /** Times pictures were pruned. */
  prunings = 0;
  /** Every entry ever added, in order: the whole conversation, for the transcript. */
  readonly everything: HistoryEntry[] = [];

  constructor(opening: string, policy: ContextPolicy = STANDARD_CONTEXT_POLICY) {
    this.opening = opening;
    this.policy = policy;
    this.first = { role: 'user', text: opening };
    this.everything.push(this.first);
  }

  /** The conversation as the next request carries it. */
  get history(): readonly HistoryEntry[] {
    return [this.first, ...this.groups.flatMap((group) => group.entries)];
  }

  /** The harness's own copy of the load as it is now. */
  get load(): LoadTracker {
    return this.now;
  }

  /** Estimated tokens of the conversation (without the system prompt and the tools). */
  get tokens(): number {
    return entryTokens(this.first) + this.recentTokens();
  }

  private recentTokens(): number {
    let tokens = 0;
    for (const group of this.groups)
      for (const entry of group.entries) tokens += entryTokens(entry);
    return tokens;
  }

  /** A message of the harness to the model (a reminder, a note about a cut-off turn). */
  addUser(text: string): void {
    const entry: HistoryEntry = { role: 'user', text };
    this.everything.push(entry);
    const last = this.groups[this.groups.length - 1];
    if (last === undefined) this.groups.push({ entries: [entry], results: [], acted: false });
    else last.entries.push(entry);
  }

  /**
   * A turn of the model and the results of its calls (none for a turn without calls). The
   * harness's copy of the load takes the results in, and then the policy is applied;
   * `requestTokens` is the provider's count of the input of the request the turn answered.
   */
  addTurn(
    assistant: HistoryEntry & { role: 'assistant' },
    results: readonly TurnResult[],
    requestTokens?: number,
  ): void {
    const entries: HistoryEntry[] = [assistant];
    this.everything.push(assistant);
    if (results.length > 0) {
      const tool: HistoryEntry = { role: 'tool', results: results.map((entry) => entry.result) };
      entries.push(tool);
      this.everything.push(tool);
    }
    let acted = false;
    for (const entry of results) {
      this.callsMade += 1;
      this.now.apply(entry.call.name, entry.structured);
      if (ACTIONS.has(entry.call.name) && entry.structured?.['accepted'] === true) acted = true;
    }
    this.groups.push({ entries, results, acted });
    this.maintain(requestTokens);
  }

  /**
   * Applies the policy: folds the oldest turns when the recent ones have grown too large (or
   * when `requestTokens`, the provider's count of the last request, is above the limit), then
   * prunes pictures.
   */
  maintain(requestTokens?: number): void {
    const over = requestTokens !== undefined && requestTokens > this.policy.requestLimit;
    const recent = this.recentTokens();
    const room = Math.max(
      this.policy.foldAbove,
      this.policy.foldAboveNote * entryTokens(this.first),
    );
    if (over || recent > room) {
      this.fold(over ? 'request_limit' : recent > this.policy.hardLimit ? 'hard_limit' : 'size');
    }
    const pruned = pruneImages(
      this.groups.flatMap((group) => group.entries),
      this.policy.images,
    );
    if (pruned.removed > 0) {
      this.prunings += 1;
      // The pruned entries take the places of the ones they were made from.
      let i = 0;
      for (const group of this.groups) {
        group.entries = group.entries.map(() => pruned.history[i++] as HistoryEntry);
      }
    }
  }

  private fold(reason: string): void {
    const before = this.tokens;
    // The most recent turns that fit in `keepRecent` stay; the last one always does. When the
    // provider's own count forced the fold, at most half of the recent turns stay, so that a
    // conversation whose text is small and whose carried reasoning is not still shrinks.
    const room =
      reason === 'request_limit'
        ? Math.min(this.policy.keepRecent, this.recentTokens() / 2)
        : this.policy.keepRecent;
    let kept = 0;
    let cut = this.groups.length;
    while (cut > 0) {
      const group = this.groups[cut - 1] as Group;
      const size = group.entries.reduce((sum, entry) => sum + entryTokens(entry), 0);
      if (cut < this.groups.length && kept + size > room) break;
      kept += size;
      cut -= 1;
    }
    // What came since the last accepted action describes the scene as it stands: it stays,
    // that action with it, unless the recent turns alone are past the hard limit.
    let lastAction = -1;
    this.groups.forEach((group, index) => {
      if (group.acted) lastAction = index;
    });
    const spare = lastAction < 0 ? 0 : lastAction;
    let forced = false;
    if (cut > spare) {
      if (reason === 'size') cut = spare;
      else forced = true;
    }
    // The note has to be able to say what the folded actions did. While the harness's copy
    // has never been given the whole scene (the MCP server gives it with the first action of
    // a client that has not asked for the whole of it, so this is a server that does not),
    // turns from the first accepted action on are not taken out for size alone.
    if (reason === 'size' && !this.base.complete) {
      const trial = this.base.clone();
      for (let i = 0; i < cut; i++) {
        const group = this.groups[i] as Group;
        for (const entry of group.results) trial.apply(entry.call.name, entry.structured);
        if (group.acted && !trial.complete) {
          cut = i;
          break;
        }
      }
    }
    if (cut <= 0) return;

    const folded = this.groups.slice(0, cut);
    this.groups = this.groups.slice(cut);
    let calls = 0;
    for (const group of folded) {
      for (const entry of group.results) {
        calls += 1;
        const name = entry.call.name;
        this.base.apply(name, entry.structured);
        this.foldedByTool.set(name, (this.foldedByTool.get(name) ?? 0) + 1);
        if (ACTIONS.has(name) && entry.structured?.['accepted'] === true) this.actionsFolded += 1;
        const number = this.callsFolded + calls;
        if (name === 'list_slots' && !entry.result.is_error) {
          this.lastSlots = {
            call: number,
            args: JSON.stringify(entry.call.arguments ?? {}),
            text: entry.result.text,
          };
        }
        if (
          name === 'render' &&
          (entry.call.arguments as { view?: unknown } | null)?.view === 'items'
        ) {
          const picture = entry.result.images.find((image) => !('removed' in image));
          if (picture !== undefined) this.sheet = picture;
        }
      }
    }
    this.callsFolded += calls;
    // Slot advice still among the recent turns is the advice asked last: none is repeated.
    const slotsRecent = this.groups.some((group) =>
      group.results.some((entry) => entry.call.name === 'list_slots' && !entry.result.is_error),
    );
    this.first = {
      role: 'user',
      text: `${this.opening}\n\n${this.noteText(slotsRecent)}`,
      ...(this.sheet === null ? {} : { images: [this.sheet] }),
    };
    this.folds.push({
      at_call: this.callsMade,
      calls_folded: calls,
      calls_folded_total: this.callsFolded,
      tokens_before: Math.round(before),
      tokens_after: Math.round(this.tokens),
      forced,
      reason,
    });
  }

  private noteText(slotsRecent: boolean): string {
    const n = this.callsFolded;
    const byTool = [...this.foldedByTool.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => `${name} ${count}`)
      .join(', ');
    const parts = [
      `[Note of the harness, not of a player. To keep this conversation within a model's context, its oldest part has been taken out: the first ${n} tool call${n === 1 ? '' : 's'} of the episode (${byTool}) with ${n === 1 ? 'its result' : 'their results'}. What they did to the load is not lost: the scene as it stood after call ${n} is given below, exactly as get_state returns it, and every call made since follows with its result. The level card, the rules, the manual and the guidance are in the system prompt as before. Gone with the old results is what held for the scene of its moment: how each of those placements fell and came to rest, refusals, previews, checks, slot advice and pictures of a load that has changed since. To look again, ask again.]`,
    ];
    if (this.base.complete) {
      parts.push(`The scene after call ${n}:\n${JSON.stringify(this.base.state())}`);
    } else if (this.actionsFolded === 0) {
      // Nothing that changes the scene is among what was taken out.
      parts.push(
        `No scene is given here: up to call ${n} no action had been accepted, and no result gave the whole scene (get_state without rack or items had not been asked).`,
      );
    } else {
      // A fold that was forced before any result gave the whole scene. Never with the MCP
      // server of this repository, whose first action answers with the scene.
      const k = this.actionsFolded;
      parts.push(
        `No scene can be given here: ${k} accepted action${k === 1 ? ' was' : 's were'} among the calls taken out, and no result up to call ${n} gave the whole scene, so the harness cannot say what the load is. Call get_state for the load as it is.`,
      );
    }
    if (this.lastSlots !== null && !slotsRecent) {
      parts.push(
        `The slot advice asked last (call ${this.lastSlots.call}, list_slots ${this.lastSlots.args}), as it was then:\n${this.lastSlots.text}`,
      );
    }
    if (this.sheet !== null) {
      parts.push(
        'The sheet of every item of the level (render, view items) drawn earlier is attached to this message.',
      );
    }
    return parts.join('\n\n');
  }
}
