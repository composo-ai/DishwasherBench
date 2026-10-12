/**
 * Runs the washes of the phenomena suite: a {@link CaseSpec} to a {@link CaseRun}.
 *
 * Every wash goes through `wash()` of `@spotless/sim-core` exactly as the game's runner calls
 * it, with one exposure cache on disk shared by the whole suite (a wash that differs from
 * another only in soils, liquor, programme length or a soil parameter replays cached
 * exposure). The exposure stage is the simulation's own; it is wrapped only to read, beside
 * it, the sums the diagnostics are made of (`diagnostics.ts`), which are stored next to the
 * cached set under the same key.
 *
 * Washes are memoised by everything they are computed from, so scenarios that share a wash
 * (the same plate, the same soil, the owner's programme) run it once.
 *
 * Node only (the cache and the loads are files).
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { instantiate } from '@spotless/catalogue';
import { canonicalHash } from '@spotless/core';
import { buildMachineGeometry, PRIMARY_MACHINE, type MachineConfig } from '@spotless/machine';
import {
  buildWashScene,
  canonicalPose,
  computeExposureSet,
  createWashParams,
  decodeExposureSet,
  EXPOSURE_SET_SCHEMA,
  sceneChamber,
  sceneMachineParts,
  sceneMaterialOf,
  SOIL_CLASS_LAW,
  TIERS,
  type ExposureCache,
  type ItemSoilRecord,
  type ItemWashResult,
  type ParamSetRecord,
  type ParamValue,
  type SoilModelClass,
  type WashInput,
  type WashResult,
  type WashScene,
} from '@spotless/sim-core';
import { createDiskExposureCache, washWithSource } from '@spotless/sim-core/node';
import {
  DIAGNOSTICS_VERSION,
  exposureOver,
  liquorSummary,
  poolsOver,
  summariseExposure,
  type StateSums,
} from './diagnostics.ts';
import { readLoad, soilRecord } from './loads.ts';
import { programmeOf, SCORED_PROGRAMME } from './programmes.ts';
import type { CaseRun, CaseSpec, Load, LoadItem, SurfaceDiagnostics, Tier } from './types.ts';

/** How the harness runs. */
export interface HarnessOptions {
  readonly tier: Tier;
  /** Directory of the exposure cache (and, under `diagnostics/`, of the stored sums). */
  readonly cacheDir: string;
  /** The parameter set: overrides on the registry defaults, under every wash. */
  readonly params: Readonly<Record<string, ParamValue>>;
  /** The named sets `params` was composed from, for the provenance of every result. */
  readonly paramSets?: readonly ParamSetRecord[];
  /**
   * The programme of every wash whose case names none; default the scored programme
   * (`SCORED_PROGRAMME`, Eco 50). A case that edits the steps of the owner's programme may not run on
   * another: it then reports an error.
   */
  readonly programme?: string;
  /** The detergent dosed in every wash, in place of the machine's own dose. */
  readonly detergent?: { readonly name: string; readonly dose_g: number };
  /** Receives one line per wash. */
  readonly log?: (line: string) => void;
}

/** A wash as resolved from its spec: what `wash()` is given. */
interface Resolved {
  readonly load: Load;
  readonly items: readonly LoadItem[];
  readonly input: WashInput;
  readonly key: string;
  readonly sceneKey: string;
}

/** Runs washes for the suite. */
export interface Harness {
  readonly options: HarnessOptions;
  /** Key of the scene a case washes: cases with one key share their geometry. */
  sceneKey(spec: CaseSpec): string;
  /** Key of everything a case is computed from. */
  caseKey(spec: CaseSpec): string;
  /** Runs a case, or returns the run of an identical case. Rejects when the wash cannot run. */
  run(spec: CaseSpec): Promise<CaseRun>;
  /** Washes run so far, and how many of them took all their exposure from the cache. */
  readonly washes: number;
  readonly washesCached: number;
}

