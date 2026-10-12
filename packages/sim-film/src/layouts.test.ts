// Contract tests of the binary records of module M7: each layout against the size, the offsets
// and the field list that docs/design/sim-core.md states (sections M7.8, 5.2 and 5.3),
// transcribed here independently of layouts.ts, and against the rules of layoutProblems.
import { STANDARD_GRAVITY } from '@spotless/core';
import { describe, expect, it } from 'vitest';
import {
  DRAIN_DOWN_LAYOUT,
  DRAIN_DOWN_TIMES_S,
  FILM_EXPOSURE_LAYOUT,
  FILM_STATS_COUNTER_BOUND,
  FILM_STATS_LAYOUT,
  FILM_TAU_LEVELS_PA,
  H_RES_LAYOUT,
  K_DEPOSIT_LAYOUT,
  K_HOT_LAYOUT,
  K_PARAMS_LAYOUT,
  layoutProblems,
  ONSET_LAYOUT,
  PHASE_BINS_PER_REV,
  REGIME_CODES,
  S_DEPOSIT_LAYOUT,
  S_FILM_LAYOUT,
  S_SLOW_LAYOUT,
  S_STATIC_LAYOUT,
  STEADY_WET_LAYOUT,
  TILE_MONITOR_LAYOUT,
  TILE_SIDE,
  type LayoutField,
  type RecordLayout,
  type SolvePlan,
} from './index.ts';

/** A named field, with its optional members visible (layouts are literal types). */
function fieldOf(layout: RecordLayout, name: string): LayoutField {
  const field = layout.fields.find((f) => f.name === name);
  if (!field) throw new Error(`${layout.name} has no field ${name}`);
  return field;
}

/** Offsets of the named fields. */
function offsets(layout: RecordLayout, names: readonly string[]): number[] {
  return names.map((name) => fieldOf(layout, name).offset);
}

/** The fields as `count x type`, in order. */
function shape(layout: RecordLayout): string[] {
  return layout.fields.map((f) => `${f.count ?? 1}x${f.type}`);
}

/** Bit sub-fields of a field as [name, lsb, width]. */
function bits(layout: RecordLayout, name: string): (string | number)[][] {
  return (fieldOf(layout, name).bits ?? []).map((b) => [b.name, b.lsb, b.width]);
}

// The size each record has in the contract, with the words that state it.
const CONTRACT_SIZES: readonly (readonly [RecordLayout, number, string])[] = [
  [S_SLOW_LAYOUT, 8, 'M7.8: "`SSlow` (per S film cell ...) | 8"'],
  [S_STATIC_LAYOUT, 8, 'M7.8: "`SStatic` (per S film cell ...) | 8"'],
  [K_PARAMS_LAYOUT, 32, 'M7.8: "`KParams` (per block ...) | 32"'],
  [FILM_STATS_LAYOUT, 80, 'M7.8: "`FilmStats` (per film cell, recorded revolutions) | 80"'],
  [TILE_MONITOR_LAYOUT, 16, 'M7.1 pass 7: "16 per tile"'],
  [FILM_EXPOSURE_LAYOUT, 32, '5.2: "FilmExposure: 32 bytes per film cell"'],
  [DRAIN_DOWN_LAYOUT, 8, '5.3: "DrainDown: 8 bytes per block"'],
  [ONSET_LAYOUT, 4, '5.1: "the onset-time field (f32 seconds per block)"'],
];

