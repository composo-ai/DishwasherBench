/**
 * The model policy of the standard harness (docs/research/benchmark.md section 10.2, item 8;
 * docs/benchmark/README.md section 2): one system prompt with the rules, the manual, the
 * guidance and the level card; native tool calling against exactly the tools the MCP server
 * lists, and no others; the conversation kept under the context policy of `context.ts` (the
 * oldest turns folded into a note with the load as it stood, the most recent few pictures).
 * The loop is the same for every model; what differs is the provider behind it.
 *
 * The loop ends when the model has started the cycle, or stops without doing so (after being
 * reminded), or reaches the turn limit, or the provider says the model declined or was cut
 * off, or the run's own limit on input tokens is reached. Whatever is loaded then is washed,
 * by the harness if need be: hitting a limit ends the episode with the load as it stands. A
 * failure of the provider's API is not a move of the player: the episode then has no result.
 */

import type { JsonValue } from '@spotless/core';
import { RESOURCE_URIS } from '@spotless/mcp';
import type { ContextPolicy, ImagePolicy, TurnResult } from './context.ts';
import { Conversation, STANDARD_CONTEXT_POLICY, contextSettings, entryTokens } from './context.ts';
import { characterClasses, pngSize, toolsText } from './measure.ts';
import type { Policy, PolicyContext, PolicyOutcome } from './policy.ts';
import {
  CONTINUE_MESSAGE,
  OPENING_MESSAGE,
  PROMPT_VERSION,
  TRUNCATED_MESSAGE,
  buildSystemPrompt,
  cardForPrompt,
  promptDigest,
} from './prompt.ts';
import type { HistoryEntry, HistoryImage, ModelProvider, TurnUsage } from './provider.ts';
import { NO_USAGE, ProviderError, addUsage } from './provider.ts';

/** Options of {@link llmPolicy}. */
export interface LlmPolicyOptions {
  readonly provider: ModelProvider;
  /**
   * Model turns allowed. Default: as many as the level allows actions, and at least 400
   * (`STANDARD_MAX_TURNS`): a level of 120 items allows 960 actions, and a model that could
   * take 400 turns only would be stopped by the harness long before the game stops it.
   */
  readonly maxTurns?: number;
  /** The context policy; default the standard harness's. */
  readonly context?: ContextPolicy;
  /** How many pictures the conversation keeps (overrides `context.images`). */
  readonly images?: ImagePolicy;
  /** Times the model is reminded to go on when it ends a turn without starting the cycle; default 2. */
  readonly reminders?: number;
  /**
   * Times in a row a turn cut off at the output limit is dropped and asked for again before
   * the episode ends as `max_tokens`; default 2.
   */
  readonly truncationRetries?: number;
  /**
   * Most input tokens (cached ones included) the requests of one episode may add up to; no
   * limit by default. The model is not asked again when the next request, taken to be as
   * large as the last, would pass the limit, and the episode ends with the load as it stands
   * (`stopped: token_budget`). A guard on what a run can spend, not part of the standard
   * harness: the record says when it was set.
   */
  readonly maxInputTokens?: number;
}

/** Fewest turns the standard harness allows; a level that allows more actions allows as many turns. */
export const STANDARD_MAX_TURNS = 400;

/** The turn limit of a level: its action budget, and at least {@link STANDARD_MAX_TURNS}. */
export function standardMaxTurns(cardJson: string): number {
  try {
    const card = JSON.parse(cardJson) as { rules?: { budgets?: { actions_max?: unknown } } };
    const actions = card.rules?.budgets?.actions_max;
    if (typeof actions === 'number' && Number.isFinite(actions)) {
      return Math.max(STANDARD_MAX_TURNS, Math.floor(actions));
    }
  } catch {
    // No card to read: the floor.
  }
  return STANDARD_MAX_TURNS;
}

/** True when a tool result says the cycle has started and no further wash is to come. */
function cycleStarted(
  name: string,
  structured: { readonly [key: string]: unknown } | null,
): boolean {
  if (name !== 'start_cycle' || structured === null || structured['accepted'] !== true)
    return false;
  // With washes left (a level of more than one wash) the phase returns to loading afterwards.
  return structured['phase'] !== 'loading';
}

function pictureNote(image: HistoryImage): string {
  if ('removed' in image) return image.note;
  const size = pngSize(image.data_base64);
  return `[png, ${size.width}x${size.height}, ${Math.round((image.data_base64.length * 3) / 4)} bytes]`;
}

/** A history with its pictures replaced by their sizes, for the transcript file. */
function withoutPictures(history: readonly HistoryEntry[]): JsonValue {
  return history.map((entry) => {
    if (entry.role === 'user') {
      return {
        role: 'user',
        text: entry.text,
        ...(entry.images === undefined ? {} : { images: entry.images.map(pictureNote) }),
      };
    }
    if (entry.role === 'assistant') {
      return {
        role: 'assistant',
        text: entry.text,
        tool_calls: entry.tool_calls.map((call) => ({
          id: call.id,
          name: call.name,
          arguments: JSON.parse(JSON.stringify(call.arguments ?? null)) as JsonValue,
        })),
      };
    }
    return {
      role: 'tool',
      results: entry.results.map((result) => ({
        call_id: result.call_id,
        name: result.name,
        is_error: result.is_error,
        text: result.text,
        images: result.images.map(pictureNote),
      })),
    };
  });
}

