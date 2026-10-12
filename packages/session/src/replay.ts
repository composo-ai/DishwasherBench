/**
 * Replay of an action log (docs/design/platform.md section 2, determinism rule 5): the events
 * of a log are applied to a fresh session of the same level, and the scene hash after every
 * one of them must be the hash the log recorded.
 */

import type { JsonValue } from '@spotless/core';
import type { Level } from '@spotless/levels';
import type { GameSession, SessionOptions } from './session.ts';
import { createSession } from './session.ts';
import type {
  ActionLogEvent,
  GetItemRequest,
  ListSlotsRequest,
  PlaceRequest,
  PreviewRequest,
  RemoveRequest,
  SetRackRequest,
  StartCycleRequest,
} from './types.ts';
import type { WashManifest, WashRunner } from './wash.ts';
import { placeholderWashRunner } from './wash.ts';

/** One difference between a log and its replay. */
export interface ReplayMismatch {
  readonly seq: number;
  readonly name: string;
  /**
   * What differs: whether the call was accepted, the scene hash after it, its result, or
   * (`name`) that the log names a call the session does not have.
   */
  readonly field: 'accepted' | 'state_hash' | 'result_digest' | 'name';
  readonly expected: string;
  readonly actual: string;
}

/** Outcome of {@link replayActionLog}. */
export interface ReplayResult {
  /** True when every replayed event reproduced its recorded hash. */
  readonly ok: boolean;
  /** Number of events replayed. */
  readonly replayed: number;
  readonly mismatches: readonly ReplayMismatch[];
  /** Scene hash at the end of the replay. */
  readonly final_state_hash: string;
  /**
   * The manifest of the load the replaying session last started a cycle on (exact poses, the
   * level, the seed: what a wash is a function of); null when the log starts no cycle.
   */
  readonly manifest: WashManifest | null;
}

/** Options of {@link replayActionLog}. */
export interface ReplayOptions {
  /**
   * Also re-issue the queries of the log (default false: only actions change the scene, so the
   * hashes must come out the same without them). With queries, the digest of every result is
   * compared too, except that of `get_report`, which depends on when it was asked.
   */
  readonly queries?: boolean;
  /** Wash runner of the replaying session; default the placeholder. */
  readonly washRunner?: SessionOptions['washRunner'];
  /**
   * How the washes of the log ended, in order, when some of them failed: a failed wash gives
   * the wash back, and the events after it were issued to a session in the loading phase. The
   * replaying session's washes then end the same way (no wash is simulated). Washes beyond
   * the list end well. Not used together with `washRunner`.
   */
  readonly washOutcomes?: readonly ('done' | 'failed')[];
}

/** The calls a log can hold: the actions and queries of the session contract. */
const LOGGED_NAMES: ReadonlySet<string> = new Set([
  'place',
  'remove',
  'reset',
  'set_rack',
  'start_cycle',
  'get_level',
  'get_state',
  'get_item',
  'preview',
  'list_slots',
  'check_load',
  'get_report',
  'render',
]);

/**
 * Applies one logged event to a session by calling the method it names with the logged
 * arguments, and returns what the session logged for it (null for an event that was not
 * applied). Arguments come from a log, so they are passed as they are: the session validates
 * them like any request.
 */
export function applyLoggedEvent(
  session: GameSession,
  event: Pick<ActionLogEvent, 'kind' | 'name' | 'args'>,
): ActionLogEvent | null {
  const args = event.args as unknown;
  switch (event.name) {
    case 'place':
      session.place(args as PlaceRequest);
      break;
    case 'remove':
      session.remove(args as RemoveRequest);
      break;
    case 'reset':
      session.reset();
      break;
    case 'set_rack':
      session.setRack(args as SetRackRequest);
      break;
    case 'start_cycle':
      session.startCycle(args as StartCycleRequest);
      break;
    case 'get_level':
      session.getLevel();
      break;
    case 'get_state':
      session.getState();
      break;
    case 'get_item':
      session.getItem(args as GetItemRequest);
      break;
    case 'preview':
      session.preview(args as PreviewRequest);
      break;
    case 'list_slots':
      session.listSlots(args as ListSlotsRequest);
      break;
    case 'check_load':
      session.checkLoad();
      break;
    case 'get_report':
      session.getReport();
      break;
    case 'render':
      session.chargeQuery('render', event.args as JsonValue);
      break;
    default:
      return null;
  }
  const log = session.actionLog();
  return log[log.length - 1] ?? null;
}

/**
 * Replays a log against a fresh session of the level and verifies every scene hash. Rejected
 * actions are replayed too: they must be rejected again and leave the hash alone.
 */
export async function replayActionLog(
  level: Level,
  log: readonly ActionLogEvent[],
  options: ReplayOptions = {},
): Promise<ReplayResult> {
  let washes = 0;
  const outcomes = options.washOutcomes;
  const scripted: WashRunner | undefined =
    outcomes === undefined
      ? undefined
      : (manifest, onProgress) =>
          outcomes[washes++] === 'failed'
            ? Promise.reject(new Error('the wash failed when the log was recorded'))
            : placeholderWashRunner(manifest, onProgress);
  const washRunner = options.washRunner ?? scripted;
  const session = await createSession({
    level,
    ...(washRunner === undefined ? {} : { washRunner }),
  });
  const mismatches: ReplayMismatch[] = [];
  let replayed = 0;
  try {
    for (const event of log) {
      const known = LOGGED_NAMES.has(event.name);
      if (known && event.kind === 'query' && options.queries !== true) continue;
      const again = known ? applyLoggedEvent(session, event) : null;
      if (again === null) {
        // A log that names a call the session does not have is not a log of this game.
        mismatches.push({
          seq: event.seq,
          name: String(event.name),
          field: 'name',
          expected: 'a call of the session contract',
          actual: `'${String(event.name)}'`,
        });
        continue;
      }
      replayed += 1;
      const differ = (field: ReplayMismatch['field'], expected: string, actual: string): void => {
        if (expected !== actual) {
          mismatches.push({ seq: event.seq, name: event.name, field, expected, actual });
        }
      };
      differ('accepted', String(event.accepted), String(again.accepted));
      differ('state_hash', event.state_hash, again.state_hash);
      if (options.queries === true && event.name !== 'get_report') {
        differ('result_digest', event.result_digest, again.result_digest);
      }
      // The wash ends (as the placeholder or as the outcomes say) before the next event, so
      // that what follows a failed wash meets the session in the phase it was issued in.
      if (event.name === 'start_cycle' && again.accepted && options.washRunner === undefined) {
        await session.washSettled();
      }
    }
    await session.washSettled();
    return {
      ok: mismatches.length === 0,
      replayed,
      mismatches,
      final_state_hash: session.stateHash(),
      manifest: session.washManifest(),
    };
  } finally {
    session.dispose();
  }
}
