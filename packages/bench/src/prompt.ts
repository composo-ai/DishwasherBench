/**
 * The system prompt of the standard harness: one text with the rules of the game, the manual
 * of the level, the generic loading guidance and the level card (docs/research/benchmark.md
 * section 10.2, item 8). The manual and the guidance are the texts the human client shows,
 * and the card is what `get_level` returns; all three are read from the MCP server's
 * resources, which are free, as the page shows them to a person at all times. They stand in
 * the system prompt because it is the one part of a long conversation that is never taken
 * out (`context.ts`).
 */

import { canonicalHash } from '@spotless/core';

/**
 * Version of the prompt's own wording; part of the episode record. Version 2 (2026-10-11):
 * the level card is in the prompt; what a result says and what the harness does to a long
 * conversation are said; several calls may be made in one turn. Version 3 (2026-10-11, later):
 * one sentence before the manual says that a tool's description holds where the manual
 * describes the tool's result differently (the manual's paragraph on list_slots predates the
 * ranked list).
 */
export const PROMPT_VERSION = '3';

/** What the model is told before its first turn. */
export const OPENING_MESSAGE =
  'The level is set up and the dishwasher is open. Load it and start the cycle.';

/** What the model is told when it ends a turn without having started the cycle. */
export const CONTINUE_MESSAGE =
  'The episode is not over: nothing is washed and nothing scores until start_cycle is called. Carry on loading, or call start_cycle to wash what is in the machine now.';

/** What the model is told when a turn of it was cut off at the output limit. */
export const TRUNCATED_MESSAGE =
  'Your last turn was cut off at the output limit before it was complete, so nothing of it was kept or run. Decide with less deliberation and make your next tool call.';

/** What goes into the prompt. */
export interface PromptParts {
  /** The rules of the level and the manual of the interface (resource `spotless://level/manual`). */
  readonly manual: string;
  /** The generic loading guidance (resource `spotless://guidance/loading`). */
  readonly guidance: string;
  /**
   * The level card as JSON (resource `spotless://level/card`): the machine, the programme and
   * the items. Its rules and manual are left out here: `manual` has them in words.
   */
  readonly card: string;
}

/** The level card of the resource as the prompt carries it: without what `manual` already says. */
export function cardForPrompt(cardJson: string): string {
  try {
    const card = JSON.parse(cardJson) as { [key: string]: unknown };
    const { rules: _rules, manual: _manual, ...rest } = card;
    return JSON.stringify(rest);
  } catch {
    return cardJson;
  }
}

/** The system prompt. */
export function buildSystemPrompt(parts: PromptParts): string {
  return [
    'You are playing Spotless, a game about loading a dishwasher. You play through the tools you are given; there is nobody to ask and nothing else to use.',
    [
      'The game. You are shown a set of dirty items, each worth points, and a dishwasher. It is never possible to fit everything. You choose what goes in and where, each item is placed with real physics (it is lowered, let go, and comes to rest where gravity and friction leave it), and then one wash cycle is simulated: water jets, run-off, soil and detergent. Every item that comes out clean scores its points; an item that is not clean, or that was left out, scores nothing. Your aim is the highest score.',
      'What decides the score is your judgement of what to load and how to stand it so that it washes clean. Nothing in the game tells you beforehand how well an item will wash: the tools report positions, contacts and mechanical facts only.',
    ].join('\n\n'),
    [
      'How an episode goes. The level card is at the end of this prompt (get_level returns the same); look at the machine (render; ask for labels and a grid when you need to read positions). Place items; after each placement read how the item came to rest and whether it is stable, and look again when in doubt. You can take items out and place them again. Actions and queries are limited (the result of every action says how many are used); a refused call costs nothing. When you are satisfied, call start_cycle: it pushes the baskets in, freezes the load and washes it. That ends the episode; there is one wash and no second try.',
      'What a result tells you. An action answers with what it changed, completely, and not with the whole scene: every item that is new or that moved with its new pose, what went back to the counter, the baskets and options that changed, then the load in a few numbers and the budgets. What is not named is as it was. get_state gives the whole scene, or a part, when you want it.',
      'A long episode. You may make several tool calls in one turn; they are run in the order you give them, on one scene. From time to time the harness takes the oldest calls and their results out of this conversation to keep it short, and puts in their place a note with the scene as it then stood (every item with its pose, as get_state gives it). Nothing of the load is lost by that. What goes is the detail of old results (how an old placement fell, old slot advice, old pictures): look again when you need it.',
      'Work on your own until you have called start_cycle. Do not stop to ask for confirmation.',
    ].join('\n\n'),
    `The rules of this level and the manual of the interface, as every player is shown them. The manual is written for a person at the page as well; where it and the description of a tool say different things about what the tool returns, the description of the tool is right (list_slots with an item_id returns a ranked list of places a screenful at a time, not every slot, and returns the tine rows and slots of a basket as geometry when it is called without an item_id).\n\n${parts.manual}`,
    `Loading guidance, as every player is shown it:\n\n${parts.guidance}`,
    `The level card (the machine, the programme, every kind of item and every item with its soil and points), as get_level returns it:\n\n${parts.card}`,
  ].join('\n\n---\n\n');
}

/** A short hash of a prompt, for the episode record. */
export function promptDigest(prompt: string): string {
  return canonicalHash(prompt);
}
