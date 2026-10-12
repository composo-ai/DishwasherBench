// One small wash (a mug and a plate, the labelled stand-in exposure stages, the CPU tracer):
// what a result records about where it comes from, that the detergent and its dose do not
// recompute the exposure of an unchanged load, and the exposure summary per item and region.
import { describe, expect, it } from 'vitest';
import {
  computeExposureSet,
  createMemoryExposureCache,
  STAND_IN_EXPOSURE_STAGES,
  wash,
  washInputFromDescription,
  type ExposureCache,
  type WashInput,
  type WashResult,
} from './index.ts';

const input: WashInput = washInputFromDescription({
  programme: 'eco_50',
  tier: 'fast',
  items: [
    {
      id: 'mug',
      type: 'mug_ceramic_300',
      frame: 'upper_rack',
      position_mm: [250, 250, 2],
      orientation: 'inverted',
      soils: [{ type: 'tea_tannin', regions: ['interior'], amount_g: 0.3 }],
    },
    {
      id: 'plate',
      type: 'dessert_plate_porcelain_190',
      position_mm: [0, 100, 160],
      quat_wxyz: [0.7071, 0.7071, 0, 0],
      soils: [{ type: 'egg_yolk_dried', regions: ['well'], amount_g: 1 }],
    },
  ],
});
const SOURCE = 'f'.repeat(64);
const memory = createMemoryExposureCache();
/** A cache that names the code its sets belong to, as the one on disk does. */
const cache: ExposureCache = {
  get: (key) => memory.get(key),
  put: (key, bytes) => memory.put(key, bytes),
  source: SOURCE,
};
const options = {
  cache,
  gpu: null,
  exposure: {
    id: 'stand-in',
    stage: (stage: Parameters<typeof computeExposureSet>[0]) =>
      computeExposureSet(stage, STAND_IN_EXPOSURE_STAGES),
  },
} as const;

