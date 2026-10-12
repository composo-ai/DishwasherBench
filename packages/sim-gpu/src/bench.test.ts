// The benchmark harness of module M1: timing that stops only after the GPU has finished, best
// and median of repeats, the cross-process lock, and the JSON report with the stack string.
// The clock and the device are scripted, so the expected numbers are known exactly.
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { benchReport, benchResult, measureGpu, medianOf } from './bench.ts';
import { acquireBenchLock, writeBenchReport } from './node/bench-lock.ts';
import type { StackString } from './types.ts';

const scratch = mkdtempSync(join(tmpdir(), 'sim-gpu-bench-test-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

describe('measureGpu', () => {
  it('stops the clock only after the device has drained, and reports best and median', async () => {
    // A scripted device: submitting is instantaneous, the GPU needs `pending` ms, and `drain`
    // is the only thing that lets that time pass. Repeat k takes 10 * durations[k] ms.
    let clock = 0;
    let pending = 0;
    const device = {
      drain: (): Promise<void> => {
        clock += pending;
        pending = 0;
        return Promise.resolve();
      },
    };
    const durations = [900, 50, 30, 40, 20, 100];
    let call = 0;
    const times = await measureGpu(
      device,
      () => {
        clock += 1; // encoding
        pending += 10 * (durations[call++] as number);
      },
      { repeats: 5, warmups: 1, now: () => clock },
    );
    // The warm-up (9 s) is not a sample; each sample is 1 ms of encoding plus the GPU time.
    expect(times.samples).toEqual([0.501, 0.301, 0.401, 0.201, 1.001]);
    expect(times.best).toBe(0.201);
    expect(times.worst).toBe(1.001);
    expect(times.median).toBe(0.401);
    expect(call).toBe(6);
  });

  it('starts each repeat from an idle device', async () => {
    // Work left in the queue by something else must not be charged to the first repeat.
    let clock = 0;
    let pending = 5000;
    const device = {
      drain: (): Promise<void> => {
        clock += pending;
        pending = 0;
        return Promise.resolve();
      },
    };
    const times = await measureGpu(device, () => void (pending += 100), {
      repeats: 2,
      warmups: 0,
      now: () => clock,
    });
    expect(times.samples).toEqual([0.1, 0.1]);
  });

  it('takes the median of an even number of samples as the mean of the middle two', () => {
    expect(medianOf([4, 1, 3, 2])).toBe(2.5);
    expect(medianOf([7])).toBe(7);
    expect(() => medianOf([])).toThrow(RangeError);
  });
});

describe('benchmark report', () => {
  it('carries rates and the stack string, and survives the file', () => {
    const stack: StackString = {
      sim: '0.1.0',
      gpu: 'apple metal-3 apple-m3-pro',
      os: 'macOS 27.0.1 (26A434)',
      webgpu: 'webgpu 0.6.2',
      runtime: 'node 20.19.0',
      physics: 'jolt 5.0',
    };
    const result = benchResult('stencil', 4e9, 'cell updates', {
      best: 0.8,
      median: 1,
      worst: 2,
      samples: [1, 0.8, 2],
    });
    expect(result.rate).toEqual({ best: 5e9, median: 4e9 });
    const report = benchReport('stencil', stack, [result], 1.5, new Date('2026-10-09T20:00:00Z'));
    const path = writeBenchReport(join(scratch, 'deep', 'stencil.json'), report);
    const back = JSON.parse(readFileSync(path, 'utf8')) as typeof report;
    expect(back).toEqual(report);
    expect(back.stackKey).toBe(
      'sim=0.1.0; gpu=apple metal-3 apple-m3-pro; os=macOS 27.0.1 (26A434); ' +
        'webgpu=webgpu 0.6.2; runtime=node 20.19.0; physics=jolt 5.0',
    );
    expect(back.finishedAt).toBe('2026-10-09T20:00:00.000Z');
  });
});

describe('benchmark lock', () => {
  const quiet = { poll: 0.02, log: () => undefined };

  it('is exclusive: a second taker waits until the first releases', async () => {
    const path = join(scratch, 'exclusive.lock');
    const first = await acquireBenchLock({ path, ...quiet });
    expect(existsSync(join(path, 'owner.json'))).toBe(true);
    expect(
      (JSON.parse(readFileSync(join(path, 'owner.json'), 'utf8')) as { pid: number }).pid,
    ).toBe(process.pid);
    // While it is held, a second taker does not get it...
    await expect(acquireBenchLock({ path, maxWait: 0.2, ...quiet })).rejects.toThrow(/gave up/);
    // ...and one that keeps waiting gets it only after the release.
    const order: string[] = [];
    const second = acquireBenchLock({ path, maxWait: 5, ...quiet }).then((lock) => {
      order.push('second acquired');
      return lock;
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    order.push('first released');
    first.release();
    const lock = await second;
    expect(order).toEqual(['first released', 'second acquired']);
    expect(lock.waited).toBeGreaterThan(0.09);
    lock.release();
    expect(existsSync(path)).toBe(false);
  });

  it('waits for a live owner in another process and takes over from a dead one', async () => {
    const path = join(scratch, 'foreign.lock');
    mkdirSync(path);
    // Owned by a live process that is not this module: the parent of the test worker.
    const owner = (pid: number): void =>
      writeFileSync(
        join(path, 'owner.json'),
        JSON.stringify({ pid, command: 'other', since: 'then' }),
      );
    owner(process.ppid);
    const messages: string[] = [];
    await expect(
      acquireBenchLock({ path, maxWait: 0.2, poll: 0.02, log: (m) => messages.push(m) }),
    ).rejects.toThrow(new RegExp(`held by pid ${process.ppid}`));
    expect(messages[0]).toMatch(/\[benchlock\] waiting for pid/);
    // A pid that cannot exist (above the largest macOS and Linux pid): the lock is stale.
    owner(2 ** 30);
    const lock = await acquireBenchLock({ path, maxWait: 2, ...quiet });
    expect(
      (JSON.parse(readFileSync(join(path, 'owner.json'), 'utf8')) as { pid: number }).pid,
    ).toBe(process.pid);
    lock.release();
  });
});