describe('record layouts of M7', () => {
  it.each(CONTRACT_SIZES)('%o has the size the contract states', (layout, bytes) => {
    expect(layout.byteSize).toBe(bytes);
    expect(layoutProblems(layout)).toEqual([]);
  });

  it('adds up with the memory table of section 3.8', () => {
    // "SFilm x 2, SStatic, SSlow | 48 per S cell"
    expect(2 * S_FILM_LAYOUT.byteSize + S_STATIC_LAYOUT.byteSize + S_SLOW_LAYOUT.byteSize).toBe(48);
  });

  it('adds up with the traffic the base-step table of M7.1 quotes', () => {
    // "Per S cell and base step that is 96 bytes outside the stage updates": the clear of the
    // accumulator, the reads of s_apply (current, SFilm, SSlow, SStatic) and its writes.
    const s =
      S_DEPOSIT_LAYOUT.byteSize +
      (S_DEPOSIT_LAYOUT.byteSize +
        S_FILM_LAYOUT.byteSize +
        S_SLOW_LAYOUT.byteSize +
        S_STATIC_LAYOUT.byteSize) +
      (S_FILM_LAYOUT.byteSize + S_SLOW_LAYOUT.byteSize);
    expect(s).toBe(96);
    // "Per K block and base step: 84 bytes including the clear": clear 8; reads KHot 16,
    // KParams 32, current 8, table bin 4; writes KHot 16.
    const k =
      K_DEPOSIT_LAYOUT.byteSize +
      (K_HOT_LAYOUT.byteSize + K_PARAMS_LAYOUT.byteSize + K_DEPOSIT_LAYOUT.byteSize + 4) +
      K_HOT_LAYOUT.byteSize;
    expect(k).toBe(84);
  });

  it('re-exports the layouts it owns that lower modules declare', () => {
    for (const layout of [
      S_FILM_LAYOUT,
      K_HOT_LAYOUT,
      S_DEPOSIT_LAYOUT,
      K_DEPOSIT_LAYOUT,
      STEADY_WET_LAYOUT,
      H_RES_LAYOUT,
    ]) {
      expect(layout.owner).toBe('M7');
    }
  });
});

describe('SStatic and KParams (section M7.8)', () => {
  it('stores the two angle terms in units of 2 / 65,535', () => {
    // "1 - cos(theta_a + xi) and 1 - cos(theta_r + xi) with the soil mix (2 x u16, unit
    // 2 / 65,535); gap u8; onset thickness delta_on (log u8, 1 um to 1 mm); gutter or link
    // element u16"
    expect(shape(S_STATIC_LAYOUT)).toEqual(['1xu16', '1xu16', '1xlog8', '1xlog8', '1xu16']);
    // 1 - cos spans 0 to 2: the largest code is exactly 2.
    expect(65535 * (fieldOf(S_STATIC_LAYOUT, 'oneMinusCosAdvancing').scale ?? 0)).toBeCloseTo(
      2,
      12,
    );
    expect(fieldOf(S_STATIC_LAYOUT, 'deltaOn').log).toEqual({ min: 1e-6, max: 1e-3 });
    // The onset masses the contract quotes (2 and 43 g/m2: 2 and 43 um of water) lie inside.
    for (const um of [2, 43]) {
      expect(um * 1e-6).toBeGreaterThan(1e-6);
      expect(um * 1e-6).toBeLessThan(1e-3);
    }
  });

  it('lists the fields of KParams in the order of the contract', () => {
    // "area f32; W f16; g_s f16; donor mask u8; flags u8 (chosen receiver, gutter, pit, drip
    // site); donor weights 8 x u8; Gamma*_a, Gamma*_r, m_on, b_max, delta_wet (5 x f16); t_dw in
    // base steps u16; spare u16"
    expect(shape(K_PARAMS_LAYOUT)).toEqual([
      '1xf32',
      '1xf16',
      '1xf16',
      '1xu8',
      '1xu8',
      '8xu8',
      '1xf16',
      '1xf16',
      '1xf16',
      '1xf16',
      '1xf16',
      '1xu16',
      '1xu16',
    ]);
    expect(bits(K_PARAMS_LAYOUT, 'flags').map((b) => b[0])).toEqual([
      'chosenReceiver',
      'gutter',
      'pit',
      'dripSite',
    ]);
    // "weights quantised so that the two weights of a donor sum to exactly 255" (section 3.7).
    expect(255 * (fieldOf(K_PARAMS_LAYOUT, 'donorWeight').scale ?? 0)).toBeCloseTo(1, 12);
  });

  it('keeps the reference thresholds of M7.3 clear of the subnormal range of half precision', () => {
    // Section 5.1: an f16 never holds a value below 6e-5. Reference values in wash liquor at
    // 55 C: Gamma* = 0.005 to 0.066 kg/(m s); m_on 2 g/m2 on glass; delta_wet and b_max of
    // tens of micrometres.
    const stored = (name: string, si: number): number =>
      si / (fieldOf(K_PARAMS_LAYOUT, name).scale ?? 1);
    expect(stored('gammaStarA', 0.005)).toBeCloseTo(5, 10);
    expect(stored('mOn', 2e-3)).toBeCloseTo(2, 10);
    expect(stored('deltaWet', 20e-6)).toBeCloseTo(20, 10);
    expect(stored('bMax', 5e-6)).toBeGreaterThan(1);
    expect(stored('W', 2e-3)).toBeCloseTo(2, 10);
  });
});

