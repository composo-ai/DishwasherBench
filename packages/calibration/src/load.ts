/**
 * The load of a wash record: to the items of a wash, and both ways to the game's load manifest
 * (docs/calibration/wash-record.md section 7).
 *
 *  - {@link washLoadOfRecord}: the items of a record as the wash simulation takes them (SI
 *    poses in the tub frame, shapes of custom items, soil records), with the patches that the
 *    evaluator cuts out of a region and the parameter overrides a record's heat histories
 *    imply.
 *  - {@link recordLoadFromManifest} / {@link recordFromManifest}: a load placed in the game
 *    client (`session.washManifest()`) as the load of a record.
 *  - {@link washManifestFromRecord}: a record as a `WashManifest` with its level and its
 *    player-visible load manifest, which a client can open to show where everything goes.
 *
 * The record holds the pose of the item frame's origin (as the wash simulation uses it); the
 * player-visible load manifest holds the item's reference point rounded to 0.1 mm, as the
 * session writes it.
 */

import { getItemType, hasItemType, hasSoil, instantiate, listSoils } from '@spotless/catalogue';
import {
  canonicalHash,
  quantiseQuatGrid,
  quatNormalise,
  quatRotate,
  quatToWire,
  roundToGrid,
  type Pose,
  type Quat,
  type Vec3,
} from '@spotless/core';
import type { Shape } from '@spotless/geometry';
import {
  BENCHMARK_VERSION,
  rackOptions,
  type Level,
  type LevelItem,
  type LevelSoil,
} from '@spotless/levels';
import { buildMachineGeometry, type MachineConfig, type MachineSpec } from '@spotless/machine';
import type { LoadManifest, WashManifest, WashManifestItem } from '@spotless/session';
import {
  SOIL_CLASS_OF_MECHANISM,
  SOIL_HEAT_STEPS,
  washRegistry,
  type ItemSoilRecord,
  type ParamValue,
  type WashItemInput,
} from '@spotless/sim-core';
import {
  customShapeOf,
  soilIdOf,
  WASH_RECORD_FORMAT,
  WASH_RECORD_VERSION,
  type RecordItem,
  type RecordLoad,
  type RecordProvenance,
  type RecordSoil,
  type SoilPatch,
  type WashRecord,
} from './record.ts';
import { RecordSetupError } from './setup.ts';

/** A soil that lies on a described patch, to be cut out of the region it was laid on. */
export interface PatchPlan {
  readonly itemId: string;
  /** Position of the soil in the item's soils. */
  readonly soilIndex: number;
  readonly patch: SoilPatch;
}

/** The load of a record as the wash simulation takes it. */
export interface RecordWashLoad {
  /** Items in the order of the record; soils in the order of each item. */
  readonly items: readonly WashItemInput[];
  /** The soils that lie on a patch (their soil record covers the whole region). */
  readonly patches: readonly PatchPlan[];
  /**
   * Parameter overrides the record implies: the temperature and time of the heat histories it
   * states (`soil.heatTemperature`, `soil.heatDuration`).
   */
  readonly params: Readonly<Record<string, ParamValue>>;
  readonly dispenserBlocked: boolean;
  /** Spray level id to arm angle, radians. */
  readonly stalledArms: Readonly<Record<string, number>>;
  /** What the simulation cannot take as stated, in words. */
  readonly notes: readonly string[];
}

const shapeCache = new Map<string, Shape>();

/** The shape of a custom item, one object per distinct definition (so that its hash is cached). */
function cachedCustomShape(item: RecordItem): Shape | undefined {
  if (item.custom === undefined) return undefined;
  const key = canonicalHash(item.custom);
  let shape = shapeCache.get(key);
  if (shape === undefined) {
    shape = customShapeOf(item.custom);
    shapeCache.set(key, shape);
  }
  return shape;
}

/** The origin of every placement frame of a machine in a configuration, tub frame, metres. */
function frameOrigins(spec: MachineSpec, config: MachineConfig): Map<string, Vec3> {
  const frames = new Map<string, Vec3>([['tub', [0, 0, 0]]]);
  for (const basket of buildMachineGeometry(spec, config).affordances.baskets) {
    frames.set(basket.frame, basket.originTub);
  }
  return frames;
}

