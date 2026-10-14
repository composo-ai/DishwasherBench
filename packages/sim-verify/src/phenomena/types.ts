/**
 * Types of the phenomena suite: the checklist of docs/research/standards.md section 9 (P01 to
 * P48) as executable A/B washes of the owner's machine.
 *
 * A {@link Scenario} is one entry of the checklist: the washes to run ({@link CaseSpec}: a
 * settled load, the soils put on it, the programme, parameter changes), the surfaces whose
 * exposure explains the result, and the {@link Check}s that compare the washes against the
 * band the checklist expects. The runner turns scenarios into a {@link SuiteReport}.
 *
 * Units: SI in poses (metres, tub frame); elsewhere the units the checklist uses, named in
 * the field (mg, mm2, mL, Pa, score points).
 */

import type { Pose } from '@spotless/core';
import type { MachineConfig } from '@spotless/machine';
import type { ItemSoilRecord, ItemWashResult, ParamValue, WashResult } from '@spotless/sim-core';

/** The two tiers of the simulation. */
export type Tier = 'fast' | 'official';

/** What a check or a phenomenon comes to. */
export type Verdict = 'pass' | 'wrong sign' | 'too small' | 'too large' | 'not covered' | 'error';

/**
 * Mechanisms the checklist needs that are out of scope (docs/design/scope.md): a scenario
 * that names one is reported as not covered, and says which it needs.
 */
export type Capability =
  'drying' | 'redeposition' | 'item_motion' | 'flaking' | 'spotting' | 'tablet_transport';

/** The band a measured value is judged against, with the checklist's tolerance applied. */
export interface Expected {
  /** What the checklist says, in its own terms. */
  readonly stated: string;
  /** +1 or -1: the value must have this sign; 0: only its magnitude is bounded. */
  readonly sign: -1 | 0 | 1;
  /** Accepted magnitudes (absolute values), tolerance included. */
  readonly min: number;
  readonly max: number;
  /** How the tolerance was applied, in words. */
  readonly tolerance: string;
  /**
   * True when the value is the signed distance of a quantity from a stated range (0 inside):
   * a value below `-max` is then `too small` and one above `max` is `too large`.
   */
  readonly distance?: boolean;
}

/** One item of a load as a wash takes it. */
export interface LoadItem {
  readonly itemId: string;
  readonly typeId: string;
  /** Item frame to tub frame, metres. */
  readonly pose: Pose;
  /** Soils the load itself carries (the loader's standard loads); empty for a built load. */
  readonly soils: readonly ItemSoilRecord[];
  /**
   * True for a pose that was set and not settled by the loading physics. The runner checks
   * that it cuts into nothing and reports the deepest overlap.
   */
  readonly exact?: boolean;
}

/** A load as the suite reads it from disk. */
export interface Load {
  readonly name: string;
  readonly description: string;
  /** `built`: by `phenomena/builder`; `loader`: a standard load of `@spotless/loader`. */
  readonly source: 'built' | 'loader';
  readonly items: readonly LoadItem[];
  /** Height position of the adjustable baskets and the state of shelves, as the load was frozen. */
  readonly config: unknown;
  /** Arms the load holds still: spray level id to the arm angle, radians (tub frame). */
  readonly stalledArms: Readonly<Record<string, number>>;
  /** True when the load keeps the dispenser lid shut or the tablet from falling. */
  readonly dispenserBlocked: boolean;
  /** What the builder could not place, and other things worth knowing, in words. */
  readonly notes: readonly string[];
}

/** A soil to put on a region of an item, in the terms of the checklist. */
export interface SoilSpec {
  /** Catalogue soil id. */
  readonly type: string;
  /** Regions of the item with the covered share of each. */
  readonly regions: Readonly<Record<string, number>>;
  /** Grams as applied; default: the catalogue's typical loading on the covered area. */
  readonly amount_g?: number;
  /** Factor on the default amount (a thick layer). */
  readonly amountFactor?: number;
  /** Hours since it was applied; default 2. */
  readonly age_h?: number;
  /** Heat history; default `warm` (2 h at 80 C, the IEC oven drying). */
  readonly heat?: ItemSoilRecord['heat_history'];
}

