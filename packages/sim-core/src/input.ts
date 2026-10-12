/**
 * What a wash is computed from (docs/design/sim-core.md section M12, in the form of the first
 * build), and the same as a plain JSON description for the command line and for wash records.
 *
 * Units: SI in `WashInput` (poses in metres, tub frame T); millimetres, degrees and
 * quaternions in (w, x, y, z) order in the JSON description, as on the wire
 * (docs/design/platform.md section 2).
 */

import { getItemType, hasItemType, instantiate } from '@spotless/catalogue';
import {
  degToRad,
  quatFromAxisAngle,
  quatMul,
  quatNormalise,
  type Pose,
  type Quat,
  type Vec3,
} from '@spotless/core';
import type { Shape } from '@spotless/geometry';
import {
  buildMachineGeometry,
  findMachine,
  findProgramme,
  PRIMARY_MACHINE,
  primaryProgramme,
  type MachineConfig,
  type MachineSpec,
  type ProgrammeSpec,
} from '@spotless/machine';
import type { ParamValue } from '@spotless/sim-params';
import type { ItemSoilRecord } from '@spotless/sim-scene';
import type { ParamSetRecord, WashDetergent } from './param-layers.ts';

/** One item of the load. */
export interface WashItemInput {
  /** Item instance id, unique in the load. */
  readonly itemId: string;
  /** Catalogue item type id. */
  readonly typeId: string;
  /** Item frame to tub frame, metres. */
  readonly pose: Pose;
  /** The soils on the item. */
  readonly soils: readonly ItemSoilRecord[];
  /** The item's shape, for an item that is not in the catalogue; default: the catalogue's. */
  readonly shape?: Shape;
}

/** Everything one wash is computed from. The same input gives the same result. */
export interface WashInput {
  readonly machine: MachineSpec;
  /** Machine configuration; default: the machine's own. */
  readonly config?: MachineConfig;
  readonly programme: ProgrammeSpec;
  readonly items: readonly WashItemInput[];
  /** `official` (2 mm blocks) or `fast` (4 mm blocks). */
  readonly tier: 'official' | 'fast';
  /** Seed of what belongs to the level: where on a region a soil lies and how thick (u32). */
  readonly levelSeed: number;
  /** Seed of what belongs to the wash: the sampling of the exposure (u32). */
  readonly simSeed: number;
  /** Parameter overrides on the registry defaults, by key. */
  readonly params?: Readonly<Record<string, ParamValue>>;
  /**
   * The named sets `params` was composed from, for the record (`composeParamLayers`): they
   * are copied into the provenance of the result and are part of the input hash, but nothing
   * is computed from them.
   */
  readonly paramSets?: readonly ParamSetRecord[];
  /**
   * The detergent that is dosed: its mass replaces the machine's `dosing.detergentMass`.
   * Its composition is a layer of `params`. Default: the dose of the machine as given, of the
   * reference detergent the registry defaults describe. The exposure of a load does not
   * depend on it.
   */
  readonly detergent?: WashDetergent;
  /** True when the load keeps the dispenser lid from opening. */
  readonly dispenserBlocked?: boolean;
  /** Arms the load holds still: spray level id to the arm angle (radians) it stands at. */
  readonly stalledArms?: Readonly<Record<string, number>>;
}

/** One soil of an item in a JSON description. */
export interface SoilDescription {
  /** Catalogue soil id (`egg_yolk_dried`) or a model soil class (`egg_yolk`). */
  readonly type: string;
  /** Regions it lies on with the covered share of each; a bare string means all of the region. */
  readonly regions: readonly (string | { readonly region: string; readonly coverage?: number })[];
  /** Amount as applied (wet), grams, over all its regions. */
  readonly amount_g: number;
  /** Hours since it was applied; default 2. */
  readonly age_h?: number;
  /** `none`, `warm`, `cooked`, `baked` or `burnt`; default `none`. */
  readonly heat_history?: ItemSoilRecord['heat_history'];
}

/** One item of a JSON description. */
export interface ItemDescription {
  readonly id: string;
  /** Catalogue item type id. */
  readonly type: string;
  /**
   * The frame the position is given in: `tub` (default) or the frame of a basket
   * (`lower_rack`, `upper_rack`), whose axes are parallel to the tub's.
   */
  readonly frame?: string;
  /** Position of the origin of the item frame in that frame, millimetres. */
  readonly position_mm: readonly [number, number, number];
  /** Item frame to placement frame as a quaternion (w, x, y, z); default: no rotation. */
  readonly quat_wxyz?: readonly [number, number, number, number];
  /**
   * Instead of `quat_wxyz`: one of the named orientations of the item type (`upright`,
   * `inverted`, `on_edge`, ...), optionally turned by `yaw_deg` about the vertical afterwards.
   */
  readonly orientation?: string;
  readonly yaw_deg?: number;
  readonly soils?: readonly SoilDescription[];
}

