/**
 * The level format: a level is data. It names the machine and how it is set up at the start,
 * the programme, the dirty items with their soils and points, the rules, and a seed.
 *
 * Authoring units: grams (`amountG`) and hours (`ageH`), with the unit in the field name
 * (docs/design/platform.md section 2). Everything is plain JSON, so a level can be stored,
 * hashed and sent as it is.
 */

import type { SoilHeatHistory } from '@spotless/catalogue';
import type { MachineConfig } from '@spotless/machine';
import type { RackId, Track } from './card-types.ts';

/** One soil on one item of a level. */
export interface LevelSoil {
  /** Catalogue soil id, for example `egg_yolk_dried`. */
  readonly type: string;
  /**
   * The named regions of the item that carry the soil (region ids of the item type, for example
   * `well` or `interior`) with the fraction of each that is covered, above 0 and at most 1.
   */
  readonly regions: readonly { readonly region: string; readonly coverage: number }[];
  /** Amount of soil on the item, grams. */
  readonly amountG: number;
  /** Hours since the meal. */
  readonly ageH: number;
  /** How the soil was heated; must be one the soil type allows. */
  readonly heatHistory: SoilHeatHistory;
  /**
   * How the level card describes the soil, in the words of whoever cooked and ate the meal.
   * When absent the card uses the catalogue's description of the soil, its age and its regions.
   */
  readonly description?: string;
}

/** One dirty (or clean) item of a level. */
export interface LevelItem {
  /** Instance id, unique in the level, for example `plate_03`. */
  readonly id: string;
  /** Catalogue item type id, for example `dinner_plate_porcelain_270`. */
  readonly itemType: string;
  /** Points scored if the item comes out clean; a positive whole number. */
  readonly points: number;
  /** The soils on it; empty for a clean item. */
  readonly soils: readonly LevelSoil[];
}

/** The rules of a level. */
export interface LevelRules {
  readonly track: Track;
  /** State-changing actions allowed (rejected calls are free). */
  readonly actionsMax: number;
  /** Queries allowed. */
  readonly queriesMax: number;
  /** Wash cycles allowed. */
  readonly washesMax: number;
  /** Whether the `check_load` query is available. */
  readonly mechanicalChecks: boolean;
  /**
   * Whether `place` accepts `mode: 'set'`: the item is put at exactly the stated pose (to
   * 0.1 mm) and only settles. For levels that reproduce a recorded load, such as a calibration
   * wash; absent or false in levels that are played.
   */
  readonly exactPlacement?: boolean;
}

/** Whether a rack is pushed into the tub or pulled out for loading. */
export type RackPosition = 'in' | 'out';

/** A level. */
export interface Level {
  /** Level id, a valid identifier (`weeknight-dinner`). */
  readonly id: string;
  readonly title: string;
  /** What the level is, in a sentence or two, as shown to the player. */
  readonly summary: string;
  /** Id of the machine (`bosch_smv4hax40g`). */
  readonly machineId: string;
  /**
   * How the machine is set up at the start (basket height, folded rows, shelves, where the
   * cutlery basket stands); null for the machine's own default configuration.
   */
  readonly config: MachineConfig | null;
  /**
   * Which racks are pulled out at the start; a rack that is not listed is pulled out if it is
   * the lowest basket and pushed in otherwise.
   */
  readonly racks: { readonly [rack in RackId]?: RackPosition };
  /** Id of the programme the level is scored on (`eco_50` on the owner's machine). */
  readonly programmeId: string;
  /** The items, in any order. */
  readonly items: readonly LevelItem[];
  readonly rules: LevelRules;
  /**
   * Seed of everything random in the wash of this level, a whole number from 0 to 2^32 - 1.
   * Never shown to players.
   */
  readonly seed: number;
  /** Guidance on the interface shown with the level; null for none. */
  readonly manual: string | null;
  /**
   * The place of the level in the course of the game, from 1 (`course.ts`): the levels are
   * listed, and meant to be played, in this order. Absent for a level outside the course.
   */
  readonly number?: number;
  /**
   * How hard the level is, on the scale of `levelDifficulty` (`course.ts`): from 1 (the
   * tutorial) to 10, to one decimal. It is worked out from the level's own items, soils and
   * points and rises along the course. Shown to players in the list of levels.
   */
  readonly difficulty?: number;
  /**
   * What the level adds to what a player has met in the levels before it, in one line. It
   * names what is on the counter, never where to put it. Shown as the last sentence of
   * `summary`.
   */
  readonly newHere?: string;
  /**
   * For a level made by the generator: the family it was drawn from and the seed that drew it
   * (`families/`). Absent for a hand-written level.
   */
  readonly family?: { readonly id: string; readonly seed: number };
}

/** Something wrong with a level, found by `validateLevel`. */
export interface LevelProblem {
  /** Where: `items.3.soils.0.regions.1`, `rules.actionsMax`, ... */
  readonly path: string;
  readonly message: string;
}
