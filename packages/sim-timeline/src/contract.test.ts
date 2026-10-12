// Contract tests of module M10: the tick constants against the tick counts the contract quotes
// for AUTO-145, the records the timeline owns, and the shapes of its results.
import { describe, expect, it } from 'vitest';
import {
  CHECKPOINT_TICKS,
  EFFECTIVE_EXPOSURE_LAYOUT,
  layoutProblems,
  MONITOR_TICKS,
  RELEASE_CLASSES,
  RESERVOIR_LIQUOR_LAYOUT,
  TICK_DRYING_S,
  TICK_PUMP_OFF_S,
  TIMELINE_BLOCK_LAYOUT,
  type ContractExposureSet,
  type GapState,
  type LiquorState,
  type PoolState,
  type TimelineFlags,
} from './index.ts';

describe('ticks of the replay (sections 0, 5.5 and M4)', () => {
  it('reproduces the tick budget of AUTO-145 from the tick lengths', () => {
    // M4: "Ticks: about 2,880 circulating, 270 with the pump off, 280 in drying; 3,430 in all",
    // for a programme of 145 minutes whose drying step P6 lasts 47 minutes.
    expect(2880 + 270 + 280).toBe(3430);
    const dryingMinutes = (280 * TICK_DRYING_S) / 60;
    expect(Math.abs(dryingMinutes - 47)).toBeLessThan(1);
    const offSeconds = 270 * TICK_PUMP_OFF_S;
    // What remains is circulation at one tick per master revolution: the mean tick must lie
    // between the fastest master period (35 rpm, 1.71 s) and the slowest the contract plans
    // for (1,216 base steps of 2 ms, 2.43 s).
    const circulatingTick = (145 * 60 - offSeconds - 280 * TICK_DRYING_S) / 2880;
    expect(circulatingTick).toBeGreaterThan(60 / 35);
    expect(circulatingTick).toBeLessThan(1216 * 2e-3);
  });

  it('checkpoints every 512 ticks and monitors every 64', () => {
    // Section 2.1 stage J: "checkpoints at stage boundaries and every 512 ticks"; section 5.5:
    // "every 64 ticks: drift monitors; rigid-body triggers ...; checkpoint test".
    expect(CHECKPOINT_TICKS).toBe(512);
    expect(MONITOR_TICKS).toBe(64);
    expect(CHECKPOINT_TICKS % MONITOR_TICKS).toBe(0);
    expect(Math.floor(3430 / CHECKPOINT_TICKS)).toBe(6);
  });
});

describe('records of the timeline', () => {
  it('re-exports the three layouts it owns, which the soil package declares', () => {
    // M10: "`TimelineBlock`, 64 bytes"; "`EffectiveExposure`, 40 bytes per film cell and tick";
    // "`ReservoirLiquor`, 32 bytes per basin and gap". Section 3.8 lists the first two with the
    // same sizes for stage H.
    const owned = [
      [TIMELINE_BLOCK_LAYOUT, 64],
      [EFFECTIVE_EXPOSURE_LAYOUT, 40],
      [RESERVOIR_LIQUOR_LAYOUT, 32],
    ] as const;
    for (const [layout, bytes] of owned) {
      expect(layout.owner).toBe('M10');
      expect(layout.byteSize).toBe(bytes);
      expect(layoutProblems(layout)).toEqual([]);
    }
  });

  it('accepts an exposure set of the main-wash class and one of a rinse class', () => {
    const buffer = {} as GPUBuffer;
    const mainWash: ContractExposureSet = {
      key: 'sha256:00',
      combo: { diverter: 'L', pumpClass: 3000, liquor: 'D', arms: [{ kind: 'free' }] },
      epoch: 0,
      liquor: { cls: 'D', T_K: 328.15, rho: 985.7, mu: 5.04e-4, sigma: 0.04, gammaW: 0.0671 },
      grid: 'classD',
      jet: [20, 45, 65].map((celsius) => ({
        nu_m2_s: celsius === 20 ? 1.004e-6 : celsius === 45 ? 0.602e-6 : 0.442e-6,
        records: buffer,
        tiles: buffer,
      })),
      film: { steady: buffer, transient: buffer },
      drain: buffer,
      onset: buffer,
      jetWet: [buffer],
      summary: {
        vAir_m3: 0.2e-3,
        vFilm_m3: 0.6e-3,
        returnToSump_kg_s: 0.5,
        basinInflow_kg_s: new Float32Array(0),
        basinInflowJetShare: new Float32Array(0),
        dripRate_kg_s: new Float32Array(0),
        epsGamma: 0.03,
        epsWet: 0.01,
        epsMass: 5e-4,
        perItemEpsWet: new Float32Array(0),
        converged: true,
        extensionRevolutions: 0,
        cflRaises: 0,
        frontHeldShare: 0,
        wetAssumptionMismatch: new Float32Array(0),
        handoverClipped: new Float32Array(0),
      },
      loads: { phaseBins: 256, force: new Float32Array(0), torque: new Float32Array(0) },
      approximate: false,
    };
    // Section 5.1: JetExposure at three viscosity points; the replay interpolates in ln(nu),
    // so the points must be ordered.
    expect(mainWash.jet).toHaveLength(3);
    const nus = mainWash.jet.map((j) => j.nu_m2_s);
    expect([...nus].sort((a, b) => b - a)).toEqual(nus);
    // M7.7 monitors: targets 5 %, 2 % and 0.1 %.
    expect(mainWash.summary.epsGamma).toBeLessThan(0.05);
    expect(mainWash.summary.epsWet).toBeLessThan(0.02);
    expect(mainWash.summary.epsMass).toBeLessThan(1e-3);

    // "no transient outside the main-wash class": the member is optional.
    const { transient: _transient, ...steadyOnly } = mainWash.film;
    const rinse: ContractExposureSet = {
      ...mainWash,
      combo: { ...mainWash.combo, pumpClass: 2700, liquor: 'R' },
      grid: 'block',
      film: steadyOnly,
    };
    expect('transient' in rinse.film).toBe(false);
  });

  it('accepts pool and gap states with their own liquor and soil by release class', () => {
    const liquor = { V_m3: 0.3e-3, T_K: 320, pH: 9.8, cls: 'D' } as LiquorState;
    const pool: PoolState = {
      basin: 2,
      volume_m3: 0.3e-3,
      level_m: 0.03,
      liquor,
      settled_kg: [1e-6, 2e-6],
      dissolvedSoil_kg: RELEASE_CLASSES.map(() => 0),
    };
    const gap: GapState = {
      gap: 0,
      filled: true,
      liquor,
      dissolvedSoil_kg: RELEASE_CLASSES.map(() => 0),
    };
    // C_p = 2 speck size classes (fines, grit; section 5.6); 8 release classes.
    expect(pool.settled_kg).toHaveLength(2);
    expect(pool.dissolvedSoil_kg).toHaveLength(8);
    expect(gap.dissolvedSoil_kg).toHaveLength(8);
    const flags: TimelineFlags = {
      wettingDrift: new Float32Array(3 * 2),
      primeLossTicks: 0,
      classApproximationTicks: 0,
    };
    // "wettingDrift: Float32Array /* [item][2] */"
    expect(flags.wettingDrift.length % 2).toBe(0);
  });
});
