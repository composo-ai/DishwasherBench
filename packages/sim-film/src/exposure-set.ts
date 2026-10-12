/**
 * The exposure set of the first build (docs/design/scope.md, "Calibration is a first-class
 * feature"; docs/design/sim-core.md sections 2.2 and 5.1): everything the replay needs to know
 * about what one spray state does to the surfaces of a scene, as plain tables. It is computed
 * once per spray state and scene, cached, and replayed for every arm revolution of the
 * programme in which the state is active.
 *
 * An exposure set depends on the geometry, the machine and the `hydro` parameters only. It
 * knows nothing of soils, of the liquor or of its temperature, which is why a wash that
 * differs only in those reuses it.
 *
 * `computeExposureSet` runs the three stages of the exposure side in order: primary jets
 * (`@spotless/sim-jets`), secondary water (`@spotless/sim-spray`), surface water (this
 * package). By default they are the real stages of the first build (`EXPOSURE_STAGES`): the
 * jet trace and gather, the Monte Carlo of droplets and the kinematic cascade. The labelled
 * stand-ins they replaced are kept as `STAND_IN_EXPOSURE_STAGES`.
 *
 * With the real stages the set carries the water balance of the spray state
 * (`ExposureSetStats.water`): from the nozzles through the jets, the droplets and the film to
 * the sump, in whole units of `WATER_UNIT`, with every identity checked.
 *
 * Units: SI. Index spaces: the soil cells, blocks and basins of the `WashScene`.
 */

import { bytesToHex, sha256, utf8Encode } from '@spotless/core';
import {
  jetStage,
  jetStageStandIn,
  sumWaterArrivals,
  WATER_UNIT,
  type ExposureStageInput,
  type ItemJetLoad,
  type JetExposureStage,
  type JetExposureTable,
} from '@spotless/sim-jets';
import {
  secondaryWaterStage,
  secondaryWaterStandIn,
  type SecondaryWaterStage,
  type SecondaryWaterStats,
} from '@spotless/sim-spray';
import { surfaceWaterStandIn } from './stand-in.ts';
import { surfaceWaterStage } from './surface-stage.ts';
import type { FilmReport, SurfaceWaterStage, SurfaceWaterTable } from './surface-water.ts';

/**
 * Version of the content and encoding of an exposure set. Part of every cache key: raise it
 * when a table changes its columns or their meaning, or when a stage changes what it computes.
 * 2: the real jet, droplet and film stages; eight more columns in the jet table.
 * 3: `thickness` and `shear` are those of the flowing water only, `renewal` is over all the
 *    water on the block, a ninth water column `wetTime`; the jet fan is cut in narrow gaps
 *    between items; the phase origin of the arms follows the simulation seed.
 * 4: a tenth water column `exchange` (the inverse of the age of the water on the block);
 *    `renewal` is referred to `film.renewalLength`, so that it is the same at both tiers; gap
 *    reservoirs hold water; a film that breaks up leaves drops; the jet fan does not cross a
 *    covered face and hands its water over at the edge of the cover.
 * 5: the droplets of a source are drawn under the stable key of the source and settle through
 *    the landing kernel (no spread over the struck face); drips fall from fixed points of
 *    their drop; the march of the film begins with soak steps; a face that only collects
 *    drops has the cycle-mean `renewal` and `exchange`; a lower edge that is not level keeps
 *    its pinned drops. The columns are unchanged.
 * 6: `flux` counts run-on per width over the reference run `film.renewalLength` (the same at
 *    both tiers); in a gap reservoir `exchange` is that of the liquid the gap holds
 *    (`film.etaGap`) and `shear` is 0. The columns are unchanged.
 */
export const EXPOSURE_SET_SCHEMA = 6;