/** A wash as a plain JSON document: what `pnpm spotless-wash` reads. */
export interface WashDescription {
  /** Machine id; default the owner's machine. */
  readonly machine?: string;
  /** Programme id of that machine; default its primary programme. */
  readonly programme?: string;
  /** Height position of each adjustable basket: basket id to position id. */
  readonly basketHeights?: Readonly<Record<string, string>>;
  /**
   * The whole configuration of the machine the load stands in, as the game's wash manifest
   * carries it (`machine_config`): basket heights, folded tine rows, the state of every shelf
   * and where the cutlery basket stands (null: taken out). When given it is the configuration
   * of the wash and `basketHeights` is ignored. Without it the machine is in its default
   * configuration with `basketHeights` laid over it; a load made with a cup shelf folded
   * down, the knife shelf folded up or the cutlery basket moved must give it, or its items
   * stand in the air or inside a part.
   */
  readonly machineConfig?: MachineConfig;
  readonly tier?: 'official' | 'fast';
  readonly levelSeed?: number;
  readonly simSeed?: number;
  readonly params?: Readonly<Record<string, ParamValue>>;
  /**
   * Named parameter-set files (`spotless.params`) laid over the registry defaults in order,
   * before `params`; paths are taken from the directory of the description. Read by
   * `runWashFile` (`@spotless/sim-core/node`), not by `washInputFromDescription`.
   */
  readonly paramSets?: readonly string[];
  /**
   * The detergent dosed: a name, the mass of the dose in grams, and optionally the
   * parameter-set file of its composition (laid over the sets above as a detergent layer).
   */
  readonly detergent?: {
    readonly name?: string;
    readonly dose_g: number;
    readonly params?: string;
  };
  readonly dispenserBlocked?: boolean;
  /**
   * Arms the load holds still: spray level id (`lower`, `upper`) to the angle the arm stands
   * at, in degrees (the azimuth of its '+' blade from +x towards +y).
   */
  readonly stalledArms_deg?: Readonly<Record<string, number>>;
  readonly items: readonly ItemDescription[];
}

/** Thrown for a JSON description that does not describe a wash; the message says why. */
export class WashDescriptionError extends Error {
  override readonly name = 'WashDescriptionError';
}

function fail(message: string): never {
  throw new WashDescriptionError(message);
}

/** `Array.isArray` without its narrowing (which turns a read-only list into `any[]`). */
function isList(value: unknown): boolean {
  return Array.isArray(value);
}

function isNumbers(value: unknown, length: number): boolean {
  return (
    Array.isArray(value) &&
    value.length === length &&
    value.every((v) => typeof v === 'number' && Number.isFinite(v))
  );
}

/**
 * The wash a JSON description describes. Throws `WashDescriptionError` for an unknown machine,
 * programme, item type, frame or orientation, and for a malformed item.
 */
