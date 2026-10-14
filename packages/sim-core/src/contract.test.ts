// Contract tests of module M12: the enumerations and thresholds of the orchestrator against
// what docs/design/sim-core.md states, the cache key input as canonical JSON, and the array
// shapes of the result contract of section 5.6.
import { canonicalHash, POSE_IDENTITY } from '@spotless/core';
import { describe, expect, it } from 'vitest';
import {
  EXPOSURE_SCHEMA,
  EXTENSION_REVOLUTIONS_PER_RUN,
  INFRASTRUCTURE_FAILURES,
  QUALITY_FLAGS,
  RESERVE_POLICIES,
  RESERVE_POLICY_LIMITS_S,
  SPECK_SIZE_CLASSES,
  STAGE_IDS,
  type ContractExposureKeyInput,
  type ContractItemWashResult,
  type ContractProgress,
  type ReservePolicy,
  type ContractWashResult,
} from './index.ts';

/** Section 7.3: the policy for a predicted base time. */
function policyFor(predicted_s: number): ReservePolicy {
  if (predicted_s <= RESERVE_POLICY_LIMITS_S.A) return 'A';
  if (predicted_s <= RESERVE_POLICY_LIMITS_S.B) return 'B';
  return 'C';
}

describe('orchestrator enumerations (sections M12 and 7.3)', () => {
  it('lists the quality flags of the failure classes', () => {
    // "Quality flags (`hydroUnconverged`, `unsettled`, `exposureApproximate`,
    // `wetAssumptionMismatch`, `wettingDrift`, `handoverClipped`, `supplyLimitedArea`,
    // `cflRaises`) do not fail a run"
    const sentence =
      '`hydroUnconverged`, `unsettled`, `exposureApproximate`, `wetAssumptionMismatch`, ' +
      '`wettingDrift`, `handoverClipped`, `supplyLimitedArea`, `cflRaises`';
    expect([...QUALITY_FLAGS]).toEqual(sentence.replaceAll('`', '').split(', '));
  });

  it('lists the six infrastructure failures', () => {
    // "Infrastructure failure (non-finite count, saturation count, ledger violation above its
    // fail threshold, buffer exhaustion, leak fraction, device loss that cannot be resumed)"
    expect(INFRASTRUCTURE_FAILURES).toHaveLength(6);
    expect([...INFRASTRUCTURE_FAILURES]).toEqual([
      'nonFinite',
      'saturation',
      'ledger',
      'bufferExhaustion',
      'leakFraction',
      'deviceLoss',
    ]);
  });

  it('chooses the reserve policies the contract quotes for its two loads', () => {
    // Section 7.3: policy A up to 17 minutes, B from 17 to 20.5, C above. The typical load
    // (14.8 minutes) runs under policy A, the design load (22.0 minutes) under policy C.
    expect(RESERVE_POLICIES).toEqual(['A', 'B', 'C']);
    expect(policyFor(14.8 * 60)).toBe('A');
    expect(policyFor(17 * 60)).toBe('A');
    expect(policyFor(19 * 60)).toBe('B');
    expect(policyFor(22.0 * 60)).toBe('C');
    // "A run may spend 4 in total", at most 2 per state.
    expect(EXTENSION_REVOLUTIONS_PER_RUN).toBe(4);
  });

  it('reports progress by stage letter', () => {
    const progress: ContractProgress = { stage: 'G', fraction: 0.4 };
    expect(STAGE_IDS).toContain(progress.stage);
    expect(STAGE_IDS.join('')).toBe('ABCDEFGHIJ');
  });
});

