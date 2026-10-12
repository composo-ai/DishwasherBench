/**
 * Records what the physics did during one action, for animation: the poses of the bodies that
 * moved, sampled every fixed number of physics steps. The samples are read from the very steps
 * the session takes (nothing is simulated a second time, and reading a pose changes nothing),
 * so they show exactly the motion that produced the result. For display only.
 */

import { compareIds } from '@spotless/core';
import type { GameSession } from '@spotless/session';
import { sameDrawPose, toDrawPose } from './draw.ts';
import type { ObservedWorld } from './session-internals.ts';
import { observeSteps } from './session-internals.ts';
import type { AnimationFrame, DrawPose } from './types.ts';

/** Most frames kept for one action; beyond it every second frame is dropped as it goes. */
export const ANIMATION_FRAMES_MAX = 600;

interface RecordingMark {
  readonly steps: number;
  readonly lastCaptureStep: number;
  readonly last: ReadonlyMap<string, DrawPose>;
}

/** Records animation frames of one session. */
export class FrameRecorder {
  /** Frames per simulated second actually produced (a whole number of steps per frame). */
  readonly rateHz: number;
  private readonly world: ObservedWorld | null;
  private readonly itemIds: ReadonlySet<string>;
  private stepsPerFrame: number;
  private readonly baseStepsPerFrame: number;
  private active = false;
  private steps = 0;
  private lastCaptureStep = 0;
  private frames: AnimationFrame[] = [];
  /** Poses at the start of the action. */
  private baseline: ReadonlyMap<string, DrawPose> = new Map<string, DrawPose>();
  /** Poses as of the last frame; replaced, never changed, so that a mark can keep it. */
  private last: ReadonlyMap<string, DrawPose> = new Map<string, DrawPose>();
  /** Where the recording stood at each snapshot taken during the action. */
  private marks = new WeakMap<Uint8Array, RecordingMark>();

  /**
   * Attaches to the session's physics world. `rateHz` is the wanted number of frames per
   * simulated second; the nearest whole number of steps per frame is used.
   */
  constructor(session: GameSession, rateHz: number) {
    this.itemIds = new Set(session.level.items.map((item) => item.id));
    this.world = observeSteps(session, {
      afterStep: () => {
        if (this.active) this.onStep();
      },
      afterSnapshot: (snapshot) => {
        if (this.active) this.onSnapshot(snapshot);
      },
      afterRestore: (snapshot) => {
        if (this.active) this.onRestore(snapshot);
      },
    });
    const timeStep = this.world?.timeStep ?? 1 / 240;
    this.baseStepsPerFrame = Math.max(1, Math.round(1 / (rateHz * timeStep)));
    this.stepsPerFrame = this.baseStepsPerFrame;
    this.rateHz = 1 / (this.baseStepsPerFrame * timeStep);
  }

  /** True when the session's world could be attached to. */
  get attached(): boolean {
    return this.world !== null;
  }

  /** Starts recording: call just before an action. */
  begin(): void {
    if (this.world === null) return;
    this.active = true;
    this.steps = 0;
    this.lastCaptureStep = 0;
    this.stepsPerFrame = this.baseStepsPerFrame;
    this.frames = [];
    this.baseline = this.read();
    this.last = this.baseline;
    this.marks = new WeakMap();
  }

  /**
   * Stops recording and returns the frames, the last of which shows the bodies where the action
   * left them. Empty when nothing moved.
   */
  end(): AnimationFrame[] {
    if (!this.active) return [];
    if (this.steps > this.lastCaptureStep) this.capture();
    this.active = false;
    const frames = this.frames;
    this.frames = [];
    this.baseline = new Map();
    this.last = new Map();
    return frames;
  }

  /** Stops recording and throws the frames away (a rejected action, a query). */
  discard(): void {
    this.active = false;
    this.frames = [];
    this.baseline = new Map();
    this.last = new Map();
  }

  private onStep(): void {
    this.steps += 1;
    if (this.steps - this.lastCaptureStep >= this.stepsPerFrame) this.capture();
  }

  /** Remembers where the recording stood when a snapshot of the world was taken. */
  private onSnapshot(snapshot: Uint8Array): void {
    this.marks.set(snapshot, {
      steps: this.steps,
      lastCaptureStep: this.lastCaptureStep,
      last: this.last,
    });
  }

  /**
   * The world went back to a snapshot (after a stability probe, a rack that met resistance, an
   * attempt that was given up): what was recorded since the snapshot did not happen and is
   * dropped. A snapshot from before the action puts the recording back to its start.
   */
  private onRestore(snapshot: Uint8Array): void {
    const mark = this.marks.get(snapshot);
    if (mark === undefined) {
      this.frames = [];
      this.steps = 0;
      this.lastCaptureStep = 0;
      this.stepsPerFrame = this.baseStepsPerFrame;
      this.last = this.baseline;
      return;
    }
    const until = mark.steps * (this.world?.timeStep ?? 0);
    this.frames = this.frames.filter((frame) => frame.t_s <= until);
    this.steps = mark.steps;
    this.lastCaptureStep = mark.lastCaptureStep;
    this.last = mark.last;
  }

  /** Draw poses of every body that can move, by id. */
  private read(): Map<string, DrawPose> {
    const poses = new Map<string, DrawPose>();
    const world = this.world;
    if (world === null) return poses;
    for (const id of world.bodyIds()) {
      if (world.getKind(id) === 'static') continue;
      poses.set(id, toDrawPose(world.getPose(id)));
    }
    return poses;
  }

  private capture(): void {
    const world = this.world;
    if (world === null) return;
    this.lastCaptureStep = this.steps;
    const now = this.read();
    const parts: { [id: string]: DrawPose } = {};
    const items: { [id: string]: DrawPose } = {};
    let changed = false;
    for (const id of [...now.keys()].sort(compareIds)) {
      const pose = now.get(id) as DrawPose;
      const before = this.last.get(id);
      if (before !== undefined && sameDrawPose(before, pose)) continue;
      (this.itemIds.has(id) ? items : parts)[id] = pose;
      changed = true;
    }
    this.last = now;
    if (!changed) return;
    this.frames.push({ t_s: this.steps * world.timeStep, parts, items });
    if (this.frames.length > ANIMATION_FRAMES_MAX) this.thin();
  }

  /**
   * Halves the frame rate of what is recorded and of what follows, merging each dropped frame
   * into the one after it so that no movement is lost.
   */
  private thin(): void {
    const kept: AnimationFrame[] = [];
    for (let i = 0; i < this.frames.length; i += 2) {
      const first = this.frames[i] as AnimationFrame;
      const second = this.frames[i + 1];
      kept.push(
        second === undefined
          ? first
          : {
              t_s: second.t_s,
              parts: { ...first.parts, ...second.parts },
              items: { ...first.items, ...second.items },
            },
      );
    }
    this.frames = kept;
    this.stepsPerFrame *= 2;
  }
}