/** The policy that lets a model play. */
export function llmPolicy(options: LlmPolicyOptions): Policy {
  const { provider } = options;
  const policy: ContextPolicy = {
    ...(options.context ?? STANDARD_CONTEXT_POLICY),
    ...(options.images === undefined ? {} : { images: options.images }),
  };
  const reminders = options.reminders ?? 2;
  const truncationRetries = options.truncationRetries ?? 2;
  let maxTurns = options.maxTurns ?? STANDARD_MAX_TURNS;
  return {
    name: `${provider.name}:${provider.model}`,
    kind: 'agent',
    settings: (): JsonValue => ({
      provider: provider.name,
      model: provider.model,
      request: provider.settings(),
      max_turns: maxTurns,
      max_turns_rule:
        options.maxTurns === undefined
          ? `the action budget of the level, at least ${STANDARD_MAX_TURNS}`
          : 'as given',
      context: contextSettings(policy),
      reminders,
      truncation_retries: truncationRetries,
      ...(options.maxInputTokens === undefined ? {} : { max_input_tokens: options.maxInputTokens }),
      prompt_version: PROMPT_VERSION,
    }),

    async play(context: PolicyContext): Promise<PolicyOutcome> {
      const tools = await context.tools.list();
      // The level card is a free resource, as the page shows it to a person at all times.
      const card = await context.tools.resource(RESOURCE_URIS.card);
      if (options.maxTurns === undefined) maxTurns = standardMaxTurns(card);
      const system = buildSystemPrompt({
        manual: await context.tools.resource(RESOURCE_URIS.manual),
        guidance: await context.tools.resource(RESOURCE_URIS.guidance),
        card: cardForPrompt(card),
      });
      const conversation = new Conversation(OPENING_MESSAGE, policy);
      let usage: TurnUsage = NO_USAGE;
      let lastRequestTokens = 0;
      let largestRequestTokens = 0;
      let turns = 0;
      let reminded = 0;
      let truncatedInARow = 0;
      let truncations = 0;
      let callsNotRun = 0;
      let reasoningDropped: number | null = null;
      const perTurn: JsonValue[] = [];
      const finish = (stopped: string, failed: boolean, detail?: string): PolicyOutcome => ({
        stopped,
        ...(detail === undefined ? {} : { detail }),
        turns,
        usage,
        failed,
        transcript: {
          system,
          system_digest: promptDigest(system),
          tools: tools.map((tool) => tool.name),
          // What the fixed part of every request was made of, for fitting the token
          // estimate of `measure.ts` to what a provider counted.
          fixed_characters: characterClasses(system + toolsText(tools)),
          // Every turn of the episode, also those the context policy has since taken out of
          // what the model is sent; `conversation_at_end` is what the last request carried.
          history: withoutPictures(conversation.everything),
          conversation_at_end: withoutPictures(conversation.history),
          turns: perTurn,
          context: {
            ...contextSettings(policy),
            folds: conversation.folds as unknown as JsonValue,
            picture_prunings: conversation.prunings,
            largest_request_tokens: largestRequestTokens,
            // Calls of a turn that were not made because the turn's results were already
            // past the hard limit.
            calls_not_run: callsNotRun,
            // Reasoning blocks of kept turns the provider dropped after edits of the
            // conversation, in all; null when the provider does not report it.
            reasoning_blocks_dropped: reasoningDropped,
          },
          // The harness's own copy of the load, kept from the results alone.
          load_at_end: conversation.load.complete
            ? (conversation.load.state() as unknown as JsonValue)
            : null,
          prunings: conversation.prunings,
          truncations,
        },
      });

      const inputOf = (u: TurnUsage): number =>
        u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens;
      while (turns < maxTurns) {
        if (
          options.maxInputTokens !== undefined &&
          inputOf(usage) + lastRequestTokens > options.maxInputTokens
        ) {
          return finish(
            'token_budget',
            false,
            `${inputOf(usage)} input tokens used of ${options.maxInputTokens}, and the next request would be about ${lastRequestTokens}`,
          );
        }
        let turn;
        try {
          turn = await provider.complete({ system, tools, history: conversation.history });
        } catch (error) {
          if (error instanceof ProviderError) {
            context.log(`provider error (${error.kind}): ${error.message}`);
            return finish('provider_error', true, `${error.kind}: ${error.message}`);
          }
          throw error;
        }
        turns += 1;
        usage = addUsage(usage, turn.usage);
        if (turn.reasoning_blocks_dropped !== undefined) {
          reasoningDropped = (reasoningDropped ?? 0) + turn.reasoning_blocks_dropped;
        }
        lastRequestTokens = inputOf(turn.usage);
        largestRequestTokens = Math.max(largestRequestTokens, lastRequestTokens);
        context.log(
          `turn ${turns}: ${turn.stop}${turn.tool_calls.length === 0 ? '' : ` ${turn.tool_calls.map((call) => call.name).join(', ')}`}; ${lastRequestTokens} tokens in, ${turn.usage.output_tokens} out`,
        );
        perTurn.push({
          turn: turns,
          model: turn.model,
          stop: turn.stop,
          tool_calls: turn.tool_calls.map((call) => call.name),
          usage: { ...turn.usage },
          folds_so_far: conversation.folds.length,
          // What the fold or pruning before this request cost the model of its own carried
          // reasoning, where the provider says (see README section 2, point 8).
          ...(turn.reasoning_blocks_dropped === undefined
            ? {}
            : { reasoning_blocks_dropped: turn.reasoning_blocks_dropped }),
        });
        // A turn cut off at the token limit may carry a tool call with half its arguments:
        // nothing of it is run and nothing of it stays in the conversation. One long
        // deliberation is a limit of the harness, not a move of the player, so the model is
        // told and asked again; only a model that keeps running into the limit ends there.
        if (turn.stop === 'max_tokens') {
          truncations += 1;
          truncatedInARow += 1;
          if (truncatedInARow > truncationRetries) {
            return finish('max_tokens', false, `${truncatedInARow} turns in a row were cut off`);
          }
          conversation.addUser(TRUNCATED_MESSAGE);
          continue;
        }
        truncatedInARow = 0;
        const assistant = {
          role: 'assistant' as const,
          text: turn.text,
          tool_calls: turn.tool_calls,
          native: turn.native,
        };
        if (turn.stop === 'refusal') {
          conversation.addTurn(assistant, []);
          return finish('refusal', false, turn.stop_detail);
        }

        if (turn.tool_calls.length === 0) {
          conversation.addTurn(assistant, []);
          if (reminded >= reminders)
            return finish(
              turn.stop === 'end_turn' ? 'end_turn' : turn.stop,
              false,
              turn.stop_detail,
            );
          reminded += 1;
          conversation.addUser(CONTINUE_MESSAGE);
          continue;
        }

        // The calls of a turn are run in the order given, one after another: they act on one scene.
        const results: TurnResult[] = [];
        let started = false;
        let exhausted = false;
        // The results of one turn are never folded before the model has seen them, so a
        // turn is bounded where it is made: once its results have passed the hard limit of
        // the context policy, its further calls are not made, and the model is told to
        // make them in its next turn.
        let turnTokens = 0;
        for (const call of turn.tool_calls) {
          if (!started && turnTokens > policy.hardLimit) {
            callsNotRun += 1;
            results.push({
              call,
              structured: { accepted: false, reason: 'turn_too_large' },
              result: {
                call_id: call.id,
                name: call.name,
                text: JSON.stringify({
                  accepted: false,
                  reason: 'turn_too_large',
                  detail:
                    'not run: the results of the earlier calls of this turn already fill the room a turn has; make this call again in your next turn',
                }),
                images: [],
                is_error: true,
              },
            });
            continue;
          }
          if (started) {
            results.push({
              call,
              structured: { accepted: false, reason: 'episode_over' },
              result: {
                call_id: call.id,
                name: call.name,
                text: JSON.stringify({
                  accepted: false,
                  reason: 'episode_over',
                  detail: 'the cycle has been started',
                }),
                images: [],
                is_error: true,
              },
            });
            continue;
          }
          const outcome = await context.tools.call(call.name, call.arguments);
          results.push({
            call,
            structured: outcome.structured,
            result: {
              call_id: call.id,
              name: call.name,
              text: outcome.text,
              images: outcome.images.map((data) => ({
                media_type: 'image/png' as const,
                data_base64: data,
              })),
              is_error: outcome.isError,
            },
          });
          const made = results[results.length - 1];
          if (made !== undefined)
            turnTokens += entryTokens({ role: 'tool', results: [made.result] });
          if (cycleStarted(call.name, outcome.structured)) started = true;
          if (outcome.structured?.['reason'] === 'budget_exhausted') exhausted = true;
        }
        const folds = conversation.folds.length;
        // The provider's own count of the request is the guard on the context of the model:
        // a request it counted above the limit forces a fold whatever the estimate says.
        conversation.addTurn(assistant, results, lastRequestTokens);
        if (conversation.folds.length > folds) {
          const fold = conversation.folds[conversation.folds.length - 1];
          context.log(
            `context: ${fold?.calls_folded ?? 0} calls folded (${fold?.reason ?? ''}), about ${fold?.tokens_before ?? 0} to ${fold?.tokens_after ?? 0} tokens of conversation`,
          );
        }
        if (started) return finish('start_cycle', false);
        // The action budget is used up: the episode ends with what is loaded (benchmark.md
        // section 4.4), and the harness starts the cycle. The model is not called on until
        // the turn limit to find that out.
        if (exhausted) return finish('action_budget', false, 'the action budget is used up');
      }
      return finish('turn_limit', false, `${maxTurns} turns`);
    },
  };
}
