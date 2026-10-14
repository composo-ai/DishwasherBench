/**
 * Wire types of the level card: everything static about a level that a player is shown
 * (docs/research/benchmark.md section 3.2 a). They are part of the session contract and are
 * re-exported unchanged by `@spotless/session`; they are declared here because the level card
 * is built from level data, and the session depends on this package, not the other way round.
 *
 * Plain JSON, snake_case keys, millimetres and degrees, quaternions as `quat_wxyz` in
 * (w, x, y, z) order. Nothing here says anything about the soil model's constants or about the
 * outcome of a wash.
 */

import type { RackZone, SoilHeatHistory } from '@spotless/catalogue';
import type { QuatWxyz } from '@spotless/core';

/** A position or size in millimetres, `[x, y, z]`. */
export type Vec3Mm = readonly [x: number, y: number, z: number];

/**
 * Racks and baskets that carry a frame and can be loaded: `'lower_rack'`, `'upper_rack'`,
 * `'third_rack'` or `'cutlery_basket'`. The same type as the catalogue's `RackZone`, which
 * item types use to say where they usually go, so the two cannot drift apart.
 */
export type RackId = RackZone;

/** A PNG image returned inline. */
export interface WireImage {
  readonly mime_type: 'image/png';
  readonly width_px: number;
  readonly height_px: number;
  /** Base64-encoded image bytes. */
  readonly data_base64: string;
}

/** One adjustable feature of a rack, changed with the `set_rack` action. */
export interface RackOptionCard {
  /** Option name, for example `'position'`, `'height'` or `'tine_row_r1'`. */
  readonly name: string;
  /** What the option does, in words. */
  readonly description: string;
  /** Allowed values, for example `['in', 'out']` or `['up', 'folded']`. */
  readonly values: readonly string[];
}

/** Player-visible description of one rack or basket. */
export interface RackCard {
  readonly rack: RackId;
  /** Origin of the rack frame in the tub frame when the rack is pushed in, millimetres. */
  readonly origin_in_mm: Vec3Mm;
  /** Origin of the rack frame in the tub frame when the rack is pulled out, millimetres. */
  readonly origin_out_mm: Vec3Mm;
  /**
   * Size of the loading envelope along the rack-frame axes from the rack origin, millimetres.
   * The height is what is clear above the top of the base grid over the whole basket: up to
   * the floor of the basket above, or to the roof of the tub. See `low_spots`.
   */
  readonly envelope_mm: Vec3Mm;
  /**
   * Places where less height is clear than the envelope says: the circle the spray arm above
   * sweeps (its blades, and lower still its hub), the sprayer in the roof. Each is a disc in
   * plan, given in the rack frame with the rack pushed in. Absent when there is none.
   */
  readonly low_spots?: readonly {
    /** What hangs there, for example `roof_sprayer`. */
    readonly under: string;
    /** Height clear under it above the top of the base grid, millimetres. */
    readonly clear_height_mm: number;
    /** Centre (x, y) of the disc in the rack frame, millimetres. */
    readonly centre_mm: readonly [number, number];
    readonly radius_mm: number;
  }[];
  /**
   * The tray that catches the detergent tablet, where the basket carries one: the corners of
   * its box in the rack frame, millimetres. The tablet falls from the dispenser in the door
   * into it when the lid opens; an item standing in the tray or over it can keep the tablet
   * out of the water (`check_load` says whether the path is clear). Absent when the basket has
   * none.
   */
  readonly tablet_tray?: { readonly min_mm: Vec3Mm; readonly max_mm: Vec3Mm };
  /**
   * Adjustable features; empty if the rack has none. For a basket: `position` (in or out) and
   * what the machine offers. For the cutlery basket: `position`, the named place it stands at
   * (the origins above are those of the start of the level).
   */
  readonly options: readonly RackOptionCard[];
}

/** Player-visible description of one spray arm. */
export interface SprayArmCard {
  readonly arm: string;
  /** Hub position on the rotation axis in the tub frame, millimetres. */
  readonly hub_mm: Vec3Mm;
  /** Radius of the swept disc, millimetres. */
  readonly radius_mm: number;
  /** Lowest and highest z of the swept volume in the tub frame, millimetres. */
  readonly sweep_z_mm: readonly [number, number];
}

/** Player-visible description of the detergent dispenser. */
export interface DispenserCard {
  /** Corners of the lid's swept volume with the door closed, tub frame, millimetres. */
  readonly lid_sweep_min_mm: Vec3Mm;
  readonly lid_sweep_max_mm: Vec3Mm;
}

/**
 * What a user manual and an open door reveal about the machine. Detailed rack geometry (tine
 * rows, slot centres) is returned by the `list_slots` query.
 */
export interface MachineCard {
  readonly machine_id: string;
  readonly display_name: string;
  /** Corners of the tub interior in the tub frame, millimetres. */
  readonly tub_min_mm: Vec3Mm;
  readonly tub_max_mm: Vec3Mm;
  readonly racks: readonly RackCard[];
  readonly spray_arms: readonly SprayArmCard[];
  /** Null if the machine has no door-mounted dispenser. */
  readonly dispenser: DispenserCard | null;
}

/** One phase of a wash programme, as printed in a manual. */
export interface ProgrammePhaseCard {
  /** For example `'pre_rinse'`, `'main_wash'`, `'intermediate_rinse'`, `'final_rinse'`, `'drying'`. */
  readonly name: string;
  /** Nominal water temperature, degrees Celsius; null for phases without heating. */
  readonly temperature_c: number | null;
  /** Nominal duration, seconds. */
  readonly duration_s: number;
}