/** A change to a programme of the machine: everything else stays as the programme has it. */
export interface ProgrammeEdit {
  /** Target temperature of the main wash, degrees Celsius. */
  readonly washTarget_C?: number;
  /** Factor on the pump speed of the main wash. */
  readonly pumpScale?: number;
}

/** A surface whose exposure is reported: an item and some of its regions (all when absent). */
export interface SurfaceRef {
  readonly item: string;
  readonly regions?: readonly string[];
}

/** One wash of a scenario. */
export interface CaseSpec {
  /** `A`, `B`, ...: how the checks refer to it. */
  readonly label: string;
  /** What it is, in a few words. */
  readonly what: string;
  /** Name of a built load, or `loader:<name>` for a standard load of the loader. */
  readonly load: string;
  /**
   * A change of poses made after the loading physics (an exact tilt, a lean): returns the
   * items to wash. Changed items must be flagged `exact`.
   */
  readonly edit?: (items: readonly LoadItem[]) => readonly LoadItem[];
  /**
   * A change of the machine's configuration from the one the load was frozen in (a row of
   * tines folded down), for a scenario in which the machine and not the load is what differs.
   */
  readonly config?: (config: MachineConfig) => MachineConfig;
  /**
   * The soils of an item. `undefined` keeps the soils the load carries (a loader load); an
   * empty list makes the item clean.
   */
  readonly soils?: (item: LoadItem, index: number) => readonly SoilSpec[] | undefined;
  /** A change to Eco 50, the programme every wash runs on. */
  readonly programmeEdit?: ProgrammeEdit;
  /** Parameter overrides on top of the chosen parameter set. */
  readonly params?: Readonly<Record<string, ParamValue>>;
  /** Overrides what the load's mechanical check found. */
  readonly dispenserBlocked?: boolean;
  /** False to let an arm turn that the load's mechanical check found stopped. */
  readonly honourStall?: boolean;
  /**
   * Arms held still whatever the load's mechanical check found: spray level id to the angle
   * of the arm in the tub frame, radians (`armHeldAt`).
   */
  readonly stall?: Readonly<Record<string, number>>;
  /** Seeds; default 1 and 1. */
  readonly levelSeed?: number;
  readonly simSeed?: number;
  /** True when a check reads the per-cell arrays of the result. */
  readonly cells?: boolean;
  /** The affected surfaces, for the diagnostics. */
  readonly surfaces: readonly SurfaceRef[];
}

/** The exposure of a surface, time-weighted over the circulation of the programme. */
export interface SurfaceExposure {
  /** Area of the surface, cm2. */
  readonly area_cm2: number;
  /** Fraction of the circulation time a point of it is under direct jet impingement (shear above the first level), area mean. */
  readonly fJet: number;
  /** Share of its area that is ever under a jet footprint. */
  readonly jetAreaShare: number;
  /** Largest and (over the area under jets) mean peak wall shear of the jets, Pa. */
  readonly shearPeakMax_Pa: number;
  readonly shearPeakMean_Pa: number;
  /** Mean wall shear while inside a footprint, Pa (duty-weighted). */
  readonly shearMean_Pa: number;
  /** Share of the bare surface water covers, and fraction of time there is water on it. */
  readonly wetFraction: number;
  readonly wetTime: number;
  /** Area share that is wet at all in at least one spray state. */
  readonly wettedAreaShare: number;
  /** Water received per area, kg/(m2 s), and the rate the water on it is replaced, 1/s. */
  readonly flux_kg_m2_s: number;
  readonly renewal_per_s: number;
  /** Wall shear of the flowing film, Pa, and its thickness, micrometres. */
  readonly filmShear_Pa: number;
  readonly filmThickness_um: number;
  /** Area share that lies under a pool when the pool is full. */
  readonly pooledAreaShare: number;
  /** Water left on it after the spray stops, g/m2. */
  readonly retained_g_m2: number;
}