/**
 * The water of one spray state from the nozzles to the sump, per revolution of the master arm,
 * in whole units of `unit` kilograms (exact integers held in f64):
 *
 *   nozzle            = jets + showers
 *   jets              = jetLost + handover + splatter + scatter              (the jet stage)
 *   splatter + scatter + showers = dropletsLanded + dropletsLost             (the droplets)
 *   filmFed           = handover + dropletsLanded                            (per revolution)
 *   film.fed + film.primed = film.toSump + film.stored                       (over the march)
 *
 * `closes` says that every one of these holds exactly.
 */
export interface WaterBalance {
  /** Kilograms per unit. */
  readonly unit: number;
  readonly nozzle: number;
  readonly jets: number;
  readonly showers: number;
  readonly jetLost: number;
  readonly handover: number;
  readonly splatter: number;
  readonly scatter: number;
  readonly dropletsLanded: number;
  readonly dropletsLost: number;
  readonly filmFed: number;
  readonly closes: boolean;
  /**
   * Share of the nozzle outflow that is back in the sump within a revolution in the periodic
   * state: jets and droplets that struck nothing, plus what the film returned in the last
   * recorded revolution.
   */
  readonly sumpReturnFraction: number;
}

/** Numbers about an exposure set, for reports and checks. */
export interface ExposureSetStats {
  /** Jet rays traced and how many struck something. */
  readonly jetRays: number;
  readonly jetHits: number;
  /** Soil cells that are ever inside a jet footprint. */
  readonly jetCells: number;
  /** Droplet paths of the secondary water and how many landed. */
  readonly secondaryPaths: number;
  readonly secondaryLanded: number;
  /** The real stages: how the droplet landings were settled (`SecondaryWaterStats.settled`). */
  readonly secondarySettled?: NonNullable<SecondaryWaterStats['settled']>;
  /** Blocks that are ever wet, and their area, m2. */
  readonly wetBlocks: number;
  readonly wetArea: number;
  /** Water arriving on surfaces out of the air, kg/s, and the flow that struck nothing, m3/s. */
  readonly arrivalRate: number;
  readonly lostFlow: number;
  /** The real stages: where the rays and segments were traced. */
  readonly backend?: 'gpu' | 'cpu';
  /** The real stages: the water balance of the state. */
  readonly water?: WaterBalance;
  /** The real stages: the march of the film (water held, wetted share, convergence). */
  readonly film?: FilmReport;
  /**
   * The real stages: the force of the jets on every item they strike, as a screening for items
   * the jets would move (`liftRatio` where the masses were given).
   */
  readonly itemLoads?: readonly ItemJetLoad[];
}

/** What one spray state does to the surfaces of a scene. */
export interface ExposureSet {
  /** {@link EXPOSURE_SET_SCHEMA} of the code that computed it. */
  readonly schema: number;
  /** `SprayState.id` and `SprayState.key` of the state it belongs to. */
  readonly stateId: string;
  readonly stateKey: string;
  /** True when a stand-in stage took part in computing it. */
  readonly standIn: boolean;
  /** Per soil cell: what direct jets do to it (`JET_FIELDS`). */
  readonly jets: JetExposureTable;
  /** Per block: the water it receives, carries and keeps (`WATER_FIELDS`). */
  readonly water: SurfaceWaterTable;
  /** Per basin of the scene: mass rate of water entering while the state is active, kg/s. */
  readonly poolInflow: Float32Array;
  readonly stats: ExposureSetStats;
}

/** The three stages of the exposure side. */
export interface ExposureStages {
  readonly jets: JetExposureStage;
  readonly secondary: SecondaryWaterStage;
  readonly surface: SurfaceWaterStage;
  /** True when any of the three is a stand-in. */
  readonly standIn: boolean;
}

/** The stand-ins the real stages replaced, as stages (kept for comparison). */
export const STAND_IN_EXPOSURE_STAGES: ExposureStages = {
  jets: (input) => Promise.resolve(jetStageStandIn(input)),
  secondary: (input) => Promise.resolve(secondaryWaterStandIn(input)),
  surface: (input, arrival) => Promise.resolve(surfaceWaterStandIn(input, arrival)),
  standIn: true,
};

