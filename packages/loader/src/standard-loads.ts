/**
 * The standard loads: named, reproducible, physically settled loads of the owner's machine.
 * Each is a level, a policy and a seed; generating one plays the policy through a fresh session,
 * starts the cycle (which pushes the baskets in and closes the door on the load) and keeps
 * everything needed to use the load and to check it: the items on offer, the action log, the
 * manifest the wash is handed, the final state hash and the numbers of the checks.
 *
 * A saved load is plain JSON (`loads/<name>.json`). Nothing in it depends on when or where it
 * was generated except the block `measured` (wall-clock times).
 */

import type { Level } from '@spotless/levels';
import { allLevels } from '@spotless/levels';
import type {
  ActionLogEvent,
  GameSession,
  LoadCheck,
  LoadManifest,
  WashManifest,
} from '@spotless/session';
import { createSession, replayActionLog } from '@spotless/session';
import { viewOf } from './families.ts';
import type { LeftOut, MistakeKind, MistakeMade } from './loading.ts';
import type { SettledLoad } from './mistakes.ts';
import { MISTAKE_KINDS, mistakeHolds } from './mistakes.ts';
import type { PolicyCounts, PolicyMeasured, PolicyName, PolicyResult } from './policy.ts';
import { runPolicy } from './policy.ts';
import { playOwnerLoad } from './owner-load.ts';
import { halfIecLevel, iecLevel, ownerLoadLevel } from './standard-levels.ts';
import type { LoadNumbers } from './verify.ts';
import { verifyLoad } from './verify.ts';

/** Format tag of a saved standard load. */
export const STANDARD_LOAD_FORMAT = 'spotless-standard-load/1';

/** What defines a standard load. */
export interface StandardLoadSpec {
  /** File name without extension, for example `iec-13-careful`. */
  readonly name: string;
  /** What the load is, in a sentence. */
  readonly description: string;
  readonly level: Level;
  readonly policy: PolicyName;
  readonly seed: number;
  /** Careful policy: keep neighbours apart and spread the load out. */
  readonly spaced?: boolean;
  /** Careless policy: the kinds of mistake to make (default all). */
  readonly mistakes?: readonly MistakeKind[];
  /**
   * A load that no policy places: a fixed list of moves played through the session (the
   * owner's own load). `policy` then only names the kind of load it is.
   */
  readonly byHand?: 'owner-2026-10-10';
}

/** The wash manifest of a saved load: the session's `WashManifest` without its copy of the level. */
export type SavedWashManifest = Omit<WashManifest, 'level'>;

/** A standard load as saved. */
export interface StandardLoad {
  readonly format: typeof STANDARD_LOAD_FORMAT;
  readonly name: string;
  readonly description: string;
  /** The level the load was played on; with the action log it reproduces the load. */
  readonly level: Level;
  readonly policy: {
    readonly name: PolicyName;
    readonly seed: number;
    readonly spaced: boolean;
    readonly mistakes: readonly MistakeKind[] | null;
    /** Present when no policy placed the load: the name of the fixed list of moves that did. */
    readonly by_hand?: string;
  };
  /** Ids of the items offered to the policy, most wanted first. */
  readonly offered: readonly string[];
  /** Ids of the offered items that are in the machine. */
  readonly placed: readonly string[];
  /** The offered items that are not, each with the reason. */
  readonly left_out: readonly LeftOut[];
  /** Careless policy: the mistakes that are in the load. */
  readonly mistakes: readonly MistakeMade[];
  readonly notes: readonly string[];
  readonly counts: PolicyCounts;
  /**
   * The session's event stream from the start of the level to the accepted `start_cycle`.
   * Replaying its actions against a fresh session of `level` reproduces every state hash.
   */
  readonly action_log: readonly ActionLogEvent[];
  /** The mechanical check of the final load (the pre-checks of `start_cycle`). */
  readonly check: LoadCheck;
  /** The load as players see it: rounded poses in the tub frame. */
  readonly load_manifest: LoadManifest;
  /**
   * What `start_cycle` hands the wash: every loaded item with its exact settled pose in the tub
   * frame (`p` metres, `q` as `[x, y, z, w]`), its catalogue type, its soils and points, the
   * machine configuration, the programme and the seed. The level is `level` above.
   */
  readonly wash_manifest: SavedWashManifest;
  /** Scene hash after `start_cycle`: the hash of the load that is washed. */
  readonly final_state_hash: string;
  /** The numbers of the checks (brief section 3). */
  readonly numbers: LoadNumbers;
  /** Wall-clock measurements of the run that generated the file; not reproducible. */
  readonly measured: PolicyMeasured & { readonly startCycleMs: number };
}