describe('FilmStats (section M7.8)', () => {
  it('places the rows of the table at the offsets the contract gives', () => {
    // Offset column: 0, 16, 28, 40, 44, 52, 60, 70, 76.
    expect(
      offsets(FILM_STATS_LAYOUT, [
        'sumGamma',
        'sumDep',
        'binGamma',
        'snapGamma',
        'peakGamma',
        'nFlow',
        'nTau',
        'dryRun',
        'spare',
      ]),
    ).toEqual([0, 16, 28, 40, 44, 52, 60, 70, 76]);
    // Type column: 4 x f32 | 3 x f32 | 3 x f32 | f32 | 4 x f16 | 4 x u16 | 5 x u16 | 3 x u16 | u32.
    expect(shape(FILM_STATS_LAYOUT).join(' ')).toBe(
      '1xf32 1xf32 1xf32 1xf32 1xf32 1xf32 1xf32 1xf32 1xf32 1xf32 1xf32 ' +
        '1xf16 1xf16 1xf16 1xf16 1xu16 1xu16 1xu16 1xu16 5xu16 1xu16 1xu16 1xu16 1xu32',
    );
  });

  it('gives the roles the contract states: sums are state, peaks and snapshots statistics', () => {
    const role = (name: string): string => fieldOf(FILM_STATS_LAYOUT, name).role;
    for (const name of [
      'sumGamma',
      'sumH',
      'sumTau',
      'sumM',
      'sumDep',
      'sumBead',
      'sumWidth',
      'binGamma',
      'binTau',
      'binM',
    ]) {
      expect(role(name), name).toBe('state');
      expect(fieldOf(FILM_STATS_LAYOUT, name).type, name).toBe('f32');
    }
    for (const name of [
      'snapGamma',
      'peakGamma',
      'peakTau',
      'peakM',
      'tauMaxSample',
      'dryMax',
      'snapWet',
    ]) {
      expect(role(name), name).toBe('statistic');
    }
    for (const name of ['nFlow', 'nWet', 'nImm', 'nBin', 'nTau', 'dryRun']) {
      expect(role(name), name).toBe('counter');
      expect(fieldOf(FILM_STATS_LAYOUT, name).bound, name).toBe(FILM_STATS_COUNTER_BOUND);
    }
  });

  it('bounds the sample counters as the contract computes the bound', () => {
    // "counters are u16 with the registered bound of 6 recorded revolutions x 1,216 steps / 2
    // = 3,648": two steady revolutions, up to two extensions per state twice, sampled every
    // `film.statStride` = 2 base steps.
    expect((6 * 1216) / 2).toBe(FILM_STATS_COUNTER_BOUND);
    expect(FILM_STATS_COUNTER_BOUND).toBeLessThan(65536);
    // 1,216 steps is a whole number of phase bins.
    expect(1216 % PHASE_BINS_PER_REV).toBe(0);
  });

  it('counts samples above the five film-shear levels', () => {
    // "nTau[5] | 5 x u16 | samples with film shear above 0.5, 1, 2, 4 and 10 Pa"
    expect([...FILM_TAU_LEVELS_PA]).toEqual([0.5, 1, 2, 4, 10]);
    expect(fieldOf(FILM_STATS_LAYOUT, 'nTau').count).toBe(FILM_TAU_LEVELS_PA.length);
  });
});