/** The pose of an item of a record: item frame to tub frame, metres. */
function poseOfItem(item: RecordItem, frames: ReadonlyMap<string, Vec3>): Pose {
  const origin = frames.get(item.frame ?? 'tub');
  if (origin === undefined) {
    throw new RecordSetupError(
      `item ${item.id}: unknown frame "${item.frame}" (${[...frames.keys()].join(', ')})`,
    );
  }
  const [w, x, y, z] = item.quat_wxyz;
  return {
    p: [
      origin[0] + item.position_mm[0] / 1000,
      origin[1] + item.position_mm[1] / 1000,
      origin[2] + item.position_mm[2] / 1000,
    ],
    // A quaternion that is unit to single precision (as the loading physics leaves it) is kept
    // as it is, so that a pose survives the round trip through a record bit for bit.
    q: Math.abs(Math.hypot(w, x, y, z) - 1) < 1e-6 ? [x, y, z, w] : quatNormalise([x, y, z, w]),
  };
}

/** The soil record of the wash simulation for a soil of a record. */
function soilRecordOf(soil: RecordSoil): ItemSoilRecord {
  return {
    type: soil.type,
    regions:
      'patch' in soil.where
        ? [{ region: soil.where.patch.region, coverage: 1 }]
        : soil.where.regions.map((r) => ({ region: r.region, coverage: r.coverage })),
    amount_g: soil.amount_g,
    age_h: soil.drying.time_h,
    heat_history: soil.heat.history,
  };
}

/**
 * The load of a record as the wash simulation takes it. `spec` and `config` are the machine as
 * `machineOfRecord` returns it. Throws {@link RecordSetupError} for an unknown frame or a
 * custom shape that cannot be built.
 */
