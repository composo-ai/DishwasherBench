/**
 * The stage interface of surface water in the first build (docs/design/scope.md, "Indirect
 * water" and "Drainage and pooling"; docs/design/sim-core.md section M7): what happens to the
 * water once it is on a surface.
 *
 * For one spray state the stage produces one plain table per block, the
 * {@link SurfaceWaterTable}, and the rate at which every basin of the scene takes in water.
 *
 * Units: SI. Index spaces: the blocks and basins of the `WashScene`.
 */

import type { ExposureStageInput, JetHandover, WaterArrival } from '@spotless/sim-jets';
import type { DripTransfer, DropletDeposits } from '@spotless/sim-spray';

/**
 * The columns of {@link SurfaceWaterTable.values}, in order. All describe the block while the
 * spray state is active and periodic, except the last two, which describe it after the spray
 * has stopped.
 *
 * - `wetFraction`: time-mean share of the bare surface of the block that liquid water covers,
 *   0 to 1 (1 under a film, the width share of a rivulet, the covered share of beads). It is
 *   what the substrate does with the water: for retained water and drying;
 * - `flux`: water the block receives per unit of its area, from the air and from the surface
 *   above it, time-mean, kg/(m2 s);
 * - `thickness`: mean thickness of the FLOWING film while the block is wet, metres. Water the
 *   block holds back and that stands still (a pendant ridge at a drip edge, a puddle, the
 *   meniscus of a contact) is not part of it: that is in `retained`;
 * - `shear`: mean wall shear stress of that flowing film while the block is wet, Pa (jets
 *   excluded: those are in the jet table). 0 where water only stands;
 * - `renewal`: rate at which the water on the block is replaced along a run of
 *   `film.renewalLength`, 1/s: the discharge per width over all the water per area (flowing,
 *   held back and beads), divided by that length. With the default length (the block side of
 *   the fast tier) it is the water that leaves a block over the water on it, at either tier.
 *   Small where water stands. It is a local speed: it does not know how far the water has
 *   already run over the item (see `exchange`);
 * - `poolDepth`: for a block of a basin that takes in water in this state, the depth of water
 *   over it when the basin is full, metres; 0 for every other block. Whether the block is
 *   under water at a given moment follows from the level of its basin, which the replay keeps;
 * - `retained`: water left on the block after the spray has stopped and the film has drained,
 *   kg/m2 (residual film and drops; pools are not included);
 * - `holdTime`: time the block stays wet after the water stops arriving, seconds;
 * - `wetTime`: fraction of the time there is any liquid water on the block (film, rivulet or
 *   drops), 0 to 1. This is what a soil deposit on the block sees: a hydrophilic deposit under
 *   a rivulet or under drops is wetted, whatever the bare substrate would do;
 * - `exchange`: rate at which the liquor on the block is replaced by liquor from the bulk, 1/s:
 *   the inverse of the mean time since the water on it left the air (a jet, a droplet). Water
 *   that has run a long way over the item, stands in a gap or a puddle, or left a full vessel
 *   is old, and the rate is low; under a jet fan or in dense spray it is high. It does not
 *   depend on the block size. 0 where nothing replaces the water (and on a dry block). This
 *   is the column for "how fast is the liquor here renewed" (films 12.9: fresh against
 *   run-off liquor).
 */
export const WATER_FIELDS = [
  'wetFraction',
  'flux',
  'thickness',
  'shear',
  'renewal',
  'poolDepth',
  'retained',
  'holdTime',
  'wetTime',
  'exchange',
] as const;

/** Name of a column of the surface-water table. */
export type WaterField = (typeof WATER_FIELDS)[number];

/** Number of columns of the surface-water table. */
export const WATER_FIELD_COUNT = WATER_FIELDS.length;

/** Column index of each field of the surface-water table. */
export const WATER_FIELD = {
  wetFraction: 0,
  flux: 1,
  thickness: 2,
  shear: 3,
  renewal: 4,
  poolDepth: 5,
  retained: 6,
  holdTime: 7,
  wetTime: 8,
  exchange: 9,
} as const satisfies Readonly<Record<WaterField, number>>;