function resolve(spec: CaseSpec, options: HarnessOptions): Resolved {
  const load = readLoad(spec.load);
  const items = spec.edit === undefined ? load.items : spec.edit(load.items);
  const washItems = items.map((item, index) => {
    const specs = spec.soils?.(item, index);
    const soils: readonly ItemSoilRecord[] =
      specs === undefined ? item.soils : specs.map((s) => soilRecord(s, item.typeId));
    return { itemId: item.itemId, typeId: item.typeId, pose: item.pose, soils };
  });
  const programme = programmeOf(
    spec.programme ?? options.programme ?? SCORED_PROGRAMME,
    spec.programmeEdit,
  );
  const params = { ...options.params, ...(spec.params ?? {}) };
  const stalledArms = spec.stall ?? (spec.honourStall === false ? {} : load.stalledArms);
  const dispenserBlocked = spec.dispenserBlocked ?? load.dispenserBlocked;
  const loaded = load.config as MachineConfig;
  const config = spec.config === undefined ? loaded : spec.config(loaded);
  const input: WashInput = {
    machine: PRIMARY_MACHINE,
    config,
    programme,
    items: washItems,
    tier: options.tier,
    levelSeed: spec.levelSeed ?? 1,
    simSeed: spec.simSeed ?? 1,
    ...(Object.keys(params).length === 0 ? {} : { params }),
    ...(options.paramSets === undefined || options.paramSets.length === 0
      ? {}
      : { paramSets: options.paramSets }),
    ...(options.detergent === undefined
      ? {}
      : // literal-ok-begin: grams to kilograms
        { detergent: { name: options.detergent.name, dose: options.detergent.dose_g / 1000 } }),
    // literal-ok-end
    ...(dispenserBlocked ? { dispenserBlocked: true } : {}),
    ...(Object.keys(stalledArms).length === 0 ? {} : { stalledArms }),
  };
  const geometry = {
    config,
    tier: options.tier,
    items: washItems.map((item) => ({
      id: item.itemId,
      type: item.typeId,
      pose: canonicalPose(item.pose),
    })),
  };
  const sceneKey = canonicalHash(geometry);
  const key = canonicalHash({
    scene: sceneKey,
    soils: washItems.map((item) => item.soils),
    programme: canonicalHash(programme),
    params,
    detergent: options.detergent ?? null,
    dispenserBlocked,
    stalledArms,
    levelSeed: input.levelSeed,
    simSeed: input.simSeed,
    cells: spec.cells === true,
  });
  return { load, items, input, key, sceneKey };
}

/** The scene `wash()` builds for an input, built again (for a wash whose exposure was cached). */
function sceneOf(input: WashInput): WashScene {
  const config = input.config ?? input.machine.defaultConfig;
  const params = createWashParams(input.params ?? {});
  return buildWashScene({
    items: input.items.map((item) => {
      const shape = item.shape ?? instantiate(item.typeId).shape;
      const regions: string[] = [];
      for (const region of shape.regions) if (!regions.includes(region.id)) regions.push(region.id);
      return {
        itemId: item.itemId,
        typeId: item.typeId,
        shape,
        pose: canonicalPose(item.pose),
        soils: [
          {
            type: 'any',
            regions: regions.map((region) => ({ region, coverage: 1 })),
            amount_g: 0,
            age_h: 0,
            heat_history: 'none' as const,
          },
        ],
      };
    }),
    machine: sceneMachineParts(buildMachineGeometry(input.machine, config)),
    blockSize: TIERS[input.tier].block_m,
    materials: sceneMaterialOf,
    params,
    chamber: sceneChamber(input.machine),
  });
}

