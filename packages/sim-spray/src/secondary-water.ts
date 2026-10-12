/**
 * The stage interface of secondary (indirect) water in the first build (docs/design/scope.md,
 * "Indirect water"; docs/design/sim-core.md section M6): everything that reaches a surface out
 * of the air other than a coherent jet. Splatter of the jets, fans off wires and rims, broken
 * jets, and the droplet showers of fixed sprayers.
 *
 * The stage returns one plain table per spray state: a `WaterArrival`, the time-mean mass flux
 * onto every block that receives such water. The surface-water stage (`@spotless/sim-film`)
 * adds it to the arrival of the jets and lets it run off.
 *
 * Units: SI (kg/(m2 s)). Index space: the blocks of the `WashScene`.
 */

import type { ExposureStageInput, JetStageOutput, WaterArrival } from '@spotless/sim-jets';

/** What the secondary-water stage reports besides its table. */
export interface SecondaryWaterStats {
  /** Droplet paths traced, and how many ended on a surface. */
  readonly paths: number;
  readonly landed: number;
  /** Volume flow of the secondary water, and the part of it that landed nowhere, m3/s. */
  readonly flow: number;
  readonly lostFlow: number;
  /**
   * The real stage: how the landings were settled by the landing kernel, as shares of what
   * landed: pooled among the open faces of a neighbourhood, pooled among its faced ones, kept
   * on the face of an item that was struck, and landed on the machine or on a wire.
   */
  readonly settled?: {
    readonly pooledOpen: number;
    readonly pooledFaced: number;
    readonly keptOnItems: number;
    readonly onMachine: number;
  };
}

/**
 * What droplets land on the blocks of a scene, per revolution of the master arm: the blocks
 * that receive any, ascending, with the mass in whole units of `WATER_UNIT` (held in f64).
 */
export interface DropletDeposits {
  readonly blockCount: number;
  readonly block: Uint32Array;
  readonly mass: Float64Array;
}

/** The whole of a drip site's outflow in the weights of a {@link DripTransfer}. */
export const DRIP_WEIGHT_ONE = 65536;

/**
 * Where the water that leaves the drip sites of a scene lands: for every entry of
 * `scene.drips`, the blocks its drops (and the splash of those drops) land on, with the share
 * of the site's outflow each receives in units of 1 / {@link DRIP_WEIGHT_ONE}, and the share
 * that reaches nothing and returns to the sump. The rows of site `i` are
 * `offsets[i] .. offsets[i + 1] - 1`, ascending by block; with `sump[i]` they add up to
 * {@link DRIP_WEIGHT_ONE} exactly. It depends on the geometry only, so one table serves every
 * spray state of a scene.
 */
export interface DripTransfer {
  readonly siteCount: number;
  readonly offsets: Uint32Array;
  readonly target: Uint32Array;
  readonly weight: Uint32Array;
  readonly sump: Uint32Array;
}

/**
 * Where the secondary water of a spray state went, whole units of `WATER_UNIT` per revolution:
 * `sources + showers = deposited + lost`, exactly.
 */
export interface SprayLedger {
  /** Out of the droplet sources of the jets (splatter and fans). */
  readonly sources: number;
  /** Out of the fixed sprayers. */
  readonly showers: number;
  /** Landed on blocks. */
  readonly deposited: number;
  /** Struck nothing within the segment limit: counted as returned to the sump. */
  readonly lost: number;
}

/** The output of the secondary-water stage for one spray state. */
export interface SecondaryWaterOutput {
  readonly arrival: WaterArrival;
  readonly stats: SecondaryWaterStats;
  /** The real stage: what lands, in integer units. */
  readonly deposits?: DropletDeposits;
  /** The real stage: the landing table of the drip sites. */
  readonly drips?: DripTransfer;
  /** The real stage: the water balance of the droplets. */
  readonly ledger?: SprayLedger;
  /** The real stage: where the segments were traced. */
  readonly backend?: 'gpu' | 'cpu';
}

/**
 * The secondary-water stage: droplets of one spray state against the scene, given what the jet
 * stage found (the real stage emits splatter and fans where jets strike). Asynchronous because
 * the real stage runs on the GPU; the stand-in of the first build is
 * `secondaryWaterStandIn`.
 */
export type SecondaryWaterStage = (
  input: ExposureStageInput,
  jets: JetStageOutput,
) => Promise<SecondaryWaterOutput>;
