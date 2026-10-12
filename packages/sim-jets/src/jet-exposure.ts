/**
 * The stage interface of the primary jets in the first build (docs/design/scope.md, "Jet
 * access" and "What a jet does where it lands"; docs/design/sim-core.md section M5).
 *
 * For one spray state the jet stage produces two plain tables:
 *
 *  - {@link JetExposureTable}, per soil cell: what direct jets do to it over time;
 *  - {@link WaterArrival}, per block: the water the jets land on it, which the surface-water
 *    stage (`@spotless/sim-film`) lets run off.
 *
 * Both are sparse over the scene's index spaces (most surface is never under a jet) and are
 * sorted by index, so that they are the same whatever order the rays were traced in.
 *
 * Units: SI (Pa, N/m, kg/(m2 s)). Index spaces: the soil cells and blocks of the `WashScene`.
 */

import type { ParamSet, TierParams } from '@spotless/sim-params';
import type { GpuContext, WashScene } from '@spotless/sim-scene';
import type { SprayState } from '@spotless/sim-hydraulics';

/**
 * The integer unit of water mass of the exposure side, kilograms (docs/design/sim-core.md
 * M7.1: 10^-12 kg). Every hand-over between the jets, the droplets and the film is a whole
 * number of these units per revolution of the master arm, held in f64 (exact to 9 x 10^15
 * units, 9,000 kg), so that water is conserved exactly from the nozzles to the sump.
 */
export const WATER_UNIT = 1e-12;

/**
 * The columns of {@link JetExposureTable.values}, in order. `duty` is the fraction of time the
 * soil cell lies inside a jet footprint while the spray state is active (for one turning arm:
 * the fraction of each revolution). In the real stage the footprint is where the jet's wall
 * shear exceeds the first of `jets.shearLevels` (10 Pa by default). A `...Peak` is the
 * largest value the cell sees; a `...Mean` is the time-mean WHILE INSIDE a footprint, so that
 * the mean over all time is `duty x mean`.
 *
 * - `shear`: wall shear stress, Pa;
 * - `pressure`: wall pressure above ambient, Pa;
 * - `momentum`: momentum flux of the jet's radial film per unit width, c_M rho U^2 h, N/m;
 * - `wetDuty`: fraction of time the cell lies under the fast radial film of a jet at all
 *   (out to the film jump), whatever the shear;
 * - `shearDuty1` to `shearDuty3`: fraction of time the wall shear exceeds the second to the
 *   fourth of `jets.shearLevels` (`duty` is that of the first);
 * - `momentumDuty0` to `momentumDuty3`: fraction of time the momentum flux exceeds each of
 *   `jets.momentumLevels`.
 *
 * The stand-in fills the first seven columns and leaves the others at zero.
 *
 * Shear is that of water at `jets.solveTemperature`; the replay rescales it to the liquor
 * temperature of each tick (boundary-layer shear varies as the square root of the viscosity).
 */
export const JET_FIELDS = [
  'duty',
  'shearPeak',
  'shearMean',
  'pressurePeak',
  'pressureMean',
  'momentumPeak',
  'momentumMean',
  'wetDuty',
  'shearDuty1',
  'shearDuty2',
  'shearDuty3',
  'momentumDuty0',
  'momentumDuty1',
  'momentumDuty2',
  'momentumDuty3',
] as const;

/** Name of a column of the jet table. */
export type JetField = (typeof JET_FIELDS)[number];

/** Number of columns of the jet table. */
export const JET_FIELD_COUNT = JET_FIELDS.length;

/** Column index of each field of the jet table. */
export const JET_FIELD = {
  duty: 0,
  shearPeak: 1,
  shearMean: 2,
  pressurePeak: 3,
  pressureMean: 4,
  momentumPeak: 5,
  momentumMean: 6,
  wetDuty: 7,
  shearDuty1: 8,
  shearDuty2: 9,
  shearDuty3: 10,
  momentumDuty0: 11,
  momentumDuty1: 12,
  momentumDuty2: 13,
  momentumDuty3: 14,
} as const satisfies Readonly<Record<JetField, number>>;

/** What direct jets do to the soil cells of a scene in one spray state. */
export interface JetExposureTable {
  /** Number of soil cells of the scene the table was computed for. */
  readonly soilCellCount: number;
  /** The soil cells that are ever inside a footprint, ascending. */
  readonly cell: Uint32Array;
  /** {@link JET_FIELD_COUNT} numbers per entry of `cell`, in the order of {@link JET_FIELDS}. */
  readonly values: Float32Array;
}

