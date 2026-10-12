/**
 * The three loading policies behind one call. A policy is handed a session at the start of a
 * level and the items on offer in priority order; it plays the game through the session exactly
 * as a player would and returns what it did: the action log, the final scene, what it placed
 * and what it left out and why.
 *
 * Determinism: for a level, a policy and a seed the sequence of calls is always the same, so
 * the action log and every state hash in it are too. Wall-clock measurements are returned
 * beside the result (`measured`) and take no part in any decision.
 */

import type { MachineGeometry } from '@spotless/machine';
import type { ActionLogEvent, LoadCheck, SceneState, Session } from '@spotless/session';
import type { LeftOut, LoadingReport, LoadingStyle, MistakeKind, MistakeMade } from './loading.ts';
import { Loading } from './loading.ts';
import { CARELESS_DEFAULT_MISTAKES, MACHINE_MISTAKE_KINDS } from './mistakes.ts';
import type { PlayerStats } from './player.ts';
import { Player, makeRng } from './player.ts';
import { runRandom } from './random.ts';
import { clearMechanical, tidyPosture, travelBaskets } from './tidy.ts';

/** Names of the policies. */
export const POLICY_NAMES = ['careful', 'careless', 'random'] as const;

/** Name of a policy. */
export type PolicyName = (typeof POLICY_NAMES)[number];

/** Options of {@link runPolicy}. */
export interface PolicyOptions {
  readonly policy: PolicyName;
  /** Seed of every random choice of the policy; a whole number from 0 to 2^32 - 1. */
  readonly seed: number;
  /**
   * Ids of the items on offer, most wanted first. Default: every item of the level, the one
   * worth the most points first (ties in the order of the level card).
   */
  readonly items?: readonly string[];
  /**
   * Careful policy: keep this much free distance between neighbours and spread the load over
   * the free slots ("well spaced"). Default false: a full machine is loaded one piece to a slot.
   */
  readonly spaced?: boolean;
  /**
   * Careless policy: the kinds of mistake to make. Default: {@link CARELESS_DEFAULT_MISTAKES},
   * every kind that is made with an item; the two that stop the machine (a blocked tablet, a
   * stopped arm) are made only when named. Each kind is made at least once when the load has
   * an item it can be made with.
   */
  readonly mistakes?: readonly MistakeKind[];
  /** A stopwatch in milliseconds for the measurements; default none (all times 0). */
  readonly now?: () => number;
  /** Receives one line per judged placement (careful and careless); for watching a policy. */
  readonly trace?: (line: string) => void;
}

/** What a policy did, by the count. Everything here is a function of level, policy and seed. */
export interface PolicyCounts {
  readonly offered: number;
  readonly placed: number;
  /** Placed items by the frame they were placed in. */
  readonly placedByBasket: { readonly [frame: string]: number };
  /** `place` calls, accepted or not (a rejected call is free). */
  readonly placeCalls: number;
  readonly placeAccepted: number;
  readonly placeRejected: { readonly [reason: string]: number };
  /** `place` calls per item that ended in the machine. */
  readonly attemptsPerPlaced: number;
  /** Accepted placements per item that ended in the machine (1 when nothing was taken out). */
  readonly acceptedPerPlaced: number;
  readonly removes: number;
  /** Items taken out because they fell, slid away or did not hold. */
  readonly retries: number;
  readonly rackMoves: number;
  readonly previews: number;
  readonly checks: number;
  readonly actionsUsed: number;
  readonly actionsMax: number;
  readonly queriesUsed: number;
  readonly queriesMax: number;
  /** Placed items the session's stability probe marks as not stable, sorted. */
  readonly unstable: readonly string[];
}

/** Wall-clock measurements of a policy run, milliseconds. Not reproducible. */
export interface PolicyMeasured {
  readonly totalMs: number;
  readonly placeMedianMs: number;
  readonly placeMaxMs: number;
  readonly placeTotalMs: number;
  readonly checkMedianMs: number;
  readonly rackMoveMedianMs: number;
}

