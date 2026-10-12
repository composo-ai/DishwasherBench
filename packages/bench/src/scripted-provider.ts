/**
 * A provider that is no model: it plays a scripted sequence of turns. For testing the
 * harness end to end without calling a model's API, and for rehearsing a run.
 */

import type { JsonValue } from '@spotless/core';
import type { HistoryEntry, ModelProvider, ModelTurn, TurnRequest } from './provider.ts';

/** One scripted turn: tool calls to make, or words to say and stop. */
export type ScriptedTurn =
  | {
      readonly calls: readonly { readonly name: string; readonly arguments: unknown }[];
      readonly text?: string;
    }
  | { readonly say: string; readonly stop?: ModelTurn['stop'] };

/** A script: a list of turns, or a function that decides each turn from the conversation. */
export type Script =
  readonly ScriptedTurn[] | ((request: TurnRequest, turn: number) => ScriptedTurn);

/** A provider that plays a script, and what it was asked. */
export interface ScriptedProvider extends ModelProvider {
  /** Every request received, in order. */
  readonly requests: TurnRequest[];
}

/**
 * A provider that answers the n-th request with the n-th scripted turn (the last turn of a
 * list is repeated once the list is used up). Tokens are counted by a fixed rule (one per
 * four characters of what it was sent and what it answered), so that usage totals are
 * deterministic.
 */
export function scriptedProvider(script: Script, model = 'scripted'): ScriptedProvider {
  const requests: TurnRequest[] = [];
  const sizeOf = (history: readonly HistoryEntry[]): number => {
    let characters = 0;
    for (const entry of history) {
      if (entry.role === 'user') characters += entry.text.length;
      else if (entry.role === 'assistant')
        characters += entry.text.length + JSON.stringify(entry.tool_calls).length;
      else for (const result of entry.results) characters += result.text.length;
    }
    return characters;
  };
  return {
    name: 'scripted',
    model,
    requests,
    settings: (): JsonValue => ({
      script: typeof script === 'function' ? 'function' : script.length,
    }),
    complete(request: TurnRequest): Promise<ModelTurn> {
      const index = requests.length;
      requests.push(request);
      const step =
        typeof script === 'function'
          ? script(request, index)
          : (script[Math.min(index, script.length - 1)] as ScriptedTurn);
      const calls =
        'calls' in step
          ? step.calls.map((call, i) => ({
              id: `call_${index}_${i}`,
              name: call.name,
              arguments: call.arguments,
            }))
          : [];
      const text = 'calls' in step ? (step.text ?? '') : step.say;
      const output = text.length + JSON.stringify(calls).length;
      return Promise.resolve({
        text,
        tool_calls: calls,
        stop: 'calls' in step ? 'tool_use' : (step.stop ?? 'end_turn'),
        usage: {
          input_tokens: Math.ceil((request.system.length + sizeOf(request.history)) / 4),
          output_tokens: Math.ceil(output / 4),
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
        model,
        native: { text, calls },
      });
    },
  };
}