/** The standard loads on the owner's machine, in the order they are reported. */
export function standardLoadSpecs(): readonly StandardLoadSpec[] {
  const iec = iecLevel();
  const half = halfIecLevel();
  const specs: StandardLoadSpec[] = [
    {
      name: 'iec-13-careful',
      description:
        'The IEC test load of 13 place settings with its serving pieces and soils, loaded carefully.',
      level: iec,
      policy: 'careful',
      seed: 13,
    },
    {
      name: 'iec-13-careless',
      description: 'The same IEC load, loaded with the common mistakes.',
      level: iec,
      policy: 'careless',
      seed: 13,
      // Every kind, the two that stop the machine included: this is the load the anchoring
      // washes as its careless case with the tablet's path blocked, and it was generated when
      // that was the careless policy's default. The default is the mistakes of the hand since
      // 2026-10-11 (`CARELESS_DEFAULT_MISTAKES`); this load keeps what it always was.
      mistakes: MISTAKE_KINDS,
    },
    {
      name: 'half-careful',
      description: 'Half of the IEC load (six place settings), loaded carefully and well spaced.',
      level: half,
      policy: 'careful',
      seed: 6,
      spaced: true,
    },
    {
      name: 'owner-2026-10-10',
      description:
        "The owner's own load of 10 October 2026, placed by hand after his photograph of the loaded lower basket: stand-ins from the catalogue, items resting on items as he loads them.",
      level: ownerLoadLevel(),
      policy: 'careful',
      seed: 0,
      byHand: 'owner-2026-10-10',
    },
  ];
  // The reference loads of every level of the game: the starter levels and the generated ones.
  for (const level of allLevels()) {
    for (const policy of ['careful', 'careless', 'random'] as const) {
      specs.push({
        name: `${level.id}-${policy}`,
        description: `Level '${level.title}', loaded by the ${policy} policy.`,
        level,
        policy,
        seed: referenceSeed(level, 1),
      });
    }
  }
  return specs;
}

/**
 * The seed of a reference policy's own random choices on a level, for the `run`-th run of it
 * (from 1): the level's seed for the first, so that the saved reference loads of a level are
 * what the benchmark harness plays with its default seed, and the next whole numbers after it.
 */
export function referenceSeed(level: Pick<Level, 'seed'>, run: number): number {
  return (level.seed + Math.max(1, Math.floor(run)) - 1) >>> 0;
}

/**
 * The items of a level in the order a reference policy is offered them: the order in which
 * the level lists them, which is its order of priority.
 */
export function referenceItems(level: Pick<Level, 'items'>): string[] {
  return level.items.map((item) => item.id);
}

/** What {@link generateStandardLoad} returns besides the load: the session, for drawing. */
export interface GeneratedLoad {
  readonly load: StandardLoad;
  readonly result: PolicyResult;
  /** The session after `start_cycle`; the caller disposes it. */
  readonly session: GameSession;
}

/**
 * Generates a standard load: plays the policy on a fresh session, starts the cycle and measures
 * the load. Throws if the cycle cannot be started (a basket or the door blocked), which a
 * policy is meant to prevent.
 */