describe('cache key of an exposure set (section M12; determinism rule 14)', () => {
  const key: ContractExposureKeyInput = {
    stack: {
      sim: '0.1.0',
      gpu: 'apple m3 pro',
      os: 'macOS 27.0.1 (26A434)',
      webgpu: '0.6.2',
      runtime: 'node 20.19.0',
      physics: 'jolt 5.3.0',
    },
    simVersion: '0.1.0',
    exposureSchema: EXPOSURE_SCHEMA,
    tier: 'official',
    variant: 'S-split',
    hydroHash: 'sha256:aa',
    machineHash: 'sha256:bb',
    point: {
      combo: { diverter: 'L', pumpClass: 3000, liquor: 'D', arms: [{ kind: 'free' }] },
      pumpRpm: 3000,
      nozzleFlows_m3_s: [5.1e-5, 5.1e-5],
    },
    liquor: { cls: 'D', T_K: 328.15, rho: 985.7, mu: 5.04e-4, sigma: 0.04, gammaW: 0.0671 },
    geometryHash: 'sha256:cc',
    wettingHash: 'sha256:dd',
    levelSeed: 7,
    simSeed: 11,
  };

  it('changes with every member the contract lists, and with nothing else', () => {
    const base = canonicalHash(key);
    const variants: ContractExposureKeyInput[] = [
      { ...key, stack: { ...key.stack, os: 'macOS 27.0.2 (26B100)' } },
      { ...key, simVersion: '0.1.1' },
      { ...key, exposureSchema: 2 },
      { ...key, tier: 'fast' },
      { ...key, variant: 'K-only' },
      { ...key, hydroHash: 'sha256:ab' },
      { ...key, machineHash: 'sha256:bc' },
      {
        ...key,
        point: {
          ...key.point,
          combo: { ...key.point.combo, arms: [{ kind: 'stalled', angleQ: 3 }] },
        },
      },
      { ...key, point: { ...key.point, pumpRpm: 2700 } },
      { ...key, point: { ...key.point, nozzleFlows_m3_s: [5.1e-5, 5.2e-5] } },
      { ...key, liquor: { ...key.liquor, T_K: 308.15 } },
      { ...key, geometryHash: 'sha256:cd' },
      { ...key, wettingHash: 'sha256:de' },
      { ...key, levelSeed: 8 },
      { ...key, simSeed: 12 },
    ];
    const hashes = variants.map((v) => canonicalHash(v));
    expect(new Set([base, ...hashes]).size).toBe(variants.length + 1);
    // The same members written in another order give the same key.
    const reordered = Object.fromEntries(Object.entries(key).reverse());
    expect(canonicalHash(reordered)).toBe(base);
    // Soil, liquor and timeline parameters are not in the key: there is no member for them.
    expect(Object.keys(key)).not.toContain('soilHash');
  });
});

