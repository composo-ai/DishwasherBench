/**
 * What plays an episode: a policy is given the tools of the episode and plays until it stops.
 * The scripted reference policies (`scripted.ts`) and the model policy (`llm.ts`) are both
 * policies, play through the same tools, and leave the same kind of record.
 */

import type { JsonValue } from '@spotless/core';
import type { Level } from '@spotless/levels';
import type { EpisodeUsage } from '@spotless/server';
import type { ActionLogEvent } from '@spotless/session';
import type { EpisodeTools } from './tools.ts';

/** What a policy is handed. */
export interface PolicyContext {
  readonly tools: EpisodeTools;
  /**
   * The level being played. A scripted policy plans on a session of its own of this level; a
   * model policy must not read it (what a model knows of the level, it learns through the tools).
   */
  readonly level: Level;
  /** Seed of the policy's own random choices. */
  readonly seed: number;
  /** Receives lines worth showing while the policy plays. */
  readonly log: (line: string) => void;
}

/** How a policy's play ended. */
export interface PolicyOutcome {
  /**
   * Why it stopped: `start_cycle` (it started the wash itself), `done` (a scripted policy has
   * loaded what it wanted), `end_turn`, `turn_limit`, `max_tokens`, `token_budget`,
   * `refusal`, `provider_error`.
   */
  readonly stopped: string;
  /** More about the stop, in words. */
  readonly detail?: string;
  /** Model turns taken; 0 for a scripted policy. */
  readonly turns: number;
  /** Tokens used; null for a scripted policy. */
  readonly usage: EpisodeUsage | null;
  /**
   * True when the stop is a failure of infrastructure (the model's API): the episode has no
   * result and is not washed.
   */
  readonly failed: boolean;
  /**
   * A scripted policy: the action log of its own session, which made the calls before they
   * were issued through the tools. The harness compares the server's log with it.
   */
  readonly plannedLog?: readonly ActionLogEvent[];
  /** The full conversation, for the transcript file; absent for a scripted policy. */
  readonly transcript?: JsonValue;
}

/** A policy. */
export interface Policy {
  /** Name in records and tables, for example `careful` or `anthropic:claude-opus-5-5`. */
  readonly name: string;
  /** `scripted` for code, `agent` for a model. */
  readonly kind: 'scripted' | 'agent';
  /** What the policy was run with, for the record. */
  settings(): JsonValue;
  /** Plays the episode through the tools. Rejects only for a fault of the harness itself. */
  play(context: PolicyContext): Promise<PolicyOutcome>;
}
