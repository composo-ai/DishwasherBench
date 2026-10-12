/**
 * The scripted reference policies (docs/research/benchmark.md section 5.2): an empty load,
 * and the careful, careless and random loaders of `@spotless/loader`.
 *
 * A loader policy is written against a session it can call synchronously. So it first plays
 * on a session of its own of the same level, and then every call it made, in order, is
 * issued through the tools of the episode: the game server's session receives exactly the
 * calls a player sitting at the tools would have made, and because loading is deterministic
 * it goes through exactly the same states. The harness checks that it did, event by event.
 */

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { JsonValue } from '@spotless/core';
import type { MistakeKind, PolicyName } from '@spotless/loader';
import { POLICY_NAMES, referenceItems, referenceSeed, runPolicy } from '@spotless/loader';
import { createSession } from '@spotless/session';
import type { Policy, PolicyContext, PolicyOutcome } from './policy.ts';

/** Names of the scripted policies. */
export const SCRIPTED_POLICY_NAMES = ['empty', ...POLICY_NAMES] as const;

/** Name of a scripted policy. */
export type ScriptedPolicyName = (typeof SCRIPTED_POLICY_NAMES)[number];

/** Options of a loader policy. */
export interface LoaderPolicyOptions {
  /** Careful policy: keep free distance between neighbours and spread the load. Default false. */
  readonly spaced?: boolean;
  /** Careless policy: the kinds of mistake to make. Default: all. */
  readonly mistakes?: readonly MistakeKind[];
  /**
   * Ids of the items on offer, most wanted first. Default: every item of the level in the
   * order the level lists them, as the saved reference loads are made.
   */
  readonly items?: readonly string[];
}

/**
 * A fingerprint of the loader's source (SHA-256 of its non-test source files, first 16 hex
 * digits): what a loader does is a function of its code, its seed and the level, so a record
 * names the code. Null when the source cannot be read.
 */
export function loaderFingerprint(): string | null {
  try {
    const dir = fileURLToPath(new URL('../../loader/src/', import.meta.url));
    const hash = createHash('sha256');
    for (const name of readdirSync(dir).sort()) {
      if (!name.endsWith('.ts') || name.endsWith('.test.ts')) continue;
      hash.update(name);
      hash.update('\0');
      hash.update(readFileSync(join(dir, name)));
      hash.update('\0');
    }
    return hash.digest('hex').slice(0, 16);
  } catch {
    return null;
  }
}

/** The policy that loads nothing: the natural zero of the score. */
export function emptyPolicy(): Policy {
  return {
    name: 'empty',
    kind: 'scripted',
    settings: () => ({}),
    play: (): Promise<PolicyOutcome> =>
      Promise.resolve({ stopped: 'done', turns: 0, usage: null, failed: false, plannedLog: [] }),
  };
}

/** A loader policy of `@spotless/loader` played through the tools. */
export function loaderPolicy(name: PolicyName, options: LoaderPolicyOptions = {}): Policy {
  return {
    name,
    kind: 'scripted',
    settings: (): JsonValue => ({
      source: '@spotless/loader',
      source_fingerprint: loaderFingerprint(),
      ...(options.spaced === undefined ? {} : { spaced: options.spaced }),
      ...(options.mistakes === undefined ? {} : { mistakes: [...options.mistakes] }),
      ...(options.items === undefined ? {} : { items: [...options.items] }),
    }),
    async play(context: PolicyContext): Promise<PolicyOutcome> {
      // The policy's own session: where it decides. Nothing of it reaches the game server but
      // the calls themselves.
      const session = await createSession({ level: context.level });
      let planned;
      try {
        const started = performance.now();
        const result = runPolicy(session, {
          policy: name,
          // The harness's seed 1 is the level's own: the load played is the saved reference
          // load of the level (`packages/loader/loads/<level>-<policy>.json`).
          seed: referenceSeed(context.level, context.seed),
          items: options.items ?? referenceItems(context.level),
          ...(options.spaced === undefined ? {} : { spaced: options.spaced }),
          ...(options.mistakes === undefined ? {} : { mistakes: options.mistakes }),
        });
        planned = result.actionLog;
        context.log(
          `${name}: planned ${planned.length} calls, ${result.placed.length} of ${result.offered.length} items placed, in ${((performance.now() - started) / 1000).toFixed(1)} s`,
        );
      } finally {
        session.dispose();
      }
      for (const event of planned) {
        const outcome = await context.tools.call(event.name, event.args);
        // A refused call is a tool error; an answered one is not. Anything else means the
        // game did not go the way the policy's session went.
        if (outcome.isError === event.accepted) {
          throw new Error(
            `${name}: call ${event.seq} (${event.name}) was ${event.accepted ? 'accepted' : 'refused'} in the policy's session and ${outcome.isError ? 'refused' : 'accepted'} by the game: ${outcome.text.slice(0, 300)}`,
          );
        }
      }
      return { stopped: 'done', turns: 0, usage: null, failed: false, plannedLog: planned };
    },
  };
}

/** The scripted policy of a name. */
export function scriptedPolicy(
  name: ScriptedPolicyName,
  options: LoaderPolicyOptions = {},
): Policy {
  return name === 'empty' ? emptyPolicy() : loaderPolicy(name, options);
}
