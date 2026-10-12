/**
 * The one place where the server reaches past the public interface of `@spotless/session`: an
 * observer of every physics step, for the animation frames of the WebSocket (the public `settle`
 * and `travelRack` of `@spotless/physics` cannot be watched step by step). It only reads;
 * nothing changes what the session computes. It checks at run time that what it reaches for is
 * there and degrades to no animation when it is not.
 *
 * The scene state without a query and the wash job in hand come from the session's own
 * `peekState` and `washJob`.
 */

import type { Pose } from '@spotless/core';
import type { BodyKind } from '@spotless/physics';
import type { GameSession, SceneState } from '@spotless/session';

/** What the step observer needs of the session's physics world. */
export interface ObservedWorld {
  /** Seconds of simulated time per step. */
  readonly timeStep: number;
  bodyIds(): string[];
  getKind(id: string): BodyKind;
  getPose(id: string): Pose;
}

/** Called by the world the session steps. */
export interface StepObserver {
  /** After every physics step. */
  afterStep(): void;
  /** After a snapshot of the world was taken. */
  afterSnapshot(snapshot: Uint8Array): void;
  /** After the world was put back to that snapshot. */
  afterRestore(snapshot: Uint8Array): void;
}

interface WorldInternals extends ObservedWorld {
  stepOnce?: () => void;
  snapshot?: () => Uint8Array;
  restore?: (snapshot: Uint8Array) => void;
}

function worldOf(session: GameSession): WorldInternals | null {
  const world = (session as unknown as { world?: unknown }).world;
  if (typeof world !== 'object' || world === null) return null;
  const candidate = world as Partial<WorldInternals>;
  if (
    typeof candidate.timeStep !== 'number' ||
    typeof candidate.bodyIds !== 'function' ||
    typeof candidate.getKind !== 'function' ||
    typeof candidate.getPose !== 'function'
  ) {
    return null;
  }
  return candidate as WorldInternals;
}

/**
 * Has `observer` called after every step of the session's physics world and after every
 * snapshot taken of it and restored to it. The steps themselves are untouched: the same calls in the same order
 * with the same results. Returns the world for reading poses, or null when the session's
 * internals are not as expected (then nothing is observed).
 */
export function observeSteps(session: GameSession, observer: StepObserver): ObservedWorld | null {
  const world = worldOf(session);
  if (world === null) return null;
  const step = world.stepOnce;
  const snapshot = world.snapshot;
  const restore = world.restore;
  if (
    typeof step !== 'function' ||
    typeof snapshot !== 'function' ||
    typeof restore !== 'function'
  ) {
    return null;
  }
  world.stepOnce = function stepOnceObserved(this: unknown): void {
    step.call(this);
    observer.afterStep();
  };
  world.snapshot = function snapshotObserved(this: unknown): Uint8Array {
    const taken = snapshot.call(this);
    observer.afterSnapshot(taken);
    return taken;
  };
  world.restore = function restoreObserved(this: unknown, taken: Uint8Array): void {
    restore.call(this, taken);
    observer.afterRestore(taken);
  };
  return world;
}

/** The scene state without counting a query or writing to the log (the session's `peekState`). */
export function uncountedSceneState(session: GameSession): SceneState {
  return session.peekState();
}

/** The session's wash job in hand or last finished, without logging a `get_report`. */
export function currentWashJob(session: GameSession): {
  readonly id: string;
  readonly status: 'running' | 'done' | 'failed';
  readonly progress: number;
} | null {
  return session.washJob();
}