/** Water that arrives on blocks out of the air, as a time-mean while a spray state is active. */
export interface WaterArrival {
  /** Number of blocks of the scene the table was computed for. */
  readonly blockCount: number;
  /** The blocks that receive water, ascending. */
  readonly block: Uint32Array;
  /** Per entry of `block`: mass flux onto the block, kg/(m2 s). */
  readonly flux: Float32Array;
}

/** What every stage of the exposure side is given. */
export interface ExposureStageInput {
  readonly scene: WashScene;
  readonly state: SprayState;
  /**
   * The spray level id of every rotating root of the scene's ray data (`scene.trace.roots`
   * with `rotating` set), in root order: which arm of `state` poses which root. A level that
   * the state does not feed stands at arm angle 0.
   */
  readonly armLevels: readonly string[];
  /** Parameter set built on the registry of the simulation. */
  readonly params: ParamSet;
  /** The tier (sampling counts of the real stages). */
  readonly tier: TierParams;
  /** The simulation seed (u32). */
  readonly seed: number;
  /**
   * The device the rays are traced on: a context, or `null` for the f64 reference tracer of
   * the scene. Left out, the stages use the device of the process (`trace-backend.ts`).
   */
  readonly gpu?: GpuContext | null;
  /**
   * Mass of the items by item id, kilograms. Where it is given, the jet stage reports the
   * largest lifting force of the jets on an item as a share of its weight.
   */
  readonly itemMass?: ReadonlyMap<string, number>;
  /** Called with the name of every step of a stage as it starts (for benchmarks; no clock is read). */
  readonly onStage?: (stage: string) => void;
}

/** What the jet stage reports besides its tables. */
export interface JetStageStats {
  /** Rays traced, and how many struck something. */
  readonly rays: number;
  readonly hits: number;
  /** Volume flow of the jets, and the part of it whose rays struck nothing, m3/s. */
  readonly flow: number;
  readonly lostFlow: number;
}

/**
 * What the jets hand to the film, by phase of the master arm: for every phase bin, the blocks
 * that receive liquid at the end of a fan while the arm is in that bin, with the mass per
 * revolution in units of {@link WATER_UNIT}. The entries of bin `k` are
 * `offsets[k] .. offsets[k + 1] - 1`, ascending by block.
 */
export interface JetHandover {
  readonly blockCount: number;
  /** Phase bins per revolution. */
  readonly bins: number;
  readonly offsets: Uint32Array;
  readonly block: Uint32Array;
  /** Whole units of {@link WATER_UNIT} per revolution, as f64. */
  readonly mass: Float64Array;
}

/** Kinds of droplet source the jet stage writes for the secondary-water stage. */
export const DROPLET_SOURCE = {
  /** Splatter of a footprint: droplets leave a ring about the source point, low over the wall. */
  splatter: 0,
  /** Two fan sheets off a wire or tine a jet strikes. */
  wireFan: 1,
  /** Droplets thrown off a convex rim or edge a jet strikes. */
  rimFan: 2,
} as const;

/**
 * The droplet sources of the jets of one spray state: one row per stretch of a footprint
 * track. Arrays hold one entry per source (three for the vectors). Tub frame, SI.
 */
export interface DropletSources {
  readonly count: number;
  /** {@link DROPLET_SOURCE}. */
  readonly kind: Uint8Array;
  /**
   * `splatter`: the source point S of the footprint (its rear focus), on the wall. Fans: the
   * point the jet strikes.
   */
  readonly origin: Float32Array;
  /**
   * `splatter`: outward unit normal of the wall. `wireFan`: unit axis of the wire. `rimFan`:
   * outward unit normal of the struck face.
   */
  readonly normal: Float32Array;
  /** `splatter`: forward unit tangent of the footprint. Fans: unit direction of the jet. */
  readonly forward: Float32Array;
  /** `splatter`: sine of the incidence. `wireFan`: radius of the wire, metres. `rimFan`: 0. */
  readonly shape: Float32Array;
  /** Speed of the jet at the wall, m/s. */
  readonly speed: Float32Array;
  /** Diameter of the jet (of its part that strikes), metres: droplet sizes scale with it. */
  readonly size: Float32Array;
  /** Mass per revolution, whole units of {@link WATER_UNIT}, as f64. */
  readonly mass: Float64Array;
  /**
   * A stable key per source: a hash of the jet (its place in `SprayState.jets`), the phase at
   * which its stretch of track began, the kind, and the stable key of the block that roots
   * the stretch (`sceneBlockKeys`). The random numbers of the droplets of a source are drawn
   * from counters under this key, so they do not change when something else in the machine
   * does. Absent in a table that was not made by the real jet stage.
   */
  readonly key?: Uint32Array;
  /**
   * The block that roots the stretch of track the source belongs to (the face the jet
   * struck): the body the droplets of the source leave. Absent in a table that was not made
   * by the real jet stage.
   */
  readonly block?: Uint32Array;
  /**
   * Which pose of its arm the source was sampled at: an index into
   * `JetStageOutput.armPoses[arm]`, with `arm` the index into `SprayState.arms` of the arm
   * that carries the jet. The droplets of the source fly past the arms as they stood then.
   */
  readonly arm?: Uint8Array;
  readonly pose?: Uint16Array;
}

