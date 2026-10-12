import { describe, expect, it } from 'vitest';
import type { PoseFrame } from './animation.ts';
import { AnimationQueue, BACKLOG_TARGET_S } from './animation.ts';

/** `count` frames at 30 per second, each moving item `a` to its frame number. */
function frames(count: number, start = 1): PoseFrame<number>[] {
  return Array.from({ length: count }, (_, i) => ({
    t_s: (i + 1) / 30,
    parts: {},
    items: { a: start + i },
  }));
}

describe('AnimationQueue', () => {
  it('hands out frames at the pace of their own time stamps', () => {
    const queue = new AnimationQueue<number, string>();
    queue.enqueueFrames(frames(30));
    queue.enqueueFinal('done');
    expect(queue.busy).toBe(true);
    // A tenth of a second: the frames stamped up to 0.1 s, which are three.
    const first = queue.advance(0.1);
    expect(first.map((p) => (p.kind === 'frame' ? p.frame.items['a'] : p.value))).toEqual([
      1, 2, 3,
    ]);
    // Half a second more: up to 0.6 s, frames 4 to 18.
    const second = queue.advance(0.5);
    expect(second).toHaveLength(15);
    // The rest, and then the final state, and nothing after it.
    const rest = queue.advance(1);
    expect(rest).toHaveLength(13);
    expect(rest[rest.length - 1]).toEqual({ kind: 'final', value: 'done' });
    expect(queue.busy).toBe(false);
    expect(queue.advance(1)).toEqual([]);
  });

  it('gives a final state with nothing before it at once, even when no time passes', () => {
    const queue = new AnimationQueue<number, string>();
    queue.enqueueFinal('rejected');
    expect(queue.advance(0)).toEqual([{ kind: 'final', value: 'rejected' }]);
  });

  it('plays actions one after another and never a state before its frames', () => {
    const queue = new AnimationQueue<number, string>();
    queue.enqueueFrames(frames(3));
    queue.enqueueFinal('first');
    queue.enqueueFrames(frames(3, 100));
    queue.enqueueFinal('second');
    const order: (number | string)[] = [];
    for (let i = 0; i < 20; i++) {
      for (const played of queue.advance(1 / 60)) {
        order.push(played.kind === 'frame' ? (played.frame.items['a'] as number) : played.value);
      }
    }
    expect(order).toEqual([1, 2, 3, 'first', 100, 101, 102, 'second']);
  });

  it('speeds up when more than the target backlog is waiting, and only then', () => {
    const short = new AnimationQueue<number, string>();
    short.enqueueFrames(frames(60));
    expect(short.backlog).toBeCloseTo(2, 9);
    // Two seconds are below the target: real time. 0.5 s shows the 15 frames up to 0.5 s.
    expect(short.advance(0.5)).toHaveLength(15);

    const long = new AnimationQueue<number, string>();
    long.enqueueFrames(frames(300));
    expect(long.backlog).toBeCloseTo(10, 9);
    // Ten seconds waiting: four times the target, so four times the speed.
    expect(10 / BACKLOG_TARGET_S).toBe(4);
    expect(long.advance(0.5)).toHaveLength(60);
  });

  it('flushes everything in order', () => {
    const queue = new AnimationQueue<number, string>();
    queue.enqueueFrames(frames(4));
    queue.advance(1 / 30);
    queue.enqueueFinal('end');
    const flushed = queue.flush();
    expect(flushed.map((p) => (p.kind === 'frame' ? p.frame.items['a'] : p.value))).toEqual([
      2,
      3,
      4,
      'end',
    ]);
    expect(queue.busy).toBe(false);
  });

  it('ignores an empty batch of frames', () => {
    const queue = new AnimationQueue<number, string>();
    queue.enqueueFrames([]);
    expect(queue.busy).toBe(false);
  });
});