export function washLoadOfRecord(
  record: WashRecord,
  spec: MachineSpec,
  config: MachineConfig,
): RecordWashLoad {
  const frames = frameOrigins(spec, config);
  const notes: string[] = [];
  const patches: PatchPlan[] = [];
  const heat = new Map<string, { temperature?: number; duration?: number; by: string }>();
  const items: WashItemInput[] = record.load.items.map((item) => {
    let shape: Shape | undefined;
    try {
      shape = cachedCustomShape(item);
    } catch (error) {
      throw new RecordSetupError(
        `item ${item.id}: its custom shape cannot be built: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    item.soils.forEach((soil, soilIndex) => {
      if ('patch' in soil.where)
        patches.push({ itemId: item.id, soilIndex, patch: soil.where.patch });
      const { history, temperature_c: temperature, time_min: minutes } = soil.heat;
      if (history === 'none' || (temperature === undefined && minutes === undefined)) return;
      const known = heat.get(history);
      const by = `${item.id}.${soilIdOf(soil, soilIndex)}`;
      const duration = minutes === undefined ? undefined : minutes * 60;
      if (known === undefined) {
        heat.set(history, {
          ...(temperature === undefined ? {} : { temperature }),
          ...(duration === undefined ? {} : { duration }),
          by,
        });
      } else if (
        (temperature !== undefined &&
          known.temperature !== undefined &&
          known.temperature !== temperature) ||
        (duration !== undefined && known.duration !== undefined && known.duration !== duration)
      ) {
        notes.push(
          `${by}: heat history "${history}" is stated with another temperature or time than on ${known.by}; the simulation has one per category and uses that of ${known.by}`,
        );
      }
    });
    return {
      itemId: item.id,
      typeId: item.type,
      pose: poseOfItem(item, frames),
      soils: item.soils.map(soilRecordOf),
      ...(shape === undefined ? {} : { shape }),
    };
  });
  const params: Record<string, ParamValue> = {};
  if (heat.size > 0) {
    // Vector overrides replace the whole vector: start from the record's own, else the default.
    const own = record.sim?.params ?? {};
    const vector = (key: string, fallback: readonly number[]): number[] => {
      const given = own[key];
      return Array.isArray(given) ? [...(given as readonly number[])] : [...fallback];
    };
    const defaults = heatDefaults();
    const temperatures = vector('soil.heatTemperature', defaults.temperature);
    const durations = vector('soil.heatDuration', defaults.duration);
    let anyTemperature = false;
    let anyDuration = false;
    for (const [history, stated] of heat) {
      const at = (SOIL_HEAT_STEPS as readonly string[]).indexOf(history);
      if (at < 0) continue;
      if (stated.temperature !== undefined) {
        temperatures[at] = stated.temperature;
        anyTemperature = true;
      }
      if (stated.duration !== undefined) {
        durations[at] = stated.duration;
        anyDuration = true;
      }
    }
    if (anyTemperature) params['soil.heatTemperature'] = temperatures;
    if (anyDuration) params['soil.heatDuration'] = durations;
  }
  const stalled: Record<string, number> = {};
  for (const [level, degrees] of Object.entries(record.load.stalled_arms_deg ?? {})) {
    stalled[level] = (degrees * Math.PI) / 180;
  }
  return {
    items,
    patches,
    params,
    dispenserBlocked: record.load.dispenser_blocked === true,
    stalledArms: stalled,
    notes,
  };
}

/** The registry defaults of the heat histories (`soil.heatTemperature`, `soil.heatDuration`). */
function heatDefaults(): { temperature: readonly number[]; duration: readonly number[] } {
  const vector = (key: string): readonly number[] => {
    const def = washRegistry().def(key);
    return def.kind === 'vector' ? def.default : [];
  };
  return { temperature: vector('soil.heatTemperature'), duration: vector('soil.heatDuration') };
}

// ---------------------------------------------------------------------------------------------
// From the game's load manifest
// ---------------------------------------------------------------------------------------------

function recordSoilOfLevel(soil: LevelSoil, index: number): RecordSoil {
  return {
    id: `soil_${index + 1}`,
    type: soil.type,
    ...(soil.description === undefined ? {} : { recipe: soil.description }),
    amount_g: soil.amountG,
    where: { regions: soil.regions.map((r) => ({ region: r.region, coverage: r.coverage })) },
    drying: { time_h: soil.ageH },
    heat: { history: soil.heatHistory },
  };
}

/**
 * The load of a record from the game's wash manifest: every loaded item with the exact pose
 * the loading physics left it in (tub frame) and the soils of its level.
 */
export function recordLoadFromManifest(manifest: WashManifest): RecordLoad {
  return {
    items: manifest.items.map((item) => ({
      id: item.item_id,
      type: item.item_type,
      frame: 'tub',
      position_mm: [item.pose.p[0] * 1000, item.pose.p[1] * 1000, item.pose.p[2] * 1000],
      quat_wxyz: [item.pose.q[3], item.pose.q[0], item.pose.q[1], item.pose.q[2]],
      soils: item.soils.map(recordSoilOfLevel),
    })),
  };
}

/** What {@link recordFromManifest} needs besides the manifest. */
export interface RecordFromManifestOptions {
  /** Id of the record. */
  readonly id: string;
  /** `planned` (default: a load with no observations yet) or `measured`. */
  readonly kind?: 'planned' | 'measured';
  readonly title?: string;
  readonly provenance?: RecordProvenance;
}

/**
 * A wash record of a load placed in the game: machine with its configuration, programme, the
 * load, the level's seed, and no observations. The owner adds what was weighed and seen.
 */
export function recordFromManifest(
  manifest: WashManifest,
  options: RecordFromManifestOptions,
): WashRecord {
  return {
    format: WASH_RECORD_FORMAT,
    version: WASH_RECORD_VERSION,
    id: options.id,
    kind: options.kind ?? 'planned',
    title:
      options.title ?? `${manifest.level.title} (load ${manifest.load.state_hash.slice(0, 15)})`,
    provenance: options.provenance ?? { methods: {} },
    machine: { id: manifest.machine_id, config: manifest.machine_config },
    programme: { id: manifest.programme_id },
    load: recordLoadFromManifest(manifest),
    observations: [],
    sim: { level_seed: manifest.seed >>> 0 },
  };
}

// ---------------------------------------------------------------------------------------------
// To the game's load manifest
// ---------------------------------------------------------------------------------------------

/** A record as the game's manifest, with what could not be carried over. */
export interface ManifestFromRecord {
  readonly manifest: WashManifest;
  /** Ids of the items the manifest cannot hold: custom shapes are not catalogue item types. */
  readonly omitted: readonly string[];
  /** What was approximated (a patch as a covered share of its region, a model class as a soil). */
  readonly notes: readonly string[];
}

/** The catalogue soil that stands for a model soil class in a level: the first of that class. */
function catalogueSoilOfClass(modelClass: string): string | undefined {
  return listSoils().find((soil) => SOIL_CLASS_OF_MECHANISM[soil.soilClass] === modelClass)?.id;
}

/** The area of a patch as its outline states it, m2. */
export function patchOutlineArea(patch: SoilPatch): number {
  if (patch.shape === 'disc') return (Math.PI * ((patch.diameter_mm ?? 0) / 1000) ** 2) / 4;
  const size = patch.size_mm ?? [0, 0];
  return (size[0] / 1000) * (size[1] / 1000);
}

/**
 * A record as the game's `WashManifest`: a level made of the record's items and soils, the
 * exact poses, and the player-visible load manifest (reference points rounded to 0.1 mm, as
 * the session writes them). Items with a custom shape are left out and listed.
 *
 * `spec` and `config` are the machine as `machineOfRecord` returns it.
 */
export function washManifestFromRecord(
  record: WashRecord,
  spec: MachineSpec,
  config: MachineConfig,
): ManifestFromRecord {
  const frames = frameOrigins(spec, config);
  const omitted: string[] = [];
  const notes: string[] = [];
  const levelItems: LevelItem[] = [];
  const items: WashManifestItem[] = [];
  const wire: LoadManifest['items'][number][] = [];
  const sorted = [...record.load.items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const item of sorted) {
    if (item.custom !== undefined || !hasItemType(item.type)) {
      omitted.push(item.id);
      continue;
    }
    const instance = instantiate(item.type);
    const soils: LevelSoil[] = item.soils.map((soil, k) => {
      let type = soil.type;
      if (!hasSoil(type)) {
        const stand = catalogueSoilOfClass(type);
        notes.push(
          `${item.id}.${soilIdOf(soil, k)}: model class "${type}" is shown as catalogue soil "${stand ?? 'none'}"`,
        );
        type = stand ?? type;
      }
      let regions: LevelSoil['regions'];
      if ('patch' in soil.where) {
        const patch = soil.where.patch;
        const regionArea = instance.regionAreas[patch.region] ?? 0;
        const coverage =
          regionArea > 0 ? Math.min(1, Math.max(patchOutlineArea(patch) / regionArea, 1e-3)) : 1;
        regions = [{ region: patch.region, coverage }];
        notes.push(
          `${item.id}.${soilIdOf(soil, k)}: the patch is shown as ${(coverage * 100).toFixed(0)} % of region "${patch.region}"`,
        );
      } else {
        regions = soil.where.regions.map((r) => ({ region: r.region, coverage: r.coverage }));
      }
      return {
        type,
        regions,
        amountG: soil.amount_g,
        ageH: soil.drying.time_h,
        heatHistory: soil.heat.history,
        ...(soil.recipe === undefined ? {} : { description: soil.recipe }),
      };
    });
    const pose = poseOfItem(item, frames);
    const points = getItemType(item.type).game.defaultPoints;
    levelItems.push({ id: item.id, itemType: item.type, points, soils });
    items.push({ item_id: item.id, item_type: item.type, pose, soils, points });
    const reference = quatRotate(pose.q, instance.referencePoint);
    const grid: Quat = quantiseQuatGrid(pose.q) ?? [0, 0, 0, 1];
    wire.push({
      item_id: item.id,
      frame: 'tub',
      position_mm: [
        roundToGrid((pose.p[0] + reference[0]) * 1000, 10),
        roundToGrid((pose.p[1] + reference[1]) * 1000, 10),
        roundToGrid((pose.p[2] + reference[2]) * 1000, 10),
      ],
      quat_wxyz: quatToWire(grid),
    });
  }
  const levelId = record.id
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '-')
    .slice(0, 64);
  const level: Level = {
    id: levelId,
    title: record.title ?? `Wash record ${record.id}`,
    summary: `The load of wash record ${record.id}, as it went into the machine.`,
    machineId: spec.id,
    config,
    racks: {},
    programmeId: record.programme.id,
    items: levelItems,
    rules: {
      track: 'one_shot',
      actionsMax: Math.max(1, 4 * levelItems.length),
      queriesMax: Math.max(1, 8 * levelItems.length),
      washesMax: 1,
      mechanicalChecks: true,
    },
    seed: (record.sim?.level_seed ?? 1) >>> 0,
    manual: null,
  };
  const rackOptionValues: Record<string, string> = {};
  for (const option of rackOptions(spec, config)) {
    rackOptionValues[`${option.rack}.${option.name}`] = option.value;
  }
  const load: LoadManifest = {
    benchmark_version: BENCHMARK_VERSION,
    level_id: level.id,
    machine_id: spec.id,
    programme_id: record.programme.id,
    rack_options: rackOptionValues,
    items: wire,
    state_hash: canonicalHash({ record: record.id, items: items.map((i) => [i.item_id, i.pose]) }),
  };
  return {
    manifest: {
      load,
      level,
      machine_id: spec.id,
      machine_config: config,
      programme_id: record.programme.id,
      items,
      unloaded: [],
      seed: level.seed,
    },
    omitted,
    notes,
  };
}