/** The result of a policy run. */
export interface PolicyResult {
  readonly policy: PolicyName;
  readonly seed: number;
  /** Ids of the items offered, in priority order. */
  readonly offered: readonly string[];
  /** Ids of the offered items that are in the machine at the end, in priority order. */
  readonly placed: readonly string[];
  /** The offered items that are not, each with the reason. */
  readonly leftOut: readonly LeftOut[];
  /** Careless policy: the mistakes that are in the final load. */
  readonly mistakes: readonly MistakeMade[];
  /** The last `check_load` the policy saw (both baskets pushed in), or null. */
  readonly check: LoadCheck | null;
  readonly notes: readonly string[];
  readonly counts: PolicyCounts;
  /** The session's event stream from the start of the level. */
  readonly actionLog: readonly ActionLogEvent[];
  /** The scene at the end. */
  readonly finalState: SceneState;
  readonly measured: PolicyMeasured;
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] as number;
}

function countsOf(
  stats: PlayerStats,
  state: SceneState,
  offered: readonly string[],
  placed: readonly string[],
): PolicyCounts {
  const byBasket: { [frame: string]: number } = {};
  const offeredSet = new Set(offered);
  for (const item of state.placed) {
    if (!offeredSet.has(item.item_id)) continue;
    byBasket[item.frame] = (byBasket[item.frame] ?? 0) + 1;
  }
  const n = Math.max(1, placed.length);
  return {
    offered: offered.length,
    placed: placed.length,
    placedByBasket: byBasket,
    placeCalls: stats.placeCalls,
    placeAccepted: stats.placeAccepted,
    placeRejected: { ...stats.placeRejected },
    attemptsPerPlaced: Math.round((stats.placeCalls / n) * 100) / 100,
    acceptedPerPlaced: Math.round((stats.placeAccepted / n) * 100) / 100,
    removes: stats.removes,
    retries: stats.retries,
    rackMoves: stats.rackMoves,
    previews: stats.previews,
    checks: stats.checks,
    actionsUsed: state.budget.actions_used,
    actionsMax: state.budget.actions_max,
    queriesUsed: state.budget.queries_used,
    queriesMax: state.budget.queries_max,
    unstable: state.placed.filter((item) => !item.stable).map((item) => item.item_id),
  };
}

/** The style of the careful policy. */
export function carefulStyle(spaced: boolean): LoadingStyle {
  return { policy: 'careful', gap: spaced ? 12 : 3, mistakes: new Set(), mistakeRate: 0 };
}

/**
 * The style of the careless policy for the given kinds of mistake: the careful load, and then
 * each kind made on about a third of the items it can be made with (on at least one).
 */
export function carelessStyle(mistakes: readonly MistakeKind[]): LoadingStyle {
  return { policy: 'careless', gap: 3, mistakes: new Set(mistakes), mistakeRate: 0.35 };
}

/** A session that can say how its machine is configured now (`GameSession` of the session package). */
function geometryOf(session: Session): (() => MachineGeometry) | null {
  const candidate = session as Session & { machineGeometry?: () => MachineGeometry };
  return typeof candidate.machineGeometry === 'function'
    ? (): MachineGeometry => (candidate.machineGeometry as () => MachineGeometry)()
    : null;
}

/**
 * The finished load made fit to be washed and unloaded (`tidy.ts`): a careful load loses what
 * leans against its row or far over unheld, a careless or random one has each basket pulled
 * out and pushed in once and loses what stops it; then, for every policy, the mechanical check
 * and out comes what is now in the way of an arm, the door or a basket. What comes out is
 * listed among the items left out; a mistake made with it is no longer in the load.
 */