export async function generateStandardLoad(
  spec: StandardLoadSpec,
  now: () => number = () => 0,
  trace?: (line: string) => void,
): Promise<GeneratedLoad> {
  const session = await createSession({ level: spec.level });
  try {
    const result =
      spec.byHand !== undefined
        ? playOwnerLoad(session, { now, ...(trace === undefined ? {} : { trace }) })
        : runPolicy(session, {
            policy: spec.policy,
            seed: spec.seed,
            items: referenceItems(spec.level),
            now,
            ...(spec.spaced === undefined ? {} : { spaced: spec.spaced }),
            ...(spec.mistakes === undefined ? {} : { mistakes: spec.mistakes }),
            ...(trace === undefined ? {} : { trace }),
          });
    // The policy has tidied its own load (`tidy.ts`): a careful load without plates against
    // their rows, a careless or random one whose baskets have travelled once.
    const started = now();
    let cycle = session.startCycle();
    // A policy leaves a load the door closes on; should one not, what is in the way comes out
    // (as a player would have to do) and the removal is noted.
    const extraNotes: string[] = [];
    for (let round = 0; round < 5 && !cycle.accepted && cycle.reason === 'door_blocked'; round++) {
      const check = session.checkLoad();
      if (!check.accepted) break;
      const inTheWay = new Set<string>([
        ...check.door_blocked_by,
        ...check.racks.flatMap((rack) => (rack.blocked_by === undefined ? [] : [rack.blocked_by])),
      ]);
      let removed = 0;
      for (const id of inTheWay) {
        if (session.remove({ item_id: id }).accepted) {
          removed += 1;
          extraNotes.push(
            `${id} was taken out before the cycle: it kept the door or a basket from closing`,
          );
        }
      }
      if (removed === 0) break;
      cycle = session.startCycle();
    }
    const startCycleMs = Math.round(now() - started);
    if (!cycle.accepted) {
      throw new Error(
        `loader: start_cycle was refused for '${spec.name}': ${cycle.reason} ${cycle.detail ?? ''}`,
      );
    }
    await session.washSettled();
    const manifest = session.washManifest();
    if (manifest === null) throw new Error('loader: the session has no wash manifest');
    const { level: _level, ...washManifest } = manifest;
    void _level;
    const loaded = new Set(manifest.items.map((item) => item.item_id));
    const finalState = session.peekState();
    const stateAtEnd = {
      ...finalState,
      placed: finalState.placed.filter((item) => loaded.has(item.item_id)),
    };
    // The mistakes are those the settled load still shows after the baskets have travelled.
    const settled: SettledLoad = {
      placed: new Map(stateAtEnd.placed.map((item) => [item.item_id, item])),
      views: new Map(session.getLevel().items.map((item) => [item.item_id, viewOf(item)])),
      envelopes: new Map(
        session.getLevel().machine.racks.map((rack) => [rack.rack, rack.envelope_mm] as const),
      ),
      check: cycle.prechecks,
    };
    const numbers = await verifyLoad(manifest, stateAtEnd, cycle.prechecks);
    const load: StandardLoad = {
      format: STANDARD_LOAD_FORMAT,
      name: spec.name,
      description: spec.description,
      level: spec.level,
      policy: {
        name: spec.policy,
        seed: spec.seed,
        spaced: spec.spaced === true,
        mistakes: spec.policy === 'careless' ? (spec.mistakes ?? null) : null,
        ...(spec.byHand === undefined ? {} : { by_hand: spec.byHand }),
      },
      offered: result.offered,
      placed: result.placed.filter((id) => loaded.has(id)),
      left_out: [
        ...result.leftOut,
        ...result.placed
          .filter((id) => !loaded.has(id))
          .map((id) => ({
            item_id: id,
            reason: 'taken out before the cycle: it kept the door or a basket from closing',
          })),
      ],
      mistakes: result.mistakes.filter(
        (mistake) => loaded.has(mistake.item_id) && mistakeHolds(mistake, settled) === null,
      ),
      notes: [...result.notes, ...extraNotes],
      counts: {
        ...result.counts,
        placed: result.placed.filter((id) => loaded.has(id)).length,
        attemptsPerPlaced:
          Math.round(
            (result.counts.placeCalls /
              Math.max(1, result.placed.filter((id) => loaded.has(id)).length)) *
              100,
          ) / 100,
        acceptedPerPlaced:
          Math.round(
            (result.counts.placeAccepted /
              Math.max(1, result.placed.filter((id) => loaded.has(id)).length)) *
              100,
          ) / 100,
      },
      action_log: session.actionLog(),
      check: cycle.prechecks,
      load_manifest: manifest.load,
      wash_manifest: washManifest,
      final_state_hash: cycle.state_hash,
      numbers,
      measured: { ...result.measured, startCycleMs },
    };
    return { load, result, session };
  } catch (error) {
    session.dispose();
    throw error;
  }
}

/** Outcome of {@link replayStandardLoad}. */
export interface LoadReplay {
  /** True when every action reproduced its state hash and the final hash is the saved one. */
  readonly ok: boolean;
  readonly replayed: number;
  readonly mismatches: number;
  readonly final_state_hash: string;
}

/**
 * Replays the action log of a saved load against a fresh session of its level and compares
 * every state hash and the final one.
 */
export async function replayStandardLoad(load: StandardLoad): Promise<LoadReplay> {
  const replay = await replayActionLog(load.level, load.action_log);
  return {
    ok: replay.ok && replay.final_state_hash === load.final_state_hash,
    replayed: replay.replayed,
    mismatches: replay.mismatches.length,
    final_state_hash: replay.final_state_hash,
  };
}

/**
 * The session's `WashManifest` of a saved load: its wash manifest with the level put back, and
 * with the mechanical findings of `start_cycle` (a stopped arm, a blocked tablet) as its
 * `prechecks`. A load saved before the session wrote that field keeps them under `check`.
 */
export function washManifestOf(load: StandardLoad): WashManifest {
  return {
    ...load.wash_manifest,
    level: load.level,
    prechecks: load.wash_manifest.prechecks ?? load.check,
  };
}