/** A pool an item can hold, from the scene and the exposure. */
export interface PoolDiagnostic {
  readonly capacity_mL: number;
  /** Seconds of spraying after which it is full at the mean inflow; null when no water enters. */
  readonly fillTime_s: number | null;
  /** Seconds of the programme's circulation it then stands full. */
  readonly timeFull_s: number;
}

/** What a wash's liquor was like while detergent was in it (the main wash). */
export interface LiquorSummary {
  /** Seconds with detergent above 5 % of its peak, and the means over that time. */
  readonly washTime_s: number;
  readonly temperatureMean_C: number;
  readonly temperatureMax_C: number;
  readonly pHMean: number;
  readonly pHMax: number;
  readonly detergentPeak_g_L: number;
  /** Peak and time-mean active protease and amylase, g/L of granulate. */
  readonly proteasePeak_g_L: number;
  readonly proteaseMean_g_L: number;
  readonly amylasePeak_g_L: number;
  /** Peak and time-mean peracetic acid, mmol/L. */
  readonly peracidPeak_mmol_L: number;
  readonly peracidMean_mmol_L: number;
}

/** One wash as run: the result with what explains it. */
export interface CaseRun {
  readonly spec: CaseSpec;
  readonly load: Load;
  readonly items: readonly LoadItem[];
  readonly result: WashResult;
  /** Per surface of `spec.surfaces`, in order. */
  readonly surfaces: readonly SurfaceDiagnostics[];
  readonly liquor: LiquorSummary;
  /** Deepest overlap of an exact pose with anything, mm, and with what; 0 when none. */
  readonly exactOverlap_mm: number;
  readonly exactOverlapWith: string;
  /** Wall-clock seconds of the wash, and whether its exposure came from the cache. */
  readonly seconds: number;
  readonly cached: boolean;
  /** The item of the result with this id. Throws when the wash has none. */
  item(itemId: string): ItemWashResult;
  /** The exposure of an item's regions (all of it when none are named). */
  exposure(itemId: string, regions?: readonly string[]): SurfaceExposure;
  /** The pools of an item. */
  pools(itemId: string): readonly PoolDiagnostic[];
}

/** The diagnostics of one surface in one wash. */
export interface SurfaceDiagnostics {
  readonly item: string;
  readonly regions: readonly string[];
  readonly exposure: SurfaceExposure;
  /** Per soil on the item: catalogue id, model class, removal law, mg at the start and left. */
  readonly soils: readonly {
    readonly type: string;
    readonly modelClass: string;
    readonly law: string;
    readonly initial_mg: number;
    readonly residual_mg: number;
  }[];
  readonly score: number;
  readonly clean: boolean;
  readonly visibleArea_mm2: number;
  readonly specks: number;
  readonly pooled_mL: number;
  readonly film_g: number;
  readonly pools: readonly PoolDiagnostic[];
  readonly jetLiftRatio: number | null;
}

/** What a check measured. */
export interface Measured {
  /** The value in A and in B where the check compares two washes. */
  readonly a?: number;
  readonly b?: number;
  /** The value that is judged: a difference, a ratio or a single number. */
  readonly value: number;
}

/** The washes of a scenario by label. */
export type Runs = Readonly<Record<string, CaseRun>>;

/** One comparison of a scenario against the checklist. */
export interface Check {
  readonly id: string;
  /** The quantity, in words: `change of the plate's IEC score, B - A`. */
  readonly quantity: string;
  readonly unit: string;
  /** True when the check decides the verdict of the phenomenon; false for supporting evidence. */
  readonly decides: boolean;
  /** Missing mechanisms this check waits for (besides those of the scenario). */
  readonly requires?: readonly Capability[];
  readonly expected: Expected;
  measure(runs: Runs): Measured;
}

