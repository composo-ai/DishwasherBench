/**
 * Helpers for this package's tests (not exported from the package entry point): a real load
 * manifest from a real session, and a hand-made simulation result for it.
 */

import { instantiate } from '@spotless/catalogue';
import type { Level } from '@spotless/levels';
import { starterLevels } from '@spotless/levels';
import type { PlaceRequest, WashManifest } from '@spotless/session';
import { createSession } from '@spotless/session';
import type { ItemWashResult, WashResult } from './sim.ts';

/** The tutorial level. */
export function tutorialLevel(): Level {
  const level = starterLevels().find((candidate) => candidate.id === 'tutorial');
  if (level === undefined) throw new Error('the starter levels have no tutorial');
  return level;
}

/** Placements of the tutorial that end tilted, so that a wrong quaternion order shows. */
export const TILTED_LOAD: readonly PlaceRequest[] = [
  {
    item_id: 'bowl_01',
    frame: 'lower_rack',
    position_mm: [420, 270, 200],
    orientation: { preset: 'inverted' },
  },
  {
    item_id: 'mug_01',
    frame: 'lower_rack',
    position_mm: [150, 150, 200],
    orientation: { preset: 'upright' },
  },
];

/**
 * Plays placements on a fresh session of a level, starts the cycle and returns the manifest
 * the session hands to its wash runner (the wash itself is never run).
 */
export async function manifestOf(
  level: Level,
  placements: readonly PlaceRequest[],
): Promise<WashManifest> {
  let captured: WashManifest | null = null;
  const session = await createSession({
    level,
    washRunner: (manifest) => {
      captured = manifest;
      return new Promise(() => undefined);
    },
  });
  try {
    for (const request of placements) {
      const placed = session.place(request);
      if (!placed.accepted) {
        throw new Error(`place ${request.item_id} was rejected: ${JSON.stringify(placed)}`);
      }
    }
    const started = session.startCycle();
    if (!started.accepted) throw new Error(`start_cycle was rejected: ${JSON.stringify(started)}`);
    // The session hands the manifest to its runner on a later tick.
    await new Promise<void>((next) => setImmediate(next));
    const manifest = captured as WashManifest | null;
    if (manifest === null) throw new Error('the session did not run its wash runner');
    return manifest;
  } finally {
    session.dispose();
  }
}

/** What a test says about one item of a hand-made result. */
export interface FakeItem {
  readonly clean: boolean;
  readonly score: number;
  /** Per soiled region: cells, and how many of them are still visibly soiled. */
  readonly regions?: readonly {
    readonly region: string;
    readonly cells: number;
    readonly visible: number;
    /** Share of the soil left on the visible cells (default 0.8) and on the others (default 0). */
    readonly left?: number;
    readonly trace?: number;
    readonly specks?: number;
  }[];
  readonly pooled_mL?: number;
  /**
   * What the water standing in the item left where it stood: the area on which it is visible,
   * mm2 (on the first soiled region of the item, else its interior; part of the item's
   * visible area).
   */
  readonly standingVisibleAreaMm2?: number;
  /** Peak upward force of the jets on the item over its weight. */
  readonly jetLiftRatio?: number;
}

/** The model classes of a hand-made result: one per catalogue soil of the load, in id order. */
function classesOf(manifest: WashManifest): string[] {
  const types = new Set<string>();
  for (const item of manifest.items) for (const soil of item.soils) types.add(soil.type);
  return [...types].sort().map((type) => `class_of_${type}`);
}

/**
 * A simulation result for a manifest with the outcome the test states per item: cells of
 * 4 mm2 laid in a row along x on the plane z = 0 of the item frame, normal +z, each soil of
 * the item at 1 mg/cm2 at the start. Everything a report does not read is left empty.
 */
