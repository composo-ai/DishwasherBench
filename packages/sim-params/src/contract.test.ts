// Contract tests of module M2: the enumerations and shared records of this package against what
// docs/design/sim-core.md states, each expectation transcribed here independently of the source.
import { canonicalJson } from '@spotless/core';
import { describe, expect, it } from 'vitest';
import {
  BRACKET_GROUPS,
  CLOSURE_TABLE_IDS,
  LIQUOR_CLASS_IDS,
  PARAM_GROUPS,
  PARAM_TAGS,
  PHASE_EVENT_KINDS,
  RELEASE_CLASS_COUNT,
  RELEASE_CLASSES,
  TICK_LABELS,
  TIER_IDS,
  TIER_VARIANTS,
  type ArmState,
  type ComboId,
  type MachineTick,
  type ParamDef,
  type PhaseEvent,
  type TierParams,
} from './index.ts';

/** `dissolved protein` -> `dissolvedProtein`. */
function camel(phrase: string): string {
  return phrase
    .split(' ')
    .map((word, i) => (i === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join('');
}

describe('enumerations of section M2', () => {
  it('lists the confidence tags, hash groups and bracket groups of ParamDef', () => {
    // Section M2, `ParamDef`.
    expect(PARAM_TAGS).toEqual(['VERIFIED', 'RECALLED', 'ESTIMATED', 'SYN', 'MEASURED']);
    expect(PARAM_GROUPS).toEqual(['hydro', 'soil']);
    expect(BRACKET_GROUPS).toEqual(['G1', 'G2', 'G3', 'G4', 'S']);
  });

  it('lists the seven closure tables with analytic defaults', () => {
    // Section M2: "Table ids with analytic defaults: ...".
    const sentence =
      '`wire.split`, `rim.split`, `sweep.correction`, `vessel.interior`, `splatter.fraction`, ' +
      '`splash.massRatio`, `slot.footprint`';
    expect([...CLOSURE_TABLE_IDS]).toEqual(sentence.replaceAll('`', '').split(', '));
  });

  it('lists the tiers in the column order of section 7.5 and the variants of section 7.4', () => {
    expect(TIER_IDS).toEqual(['official', 'fast', 'preview', 'reference']);
    expect([...TIER_VARIANTS].sort()).toEqual(['K-only', 'S-all', 'S-mainwash', 'S-split']);
  });

  it('accepts the official column of section 7.5 as a TierParams', () => {
    // A compile-time check of the shape, with the numbers of the table; the relations below are
    // the ones the contract states between tiers.
    const official: TierParams = {
      id: 'official',
      variant: 'S-split',
      block_m: 2e-3,
      s1FilmCellD_m: 1e-3,
      soilCell_m: 1e-3,
      filmSolvers: 'S-on-S-class',
      armPhases: 16384,
      subRays: 19,
      parcelsMainWash: 3e8,
      parcelsOther: 1.5e8,
      settleRevolutions: 2,
      steadyRevolutions: 2,
      transientRecord: 'mainWash',
      mainWashSolveTemperatures: 1,
      maxLevel: 5,
      handoverCap_m_s: 2.2,
      drainDown: { kind: 'cascade', doublingSteps: 512 },
      pumpClassHalfWidth: 0.04,
      soilLayers: 12,
      tickEveryRevolutions: 1,
      pilot: { armPhases: 2048, subRays: 7, parcels: 1e7 },
      planningRates: {
        segmentQueries: 60e6,
        sStageUpdates: 0.6e9,
        sApply: 0.87e9,
        kBlockSteps: 0.79e9,
        statSamples: 0.38e9,
        r0Sweep: 1.65e9,
        gatherPairs: 0.2e9,
        soilCellTicks: 0.19e9,
        passW: 0.66e9,
        passT: 0.33e9,
        sustainedLoad: 0.9,
      },
    };
    // Section M7.7: 28 master revolutions per programme with three liquor classes (8 + 12 + 8):
    // two diverter states, settle + steady per state and class, 2 transient in the main wash.
    const perState = official.settleRevolutions + official.steadyRevolutions;
    expect(2 * perState * 3 + 2 * 2).toBe(28);
    // Section M5: the pilot uses every eighth phase of the official sequence.
    expect(official.armPhases / official.pilot.armPhases).toBe(8);
    // Section 7.1, rule 1: a memory-bound pass is planned at 0.6 x 110 GB/s over its bytes per
    // element (pass W 100 bytes, pass T 200 bytes; section M10 "Cost").
    expect(official.planningRates.passW).toBeCloseTo((0.6 * 110e9) / 100, -6);
    expect(official.planningRates.passT).toBeCloseTo((0.6 * 110e9) / 200, -6);
  });
});

describe('records shared across modules', () => {
  it('lists the eight release classes in the order of BlockRelease', () => {
    // Section M8: "8 release classes (dissolved protein, dissolved carbohydrate, other
    // dissolved, chromophore, fat, fines, grit, coarse; 8 x u32 in 10^-15 kg)".
    const prose =
      'dissolved protein, dissolved carbohydrate, other dissolved, chromophore, fat, fines, grit, coarse';
    expect([...RELEASE_CLASSES]).toEqual(prose.split(', ').map(camel));
    expect(RELEASE_CLASS_COUNT).toBe(8);
  });

  it('lists the liquor classes, tick labels and programme events', () => {
    // Section 0: W (water-like), D (main-wash liquor), R (rinse-aid rinse).
    expect(LIQUOR_CLASS_IDS).toEqual(['W', 'D', 'R']);
    // Section M4, `MachineTick.label`.
    expect(TICK_LABELS).toEqual(['transient', 'steady', 'off', 'drying']);
    // Section 5.5: "programme events of the tick: fill, drain, heater, dispenser (...), rinse
    // aid, diverter, pump speed".
    const prose = 'fill, drain, heater, dispenser, rinse aid, diverter, pump speed';
    expect(PHASE_EVENT_KINDS.slice(0, 7)).toEqual(prose.split(', ').map(camel));
    // contract-issues.md R11: the events of the machine package's programme timeline that
    // section 5.5 omits (`prestore_fill`, `regeneration`, `door_open`) have counterparts.
    const machine = 'prestore_fill, regeneration, door_open';
    const camelSnake = (id: string): string => camel(id.replaceAll('_', ' '));
    expect(PHASE_EVENT_KINDS.slice(7)).toEqual(machine.split(', ').map(camelSnake));
  });

  it('keeps the six time-marched combos of the sizing programme and their arm states apart as keys', () => {
    // Section M4: "(L, 2700, W), (U, 2700, W), (L, 3000, D), (U, 3000, D), (L, 2700, R),
    // (U, 2700, R)", with free arms. The arm state is part of ComboId and of every cache key.
    const free: ArmState = { kind: 'free' };
    const combos: ComboId[] = (
      [
        ['L', 2700, 'W'],
        ['U', 2700, 'W'],
        ['L', 3000, 'D'],
        ['U', 3000, 'D'],
        ['L', 2700, 'R'],
        ['U', 2700, 'R'],
      ] as const
    ).map(([diverter, pumpClass, liquor]) => ({
      diverter,
      pumpClass,
      liquor,
      arms: diverter === 'L' ? [free] : [free, free],
    }));
    const keys = new Set(combos.map((c) => canonicalJson(c)));
    expect(keys.size).toBe(6);

    const lower = combos[2] as ComboId;
    const stalled: ComboId = { ...lower, arms: [{ kind: 'stalled', angleQ: 37 }] };
    const knocking: ComboId = { ...lower, arms: [{ kind: 'knocking', profile: 'sha256:ab' }] };
    for (const other of [stalled, knocking]) {
      expect(keys.has(canonicalJson(other))).toBe(false);
    }
    expect(canonicalJson(stalled)).not.toBe(canonicalJson(knocking));
  });

  it('accepts a circulating tick and a drying tick as MachineTick', () => {
    const fill: PhaseEvent = { kind: 'fill', volume_m3: 3.6e-3, fill: 1 };
    // A fill partly from the pre-store tank at 35 C (R11); the optional members type-check.
    const warm: PhaseEvent = { ...fill, fromPrestore_m3: 2.0e-3, temperature_K: 308.15 };
    expect(warm.kind === 'fill' && (warm.fromPrestore_m3 ?? 0) <= warm.volume_m3).toBe(true);
    const circulating: MachineTick = {
      index: 412,
      combo: { diverter: 'L', pumpClass: 3000, liquor: 'D', arms: [{ kind: 'free' }] },
      label: 'steady',
      dt_s: 60 / 35,
      pumpRpm: 3000,
      sV: 1,
      sQ: 1,
      fH: 1,
      heaterOn: true,
      step: 'P2',
      events: [fill],
    };
    const drying: MachineTick = {
      ...circulating,
      index: 3200,
      combo: null,
      label: 'drying',
      dt_s: 10,
      pumpRpm: 0,
      heaterOn: false,
      step: 'P6',
      events: [],
    };
    // Section 0, "tick": one master-arm revolution, or 10 s in drying. At 35 rpm that is 1.71 s.
    expect(circulating.dt_s).toBeCloseTo(1.714, 3);
    expect(drying.dt_s).toBe(10);
    expect(drying.combo).toBeNull();
  });

  it('accepts a registry entry with a validity range as a ParamDef', () => {
    // Section M5 parameter table: `jets.cR`, 0.289, range 0.25 to 0.32, [VERIFIED], jets 4.5.
    const cR: ParamDef = {
      key: 'jets.cR',
      unit: '1',
      default: 0.289,
      min: 0.25,
      max: 0.32,
      tag: 'VERIFIED',
      source: 'sim-core M5; jets 4.5',
      validity: 'incidence 30 to 120 degrees, Re up to 53,100',
      group: 'hydro',
    };
    expect(cR.default).toBeGreaterThanOrEqual(cR.min);
    expect(cR.default).toBeLessThanOrEqual(cR.max);
    expect(PARAM_GROUPS).toContain(cR.group);
  });
});