function tidied(
  session: Session,
  player: Player,
  policy: PolicyName,
  report: LoadingReport,
): LoadingReport {
  const notes = [...report.notes];
  let removed: LeftOut[] = [];
  if (policy === 'careful') {
    const geometry = geometryOf(session);
    if (geometry !== null) removed = tidyPosture(player, geometry);
  } else {
    const travel = travelBaskets(player);
    removed = travel.removed;
    notes.push(
      travel.travelled
        ? 'each basket was pulled out and pushed in once after loading'
        : 'a basket could not be pulled out and pushed in after loading',
    );
  }
  // The mechanical check comes last, after everything above that can move an item or free
  // one, and what is now in the way of an arm, the door or a basket comes out
  // (`clearMechanical`). An item that is in the way because the careless policy was asked to
  // put it there stays.
  const onPurpose = new Set(
    report.mistakes
      .filter((mistake) => MACHINE_MISTAKE_KINDS.includes(mistake.kind))
      .map((mistake) => mistake.item_id),
  );
  const cleared = clearMechanical(player, onPurpose, policy === 'random');
  removed = [...removed, ...cleared.removed];
  const gone = new Set(removed.map((entry) => entry.item_id));
  return {
    placed: report.placed.filter((id) => !gone.has(id)),
    leftOut: [...report.leftOut.filter((entry) => !gone.has(entry.item_id)), ...removed],
    mistakes: report.mistakes.filter(
      (mistake) =>
        !gone.has(mistake.item_id) && (mistake.with === undefined || !gone.has(mistake.with)),
    ),
    check: cleared.check ?? report.check,
    notes,
  };
}

/**
 * Plays a policy on a session that stands at the start of its level and returns what it did.
 * The session is left with both baskets pushed in and the cycle not started.
 */
export function runPolicy(session: Session, options: PolicyOptions): PolicyResult {
  const now = options.now ?? ((): number => 0);
  const started = now();
  const player = new Player(session, now);
  const offered =
    options.items ??
    [...player.card.items]
      .map((item, i) => ({ item, i }))
      .sort((a, b) => b.item.points - a.item.points || a.i - b.i)
      .map((entry) => entry.item.item_id);
  const rng = makeRng(options.seed, POLICY_NAMES.indexOf(options.policy) + 1);
  let report: LoadingReport;
  if (options.policy === 'random') report = runRandom(player, rng, offered);
  else {
    const loading = new Loading(
      player,
      options.policy === 'careful'
        ? carefulStyle(options.spaced === true)
        : carelessStyle(options.mistakes ?? CARELESS_DEFAULT_MISTAKES),
      rng,
      offered,
    );
    if (options.trace !== undefined) loading.trace = options.trace;
    report = loading.run();
  }
  report = tidied(session, player, options.policy, report);
  return resultOf(session, player, {
    policy: options.policy,
    seed: options.seed,
    offered,
    report,
    started,
    now,
  });
}

/**
 * Puts together the result of a run from what the player did and what the loading procedure
 * reports: counts, the action log, the final scene and the measurements. For `runPolicy` and
 * for loads that are placed by a fixed list of moves (`owner-load.ts`).
 */
export function resultOf(
  session: Session,
  player: Player,
  run: {
    readonly policy: PolicyName;
    readonly seed: number;
    readonly offered: readonly string[];
    readonly report: {
      readonly placed: readonly string[];
      readonly leftOut: readonly LeftOut[];
      readonly mistakes: readonly MistakeMade[];
      readonly check: LoadCheck | null;
      readonly notes: readonly string[];
    };
    readonly started: number;
    readonly now: () => number;
  },
): PolicyResult {
  const finalState = player.refresh();
  const stats = player.stats;
  return {
    policy: run.policy,
    seed: run.seed,
    offered: [...run.offered],
    placed: run.report.placed,
    leftOut: run.report.leftOut,
    mistakes: run.report.mistakes,
    check: run.report.check,
    notes: run.report.notes,
    counts: countsOf(stats, finalState, run.offered, run.report.placed),
    actionLog: session.actionLog(),
    finalState,
    measured: {
      totalMs: Math.round(run.now() - run.started),
      placeMedianMs: Math.round(median(stats.placeMs)),
      placeMaxMs: Math.round(Math.max(0, ...stats.placeMs)),
      placeTotalMs: Math.round(stats.placeMs.reduce((a, b) => a + b, 0)),
      checkMedianMs: Math.round(median(stats.checkMs)),
      rackMoveMedianMs: Math.round(median(stats.rackMs)),
    },
  };
}