/** Creates a harness. The cache directory is created when the first wash stores into it. */
export function createHarness(options: HarnessOptions): Harness {
  const cache: ExposureCache = createDiskExposureCache(options.cacheDir);
  const sumsDir = join(options.cacheDir, 'diagnostics');
  const sumsFile = (key: string): string =>
    join(sumsDir, `${key.replace(/[^0-9a-zA-Z]/g, '_')}.json`);
  const readSums = (key: string, exact: readonly string[]): StateSums | undefined => {
    try {
      const sums = JSON.parse(readFileSync(sumsFile(key), 'utf8')) as StateSums;
      if (sums.version !== DIAGNOSTICS_VERSION) return undefined;
      if (exact.some((id) => sums.overlaps[id] === undefined)) return undefined;
      return sums;
    } catch {
      return undefined;
    }
  };
  const writeSums = (key: string, sums: StateSums): void => {
    mkdirSync(sumsDir, { recursive: true });
    const temporary = `${sumsFile(key)}.${process.pid}.tmp`;
    writeFileSync(temporary, JSON.stringify(sums));
    renameSync(temporary, sumsFile(key));
  };

  const resolved = new Map<CaseSpec, Resolved>();
  const resolveOnce = (spec: CaseSpec): Resolved => {
    let r = resolved.get(spec);
    if (r === undefined) {
      r = resolve(spec, options);
      resolved.set(spec, r);
    }
    return r;
  };
  const runs = new Map<string, Promise<Omit<CaseRun, 'spec' | 'surfaces'>>>();
  let washes = 0;
  let washesCached = 0;

  const execute = async (
    r: Resolved,
    cells: boolean,
  ): Promise<Omit<CaseRun, 'spec' | 'surfaces'>> => {
    const exact = r.items.filter((item) => item.exact === true).map((item) => item.itemId);
    const computed = new Map<string, StateSums>();
    const started = performance.now();
    const result: WashResult = await washWithSource(r.input, {
      cache,
      cells,
      exposure: {
        // The simulation's own stage under its own name, so that the cache is shared with
        // every other tool; the wrapper only reads the sums of the diagnostics beside it.
        id: `exposure-v${EXPOSURE_SET_SCHEMA}`,
        stage: async (stageInput) => {
          const set = await computeExposureSet(stageInput);
          computed.set(stageInput.state.id, summariseExposure(stageInput.scene, set, exact));
          return set;
        },
      },
    });
    const seconds = (performance.now() - started) / 1000;
    let scene: WashScene | undefined;
    const states: { sums: StateSums; duration: number }[] = [];
    for (const state of result.machine.states) {
      let sums = computed.get(state.id);
      if (sums !== undefined) writeSums(state.exposureKey, sums);
      else sums = readSums(state.exposureKey, exact);
      if (sums === undefined) {
        // Cached by another tool, or by an older version of these sums: read the set again.
        const bytes = await cache.get(state.exposureKey);
        if (bytes === undefined) throw new Error(`no exposure set under ${state.exposureKey}`);
        scene ??= sceneOf(r.input);
        sums = summariseExposure(scene, decodeExposureSet(bytes), exact);
        writeSums(state.exposureKey, sums);
      }
      states.push({ sums, duration: state.duration_s });
    }
    let overlap = 0;
    let overlapWith = '';
    for (const id of exact) {
      const found = states[0]?.sums.overlaps[id];
      if (found !== undefined && found.depth > overlap) {
        overlap = found.depth;
        overlapWith = `${id} into ${found.with}`;
      }
    }
    washes += 1;
    if (result.run.exposureComputed === 0) washesCached += 1;
    const byId = new Map<string, ItemWashResult>(result.items.map((item) => [item.itemId, item]));
    return {
      load: r.load,
      items: r.items,
      result,
      liquor: liquorSummary(result),
      exactOverlap_mm: overlap * 1000,
      exactOverlapWith: overlapWith,
      seconds,
      cached: result.run.exposureComputed === 0,
      item: (itemId) => {
        const item = byId.get(itemId);
        if (item === undefined)
          throw new RangeError(`the wash of ${r.load.name} has no item '${itemId}'`);
        return item;
      },
      exposure: (itemId, regions) => exposureOver(states, itemId, regions),
      pools: (itemId) => poolsOver(states, itemId),
    };
  };

  return {
    options,
    sceneKey: (spec) => resolveOnce(spec).sceneKey,
    caseKey: (spec) => resolveOnce(spec).key,
    run: async (spec) => {
      const r = resolveOnce(spec);
      let pending = runs.get(r.key);
      if (pending === undefined) {
        pending = execute(r, spec.cells === true);
        runs.set(r.key, pending);
        const base = await pending;
        options.log?.(
          `  wash ${spec.load} [${r.input.programme.id}] ${base.seconds.toFixed(1)} s` +
            `${base.cached ? ' (exposure cached)' : ''} ${base.result.provenance.resultHash.slice(7, 19)}`,
        );
      }
      const base = await pending;
      const surfaces: SurfaceDiagnostics[] = spec.surfaces.map((surface) => {
        const item = base.item(surface.item);
        return {
          item: surface.item,
          regions: surface.regions ?? [],
          exposure: base.exposure(surface.item, surface.regions),
          soils: item.soils.map((soil) => ({
            type: soil.type,
            modelClass: soil.modelClass,
            law: SOIL_CLASS_LAW[soil.modelClass as SoilModelClass]?.law ?? '',
            initial_mg: soil.initialMass_mg,
            residual_mg: soil.residualMass_mg,
          })),
          score: item.score,
          clean: item.clean,
          visibleArea_mm2: item.visibleAreaMm2,
          specks: item.specks,
          pooled_mL: item.water.pooled_mL,
          film_g: item.water.film_g,
          pools: base.pools(surface.item),
          jetLiftRatio: item.jetLiftRatio ?? null,
        };
      });
      return { ...base, spec, surfaces };
    },
    get washes() {
      return washes;
    },
    get washesCached() {
      return washesCached;
    },
  };
}