describe('FilmExposure (section 5.2)', () => {
  it('places every row of the table at the offset the contract gives', () => {
    const rows: readonly (readonly [number, string, string])[] = [
      [0, 'gammaMean', 'f16'],
      [2, 'gammaPeak', 'f16'],
      [4, 'hMean', 'f16'],
      [6, 'tauMean', 'f16'],
      [8, 'tauPeak', 'f16'],
      [10, 'depFlux', 'f16'],
      [12, 'renew', 'f16'],
      [14, 'mfMean', 'log8'],
      [15, 'mfPeak', 'log8'],
      [16, 'flowDuty', 'u8'],
      [17, 'wetDuty', 'u8'],
      [18, 'beadFrac', 'u8'],
      [19, 'widthFrac', 'u8'],
      [20, 'tauDuty', 'u8'],
      [24, 'dropDuty3', 'log8'],
      [25, 'dropDuty10', 'log8'],
      [26, 'immersed', 'u8'],
      [27, 'dryMax', 'u8'],
      [28, 'srcSplit', 'u8'],
      [29, 'spread', 'log8'],
      [30, 'flags', 'u8'],
      [31, 'tauDuty10', 'log8'],
    ];
    const layout: RecordLayout = FILM_EXPOSURE_LAYOUT;
    expect(layout.fields.map((f) => [f.offset, f.name, f.type])).toEqual(rows.map((r) => [...r]));
    expect(fieldOf(layout, 'tauDuty').count).toBe(4);
  });

  it('uses the scaled units and log ranges of the table', () => {
    const scale = (name: string): number | undefined => fieldOf(FILM_EXPOSURE_LAYOUT, name).scale;
    // g/(m s), um, g/(m2 s); Pa and 1/s unscaled; u8 / 255.
    expect([scale('gammaMean'), scale('gammaPeak'), scale('depFlux')]).toEqual([1e-3, 1e-3, 1e-3]);
    expect(scale('hMean')).toBe(1e-6);
    expect([scale('tauMean'), scale('tauPeak'), scale('renew')]).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    for (const name of [
      'flowDuty',
      'wetDuty',
      'beadFrac',
      'widthFrac',
      'tauDuty',
      'immersed',
      'dryMax',
    ]) {
      expect(255 * (scale(name) ?? 0), name).toBeCloseTo(1, 12);
    }
    const log = (name: string): unknown => fieldOf(FILM_EXPOSURE_LAYOUT, name).log;
    expect(log('mfMean')).toEqual({ min: 1e-4, max: 10 });
    expect(log('mfPeak')).toEqual({ min: 1e-4, max: 10 });
    expect(log('dropDuty3')).toEqual({ min: 1e-6, max: 1 });
    expect(log('dropDuty10')).toEqual({ min: 1e-6, max: 1 });
    expect(log('spread')).toEqual({ min: 1e-3, max: 10 });
    expect(log('tauDuty10')).toEqual({ min: 1e-4, max: 1 });
  });

  it('stores the reference film of the in-machine tile without leaving half precision', () => {
    // M8: the reference film is Gamma = 0.02 kg/(m s) at 55 C, "h = 147 um, tau = 1.42 Pa":
    // the Nusselt film of that loading on a vertical wall (water at 55 C: 985.7 kg/m3,
    // 5.04e-4 Pa s), h = (3 mu Gamma / (rho^2 g))^(1/3) and tau = rho g h.
    const [rho, mu, gamma] = [985.7, 5.04e-4, 0.02];
    const h = ((3 * mu * gamma) / (rho * rho * STANDARD_GRAVITY)) ** (1 / 3);
    const tau = rho * STANDARD_GRAVITY * h;
    const stored = (name: string, si: number): number =>
      si / (fieldOf(FILM_EXPOSURE_LAYOUT, name).scale ?? 1);
    // Stored: 20 g/(m s), 147 um, 1.42 Pa.
    expect(stored('gammaMean', gamma)).toBeCloseTo(20, 10);
    expect(Math.abs(stored('hMean', h) - 147)).toBeLessThan(0.5);
    expect(Math.abs(stored('tauMean', tau) - 1.42)).toBeLessThan(0.005);
    // The lowest flux the onset gate cares about, 6e-7 kg/(m2 s), is 6e-4 g/(m2 s): above the
    // smallest normal half (6.1e-5).
    expect(stored('depFlux', 6e-7)).toBeGreaterThan(6.1e-5);
  });

  it('packs the source split and the flags as the table lists them', () => {
    // "two bits each: share of arriving liquid from jet hand-over, airborne droplets, drips,
    // film inflow"
    expect(bits(FILM_EXPOSURE_LAYOUT, 'srcSplit')).toEqual([
      ['jetHandover', 0, 2],
      ['airborne', 2, 2],
      ['drips', 4, 2],
      ['filmInflow', 6, 2],
    ]);
    // "bits 0-1 regime at the end of the period; 2 receives jet hand-over in this state; 3 in a
    // pool; 4 stagnant gap; 5 gutter row or drip site; 6 sparse deposition; 7 S-solved"
    expect(bits(FILM_EXPOSURE_LAYOUT, 'flags').map((b) => [b[1], b[2]])).toEqual([
      [0, 2],
      [2, 1],
      [3, 1],
      [4, 1],
      [5, 1],
      [6, 1],
      [7, 1],
    ]);
    expect(Math.max(...Object.values(REGIME_CODES))).toBe(3);
  });

  it('has every field in the role of a packed output', () => {
    const layout: RecordLayout = FILM_EXPOSURE_LAYOUT;
    expect(new Set(layout.fields.map((f) => f.role))).toEqual(new Set(['statistic']));
  });
});

