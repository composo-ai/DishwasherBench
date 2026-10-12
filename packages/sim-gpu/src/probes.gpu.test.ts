// The determinism probes of module M1 (docs/design/sim-core.md section M1, "Determinism
// probes"; rules 9 and 13 of section 6). Three things are checked: that the probes of the
// current stack equal the file recorded for it under probes/ (bits have not moved on an
// unchanged stack string), that the expressions whose result WGSL fixes exactly agree with an
// independent CPU computation on every input (which also proves that the kernel and the CPU see
// the same operands), and that the comparison of two records names the right classes.
import { afterAll, describe, expect, it } from 'vitest';
import { readProbeRecord, tryCreateNodeGpuContext } from './node/index.ts';
import {
  compareProbeRecords,
  compilerBehaviour,
  PROBE_COUNT,
  PROBED_OP_CLASSES,
  runProbes,
  type ProbeRecord,
} from './probes.ts';
import { gpuStackKey, gpuStackOf } from './stack.ts';
import { OP_CLASSES, type OpClass } from './types.ts';

const ctx = await tryCreateNodeGpuContext();
afterAll(() => ctx?.destroy());

describe('probe suite', () => {
  it('has a probe for every operation class a kernel may declare', () => {
    expect([...PROBED_OP_CLASSES].sort()).toEqual([...OP_CLASSES].sort());
  });
});