/** The programme is the one the level is scored on (Eco 50, the only one). */
export type ProgrammeStatus = 'scored';

/** Player-visible description of the wash programme. */
export interface ProgrammeCard {
  readonly programme_id: string;
  readonly display_name: string;
  readonly phases: readonly ProgrammePhaseCard[];
  /**
   * What is put in the dispenser: an identifier, the name on the pack and the dose in grams;
   * null if no detergent is used.
   */
  readonly detergent: {
    readonly type: string;
    readonly dose_g: number;
    readonly name?: string;
  } | null;
  /** Always `scored`: the level's own programme. */
  readonly status: ProgrammeStatus;
  /** What the status means for a player, in words. */
  readonly note: string;
}

/** A named orientation of an item, the same list that drives the rotate buttons in the UI. */
export interface OrientationPresetCard {
  /** For example `'upright'`, `'inverted'`, `'on_edge'`. */
  readonly name: string;
  readonly quat_wxyz: QuatWxyz;
  /** What the orientation looks like, in words. */
  readonly description?: string;
}

/**
 * How a soil was heated before the wash, as far as the cook would know: `'none'`, `'warm'`,
 * `'cooked'`, `'baked'` or `'burnt'`. Declared once, in the catalogue (whose soil types list the
 * heat histories that make sense for them and how each is described), and re-exported here
 * because it is part of the wire contract.
 */
export type { SoilHeatHistory };

/**
 * One soil on an item, described as a person who cooked and ate the meal would know it.
 * Adhesion strengths, kinetic constants and every other internal of the soil model are
 * deliberately absent.
 */
export interface ItemSoilRecord {
  /** Natural language, for example "Porridge, dried on for about 12 hours, inside base". */
  readonly description: string;
  /** Catalogue soil id. */
  readonly type: string;
  /** Named regions of the item that carry the soil, with the fraction of each that is covered. */
  readonly regions: readonly { readonly region: string; readonly coverage: number }[];
  /** Amount of soil, grams. */
  readonly amount_g: number;
  /** Time since soiling, hours. */
  readonly age_h: number;
  readonly heat_history: SoilHeatHistory;
}

/**
 * One item of the level. The benchmark dossier's `soil.*` fields are carried as a list
 * (`soils`) because an item can carry more than one soil (tea film inside, lipstick on the rim).
 */
export interface ItemRecord {
  /** Stable within the level, for example `'plate_03'`. */
  readonly item_id: string;
  /** Catalogue item class, for example `'dinner_plate'`. */
  readonly class: string;
  /** For example "Dinner plate, 27 cm". */
  readonly display_name: string;
  /** Catalogue material id of the body. */
  readonly material: string;
  readonly mass_kg: number;
  /** Size of the bounding box in the item's own frame, millimetres. */
  readonly bbox_mm: Vec3Mm;
  /**
   * The point of the item that `position_mm` refers to, in the item frame, millimetres: the
   * centre of the bounding box unless the item type says otherwise.
   */
  readonly reference_point_mm: Vec3Mm;
  /** Class-specific dimensions in millimetres (diameter, height, depth, handle length). */
  readonly dims: { readonly [name: string]: number };
  readonly orientation_presets: readonly OrientationPresetCard[];
  /** Empty for a clean item. */
  readonly soils: readonly ItemSoilRecord[];
  /** Points scored if the item comes out clean. */
  readonly points: number;
  /** Four fixed views showing the soil; present in `get_item`, omitted from the level card. */
  readonly thumbnails?: readonly WireImage[];
}

/** Which protocol the episode runs under (benchmark.md section 4.2). */
export type Track = 'one_shot' | 'adaptive' | 'campaign';

/** Caps on what a player may do in one level. */
export interface BudgetLimits {
  /** State-changing actions allowed. */
  readonly actions_max: number;
  /** Queries allowed. */
  readonly queries_max: number;
  /** Wash cycles allowed (1 in the one-shot track). */
  readonly washes_max: number;
}

/** Rules of the level, in words and numbers. */
export interface RulesCard {
  readonly track: Track;
  /** The scoring rule, in words. */
  readonly scoring: string;
  /** What "clean" means, in words. */
  readonly clean_definition: string;
  readonly budgets: BudgetLimits;
  /** What ends the episode, in words. */
  readonly episode_end: string;
  /** Whether the `check_load` query (mechanical facts only) is available in this level. */
  readonly mechanical_checks: boolean;
  /** Whether `place` accepts `mode: 'set'` (exact placement, for reproducing a recorded load). */
  readonly exact_placement: boolean;
}

/** Everything static about a level, delivered at the start and by `get_level`. */
export interface LevelCard {
  /** `spotless-<MAJOR>.<MINOR>.<PATCH>/levels-<id>`. */
  readonly benchmark_version: string;
  readonly level_id: string;
  /** Title of the level, for menus. */
  readonly title: string;
  /** What the level is, in a sentence or two. */
  readonly summary: string;
  readonly machine: MachineCard;
  /** The programme the level is scored on, and the default of `start_cycle`. */
  readonly programme: ProgrammeCard;
  /** Always empty: no other programme is offered (the field is kept in the card's format). */
  readonly secondary_programmes: readonly ProgrammeCard[];
  /** Sorted by `item_id`. */
  readonly items: readonly ItemRecord[];
  readonly rules: RulesCard;
  /** Generic guidance on the interface, identical for humans and agents; null if omitted. */
  readonly manual: string | null;
}
