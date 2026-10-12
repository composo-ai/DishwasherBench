// Soak checks of the GPU foundation that are too long or too large for the unit tests
// (docs/design/sim-core.md section M1; determinism rule 12). Exits non-zero on a failure.
//
//   pnpm --filter @spotless/sim-gpu run soak
//
// 1. Wait path: 100,000 drains, 20,000 reads and 5,000 reductions on one context must not grow
//    the JS heap by more than 4 MiB (a wash drains or reads back once per base step, 10^6 times
//    or more; one kilobyte kept per call would be gigabytes).
// 2. Buffer churn: 500 buffers of 64 MiB created and released must not grow resident memory by
//    more than 256 MiB.
// 3. Two-row dispatch of the guard: a 600 MB f32 buffer needs more than one row of workgroups;
//    four planted non-finite words (first, last, either side of the row boundary) are counted.
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
import { BUFFER_USAGE, type FieldDef } from '../src/index.ts';
import { createNodeGpuContext } from '../src/node/index.ts';

setFlagsFromString('--expose-gc');
const collect = runInNewContext('gc') as () => void;
const memory = (): { heap: number; rss: number } => {
  collect();
  collect();
  const m = process.memoryUsage();
  return { heap: m.heapUsed, rss: m.rss };
};
const MIB = 2 ** 20;
const mib = (bytes: number): string => `${(bytes / MIB).toFixed(1)} MiB`;
let failures = 0;
const check = (ok: boolean, text: string): void => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${text}`);
  if (!ok) failures++;
};

const ctx = await createNodeGpuContext();
const U32: FieldDef[] = [{ name: 'v', type: 'u32', role: 'state', unit: '1' }];
const F32: FieldDef[] = [{ name: 'v', type: 'f32', role: 'state', unit: '1' }];

// 1. Wait path.
{
  const b = ctx.buffer({
    name: 'soak.small',
    owner: 'soak',
    stage: 'run',
    bytes: 4096,
    usage: BUFFER_USAGE.STORAGE,
    fields: U32,
  });
  const c = ctx.buffer({
    name: 'soak.copy',
    owner: 'soak',
    stage: 'run',
    bytes: 4096,
    usage: BUFFER_USAGE.STORAGE,
    fields: U32,
  });
  ctx.write(b, new Uint32Array(1024).fill(1));
  const spec = { strideBytes: 4, fields: [{ offsetBytes: 0, type: 'u32' as const }] };
  for (let i = 0; i < 1000; i++) await ctx.drain();
  await ctx.reduceI64(b, spec);
  const before = memory();
  for (let i = 0; i < 100_000; i++) {
    if (i % 4 === 0) ctx.submit([{ op: 'copy', from: b, to: c }]);
    await ctx.drain();
  }
  const afterDrains = memory();
  for (let i = 0; i < 20_000; i++) await ctx.read(b, 0, 4);
  const afterReads = memory();
  let sum = 0n;
  for (let i = 0; i < 5_000; i++) sum += (await ctx.reduceI64(b, spec))[0] as bigint;
  const afterReductions = memory();
  check(sum === 5_000n * 1024n, `5,000 reductions each gave 1024 (total ${sum})`);
  check(
    afterDrains.heap - before.heap < 4 * MIB,
    `100,000 drains: heap ${mib(before.heap)} -> ${mib(afterDrains.heap)}`,
  );
  check(
    afterReads.heap - afterDrains.heap < 4 * MIB,
    `20,000 reads: heap ${mib(afterDrains.heap)} -> ${mib(afterReads.heap)}`,
  );
  check(
    afterReductions.heap - afterReads.heap < 4 * MIB,
    `5,000 reductions: heap ${mib(afterReads.heap)} -> ${mib(afterReductions.heap)}`,
  );
  console.log(`     resident ${mib(before.rss)} -> ${mib(afterReductions.rss)}`);
  ctx.release(b);
  ctx.release(c);
}

// 2. Buffer churn.
{
  const before = memory();
  for (let i = 0; i < 500; i++) {
    const b = ctx.buffer({
      name: 'soak.churn',
      owner: 'soak',
      stage: 'run',
      bytes: 64 * MIB,
      usage: BUFFER_USAGE.STORAGE,
      fields: F32,
    });
    ctx.write(b, new Uint32Array(1024));
    if (i % 10 === 0 && (await ctx.nonFiniteCount([b])) !== 0) failures++;
    ctx.release(b);
    if (i % 50 === 49) await ctx.drain();
  }
  await ctx.drain();
  const after = memory();
  check(
    after.rss - before.rss < 256 * MIB,
    `500 buffers of 64 MiB created and released: resident ${mib(before.rss)} -> ${mib(after.rss)}`,
  );
}

// 3. Two-row dispatch of the guard.
{
  const words = 150_000_000;
  const b = ctx.buffer({
    name: 'soak.large',
    owner: 'soak',
    stage: 'run',
    bytes: 4 * words,
    usage: BUFFER_USAGE.STORAGE,
    fields: F32,
  });
  // One row of the guard is 32,768 workgroups of 64 invocations of 64 words.
  const row = 32768 * 64 * 64;
  const planted = [0, row - 1, row, words - 1];
  for (const at of planted) ctx.write(b, Uint32Array.of(0x7fc00000), 4 * at);
  const found = await ctx.nonFiniteCount([b]);
  check(found === planted.length, `guard over ${words} words in two rows found ${found} of 4`);
  ctx.write(b, Uint32Array.of(0), 4 * row);
  const fewer = await ctx.nonFiniteCount([b]);
  check(fewer === 3, `and ${fewer} of 3 after the word at the row boundary was cleaned`);
  ctx.release(b);
}

ctx.destroy();
console.log(failures === 0 ? 'soak passed' : `soak FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