describe('result contract (section 5.6)', () => {
  const nE = 3;
  const nD = 2;
  const soilClasses = ['protein', 'starch'];
  const item: ContractItemWashResult = {
    itemId: 'plate_03',
    regionIds: ['well', 'rim'],
    elements: {
      count: nE,
      region: new Uint16Array([0, 0, 0xffff]),
      part: new Uint16Array(nE),
      side: new Uint8Array([1, 1, 2]),
      centre: new Float32Array(nE * 3),
      normal: new Float32Array(nE * 3),
      param: new Float32Array(nE * 2),
      areaMm2: new Float32Array(nE).fill(1),
      cover: new Float32Array(nE),
      residual_mg_cm2: new Float32Array(nE * soilClasses.length),
      fatFilm_um: new Float32Array(nE),
      stain: new Float32Array(nE),
      particles_per_cm2: new Float32Array(nE),
      neighbours: { offsets: new Uint32Array([0, 1, 2, 2]), indices: new Uint32Array([1, 0]) },
    },
    deposits: {
      count: nD,
      region: new Uint16Array(nD),
      part: new Uint16Array(nD),
      side: new Uint8Array(nD),
      centre: new Float32Array(nD * 3),
      normal: new Float32Array(nD * 3),
      param: new Float32Array(nD * 2),
      areaMm2: new Float32Array(nD).fill(4),
      speckIntensity_per_mm2: new Float32Array(nD * SPECK_SIZE_CLASSES.length),
      residue_mg_cm2: new Float32Array(nD),
      fatDeposit_mg_cm2: new Float32Array(nD),
      pigment: new Float32Array(nD),
      belowFloorTotals: {
        specks: new Float32Array(SPECK_SIZE_CLASSES.length),
        residue_mg: 0,
        fat_mg: 0,
      },
    },
    water: {
      pooled_mL: 1.21,
      pools: [{ volume_mL: 1.21, dirty: true, dissolvedSoil_mg: 0.4, settled_mg: 0.1 }],
      film_g: 0.3,
      beads_g: 0.1,
      edgeDrops: 1,
      bridges: 0,
      gaps_mL: 0,
      afterDrying_g: 0.05,
    },
    motion: {
      moved: false,
      unsettled: false,
      maxDisplacement_mm: 0,
      events: [],
      finalPose: POSE_IDENTITY,
    },
    flags: {
      hydroUnconverged: false,
      exposureApproximate: false,
      sparseWetting: false,
      wetAssumptionMismatch: 0.02,
      wettingDrift: { angle: 0, viscosity: 0.25 },
      handoverClipped: 0.01,
      supplyLimitedArea: 0,
    },
    confidence: { mcSplitHalf: 0.03, revSpread: 0.02, epsWet: 0.01 },
  };

  it('gives every array the shape the contract states', () => {
    const e = item.elements;
    // [N_e], [N_e x 3], [N_e x 2], [N_e x C_s], [N_e + 1].
    for (const a of [
      e.region,
      e.part,
      e.side,
      e.areaMm2,
      e.cover,
      e.fatFilm_um,
      e.stain,
      e.particles_per_cm2,
    ]) {
      expect(a).toHaveLength(e.count);
    }
    expect(e.centre).toHaveLength(3 * e.count);
    expect(e.normal).toHaveLength(3 * e.count);
    expect(e.param).toHaveLength(2 * e.count);
    expect(e.residual_mg_cm2).toHaveLength(e.count * soilClasses.length);
    expect(e.neighbours.offsets).toHaveLength(e.count + 1);
    expect(e.neighbours.offsets[e.count]).toBe(e.neighbours.indices.length);
    const d = item.deposits;
    // [N_d], [N_d x 3], [N_d x 2], [N_d x C_p] with C_p = 2 (fines, grit).
    expect(SPECK_SIZE_CLASSES).toEqual(['fines', 'grit']);
    expect(d.speckIntensity_per_mm2).toHaveLength(d.count * 2);
    expect(d.belowFloorTotals.specks).toHaveLength(2);
    expect(d.centre).toHaveLength(3 * d.count);
  });

  it('carries the units the field names state', () => {
    // A 1 mm soil cell is 1 mm2 and a 2 mm block 4 mm2 (section 0); the pool of a mug base
    // recess tilted by 7 degrees holds 1.21 mL (M3 tests).
    expect(item.elements.areaMm2[0]).toBe(1);
    expect(item.deposits.areaMm2[0]).toBe(4);
    expect(item.water.pooled_mL).toBeCloseTo(
      item.water.pools.reduce((sum, p) => sum + p.volume_mL, 0),
      12,
    );
    // Standards 10.2 (section 1.3): at most 1 mL of retained water.
    expect(item.water.pooled_mL).toBeGreaterThan(1);
  });

  it('lists items and soil classes in a result', () => {
    const result: ContractWashResult = {
      provenance: {
        stack: { sim: '0.1.0', gpu: 'g', os: 'o', webgpu: 'w', runtime: 'r', physics: 'p' },
        simVersion: '0.1.0',
        tier: 'official',
        variant: 'S-split',
        hydroHash: 'h',
        soilHash: 's',
        inputHash: 'i',
        levelSeed: 7,
        simSeed: 11,
        exposureSchema: EXPOSURE_SCHEMA,
        shaderHashes: { s_stage1: 'sha256:00' },
        reportHash: 'sha256:11',
      },
      soilClasses,
      items: [item],
      machine: {
        arms: [{ arm: 0, stalled: false, knocking: false }],
        starvation_s: 0,
        filterLoad_kg: 0.002,
        energy_kWh: 1.05,
        water_L: 13,
        carryOver_L: [0.4, 0.4, 0.4, 0.4],
        temperatures: new Float32Array(3430),
        dispenser: 'free',
        detergentReleased: 1,
      },
    };
    // The sizing programme of the contract takes in 3.4 + 3.6 + 3.0 + 3.0 = 13 L in four fills (M4) and has about 3,430
    // ticks; carry-over per drain is 0.3 to 0.5 L (section 8.1).
    expect(result.machine.water_L).toBeCloseTo(3.4 + 3.6 + 3.0 + 3.0, 10);
    expect(result.machine.temperatures).toHaveLength(3430);
    for (const litres of result.machine.carryOver_L) {
      expect(litres).toBeGreaterThanOrEqual(0.3);
      expect(litres).toBeLessThanOrEqual(0.5);
    }
    expect(result.provenance.exposureSchema).toBe(1);
    expect('diagnostics' in result).toBe(false);
  });
});