/** One entry of the checklist as an executable test. */
export interface Scenario {
  readonly id: string;
  /** The phenomenon, as the checklist names it. */
  readonly title: string;
  /** The checklist's group letter, A to G. */
  readonly group: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  /** The mechanism the checklist gives, shortened. */
  readonly mechanism: string;
  /** The A/B test as run on the owner's machine. */
  readonly test: string;
  /** What was changed from the checklist's test to fit the Bosch SMV4HAX40G, and assumptions. */
  readonly adapted: string;
  /** Mechanisms the phenomenon needs that the simulation lacks. */
  readonly requires?: readonly Capability[];
  /** The stages that carry the phenomenon, for reading a failure. */
  readonly stages: string;
  /** True when the result could depend on the block size, so it is run at both tiers. */
  readonly resolutionSensitive: boolean;
  readonly cases: readonly CaseSpec[];
  readonly checks: readonly Check[];
}

/** The outcome of one check. */
export interface CheckReport {
  readonly id: string;
  readonly quantity: string;
  readonly unit: string;
  readonly decides: boolean;
  readonly expected: Expected;
  readonly a: number | null;
  readonly b: number | null;
  readonly value: number | null;
  readonly verdict: Verdict;
  /** For `not covered` and `error`: why. */
  readonly note: string;
}

/** One wash in a report. */
export interface CaseReport {
  readonly label: string;
  readonly what: string;
  readonly load: string;
  readonly programme: string;
  readonly params: Readonly<Record<string, ParamValue>>;
  readonly dispenserBlocked: boolean;
  readonly stalledArms: Readonly<Record<string, number>>;
  readonly levelSeed: number;
  readonly simSeed: number;
  readonly resultHash: string;
  /** The tracer the exposure of this wash was computed on: `gpu`, `cpu` or `mixed`. */
  readonly exposureBackend: string;
  readonly seconds: number;
  readonly exposureCached: boolean;
  readonly items: number;
  readonly cleanItems: number;
  readonly meanScore: number;
  readonly liquor: LiquorSummary;
  readonly surfaces: readonly SurfaceDiagnostics[];
  readonly exactOverlap_mm: number;
  readonly exactOverlapWith: string;
  readonly problems: readonly string[];
  readonly loadNotes: readonly string[];
}

/** One phenomenon in a report. */
export interface ScenarioReport {
  readonly id: string;
  readonly title: string;
  readonly group: string;
  readonly test: string;
  readonly adapted: string;
  readonly stages: string;
  readonly verdict: Verdict;
  /** Why it is not covered, or what went wrong. */
  readonly note: string;
  readonly checks: readonly CheckReport[];
  readonly cases: readonly CaseReport[];
}

/** A run of the suite. */
export interface SuiteReport {
  readonly suite: 'spotless-phenomena';
  readonly tier: Tier;
  /**
   * For a run at the fast tier: how often the fast tier's verdicts differ from the official
   * tier's, per class of item, as measured for the parameter set (`fastTierNote`).
   */
  readonly tierNote?: string;
  readonly simVersion: string;
  /** Name of the parameter set (`registry defaults` or the file given) and its hashes. */
  readonly paramSet: string;
  readonly paramOverrides: Readonly<Record<string, ParamValue>>;
  /** Names of the sets that were read although stale (accepted knowingly); empty otherwise. */
  readonly paramSetsStale?: readonly string[];
  /** The detergent dosed, when not the machine's own dose of the reference detergent. */
  readonly detergent?: { readonly name: string; readonly dose_g: number };
  /** Fingerprint of the simulation's source the washes ran on (`simulationFingerprint`). */
  readonly sourceFingerprint?: string;
  readonly hydroHash: string;
  readonly soilHash: string;
  /** The tracers the exposure of the washes was computed on (`gpu`, `cpu`), joined. */
  readonly exposureBackend: string;
  readonly machineId: string;
  readonly scenarios: readonly ScenarioReport[];
  /** Verdict counts over the scenarios. */
  readonly counts: Readonly<Record<Verdict, number>>;
  /** Wall-clock seconds of the whole run, washes run and washes whose exposure was cached. */
  readonly seconds: number;
  readonly washes: number;
  readonly washesCached: number;
}