export function fakeResult(
  manifest: WashManifest,
  outcome: { readonly [itemId: string]: FakeItem },
): WashResult {
  const soilClasses = classesOf(manifest);
  const classCount = soilClasses.length;
  const items: ItemWashResult[] = manifest.items.map((item) => {
    const fake = outcome[item.item_id] ?? { clean: true, score: 5 };
    const regionIds = [...new Set(instantiate(item.item_type).shape.regions.map((r) => r.id))];
    const soiled = fake.regions ?? [];
    const count = soiled.reduce((sum, region) => sum + region.cells, 0);
    const region = new Uint16Array(count);
    const centre = new Float32Array(3 * count);
    const normal = new Float32Array(3 * count);
    const areaMm2 = new Float32Array(count).fill(4);
    const initial = new Float32Array(count * classCount);
    const residual = new Float32Array(count * classCount);
    const visible = new Uint8Array(count);
    let e = 0;
    const regions = soiled.map((r) => {
      const columns = item.soils
        .filter((soil) => soil.regions.some((on) => on.region === r.region))
        .map((soil) => soilClasses.indexOf(`class_of_${soil.type}`));
      let initialMass = 0;
      let residualMass = 0;
      for (let i = 0; i < r.cells; i++, e++) {
        region[e] = regionIds.indexOf(r.region);
        centre[3 * e] = 0.002 * e;
        normal[3 * e + 2] = 1;
        const seen = i < r.visible;
        visible[e] = seen ? 1 : 0;
        for (const column of columns) {
          const left = seen ? (r.left ?? 0.8) : (r.trace ?? 0);
          initial[classCount * e + column] = 1;
          residual[classCount * e + column] = left;
          // 1 mg/cm2 on 4 mm2 is 0.04 mg.
          initialMass += 0.04;
          residualMass += 0.04 * left;
        }
      }
      return {
        regionId: r.region,
        areaMm2: 4 * r.cells,
        initialMass_mg: initialMass,
        residualMass_mg: residualMass,
        visibleAreaMm2: 4 * r.visible,
        specks: r.specks ?? 0,
      };
    });
    // The soil of the item's own cells, before anything standing water left is added.
    const initialMass = regions.reduce((sum, r) => sum + r.initialMass_mg, 0);
    const residualMass = regions.reduce((sum, r) => sum + r.residualMass_mg, 0);
    const pooled = fake.pooled_mL ?? 0;
    // Residue of standing water lies on patches of the surface, not on soil cells: it is in
    // the area of its region and of the item, and on no cell.
    const standing = fake.standingVisibleAreaMm2 ?? 0;
    if (standing > 0) {
      const regionId =
        soiled[0]?.region ?? (regionIds.includes('interior') ? 'interior' : (regionIds[0] ?? ''));
      const at = regions.find((r) => r.regionId === regionId);
      if (at === undefined) {
        regions.push({
          regionId,
          areaMm2: 0,
          initialMass_mg: 0,
          residualMass_mg: 0.01 * standing,
          visibleAreaMm2: standing,
          specks: 0,
        });
      } else {
        regions[regions.indexOf(at)] = {
          ...at,
          residualMass_mg: at.residualMass_mg + 0.01 * standing,
          visibleAreaMm2: at.visibleAreaMm2 + standing,
        };
      }
    }
    return {
      itemId: item.item_id,
      typeId: item.item_type,
      clean: fake.clean,
      score: fake.score,
      initialMass_mg: regions.reduce((sum, r) => sum + r.initialMass_mg, 0),
      residualMass_mg: regions.reduce((sum, r) => sum + r.residualMass_mg, 0),
      initialVisibleAreaMm2: 4 * count,
      visibleAreaMm2: regions.reduce((sum, r) => sum + r.visibleAreaMm2, 0),
      specks: regions.reduce((sum, r) => sum + r.specks, 0),
      water: {
        pooled_mL: pooled,
        puddle_mL: 0,
        film_g: 0.5,
        pools: [],
        ...(standing > 0
          ? { standingResidue_mg: 0.01 * standing, standingVisibleAreaMm2: standing }
          : {}),
      },
      ...(fake.jetLiftRatio === undefined ? {} : { jetLiftRatio: fake.jetLiftRatio }),
      regionIds,
      regions,
      // A report reads nothing of the exposure summary: a made-up one with tell-tale numbers,
      // so that a test can see that none of them reaches a player.
      exposure: {
        regions: regionIds.map((regionId) => ({
          regionId,
          areaMm2: 1234.5,
          jetShare: 0.0123,
          jetFilmShare: 0.0456,
          jetArea: 0.789,
          jetShearPeak: 321.5,
          wetTime: 0.9876,
          dryArea: 0.0124,
          flux: 0.0345,
          exchange: 6.78,
          renewal: 9.12,
          filmShear: 1.357,
          neverWetArea: 0.0246,
          pooledArea: 0.0135,
          retained_g: 0.4321,
          states: [],
        })),
      },
      soils: item.soils.map((soil) => ({
        type: soil.type,
        modelClass: `class_of_${soil.type}`,
        bake: 0,
        coveredAreaMm2: 4 * count,
        initialMass_mg: initialMass,
        residualMass_mg: residualMass,
      })),
      cells: {
        count,
        region,
        centre,
        normal,
        areaMm2,
        initial_mg_cm2: initial,
        residual_mg_cm2: residual,
        visible,
      },
    };
  });
  items.sort((a, b) => (a.itemId < b.itemId ? -1 : a.itemId > b.itemId ? 1 : 0));
  return {
    provenance: {
      simVersion: 'fake-sim 1',
      tier: 'fast',
      hydroHash: 'sha256:hydro',
      soilHash: 'sha256:soil',
      inputHash: 'sha256:input',
      levelSeed: manifest.seed,
      simSeed: 1,
      exposureSchema: 0,
      exposureStandIn: false,
      exposureBackend: 'gpu',
      paramSets: [],
      detergent: { name: 'machine default', dose_g: 20 },
      exposureSource: '',
      sourceFingerprint: '',
      resultHash: 'sha256:fake-result',
    },
    soilClasses,
    items,
    machine: {
      machineId: manifest.machine_id,
      programmeId: manifest.programme_id,
      duration_s: 8700,
      ticks: 0,
      states: [],
      water_L: 0,
      energy_kWh: 0,
      heldWater_mL: 0,
      dispenser: 'free',
      detergent: { dosed_g: 0, dissolved_g: 0 },
      carryOver: [],
      liquor: { fields: [], tickTime_s: new Float64Array(0), values: new Float64Array(0) },
      soil: { initial_mg: 0, remaining_mg: 0, toLiquor_mg: 0, toPools_mg: 0 },
      timelineProblems: [],
    },
    problems: [],
    run: {
      timings_ms: {},
      sceneReused: false,
      exposureCacheHits: 0,
      exposureComputed: 0,
      blocks: 0,
      soilCells: 0,
      deposits: 0,
    },
  };
}