/** The real stages of the first build: jet trace and gather, droplets, kinematic cascade. */
export const EXPOSURE_STAGES: ExposureStages = {
  jets: jetStage,
  secondary: secondaryWaterStage,
  surface: surfaceWaterStage,
  standIn: false,
};

/** The exposure stage as the orchestrator calls it: one spray state against one scene. */
export type ExposureStage = (input: ExposureStageInput) => Promise<ExposureSet>;

/**
 * Computes the exposure set of one spray state: jets, then secondary water, then the surface
 * water fed by both. Throws if the water balance of the real stages does not close.
 */
export async function computeExposureSet(
  input: ExposureStageInput,
  stages: ExposureStages = EXPOSURE_STAGES,
): Promise<ExposureSet> {
  const jets = await stages.jets(input);
  const secondary = await stages.secondary(input, jets);
  const arrival = sumWaterArrivals(input.scene.blocks.count, [jets.arrival, secondary.arrival]);
  const surface = await stages.surface(input, arrival, {
    handover: jets.handover,
    deposits: secondary.deposits,
    drips: secondary.drips,
  });
  const film = surface.stats.film;
  let water: WaterBalance | undefined;
  if (jets.ledger !== undefined && secondary.ledger !== undefined && film !== undefined) {
    const j = jets.ledger;
    const d = secondary.ledger;
    const nozzle = j.nozzle + d.showers;
    const closes =
      j.nozzle === j.lost + j.handover + j.splatter + j.scatter &&
      d.sources === j.splatter + j.scatter &&
      d.sources + d.showers === d.deposited + d.lost &&
      film.fedPerRevolution === j.handover + d.deposited &&
      film.fed + film.primed === film.toSump + film.stored;
    if (!closes) {
      throw new Error(
        `computeExposureSet: the water balance of ${input.state.id} does not close: ` +
          JSON.stringify({ jets: j, droplets: d, film }),
      );
    }
    water = {
      unit: WATER_UNIT,
      nozzle,
      jets: j.nozzle,
      showers: d.showers,
      jetLost: j.lost,
      handover: j.handover,
      splatter: j.splatter,
      scatter: j.scatter,
      dropletsLanded: d.deposited,
      dropletsLost: d.lost,
      filmFed: film.fedPerRevolution,
      closes,
      sumpReturnFraction: nozzle > 0 ? (j.lost + d.lost + film.sumpLastRevolution) / nozzle : 0,
    };
  }
  const backend = jets.backend ?? secondary.backend;
  return {
    schema: EXPOSURE_SET_SCHEMA,
    stateId: input.state.id,
    stateKey: input.state.key,
    standIn: stages.standIn,
    jets: jets.exposure,
    water: surface.water,
    poolInflow: surface.poolInflow,
    stats: {
      jetRays: jets.stats.rays,
      jetHits: jets.stats.hits,
      jetCells: jets.exposure.cell.length,
      secondaryPaths: secondary.stats.paths,
      secondaryLanded: secondary.stats.landed,
      ...(secondary.stats.settled === undefined
        ? {}
        : { secondarySettled: secondary.stats.settled }),
      wetBlocks: surface.stats.wetBlocks,
      wetArea: surface.stats.wetArea,
      arrivalRate: surface.stats.arrivalRate,
      lostFlow: jets.stats.lostFlow + secondary.stats.lostFlow,
      ...(backend === undefined ? {} : { backend }),
      ...(water === undefined ? {} : { water }),
      ...(film === undefined ? {} : { film }),
      ...(jets.loads === undefined ? {} : { itemLoads: jets.loads }),
    },
  };
}

const MAGIC = 0x45585053; // 'SPXE' in little-endian byte order