describe('a wash and where its result comes from', () => {
  let first: WashResult;
  let dosed: WashResult;

  it('records the parameter sets, the detergent and the fingerprints of the source', async () => {
    first = await wash(input, { ...options, sourceFingerprint: 'a'.repeat(64) });
    expect(first.run.exposureComputed).toBeGreaterThan(0);
    expect(first.provenance.paramSets).toEqual([]);
    expect(first.provenance.detergent).toEqual({
      name: 'machine default',
      dose_g: input.machine.dosing.detergentMass * 1000,
    });
    expect(first.provenance.exposureSource).toBe(SOURCE);
    expect(first.provenance.sourceFingerprint).toBe('a'.repeat(64));
    expect(first.machine.detergent.dosed_g).toBeCloseTo(first.provenance.detergent.dose_g, 6);
  }, 120_000);

  it('takes another detergent and dose without computing the exposure again', async () => {
    const record = {
      name: 'capsule',
      role: 'detergent' as const,
      origin: 'manual',
      overridesHash: 'sha256:x',
      keys: 1,
      stale: false,
      scaled: [],
    };
    dosed = await wash(
      {
        ...input,
        detergent: { name: 'Capsule', dose: 0.0129 },
        params: { 'liq.xSilicate': 0 },
        paramSets: [record],
      },
      options,
    );
    // Same geometry, same spray states, same hydro parameters: every set from the cache.
    expect(dosed.run.exposureComputed).toBe(0);
    expect(dosed.run.exposureCacheHits).toBe(first.run.exposureComputed);
    expect(dosed.machine.states.map((s) => s.exposureKey)).toEqual(
      first.machine.states.map((s) => s.exposureKey),
    );
    expect(dosed.provenance.detergent).toEqual({ name: 'Capsule', dose_g: 12.9 });
    expect(dosed.provenance.paramSets).toEqual([record]);
    expect(dosed.machine.detergent.dosed_g).toBeCloseTo(12.9, 6);
    expect(dosed.provenance.hydroHash).toBe(first.provenance.hydroHash);
    expect(dosed.provenance.soilHash).not.toBe(first.provenance.soilHash);
    expect(dosed.provenance.inputHash).not.toBe(first.provenance.inputHash);
    expect(dosed.provenance.resultHash).not.toBe(first.provenance.resultHash);
    expect(() => wash({ ...input, detergent: { name: 'x', dose: -1 } }, options)).rejects.toThrow(
      /dose/,
    );
  }, 120_000);

  it('keeps the fingerprints of the source out of the result hash', async () => {
    const again = await wash(input, { ...options, sourceFingerprint: 'b'.repeat(64) });
    expect(again.provenance.sourceFingerprint).toBe('b'.repeat(64));
    expect(again.provenance.resultHash).toBe(first.provenance.resultHash);
  }, 120_000);

  it('gives one result hash with a cache and without, when both name the sources of the exposure', async () => {
    // Review of the measurement, 2026-10-11: the exposure keys, which the result hash covers,
    // held the fingerprint of the exposure sources only when a cache was configured, so a
    // second wash without a cache (`bench verify --rewash`) always had another result hash.
    const { cache: _cache, ...bare } = options;
    const uncached = await wash(input, { ...bare, exposureSource: SOURCE });
    expect(uncached.run.exposureCacheHits).toBe(0);
    expect(uncached.provenance.exposureSource).toBe(SOURCE);
    expect(uncached.machine.states.map((s) => s.exposureKey)).toEqual(
      first.machine.states.map((s) => s.exposureKey),
    );
    expect(uncached.provenance.resultHash).toBe(first.provenance.resultHash);
    // Unnamed, the sources are not in the keys: what the wash-runner no longer does.
    const unnamed = await wash(input, bare);
    expect(unnamed.provenance.resultHash).not.toBe(first.provenance.resultHash);
    // A cache's own source wins over the option.
    const both = await wash(input, { ...options, exposureSource: 'c'.repeat(64) });
    expect(both.provenance.exposureSource).toBe(SOURCE);
    expect(both.provenance.resultHash).toBe(first.provenance.resultHash);
  }, 240_000);

  it('summarises the exposure of every region of every item, per spray state and over the programme', () => {
    expect(first.items.map((item) => item.itemId)).toEqual(['mug', 'plate']);
    for (const item of first.items) {
      expect(item.exposure.regions.map((r) => r.regionId)).toEqual(item.regionIds);
      let area = 0;
      for (const region of item.exposure.regions) {
        area += region.areaMm2;
        expect(region.states).toHaveLength(first.machine.states.length);
        for (const share of [
          region.jetShare,
          region.jetFilmShare,
          region.jetArea,
          region.wetTime,
          region.dryArea,
          region.neverWetArea,
          region.pooledArea,
        ]) {
          expect(share).toBeGreaterThanOrEqual(0);
          expect(share).toBeLessThanOrEqual(1 + 1e-9);
        }
        // Over the programme: every state by the time it is active.
        const sprayed = first.machine.states.reduce((sum, s) => sum + s.duration_s, 0);
        let wet = 0;
        region.states.forEach((state, k) => {
          wet += state.wetTime * (first.machine.states[k]?.duration_s ?? 0);
        });
        expect(region.wetTime).toBeCloseTo(wet / sprayed, 9);
        // A face that is never wet in any state is dry in each of them.
        for (const state of region.states) {
          expect(state.dryArea).toBeGreaterThanOrEqual(region.neverWetArea - 1e-9);
        }
        expect(region.retained_g).toBeGreaterThanOrEqual(0);
      }
      expect(area).toBeGreaterThan(10_000);
      // The film the item keeps is that of its regions (blocks outside every region aside).
      const retained = item.exposure.regions.reduce((sum, r) => sum + r.retained_g, 0);
      expect(retained).toBeLessThanOrEqual(item.water.film_g + item.water.puddle_mL + 1e-6);
    }
    // Something is wetted, and something is under a jet.
    const all = first.items.flatMap((item) => item.exposure.regions);
    expect(Math.max(...all.map((r) => r.wetTime))).toBeGreaterThan(0.5);
    expect(Math.max(...all.map((r) => r.jetShare))).toBeGreaterThan(0);
  });
});
