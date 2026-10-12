/**
 * A saved standard load as the wash simulation's input.
 *
 * The wash simulation reads a plain JSON document (`WashDescription` in
 * `packages/sim-core/src/input.ts`, the input of `spotless-wash`): machine, programme, basket
 * heights, tier, seeds and the items with pose and soils. {@link washDescriptionOf} writes that
 * document from a load's wash manifest. The type is repeated here structurally so that this
 * package does not depend on the simulation packages.
 */

import type { MachineConfig } from '@spotless/machine';
import { cutleryBasketPositionId, findMachine } from '@spotless/machine';
import type { StandardLoad } from './standard-loads.ts';

/** One soil of an item of a wash description. */
export interface ExportedSoil {
  readonly type: string;
  readonly regions: readonly { readonly region: string; readonly coverage: number }[];
  readonly amount_g: number;
  readonly age_h: number;
  readonly heat_history: 'none' | 'warm' | 'cooked' | 'baked' | 'burnt';
}

/** One item of a wash description: the origin of its item frame in the tub frame. */
export interface ExportedItem {
  readonly id: string;
  readonly type: string;
  readonly frame: 'tub';
  /** Origin of the item frame, millimetres (not the reference point the session reports). */
  readonly position_mm: readonly [number, number, number];
  /** Item frame to tub frame, (w, x, y, z). */
  readonly quat_wxyz: readonly [number, number, number, number];
  readonly soils: readonly ExportedSoil[];
}

/** A wash description: structurally `WashDescription` of `@spotless/sim-core`. */
export interface ExportedWash {
  readonly machine: string;
  readonly programme: string;
  readonly basketHeights: Readonly<Record<string, string>>;
  /**
   * The whole machine configuration the load was frozen in: basket heights, folded rows, every
   * shelf and where the cutlery basket stands. The wash is built in it
   * (`WashDescription.machineConfig`).
   */
  readonly machineConfig: MachineConfig;
  readonly tier: 'official' | 'fast';
  readonly levelSeed: number;
  readonly simSeed: number;
  /** True when the load keeps the dispenser lid from opening or the tablet from falling. */
  readonly dispenserBlocked: boolean;
  readonly items: readonly ExportedItem[];
}

/** What a wash description cannot say and the caller of `wash()` has to pass itself. */
export interface ExportNotes {
  /**
   * Arms the load holds still, by spray level id, with the angle in degrees at which
   * `check_load` found the arm stopped; `WashInput.stalledArms` wants radians.
   */
  readonly stalledArms: Readonly<Record<string, number>>;
  /**
   * True when the load was frozen with rows folded, shelves moved or the cutlery basket stood
   * elsewhere than in the machine's default configuration.
   */
  readonly configDiffersBeyondHeights: boolean;
  /**
   * The whole machine configuration the load was frozen in, as `description.machineConfig`
   * also carries it (kept here for callers that read the notes).
   */
  readonly machineConfig: MachineConfig;
  /**
   * Where the cutlery basket stood: the id of its named position, `out` when it was taken out
   * of the machine, `elsewhere` for a place without a name.
   */
  readonly cutleryBasket: string;
  /**
   * The shelves that stand otherwise than in the machine's default configuration, as
   * `'<basket>.<shelf>: <state>'`. Items stand on a folded-down cup shelf and under a folded-up
   * knife shelf; the description's `machineConfig` has them.
   */
  readonly shelvesMoved: readonly string[];
}

/** Options of {@link washDescriptionOf}. */
export interface WashExportOptions {
  readonly tier?: 'official' | 'fast';
  /** Seed of the wash's own sampling; default 1. */
  readonly simSeed?: number;
}

/**
 * The wash description of a saved load: every loaded item at its settled pose (exact, as the
 * loading physics left it) with its soils, the machine, the programme and the level's seed.
 */
export function washDescriptionOf(
  load: StandardLoad,
  options: WashExportOptions = {},
): { description: ExportedWash; notes: ExportNotes } {
  const manifest = load.wash_manifest;
  const stalled: Record<string, number> = {};
  for (const arm of load.check.spray_arms) {
    if (!arm.full_rotation) {
      stalled[arm.arm.replace(/_arm$/, '')] = arm.first_contact_angle_deg ?? 0;
    }
  }
  const config = manifest.machine_config;
  const description: ExportedWash = {
    machine: manifest.machine_id,
    programme: manifest.programme_id,
    basketHeights: { ...config.basketHeights },
    machineConfig: config,
    tier: options.tier ?? 'fast',
    levelSeed: manifest.seed,
    simSeed: options.simSeed ?? 1,
    dispenserBlocked: !load.check.dispenser_opens || !load.check.tablet_path_clear,
    items: manifest.items.map((item) => ({
      id: item.item_id,
      type: item.item_type,
      frame: 'tub' as const,
      position_mm: [item.pose.p[0] * 1000, item.pose.p[1] * 1000, item.pose.p[2] * 1000] as const,
      quat_wxyz: [item.pose.q[3], item.pose.q[0], item.pose.q[1], item.pose.q[2]] as const,
      soils: item.soils.map((soil) => ({
        type: soil.type,
        regions: soil.regions.map((r) => ({ region: r.region, coverage: r.coverage })),
        amount_g: soil.amountG,
        age_h: soil.ageH,
        heat_history: soil.heatHistory,
      })),
    })),
  };
  const defaults = findMachine(manifest.machine_id)?.defaultConfig.shelves ?? [];
  const shelvesMoved = config.shelves
    .filter((shelf) => {
      const usual = defaults.find(
        (d) => d.basketId === shelf.basketId && d.shelfId === shelf.shelfId,
      );
      return usual !== undefined && usual.state !== shelf.state;
    })
    .map((shelf) => `${shelf.basketId}.${shelf.shelfId}: ${shelf.state}`);
  const spec = findMachine(manifest.machine_id);
  const standsAt =
    config.cutleryBasket === null
      ? 'out'
      : spec === undefined
        ? 'elsewhere'
        : (cutleryBasketPositionId(spec, config) ?? 'elsewhere');
  const usualPlace = spec === undefined ? null : cutleryBasketPositionId(spec, spec.defaultConfig);
  return {
    description,
    notes: {
      stalledArms: stalled,
      configDiffersBeyondHeights:
        config.foldedTineRows.length > 0 || shelvesMoved.length > 0 || standsAt !== usualPlace,
      shelvesMoved,
      machineConfig: config,
      cutleryBasket: standsAt,
    },
  };
}