describe.skipIf(ctx === null)('determinism probes on this stack', () => {
  const current = ctx ? runProbes(ctx) : null;
  const record = (): Promise<ProbeRecord> => current as Promise<ProbeRecord>;

  it('equal the file recorded for the current stack', async () => {
    const now = await record();
    const recorded = readProbeRecord(now.stack);
    // An operating-system, bindings or runtime update is a new stack: record its probes with
    //   pnpm --filter @spotless/sim-gpu run record-probes
    // and treat caches and golden hashes as invalid (rule 13).
    expect(
      recorded,
      `no probes recorded for the stack "${gpuStackKey(now.stack)}"; run ` +
        `pnpm --filter @spotless/sim-gpu run record-probes`,
    ).not.toBeNull();
    const { changed, probeEdited } = compareProbeRecords(recorded as ProbeRecord, now);
    expect(probeEdited, 'probe kernels edited since the recording; re-record').toEqual([]);
    expect(changed, 'operation classes whose bits changed on an unchanged stack string').toEqual(
      [],
    );
    // The whole record, agreement counts included, is a function of the output bits.
    expect(now).toEqual(recorded);
  });

  it('gives the same hashes when run a second time on the same device', async () => {
    const first = await record();
    const second = await runProbes(ctx as NonNullable<typeof ctx>);
    for (const op of OP_CLASSES) expect(second.probes[op].hash, op).toBe(first.probes[op].hash);
    expect(second.stack).toEqual(gpuStackOf((ctx as NonNullable<typeof ctx>).stack));
  });

  it('agrees exactly with the CPU wherever WGSL fixes the result', async () => {
    const { probes } = await record();
    // [class, expression, reading]: bit operations, conversions of in-range values, exact
    // half-precision decoding, single correctly rounded products, and integer atomics.
    const exact: [OpClass, string, string][] = [
      ['bitcast', 'roundTrip', 'identity'],
      ['bitcast', 'negate', 'signFlip'],
      ['bitcast', 'abs', 'signClear'],
      ['bitcast', 'min', 'exact'],
      ['bitcast', 'max', 'exact'],
      ['bitcast', 'select', 'exact'],
      ['bitcast', 'fromU32', 'nearestEven'],
      ['bitcast', 'fromI32', 'nearestEven'],
      ['f16', 'unpackX', 'exact'],
      ['f16', 'unpackY', 'exact'],
      ['f16', 'unpackPack', 'identity'],
      ['ftoi', 'truncate', 'specified'],
      ['ftoi', 'unsigned', 'specified'],
      ['ftoi', 'floor', 'specified'],
      ['ftoi', 'fixedPoint20', 'specified'],
      ['fma', 'product', 'correctlyRounded'],
      ['addmul', 'scale', 'sourceOrder'],
      ['atomics', 'bins', 'exact'],
    ];
    for (const [op, expression, reading] of exact) {
      const cell = probes[op].expressions[expression]?.[reading];
      expect(cell?.matches, `${op}.${expression} as ${reading}`).toBe(probes[op].count);
    }
    expect(probes.bitcast.count).toBe(PROBE_COUNT);
    expect(probes.atomics.count).toBe(768);
  });

  it('keeps every float expression close to its nearest reading', async () => {
    // Not bitwise (rule 17), but a probe whose result is far from every reading would mean the
    // kernel and the CPU compute different things. Arithmetic: some reading within 4 ulp for
    // at least 99 % of inputs... measured through the best reading's exact matches plus the
    // bound on the others' distance. Transcendentals: within 64 ulp of double precision.
    const { probes } = await record();
    for (const op of ['div', 'sqrt'] as const) {
      for (const [name, readings] of Object.entries(probes[op].expressions)) {
        const best = Math.min(...Object.values(readings).map((r) => r.maxUlp ?? Infinity));
        expect(best, `${op}.${name}`).toBeLessThanOrEqual(4);
      }
    }
    for (const op of ['explog', 'pow', 'cbrt', 'trig', 'atan2'] as const) {
      for (const [name, readings] of Object.entries(probes[op].expressions)) {
        const best = Math.min(...Object.values(readings).map((r) => r.maxUlp ?? Infinity));
        expect(best, `${op}.${name}`).toBeLessThanOrEqual(64);
      }
    }
    // Every multiply-add candidate is explained by one of its readings, bit for bit.
    for (const [name, readings] of Object.entries(probes.fma.expressions)) {
      const most = Math.max(...Object.values(readings).map((r) => r.matches));
      expect(most, `fma.${name}`).toBe(PROBE_COUNT);
    }
  });

  it('summarises the compiler without contradicting the counts', async () => {
    const now = await record();
    const summary = compilerBehaviour(now);
    const fused = now.probes.fma.expressions['mulAdd']?.['fused']?.matches;
    const separate = now.probes.fma.expressions['mulAdd']?.['separate']?.matches;
    expect(summary.multiplyAdd === 'fused').toBe(fused === PROBE_COUNT);
    expect(summary.multiplyAdd === 'separate').toBe(
      fused !== PROBE_COUNT && separate === PROBE_COUNT,
    );
    expect(summary.atomicsExact).toBe(true);
    expect(summary.sentences.length).toBeGreaterThanOrEqual(10);
  });
});

describe('compareProbeRecords', () => {
  const result = (hash: string, source: string) => ({ hash, source, count: 1, expressions: {} });
  const make = (change: Partial<Record<OpClass, [string, string]>>): ProbeRecord => ({
    version: 1,
    stack: { gpu: 'g', os: 'o', webgpu: 'w', runtime: 'r' },
    probes: Object.fromEntries(
      OP_CLASSES.map((op) => [op, result(...(change[op] ?? ['h', 's']))]),
    ) as ProbeRecord['probes'],
  });

  it('names the classes whose bits changed and, separately, the probes that were edited', () => {
    expect(compareProbeRecords(make({}), make({}))).toEqual({ changed: [], probeEdited: [] });
    expect(compareProbeRecords(make({}), make({ pow: ['other', 's'], trig: ['x', 's'] }))).toEqual({
      changed: ['pow', 'trig'],
      probeEdited: [],
    });
    // A probe whose source changed proves nothing about the stack, whatever its hash.
    expect(
      compareProbeRecords(make({}), make({ fma: ['other', 'edited'], div: ['h', 't'] })),
    ).toEqual({
      changed: [],
      probeEdited: ['div', 'fma'],
    });
  });
});