export function washInputFromDescription(description: WashDescription): WashInput {
  const machine =
    description.machine === undefined ? PRIMARY_MACHINE : findMachine(description.machine);
  if (machine === undefined) fail(`unknown machine "${description.machine}"`);
  const programme =
    description.programme === undefined
      ? primaryProgramme(machine)
      : findProgramme(machine, description.programme);
  if (programme === undefined) {
    fail(`machine ${machine.id} has no programme "${description.programme}"`);
  }
  const config: MachineConfig =
    description.machineConfig !== undefined
      ? description.machineConfig
      : description.basketHeights === undefined
        ? machine.defaultConfig
        : {
            ...machine.defaultConfig,
            basketHeights: {
              ...machine.defaultConfig.basketHeights,
              ...description.basketHeights,
            },
          };
  let frames: Map<string, Vec3>;
  try {
    frames = new Map(
      buildMachineGeometry(machine, config).affordances.baskets.map((b) => [b.frame, b.originTub]),
    );
  } catch (error) {
    fail(
      `invalid machine configuration: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!isList(description.items)) fail('items must be a list');
  const seen = new Set<string>();
  const items: WashItemInput[] = description.items.map((item, index) => {
    const where = `items[${index}]${typeof item.id === 'string' ? ` (${item.id})` : ''}`;
    if (typeof item.id !== 'string' || item.id === '') fail(`${where}: id is missing`);
    if (seen.has(item.id)) fail(`${where}: id is used twice`);
    seen.add(item.id);
    if (typeof item.type !== 'string' || !hasItemType(item.type)) {
      fail(`${where}: unknown item type "${String(item.type)}"`);
    }
    const p = item.position_mm;
    if (!isNumbers(p, 3)) fail(`${where}: position_mm must be three numbers`);
    const frame = item.frame ?? 'tub';
    const origin: Vec3 | undefined = frame === 'tub' ? [0, 0, 0] : frames.get(frame);
    if (origin === undefined) {
      fail(`${where}: unknown frame "${frame}" (tub, ${[...frames.keys()].join(', ')})`);
    }
    let q: Quat = [0, 0, 0, 1];
    if (item.quat_wxyz !== undefined) {
      const w = item.quat_wxyz;
      if (!isNumbers(w, 4)) fail(`${where}: quat_wxyz must be four numbers`);
      if (Math.hypot(w[0], w[1], w[2], w[3]) < 1e-9) fail(`${where}: quat_wxyz is zero`);
      q = quatNormalise([w[1], w[2], w[3], w[0]]);
    } else if (item.orientation !== undefined) {
      const named = instantiate(item.type).stablePoses.find((s) => s.name === item.orientation);
      if (named === undefined) {
        const names = instantiate(item.type)
          .stablePoses.map((s) => s.name)
          .join(', ');
        fail(`${where}: ${item.type} has no orientation "${item.orientation}" (${names})`);
      }
      q = named.q;
    }
    if (item.yaw_deg !== undefined) {
      q = quatMul(quatFromAxisAngle([0, 0, 1], degToRad(item.yaw_deg)), q);
    }
    const type = getItemType(item.type);
    const soils: ItemSoilRecord[] = (item.soils ?? []).map((soil, k) => {
      if (typeof soil.type !== 'string') fail(`${where}: soils[${k}].type is missing`);
      if (typeof soil.amount_g !== 'number' || !(soil.amount_g >= 0)) {
        fail(`${where}: soils[${k}].amount_g must be a number of grams`);
      }
      if (!isList(soil.regions) || soil.regions.length === 0) {
        fail(`${where}: soils[${k}].regions must name at least one region`);
      }
      return {
        type: soil.type,
        regions: soil.regions.map((r) =>
          typeof r === 'string'
            ? { region: r, coverage: 1 }
            : { region: r.region, coverage: r.coverage ?? 1 },
        ),
        amount_g: soil.amount_g,
        age_h: soil.age_h ?? 2,
        heat_history: soil.heat_history ?? 'none',
      };
    });
    return {
      itemId: item.id,
      typeId: type.id,
      pose: {
        p: [origin[0] + p[0] / 1000, origin[1] + p[1] / 1000, origin[2] + p[2] / 1000],
        q,
      },
      soils,
    };
  });
  return {
    machine,
    config,
    programme,
    items,
    tier: description.tier ?? 'fast',
    levelSeed: description.levelSeed ?? 1,
    simSeed: description.simSeed ?? 1,
    ...(description.params === undefined ? {} : { params: description.params }),
    ...(description.detergent === undefined ? {} : { detergent: detergentOf(description) }),
    ...(description.dispenserBlocked === undefined
      ? {}
      : { dispenserBlocked: description.dispenserBlocked }),
    ...(description.stalledArms_deg === undefined
      ? {}
      : { stalledArms: stalledArmsOf(description.stalledArms_deg) }),
  };
}

/** The detergent of a description as the wash takes it (dose in kilograms). */
function detergentOf(description: WashDescription): WashDetergent {
  const detergent = description.detergent;
  if (
    detergent === undefined ||
    typeof detergent.dose_g !== 'number' ||
    !(detergent.dose_g >= 0) ||
    !Number.isFinite(detergent.dose_g)
  ) {
    throw new WashDescriptionError('detergent.dose_g must be a mass in grams');
  }
  return { name: detergent.name ?? 'unnamed detergent', dose: detergent.dose_g / 1000 };
}

function stalledArmsOf(degrees: Readonly<Record<string, number>>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const level of Object.keys(degrees).sort()) {
    const angle = degrees[level];
    if (typeof angle !== 'number' || !Number.isFinite(angle)) {
      throw new WashDescriptionError(`stalledArms_deg.${level} must be an angle in degrees`);
    }
    out[level] = degToRad(angle);
  }
  return out;
}