describe('DrainDown (section 5.3)', () => {
  it('places the rows of the table at the offsets the contract gives', () => {
    // "0 | h2, h10, h60 | 3 x f16 | um"; "6 | tDewet | log u8 | s"; "7 | endState | u8".
    expect(offsets(DRAIN_DOWN_LAYOUT, ['h2', 'h10', 'h60', 'tDewet', 'endState'])).toEqual([
      0, 2, 4, 6, 7,
    ]);
    expect([...DRAIN_DOWN_TIMES_S]).toEqual([2, 10, 60]);
    expect(fieldOf(DRAIN_DOWN_LAYOUT, 'h2').scale).toBe(1e-6);
    // "0.01 to 60 s; 255 = stays wet": the top code is the end of the 60 s drain-down.
    expect(fieldOf(DRAIN_DOWN_LAYOUT, 'tDewet').log).toEqual({ min: 0.01, max: 60 });
    expect(Math.max(...DRAIN_DOWN_TIMES_S)).toBe(60);
  });

  it('packs the end state as the table lists it', () => {
    // "bits 0-3 final bead load in sixteenths of b_max; 4 edge drop remains; 5 capillary
    // bridge; 6 in a pool; 7 received drips after the sources stopped"
    expect(bits(DRAIN_DOWN_LAYOUT, 'endState')).toEqual([
      ['beadLoad', 0, 4],
      ['edgeDrop', 4, 1],
      ['bridge', 5, 1],
      ['inPool', 6, 1],
      ['lateDrips', 7, 1],
    ]);
  });
});

describe('plans and monitors', () => {
  it('accepts the three plans of the driver of M7.7', () => {
    // "steady: ... 2 settle revolutions (discarded); 2 steady revolutions (recorded)";
    // "transient: ... 2 revolutions of the forcing of X (recorded)".
    const steady: SolvePlan = {
      revolutions: [
        { label: 'settle', count: 2 },
        { label: 'steady', count: 2 },
      ],
      grid: 'classD',
      maxLevel: 5,
    };
    const transient: SolvePlan = {
      revolutions: [{ label: 'transient', count: 2 }],
      grid: 'classD',
      maxLevel: 5,
    };
    const total = (p: SolvePlan): number => p.revolutions.reduce((sum, r) => sum + r.count, 0);
    // "28 master revolutions per programme with three liquor classes (8 + 12 + 8)": two
    // diverter states per class, transients in the main-wash class only.
    const perClass = 2 * total(steady);
    expect([perClass, perClass + 2 * total(transient), perClass]).toEqual([8, 12, 8]);
    // Section 7.2: the class-D solves take 11,520 base steps: 6 revolutions of each state at
    // 896 (lower arm, 35 rpm) and 1,024 (mid arm, 30 rpm) steps per revolution.
    const recordedD = total(steady) - 2 + total(transient);
    const stepsD = (total(steady) + total(transient)) * (896 + 1024);
    expect(stepsD).toBe(11520);
    // "28,928 base steps of which 16,384 are recorded": the rest are the two classes at the
    // lower pump speed, 4 revolutions per state each. That fixes the steps of one revolution
    // of both states there (a whole number of phase bins), and the recorded count then follows
    // from the plans: 4 of 6 revolutions in class D, 2 of 4 in classes W and R.
    const stepsPairWR = (28928 - stepsD) / (2 * total(steady));
    expect(stepsPairWR).toBe(1024 + 1152);
    expect(stepsPairWR % PHASE_BINS_PER_REV).toBe(0);
    expect(recordedD * (896 + 1024) + 2 * 2 * stepsPairWR).toBe(16384);
  });

  it('monitors tiles of 8 x 8 film cells with four words', () => {
    // "one invocation per 8 x 8 tile: largest wave rate, any-wet flag, non-finite word count,
    // parcel slot high-water mark ... 16 per tile"
    expect(TILE_SIDE).toBe(8);
    expect(TILE_MONITOR_LAYOUT.fields.map((f) => f.name)).toEqual([
      'waveRate',
      'anyWet',
      'nonFinite',
      'parcelHighWater',
    ]);
  });
});
