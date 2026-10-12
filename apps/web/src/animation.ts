/**
 * Plays back what the server's physics did. The server sends the frames of an action as one
 * batch, sampled in simulated time, followed by the state after the action; this queue hands
 * them out at the pace of the frames' own time stamps, one action after another, and gives the
 * final state of each action when its frames have been shown. Pure logic: the caller supplies
 * the passing of time.
 */

/** One frame: the bodies whose pose changed, as the server sends them. */
export interface PoseFrame<P> {
  /** Simulated time since the action began, seconds. */
  readonly t_s: number;
  readonly parts: { readonly [partId: string]: P };
  readonly items: { readonly [itemId: string]: P };
}

type Segment<P, F> =
  | {
      readonly kind: 'frames';
      readonly frames: readonly PoseFrame<P>[];
      cursor: number;
      clock: number;
    }
  | { readonly kind: 'final'; readonly value: F };

/** What {@link AnimationQueue.advance} hands out: frames and final states, in order. */
export type Played<P, F> =
  | { readonly kind: 'frame'; readonly frame: PoseFrame<P> }
  | { readonly kind: 'final'; readonly value: F };

/** Backlog of simulated time beyond which playback speeds up, seconds. */
export const BACKLOG_TARGET_S = 2.5;

/** A queue of animations and of the states that end them. */
export class AnimationQueue<P, F> {
  private readonly segments: Segment<P, F>[] = [];

  /** Adds the frames of an action. An empty batch is ignored. */
  enqueueFrames(frames: readonly PoseFrame<P>[]): void {
    if (frames.length > 0) this.segments.push({ kind: 'frames', frames, cursor: 0, clock: 0 });
  }

  /** Adds the state that follows the frames queued so far. */
  enqueueFinal(value: F): void {
    this.segments.push({ kind: 'final', value });
  }

  /** True while something is waiting to be shown. */
  get busy(): boolean {
    return this.segments.length > 0;
  }

  /** Simulated time still to be played, seconds. */
  get backlog(): number {
    let total = 0;
    for (const segment of this.segments) {
      if (segment.kind !== 'frames') continue;
      const last = segment.frames[segment.frames.length - 1] as PoseFrame<P>;
      total += Math.max(0, last.t_s - segment.clock);
    }
    return total;
  }

  /**
   * Lets `dt` seconds pass and returns what is to be shown, in order. Playback runs at the
   * speed of the simulation, or faster when more than {@link BACKLOG_TARGET_S} of it is
   * waiting, so that the picture never trails the game by long. A final state queued with
   * nothing before it is returned at once.
   */
  advance(dt: number): Played<P, F>[] {
    const out: Played<P, F>[] = [];
    const speed = Math.max(1, this.backlog / BACKLOG_TARGET_S);
    let time = Math.max(0, dt) * speed;
    for (;;) {
      const segment = this.segments[0];
      if (segment === undefined) break;
      if (segment.kind === 'final') {
        out.push({ kind: 'final', value: segment.value });
        this.segments.shift();
        continue;
      }
      const last = segment.frames[segment.frames.length - 1] as PoseFrame<P>;
      const remaining = Math.max(0, last.t_s - segment.clock);
      const step = Math.min(time, remaining);
      segment.clock += step;
      time -= step;
      while (segment.cursor < segment.frames.length) {
        const frame = segment.frames[segment.cursor] as PoseFrame<P>;
        if (frame.t_s > segment.clock + 1e-9) break;
        out.push({ kind: 'frame', frame });
        segment.cursor += 1;
      }
      if (segment.cursor < segment.frames.length) break;
      this.segments.shift();
    }
    return out;
  }

  /** Returns everything that is waiting at once (to catch up, or before leaving a level). */
  flush(): Played<P, F>[] {
    const out: Played<P, F>[] = [];
    for (const segment of this.segments) {
      if (segment.kind === 'final') {
        out.push({ kind: 'final', value: segment.value });
      } else {
        for (let i = segment.cursor; i < segment.frames.length; i++) {
          out.push({ kind: 'frame', frame: segment.frames[i] as PoseFrame<P> });
        }
      }
    }
    this.segments.length = 0;
    return out;
  }
}