/** The water on every block of a scene in one spray state. */
export interface SurfaceWaterTable {
  /** Number of blocks of the scene the table was computed for. */
  readonly blockCount: number;
  /** {@link WATER_FIELD_COUNT} numbers per block, in the order of {@link WATER_FIELDS}. */
  readonly values: Float32Array;
}

/**
 * What the real surface-water stage reports about its march (docs/design/sim-core.md M7.7).
 * Masses in whole units of `WATER_UNIT` unless a name says kilograms.
 */
export interface FilmReport {
  /** Steps per revolution, and the revolutions marched: pilot (coarse), settle, recorded. */
  readonly steps: number;
  readonly pilotRevolutions: number;
  readonly settleRevolutions: number;
  readonly recordedRevolutions: number;
  /** Fed per revolution (hand-over of the jets plus droplets). */
  readonly fedPerRevolution: number;
  /**
   * Over the whole march up to the end of the recorded revolutions: fed in, made up from
   * outside the balance when the pilot first wets a block that holds water back (pendant
   * ridges, puddles, bridges), returned to the sump, and held on the surfaces at that moment.
   * `fed + primed = toSump + stored`, exactly.
   */
  readonly fed: number;
  readonly primed: number;
  readonly toSump: number;
  readonly stored: number;
  /** Returned to the sump in the last recorded revolution. */
  readonly sumpLastRevolution: number;
  /**
   * Change of the water held on the surfaces over the last recorded revolution, as a share of
   * what is fed per revolution: the distance from the periodic state (eps_mass).
   */
  readonly storedChange: number;
  /** Area share of blocks whose wetted share changed by more than 0.1 between the last two recorded revolutions (eps_wet). */
  readonly wetChange: number;
  /** True when `|storedChange|` is within `film.massTolerance`. */
  readonly converged: boolean;
  /** Water on the wash items at the end of the recorded revolutions, film and beads, kg. */
  readonly heldOnItems: number;
  /** Water the basins that take in water hold when full, kg. */
  readonly heldInBasins: number;
  /** Time-mean wetted share of the surface of the wash items, by area. */
  readonly itemWetFraction: number;
  /** Water left on the wash items after the drain-down, kg (pools excluded). */
  readonly retainedOnItems: number;
  /**
   * Mean time the water that returns to the sump has spent on the surfaces since it landed,
   * seconds, in the periodic state (flux-weighted; the flight of jets and droplets, tenths of
   * a second, is not in it). Absent in sets computed before it was reported.
   */
  readonly returnTime?: number;
}

/** What the surface-water stage reports besides its tables. */
export interface SurfaceWaterStats {
  /** Blocks that are ever wet, and their area, m2. */
  readonly wetBlocks: number;
  readonly wetArea: number;
  /** Water arriving out of the air, kg/s. */
  readonly arrivalRate: number;
  /** The real stage: its march and water balance. */
  readonly film?: FilmReport;
}

/**
 * What the real jet and secondary-water stages hand to the surface-water stage beside the
 * arrival flux: the hand-over of the jets by phase and the droplet deposits, both in integer
 * units, and the landing table of the drip sites. A stage given none of them (a stand-in
 * upstream) feeds the arrival flux as steady airborne water.
 */
export interface SurfaceWaterFeed {
  readonly handover?: JetHandover | undefined;
  readonly deposits?: DropletDeposits | undefined;
  readonly drips?: DripTransfer | undefined;
}

/** The output of the surface-water stage for one spray state. */
export interface SurfaceWaterOutput {
  readonly water: SurfaceWaterTable;
  /**
   * Per basin of the scene (`scene.basins` order): mass rate of water entering it while the
   * state is active, kg/s. 0 for a basin no water reaches.
   */
  readonly poolInflow: Float32Array;
  readonly stats: SurfaceWaterStats;
}

/**
 * The surface-water stage: the water that arrives out of the air (jets and secondary water
 * together) run over the surfaces of the scene. Asynchronous because the real stage runs on
 * the GPU; the stand-in of the first build is `surfaceWaterStandIn`.
 */
export type SurfaceWaterStage = (
  input: ExposureStageInput,
  arrival: WaterArrival,
  feed?: SurfaceWaterFeed,
) => Promise<SurfaceWaterOutput>;