/** The force of the jets on one item over a revolution. */
export interface ItemJetLoad {
  /** Instance index and id of the item. */
  readonly instance: number;
  readonly itemId: string;
  /** Time-mean force, tub frame, newtons. */
  readonly mean: readonly [number, number, number];
  /** Largest magnitude and largest upward (+z) component of the bin-mean force, newtons. */
  readonly peak: number;
  readonly peakUp: number;
  /**
   * `peakUp` over the weight of the item, where `ExposureStageInput.itemMass` gives its mass:
   * above about 1 the jets can lift the item. Absent when the mass is not known.
   */
  readonly liftRatio?: number;
}

/**
 * Where the water of the nozzles went in the jet stage, whole units of {@link WATER_UNIT} per
 * revolution: `nozzle = lost + handover + splatter + scatter`, exactly.
 */
export interface JetLedger {
  /** Out of the nozzles of the coherent jets. */
  readonly nozzle: number;
  /** Jets that struck nothing: counted as returned to the sump. */
  readonly lost: number;
  /** Handed to the film at the ends of the fans, and retained on wires. */
  readonly handover: number;
  /** Splattered where jets strike walls. */
  readonly splatter: number;
  /** Thrown off wires, tines and rims as fan droplets. */
  readonly scatter: number;
}

/** The output of the jet stage for one spray state. */
export interface JetStageOutput {
  readonly exposure: JetExposureTable;
  readonly arrival: WaterArrival;
  readonly stats: JetStageStats;
  /** The real stage: the hand-over to the film by phase, in integer units. */
  readonly handover?: JetHandover;
  /** The real stage: the droplet sources of the jets, for the secondary-water stage. */
  readonly sources?: DropletSources;
  /** The real stage: the force of the jets on every item they strike, by instance. */
  readonly loads?: readonly ItemJetLoad[];
  /** The real stage: the water balance of the jets. */
  readonly ledger?: JetLedger;
  /** The real stage: where the rays were traced. */
  readonly backend?: 'gpu' | 'cpu';
  /**
   * The real stage: per arm of the spray state (index into `SprayState.arms`), the arm angles
   * (radians) of the poses its solid geometry was traced at, in the order of the revolution:
   * one for an arm that stands still, `jets.armPoseBins` for one that turns, none for an arm
   * with no jets.
   */
  readonly armPoses?: readonly (readonly number[])[];
}

/**
 * The jet stage: primary jets of one spray state against the scene. Asynchronous because the
 * real stage traces on the GPU; the stand-in of the first build is `jetStageStandIn`.
 */
export type JetExposureStage = (input: ExposureStageInput) => Promise<JetStageOutput>;

/** An empty jet table for a scene with `soilCellCount` soil cells. */
export function emptyJetExposure(soilCellCount: number): JetExposureTable {
  return { soilCellCount, cell: new Uint32Array(0), values: new Float32Array(0) };
}

/** An empty arrival table for a scene with `blockCount` blocks. */
export function emptyWaterArrival(blockCount: number): WaterArrival {
  return { blockCount, block: new Uint32Array(0), flux: new Float32Array(0) };
}

/**
 * Adds arrival tables of one scene: the flux on a block is the sum of its fluxes. The result is
 * sorted by block and does not depend on the order of `tables` beyond floating-point addition,
 * which is done in the order given.
 */
export function sumWaterArrivals(
  blockCount: number,
  tables: readonly WaterArrival[],
): WaterArrival {
  const dense = new Float64Array(blockCount);
  const touched = new Uint8Array(blockCount);
  let count = 0;
  for (const table of tables) {
    if (table.blockCount !== blockCount) {
      throw new RangeError('sumWaterArrivals: tables of different scenes');
    }
    for (let i = 0; i < table.block.length; i++) {
      const b = table.block[i] as number;
      dense[b] = (dense[b] as number) + (table.flux[i] as number);
      if (touched[b] === 0) {
        touched[b] = 1;
        count++;
      }
    }
  }
  const block = new Uint32Array(count);
  const flux = new Float32Array(count);
  let k = 0;
  for (let b = 0; b < blockCount; b++) {
    if (touched[b] === 0) continue;
    block[k] = b;
    flux[k] = dense[b] as number;
    k++;
  }
  return { blockCount, block, flux };
}