interface Header {
  readonly schema: number;
  readonly stateId: string;
  readonly stateKey: string;
  readonly standIn: boolean;
  readonly soilCellCount: number;
  readonly jetCells: number;
  readonly jetFields: number;
  readonly blockCount: number;
  readonly waterFields: number;
  readonly basins: number;
  readonly stats: ExposureSetStats;
}

/**
 * An exposure set as bytes, for a cache: a little-endian header (magic, header length), the
 * header as JSON padded to four bytes, then the four arrays as stored (32-bit words in the
 * byte order of the machine, which is little-endian on every supported stack). The encoding of
 * equal sets is byte-identical.
 */
export function encodeExposureSet(set: ExposureSet): Uint8Array {
  const jetFields = set.jets.cell.length > 0 ? set.jets.values.length / set.jets.cell.length : 0;
  const waterFields = set.water.blockCount > 0 ? set.water.values.length / set.water.blockCount : 0;
  const header: Header = {
    schema: set.schema,
    stateId: set.stateId,
    stateKey: set.stateKey,
    standIn: set.standIn,
    soilCellCount: set.jets.soilCellCount,
    jetCells: set.jets.cell.length,
    jetFields,
    blockCount: set.water.blockCount,
    waterFields,
    basins: set.poolInflow.length,
    stats: set.stats,
  };
  const text = utf8Encode(JSON.stringify(header));
  const padded = (text.length + 3) & ~3;
  const arrays: readonly (Uint32Array | Float32Array)[] = [
    set.jets.cell,
    set.jets.values,
    set.water.values,
    set.poolInflow,
  ];
  let size = 8 + padded;
  for (const a of arrays) size += a.byteLength;
  const out = new Uint8Array(size);
  const view = new DataView(out.buffer);
  view.setUint32(0, MAGIC, true);
  view.setUint32(4, text.length, true);
  out.set(text, 8);
  let offset = 8 + padded;
  for (const a of arrays) {
    out.set(new Uint8Array(a.buffer, a.byteOffset, a.byteLength), offset);
    offset += a.byteLength;
  }
  return out;
}

/**
 * The exposure set of `encodeExposureSet`. Throws a RangeError for bytes that are not an
 * exposure set or are cut short; a set of another schema decodes and is for the caller to
 * reject.
 */
export function decodeExposureSet(bytes: Uint8Array): ExposureSet {
  if (bytes.byteLength < 8) throw new RangeError('decodeExposureSet: too short');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== MAGIC)
    throw new RangeError('decodeExposureSet: not an exposure set');
  const length = view.getUint32(4, true);
  const padded = (length + 3) & ~3;
  if (bytes.byteLength < 8 + padded) throw new RangeError('decodeExposureSet: header cut short');
  const header = JSON.parse(new TextDecoder().decode(bytes.subarray(8, 8 + length))) as Header;
  let offset = 8 + padded;
  const take = (words: number): ArrayBuffer => {
    const end = offset + 4 * words;
    if (end > bytes.byteLength) throw new RangeError('decodeExposureSet: arrays cut short');
    // A copy, so that the result is aligned and does not keep the input alive.
    const copy = bytes.slice(offset, end).buffer;
    offset = end;
    return copy;
  };
  const cell = new Uint32Array(take(header.jetCells));
  const values = new Float32Array(take(header.jetCells * header.jetFields));
  const water = new Float32Array(take(header.blockCount * header.waterFields));
  const poolInflow = new Float32Array(take(header.basins));
  if (offset !== bytes.byteLength) throw new RangeError('decodeExposureSet: trailing bytes');
  return {
    schema: header.schema,
    stateId: header.stateId,
    stateKey: header.stateKey,
    standIn: header.standIn,
    jets: { soilCellCount: header.soilCellCount, cell, values },
    water: { blockCount: header.blockCount, values: water },
    poolInflow,
    stats: header.stats,
  };
}

/** `sha256:` hash of the encoded exposure set. */
export function exposureSetHash(set: ExposureSet): string {
  return `sha256:${bytesToHex(sha256(encodeExposureSet(set)))}`;
}
